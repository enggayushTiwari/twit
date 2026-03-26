# Idea Engine

Idea Engine is a **capture-to-content pipeline** that transforms raw thoughts, project notes, and web research into high-quality social media drafts. It leverages vector similarity search and large language models (Gemini) to ensure every draft is grounded in your personal knowledge base while adapting to your unique voice — a voice the system gradually learns from your reflections, edits, approvals, and rejections.

> **One-line pitch**: Drop raw thoughts in, get publication-ready tweets out — in your own voice, grounded in your own ideas.

---

## Table of Contents

1. [Core Concepts](#-core-concepts)
2. [Platform Navigation](#-platform-navigation)
3. [Page-by-Page Guide](#-page-by-page-guide)
   - [Capture (Home Page)](#1-capture-home-page-)
   - [Knowledge Vault](#2-knowledge-vault-)
   - [Mind Model](#3-mind-model-)
   - [Build Workspace](#4-build-in-public-workspace-)
   - [Distribution OS](#5-distribution-os-)
   - [Review Dashboard](#6-review-dashboard-)
4. [Auto-Generation](#-auto-generation)
5. [Tech Stack](#-tech-stack)
6. [Setup & Installation](#-setup--installation)
7. [Database Notes](#-database-notes)
8. [How It All Connects](#-how-it-all-connects)

---

## 🧠 Core Concepts

Before diving in, these are the key ideas that power the platform:

| Concept | What It Means |
|---|---|
| **Vault** | Your personal knowledge base of raw ideas, project logs, and scraped web content — all vectorized for semantic search. |
| **Mind Model** | A living, evolving profile of your beliefs, lenses, obsessions, taste, and voice rules — built passively from your inputs, reflections, and draft feedback. |
| **Reflection Loop** | The system periodically asks you sharp follow-up questions about your ideas, news events, or draft feedback to deepen its understanding of *how you think*, not just *what you said*. |
| **Fresh Inferences** | AI-generated mind-model entry suggestions (beliefs, lenses, obsessions) that appear after each idea capture. These are proposals — you confirm or reject them in the Mind Model page. |
| **Voice Framework** | A reverse-engineered personality "DNA" of any creator, extracted from their golden tweets. Used as an optional style reference during generation. |
| **Thesis-Ranked Generation** | Drafts are generated around your strongest theses (recurring ideas the system has identified), not random topics. |
| **Distribution OS** | A strategic layer for growing your public image: narrative pillars, community profiles, target accounts, proof assets, and conversation opportunities. |

---

## 🧭 Platform Navigation

The app has a **persistent navigation bar** (top on desktop, bottom on mobile) with six main sections:

| Icon | Page | Purpose |
|---|---|---|
| ✏️ | **Capture** | Drop raw ideas, ingest URLs, discover live topics, train creator voices |
| 🗄️ | **Vault** | Browse and manage everything you've ever captured |
| 🧠 | **Mind Model** | Review and curate what the system has learned about you |
| 🚀 | **Build** | Dedicated workspace for build-in-public content |
| 📈 | **Distribution** | Strategic growth engine: company image, narrative pillars, communities, and outcomes |
| 📋 | **Review** | Approve, reject, edit, and publish generated drafts |

---

## 📄 Page-by-Page Guide

### 1. Capture (Home Page) `/`

The front door of the app. Everything starts here.

#### Drop an Idea / Drop a Project Log

Switch between two capture modes using the tab toggle at the top:

- **Drop an Idea** — For quick, raw thoughts on startups, systems, incentives, leverage, distribution, or anything you're noticing.
- **Drop a Project Log** — For architecture lessons, debugging patterns, build notes, or anything you learned while building.

**How to use it:**
1. Type or paste your thought into the large text area.
2. Click **Save Idea**.
3. The system will:
   - Embed the text as a 3072-dimensional vector via `gemini-embedding-001`.
   - Classify the signal type (e.g., belief, observation, question).
   - Propose **Fresh Inferences** — suggested mind-model entries based on your input.
   - Optionally trigger a **Contextual Follow-Up** reflection question to sharpen its understanding.

> 💡 **Tip**: Output quality starts improving noticeably around 30-50 sharp ideas. The more you feed the vault, the better the generation becomes.

#### URL Ingester

Located on the right side of the Capture page. Paste any URL and click **Fetch & Save**.

**What happens:**
1. The system scrapes the page content using Cheerio.
2. Cleans and extracts the meaningful text.
3. Embeds it as a vector and saves it to the vault with the source URL and page title as metadata.

**Use this for**: Blog posts, documentation, articles, essays — anything you want the system to "know about" when generating drafts.

#### Train New Voice (Persona Vault)

Also on the Capture page. This is how you clone a creator's writing voice.

**How to use it:**
1. Enter the creator's handle (e.g., `@naval`, `@balajis`, `@sama`).
2. Paste 3-5 of their best "golden tweets" — the tweets that most represent their style.
3. Click **Analyze & Save Voice**.
4. Gemini extracts a **Voice Framework** covering sentence structure, tone, formatting quirks, and stylistic patterns.
5. The most recently saved voice becomes the _optional reference_ during draft generation.

**What you'll see:** The extracted Voice Framework appears below the form after analysis.

#### Live Topics (Discovery)

A panel that pulls real-time trending topics from the internet and X (Twitter), giving you things to react to publicly.

**How to use it:**
1. **Filter by Country** (Worldwide, US, India, etc.), **Topic** (General, Tech, Business, etc.), and **Source** (All, News, X Trends).
2. The system auto-loads topics on page load, or click **Refresh Topics** manually.
3. Each topic card shows:
   - Kind (News or X Trend)
   - Title and summary
   - A **Prompt Hint** — a suggested angle for your tweet
   - **Postability Score** and **Build Relevance Score** (0-100%)
   - **Recommended Archetype** (e.g., contrarian take, pattern recognition)
4. Two actions per topic:
   - **Use as Event** — Copies the topic into the Manual Event POV form below.
   - **Start Reflection** — Instantly creates an event reflection and triggers a follow-up question about your take.

#### Manual Event POV Capture

When something happens in the world and you want the system to learn your perspective:

1. Enter a **Headline**, optional **Source URL**, and a **Summary / excerpt**.
2. Click **Capture Event**.
3. The system creates a neutral summary, then asks you a **Recent Event Reflection** question: _"What do you actually think about this?"_
4. Your answer is extracted into a **derived thesis** and stored as a mind-model entry.

**Why this matters:** Current events become usable in generation _only_ after they are filtered through your own take. The system never copies news language directly.

#### Co-Thinker (Brainstorm)

At the bottom of the Capture page. Click **Brainstorm** and the system will:
1. Analyze your vault for patterns and gaps.
2. Generate a set of **expansion suggestions** — adjacent territory your vault doesn't yet cover.
3. Click **Add to Vault** on any suggestion to save it as a new idea.

> This is an _inspiration engine_, not the identity-learning layer. It helps you think broader, not deeper.

#### Contextual Follow-Up Reflections

After saving ideas or events, the system may present a follow-up question card at the top of the page:

- **Contextual Follow-Up** — Appears after saving an idea. One sharp answer turns a raw note into a clearer model of how you think.
- **Recent Event Reflection** — Appears after capturing an event. Teaches the system your point of view.

You can **Save Interpretation / Save POV** or **Skip** each reflection.

---

### 2. Knowledge Vault `/vault`

A browsable gallery of everything in your knowledge base.

**What you see:**
- Cards arranged in a 2-column grid (1-column on mobile).
- Each card shows:
  - **Type badge**: Idea (blue), Project Log (amber), or Web Source (indigo).
  - The content text (capped at 8 visible lines).
  - For web sources: the page title and a clickable source domain link.
  - Creation date.
  - A **delete button** (hover to reveal) for removing items.

**How to use it:**
- Browse your historical captures.
- Delete outdated or irrelevant entries to keep the vault clean.
- If empty, a prompt links you back to the Capture page.

---

### 3. Mind Model `/profile`

The brain of the system. This page is where the AI's understanding of _you_ is displayed, curated, and refined.

#### Bootstrap Voice (Profile Section)

Three text fields that seed generation early, before the system has learned enough from your behavior:

| Field | What to Write |
|---|---|
| **Desired Public Perception** | How do you want thoughtful peers to describe you? E.g., _"A sharp systems thinker who notices second-order effects and writes with conviction."_ |
| **Target Audience** | Who are you really writing for? E.g., _"Technical founders, operators, and builders who care about leverage, incentives, and systems."_ |
| **Tone Guardrails** | What should the system avoid? E.g., _"No performative hooks. No fake certainty. No shallow productivity framing."_ |

Click **Save Bootstrap Profile** to persist. Over time, the confirmed mind model entries take precedence over these bootstrap fields.

#### Mind Model Entries

The system passively builds a structured model of your worldview. Entries are organized into categories:

| Category | What It Captures |
|---|---|
| **Suggested Inferences Awaiting Confirmation** | AI guesses from your notes, reflections, edits, and event takes. You can **edit → confirm** or **reject** them. |
| **Confirmed Beliefs** | Your strongest worldview statements the generator should trust. |
| **Recurring Lenses** | How you habitually interpret things: incentives, systems, leverage, timing, power, culture. |
| **Current Obsessions** | What you're actively thinking about — gets extra weight during generation. |
| **Taste and Anti-Taste** | What feels right _and_ what instantly feels fake. |
| **Voice Rules** | High-priority constraints learned from your feedback. |
| **Open Questions** | Unresolved tensions worth revisiting. |
| **Recent Event POVs** | Current event opinions translated into your own take. |

**How to manage entries:**
- **Confirm**: Promotes the entry to a trusted belief/lens/rule.
- **Reject**: Removes the suggestion (the system learns from rejections too).
- **Edit → Confirm**: Refine the statement first, then confirm.
- **Archive**: Moves a confirmed entry out of active use.

#### Understand Me (Broad Reflection)

Occasionally, the system presents a broader interview question here — not tied to a specific note, but aimed at building a deeper worldview model of you.

#### Performance Metrics

Four key metrics displayed at the top:

| Metric | What It Tells You |
|---|---|
| **Suggestion Confirmed** | What % of AI-suggested entries you end up confirming. |
| **Draft Approval Rate** | What % of generated drafts you approve vs. reject. |
| **Average Edit Intensity** | How heavily you edit approved drafts before publishing. |
| **Confirmed Entries** | Total number of confirmed mind-model entries. |

#### Top Rejection Reasons

Shows the most common feedback tags you've used when rejecting drafts (e.g., "Too generic", "Wrong voice", "Forced hook").

#### The Mirror (Persona Analysis)

Click **Analyze My Public Persona** and Gemini reads all your approved and published drafts, then gives you a written analysis of the public persona you are _actually_ projecting — not what you _want_ to project, but what your output says about you. Think of it as a psychological mirror.

#### Recent Event Reflections

Displays the underlying event records feeding your Recent Event POV entries — the headline, summary, your take, and the derived thesis.

---

### 4. Build in Public Workspace `/startup`

A dedicated space for building-in-public content. Completely separate from your general idea vault so the build generator only reasons over what you're _actually building_.

#### Build Profile

Fill in your product/startup context:

| Field | Example |
|---|---|
| **Product/Startup Name** | Idea Engine |
| **One-liner** | A capture-to-content pipeline for founders |
| **Target Customer** | Technical founders building in public |
| **Painful Problem** | Spending hours writing tweets instead of building |
| **Transformation** | Turn raw build notes into authentic public posts |
| **Positioning** | Not a scheduler, not a ghostwriter — a thinking partner |
| **Proof Points** | "Ships 3 drafts per build session" |
| **Objections** | "Isn't this just ChatGPT with extra steps?" |
| **Language Guardrails** | Avoid buzzwords, keep it builder-native |

Click **Save Profile** to persist.

#### Build Memory

The build equivalent of the vault — but focused on your product story.

1. Select a **memory kind**: Product Insight, Project Log, Customer Pain, Shipping Note, Objection, User Language, or GTM Thought.
2. Type or paste the content.
3. Click **Save Build Memory**.
4. The system will:
   - Save the entry.
   - Suggest **communication focus** and **suggested talking points**.
   - Optionally trigger a **Build Follow-Up** reflection question.

#### Generate Build Draft

Click **Generate Build Draft** (in the Build Memory section) to generate a build-in-public tweet grounded in your build memory and filtered through your mind model.

#### Recent Build Drafts & Build Memory Log

- **Recent Build Drafts**: Shows the last 4 generated build drafts with their status and content.
- **Build Memory Log**: Shows all saved build memories with their kind, communication focus, and suggested points.

> **How it differs from general generation:** Build drafts only pull from build memory and the startup profile. Your general vault ideas don't leak in, but your shared mind model (worldview and taste filter) still applies, so posts sound like _you_.

---

### 5. Distribution OS `/distribution`

The strategic growth layer. This is not about writing tweets — it's about building a _company image_ and _qualified reach_.

#### Company Image Profile

Define how your company/brand should be perceived:

| Field | Purpose |
|---|---|
| **Company Name** | The brand identity |
| **Known For** | What reputation to build |
| **Who It Helps** | Target audience |
| **Painful Problem** | The core pain you solve |
| **Proof Points** | Evidence and traction |
| **Objection Patterns** | Common pushback to address |
| **Positioning Statements** | How to position vs. alternatives |
| **Bio Direction** | Profile bio strategy |
| **Header Concept** | Visual identity direction |
| **Pinned Post Strategy** | What to pin and why |
| **Link Intent** | CTA / link strategy |

#### Narrative Pillars

Every draft should ladder up to one of these. Add pillars with a label, description, and priority (1-3).

**Example pillars:**
- "Builder credibility" — showing real technical progress
- "Problem awareness" — educating on the pain point
- "Social proof" — sharing wins, metrics, customer feedback

#### Target Accounts

Track accounts that matter for qualified reach in your niche. Add their handle, reason they matter, priority, and monitoring notes.

#### Community Profiles

Teach the system how to sound native inside focused communities (e.g., Techstars, indie hackers, startup operators). Each community profile includes:

- Audience focus (Builders / Customers / Mixed)
- Tone rules specific to that community
- Common topics
- Preferred post shapes
- Taboo patterns (what feels cringe there)
- Why you belong

**Generate Community Post**: Click on any community profile to generate a draft tailored specifically to that community's norms.

#### Conversation Opportunities

Import threads and conversations worth jumping into:

1. Paste a **source URL** or raw **conversation text**.
2. Optionally associate it with a **community profile**.
3. Click **Import Conversations**.
4. The system analyzes the conversation and surfaces opportunities with recommended actions.
5. Generate a **Reply** or **Quote Post** draft for any opportunity.

#### Proof Library

Give the system evidence so it stops sounding abstract:

| Proof Kind | Examples |
|---|---|
| **Screenshot** | UI screenshot, dashboard view |
| **Demo** | Video or GIF demo |
| **Metric** | "3x faster processing time" |
| **Customer Quote** | Direct testimonial |
| **Product Change** | New feature, improvement |

Each proof asset has a **strength rating** (1-5). Higher-strength assets get prioritized in generation.

#### Distribution Outcomes

After publishing a tweet, log its performance:
- Impressions, likes, replies, reposts, bookmarks
- Profile visits, follows gained, link clicks
- Freeform notes

The summary dashboard at the top shows aggregate impressions, profile visits, and follows gained.

---

### 6. Review Dashboard `/review`

Where all generated drafts land for human decision-making.

#### Pending Queue

Drafts waiting for your decision. Switch between **General** and **Build** modes to see the corresponding draft pools.

**For each pending draft you can see:**
- **Generation mode** (General / Build) and **draft kind** (Original Post / Reply / Quote Post)
- Community label, pillar label, and post archetype tags
- The draft text (editable inline)
- **"Why This Fits"** rationale — the system's reasoning
- **Candidate Theses** — which of your theses the draft is built around
- **Alternates** — alternative drafts you can swap in with "Use This"
- **Media Suggestion** — recommended media type, reason, asset brief, and search query

**Draft kind filter:** Filter the pending queue by All Drafts, Original Posts, Replies, or Quote Posts.

**Feedback system (before deciding):**
1. Tag what felt off or right using predefined taste tags (e.g., "Too generic", "Wrong voice", "Nailed the framing").
2. Optionally add a freeform note explaining what you would really say instead.

**Actions:**
- **✗ Reject** — The draft is logged as a negative taste signal. The system learns from every rejection.
- **✓ Approve** — The draft is approved and the system learns from it.

After each decision, the system may present a **Review Follow-Up** reflection to dig into _why_ a draft was close, off, or not really yours.

#### History

All past decisions (approved, rejected, opened in X, published). Filterable by All / General / Build and by draft kind.

**For published drafts:**
- **Open in X** — Opens a Twitter compose window pre-filled with the draft text.
- **Mark as Published** — Logs the post as published and saves it as a distribution outcome.

#### Generate on Demand

Click **Generate General Draft** or **Generate Build Draft** to trigger a new generation cycle. The system:
1. Picks or synthesizes a thesis from your vault
2. Runs a vector similarity search for related context
3. Combines the context, your mind model, and optional creator voice
4. Produces a thesis-ranked draft set with rationale and alternates

#### Auto-Generation

The app includes a **background heartbeat** that checks in every ~4.5 hours while active. If conditions are met, it automatically generates new drafts and refreshes the queue. You'll see new drafts appear without manual action.

---

## ⚡ Auto-Generation

The `AutoGenerationHeartbeat` component runs silently in the background:

- Fires immediately on app load, then every 4.5 hours.
- Calls the `/api/autogen` endpoint which evaluates whether fresh drafts are needed.
- If new drafts are generated, a `autogen:completed` event fires and the Review and Build pages auto-refresh.
- This is silent by design — no UI, no interruptions.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, React 19) |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL + `pgvector` for vector similarity search) |
| **AI — Generation & Analysis** | Gemini 3 Pro (Preview) |
| **AI — Embeddings** | `gemini-embedding-001` (3072 dimensions) |
| **Styling** | Tailwind CSS 4 |
| **Web Scraping** | [Cheerio](https://cheerio.js.org/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Language** | TypeScript |

---

## ⚙️ Setup & Installation

### Prerequisites

- **Node.js** 18+ installed
- A **Supabase** project (free tier works)
- A **Google AI Studio API key** (for Gemini models)

### Steps

1. **Clone the repo** and install dependencies:
   ```bash
   git clone <repo-url>
   cd idea-engine
   npm install
   ```

2. **Initialize the database**:
   - Go to your Supabase project's SQL Editor.
   - Run the contents of `supabase_schema.sql` to create all tables, RPC functions, and RLS policies.
   - **Important**: Ensure the `embedding` column is set to `vector(3072)` to match the Gemini embedding model's output dimensions.

3. **Configure environment variables**:
   Create a `.env.local` file in the project root:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   GOOGLE_API_KEY=your-google-ai-studio-api-key
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

### Running Tests

```bash
npm test
```

Tests use Node's built-in test runner with TypeScript support.

---

## 📝 Database Notes

- The repository maintains a single source-of-truth schema in `supabase_schema.sql`.
- This file includes all table definitions, the `match_ideas` RPC for vector similarity search, and all necessary RLS (Row-Level Security) policies.
- The `pgvector` extension must be enabled in your Supabase project for embedding storage and similarity queries to work.
- Key tables: `raw_ideas`, `generated_tweets`, `profiles`, `personas`, `mind_model_entries`, `reflection_turns`, `event_reflections`, `startup_profiles`, `startup_memory_entries`, `company_image_profiles`, `narrative_pillars`, `proof_assets`, `target_accounts`, `community_profiles`, `conversation_opportunities`, `distribution_outcomes`.

---

## 🔗 How It All Connects

```
                    ┌───────────────┐
                    │   CAPTURE     │
                    │  Raw ideas    │
                    │  URLs         │──────► VAULT (vector DB)
                    │  Project logs │               │
                    │  Events       │               ▼
                    └───────┬───────┘      Vector Similarity
                            │              Search (3072-dim)
                            ▼                      │
                    ┌───────────────┐               │
                    │  MIND MODEL   │◄──────────────┘
                    │  Beliefs      │
                    │  Lenses       │◄── Reflection Loop
                    │  Taste rules  │◄── Draft feedback
                    │  Voice rules  │◄── Event POVs
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────────┐
     │  GENERAL     │ │  BUILD   │ │ DISTRIBUTION │
     │  GENERATION  │ │  DRAFTS  │ │  DRAFTS      │
     │  (thesis-    │ │  (build  │ │  (community, │
     │   ranked)    │ │  memory) │ │   reply,     │
     └──────┬───────┘ └────┬─────┘ │   quote)     │
            │              │       └──────┬───────┘
            └──────────────┼──────────────┘
                           ▼
                    ┌───────────────┐
                    │    REVIEW     │
                    │  Approve      │──► Open in X / Publish
                    │  Reject       │──► Taste signal learned
                    │  Edit         │──► Edit intensity tracked
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  OUTCOMES     │
                    │  Performance  │──► Back into Mind Model
                    │  tracking     │    & Distribution strategy
                    └───────────────┘
```

**The feedback loop is everything.** The more you use the system — dropping ideas, answering reflections, approving and rejecting drafts, logging outcomes — the sharper the output becomes. It's not a tool you configure once; it's a tool that _grows with you_.
