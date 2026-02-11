import express from 'express';
import Guide from '../models/Guide.js';
import { authenticate, isAdmin, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Liste : publiés pour tous ; tous pour admin (auth optionnelle)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { limit: limitParam, page: pageParam } = req.query;
    const query = {};
    if (!req.user || req.user.role !== 'admin') query.status = 'published';
    if (req.user?.institute && req.user.role !== 'admin') query.institut = { $in: [req.user.institute, null] };
    if (req.user?.role === 'admin' && req.user.institute) query.institut = { $in: [req.user.institute, null] };
    const limit = limitParam != null ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 0;
    const page = pageParam != null ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;
    if (limit > 0) {
      const [guides, total] = await Promise.all([
        Guide.find(query).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit),
        Guide.countDocuments(query)
      ]);
      return res.json({ data: guides, total });
    }
    const guides = await Guide.find(query).sort({ order: 1, createdAt: -1 });
    res.json(guides);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Détail public
router.get('/:id', async (req, res) => {
  try {
    const guide = await Guide.findById(req.params.id);
    if (!guide) return res.status(404).json({ message: 'Guide non trouvé' });
    if (guide.status !== 'published' && (!req.user || req.user.role !== 'admin')) {
      return res.status(404).json({ message: 'Guide non trouvé' });
    }
    if (guide.institut && req.user && req.user.role !== 'admin' && req.user.institute !== guide.institut) {
      return res.status(404).json({ message: 'Guide non trouvé' });
    }
    res.json(guide);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// CRUD admin
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const body = { ...req.body };
    if (req.user.institute) body.institut = body.institut ?? req.user.institute;
    const guide = new Guide(body);
    await guide.save();
    res.status(201).json(guide);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const guide = await Guide.findById(req.params.id);
    if (!guide) return res.status(404).json({ message: 'Guide non trouvé' });
    if (req.user.institute && guide.institut !== req.user.institute) {
      return res.status(404).json({ message: 'Guide non trouvé' });
    }
    Object.assign(guide, req.body);
    if (req.user.institute) guide.institut = guide.institut ?? req.user.institute;
    await guide.save();
    res.json(guide);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const guide = await Guide.findById(req.params.id);
    if (!guide) return res.status(404).json({ message: 'Guide non trouvé' });
    if (req.user.institute && guide.institut !== req.user.institute) {
      return res.status(404).json({ message: 'Guide non trouvé' });
    }
    await guide.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;
