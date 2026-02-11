import express from 'express';
import Filiere from '../models/Filiere.js';

const router = express.Router();

/**
 * Liste publique des filières (pour formulaires inscription, cours, etc.).
 * GET /api/filieres?institute=DGI (optionnel : filtrer par institut)
 */
router.get('/', async (req, res) => {
  try {
    const { institute } = req.query;
    const query = typeof institute === 'string' && ['DGI', 'ISSJ', 'ISEG'].includes(institute)
      ? { institut: institute }
      : {};
    const list = await Filiere.find(query).sort({ institut: 1, order: 1, name: 1 }).lean();
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;
