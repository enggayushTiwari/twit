/* eslint-disable @typescript-eslint/no-require-imports */
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });

async function check() {
  try {
    const genAI = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
      apiVersion: 'v1beta'
    });
    const model = await genAI.models.get({ model: 'gemini-1.5-flash' });
    console.log('gemini-1.5-flash found in v1beta:', !!model);
  } catch (e) {
    console.log('Error:', e.message);
  }
}
check();
