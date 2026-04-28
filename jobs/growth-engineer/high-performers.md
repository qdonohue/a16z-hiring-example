# Growth Engineer Fellowship - High Performer Examples

## Example 1: "The AI-Native Pipeline Builder"
**Background:** Senior Growth Engineer at a Series B dev tools company. Previously did growth at an AI startup. Self-taught engineer who started in marketing.

**What made them exceptional:**
- Built an AI agent that generates personalized landing pages for each prospect based on their GitHub repos and tech stack. "We went from 3% to 11% demo conversion overnight. The pages literally reference their own codebase."
- Walked through the full architecture unprompted: "Scrape their public repos, classify their stack with Claude, generate a landing page with dynamic content blocks, serve it through our CDN with edge personalization. Whole thing runs on a cron job."
- When asked about growth intuition, immediately drew the funnel: "At our ARR, activation is the only thing that matters. We were losing 85% of signups before they hit the aha moment. So I built an onboarding agent that watches what they're doing in the product and nudges them toward the critical actions."
- Failed experiment story was gold: "I tried using AI to auto-generate cold emails at scale. Open rates were great but reply quality was garbage — turns out AI-generated personalization reads as creepy if you get the tone wrong. So I rebuilt it as AI-suggested talking points that humans review."

**Key interview moments:**
- Shared a live link to a system dashboard during the conversation
- When asked about tools: "I live in Cursor, ship to Vercel, pipeline data through Segment into a custom analytics layer I built with DuckDB. I use Claude for code gen, GPT-4o for image stuff, and I have a bunch of Make.com workflows for the operational stuff I haven't bothered to code yet."
- Asked great questions: "How does Andrew think about the PLG-to-outbound transition for AI companies? The old playbooks feel broken."

## Example 2: "The Full-Stack Growth Hacker"
**Background:** Founding engineer at a consumer AI app. Previously growth PM at a social platform. Comp sci degree but self-describes as "more growth than engineer."

**What made them exceptional:**
- Built the entire referral + viral loop system for their app: "We got to 100K users in 6 weeks, zero paid spend. The referral flow generates a personalized invite video using the inviter's usage data — it shows their actual creations. Conversion on those invite links is 34%."
- AI-native to the core: "Every piece of content our growth engine produces is AI-generated and A/B tested automatically. We generate 50 variants of every landing page headline, run them through a scoring model I trained on our historical conversion data, and only the top 5 go live."
- When given the B2B activation scenario: "15% activation rate means your TTV (time to value) is too long or your 'aha moment' isn't clear enough. First thing I'd do is instrument every step of the first 10 minutes. Where's the drop? Is it a technical blocker (setup, auth, config) or a value blocker (they don't see why they should care)? Those are totally different problems. I'd also look at the 15% who DO activate — what do they have in common?"
- On personalization at scale: "The game changed when I stopped thinking about segments and started thinking about individuals. We have 47 different onboarding flows now, selected by an ML model based on the user's referral source, device, time zone, and first 3 actions."

**Key interview moments:**
- Genuinely geeked out about growth metrics for 5 minutes unprompted
- Mentioned teaching themselves Bayesian stats to build a better experimentation framework
- Fellowship question: "Is there a Slack or Discord for the cohort? I'd want to start sharing stuff before the program even starts."

## Example 3: "The GTM Automator"
**Background:** Head of Growth at a fintech startup. Previously ran demand gen at a SaaS company. MBA but codes in Python and TypeScript.

**What made them exceptional:**
- Built a "GTM operating system" that runs their entire pipeline: "We have AI agents that score inbound leads, write personalized sequences, book demos, and even do initial discovery calls via voice AI. Our sales team only talks to prospects who've already been qualified by the agent."
- Honest about what doesn't work: "The voice agent is great for discovery but terrible for objection handling. Humans are still way better at the emotional nuance. So we use AI for the boring stuff and humans for the hard stuff."
- Pattern recognition was sharp: "Every fintech I've seen has the same growth problem — trust. Nobody wants to give money to a startup. So your growth engine has to be a trust engine first. Social proof, regulatory compliance badges, real-time security indicators. We A/B tested 200 different trust signals and the winner was something stupid simple — showing the exact number of active users in their city."
- On the fellowship: "I want to learn how the best dev tools companies think about growth. Fintech growth is so regulated that we've had to be creative in ways that might be useful to share, but I feel like I'm in a bubble."

**Key interview moments:**
- Pulled up their analytics dashboard and walked through it in real-time
- When discussing AI: "I'm bullish on agentic workflows but I think most people are building them wrong. They're trying to replace humans when they should be building human-in-the-loop systems that get progressively more autonomous as trust is established."
- Asked about the dinner format: "Is it more presentation-style or working sessions? I'd love to bring a half-baked project and get people's input."

## Anti-Pattern: What Weak Candidates Look Like
- **The Strategist:** Talks about growth frameworks and theory but hasn't built anything. Says "my team built..." for everything. When you ask how, they describe the JIRA ticket, not the code.
- **The Tool Tourist:** Uses every AI tool but hasn't built any AI-native systems. "I use ChatGPT for writing, Midjourney for images, and Jasper for ads." No custom workflows, no agents, no systems.
- **The Metrics Reciter:** Can rattle off their CAC and LTV but can't explain the systems that produce those numbers. Growth to them is a dashboard, not a machine.
- **The Lone Wolf:** Clearly talented but shows zero interest in the cohort or community. Answers questions about collaboration with "I work best alone."
- **The Hype Follower:** Everything is "AI-first" and "agentic" but when you dig in, they're wrapping OpenAI APIs in a Next.js app and calling it revolutionary.
