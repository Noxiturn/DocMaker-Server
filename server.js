import express from 'express';
import cors from 'cors';
import { setupRoutes } from './controller.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));

app.use(express.json());

setupRoutes(app);

app.listen(PORT, () => {
  console.log(`Servidor na porta ${PORT}`);
  console.log(`PEXELS_KEY: ${process.env.PEXELS_KEY ? 'configurada' : 'NÃO configurada'}`);
});
