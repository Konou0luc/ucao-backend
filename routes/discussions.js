import express from 'express';
import Discussion from '../models/Discussion.js';
import DiscussionReply from '../models/DiscussionReply.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Obtenir toutes les discussions
router.get('/', async (req, res) => {
  try {
    const { course_id, search } = req.query;
    const query = {};

    if (course_id) query.course_id = course_id;
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(term, 'i');
      query.$or = [
        { title: regex },
        { content: regex }
      ];
    }

    const discussions = await Discussion.find(query)
      .populate('user_id', 'name email')
      .populate('course_id', 'title')
      .sort({ is_pinned: -1, createdAt: -1 })
      .lean();

    // Ajouter les réponses pour chaque discussion
    const discussionsWithReplies = await Promise.all(
      discussions.map(async (discussion) => {
        const replies = await DiscussionReply.find({ discussion_id: discussion._id })
          .populate('user_id', 'name email')
          .sort({ createdAt: 1 })
          .lean();
        return {
          ...discussion,
          replies: replies || []
        };
      })
    );

    res.json(discussionsWithReplies);
  } catch (error) {
    console.error('GET /discussions error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Obtenir une discussion spécifique
router.get('/:id', async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id)
      .populate('user_id', 'name email')
      .populate('course_id', 'title');

    if (!discussion) {
      return res.status(404).json({ message: 'Discussion non trouvée' });
    }

    const replies = await DiscussionReply.find({ discussion_id: discussion._id })
      .populate('user_id', 'name email role')
      .sort({ createdAt: 1 });

    const repliesWithRole = replies.map((r) => {
      const obj = r.toObject();
      obj.is_instructor = obj.user_id?.role === 'formateur' || obj.user_id?.role === 'admin';
      return obj;
    });

    res.json({
      ...discussion.toObject(),
      replies: repliesWithRole
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Créer une discussion (authentifié)
router.post('/', authenticate, async (req, res) => {
  try {
    const discussion = new Discussion({
      ...req.body,
      user_id: req.user._id
    });

    await discussion.save();
    await discussion.populate('user_id', 'name email');
    await discussion.populate('course_id', 'title');

    res.status(201).json(discussion);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Mettre à jour une discussion
router.put('/:id', authenticate, async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);

    if (!discussion) {
      return res.status(404).json({ message: 'Discussion non trouvée' });
    }

    // Vérifier les permissions
    if (req.user.role !== 'admin' && discussion.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    Object.assign(discussion, req.body);
    await discussion.save();
    await discussion.populate('user_id', 'name email');
    await discussion.populate('course_id', 'title');

    res.json(discussion);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Supprimer une discussion
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);

    if (!discussion) {
      return res.status(404).json({ message: 'Discussion non trouvée' });
    }

    // Vérifier les permissions
    if (req.user.role !== 'admin' && discussion.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    // Supprimer aussi les réponses
    await DiscussionReply.deleteMany({ discussion_id: discussion._id });
    await discussion.deleteOne();

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Ajouter une réponse à une discussion
router.post('/:id/replies', authenticate, async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);

    if (!discussion) {
      return res.status(404).json({ message: 'Discussion non trouvée' });
    }

    const reply = new DiscussionReply({
      discussion_id: discussion._id,
      user_id: req.user._id,
      content: req.body.content
    });

    await reply.save();
    await reply.populate('user_id', 'name email role');

    const obj = reply.toObject();
    obj.is_instructor = obj.user_id?.role === 'formateur' || obj.user_id?.role === 'admin';
    res.status(201).json(obj);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;

