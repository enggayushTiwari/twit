# Idea Engine

Idea Engine is a **capture-to-content pipeline** that transforms raw thoughts, project notes, and web research into high-quality social media drafts. It leverages vector similarity search and large language models (Gemini) to ensure every draft is grounded in your personal knowledge base while adhering to your unique voice.

## 🚀 End-to-End Workflow

Idea Engine operates in a four-stage loop:

### 1. Capture (The Vault)
The "Vault" is your personal knowledge base. You can ingest two types of data:
- **Raw Ideas**: Quick text snippets or project logs.
- **Web Research**: Provide a URL, and the system scrapes the content, cleans it, and saves it.
- **Fresh Inferences**: Upon capture, the system immediately generates "Fresh Inferences"—AI thoughts that expand on your idea or find adjacent concepts.
- *How it works technicaly*: Entries are converted into high-dimensional vectors (3072 dimensions) using `gemini-embedding-001` and stored in Supabase with `pgvector`.

### 2. Persona Engineering
Before generating, you define the "who" and "how":
- **User Profile**: Set your desired perception, target audience, and tone guardrails in the Mind Model.
- **Creator Personas**: "Clone" a specific creator's voice by providing their X handle and golden tweets. Gemini extracts a **Voice Framework** covering sentence structure, tone, and formatting quirks.

### 3. Generation Engine
The core of the app. It:
1.  Picks or receives a raw idea.
2.  Performs a **Vector Similarity Search** (3072-dim) to find related context in your Vault.
3.  Combines the context, your profile, and the optional creator voice.
4.  Generates drafts using **Gemini 3.1 Pro (Preview)**.

### 4. Review & Mirror
- **Review Queue**: Approve, reject, or edit drafts.
- **The Mirror**: A psychological profiler that analyzes your approved/published output to show you the persona you are *actually* projecting to the world.

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + `pgvector`)
- **AI Models**: 
    - **Generation & Analysis**: Gemini 3.1 Pro (Preview)
    - **Embeddings**: gemini-embedding-001 (**3072 Dimensions**)
- **Styling**: Vanilla CSS / Tailwind CSS 4
- **Scraping**: Cheerio

---

## ⚙️ Setup

1.  **Clone the repo** and install dependencies:
    ```bash
    npm install
    ```
2.  **Supabase Setup**:
    - Use `supabase_schema_canonical.sql` to initialize your database. 
    - **Note**: Ensure the `embedding` column is set to `vector(3072)` to match the latest Gemini embedding model.
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

The repository maintains a single source of truth for the database schema in `supabase_schema_canonical.sql`. It includes the `match_ideas` RPC for vector similarity search.

