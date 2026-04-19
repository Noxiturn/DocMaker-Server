import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const app = express();
app.use(cors());
app.use(express.json());

const TMP = '/tmp/clipmaker';
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

// Acorda o servidor
app.get('/', (req, res) => res.send('ClipMaker server rodando'));

// Busca clip no Pexels e retorna metadados
app.get('/pexels/search', async (req, res) => {
  const { query } = req.query;
  const key = process.env.PEXELS_KEY;

  if (!key) return res.status(500).json({ error: 'Chave do Pexels não configurada' });

  try {
    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: key } }
    );
    const data = await response.json();
    if (!data.videos || data.videos.length === 0) return res.json({ found: false });

    const video = data.videos[0];
    const file = video.video_files.find(f => f.quality === 'hd') || video.video_files[0];

    res.json({
      found: true,
      id: video.id,
      duration: Math.round(video.duration),
      pexels_url: video.url,
      download_url: file.link,
      photographer: video.user.name
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Baixa um clip e salva no servidor com o nome correto
app.post('/download', async (req, res) => {
  const { url, filename, session_id } = req.body;
  if (!url || !filename || !session_id) {
    return res.status(400).json({ error: 'url, filename e session_id são obrigatórios' });
  }

  const sessionDir = path.join(TMP, session_id);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  const filePath = path.join(sessionDir, filename);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erro ao baixar: ${response.status}`);
    await pipeline(response.body, fs.createWriteStream(filePath));
    res.json({ ok: true, filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Empacota todos os clips da sessão num ZIP para download
app.get('/zip/:session_id', (req, res) => {
  const { session_id } = req.params;
  const sessionDir = path.join(TMP, session_id);

  if (!fs.existsSync(sessionDir)) {
    return res.status(404).json({ error: 'Sessão não encontrada' });
  }

  const files = fs.readdirSync(sessionDir);
  if (files.length === 0) {
    return res.status(404).json({ error: 'Nenhum clip baixado ainda' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="clips_${session_id}.zip"`);

  const archive = archiver('zip', { zlib: { level: 0 } });
  archive.pipe(res);

  files.forEach(file => {
    archive.file(path.join(sessionDir, file), { name: file });
  });

  archive.finalize();
});

// Limpa a sessão após download
app.delete('/session/:session_id', (req, res) => {
  const { session_id } = req.params;
  const sessionDir = path.join(TMP, session_id);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true });
  }
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));
