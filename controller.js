import {
  searchPexels,
  downloadClip,
  generateZip,
  deleteSession
} from './service.js';

export function setupRoutes(app) {
  app.get('/', (req, res) => {
    res.json({ status: 'ClipMaker server rodando' });
  });

  app.get('/pexels/search', async (req, res) => {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query não fornecida' });
    }

    try {
      const result = await searchPexels(query);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/download', async (req, res) => {
    const { url, filename, session_id } = req.body;

    if (!url || !filename || !session_id) {
      return res.status(400).json({
        ok: false,
        error: 'URL, filename e session_id obrigatórios'
      });
    }

    try {
      const result = await downloadClip(url, filename, session_id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get('/zip/:session_id', async (req, res) => {
    const { session_id } = req.params;

    try {
      await generateZip(session_id, res);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/session/:session_id', async (req, res) => {
    const { session_id } = req.params;

    try {
      const result = await deleteSession(session_id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
