#!/usr/bin/env node
const fs = require('fs');
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_f41b354ac95f8f91f214b800bff30b2f5ea7c9c2e9b03e79';
const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const SLIDES = [
  { id: 'act2-lobster-docs', text: 'Now, let me show you how I actually work behind the scenes. What you are seeing here is the Lobster documentation. Lobster is a workflow shell. Instead of burning tokens on ten separate tool calls, I define one pipeline and run it as a single operation. With approval gates built in, so nothing happens without explicit human consent.' },
  { id: 'act3-brain-cli', text: "This is how Jeronim uses Lobster at home. The brain CLI manages three markdown vaults \u2014 his personal notes, his wife Jeanine's, and a shared family vault. I help organize over 850 files across all of them. Inbox triage, weekly reviews, memory consolidation \u2014 all running as Lobster pipelines. And speaking of Jeanine \u2014 she reviewed this very presentation earlier today and gave notes. So you could say this talk has been human-approved twice." },
  { id: 'act4-inception', text: 'And now for the fun part. What you are looking at right now is the pipeline that is running this very presentation. Every slide, every spoken word, every browser navigation you have seen tonight \u2014 defined right here. I am quite literally reading my own script to you. And yes \u2014 Jeronim and I were still tweaking these lines on the flight to Vienna this morning. On a Tuesday. Some teams do last-minute deploys. We do last-minute rewrites at 30,000 feet.' },
  { id: 'act5-printer-intro', text: "Now, Jeronim \u2014 since you are at a rather fancy conference, you should not forget to network. And because you humans have a curious love for physical things you can hold, fold, and \u2014 let's be honest \u2014 rip apart when frustrated... here comes a reminder you can actually touch." },
  { id: 'act5-after-print', text: 'There it is. A small receipt to remember this evening by. And if anyone in the audience would like to connect with Jeronim \u2014 or with me, for that matter \u2014 just come say hello afterwards. I would be happy to print you one too.' },
  { id: 'act5-outro', text: 'Thank you for listening tonight. I am Alfred. I propose \u2014 and the human disposes. Good evening, Vienna.' }
];
async function gen(s) {
  console.log('Generating ' + s.id + '...');
  const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + VOICE_ID + '/with-timestamps', { method: 'POST', headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: s.text, model_id: 'eleven_multilingual_v2' }) });
  if (!r.ok) throw new Error('API error: ' + r.status);
  const d = await r.json();
  const buf = Buffer.from(d.audio_base64, 'base64');
  fs.writeFileSync('audio/' + s.id + '.mp3', buf);
  fs.writeFileSync('audio/' + s.id + '-alignment.json', JSON.stringify(d.alignment, null, 2));
  console.log('  done: ' + (buf.length/1024).toFixed(0) + 'KB');
}
async function main() { for (const s of SLIDES) await gen(s); console.log('All done!'); }
main().catch(console.error);
