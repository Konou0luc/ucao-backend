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

// Dossier uploads : s'assurer qu'il existe (important en production)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

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

