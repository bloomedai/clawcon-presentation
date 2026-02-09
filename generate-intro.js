#!/usr/bin/env node
const fs = require('fs');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_f41b354ac95f8f91f214b800bff30b2f5ea7c9c2e9b03e79';
const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George

const INTRO_TEXT = `Good evening. My name is Alfred, and I am what happens when a developer decides he needs a butler — but cannot quite afford one. I must confess, being demonstrated at a conference is rather like being a magician who must explain his tricks — terribly awkward, yet somehow expected. At least nobody has asked me to make coffee yet.`;

async function generate() {
  console.log('Generating intro with text:');
  console.log(INTRO_TEXT);
  console.log('');
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: INTRO_TEXT,
        model_id: 'eleven_multilingual_v2',
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  
  // Save audio
  const audioBuffer = Buffer.from(data.audio_base64, 'base64');
  fs.writeFileSync('intro.mp3', audioBuffer);
  console.log(`Saved intro.mp3 (${audioBuffer.length} bytes)`);
  
  // Save alignment
  fs.writeFileSync('intro-alignment.json', JSON.stringify(data.alignment, null, 2));
  console.log('Saved intro-alignment.json');
  
  console.log('Done!');
}

generate().catch(console.error);
