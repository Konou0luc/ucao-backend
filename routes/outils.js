import express from 'express';
import Outil from '../models/Outil.js';
import { authenticate, isAdmin, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Liste (auth optionnelle pour scope institut admin)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { limit: limitParam, page: pageParam } = req.query;
    const query = {};
    if (req.user?.institute) query.institut = { $in: [req.user.institute, null] };
    const limit = limitParam != null ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 0;
    const page = pageParam != null ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;
    if (limit > 0) {
      const [outils, total] = await Promise.all([
        Outil.find(query).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit),
        Outil.countDocuments(query)
      ]);
      return res.json({ data: outils, total });
    }
    const outils = await Outil.find(query).sort({ order: 1, createdAt: -1 });
    res.json(outils);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// CRUD admin
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const body = { ...req.body };
    if (req.user.institute) body.institut = body.institut ?? req.user.institute;
    const outil = new Outil(body);
    await outil.save();
    res.status(201).json(outil);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const outil = await Outil.findById(req.params.id);
    if (!outil) return res.status(404).json({ message: 'Outil non trouvé' });
    if (req.user.institute && outil.institut !== req.user.institute) {
      return res.status(404).json({ message: 'Outil non trouvé' });
    }
    Object.assign(outil, req.body);
    if (req.user.institute) outil.institut = outil.institut ?? req.user.institute;
    await outil.save();
    res.json(outil);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const outil = await Outil.findById(req.params.id);
    if (!outil) return res.status(404).json({ message: 'Outil non trouvé' });
    if (req.user.institute && outil.institut !== req.user.institute) {
      return res.status(404).json({ message: 'Outil non trouvé' });
    }
    await outil.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;
