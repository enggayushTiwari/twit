/* eslint-disable @typescript-eslint/no-require-imports */
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const genAI = new GoogleGenAI(process.env.GOOGLE_API_KEY);
    try {
        const models = await genAI.listModels();
        console.log('Available models:');
        for (const model of models) {
            console.log(`- ${model.name} (Supported methods: ${model.supportedGenerationMethods.join(', ')})`);
        }
    } catch (error) {
        console.error('Error listing models:', error);
    }
}

listModels();
