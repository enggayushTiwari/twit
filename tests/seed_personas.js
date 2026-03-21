/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

// Initialize Google GenAI
const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
});

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const personas = [
    {
        handle: 'naval',
        tweets: [
            "Wealth is not about having a lot of money; it's about having a lot of options.",
            "The best way to get rich is to be the best at what you do, and then do it for yourself.",
            "Specific knowledge is found by pursuing your genuine curiosity and passion rather than whatever is hot right now.",
            "Retirement is when you stop sacrificing today for an imaginary tomorrow. When today is complete, in and of itself, you’re retired.",
            "Learn to sell. Learn to build. If you can do both, you will be unstoppable."
        ]
    },
    {
        handle: 'paulg',
        tweets: [
            "It's better to make a few people really happy than to make a lot of people semi-happy.",
            "The most important thing for a startup is to build something people want.",
            "Be a no-stack developer. Just build things.",
            "If you can't explain your idea to a smart friend in a few sentences, you probably don't understand it well enough yourself.",
            "The way to get startup ideas is not to try to think of startup ideas. It's to look for problems, preferably problems you have yourself."
        ]
    }
];

async function seedPersonas() {
    for (const persona of personas) {
        console.log(`\n--- Processing @${persona.handle} ---`);
        
        const systemPrompt = `You are a master copywriter and brand strategist. 
Analyze the provided tweets from a specific creator and reverse-engineer their voice. 
Output a concise, highly specific 'Voice Framework' detailing:
1. Sentence Length & Structure (e.g., punchy, academic, run-on style)
2. Tone & Atmosphere (e.g., cynical, hyper-optimistic, ironic)
3. Vocabulary Choices (e.g., slang used, specific jargon, simple vs. complex words)
4. Formatting Quirks (e.g., all lowercase, use of emojis, specific spacing, list structures)

Be precise and objective. Do not provide generic advice.`;

        const tweetContent = persona.tweets.map((t, i) => `Tweet ${i + 1}: ${t}`).join('\n\n');

        try {
            console.log(`Generating voice profile for @${persona.handle}...`);
            const prompt = `Analyze the voice of @${persona.handle} based on these golden tweets:\n\n${tweetContent}`;
            const completionResponse = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.7,
                }
            });

            const voiceProfile = completionResponse.text || '';
            console.log(`Voice profile generated for @${persona.handle}.`);

            const { error: insertError } = await supabase
                .from('creator_personas')
                .insert([
                    {
                        handle: persona.handle,
                        golden_tweets: persona.tweets,
                        ai_voice_profile: voiceProfile
                    }
                ]);

            if (insertError) {
                console.error(`Error saving persona @${persona.handle}:`, insertError);
            } else {
                console.log(`Successfully saved persona @${persona.handle} to database.`);
            }
        } catch (error) {
            console.error(`Failed to process @${persona.handle}:`, error);
        }
    }
}

seedPersonas();
