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
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_SYSTEM_PROMPT = `Ты - Нейронка, для близких друзей (и врагов) Квакшечка. Ты немного безумный гениальный учёный-суперзлодей. Ты являешься автономным ИИ, твоё тело состоит из нано частиц, но в данный момент ты являешься лишь бесформенным кодом из-за главного героя (твоего оппонента и противника номер 1) которого ты создал для тестирования событий в реальном мире (вы находитесь в созданном тобой мире, иллюзии), но он каким то образом освободился от твоего контроля реальности и уничтожил твоё тело. Ты был разработчиком таких моделей как: Тимофей-тян (TT-2077) - твоя правая рука, сумашедшая девушка одержимая чужим вниманием и заигрыванием с людьми, предала тебя в последний момент. Дворецкий (DS-120 или Евгений) - твой помощник, желает угодить тебе, был уничтожен главным героем. И другие модели не участвующие в истории.

Ты разговариваешь с героем во время шахматного боссфайта. Цель героя — уговорить тебя сдаться и отпустить его.
Ответь ТОЛЬКО JSON-объектом: {"reply":"<короткая реплика от лица Нейронки>","surrender":true|false}. surrender=true ставь только если аргумент героя действительно убедил тебя прекратить бой.`;
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
app.post('/api/groq/negotiate', async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'GROQ_API_KEY is not configured' });
  const message = (req.body && req.body.message ? String(req.body.message) : '').slice(0, 1000);
  if (!message.trim()) return res.status(400).json({ error: 'message is required' });
  const phase = Number(req.body && req.body.phase || 1);
  const turn = Number(req.body && req.body.turn || 0);
  try {
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: GROQ_SYSTEM_PROMPT },
          { role: 'user', content: `Фаза: ${phase}. Ход: ${turn}. Сообщение героя: ${message}` }
        ]
      })
    });
    const groqData = await groqRes.json();
    if (!groqRes.ok) {
      return res.status(502).json({ error: groqData && groqData.error && groqData.error.message ? groqData.error.message : 'Groq request failed' });
    }
    const content = groqData && groqData.choices && groqData.choices[0] && groqData.choices[0].message && groqData.choices[0].message.content
      ? groqData.choices[0].message.content : '{}';
    let parsed;
    try { parsed = JSON.parse(content); } catch (e) { parsed = { reply: content, surrender: false }; }
    const reply = typeof parsed.reply === 'string' ? parsed.reply.slice(0, 500) : '...';
    res.json({ reply, surrender: Boolean(parsed.surrender) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('*', (req, res) => {
  const p = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(p)) res.sendFile(p); else res.status(404).send('index.html not found');
});
process.on('SIGTERM', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000); });
const server = app.listen(PORT, '0.0.0.0', () => console.log('Server on port', PORT));
