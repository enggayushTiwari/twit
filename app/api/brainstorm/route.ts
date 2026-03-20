import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { getErrorMessage } from '@/utils/errors';

// Initialize Gemini
const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
});

type RawIdeaContext = {
    content: string;
    type: string;
};

export async function POST() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch user profile to match tone (optional but good practice)
        const { data: profile } = await supabase
            .from('user_profile')
            .select('*')
            .limit(1)
            .single();

        // 1. Fetch the 10 most recent rows from raw_ideas to understand what user is thinking about
        const { data: recentInputs, error: fetchError } = await supabase
            .from('raw_ideas')
            .select('content, type')
            .order('created_at', { ascending: false })
            .limit(10);

        if (fetchError) {
            console.error('Failed to fetch recent ideas:', fetchError);
            return NextResponse.json({ error: 'Failed to access vault history.' }, { status: 500 });
        }

        if (!recentInputs || recentInputs.length === 0) {
            return NextResponse.json({ error: 'Your vault is empty. Deposit some ideas first to give the Co-Thinker some context!' }, { status: 400 });
        }

        const formattedContext = (recentInputs as RawIdeaContext[])
            .map((item) => `[${item.type.toUpperCase()}] ${item.content}`)
            .join('\n---\n');

        const systemPrompt = `You are a brilliant intellectual sparring partner and brand architect for the user. 
Read the user's recent thoughts and project logs provided below. 
Identify the underlying themes, find the logical gaps, and suggest 3 novel, adjacent concepts or contrarian angles that the user has NOT explicitly written about yet. 
If available, keep their desired public perception in mind: ${profile?.desired_perception || 'Thoughtful builder'}.

Output EXACTLY AND ONLY a valid JSON array of strings, with NO markdown formatting, NO code blocks, and NO surrounding text. 
Each string must be a sharp, single-paragraph idea that the user could copy into their vault.`;

        const completionResponse = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: `Here is the user's recent vault context:\n\n${formattedContext}`,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.8,
            }
        });

        const rawText = completionResponse.text || '';
        
        // Try to parse the output
        let suggestions: string[] = [];
        try {
            // Remove potential markdown code blocks if the AI stubbornly adds them
            const cleanText = rawText.replace(/```json\n?|\n?```/g, '').trim();
            const parsed: unknown = JSON.parse(cleanText);
            
            if (!Array.isArray(parsed)) {
                throw new Error("Parsed output is not an array");
            }
            
            // Ensure exactly 3 strings
            suggestions = parsed.slice(0, 3).map(String);
        } catch (parseError) {
            console.error('Failed to parse Gemini output:', rawText, parseError);
            return NextResponse.json({ error: 'Failed to parse AI response. Please try again.' }, { status: 500 });
        }

        return NextResponse.json({ suggestions });

    } catch (error: unknown) {
        console.error('Brainstorm API Error:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'An unexpected error occurred.') }, { status: 500 });
    }
}
