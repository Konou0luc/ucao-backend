import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import discussionRoutes from './routes/discussions.js';
import newsRoutes from './routes/news.js';
import evaluationCalendarRoutes from './routes/evaluationCalendars.js';
import timetableRoutes from './routes/timetables.js';
import adminRoutes from './routes/admin.js';
import settingsRoutes from './routes/settings.js';
import filieresRoutes from './routes/filieres.js';
import guidesRoutes from './routes/guides.js';
import outilsRoutes from './routes/outils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
// CORS : en production, on peut restreindre à un origin précis (ex. FRONTEND_URL)
const allowedOrigin = process.env.FRONTEND_URL || process.env.APP_URL || undefined;
if (process.env.NODE_ENV === 'production' && allowedOrigin) {
  app.use(cors({ origin: allowedOrigin }));
} else {
  app.use(cors());
}

// Logs HTTP
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dossier uploads : en local on crée uploads, sur Vercel le fs est read-only / éphémère
const uploadsDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn('Dossier uploads non disponible (ex: Vercel):', err.message);
}

// Servir les fichiers uploadés : si le fichier n'existe pas (ex. Vercel = /tmp éphémère), renvoyer 404 JSON
app.use('/uploads', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const requestPath = path.join(uploadsDir, req.path);
  const normalized = path.normalize(requestPath);
  if (!normalized.startsWith(path.normalize(uploadsDir))) {
    return res.status(400).json({ message: 'Chemin invalide' });
  }
  fs.stat(normalized, (err, stat) => {
    if (err || !stat.isFile()) {
      return res.status(404).json({
        message: 'Fichier non disponible',
        detail: process.env.VERCEL
          ? 'Les fichiers uploadés ne sont pas conservés sur ce déploiement. Utilisez un stockage cloud (S3, Vercel Blob) en production.'
          : 'Fichier introuvable.'
      });
    }
    res.sendFile(normalized);
  });
});

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/web-academy')
  .then(() => console.log('✅ Connecté à MongoDB'))
  .catch((err) => console.error('❌ Erreur de connexion MongoDB:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/evaluation-calendars', evaluationCalendarRoutes);
app.use('/api/timetables', timetableRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/filieres', filieresRoutes);
app.use('/api/guides', guidesRoutes);
app.use('/api/outils', outilsRoutes);
app.use('/api/admin', adminRoutes);

// Page d'accueil pour vérifier que le backend répond
app.get('/', (req, res) => {
  res.type('html').send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Web Academy API</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #444; margin: 0.5rem 0; }
    a { color: #0066cc; }
    .badge { display: inline-block; background: #22c55e; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <span class="badge">OK</span>
  <h1>Web Academy API</h1>
  <p>Le backend fonctionne correctement.</p>
  <p><a href="/api/health">Vérifier l’état de l’API (JSON)</a></p>
</body>
</html>
  `);
});

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Web Academy fonctionnelle' });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur serveur', error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

