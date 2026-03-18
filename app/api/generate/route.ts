import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { buildGenerationSystemPrompt } from '@/utils/generation';
import { getErrorMessage } from '@/utils/errors';

// Prevent Next.js from prerendering this route statically at build time
export const dynamic = 'force-dynamic';

type IdeaMatch = {
    content: string;
};

type TweetContentRow = {
    content: string;
};

export async function POST() {
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

        const { data: creatorPersona, error: creatorPersonaError } = await supabase
            .from('creator_personas')
            .select('handle, ai_voice_profile')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (creatorPersonaError) {
            console.error('[1.75/7] WARNING: Failed to fetch creator persona:', creatorPersonaError);
        } else if (creatorPersona) {
            console.log(`[1.75/7] Using latest creator voice reference from @${creatorPersona.handle}.`);
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
        const { data: relatedIdeas, error: matchError } = await supabase.rpc('match_ideas', {
            query_embedding: randomIdea.embedding,
            match_threshold: 0.1,
            match_count: 3
        });

        if (matchError) {
            console.error('[3/7] FAILED: Match ideas error:', matchError);
            return NextResponse.json(
                { error: 'Failed to find related ideas via RPC.' },
                { status: 500 }
            );
        }
        console.log(`[3/7] Found ${relatedIdeas?.length || 0} related ideas via Supabase RPC.`);

        // 3. Fetch the last 20 tweets (including PENDING) for anti-repetition
        const { data: recentTweets, error: fetchTweetsError } = await supabase
            .from('generated_tweets')
            .select('content')
            .in('status', ['APPROVED', 'OPENED_IN_X', 'PUBLISHED', 'PENDING'])
            .order('created_at', { ascending: false })
            .limit(20);

        if (fetchTweetsError) {
            console.error('[4/7] WARNING: Fetch Tweets Error:', fetchTweetsError);
        }
        console.log(`[4/7] Fetched ${recentTweets?.length || 0} recent drafts for anti-repetition.`);

        // 4. Build Context for Gemini with XML Structure
        const contextIdeas = (relatedIdeas as IdeaMatch[] | null)?.map((item) => item.content).join('\n---\n') || randomIdea.content;
        const pastTweets = (recentTweets as TweetContentRow[] | null)?.map((tweet) => tweet.content).join('\n') || 'None';

        const systemPrompt = buildGenerationSystemPrompt({
            profile,
            creatorPersona,
            sourceType: randomIdea.type,
            contextIdeas,
            pastTweets,
        });

        // 5. Call Gemini to generate the tweet
        console.log('[5/7] Calling Gemini 3.1 Pro with structured prompt...');
        const completionResponse = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: 'Proceed with generation based on the provided instructions.',
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

    } catch (err: unknown) {
        console.error('Generation API Error:', err);
        return NextResponse.json(
            { error: getErrorMessage(err, 'An unexpected error occurred.') },
            { status: 500 }
        );
    }
}

