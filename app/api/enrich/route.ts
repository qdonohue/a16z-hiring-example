import type { EnrichmentData } from "@/lib/ai/interview";
import { composioExec, isComposioAvailable } from "@/lib/composio";

// Enriches candidate data using the Composio SDK.
// Dynamically decides which tools to call based on what the candidate provided.
//
// SECURITY MODEL:
// - API keys are ONLY used server-side via the Composio SDK — never in prompts
// - Each enrichment request is stateless and scoped to exactly one candidate
// - No candidate data is persisted or shared across sessions
// - Read-only enrichment: we pull data but don't write to LinkedIn/Gmail/Twitter
// - Write-back (HubSpot, Slack, Calendar) happens only post-interview via /api/interview/complete

export async function POST(request: Request) {
  const body = await request.json();
  const { email, linkedinUrl, githubUrl, xHandle } = body;

  console.log("[enrich] Starting enrichment for:", email);
  console.log("[enrich] Composio available:", isComposioAvailable());
  console.log("[enrich] Inputs provided:", {
    linkedin: Boolean(linkedinUrl),
    github: Boolean(githubUrl),
    twitter: Boolean(xHandle),
  });

  const start = Date.now();

  if (isComposioAvailable()) {
    const enrichment = await enrichWithComposio(email, linkedinUrl, githubUrl, xHandle);
    console.log("[enrich] Completed in", Date.now() - start, "ms");
    console.log("[enrich] Sources:", enrichment.sources?.map((s) => `${s.name}: ${s.status}`).join(", "));
    return Response.json(enrichment);
  }

  console.log("[enrich] Using mock data (no COMPOSIO_API_KEY)");
  console.log("[enrich] In production, the following Composio tools would execute:");
  if (linkedinUrl) console.log("[enrich]   → LINKEDIN_GET_PERSON:", linkedinUrl);
  else console.log("[enrich]   → LINKEDIN_GET_PERSON: skipped (no URL provided)");
  if (githubUrl) console.log("[enrich]   → GITHUB_LIST_REPOSITORIES_FOR_A_USER:", githubUrl);
  else console.log("[enrich]   → GITHUB_LIST_REPOSITORIES_FOR_A_USER: skipped (no URL provided)");
  if (xHandle) {
    console.log("[enrich]   → TWITTER_USER_LOOKUP_BY_USERNAME:", xHandle);
    console.log("[enrich]   → TWITTER_RECENT_SEARCH: from:" + xHandle.replace(/^@/, ""));
  } else {
    console.log("[enrich]   → TWITTER_USER_LOOKUP_BY_USERNAME: skipped (no handle provided)");
  }
  console.log("[enrich]   → GMAIL_LIST_THREADS: skipped (security — post-interview only)");
  console.log("[enrich]   → HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA: skipped (security — post-interview only)");

  const enrichment = getMockEnrichment(email, linkedinUrl, githubUrl, xHandle);
  console.log("[enrich] Mock enrichment returned in", Date.now() - start, "ms");
  return Response.json(enrichment);
}

async function enrichWithComposio(
  email: string,
  linkedinUrl?: string,
  githubUrl?: string,
  xHandle?: string
): Promise<EnrichmentData> {
  const sources: NonNullable<EnrichmentData["sources"]> = [];
  const results: EnrichmentData = {};
  const tasks: Promise<void>[] = [];

  // ── LinkedIn ──────────────────────────────────────────────
  if (linkedinUrl) {
    console.log("[enrich] Executing LINKEDIN_GET_PERSON for:", linkedinUrl);
    tasks.push(
      composioExec("LINKEDIN_GET_PERSON", { person_url: linkedinUrl })
        .then((data) => {
          console.log("[enrich] ✓ LinkedIn success — headline:", data.headline);
          results.linkedin = {
            headline: data.headline,
            summary: data.summary,
            experience: data.experiences?.map(
              (e: any) => `${e.title} at ${e.company} (${e.duration})`
            ),
            skills: data.skills?.slice(0, 10),
            location: data.location,
          };
          sources.push({ name: "LinkedIn", status: "success", toolSlug: "LINKEDIN_GET_PERSON" });
        })
        .catch((err) => {
          console.error("[enrich] ✗ LinkedIn failed:", err.message || err);
          sources.push({ name: "LinkedIn", status: "error", toolSlug: "LINKEDIN_GET_PERSON" });
        })
    );
  } else {
    console.log("[enrich] LinkedIn: skipped (no URL provided)");
    sources.push({ name: "LinkedIn", status: "skipped" });
  }

  // ── GitHub (via GITHUB_LIST_REPOSITORIES_FOR_A_USER) ─────
  if (githubUrl) {
    const username = githubUrl
      .replace(/https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\/.*/, "")
      .trim();
    if (username) {
      console.log("[enrich] Executing GITHUB_LIST_REPOSITORIES_FOR_A_USER for:", username);
      tasks.push(
        composioExec("GITHUB_LIST_REPOSITORIES_FOR_A_USER", {
          username,
          sort: "pushed",
          per_page: 10,
          direction: "desc",
        })
          .then((data) => {
            const repos = data.repositories || data.data || data || [];
            const repoList = Array.isArray(repos) ? repos : [];
            const languages = [...new Set(
              repoList.map((r: any) => r.language).filter(Boolean)
            )] as string[];

            console.log("[enrich] ✓ GitHub success —", repoList.length, "repos, languages:", languages.join(", "));

            results.github = {
              bio: data.bio || undefined,
              publicRepos: repoList.length,
              followers: data.followers || undefined,
              languages,
              topRepos: repoList
                .sort((a: any, b: any) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
                .slice(0, 5)
                .map((r: any) => ({
                  name: r.name || r.full_name,
                  description: r.description,
                  language: r.language,
                  stars: r.stargazers_count || 0,
                })),
              recentActivity: repoList[0]?.pushed_at
                ? `Last push ${new Date(repoList[0].pushed_at).toLocaleDateString()}`
                : undefined,
            };
            sources.push({ name: "GitHub", status: "success", toolSlug: "GITHUB_LIST_REPOSITORIES_FOR_A_USER" });
          })
          .catch((err) => {
            console.error("[enrich] ✗ GitHub failed:", err.message || err);
            sources.push({ name: "GitHub", status: "error", toolSlug: "GITHUB_LIST_REPOSITORIES_FOR_A_USER" });
          })
      );
    }
  } else {
    console.log("[enrich] GitHub: skipped (no URL provided)");
    sources.push({ name: "GitHub", status: "skipped" });
  }

  // ── X/Twitter (via TWITTER_USER_LOOKUP_BY_USERNAME + TWITTER_RECENT_SEARCH) ──
  if (xHandle) {
    const handle = xHandle.replace(/^@/, "").replace(/https?:\/\/(www\.)?(twitter\.com|x\.com)\//, "").replace(/\/.*/, "").trim();
    if (handle) {
      console.log("[enrich] Executing TWITTER_USER_LOOKUP_BY_USERNAME for:", handle);
      tasks.push(
        (async () => {
          try {
            const profileData = await composioExec("TWITTER_USER_LOOKUP_BY_USERNAME", {
              username: handle,
              user_fields: ["description", "public_metrics", "created_at", "location"],
            });
            const user = profileData?.data?.data || profileData?.data || profileData;

            console.log("[enrich] ✓ Twitter profile — bio:", user.description?.slice(0, 60), "followers:", user.public_metrics?.followers_count);

            results.twitter = {
              bio: user.description,
              followers: user.public_metrics?.followers_count,
              recentPosts: [],
            };

            // Step 2: Get recent tweets
            console.log("[enrich] Executing TWITTER_RECENT_SEARCH for: from:" + handle);
            try {
              const tweetsData = await composioExec("TWITTER_RECENT_SEARCH", {
                query: `from:${handle} -is:retweet -is:reply`,
                max_results: "10",
                tweet_fields: ["created_at", "public_metrics", "text"],
              });
              const tweets = tweetsData?.data?.data || tweetsData?.data || [];
              if (Array.isArray(tweets)) {
                results.twitter!.recentPosts = tweets.slice(0, 5).map((t: any) => ({
                  text: (t.note_tweet?.text || t.text || "").slice(0, 280),
                  date: t.created_at ? new Date(t.created_at).toLocaleDateString() : "recent",
                  likes: t.public_metrics?.like_count || 0,
                }));
                console.log("[enrich] ✓ Twitter recent search —", results.twitter!.recentPosts!.length, "tweets found");
              }
            } catch (err: any) {
              console.warn("[enrich] ⚠ Twitter recent search failed (profile still succeeded):", err.message || err);
            }

            sources.push({ name: "X/Twitter", status: "success", toolSlug: "TWITTER_USER_LOOKUP_BY_USERNAME" });
          } catch (err: any) {
            console.error("[enrich] ✗ Twitter failed:", err.message || err);
            sources.push({ name: "X/Twitter", status: "error", toolSlug: "TWITTER_USER_LOOKUP_BY_USERNAME" });
          }
        })()
      );
    }
  } else {
    console.log("[enrich] X/Twitter: skipped (no handle provided)");
    sources.push({ name: "X/Twitter", status: "skipped" });
  }

  // NOTE: Gmail + HubSpot intentionally excluded from pre-interview enrichment (security)
  console.log("[enrich] Gmail: skipped (security — post-interview only)");
  console.log("[enrich] HubSpot: skipped (security — post-interview only)");

  await Promise.allSettled(tasks);
  results.sources = sources;
  return results;
}

// ── Mock data for development without Composio ──────────────

function getMockEnrichment(
  email: string,
  linkedinUrl?: string,
  githubUrl?: string,
  xHandle?: string
): EnrichmentData {
  const sources: NonNullable<EnrichmentData["sources"]> = [];
  const result: EnrichmentData = {};

  if (linkedinUrl) {
    result.linkedin = {
      headline: "Growth Engineer | AI-native GTM | Building at scale",
      summary:
        "Full-stack growth engineer obsessed with AI-powered funnels, personalization at scale, and agentic workflows.",
      experience: [
        "Senior Growth Engineer at DevAI (2023-Present)",
        "Growth Engineer at Acme Developer Tools (2021-2023)",
        "Full-Stack Engineer at a YC startup (2019-2021)",
      ],
      skills: ["AI Agents", "Growth Engineering", "Next.js", "Python", "LLM Pipelines", "A/B Testing"],
      location: "San Francisco, CA",
    };
    sources.push({ name: "LinkedIn", status: "success", toolSlug: "LINKEDIN_GET_PERSON" });
  } else {
    sources.push({ name: "LinkedIn", status: "skipped" });
  }

  if (githubUrl) {
    result.github = {
      bio: "Building AI-powered growth tools. Open source enthusiast.",
      publicRepos: 47,
      followers: 312,
      languages: ["TypeScript", "Python", "Rust"],
      topRepos: [
        { name: "growth-agent", description: "AI agent for automated growth experiments", language: "TypeScript", stars: 234 },
        { name: "funnel-optimizer", description: "ML-powered conversion funnel optimization", language: "Python", stars: 89 },
        { name: "landing-gen", description: "Generate personalized landing pages with LLMs", language: "TypeScript", stars: 156 },
      ],
      recentActivity: "Last push today",
    };
    sources.push({ name: "GitHub", status: "success", toolSlug: "GITHUB_LIST_REPOSITORIES_FOR_A_USER" });
  } else {
    sources.push({ name: "GitHub", status: "skipped" });
  }

  if (xHandle) {
    result.twitter = {
      bio: "Growth engineer. Building with AI. Shipping > talking.",
      followers: 2847,
      recentPosts: [
        { text: "Just shipped an AI agent that generates personalized onboarding flows based on the user's GitHub profile. Activation rate went from 12% to 31%.", date: "2026-04-25", likes: 127 },
        { text: "Hot take: the best growth engineers in 2026 spend more time in their IDE than in their analytics dashboard.", date: "2026-04-22", likes: 89 },
        { text: "Been experimenting with using Claude to auto-generate A/B test hypotheses from session recordings. Results are surprisingly good.", date: "2026-04-18", likes: 203 },
      ],
    };
    sources.push({ name: "X/Twitter", status: "success", toolSlug: "TWITTER_USER_LOOKUP_BY_USERNAME" });
  } else {
    sources.push({ name: "X/Twitter", status: "skipped" });
  }

  // Gmail + HubSpot intentionally excluded — accessed post-interview only (security)

  result.sources = sources;
  return result;
}
