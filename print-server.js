#!/usr/bin/env node
/**
 * ClawCon Print Server — PT-280 Thermal Printer (58mm, ESC/POS)
 *
 * Endpoints:
 *   POST /api/print   - Print a receipt  { "template": "clawcon-certificate", "text": "..." }
 *   GET  /api/status   - Printer connectivity check
 */

const http = require('http');
const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3420;
const DEVICE = '/dev/cu.PT-280';
const BT_ADDRESS = '86-67-7a-6b-fb-e7';
const BT_PIN = '0000';
const VENV_DIR = path.join(__dirname, '.venv');
const PYTHON = path.join(VENV_DIR, 'bin', 'python3');

function deviceExists() {
  return fs.existsSync(DEVICE);
}

function ensureVenv() {
  if (fs.existsSync(PYTHON)) {
    console.log('[VENV] Python venv OK');
    return;
  }
  console.log('[VENV] Creating venv and installing pyserial...');
  execSync(`uv venv "${VENV_DIR}" && uv pip install --python "${PYTHON}" pyserial`, {
    stdio: 'inherit',
    timeout: 60000,
  });
  console.log('[VENV] Ready');
}

function sleep(ms) {
  execSync(`sleep ${ms / 1000}`);
}

function isBluetoothConnected() {
  try {
    return execSync(`blueutil --is-connected ${BT_ADDRESS}`, { timeout: 3000 }).toString().trim() === '1';
  } catch {
    return false;
  }
}

function softConnect() {
  console.log('[BT] Soft connect attempt...');
  execSync(`blueutil --connect ${BT_ADDRESS}`, { timeout: 10000 });
  sleep(3000);
}

function reconnectBluetooth() {
  console.log('[BT] Full reconnect (unpair/re-pair)...');
  try { execSync(`blueutil --disconnect ${BT_ADDRESS}`, { timeout: 5000 }); } catch {}
  try { execSync(`blueutil --unpair ${BT_ADDRESS}`, { timeout: 5000 }); } catch {}

  sleep(2000);
  console.log('[BT] Scanning...');
  try { execSync(`blueutil --inquiry 5`, { timeout: 15000 }); } catch {}

  console.log('[BT] Pairing...');
  execSync(`echo "${BT_PIN}" | blueutil --pair ${BT_ADDRESS}`, { timeout: 15000 });
  sleep(2000);
  console.log('[BT] Connecting...');
  execSync(`blueutil --connect ${BT_ADDRESS}`, { timeout: 10000 });
  sleep(3000);

  if (!deviceExists()) {
    throw new Error('Serial device did not appear after re-pair');
  }
  console.log('[BT] Reconnected successfully');
}

function ensureConnected() {
  if (deviceExists() && isBluetoothConnected()) return;

  // Try soft connect first (handles common "drifted" disconnects)
  for (let i = 0; i < 3; i++) {
    try {
      softConnect();
      if (deviceExists() && isBluetoothConnected()) return;
    } catch {}
    if (i < 2) sleep(2000);
  }

  // Nuclear option: full unpair/re-pair
  for (let i = 0; i < 2; i++) {
    try {
      reconnectBluetooth();
      if (deviceExists() && isBluetoothConnected()) return;
    } catch {}
    if (i < 1) sleep(2000);
  }

  throw new Error('Could not reconnect to printer after all retries');
}

// Print via Python subprocess — isolates serial port crashes from the server
function printViaSubprocess(escposHex) {
  const script = `
import serial, time, sys
data = bytes.fromhex(sys.argv[1])
ser = serial.Serial('${DEVICE}', 9600, timeout=2)
time.sleep(0.5)
ser.write(data)
ser.flush()
time.sleep(2)
ser.close()
`;
  execFileSync(PYTHON, ['-c', script, escposHex], { timeout: 30000 });
}

// --- ESC/POS builders (return hex strings) ---

function hex(...buffers) {
  return Buffer.concat(buffers).toString('hex');
}

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

function buildCertificate(text) {
  return hex(
    INIT, HEATING, CENTER,
    BOLD_ON, DOUBLE,
    Buffer.from('ClawCon 2026\n'),
    NORMAL, BOLD_OFF,
    Buffer.from('================================\n\n'),
    BOLD_ON,
    Buffer.from('OFFICIAL CERTIFICATE\n'),
    Buffer.from('OF ATTENDANCE\n'),
    BOLD_OFF, LF, LEFT,
    Buffer.from('This certifies that the\n'),
    Buffer.from('bearer of this receipt\n'),
    Buffer.from('has survived a live demo\n'),
    Buffer.from('where an AI controlled\n'),
    Buffer.from('a thermal printer.\n\n'),
    CENTER, BOLD_ON,
    Buffer.from(text + '\n'),
    BOLD_OFF, LF,
    Buffer.from('================================\n'),
    Buffer.from('Powered by Claude\n'),
    Buffer.from('58mm of pure joy\n'),
    LF, LF, LF, LF,
  );
}

function buildPlain(text) {
  const lines = text.match(/.{1,32}/g) || [text];
  return hex(
    INIT, HEATING, LEFT,
    ...lines.map(l => Buffer.from(l + '\n')),
    LF, LF, LF, LF,
  );
}

const TEMPLATES = {
  'clawcon-certificate': buildCertificate,
  'plain': buildPlain,
};

function printReceipt(template, text) {
  const builder = TEMPLATES[template];
  if (!builder) throw new Error(`Unknown template: ${template}`);

  const escposHex = builder(text);

  try {
    ensureConnected();
    printViaSubprocess(escposHex);
  } catch (err) {
    console.log(`[PRINT] Failed (${err.message}), forcing reconnect...`);
    reconnectBluetooth();
    printViaSubprocess(escposHex);
  }
}

// --- HTTP Server ---

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
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
      printReceipt(template, text);

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

ensureVenv();

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

  // Keepalive: check BT connection every 30s, soft-reconnect if dropped
  setInterval(() => {
    if (!isBluetoothConnected()) {
      console.log('[BT] Keepalive: connection lost, attempting soft reconnect...');
      try {
        softConnect();
        console.log('[BT] Keepalive: reconnected');
      } catch (err) {
        console.log(`[BT] Keepalive: reconnect failed (${err.message}), will retry next cycle`);
      }
    }
  }, 30000);
});
