const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = fs.existsSync('/data') ? '/data' : __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
  ? path.join(__dirname, 'public') : __dirname;
app.use(express.json({ limit: '100mb' }));
app.use(express.static(PUBLIC_DIR));
app.get('/health', (req, res) => res.json({ ok: true }));
function readData() {
  try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch (e) { console.error('Read:', e.message); }
  return { title: 'Visual Novel', bgs: [], chars: [], scenes: [], start: null };
}
function writeData(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d)); }
app.get('/api/data', (req, res) => { try { res.json(readData()); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/data', (req, res) => { try { writeData(req.body); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/audio/:id', (req, res) => {
  try { const buf = Buffer.from(req.body.data, 'base64'); const ext = (req.body.ext || 'mp3').replace(/[^a-z0-9]/gi, ''); const fname = req.params.id + '.' + ext; fs.writeFileSync(path.join(AUDIO_DIR, fname), buf); res.json({ ok: true, file: fname, size: buf.length }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/audio/:id', (req, res) => {
  const exts = ['mp3','ogg','wav','m4a','webm'], types = {mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav',m4a:'audio/mp4',webm:'audio/webm'};
  for (const ext of exts) { const f = path.join(AUDIO_DIR, req.params.id + '.' + ext); if (fs.existsSync(f)) { res.setHeader('Content-Type', types[ext]||'audio/mpeg'); return res.sendFile(f); } }
  res.status(404).json({ error: 'not found' });
});
app.delete('/api/audio/:id', (req, res) => {
  ['mp3','ogg','wav','m4a','webm'].forEach(ext => { const f = path.join(AUDIO_DIR, req.params.id + '.' + ext); if (fs.existsSync(f)) try { fs.unlinkSync(f) } catch(e){} });
  res.json({ ok: true });
});
app.get('/api/audio-check/:id', (req, res) => {
  for (const ext of ['mp3','ogg','wav','m4a','webm']) { const f = path.join(AUDIO_DIR, req.params.id + '.' + ext); if (fs.existsSync(f)) { return res.json({ exists: true, size: fs.statSync(f).size, ext }); } }
  res.json({ exists: false });
});
app.get('*', (req, res) => {
  const p = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(p)) res.sendFile(p); else res.status(404).send('index.html not found');
});
process.on('SIGTERM', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000); });
const server = app.listen(PORT, '0.0.0.0', () => console.log('Server on port', PORT));
