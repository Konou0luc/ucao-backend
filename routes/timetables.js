import express from 'express';
import Timetable from '../models/Timetable.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Obtenir tous les emplois du temps (public, filtré par institut / filière / niveau / semestre / année)
router.get('/', async (req, res) => {
  try {
    const { institut, filiere, niveau, day_of_week, semester, academic_year, limit: limitParam, page: pageParam } = req.query;
    const query = {};

    if (institut) query.institut = institut;
    if (filiere) query.filiere = filiere;
    if (niveau) query.niveau = niveau;
    if (day_of_week) query.day_of_week = day_of_week;
    if (semester === 'mousson' || semester === 'harmattan') query.semester = semester;
    if (academic_year != null && academic_year !== '') {
      const y = parseInt(academic_year, 10);
      if (!Number.isNaN(y)) query.academic_year = y;
    }

    const limit = limitParam != null ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 0;
    const page = pageParam != null ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;

    if (limit > 0) {
      const [timetables, total] = await Promise.all([
        Timetable.find(query).populate('course_id', 'title').sort({ day_of_week: 1, start_time: 1 }).skip(skip).limit(limit),
        Timetable.countDocuments(query)
      ]);
      return res.json({ data: timetables, total });
    }
    const timetables = await Timetable.find(query)
      .populate('course_id', 'title')
      .sort({ day_of_week: 1, start_time: 1 });
    res.json(timetables);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Obtenir un emploi du temps spécifique
router.get('/:id', async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id)
      .populate('course_id', 'title');

    if (!timetable) {
      return res.status(404).json({ message: 'Emploi du temps non trouvé' });
    }

    res.json(timetable);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Créer un emploi du temps (admin uniquement)
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const body = { ...req.body };
    if (req.user.institute) body.institut = body.institut ?? req.user.institute;
    const timetable = new Timetable(body);
    await timetable.save();
    await timetable.populate('course_id', 'title');

    res.status(201).json(timetable);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Mettre à jour un emploi du temps (admin uniquement)
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);

    if (!timetable) {
      return res.status(404).json({ message: 'Emploi du temps non trouvé' });
    }
    if (req.user.institute && timetable.institut !== req.user.institute) {
      return res.status(404).json({ message: 'Emploi du temps non trouvé' });
    }

    const body = { ...req.body };
    if (req.user.institute) body.institut = req.user.institute;
    Object.assign(timetable, body);
    await timetable.save();
    await timetable.populate('course_id', 'title');

    res.json(timetable);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Supprimer un emploi du temps (admin uniquement)
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);

    if (!timetable) {
      return res.status(404).json({ message: 'Emploi du temps non trouvé' });
    }
    if (req.user.institute && timetable.institut !== req.user.institute) {
      return res.status(404).json({ message: 'Emploi du temps non trouvé' });
    }

    await timetable.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;

