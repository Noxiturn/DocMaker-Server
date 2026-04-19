import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/pexels/search', async (req, res) => {
  const { query, key } = req.query;
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

app.get('/', (req, res) => res.send('DocMaker server rodando'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));
