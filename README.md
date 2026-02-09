# ClawCon Presentation 🎩

Alfred presents himself at ClawCon Vienna 2026 — with karaoke-style word-synced TTS.

## What is this?

A presentation system where an AI agent (Alfred) speaks through pre-rendered or live TTS, with word-by-word text synchronization. Built for the first OpenClaw community conference.

## Features

- **Karaoke-style sync**: Words highlight as they're spoken
- **Pre-rendered mode**: Bulletproof playback from pre-generated audio
- **Live mode**: Real-time TTS via WebSocket push
- **ElevenLabs integration**: Uses `/with-timestamps` API for word timing
- **Keyboard shortcuts**: Space (play/pause), F (fullscreen), L (live mode), I (intro)

## Quick Start

```bash
# Install dependencies (just Node.js, no npm packages needed)
node --version  # requires Node 18+

# Set your ElevenLabs API key
export ELEVENLABS_API_KEY=sk_...

# Start the server
node server.js

# Open http://localhost:8080
```

## Usage

### Pre-rendered playback

Click "▶ Play Intro" or press `I` to play the pre-rendered intro.

### Live mode

1. Click "📡 Live Mode" or press `L`
2. Send text via API:
   ```bash
   curl -X POST http://localhost:8080/api/speak \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello from Alfred"}'
   ```
3. The presentation will receive and play it with karaoke sync

### Integration with OpenClaw

From your OpenClaw agent, you can push speech to the presentation:

```javascript
// In your agent or hook
await fetch('http://localhost:8080/api/speak', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: response }),
});
```

## Files

- `index.html` — Presentation UI with karaoke player
- `server.js` — HTTP + WebSocket server with TTS generation
- `intro.mp3` — Pre-rendered intro audio
- `intro-alignment.json` — Word timestamps for intro

## Tech Stack

- Vanilla HTML/CSS/JS (no build step)
- Node.js for server
- ElevenLabs API for TTS with timestamps
- WebSocket for live updates

## License

MIT — Built for ClawCon Vienna 2026 by [@plattenschieber](https://x.com/plattenschieber) and Alfred 🎩
