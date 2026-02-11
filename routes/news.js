import express from 'express';
import News from '../models/News.js';
import { authenticate, isAdmin, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Obtenir toutes les actualités (scopé au tenant si user connecté ou param institut ; admin voit tous les statuts)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { status, institut, limit: limitParam, page: pageParam } = req.query;
    const query = {};

    // Filtrage par institut :
    // - si un institut précis est demandé en query, on l'utilise tel quel
    // - sinon, pour un utilisateur rattaché à un institut (étudiant / formateur / admin institut),
    //   on affiche les actus de son institut **et** les actus globales (institut null)
    if (institut && ['DGI', 'ISSJ', 'ISEG'].includes(institut)) {
      query.institut = institut;
    } else if (req.user?.institute) {
      query.$or = [
        { institut: req.user.institute },
        { institut: null }
      ];
    }

    // Filtrage par statut :
    // - côté étudiant / formateur → uniquement les actus publiées
    // - côté admin → peut filtrer sur draft/published ou voir tout par défaut
    if (!req.user || req.user.role !== 'admin') {
      query.status = 'published';
    } else if (status && (status === 'draft' || status === 'published')) {
      query.status = status;
    }

    const limit = limitParam != null ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 0;
    const page = pageParam != null ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;

    if (limit > 0) {
      const [news, total] = await Promise.all([
        News.find(query).populate('created_by', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit),
        News.countDocuments(query)
      ]);
      return res.json({ data: news, total });
    }
    const news = await News.find(query)
      .populate('created_by', 'name email')
      .sort({ createdAt: -1 });
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Obtenir une actualité spécifique (auth optionnelle pour permettre à l'admin de charger un brouillon)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const news = await News.findById(req.params.id)
      .populate('created_by', 'name email');

    if (!news) {
      return res.status(404).json({ message: 'Actualité non trouvée' });
    }

    if (news.institut && req.user && req.user.role !== 'admin' && req.user.institute !== news.institut) {
      return res.status(404).json({ message: 'Actualité non trouvée' });
    }

    // Vérifier si l'utilisateur peut voir cette actualité (admin peut voir brouillons)
    if (news.status !== 'published' && (!req.user || req.user.role !== 'admin')) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    res.json(news);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Créer une actualité (admin uniquement)
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const body = { ...req.body, created_by: req.user._id };
    if (req.user.institute) body.institut = body.institut ?? req.user.institute;
    const news = new News(body);

    await news.save();
    await news.populate('created_by', 'name email');

    res.status(201).json(news);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Mettre à jour une actualité (admin uniquement)
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);

    if (!news) {
      return res.status(404).json({ message: 'Actualité non trouvée' });
    }
    if (req.user.institute && news.institut !== req.user.institute) {
      return res.status(404).json({ message: 'Actualité non trouvée' });
    }

    const body = { ...req.body };
    if (req.user.institute) body.institut = req.user.institute;
    Object.assign(news, body);
    await news.save();
    await news.populate('created_by', 'name email');

    res.json(news);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Supprimer une actualité (admin uniquement)
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);

    if (!news) {
      return res.status(404).json({ message: 'Actualité non trouvée' });
    }
    if (req.user.institute && news.institut !== req.user.institute) {
      return res.status(404).json({ message: 'Actualité non trouvée' });
    }

    await news.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;

