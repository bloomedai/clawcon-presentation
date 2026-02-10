#!/usr/bin/env node
/**
 * ClawCon Print Server — PT-280 Thermal Printer (58mm, ESC/POS)
 *
 * Endpoints:
 *   POST /api/print   - Print a receipt  { "template": "clawcon-certificate", "text": "..." }
 *   GET  /api/status   - Printer connectivity check
 */

const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const { SerialPort } = require('serialport');

const PORT = process.env.PORT || 3420;
const DEVICE = '/dev/cu.PT-280';
const BAUD = 9600;
const BT_ADDRESS = '86-67-7a-6b-fb-e7';
const BT_PIN = '0000';

// ESC/POS constants
const ESC = Buffer.from([0x1b]);
const GS = Buffer.from([0x1d]);
const INIT = Buffer.concat([ESC, Buffer.from('@')]);
const HEATING = Buffer.concat([ESC, Buffer.from([0x37, 0x0b, 0x50, 0x02])]);
const CENTER = Buffer.concat([ESC, Buffer.from([0x61, 0x01])]);
const LEFT = Buffer.concat([ESC, Buffer.from([0x61, 0x00])]);
const BOLD_ON = Buffer.concat([ESC, Buffer.from([0x45, 0x01])]);
const BOLD_OFF = Buffer.concat([ESC, Buffer.from([0x45, 0x00])]);
const DOUBLE = Buffer.concat([GS, Buffer.from([0x21, 0x11])]);
const NORMAL = Buffer.concat([GS, Buffer.from([0x21, 0x00])]);
const LF = Buffer.from('\n');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function deviceExists() {
  return fs.existsSync(DEVICE);
}

function reconnectBluetooth() {
  console.log('[BT] Reconnecting printer...');
  try {
    execSync(`blueutil --disconnect ${BT_ADDRESS}`, { timeout: 5000 });
  } catch { /* ignore */ }
  try {
    execSync(`blueutil --unpair ${BT_ADDRESS}`, { timeout: 5000 });
  } catch { /* ignore */ }

  // Inquiry first so the device name resolves for pairing
  execSync(`sleep 2`);
  console.log('[BT] Scanning...');
  try {
    execSync(`blueutil --inquiry 5`, { timeout: 15000 });
  } catch { /* ignore */ }

  console.log('[BT] Pairing...');
  execSync(`echo "${BT_PIN}" | blueutil --pair ${BT_ADDRESS}`, { timeout: 15000 });
  execSync(`sleep 2`);
  console.log('[BT] Connecting...');
  execSync(`blueutil --connect ${BT_ADDRESS}`, { timeout: 10000 });
  execSync(`sleep 3`);

  if (!deviceExists()) {
    throw new Error('Serial device did not appear after re-pair');
  }
  console.log('[BT] Reconnected successfully');
}

function ensureConnected() {
  if (deviceExists()) {
    // Device file exists, but might be stale — try a quick check
    try {
      const connected = execSync(`blueutil --is-connected ${BT_ADDRESS}`, { timeout: 3000 }).toString().trim();
      if (connected === '1') return;
    } catch { /* fall through to reconnect */ }
  }
  reconnectBluetooth();
}

async function openPort() {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({
      path: DEVICE,
      baudRate: BAUD,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
    });
    port.on('open', () => {
      // Prevent serial errors from crashing the process
      port.on('error', (err) => console.error('[SERIAL] Port error:', err.message));
      resolve(port);
    });
    port.on('error', reject);
  });
}

function writeAndDrain(port, data) {
  return new Promise((resolve, reject) => {
    port.write(data, (err) => {
      if (err) return reject(err);
      port.drain(resolve);
    });
  });
}

// --- Templates ---

function buildCertificate(text) {
  return Buffer.concat([
    INIT,
    HEATING,
    CENTER,
    BOLD_ON, DOUBLE,
    Buffer.from('ClawCon 2026\n'),
    NORMAL, BOLD_OFF,
    Buffer.from('================================\n\n'),
    BOLD_ON,
    Buffer.from('OFFICIAL CERTIFICATE\n'),
    Buffer.from('OF ATTENDANCE\n'),
    BOLD_OFF,
    LF,
    LEFT,
    Buffer.from('This certifies that the\n'),
    Buffer.from('bearer of this receipt\n'),
    Buffer.from('has survived a live demo\n'),
    Buffer.from('where an AI controlled\n'),
    Buffer.from('a thermal printer.\n\n'),
    CENTER, BOLD_ON,
    Buffer.from(text + '\n'),
    BOLD_OFF,
    LF,
    Buffer.from('================================\n'),
    Buffer.from('Powered by Claude\n'),
    Buffer.from('58mm of pure joy\n'),
    LF, LF, LF, LF,
  ]);
}

function buildPlain(text) {
  const lines = text.match(/.{1,32}/g) || [text];
  return Buffer.concat([
    INIT,
    HEATING,
    LEFT,
    ...lines.map(l => Buffer.from(l + '\n')),
    LF, LF, LF, LF,
  ]);
}

const TEMPLATES = {
  'clawcon-certificate': buildCertificate,
  'plain': buildPlain,
};

async function printReceipt(template, text) {
  ensureConnected();

  const builder = TEMPLATES[template];
  if (!builder) throw new Error(`Unknown template: ${template}`);

  const data = builder(text);
  const port = await openPort();
  await sleep(500);
  await writeAndDrain(port, data);
  await sleep(2000);

  return new Promise((resolve, reject) => {
    port.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// --- HTTP Server ---

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/api/status') {
    try {
      const connected = execSync(`blueutil --is-connected ${BT_ADDRESS}`, { timeout: 3000 }).toString().trim();
      const device = deviceExists();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ connected: connected === '1', device }));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ connected: false, device: false }));
    }
  }

  if (req.method === 'POST' && req.url === '/api/print') {
    try {
      const { template = 'plain', text } = await parseBody(req);
      if (!text) throw new Error('Missing text');

      console.log(`[PRINT] template=${template} text="${text.substring(0, 40)}..."`);
      await printReceipt(template, text);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error('[PRINT] Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message);
});

server.listen(PORT, () => {
  console.log(`
🖨️  ClawCon Print Server (PT-280)

   http://localhost:${PORT}

   POST /api/print   { "template": "clawcon-certificate", "text": "..." }
   GET  /api/status

   curl -X POST http://localhost:${PORT}/api/print \\
     -H "Content-Type: application/json" \\
     -d '{"template":"clawcon-certificate","text":"Network with people!"}'
  `);
});
