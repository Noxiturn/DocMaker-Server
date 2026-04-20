import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const app = express();

// CORS configurado explicitamente para aceitar requisições de qualquer origem
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ClipMaker server rodando' });
});

// Buscar clip no Pexels
app.get('/pexels/search', async (req, res) => {
  const { query } = req.query;
  const key = process.env.PEXELS_KEY;
  
  if (!key) {
    return res.status(500).json({ error: 'Chave do Pexels não configurada' });
  }
  
  if (!query) {
    return res.status(400).json({ error: 'Query não fornecida' });
  }
  
  try {
    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: key } }
    );
    const data = await response.json();
    
    if (!data.videos || data.videos.length === 0) {
      return res.json({ found: false });
    }
    
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

// Baixar clip
app.post('/download', async (req, res) => {
  const { url, filename, session_id } = req.body;
  
  if (!url || !filename || !session_id) {
    return res.status(400).json({ ok: false, error: 'URL, filename e session_id obrigatórios' });
  }
  
  try {
    const dir = `/tmp/clipmaker/${session_id}`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filepath = path.join(dir, filename);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Pexels retornou ${response.status}`);
    }
    
    await pipeline(response.body, fs.createWriteStream(filepath));
    
    res.json({ ok: true, filename, path: filepath });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Gerar ZIP
app.get('/zip/:session_id', async (req, res) => {
  const { session_id } = req.params;
  const dir = `/tmp/clipmaker/${session_id}`;
  
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: 'Sessão não encontrada' });
  }
  
  try {
    const files = fs.readdirSync(dir);
    if (files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo na sessão' });
    }
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="clips_${session_id}.zip"`);
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
    
    archive.pipe(res);
    
    files.forEach(file => {
      const filepath = path.join(dir, file);
      archive.file(filepath, { name: file });
    });
    
    await archive.finalize();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Limpar sessão
app.delete('/session/:session_id', (req, res) => {
  const { session_id } = req.params;
  const dir = `/tmp/clipmaker/${session_id}`;
  
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor na porta ${PORT}`);
  console.log(`PEXELS_KEY: ${process.env.PEXELS_KEY ? 'configurada' : 'NÃO configurada'}`);
});
