#!/usr/bin/env node
/**
 * ClawCon Print Server — PT-280 Thermal Printer (58mm, ESC/POS)
 *
 * The PT-280 over macOS Bluetooth has a quirk: closing the serial port kills
 * the RFCOMM data channel. To work around this, we keep a persistent Python
 * worker process with the serial port open and feed it print data via stdin.
 *
 * Endpoints:
 *   POST /api/print   - Print a receipt  { "template": "clawcon-certificate", "text": "..." }
 *   POST /api/reset   - Full BT power cycle + re-pair + restart worker
 *   GET  /api/status   - Printer connectivity check
 */

const http = require('http');
const { execSync } = require('child_process');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(tag, msg) {
  console.log(`${new Date().toISOString()} [${tag}] ${msg}`);
}

const PORT = process.env.PORT || 3420;
const DEVICE = '/dev/cu.PT-280';
const BT_ADDRESS = '86-67-7a-6b-fb-e7';
const BT_PIN = '0000';
const VENV_DIR = path.join(__dirname, '.venv');
const PYTHON = path.join(VENV_DIR, 'bin', 'python3');

// --- Setup ---

function deviceExists() {
  return fs.existsSync(DEVICE);
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

function ensureVenv() {
  if (fs.existsSync(PYTHON)) return;
  log('VENV', 'Creating venv and installing pyserial...');
  execSync(`uv venv "${VENV_DIR}" && uv pip install --python "${PYTHON}" pyserial`, {
    stdio: 'inherit',
    timeout: 60000,
  });
}

// --- Bluetooth connection management ---

function btConnect() {
  execSync(`blueutil --connect ${BT_ADDRESS}`, { timeout: 5000 });
  sleep(1000);
}

function btReset() {
  log('BT', 'Full reset: power cycle + re-pair...');

  try { execSync(`blueutil --disconnect ${BT_ADDRESS}`, { timeout: 3000 }); } catch {}
  try { execSync(`blueutil --unpair ${BT_ADDRESS}`, { timeout: 3000 }); } catch {}
  sleep(1000);

  execSync('blueutil --power 0', { timeout: 5000 });
  sleep(2000);
  execSync('blueutil --power 1', { timeout: 5000 });
  sleep(3000);

  execSync(`expect -c 'spawn blueutil --pair ${BT_ADDRESS}; expect "Enter:"; send "${BT_PIN}\\r"; expect eof'`, { timeout: 15000 });
  sleep(1000);
  execSync(`blueutil --connect ${BT_ADDRESS}`, { timeout: 10000 });

  // Wait for serial device (may need a disconnect+reconnect cycle)
  for (let attempt = 0; attempt < 3; attempt++) {
    for (let i = 0; i < 5; i++) {
      if (deviceExists()) {
        log('BT', 'Reset complete, serial device ready');
        return;
      }
      sleep(1000);
    }
    try { execSync(`blueutil --disconnect ${BT_ADDRESS}`, { timeout: 3000 }); } catch {}
    sleep(1000);
    execSync(`blueutil --connect ${BT_ADDRESS}`, { timeout: 10000 });
  }

  if (!deviceExists()) throw new Error('Serial device did not appear after BT reset');
}

// --- Persistent print worker ---
// Keeps /dev/cu.PT-280 open to preserve the RFCOMM channel.
// Accepts hex-encoded ESC/POS data on stdin, one job per line.

let printWorker = null;
let printWorkerReady = false;

function startWorker() {
  if (printWorker && !printWorker.killed && printWorkerReady) {
    return Promise.resolve();
  }
  if (printWorker) { printWorker.kill(); printWorker = null; }

  // Always do a full BT reset when starting the worker — a stale RFCOMM
  // channel accepts writes silently but never delivers data to the printer.
  btReset();
  if (!deviceExists()) throw new Error('Serial device not available');

  return new Promise((resolve, reject) => {
    log('WORKER', 'Starting...');

    const script = `
import serial, sys, time
ser = serial.Serial()
ser.port = '${DEVICE}'
ser.baudrate = 9600
ser.timeout = 2
ser.hupcl = False
ser.open()
# Warmup: send ESC @ (init) to confirm the RFCOMM channel is truly live
time.sleep(2)
ser.write(b'\\x1b@')
ser.flush()
time.sleep(1)
print("READY", flush=True)
for line in sys.stdin:
    hex_data = line.strip()
    if not hex_data:
        continue
    try:
        data = bytes.fromhex(hex_data)
        ser.write(data)
        ser.flush()
        time.sleep(1)
        print(f"OK {len(data)}", flush=True)
    except Exception as e:
        print(f"ERR {e}", flush=True)
`;

    printWorker = spawn(PYTHON, ['-u', '-c', script], { stdio: ['pipe', 'pipe', 'pipe'] });
    printWorkerReady = false;

    const timeout = setTimeout(() => {
      if (!printWorkerReady) {
        printWorker.kill();
        printWorker = null;
        reject(new Error('Print worker did not start'));
      }
    }, 20000);

    printWorker.stdout.on('data', (data) => {
      if (data.toString().trim() === 'READY' && !printWorkerReady) {
        printWorkerReady = true;
        clearTimeout(timeout);
        log('WORKER', 'Ready');
        resolve();
      }
    });

    printWorker.stderr.on('data', (data) => {
      log('WORKER', `stderr: ${data.toString().trim()}`);
    });

    printWorker.on('exit', (code) => {
      log('WORKER', `Exited (code=${code})`);
      printWorker = null;
      printWorkerReady = false;
    });
  });
}

function sendToWorker(escposHex) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Print timeout')), 10000);

    const onData = (data) => {
      for (const line of data.toString().trim().split('\n')) {
        if (line.startsWith('OK')) {
          clearTimeout(timeout);
          printWorker.stdout.removeListener('data', onData);
          resolve();
        } else if (line.startsWith('ERR')) {
          clearTimeout(timeout);
          printWorker.stdout.removeListener('data', onData);
          reject(new Error(line));
        }
      }
    };

    printWorker.stdout.on('data', onData);
    printWorker.stdin.write(escposHex + '\n');
  });
}

// --- ESC/POS builders ---

function hex(...buffers) {
  return Buffer.concat(buffers).toString('hex');
}

const ESC = Buffer.from([0x1b]);
const GS = Buffer.from([0x1d]);
const INIT = Buffer.concat([ESC, Buffer.from('@')]);
const CENTER = Buffer.concat([ESC, Buffer.from([0x61, 0x01])]);
const LEFT = Buffer.concat([ESC, Buffer.from([0x61, 0x00])]);
const BOLD_ON = Buffer.concat([ESC, Buffer.from([0x45, 0x01])]);
const BOLD_OFF = Buffer.concat([ESC, Buffer.from([0x45, 0x00])]);
const DOUBLE = Buffer.concat([GS, Buffer.from([0x21, 0x11])]);
const NORMAL = Buffer.concat([GS, Buffer.from([0x21, 0x00])]);
const LF = Buffer.from('\n');

function buildCertificate(text) {
  return hex(
    INIT, CENTER,
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
    INIT, LEFT,
    ...lines.map(l => Buffer.from(l + '\n')),
    LF, LF, LF, LF,
  );
}

const TEMPLATES = {
  'clawcon-certificate': buildCertificate,
  'plain': buildPlain,
};

// --- Print orchestration ---

async function printReceipt(template, text) {
  const builder = TEMPLATES[template];
  if (!builder) throw new Error(`Unknown template: ${template}`);

  const escposHex = builder(text);

  try {
    await startWorker();
    await sendToWorker(escposHex);
  } catch (err) {
    // Worker dead or BT dropped — full reset and retry
    log('PRINT', `${err.message}, resetting...`);
    if (printWorker) { printWorker.kill(); printWorker = null; }
    btReset();
    await startWorker();
    await sendToWorker(escposHex);
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  log('HTTP', `${req.method} ${req.url}`);

  if (req.method === 'GET' && req.url === '/api/status') {
    const bt = isBluetoothConnected();
    const device = deviceExists();
    const worker = printWorkerReady;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ connected: bt, device, worker }));
  }

  if (req.method === 'POST' && req.url === '/api/reset') {
    try {
      if (printWorker) { printWorker.kill(); printWorker = null; }
      btReset();
      await startWorker();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      log('RESET', `Error: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/print') {
    try {
      const { template = 'plain', text } = await parseBody(req);
      if (!text) throw new Error('Missing text');

      log('PRINT', `template=${template} text="${text.substring(0, 40)}..."`);
      await printReceipt(template, text);
      log('PRINT', 'OK');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      log('PRINT', `Error: ${err.message}`);
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
   POST /api/reset   Full BT power cycle + re-pair + restart worker
   GET  /api/status

   curl -X POST http://localhost:${PORT}/api/print \\
     -H "Content-Type: application/json" \\
     -d '{"template":"clawcon-certificate","text":"Network with people!"}'
  `);

  startWorker().then(() => {
    log('BOOT', 'Printer ready');
  }).catch(err => {
    log('BOOT', `Printer init failed: ${err.message} (will retry on first print)`);
  });
});
