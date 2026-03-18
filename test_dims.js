import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from './utils/ai-config.ts';

async function testEmbedding() {
    console.log('Testing Gemini Embedding Dimensions...');

    let apiKey = '';
    try {
        const envContent = fs.readFileSync('.env.local', 'utf8');
        const match = envContent.match(/GOOGLE_API_KEY=(.*)/);
        if (match) apiKey = match[1].trim();
    } catch {
        console.error('Failed to read .env.local');
        return;
    }

    if (!apiKey) {
        console.error('GOOGLE_API_KEY not found');
        return;
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
        const text = 'This is a test idea for dimension checking.';
        const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: text,
        });
        const embedding = result.embeddings?.[0]?.values;

        if (!embedding) {
            console.error('No embedding returned');
            return;
        }

        console.log(`Success! Embedding Dimension: ${embedding.length} (expected ${EMBEDDING_DIMENSIONS})`);
    } catch (error) {
        console.error('Error during embedding:', error);
    }
}

void testEmbedding();
