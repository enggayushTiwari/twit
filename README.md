# Idea Engine

Idea Engine is a **capture-to-content pipeline** that transforms raw thoughts, project notes, and web research into high-quality social media drafts. It leverages vector similarity search and large language models (Gemini) to ensure every draft is grounded in your personal knowledge base while adhering to your unique voice.

## 🚀 End-to-End Workflow

Idea Engine operates in a four-stage loop:

### 1. Capture (The Vault)
The "Vault" is your personal knowledge base. You can ingest two types of data:
- **Raw Ideas**: Quick text snippets or project logs.
- **Web Research**: Provide a URL, and the system scrapes the lead text, cleans it, and saves it.
- *How it works technicaly*: Every entry is automatically converted into a vector embedding using Google GenAI and stored in Supabase with `pgvector`.

### 2. Persona Engineering
Before generating, you define the "who" and "how":
- **User Profile**: Set your desired perception (e.g., "authoritative technical leader"), target audience, and tone guardrails.
- **Creator Personas**: "Clone" a specific creator's voice by providing their X handle and a few of their best tweets. Gemini analyzes these to create a detailed **Voice Framework** (sentence structure, vocabulary, formatting quirks).

### 3. Generation Engine
The core of the app. It doesn't just "write a tweet"; it:
1.  Picks or receives a raw idea.
2.  Performs a **Vector Similarity Search** to find related context in your Vault.
3.  Combines the idea, the context, your profile, and the optional creator voice.
4.  Generates a draft using **Gemini 3.1 Pro**.

### 4. Review & Mirror
- **Review Queue**: Approve, reject, or edit drafts. Approved drafts can be one-click opened in X (Twitter).
- **The Mirror**: A psychological profiler that analyzes your *actual* output. It looks at your approved/published tweets and provides a brutal, objective breakdown of the persona you are projected to the public.

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + `pgvector`)
- **AI Models**: Google [Gemini 3.1 Pro](https://deepmind.google/technologies/gemini/) (Generation & Analysis) & Text Embedding 004.
- **Styling**: Tailwind CSS 4
- **Scraping**: Cheerio

---

## ⚙️ Setup

1.  **Clone the repo** and install dependencies:
    ```bash
    npm install
    ```
2.  **Supabase Setup**:
    - Use `supabase_schema_canonical.sql` to initialize your database. This sets up the `raw_ideas`, `generated_tweets`, `user_profile`, and `creator_personas` tables, along with the required vector match functions.
3.  **Environment Variables**:
    Create a `.env.local` file with:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your-project-url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    GOOGLE_API_KEY=your-gemini-api-key
    ```
4.  **Run Dev Server**:
    ```bash
    npm run dev
    ```

## 📝 Database Notes

The repository maintains a single source of truth for the database schema in `supabase_schema_canonical.sql`. Always refer to this file for the latest table structures and RPC functions.

