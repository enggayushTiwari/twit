/* eslint-disable @typescript-eslint/no-require-imports */
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function discover() {
  const output = [];
  try {
    const version = 'v1beta';
    output.push(`\n--- API Version: ${version} ---`);
    const genAI = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
      apiVersion: version
    });

    try {
      const models = await genAI.models.list();
      for await (const model of models) {
        output.push(`Model: ${model.name}, Actions: ${model.supportedActions?.join(', ')}`);
      }
    } catch (e) {
      output.push(`Error listing models for ${version}: ${e.message}`);
    }

    fs.writeFileSync('tmp/discovery_v1beta_all.txt', output.join('\n'));
    console.log('Results written to tmp/discovery_v1beta_all.txt');

  } catch (err) {
    console.error('Error during discovery:', err);
  }
}

discover();
