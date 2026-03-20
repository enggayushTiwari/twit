const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
});

async function listModels() {
    console.log('Listing available models...');
    try {
        const models = await ai.models.list();
        console.log('Available models:');
        models.forEach(m => {
            console.log(`- ${m.name} (${m.supportedMethods.join(', ')})`);
        });
    } catch (error) {
        console.error('Failed to list models:', error);
    }
}

listModels();
