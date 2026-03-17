
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

async function testEmbedding() {
    console.log('Testing Gemini Embedding Dimensions...');
    
    let apiKey = '';
    try {
        const envContent = fs.readFileSync('.env.local', 'utf8');
        const match = envContent.match(/GOOGLE_API_KEY=(.*)/);
        if (match) apiKey = match[1].trim();
    } catch (e) {
        console.error('Failed to read .env.local');
        return;
    }

    if (!apiKey) {
        console.error('GOOGLE_API_KEY not found');
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    try {
        const text = "This is a test idea for dimension checking.";
        const result = await ai.models.embedContent({
            model: 'embedding-001',
            contents: text,
        });
        const embedding = result.embeddings[0].values;
        console.log(`Success! Embedding Dimension: ${embedding.length}`);
    } catch (error) {
        console.error('Error during embedding:', error);
    }
}

testEmbedding();
