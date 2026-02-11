import express from 'express';
import EvaluationCalendar from '../models/EvaluationCalendar.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Obtenir tous les calendriers d'évaluation (public, filtré par institut / filière / niveau / semestre / année)
router.get('/', async (req, res) => {
  try {
    const { institut, filiere, niveau, course_id, semester, academic_year, limit: limitParam, page: pageParam } = req.query;
    const query = {};

    if (institut) query.institut = institut;
    if (filiere) query.filiere = filiere;
    if (niveau) query.niveau = niveau;
    if (course_id) query.course_id = course_id;
    if (semester === 'mousson' || semester === 'harmattan') query.semester = semester;
    if (academic_year != null && academic_year !== '') {
      const y = parseInt(academic_year, 10);
      if (!Number.isNaN(y)) query.academic_year = y;
    }

    const limit = limitParam != null ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 0;
    const page = pageParam != null ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;

    if (limit > 0) {
      const [calendars, total] = await Promise.all([
        EvaluationCalendar.find(query).populate('course_id', 'title').sort({ evaluation_date: 1 }).skip(skip).limit(limit),
        EvaluationCalendar.countDocuments(query)
      ]);
      return res.json({ data: calendars, total });
    }
    const calendars = await EvaluationCalendar.find(query)
      .populate('course_id', 'title')
      .sort({ evaluation_date: 1 });
    res.json(calendars);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Obtenir un calendrier spécifique
router.get('/:id', async (req, res) => {
  try {
    const calendar = await EvaluationCalendar.findById(req.params.id)
      .populate('course_id', 'title');

    if (!calendar) {
      return res.status(404).json({ message: 'Calendrier non trouvé' });
    }

    res.json(calendar);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Créer un calendrier (admin uniquement)
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const body = { ...req.body };
    if (req.user.institute) body.institut = body.institut ?? req.user.institute;
    const calendar = new EvaluationCalendar(body);
    await calendar.save();
    await calendar.populate('course_id', 'title');

    res.status(201).json(calendar);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Mettre à jour un calendrier (admin uniquement)
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const calendar = await EvaluationCalendar.findById(req.params.id);

    if (!calendar) {
      return res.status(404).json({ message: 'Calendrier non trouvé' });
    }
    if (req.user.institute && calendar.institut !== req.user.institute) {
      return res.status(404).json({ message: 'Calendrier non trouvé' });
    }

    const body = { ...req.body };
    if (req.user.institute) body.institut = req.user.institute;
    Object.assign(calendar, body);
    await calendar.save();
    await calendar.populate('course_id', 'title');

    res.json(calendar);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Supprimer un calendrier (admin uniquement)
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const calendar = await EvaluationCalendar.findById(req.params.id);

    if (!calendar) {
      return res.status(404).json({ message: 'Calendrier non trouvé' });
    }
    if (req.user.institute && calendar.institut !== req.user.institute) {
      return res.status(404).json({ message: 'Calendrier non trouvé' });
    }

    await calendar.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;

