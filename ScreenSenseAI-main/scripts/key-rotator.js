// Simple example automation script to rotate keys in the running ScreenSense app.
// Usage: node scripts/key-rotator.js --secret=your_secret --openai="sk-...,sk-..." --groq="gsk_...,gsk_..."

const http = require('http');
const url = require('url');

const argv = require('minimist')(process.argv.slice(2));
const secret = argv.secret || process.env.KEY_ROTATION_SECRET;
const openai = argv.openai;
const groq = argv.groq;
const host = argv.host || '127.0.0.1';
const port = argv.port || 8765;

if (!secret) {
  console.error('Missing --secret or KEY_ROTATION_SECRET env var');
  process.exit(2);
}

const payload = {};
if (openai) payload.openaiKey = openai;
if (groq) payload.apiKey = groq;

const data = JSON.stringify(payload);

const options = {
  hostname: host,
  port: port,
  path: '/rotate-keys',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'x-rotation-secret': secret
  }
};

const req = http.request(options, (res) => {
  let resp = '';
  res.on('data', (d) => resp += d);
  res.on('end', () => {
    try {
      const json = JSON.parse(resp || '{}');
      console.log('Response:', json);
    } catch (e) {
      console.log('Raw response:', resp);
    }
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message || err);
});

req.write(data);
req.end();
