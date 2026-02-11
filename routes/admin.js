import express from 'express';
import Course from '../models/Course.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import InstructorAssignment from '../models/InstructorAssignment.js';
import Settings from '../models/Settings.js';
import Filiere from '../models/Filiere.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { setTenant } from '../middleware/tenant.js';
import { sendStudentIdentityConfirmed } from '../services/email.js';

const router = express.Router();

// Toutes les routes admin nécessitent l'authentification et le rôle admin
router.use(authenticate);
router.use(isAdmin);
router.use(setTenant);

const tenantUserQuery = (req) => (req.tenant ? { institute: req.tenant } : {});
const tenantCourseQuery = (req) => (req.tenant ? { institut: req.tenant } : {});
const tenantCategoryQuery = (req) => (req.tenant ? { $or: [{ institut: req.tenant }, { institut: null }] } : {});

/** Super-admin : admin sans institut ; seul à créer les admins d'institut et modifier les paramètres globaux */
const isSuperAdmin = (req) => req.user?.role === 'admin' && (req.user?.institute == null || req.user?.institute === '');

// Statistiques dashboard (scopées au tenant)
router.get('/stats', async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const uq = tenantUserQuery(req);
    const cq = tenantCourseQuery(req);
    const catq = tenantCategoryQuery(req);

    const [totalStudents, newStudentsThisMonth, totalFormateurs, totalFormations, recentCourses, categoriesList] = await Promise.all([
      User.countDocuments({ role: 'etudiant', ...uq }),
      User.countDocuments({ role: 'etudiant', createdAt: { $gte: startOfMonth }, ...uq }),
      User.countDocuments({ role: 'formateur', ...uq }),
      Course.countDocuments(cq),
      Course.find(cq).sort({ createdAt: -1 }).limit(6).populate('created_by', 'name email').lean(),
      Category.find(catq).sort({ order: 1, name: 1 }).lean(),
    ]);

    const categoriesWithCount = await Promise.all(
      categoriesList.map(async (cat) => {
        const courseCount = await Course.countDocuments({ category: cat.name, ...cq });
        return { name: cat.name, _id: cat._id, courseCount };
      })
    );

    res.json({
      totalStudents,
      newStudentsThisMonth,
      totalFormateurs,
      totalFormations,
      recentCourses: recentCourses.map((c) => ({
        _id: c._id,
        id: c._id?.toString(),
        title: c.title,
        category: c.category,
        created_by: c.created_by ? { name: c.created_by.name, email: c.created_by.email } : null,
      })),
      categories: categoriesWithCount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Routes pour les cours (admin, scopées au tenant)
router.get('/courses', async (req, res) => {
  try {
    const { search, institut, semester, academic_year, limit: limitParam, page: pageParam } = req.query;
    const query = { ...tenantCourseQuery(req) };
    if (institut && ['DGI', 'ISSJ', 'ISEG'].includes(institut)) {
      if (req.tenant && institut !== req.tenant) return res.status(403).json({ message: 'Institut non autorisé' });
      query.institut = institut;
    }
    if (semester === 'mousson' || semester === 'harmattan') query.semester = semester;
    if (academic_year != null && academic_year !== '') {
      const y = parseInt(academic_year, 10);
      if (!Number.isNaN(y)) query.academic_year = y;
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
    const limit = limitParam != null ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 0;
    const page = pageParam != null ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;
    if (limit > 0) {
      const [courses, total] = await Promise.all([
        Course.find(query).populate('created_by', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit),
        Course.countDocuments(query)
      ]);
      return res.json({ data: courses, total });
    }
    const courses = await Course.find(query)
      .populate('created_by', 'name email')
      .sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Routes pour les utilisateurs (admin, scopées au tenant)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role, phone, address, institute } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nom, email et mot de passe sont requis' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    const validRole = role && ['admin', 'formateur', 'etudiant'].includes(role) ? role : 'formateur';

    // Seul le super-admin peut créer un compte admin ; l'institut est obligatoire pour un admin
    if (validRole === 'admin') {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Seul le super-admin peut créer un administrateur d\'institut.' });
      }
      if (!institute || !['DGI', 'ISSJ', 'ISEG'].includes(institute)) {
        return res.status(400).json({ message: 'L\'institut est requis pour un administrateur (DGI, ISSJ ou ISEG).' });
      }
    }

    const emailNorm = (email || '').toLowerCase().trim();
    const existingUser = await User.findOne({ email: emailNorm });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    const user = new User({
      name: (name || '').trim(),
      email: emailNorm,
      password,
      role: validRole,
      phone: phone || null,
      address: address || null,
      institute: validRole === 'admin' ? institute : (institute && ['DGI', 'ISSJ', 'ISEG'].includes(institute) ? institute : (req.tenant || null))
    });
    if (req.tenant && user.role !== 'admin' && user.institute !== req.tenant) {
      user.institute = req.tenant;
    }
    await user.save();
    const out = await User.findById(user._id).select('-password').lean();
    res.status(201).json(out);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { search, role, limit: limitParam, page: pageParam } = req.query;
    const query = { ...tenantUserQuery(req) };
    if (role && ['admin', 'formateur', 'etudiant'].includes(role)) {
      query.role = role;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(term, 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { student_number: regex }
      ];
    }
    const limit = limitParam != null ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 0;
    const page = pageParam != null ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;

    if (limit > 0) {
      const [users, total] = await Promise.all([
        User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments(query)
      ]);
      return res.json({ data: users, total });
    }
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (req.tenant && user.institute !== req.tenant) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (req.tenant && user.institute !== req.tenant) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const { password, semester, academic_year, role, institute, ...rest } = req.body;
    const updateData = { ...rest };
    if (role !== undefined) updateData.role = role;
    if (institute !== undefined) updateData.institute = institute;

    // Seul le super-admin peut modifier un admin (rôle ou institut) ; un admin doit toujours avoir un institut
    if (user.role === 'admin' || updateData.role === 'admin') {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Seul le super-admin peut modifier un administrateur.' });
      }
      if (updateData.role === 'admin' && (updateData.institute == null || updateData.institute === '')) {
        return res.status(400).json({ message: 'Un administrateur d\'institut doit avoir un institut (DGI, ISSJ ou ISEG).' });
      }
      if (user.role === 'admin' && updateData.institute != null && !['DGI', 'ISSJ', 'ISEG'].includes(updateData.institute)) {
        return res.status(400).json({ message: 'Institut invalide pour un administrateur.' });
      }
    }
    Object.assign(user, updateData);
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
      address: user.address ?? null,
      identity_verified: user.identity_verified
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Confirmer l'identité d'un étudiant (super-admin ou admin de l'institut)
router.put('/users/:id/verify-identity', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (req.tenant && user.institute !== req.tenant) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.role !== 'etudiant') {
      return res.status(400).json({ message: 'Seuls les comptes étudiants peuvent être vérifiés.' });
    }
    if (user.identity_verified) {
      return res.status(400).json({ message: 'L\'identité de cet étudiant est déjà confirmée.' });
    }
    user.identity_verified = true;
    await user.save();
    sendStudentIdentityConfirmed(user.email, user.name).catch(() => {});
    res.json({
      id: user._id,
      identity_verified: true,
      message: 'Identité confirmée. Un email a été envoyé à l\'étudiant.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// --- Paramètres plateforme (semestre et année en cours) ---
router.get('/settings', async (req, res) => {
  try {
    let doc = await Settings.findOne().lean();
    if (!doc) {
      const year = new Date().getFullYear();
      doc = await Settings.create({ current_semester: 'harmattan', current_academic_year: year });
      doc = doc.toObject();
    }
    res.json({
      current_semester: doc.current_semester ?? 'harmattan',
      current_academic_year: doc.current_academic_year ?? new Date().getFullYear(),
      max_upload_size_mb: doc.max_upload_size_mb ?? 50
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ message: 'Seul le super-admin peut modifier les paramètres globaux.' });
    }
    const { current_semester, current_academic_year, max_upload_size_mb } = req.body;
    let doc = await Settings.findOne();
    if (!doc) {
      const year = new Date().getFullYear();
      doc = await Settings.create({ current_semester: 'harmattan', current_academic_year: year });
    }
    if (current_semester === 'mousson' || current_semester === 'harmattan') doc.current_semester = current_semester;
    if (current_academic_year != null && current_academic_year !== '') {
      const y = parseInt(current_academic_year, 10);
      if (!Number.isNaN(y)) doc.current_academic_year = y;
    }
    if (max_upload_size_mb != null && max_upload_size_mb !== '') {
      const mb = parseInt(max_upload_size_mb, 10);
      if (!Number.isNaN(mb) && mb >= 1 && mb <= 500) doc.max_upload_size_mb = mb;
    }
    await doc.save();
    res.json({
      current_semester: doc.current_semester,
      current_academic_year: doc.current_academic_year,
      max_upload_size_mb: doc.max_upload_size_mb ?? 50
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.role === 'admin') {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Seul le super-admin peut supprimer un administrateur.' });
      }
    } else if (req.tenant && user.institute !== req.tenant) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    await user.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// --- Catégories (admin, scopées au tenant) ---
router.get('/categories', async (req, res) => {
  try {
    const { search, limit: limitParam, page: pageParam } = req.query;
    const ands = [tenantCategoryQuery(req)];
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(term, 'i');
      ands.push({ $or: [{ name: regex }, { description: regex }] });
    }
    const query = ands.length > 1 ? { $and: ands } : ands[0];
    const limit = limitParam != null ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 0;
    const page = pageParam != null ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;
    if (limit > 0) {
      const [list, total] = await Promise.all([
        Category.find(query).sort({ order: 1, name: 1 }).skip(skip).limit(limit),
        Category.countDocuments(query)
      ]);
      return res.json({ data: list, total });
    }
    const list = await Category.find(query).sort({ order: 1, name: 1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/categories/:id', async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    if (req.tenant && cat.institut != null && cat.institut !== req.tenant) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    res.json(cat);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const body = { ...req.body };
    if (req.tenant) body.institut = req.tenant;
    const category = new Category(body);
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà.' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    if (req.tenant && category.institut != null && category.institut !== req.tenant) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    const body = { ...req.body };
    if (req.tenant) body.institut = req.tenant;
    Object.assign(category, body);
    await category.save();
    res.json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà.' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    if (req.tenant && category.institut != null && category.institut !== req.tenant) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    await category.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// --- Filières (admin, scopées au tenant) ---
const tenantFiliereQuery = (req) => (req.tenant ? { institut: req.tenant } : {});

router.get('/filieres', async (req, res) => {
  try {
    const { institute, search, limit: limitParam, page: pageParam } = req.query;
    const query = { ...tenantFiliereQuery(req) };
    if (typeof institute === 'string' && ['DGI', 'ISSJ', 'ISEG'].includes(institute)) {
      query.institut = institute;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.name = new RegExp(term, 'i');
    }
    const limit = limitParam != null ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 0;
    const page = pageParam != null ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;
    if (limit > 0) {
      const [list, total] = await Promise.all([
        Filiere.find(query).sort({ institut: 1, order: 1, name: 1 }).skip(skip).limit(limit).lean(),
        Filiere.countDocuments(query)
      ]);
      return res.json({ data: list, total });
    }
    const list = await Filiere.find(query).sort({ institut: 1, order: 1, name: 1 }).lean();
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/filieres/:id', async (req, res) => {
  try {
    const doc = await Filiere.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Filière non trouvée' });
    if (req.tenant && doc.institut !== req.tenant) {
      return res.status(404).json({ message: 'Filière non trouvée' });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.post('/filieres', async (req, res) => {
  try {
    const body = { ...req.body };
    if (req.tenant) body.institut = req.tenant;
    if (!body.institut || !['DGI', 'ISSJ', 'ISEG'].includes(body.institut)) {
      return res.status(400).json({ message: 'Institut invalide (DGI, ISSJ ou ISEG).' });
    }
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return res.status(400).json({ message: 'Le nom de la filière est requis.' });
    }
    const filiere = new Filiere({
      institut: body.institut,
      name: body.name.trim(),
      order: body.order != null ? Number(body.order) : 0
    });
    await filiere.save();
    res.status(201).json(filiere);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Une filière avec ce nom existe déjà pour cet institut.' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/filieres/:id', async (req, res) => {
  try {
    const filiere = await Filiere.findById(req.params.id);
    if (!filiere) return res.status(404).json({ message: 'Filière non trouvée' });
    if (req.tenant && filiere.institut !== req.tenant) {
      return res.status(404).json({ message: 'Filière non trouvée' });
    }
    const body = { ...req.body };
    if (req.tenant) body.institut = req.tenant;
    if (body.name != null) filiere.name = String(body.name).trim();
    if (body.order != null) filiere.order = Number(body.order);
    await filiere.save();
    res.json(filiere);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Une filière avec ce nom existe déjà pour cet institut.' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/filieres/:id', async (req, res) => {
  try {
    const filiere = await Filiere.findById(req.params.id);
    if (!filiere) return res.status(404).json({ message: 'Filière non trouvée' });
    if (req.tenant && filiere.institut !== req.tenant) {
      return res.status(404).json({ message: 'Filière non trouvée' });
    }
    await filiere.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// --- Affectations formateur ↔ semestre/année/institut/cours ---
router.get('/instructor-assignments', async (req, res) => {
  try {
    const { institut, semester, academic_year, user_id, limit: limitParam, page: pageParam } = req.query;
    const query = {};
    if (req.tenant) query.institut = req.tenant;
    if (institut && ['DGI', 'ISSJ', 'ISEG'].includes(institut)) {
      if (req.tenant && institut !== req.tenant) return res.status(403).json({ message: 'Institut non autorisé' });
      query.institut = institut;
    }
    if (semester === 'mousson' || semester === 'harmattan') query.semester = semester;
    if (academic_year != null && academic_year !== '') {
      const y = parseInt(academic_year, 10);
      if (!Number.isNaN(y)) query.academic_year = y;
    }
    if (user_id) query.user_id = user_id;
    const limit = limitParam != null ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 0;
    const page = pageParam != null ? Math.max(parseInt(pageParam, 10) || 1, 1) : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;
    if (limit > 0) {
      const [list, total] = await Promise.all([
        InstructorAssignment.find(query)
          .populate('user_id', 'name email')
          .populate('course_id', 'title filiere niveau')
          .sort({ academic_year: -1, semester: 1, institut: 1 })
          .skip(skip)
          .limit(limit),
        InstructorAssignment.countDocuments(query)
      ]);
      return res.json({ data: list, total });
    }
    const list = await InstructorAssignment.find(query)
      .populate('user_id', 'name email')
      .populate('course_id', 'title filiere niveau')
      .sort({ academic_year: -1, semester: 1, institut: 1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.post('/instructor-assignments', async (req, res) => {
  try {
    const { user_id, institut, semester, academic_year, course_id } = req.body;
    if (!user_id || !institut || !semester || !academic_year || !course_id) {
      return res.status(400).json({ message: 'user_id, institut, semester, academic_year et course_id requis' });
    }
    if (!['DGI', 'ISSJ', 'ISEG'].includes(institut)) {
      return res.status(400).json({ message: 'institut invalide' });
    }
    if (!['mousson', 'harmattan'].includes(semester)) {
      return res.status(400).json({ message: 'semester invalide' });
    }
    if (req.tenant && institut !== req.tenant) {
      return res.status(403).json({ message: 'Institut non autorisé' });
    }
    const assignment = new InstructorAssignment({ user_id, institut, semester, academic_year, course_id });
    await assignment.save();
    await assignment.populate('user_id', 'name email');
    await assignment.populate('course_id', 'title filiere niveau');
    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/instructor-assignments/:id', async (req, res) => {
  try {
    const assignment = await InstructorAssignment.findById(req.params.id)
      .populate('user_id', 'name email')
      .populate('course_id', 'title filiere niveau');
    if (!assignment) return res.status(404).json({ message: 'Affectation non trouvée' });
    if (req.tenant && assignment.institut !== req.tenant) return res.status(404).json({ message: 'Affectation non trouvée' });
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/instructor-assignments/:id', async (req, res) => {
  try {
    const assignment = await InstructorAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Affectation non trouvée' });
    if (req.tenant && assignment.institut !== req.tenant) return res.status(404).json({ message: 'Affectation non trouvée' });
    const { user_id, institut, semester, academic_year, course_id } = req.body;
    if (institut && req.tenant && institut !== req.tenant) return res.status(403).json({ message: 'Institut non autorisé' });
    if (user_id != null) assignment.user_id = user_id;
    if (institut != null) assignment.institut = institut;
    if (semester != null) assignment.semester = semester;
    if (academic_year != null) assignment.academic_year = academic_year;
    if (course_id != null) assignment.course_id = course_id;
    await assignment.save();
    await assignment.populate('user_id', 'name email');
    await assignment.populate('course_id', 'title filiere niveau');
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/instructor-assignments/:id', async (req, res) => {
  try {
    const assignment = await InstructorAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Affectation non trouvée' });
    if (req.tenant && assignment.institut !== req.tenant) return res.status(404).json({ message: 'Affectation non trouvée' });
    await assignment.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;

