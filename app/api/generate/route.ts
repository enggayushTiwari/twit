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
            .in('status', ['APPROVED', 'PUBLISHED', 'PENDING'])
            .order('created_at', { ascending: false })
            .limit(20);

        if (fetchTweetsError) {
            console.error('[4/7] WARNING: Fetch Tweets Error:', fetchTweetsError);
        }
        console.log(`[4/7] Fetched ${recentTweets?.length || 0} approved/published tweets for anti-repetition.`);

        // 4. Build Context for Gemini with XML Structure
        const contextIdeas = relatedIdeas?.map((item: any) => item.content).join('\n---\n') || randomIdea.content;
        const pastTweets = recentTweets?.map((t: any) => t.content).join('\n') || 'None';

        const systemPrompt = `You are a world-class Critical Thinker and Brand Strategist.
Your MISSION: Analyze the provided source material, extract the core philosophical or technical thesis, and craft a single, high-performance tweet that offers a fresh, original perspective.

<persona_guardrails>
- DESIRED PUBLIC PERCEPTION: ${profile?.desired_perception || 'Thoughtful, technical, and forward-thinking'}
- TARGET AUDIENCE: ${profile?.target_audience || 'Founders, engineers, and product builders'}
- TONE: Professional, sharp, and insight-dense. Avoid marketing fluff.
- STYLE: Minimalist. High signal-to-noise ratio. No "AI-isms".
- NEGATIVE CONSTRAINTS: 
    - NEVER use "delve", "crucial", "landscape", "tapestry", or "harness".
    - NEVER use space-related metaphors.
    - DO NOT mention "Mars", "galaxies", "planets", "stars", or "the universe".
    - No hashtags and no emojis.
</persona_guardrails>

<recent_content_history_DO_NOT_REPEAT>
${pastTweets}
</recent_content_history_DO_NOT_REPEAT>

<source_material>
Type: ${randomIdea.type || 'standard idea'}
Core Context:
${contextIdeas}
</source_material>

CRITICAL INSTRUCTIONS:
1. ANALYSIS FIRST: Identify the primary insight in the <source_material>. Do not just rephrase it; synthesize it.
2. ZERO MODE COLLAPSE: You must NEVER reuse the exact phrasing, hook, or ending from the <recent_content_history_DO_NOT_REPEAT>. If your drafted tweet looks similar to history, delete it and start over.
3. ORIGINALITY: Focus on systems, startups, and distribution. If the idea is philosophical, apply it to modern building or engineering.
4. BREVITY: Absolute maximum of 280 characters. If it exceeds this limit, it is a failure. Be punchy.`;

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

    } catch (err: any) {
        console.error('Generation API Error:', err);
        return NextResponse.json(
            { error: err.message || 'An unexpected error occurred.' },
            { status: 500 }
        );
    }
}

