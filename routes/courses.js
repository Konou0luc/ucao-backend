import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Course from '../models/Course.js';
import InstructorAssignment from '../models/InstructorAssignment.js';
import Settings from '../models/Settings.js';
import { authenticate, optionalAuth, isAdmin, isAdminOrFormateur } from '../middleware/auth.js';

/** Vérifie si l'utilisateur peut modifier le cours (créateur, formateur affecté, ou admin de l'institut). */
async function canEditCourse(user, course) {
  if (!course) return false;
  if (user.role === 'admin') {
    if (user.institute && course.institut !== user.institute) return false;
    return true;
  }
  if (course.created_by?.toString() === user._id.toString()) return true;
  if (user.role === 'formateur') {
    const assigned = await InstructorAssignment.findOne({
      user_id: user._id,
      course_id: course._id,
      ...(user.institute ? { institut: user.institute } : {})
    });
    return !!assigned;
  }
  return false;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../uploads/courses');
const allowedMimes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'application/x-zip-compressed'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const courseId = req.params.id || 'temp';
    const dir = path.join(UPLOAD_DIR, courseId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = (file.originalname || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (allowedMimes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Type non autorisé. Autorisés: images, PDF, Word, Excel, ZIP.'));
};

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter });

// Mes cours (formateur: créés par lui ou affectés; admin: créés par lui)
router.get('/mine', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'formateur' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé aux formateurs' });
    }
    const { search } = req.query;
    let query;
    if (req.user.role === 'formateur') {
      const assignedIds = await InstructorAssignment.find({
        user_id: req.user._id,
        ...(req.user.institute ? { institut: req.user.institute } : {})
      }).distinct('course_id');
      query = { $or: [{ created_by: req.user._id }, { _id: { $in: assignedIds } }] };
      if (req.user.institute) query.institut = req.user.institute;
    } else {
      query = { created_by: req.user._id };
      if (req.user.institute) query.institut = req.user.institute;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(term, 'i');
      query = { $and: [query, { $or: [{ title: regex }, { category: regex }, { description: regex }] }] };
    }
    const courses = await Course.find(query)
      .populate('created_by', 'name email')
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Obtenir tous les cours (public avec filtres, scopé au tenant si user connecté)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { filiere, niveau, institution, institut, status, semester, academic_year, search } = req.query;
    const query = {};

    if (filiere) query.filiere = filiere;
    if (niveau) query.niveau = niveau;
    if (institution) query.institution = institution;
    if (institut && ['DGI', 'ISSJ', 'ISEG'].includes(institut)) query.institut = institut;
    if (semester === 'mousson' || semester === 'harmattan') query.semester = semester;
    if (academic_year != null && academic_year !== '') {
      const y = parseInt(academic_year, 10);
      if (!Number.isNaN(y)) query.academic_year = y;
    }
    // Si user connecté (étudiant/formateur), ne montrer que les cours de son institut
    if (req.user?.institute && !query.institut) query.institut = req.user.institute;

    // Par défaut, ne montrer que les cours publiés pour les non-admin
    if (!req.user || req.user.role !== 'admin') {
      query.status = 'published';
    } else if (status) {
      query.status = status;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(term, 'i');
      query.$or = [
        { title: regex },
        { category: regex },
        { description: regex }
      ];
    }

    const courses = await Course.find(query)
      .populate('created_by', 'name email')
      .sort({ createdAt: -1 });

    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Obtenir un cours spécifique
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('created_by', 'name email');

    if (!course) {
      return res.status(404).json({ message: 'Cours non trouvé' });
    }

    // Tenant: si le cours a un institut, l'utilisateur doit être du même tenant (sauf admin)
    if (course.institut && req.user && req.user.role !== 'admin' && req.user.institute !== course.institut) {
      return res.status(404).json({ message: 'Cours non trouvé' });
    }

    // Vérifier si l'utilisateur peut voir ce cours
    if (course.status !== 'published' && (!req.user || req.user.role !== 'admin')) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Créer un cours (admin ou formateur)
router.post('/', authenticate, isAdminOrFormateur, async (req, res) => {
  try {
    const body = { ...req.body, created_by: req.user._id };
    if (req.user.institute) body.institut = body.institut ?? req.user.institute;
    const course = new Course(body);

    await course.save();
    await course.populate('created_by', 'name email');

    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Mettre à jour un cours
router.put('/:id', authenticate, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Cours non trouvé' });
    }

    const allowed = await canEditCourse(req.user, course);
    if (!allowed) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { resources, ...body } = req.body;
    if (req.user.institute) body.institut = req.user.institute;
    Object.assign(course, body);
    await course.save();
    await course.populate('created_by', 'name email');

    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Ajouter une ressource (fichier/image/zip) à un cours — limite de taille depuis paramètres plateforme
router.post('/:id/resources', authenticate, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Cours non trouvé' });
    const allowed = await canEditCourse(req.user, course);
    if (!allowed) return res.status(403).json({ message: 'Accès refusé' });

    const settings = await Settings.findOne().lean();
    const maxMb = settings?.max_upload_size_mb ?? 50;
    const maxBytes = maxMb * 1024 * 1024;
    const uploadSingle = multer({ storage, limits: { fileSize: maxBytes }, fileFilter }).single('file');
    uploadSingle(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: `Fichier trop volumineux (max ${maxMb} Mo).` });
        }
        return res.status(400).json({ message: err.message || 'Erreur upload' });
      }
      next();
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
}, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Cours non trouvé' });
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier envoyé' });
    const url = `/uploads/courses/${req.params.id}/${req.file.filename}`;
    const type = (req.file.mimetype || '').startsWith('image/') ? 'image' : 'file';
    if (!course.resources) course.resources = [];
    course.resources.push({ name: req.file.originalname || req.file.filename, type, url });
    await course.save();
    const added = course.resources[course.resources.length - 1];
    res.status(201).json(added);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Supprimer une ressource d'un cours
router.delete('/:id/resources/:resourceId', authenticate, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Cours non trouvé' });
    const allowed = await canEditCourse(req.user, course);
    if (!allowed) return res.status(403).json({ message: 'Accès refusé' });
    const resource = course.resources?.id(req.params.resourceId);
    if (!resource) return res.status(404).json({ message: 'Ressource non trouvée' });
    const fullPath = path.join(__dirname, '..', resource.url);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    resource.deleteOne();
    await course.save();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Supprimer un cours
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Cours non trouvé' });
    }

    // Vérifier les permissions
    if (req.user.role !== 'admin' && course.created_by.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    if (req.user.role === 'admin' && req.user.institute && course.institut !== req.user.institute) {
      return res.status(404).json({ message: 'Cours non trouvé' });
    }

    await course.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;

