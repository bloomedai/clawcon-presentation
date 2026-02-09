#!/usr/bin/env node
/**
 * ClawCon Presentation Server
 * 
 * Serves the presentation and handles live TTS via WebSocket.
 * 
 * Usage:
 *   node server.js
 *   # or with environment variables:
 *   ELEVENLABS_API_KEY=sk_... VOICE_ID=JBFqnCBsd6RMkjVDRZzb node server.js
 * 
 * Endpoints:
 *   GET  /           - Serve presentation
 *   POST /api/speak  - Generate TTS and push to presentation
 *   WS   /ws         - WebSocket for live updates
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_f41b354ac95f8f91f214b800bff30b2f5ea7c9c2e9b03e79';
const VOICE_ID = process.env.VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'; // George

// Track connected clients
const clients = new Set();

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

// Generate TTS with timestamps from ElevenLabs
async function generateTTS(text) {
  console.log(`[TTS] Generating for: "${text.substring(0, 50)}..."`);
  
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
      }),
    }
  );
  
  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Convert character timings to word timings
  const { characters, character_start_times_seconds, character_end_times_seconds } = data.alignment;
  const words = [];
  let wordStart = 0;
  let currentWord = '';
  
  for (let i = 0; i < characters.length; i++) {
    if (characters[i] === ' ' || i === characters.length - 1) {
      if (i === characters.length - 1 && characters[i] !== ' ') {
        currentWord += characters[i];
      }
      if (currentWord.trim()) {
        words.push({
          word: currentWord,
          start: character_start_times_seconds[wordStart],
          end: character_end_times_seconds[i - 1] || character_end_times_seconds[i],
        });
      }
      currentWord = '';
      wordStart = i + 1;
    } else {
      currentWord += characters[i];
    }
  }
  
  console.log(`[TTS] Generated ${words.length} words, audio length: ${data.audio_base64.length} bytes`);
  
  return {
    text,
    audio: data.audio_base64,
    words,
  };
}

// Broadcast to all WebSocket clients
function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  }
}

// HTTP server
const server = http.createServer(async (req, res) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // API endpoint for live TTS
  if (req.method === 'POST' && req.url === '/api/speak') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body);
        if (!text) throw new Error('Missing text');
        
        const ttsResult = await generateTTS(text);
        
        // Broadcast to presentation
        broadcast({ type: 'speak', ...ttsResult });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, wordCount: ttsResult.words.length }));
      } catch (err) {
        console.error('[API] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API endpoint for presentation control (used by Lobster pipeline)
  if (req.method === 'POST' && req.url === '/api/control') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { action, index, url } = JSON.parse(body);
        let result = { ok: true, action };
        
        switch (action) {
          case 'showSlide':
            broadcast({ type: 'control', action: 'showSlide', index: index || 0 });
            result.slide = index;
            result.mode = 'static';
            break;
          case 'playSlide':
            broadcast({ type: 'control', action: 'playSlide', index: index || 0 });
            result.slide = index;
            break;
          case 'toggleLive':
            broadcast({ type: 'control', action: 'toggleLive' });
            break;
          case 'navigate':
            broadcast({ type: 'control', action: 'navigate', url });
            result.url = url;
            break;
          case 'clear':
            broadcast({ type: 'control', action: 'clear' });
            break;
          default:
            throw new Error('Unknown action: ' + action);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[Control API] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  
  // Static file serving
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);
  
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  clients.add(ws);
  
  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    clients.delete(ws);
  });
  
  ws.on('message', (data) => {
    console.log('[WS] Received:', data.toString());
  });
});

server.listen(PORT, () => {
  console.log(`
🎩 ClawCon Presentation Server
   
   Local:    http://localhost:${PORT}
   
   API:      POST /api/speak { "text": "Hello world" }
   
   Test:     curl -X POST http://localhost:${PORT}/api/speak \\
               -H "Content-Type: application/json" \\
               -d '{"text": "Hello from Alfred"}'
  `);
});
