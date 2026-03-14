'use server';

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// Initialize Google GenAI
const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
});

// Initialize Supabase with Service Role Key for server-side insertion
// Note: If you only have the Anon key handy, you can use it here, but 
// Service Role is recommended for bypassing RLS if needed from the server.
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function saveIdeaWithEmbedding(content: string, type: 'idea' | 'project_log' = 'idea') {
    if (!content || !content.trim()) {
        return { success: false, error: 'Content cannot be empty.' };
    }

    const ideaText = content.trim();

    try {
        // 1. Generate Embedding using Google Gen AI
        const embeddingResponse = await ai.models.embedContent({
            model: 'gemini-embedding-001',
            contents: ideaText,
        });

        let embedding = embeddingResponse.embeddings?.[0]?.values;

        if (!embedding) {
            throw new Error('Failed to generate embedding');
        }

        // Adjust embedding to exactly 1536 dimensions to match the Supabase schema
        if (embedding.length > 1536) {
            embedding = embedding.slice(0, 1536);
        } else if (embedding.length < 1536) {
            const padded = new Array(1536).fill(0);
            for (let i = 0; i < embedding.length; i++) {
                padded[i] = embedding[i];
            }
            embedding = padded;
        }

        // 2. Insert into Supabase
        const { error: insertError } = await supabase
            .from('raw_ideas')
            .insert([
                {
                    content: ideaText,
                    embedding: embedding,
                    type: type
                }
            ]);

        if (insertError) {
            console.error('Supabase Error:', insertError);
            return { success: false, error: 'Failed to insert idea into database.' };
        }

        return { success: true };

    } catch (err: any) {
        console.error('Action Error:', err);
        return {
            success: false,
            error: err.message || 'An unexpected error occurred while saving.'
        };
    }
}

export async function getPendingTweets() {
    try {
        const { data: tweets, error } = await supabase
            .from('generated_tweets')
            .select('id, content, status, created_at')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch Pending Tweets Error:', error);
            return { success: false, error: 'Failed to fetch pending tweets.', data: null };
        }

        return { success: true, data: tweets, error: null };
    } catch (err: any) {
        console.error('Get Pending Tweets Action Error:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.', data: null };
    }
}

export async function updateTweetStatus(id: string, newContent: string, newStatus: string) {
    try {
        const { error } = await supabase
            .from('generated_tweets')
            .update({ content: newContent, status: newStatus })
            .eq('id', id);

        if (error) {
            console.error('Update Tweet Error:', error);
            return { success: false, error: 'Failed to update tweet status.' };
        }

        return { success: true };
    } catch (err: any) {
        console.error('Update Tweet Action Error:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.' };
    }
}

export async function getAllIdeas() {
    try {
        const { data: ideas, error } = await supabase
            .from('raw_ideas')
            .select('id, content, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch Ideas Error:', error);
            return { success: false, error: 'Failed to fetch ideas.', data: null };
        }

        return { success: true, data: ideas, error: null };
    } catch (err: any) {
        console.error('Get All Ideas Action Error:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.', data: null };
    }
}

export async function getTweetHistory() {
    try {
        const { data: tweets, error } = await supabase
            .from('generated_tweets')
            .select('id, content, status, created_at')
            .neq('status', 'PENDING')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch Tweet History Error:', error);
            return { success: false, error: 'Failed to fetch tweet history.', data: null };
        }

        return { success: true, data: tweets, error: null };
    } catch (err: any) {
        console.error('Get Tweet History Action Error:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.', data: null };
    }
}

export async function analyzePersona() {
    try {
        const { data: tweets, error: tweetsError } = await supabase
            .from('generated_tweets')
            .select('content')
            .eq('status', 'APPROVED');

        if (tweetsError) {
            console.error('Fetch Approved Tweets Error:', tweetsError);
            return { success: false, error: 'Failed to fetch approved tweets.', data: null };
        }

        if (!tweets || tweets.length < 3) {
            return { success: false, error: 'Not enough data to analyze persona. Approve more tweets first.', data: null };
        }

        const tweetContents = tweets.map((t) => t.content).join('\n---\n');

        const systemPrompt = `You are an expert psychological profiler and brand analyst. Read the provided tweets authored by the user. What public persona is this person projecting? Provide a brutal, objective, and highly analytical breakdown of their tone, perceived biases, and how the public likely views them. Do not flatter them. Format the response in 3-4 short, punchy paragraphs.`;

        const completionResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Here are the tweets:\n${tweetContents}`,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
            }
        });

        const analysis = completionResponse.text || '';

        if (!analysis) {
            return { success: false, error: 'Failed to generate persona analysis.', data: null };
        }

        return { success: true, data: analysis, error: null };
    } catch (err: any) {
        console.error('Analyze Persona Action Error:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.', data: null };
    }
}

export async function getProfile() {
    try {
        const { data: profile, error } = await supabase
            .from('user_profile')
            .select('id, desired_perception, target_audience, tone_guardrails, updated_at')
            .limit(1)
            .single();

        if (error) {
            console.error('Fetch Profile Error:', error);
            return { success: false, error: 'Failed to fetch profile.', data: null };
        }

        return { success: true, data: profile, error: null };
    } catch (err: any) {
        console.error('Get Profile Action Error:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.', data: null };
    }
}

export async function updateProfile(data: {
    id?: string;
    desired_perception: string;
    target_audience: string;
    tone_guardrails: string;
}) {
    try {
        // If we have an id, update. Otherwise, upsert.
        if (data.id) {
            const { error } = await supabase
                .from('user_profile')
                .update({
                    desired_perception: data.desired_perception,
                    target_audience: data.target_audience,
                    tone_guardrails: data.tone_guardrails,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', data.id);

            if (error) {
                console.error('Update Profile Error:', error);
                return { success: false, error: 'Failed to update profile.' };
            }
        } else {
            const { error } = await supabase
                .from('user_profile')
                .insert([{
                    desired_perception: data.desired_perception,
                    target_audience: data.target_audience,
                    tone_guardrails: data.tone_guardrails,
                    updated_at: new Date().toISOString(),
                }]);

            if (error) {
                console.error('Insert Profile Error:', error);
                return { success: false, error: 'Failed to create profile.' };
            }
        }

        return { success: true };
    } catch (err: any) {
        console.error('Update Profile Action Error:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.' };
    }
}

export async function getRawIdeas() {
    try {
        const { data: ideas, error } = await supabase
            .from('raw_ideas')
            .select('id, content, type, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch Raw Ideas Error:', error);
            return { success: false, error: 'Failed to fetch raw ideas.', data: null };
        }

        return { success: true, data: ideas, error: null };
    } catch (err: any) {
        console.error('Get Raw Ideas Action Error:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.', data: null };
    }
}

export async function deleteRawIdea(id: string) {
    try {
        const { error } = await supabase
            .from('raw_ideas')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete Raw Idea Error:', error);
            return { success: false, error: 'Failed to delete raw idea.' };
        }

        return { success: true };
    } catch (err: any) {
        console.error('Delete Raw Idea Action Error:', err);
        return { success: false, error: err.message || 'An unexpected error occurred.' };
    }
}
