const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Volume смонтирован в /data
// Если Volume нет — пишем рядом с проектом (для локальной разработки)
const DATA_DIR = fs.existsSync('/data') ? '/data' : __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Read error:', e.message);
  }
  return {
    title: 'Я НЕ ПРИДУМАЛ',
    bgs: [],
    chars: [],
    scenes: [],
    start: null
  };
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
  console.log('Data saved, size:', (fs.statSync(DATA_FILE).size / 1024).toFixed(1), 'KB');
}

app.get('/api/data', (req, res) => {
  res.json(readData());
});

app.post('/api/data', (req, res) => {
  try {
    writeData(req.body);
    res.json({ ok: true });
  } catch (e) {
    console.error('Write error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port', PORT);
  console.log('Data file:', DATA_FILE);
  console.log('Volume detected:', fs.existsSync('/data'));
});