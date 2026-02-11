import express from 'express';
import Settings from '../models/Settings.js';

const router = express.Router();

// Lecture publique : semestre et année en cours (pour affichage profil, filtres, etc.)
router.get('/', async (req, res) => {
  try {
    let doc = await Settings.findOne().lean();
    if (!doc) {
      const year = new Date().getFullYear();
      const created = await Settings.create({ current_semester: 'harmattan', current_academic_year: year });
      doc = created.toObject();
    }
    res.json({
      current_semester: doc.current_semester ?? 'harmattan',
      current_academic_year: doc.current_academic_year ?? new Date().getFullYear()
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;
