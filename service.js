import fetch from 'node-fetch';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

export async function searchPexels(query) {
  const key = process.env.PEXELS_KEY;

  if (!key) {
    throw new Error('Chave do Pexels não configurada');
  }

  const response = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
    { headers: { Authorization: key } }
  );

  const data = await response.json();

  if (!data.videos || data.videos.length === 0) {
    return { found: false };
  }

  const video = data.videos[0];
  const file = video.video_files.find(f => f.quality === 'hd') || video.video_files[0];

  return {
    found: true,
    id: video.id,
    duration: Math.round(video.duration),
    pexels_url: video.url,
    download_url: file.link,
    photographer: video.user.name
  };
}

export async function downloadClip(url, filename, sessionId) {
  if (!url.startsWith('http')) {
    throw new Error('URL inválida');
  }

  const dir = `/tmp/clipmaker/${sessionId}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filepath = path.join(dir, filename);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Pexels retornou ${response.status}`);
  }

  await pipeline(response.body, fs.createWriteStream(filepath));

  return {
    ok: true,
    filename,
    path: filepath
  };
}

export async function generateZip(sessionId, res) {
  const dir = `/tmp/clipmaker/${sessionId}`;

  if (!fs.existsSync(dir)) {
    throw new Error('Sessão não encontrada');
  }

  const files = fs.readdirSync(dir);
  if (files.length === 0) {
    throw new Error('Nenhum arquivo na sessão');
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="clips_${sessionId}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(res);

  files.forEach(file => {
    const filepath = path.join(dir, file);
    archive.file(filepath, { name: file });
  });

  await archive.finalize();
}

export async function deleteSession(sessionId) {
  const dir = `/tmp/clipmaker/${sessionId}`;

  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }

  return { ok: true };
}
