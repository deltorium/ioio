const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway volume or local
const DATA_DIR = fs.existsSync('/data') ? '/data' : __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');

if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// Determine where index.html is
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
  ? path.join(__dirname, 'public')
  : __dirname;

console.log('Public dir:', PUBLIC_DIR);
console.log('Index exists:', fs.existsSync(path.join(PUBLIC_DIR, 'index.html')));

app.use(express.json({ limit: '100mb' }));
app.use(express.static(PUBLIC_DIR));

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

function readData() {
  try {
    if (fs.existsSync(DATA_FILE))
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) { console.error('Read error:', e.message); }
  return { title: 'Я НЕ ПРИДУМАЛ', bgs: [], chars: [], scenes: [], start: null };
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

// Novel data
app.get('/api/data', (req, res) => {
  try { res.json(readData()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/data', (req, res) => {
  try { writeData(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Audio upload
app.post('/api/audio/:id', (req, res) => {
  try {
    const buf = Buffer.from(req.body.data, 'base64');
    const ext = (req.body.ext || 'mp3').replace(/[^a-z0-9]/gi, '');
    const fname = req.params.id + '.' + ext;
    fs.writeFileSync(path.join(AUDIO_DIR, fname), buf);
    console.log('Audio saved:', fname, (buf.length / 1024 / 1024).toFixed(2), 'MB');
    res.json({ ok: true, file: fname, size: buf.length });
  } catch (e) {
    console.error('Audio upload error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Audio serve
app.get('/api/audio/:id', (req, res) => {
  const exts = ['mp3', 'ogg', 'wav', 'm4a', 'webm'];
  const types = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', webm: 'audio/webm' };
  for (const ext of exts) {
    const f = path.join(AUDIO_DIR, req.params.id + '.' + ext);
    if (fs.existsSync(f)) {
      res.setHeader('Content-Type', types[ext] || 'audio/mpeg');
      return res.sendFile(f);
    }
  }
  res.status(404).json({ error: 'not found' });
});

// Audio delete
app.delete('/api/audio/:id', (req, res) => {
  const exts = ['mp3', 'ogg', 'wav', 'm4a', 'webm'];
  for (const ext of exts) {
    const f = path.join(AUDIO_DIR, req.params.id + '.' + ext);
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (e) {}
    }
  }
  res.json({ ok: true });
});

// Audio check
app.get('/api/audio-check/:id', (req, res) => {
  const exts = ['mp3', 'ogg', 'wav', 'm4a', 'webm'];
  for (const ext of exts) {
    const f = path.join(AUDIO_DIR, req.params.id + '.' + ext);
    if (fs.existsSync(f)) {
      const stats = fs.statSync(f);
      return res.json({ exists: true, size: stats.size, ext });
    }
  }
  res.json({ exists: false });
});

// Catch-all → index.html
app.get('*', (req, res) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found. Files in dir: ' + fs.readdirSync(__dirname).join(', '));
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000);
});

process.on('SIGINT', () => {
  console.log('SIGINT received');
  process.exit(0);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('Server on port', PORT);
  console.log('Data:', DATA_FILE);
  console.log('Audio:', AUDIO_DIR);
  console.log('Public:', PUBLIC_DIR);
});
