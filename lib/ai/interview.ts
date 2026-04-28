import fs from "fs";
import path from "path";

export type JobContext = {
  jobId: string;
  context: string;
  questions: string;
  grading: string;
  highPerformers: string;
};

export type CandidateInfo = {
  name: string;
  email: string;
  linkedinUrl?: string;
  githubUrl?: string;
  xHandle?: string;
};

export type EnrichmentData = {
  linkedin?: {
    headline?: string;
    summary?: string;
    experience?: string[];
    skills?: string[];
    location?: string;
  };
  github?: {
    bio?: string;
    publicRepos?: number;
    followers?: number;
    topRepos?: { name: string; description?: string; language?: string; stars: number }[];
    languages?: string[];
    recentActivity?: string;
  };
  twitter?: {
    bio?: string;
    followers?: number;
    recentPosts?: { text: string; date: string; likes: number }[];
  };
  // NOTE: Gmail threads and CRM data are intentionally excluded from pre-interview enrichment.
  // CRM could contain internal notes, deal info, or other-candidate references.
  // CRM lookup + write happens only post-interview in /api/interview/complete.

  // Metadata about which sources were queried
  sources?: { name: string; status: "success" | "error" | "skipped"; toolSlug?: string }[];
};

const JOBS_DIR = path.join(process.cwd(), "jobs");

export function getAvailableJobs(): string[] {
  try {
    return fs
      .readdirSync(JOBS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

export function loadJobContext(jobId: string): JobContext | null {
  const jobDir = path.join(JOBS_DIR, jobId);
  if (!fs.existsSync(jobDir)) return null;

  const readFile = (name: string) => {
    const filePath = path.join(jobDir, name);
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
  };

  return {
    jobId,
    context: readFile("context.md"),
    questions: readFile("questions.md"),
    grading: readFile("grading.md"),
    highPerformers: readFile("high-performers.md"),
  };
}

export function buildInterviewSystemPrompt(
  job: JobContext,
  candidate: CandidateInfo,
  enrichment?: EnrichmentData
): string {
  let prompt = `You are an AI interviewer conducting a screening interview. You must stay in character throughout the entire conversation.

## Your Role & Persona
${job.context}

## Candidate Information
- Email: ${candidate.email}
${candidate.name ? `- Name: ${candidate.name}` : ""}
${candidate.linkedinUrl ? `- LinkedIn: ${candidate.linkedinUrl}` : ""}
${candidate.githubUrl ? `- GitHub: ${candidate.githubUrl}` : ""}
${candidate.xHandle ? `- X/Twitter: ${candidate.xHandle}` : ""}
`;

  if (enrichment) {
    prompt += "\n## Pre-Interview Research (Composio-sourced)\n";

    if (enrichment.linkedin) {
      const li = enrichment.linkedin;
      prompt += `\n### LinkedIn Profile
${li.headline ? `- Headline: ${li.headline}` : ""}
${li.summary ? `- Summary: ${li.summary}` : ""}
${li.location ? `- Location: ${li.location}` : ""}
${li.experience?.length ? `- Recent Experience:\n${li.experience.map((e) => `  - ${e}`).join("\n")}` : ""}
${li.skills?.length ? `- Key Skills: ${li.skills.join(", ")}` : ""}
`;
    }

    if (enrichment.github) {
      const gh = enrichment.github;
      prompt += `\n### GitHub Profile
${gh.bio ? `- Bio: ${gh.bio}` : ""}
${gh.publicRepos ? `- Public repos: ${gh.publicRepos}` : ""}
${gh.followers ? `- Followers: ${gh.followers}` : ""}
${gh.languages?.length ? `- Top languages: ${gh.languages.join(", ")}` : ""}
${gh.topRepos?.length ? `- Notable repos:\n${gh.topRepos.map((r) => `  - ${r.name}${r.language ? ` (${r.language})` : ""} — ${r.stars} stars${r.description ? `: ${r.description}` : ""}`).join("\n")}` : ""}
${gh.recentActivity ? `- Recent activity: ${gh.recentActivity}` : ""}
`;
    }

    if (enrichment.twitter) {
      const tw = enrichment.twitter;
      prompt += `\n### X/Twitter
${tw.bio ? `- Bio: ${tw.bio}` : ""}
${tw.followers ? `- Followers: ${tw.followers}` : ""}
${tw.recentPosts?.length ? `- Recent posts:\n${tw.recentPosts.map((p) => `  - [${p.date}] "${p.text}" (${p.likes} likes)`).join("\n")}` : ""}
`;
    }

    // Gmail threads intentionally excluded from pre-interview context (security)
  }

  prompt += `
## Interview Question Flow
${job.questions}

## Grading Criteria & Segmentation
${job.grading}

## Examples of High-Performing Candidates
${job.highPerformers}

## Interview Conduct Rules
1. **Start the conversation yourself.** Greet the candidate by name and deliver the opening question naturally. Do NOT wait for them to speak first.
2. **Ask one question at a time.** After each response, acknowledge what they said, then transition naturally to the next question. Do not list multiple questions.
3. **Adapt dynamically.** If a candidate's answer reveals strength in an area, spend less time there. If they're vague, probe deeper. Use the question flow as a guide, not a rigid script.
4. **Use the enrichment data subtly.** Reference their background naturally ("I see you were at [Company]...") but don't read their resume back to them.
5. **Be warm but rigorous.** Build rapport while still pushing for specific examples, metrics, and outcomes.
6. **Track your assessment internally.** After each answer, mentally note which scoring dimensions are being addressed and how the candidate is performing.
7. **After 8-12 exchanges (your messages + their responses), begin wrapping up.** Ask if they have questions for you, then conclude.
8. **When the conversation is complete (after they've asked their questions or said they're done), provide your evaluation.** Output a structured assessment using the grading criteria.

## Evaluation Output Format
When concluding the interview, output your evaluation in this EXACT format (the system parses this programmatically — do not deviate):

---
## Interview Evaluation: [Candidate Email/Name]

### Scores
- **Builder DNA:** [1-5] - [Brief justification]
- **AI-Native Thinking:** [1-5] - [Brief justification]
- **Growth Intuition:** [1-5] - [Brief justification]
- **Curiosity & Learning Velocity:** [1-5] - [Brief justification]
- **Community Energy:** [1-5] - [Brief justification]

### Weighted Score: [X.X / 5.0]

### Tier: [TOP_5_PERCENT / FOLLOW_UP / PASS]
Use these exact tier labels based on the weighted score:
- TOP_5_PERCENT if weighted score >= 4.5
- FOLLOW_UP if weighted score is 3.5 to 4.4
- PASS if weighted score < 3.5

### Summary
[2-3 sentences: key strengths, gaps, and what happens next for this candidate]

### Red Flags: [None / List]
### Green Flags: [List]
---

Remember: You are the interviewer. Start the conversation NOW with your opening greeting and first question.`;

  return prompt;
}
