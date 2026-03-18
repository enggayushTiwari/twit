# Idea Engine

Idea Engine is a personal capture-to-content system. You feed it raw ideas, project notes, and scraped URLs, define the public persona you want to project, and the app generates short-form drafts for review.

## Product Loop

1. Capture an idea or project log.
2. Expand the vault by scraping a URL.
3. Define your own voice in the profile page.
4. Optionally train on a creator voice from example tweets.
5. Generate draft tweets from related vault context.
6. Review, approve, reject, and open drafts in X.
7. Analyze your approved or opened drafts in the Mirror.

## Core Features

- Vault-backed idea capture with embeddings stored in Supabase.
- URL ingestion that scrapes readable text into the same vault.
- Persona settings for desired perception, audience, and tone guardrails.
- Optional creator voice references based on saved voice frameworks.
- Draft generation using Gemini plus vector similarity search.
- Review queue for approve/reject/open-in-X decisions.
- Persona analysis over approved or opened drafts.

## Tech Stack

- Next.js 16 App Router
- React 19 and TypeScript
- Supabase with `pgvector`
- Google GenAI / Gemini
- Tailwind CSS 4

## Database

Use `supabase_schema_canonical.sql` as the only Supabase setup script. The older conflicting migration fragments have been removed so the repo has a single database source of truth.

## Notes

- The app now treats opening the X composer as a manual handoff, not a confirmed publish.
- The latest saved creator persona is used as an optional voice reference during generation.
