import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// Prevent Next.js from prerendering this route statically at build time
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        console.log('\n====== GENERATION ENGINE START ======');

        // Initialize connections
        const ai = new GoogleGenAI({
            apiKey: process.env.GOOGLE_API_KEY,
        });

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
        const supabase = createClient(supabaseUrl, supabaseKey);
        console.log('[1/7] Initialized Gemini + Supabase clients.');

        // Fetch User Profile
        const { data: profile, error: profileError } = await supabase
            .from('user_profile')
            .select('*')
            .limit(1)
            .single();

        if (profileError) {
            console.error('[1.5/7] WARNING: Failed to fetch profile:', profileError);
        } else {
            console.log('[1.5/7] Fetched user profile successfully.');
        }
        // 1. Fetch one random idea
        // For MVP: Fetch all ideas and pick one randomly in JS
        const { data: allIdeas, error: fetchIdeasError } = await supabase
            .from('raw_ideas')
            .select('content, embedding, type');

        if (fetchIdeasError || !allIdeas || allIdeas.length === 0) {
            console.error('[2/7] FAILED: No ideas found.', fetchIdeasError);
            return NextResponse.json(
                { error: 'No ideas found to generate from.' },
                { status: 400 }
            );
        }

        const randomIdea = allIdeas[Math.floor(Math.random() * allIdeas.length)];
        console.log(`[2/7] Fetched ${allIdeas.length} ideas. Selected [${randomIdea.type || 'idea'}]: "${randomIdea.content.substring(0, 80)}..."`);

        if (!randomIdea.embedding) {
            return NextResponse.json(
                { error: 'Selected idea has no embedding.' },
                { status: 500 }
            );
        }

        // 2. Find 3 highly related ideas using the match_ideas RPC
        const { data: relatedIdeas, error: matchError } = await fallbackMatchIdeas(supabase, randomIdea.embedding, 3);

        // In production, you would call your RPC function like this once you know pgvector is enabled properly:
        /*
        const { data: relatedIdeas, error: matchError } = await supabase.rpc('match_ideas', {
          query_embedding: randomIdea.embedding,
          match_threshold: 0.70, // 0 to 1, higher is stricter
          match_count: 3
        });
        */

        if (matchError) {
            console.error('[3/7] FAILED: Match ideas error:', matchError);
            return NextResponse.json(
                { error: 'Failed to find related ideas.' },
                { status: 500 }
            );
        }
        console.log(`[3/7] Found ${relatedIdeas?.length || 0} related ideas.`);

        // 3. Fetch the last 15 tweets for anti-repetition
        const { data: recentTweets, error: fetchTweetsError } = await supabase
            .from('generated_tweets')
            .select('content')
            .order('created_at', { ascending: false })
            .limit(15);

        if (fetchTweetsError) {
            console.error('[4/7] WARNING: Fetch Tweets Error:', fetchTweetsError);
        }
        console.log(`[4/7] Fetched ${recentTweets?.length || 0} recent tweets for anti-repetition.`);

        // 4. Build Context for Gemini
        const contextIdeas = relatedIdeas?.map((item: any) => item.content).join('\n---\n') || randomIdea.content;
        const pastTweets = recentTweets?.map((t: any) => t.content).join('\n') || 'None';

        const basePrompt = `You are an expert ghostwriter and brand architect for the user. 
Your goal is to help them build their specific brand image. 
Their desired public perception is: ${profile?.desired_perception || 'Thoughtful and professional'}. 
They are writing specifically for this audience: ${profile?.target_audience || 'A general professional audience'}. 
You must strictly obey these tone guardrails: ${profile?.tone_guardrails || 'Clear, concise, and engaging'}. `;

        let instructionPrompt = '';

        if (randomIdea.type === 'project_log') {
            instructionPrompt = `The provided context is a raw technical log or project dump from the user. Extract a hard-earned lesson, a "build-in-public" update, or an architectural insight from this dump. Show, don't just tell, that the user is actively building complex systems. Keep it under 280 characters and obey the tone guardrails.`;
        } else {
            instructionPrompt = `Filter the provided raw ideas through this architecture to write a single, sharp tweet.
Keep it under 280 characters. Do not sound like an AI.
DO NOT use emojis, hashtags, or words like "delve", "crucial", or "landscape".`;
        }

        const systemPrompt = `${basePrompt}
${instructionPrompt}

Knowledge Context (Base your tweet loosely on these core ideas):
${contextIdeas}

Do Not Repeat Context (Ensure your tweet sounds distinct from these recent thoughts):
${pastTweets}`;

        // 5. Call Gemini to generate the tweet
        console.log('[5/7] Calling Gemini 2.5 Flash...');
        const completionResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Generate the tweet now.',
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.8,
            }
        });

        const generatedTweet = completionResponse.text || '';
        console.log(`[5/7] Gemini response: "${generatedTweet}"`);

        if (!generatedTweet) {
            console.error('[5/7] FAILED: Gemini returned empty response.');
            return NextResponse.json(
                { error: 'Failed to generate tweet content.' },
                { status: 500 }
            );
        }

        // 6. Insert the new tweet into generated_tweets
        console.log('[6/7] Saving tweet to Supabase...');
        const { data: insertedTweet, error: insertError } = await supabase
            .from('generated_tweets')
            .insert([
                { content: generatedTweet, status: 'PENDING' }
            ])
            .select()
            .single();

        if (insertError) {
            console.error('[6/7] FAILED: Insert Tweet Error:', insertError);
            return NextResponse.json(
                { error: 'Failed to save the generated tweet.' },
                { status: 500 }
            );
        }

        // 7. Return success
        console.log(`[7/7] ✅ SUCCESS! Tweet saved with id: ${insertedTweet.id}`);
        console.log('====== GENERATION ENGINE COMPLETE ======\n');
        return NextResponse.json({ success: true, tweet: insertedTweet });

    } catch (err: any) {
        console.error('Generation API Error:', err);
        return NextResponse.json(
            { error: err.message || 'An unexpected error occurred.' },
            { status: 500 }
        );
    }
}

// Fallback manual cosine similarity for the MVP in case pgvector gives users trouble early on
async function fallbackMatchIdeas(supabase: any, queryEmbedding: number[], limit: number) {
    const { data: allIdeas, error } = await supabase.from('raw_ideas').select('id, content, embedding');
    if (error) return { data: null, error };
    if (!allIdeas) return { data: [], error: null };

    const scoredIdeas = allIdeas
        .filter((idea: any) => idea.embedding)
        .map((idea: any) => {
            const embeddingArray = JSON.parse(idea.embedding) as number[]; // Ensure it's a JS array
            const similarity = cosineSimilarity(queryEmbedding, embeddingArray);
            return { ...idea, similarity };
        })
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, limit);

    return { data: scoredIdeas, error: null };
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
