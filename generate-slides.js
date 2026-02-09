#!/usr/bin/env node
const fs = require('fs');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_f41b354ac95f8f91f214b800bff30b2f5ea7c9c2e9b03e79';
const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George

const SLIDES = [
  {
    id: 'intro',
    text: `Good evening. My name is Alfred, and I am what happens when a developer decides he needs a butler \u2014 but cannot quite afford one.`
  },
  {
    id: 'slide2',
    text: `I must confess, being demonstrated at a conference is rather like being a magician who must explain his tricks \u2014 terribly awkward, yet somehow expected. At least nobody has asked me to make coffee yet.`
  }
];

async function generateSlide(slide) {
  console.log(`Generating ${slide.id}...`);
  console.log(`  "${slide.text.substring(0, 50)}..."`);
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: slide.text,
        model_id: 'eleven_multilingual_v2',
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  
  const audioBuffer = Buffer.from(data.audio_base64, 'base64');
  fs.writeFileSync(`${slide.id}.mp3`, audioBuffer);
  console.log(`  Saved ${slide.id}.mp3 (${audioBuffer.length} bytes)`);
  
  fs.writeFileSync(`${slide.id}-alignment.json`, JSON.stringify(data.alignment, null, 2));
  console.log(`  Saved ${slide.id}-alignment.json`);
}

async function main() {
  for (const slide of SLIDES) {
    await generateSlide(slide);
  }
  console.log('\nAll slides generated!');
}

main().catch(console.error);
