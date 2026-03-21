/* eslint-disable @typescript-eslint/no-require-imports */
const { GoogleGenAI } = require("@google/genai");
require('dotenv').config({ path: '.env.local' });

async function test004() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
    apiVersion: 'v1'
  });

  try {
    const result = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: "AI is the new electricity."
    });
    console.log("Model: text-embedding-004 (v1)");
    console.log("Dimensions:", result.embeddings[0].values.length);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

test004().catch(console.error);
