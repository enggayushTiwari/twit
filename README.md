# 🚀 Twit (Idea Engine)

**Transform your raw thoughts into viral-ready content with AI-powered contextual intelligence.**

Twit is a sophisticated "Idea Engine" designed to bridge the gap between fragmented thoughts and polished social media content. Built with **Next.js 16**, **Supabase**, and **Google Gemini**, it leverages vector similarity search to find connections between your ideas and generate high-context, engaging tweets.

---

## ✨ Key Features

- **🧠 Contextual Generation**: Uses OpenAI's GPT-4o-mini to turn raw ideas into compelling tweets.
- **🔍 Vector Similarity Search**: Powered by `pgvector` in Supabase to find related ideas and past successful tweets for better context.
- **📁 Idea Vault**: A specialized storage system for managing your raw inspirations and generated drafts.
- **📊 Profile Management**: Personalized settings to tailor the AI's "voice" to your unique style.
- **⚡ Real-time Updates**: Seamless integration with Supabase for instant data synchronization.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + `pgvector`)
- **AI Engine**: [Google Gemini 3.1 Pro](https://deepmind.google/technologies/gemini/) (via Google GenAI)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Authentication**: [Supabase Auth](https://supabase.com/auth)

---

## 🏗️ Architecture

Twit operates on a three-tier architecture:

1.  **Ingestion**: Raw ideas are stored and indexed using OpenAI embeddings.
2.  **Retrieval**: When generating content, the system performs a vector search to pull relevant context from your existing idea vault.
3.  **Synthesis**: The AI merges the new idea with historical context to produce output that is consistent with your previous work but fresh in perspective.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+
- A Supabase account
- An OpenAI API key

### 2. Installation
```bash
git clone https://github.com/enggayushTiwari/twit.git
cd twit
npm install
```

Create a `.env.local` file in the root directory and add the following:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_API_KEY=your_google_genai_key
```

### 4. Database Setup
Run the SQL migration files provided in the root directory to set up the schema:
- `supabase_schema.sql` (Base tables)
- `supabase_schema_phase2.sql` (Embeddings & Functions)
- `supabase_schema_profile.sql` (User Profiles)

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the magic.

---

## 📄 License
MIT © [Ayush Tiwari](https://github.com/enggayushTiwari)
