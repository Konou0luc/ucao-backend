import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import InstructorAssignment from '../models/InstructorAssignment.js';
import { authenticate } from '../middleware/auth.js';
import { sendStudentAccountCreated, sendPasswordReset } from '../services/email.js';

const router = express.Router();

// Limiteur de taux pour les opérations sensibles d'auth (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requêtes par IP / fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  // En environnement proxy (Vercel), on fait confiance à trust proxy et on désactive
  // les validations strictes sur X-Forwarded-For / Forwarded pour éviter les erreurs.
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { message: 'Trop de tentatives, veuillez réessayer dans quelques minutes.' }
});

// Inscription
router.post('/register', authLimiter, [
  body('name').trim().notEmpty().withMessage('Le nom est requis'),
  body('email').isEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, filiere, niveau, student_number, institute } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    if (student_number) {
      const existingMatricule = await User.findOne({ student_number });
      if (existingMatricule) {
        return res.status(400).json({ message: 'Ce numéro matricule est déjà utilisé' });
      }
    }

    const isStudent = role === 'student' || !role || role === 'etudiant';
    const user = new User({
      name,
      email,
      password,
      role: role === 'student' ? 'etudiant' : (role || 'etudiant'),
      filiere: filiere || institute || null,
      niveau: niveau || null,
      student_number: student_number || null,
      institute: institute || null,
      identity_verified: isStudent ? false : true
    });

    await user.save();

    if (isStudent) {
      sendStudentAccountCreated(user.email, user.name).catch(() => {});
    }

    const payload = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        filiere: user.filiere,
        niveau: user.niveau,
        student_number: user.student_number,
        institute: user.institute,
        identity_verified: user.identity_verified
      }
    };

    if (isStudent && !user.identity_verified) {
      return res.status(201).json({
        ...payload,
        message: 'Compte créé. Un email vous a été envoyé. Vous pourrez vous connecter après confirmation de votre identité par l\'administration.'
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(201).json({ token, ...payload });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Mot de passe oublié : envoie un email avec lien de réinitialisation (ne révèle pas si l'email existe)
router.post('/forgot-password', authLimiter, [
  body('email').isEmail().withMessage('Email invalide'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const email = (req.body.email || '').toLowerCase().trim();
    const user = await User.findOne({ email });
    const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
    const message = 'Si un compte existe avec cet email, un lien de réinitialisation vous a été envoyé. Vérifiez votre boîte de réception.';
    if (!user) {
      return res.status(200).json({ message });
    }
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = token;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await user.save();
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    sendPasswordReset(user.email, user.name, resetUrl).catch((err) => console.error('[Email] sendPasswordReset:', err.message));
    return res.status(200).json({ message });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Réinitialisation du mot de passe (avec token reçu par email)
router.post('/reset-password', authLimiter, [
  body('token').notEmpty().withMessage('Token requis'),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { token, password } = req.body;
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });
    if (!user) {
      return res.status(400).json({ message: 'Lien invalide ou expiré. Veuillez refaire une demande de réinitialisation.' });
    }
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
    return res.status(200).json({ message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Connexion
router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Le mot de passe est requis'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET manquant dans .env');
      return res.status(500).json({ message: 'Erreur serveur', error: 'Configuration manquante (JWT_SECRET)' });
    }

    const { email, password } = req.body;
    const emailNorm = (email || '').toLowerCase().trim();

    // Trouver l'utilisateur
    const user = await User.findOne({ email: emailNorm });
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe (comparePassword peut lever si le hash en base est invalide)
    let isMatch = false;
    try {
      isMatch = await user.comparePassword(password);
    } catch (err) {
      console.error('Erreur comparePassword:', err);
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    if (user.role === 'etudiant' && !user.identity_verified) {
      return res.status(403).json({
        message: 'Votre compte est en attente de vérification par l\'administration de votre institut. Vous recevrez un email dès que votre identité sera confirmée.'
      });
    }

    // Générer le token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        filiere: user.filiere,
        niveau: user.niveau,
        student_number: user.student_number,
        institute: user.institute,
        identity_verified: user.identity_verified
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Obtenir l'utilisateur actuel
router.get('/user', authenticate, async (req, res) => {
  res.json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    filiere: req.user.filiere,
    niveau: req.user.niveau,
    student_number: req.user.student_number,
    institute: req.user.institute,
    phone: req.user.phone ?? null,
    address: req.user.address ?? null,
    identity_verified: req.user.identity_verified
  });
});

// Mise à jour du profil (semestre et année sont gérés uniquement par l'admin)
router.put('/profile', authenticate, [
  body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide'),
  body('email').optional().isEmail().withMessage('Email invalide'),
  body('phone').optional().trim(),
  body('address').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), message: 'Données invalides' });
    }
    const { name, email, phone, address } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (name !== undefined) user.name = name;
    if (email !== undefined) {
      const existing = await User.findOne({ email, _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ message: 'Cet email est déjà utilisé' });
      }
      user.email = email.toLowerCase().trim();
    }
    if (phone !== undefined) user.phone = phone || null;
    if (address !== undefined) user.address = address || null;
    await user.save();
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      filiere: user.filiere,
      niveau: user.niveau,
      student_number: user.student_number,
      institute: user.institute,
      phone: user.phone ?? null,
      address: user.address ?? null
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Affectations du formateur connecté (institut, semestre, année, cours)
router.get('/assignments', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'formateur') {
      return res.json([]);
    }
    const list = await InstructorAssignment.find({ user_id: req.user._id })
      .populate('course_id', 'title')
      .sort({ academic_year: -1, semester: 1, institut: 1 })
      .lean();
    res.json(list.map((a) => ({
      _id: a._id,
      institut: a.institut,
      semester: a.semester,
      academic_year: a.academic_year,
      course_id: a.course_id?._id,
      course_title: a.course_id?.title ?? '—'
    })));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;

