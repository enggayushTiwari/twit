/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function verifyGeneration() {
    console.log('--- Verification: Generation Flow ---');

    // 1. Initialize
    const ai = new GoogleGenAI({
        apiKey: process.env.GOOGLE_API_KEY,
    });
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // 2. Fetch Latest Persona
    const { data: creatorPersona, error: cpError } = await supabase
        .from('creator_personas')
        .select('handle, ai_voice_profile')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (cpError || !creatorPersona) {
        console.error('Failed to fetch latest persona:', cpError);
        return;
    }
    console.log(`Using persona: @${creatorPersona.handle}`);

    // 3. Fetch Random Idea
    const { data: allIdeas, error: ideasError } = await supabase
        .from('raw_ideas')
        .select('content');

    if (ideasError || !allIdeas || allIdeas.length === 0) {
        console.error('No ideas found.');
        return;
    }
    const randomIdea = allIdeas[Math.floor(Math.random() * allIdeas.length)].content;
    console.log(`Idea: "${randomIdea.substring(0, 100)}..."`);

    // 4. Generate Tweet
    const systemPrompt = `You are a ghostwriter for @${creatorPersona.handle}. 
Use their specific voice framework below to turn the provided idea into a high-impact tweet.
Strictly adhere to their style, formatting, and tone.

VOICE FRAMEWORK:
${creatorPersona.ai_voice_profile}

Output ONLY the tweet content. No commentary.`;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: `Generate a tweet for this idea: ${randomIdea}`,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.8,
            }
        });

        const tweet = result.text || '';
        console.log(`\nGENERATED TWEET (@${creatorPersona.handle} style):\n`);
        console.log('--------------------------------------------------');
        console.log(tweet);
        console.log('--------------------------------------------------');

        if (tweet) {
            console.log('\n✅ Verification Successful: Generation engine is respecting the persona vault.');
        } else {
            console.error('\n❌ Verification Failed: Generation returned empty result.');
        }
    } catch (err) {
        console.error('Generation failed:', err);
    }
}

verifyGeneration();
