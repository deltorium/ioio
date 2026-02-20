const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = fs.existsSync('/data') ? '/data' : __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');

// создаём папку для аудио
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  try {
    if (fs.existsSync(DATA_FILE))
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) { console.error('Read:', e.message); }
  return { title: 'Я НЕ ПРИДУМАЛ', bgs: [], chars: [], scenes: [], start: null };
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

// Novel data
app.get('/api/data', (req, res) => res.json(readData()));
app.post('/api/data', (req, res) => {
  try { writeData(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Audio upload (base64 in JSON)
app.post('/api/audio/:id', (req, res) => {
  try {
    const buf = Buffer.from(req.body.data, 'base64');
    const ext = req.body.ext || 'mp3';
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
  // try multiple extensions
  var exts = ['mp3', 'ogg', 'wav', 'm4a', 'webm'];
  for (var i = 0; i < exts.length; i++) {
    var f = path.join(AUDIO_DIR, req.params.id + '.' + exts[i]);
    if (fs.existsSync(f)) {
      var types = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', webm: 'audio/webm' };
      res.setHeader('Content-Type', types[exts[i]] || 'audio/mpeg');
      return res.sendFile(f);
    }
  }
  res.status(404).json({ error: 'not found' });
});

// Audio delete
app.delete('/api/audio/:id', (req, res) => {
  var exts = ['mp3', 'ogg', 'wav', 'm4a', 'webm'];
  for (var i = 0; i < exts.length; i++) {
    var f = path.join(AUDIO_DIR, req.params.id + '.' + exts[i]);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  res.json({ ok: true });
});

// Check if audio exists
app.get('/api/audio-check/:id', (req, res) => {
  var exts = ['mp3', 'ogg', 'wav', 'm4a', 'webm'];
  for (var i = 0; i < exts.length; i++) {
    var f = path.join(AUDIO_DIR, req.params.id + '.' + exts[i]);
    if (fs.existsSync(f)) {
      var stats = fs.statSync(f);
      return res.json({ exists: true, size: stats.size, ext: exts[i] });
    }
  }
  res.json({ exists: false });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server on port', PORT);
  console.log('Data:', DATA_FILE);
  console.log('Audio:', AUDIO_DIR);
});
