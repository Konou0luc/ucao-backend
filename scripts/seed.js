/**
 * Script de seed pour peupler la base MongoDB avec des données de test.
 * Usage: bun run seed  (ou node scripts/seed.js depuis backend-node)
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import des modèles après la config dotenv
import User from '../models/User.js';
import Course from '../models/Course.js';
import Category from '../models/Category.js';
import News from '../models/News.js';
import EvaluationCalendar from '../models/EvaluationCalendar.js';
import Timetable from '../models/Timetable.js';
import InstructorAssignment from '../models/InstructorAssignment.js';
import Settings from '../models/Settings.js';
import Filiere from '../models/Filiere.js';
import Discussion from '../models/Discussion.js';
import DiscussionReply from '../models/DiscussionReply.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/web-academy';

async function seed() {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
      console.error('❌ Seed annulé : environnement production sans ALLOW_SEED=true');
      process.exit(1);
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Nettoyer les collections (optionnel - commenter pour garder les données existantes)
    await User.deleteMany({});
    await Course.deleteMany({});
    await News.deleteMany({});
    await EvaluationCalendar.deleteMany({});
    await Timetable.deleteMany({});
    await InstructorAssignment.deleteMany({});
    await DiscussionReply.deleteMany({});
    await Discussion.deleteMany({});
    await Category.deleteMany({});
    await Filiere.deleteMany({});
    await Settings.deleteMany({});
    console.log('🗑️  Collections vidées');

    // --- Paramètres plateforme (semestre et année en cours) ---
    const seedYear = new Date().getFullYear();
    await Settings.create({ current_semester: 'harmattan', current_academic_year: seedYear });
    console.log('⚙️  Paramètres (semestre / année en cours) créés');

    // --- Catégories (scopées au tenant DGI pour la démo) ---
    await Category.insertMany([
      { name: 'Technologie', description: 'Informatique, développement, réseaux', order: 1, institut: 'DGI' },
      { name: 'Gestion', description: 'Management, finance, comptabilité', order: 2, institut: 'DGI' },
      { name: 'Business', description: 'Entrepreneuriat, marketing', order: 3, institut: 'DGI' },
      { name: 'Développement web', description: 'Front-end, back-end, fullstack', order: 4, institut: 'DGI' },
      { name: 'Sciences', description: 'Mathématiques, physique, chimie', order: 5, institut: 'DGI' },
    ]);
    console.log('📁 Catégories créées');

    // --- Filières par institut ---
    await Filiere.insertMany([
      { institut: 'DGI', name: "Développement d'application (DA)", order: 1 },
      { institut: 'DGI', name: 'Mathématique-Informatique (MI)', order: 2 },
      { institut: 'DGI', name: 'Réseaux et télécommunication (RIT)', order: 3 },
      { institut: 'ISSJ', name: 'Droit privé', order: 1 },
      { institut: 'ISSJ', name: 'Droit public', order: 2 },
      { institut: 'ISEG', name: 'Economie Appliquée', order: 1 },
      { institut: 'ISEG', name: 'Finance Contrôle Comptabilité (FCC)', order: 2 },
      { institut: 'ISEG', name: 'Communication et Marketing Digital (CMD)', order: 3 },
      { institut: 'ISEG', name: 'Ressources Humaines (RH)', order: 4 },
    ]);
    console.log('📂 Filières créées');

    // --- Utilisateurs ---
    // Super-admin : pas d'institut, seul à créer les admins d'institut et modifier les paramètres globaux
    const superAdmin = await User.create({
      name: 'Super Administration UCAO-UUT',
      email: 'admin@ucao-uut.tg',
      password: 'admin123',
      role: 'admin',
      institute: null,
    });

    // Admins d'institut (optionnel, pour tests)
    await User.create([
      { name: 'Admin DGI', email: 'admin-dgi@ucao-uut.tg', password: 'admin123', role: 'admin', institute: 'DGI' },
      { name: 'Admin ISSJ', email: 'admin-issj@ucao-uut.tg', password: 'admin123', role: 'admin', institute: 'ISSJ' },
      { name: 'Admin ISEG', email: 'admin-iseg@ucao-uut.tg', password: 'admin123', role: 'admin', institute: 'ISEG' },
    ]);

    const formateur = await User.create({
      name: 'Dr. Jean Dupont',
      email: 'jean.dupont@ucao-uut.tg',
      password: 'formateur123',
      role: 'formateur',
      institute: 'DGI',
    });

    const etudiant1 = await User.create({
      name: 'Marie Kouassi',
      email: 'marie.kouassi@ucao-uut.tg',
      password: 'etudiant123',
      role: 'etudiant',
      student_number: '2024-001',
      institute: 'DGI',
      niveau: 'licence1',
      filiere: "Développement d'application (DA)",
    });

    const etudiant2 = await User.create({
      name: 'Jean Amevor',
      email: 'jean.amevor@ucao-uut.tg',
      password: 'etudiant123',
      role: 'etudiant',
      student_number: '2024-002',
      institute: 'DGI',
      niveau: 'licence2',
      filiere: "Développement d'application (DA)",
    });

    const etudiantL3DA = await User.create({
      name: 'Étudiant L3 DA',
      email: 'l3da@ucao-uut.tg',
      password: 'etudiant123',
      role: 'etudiant',
      student_number: '2024-003',
      institute: 'DGI',
      niveau: 'licence3',
      filiere: "Développement d'application (DA)",
    });

    // --- Formateurs DGI RIT (Licence 3 - emploi du temps semestre mousson) ---
    const filiereRIT = 'Réseaux et télécommunication (RIT)';
    const formateurRITPasswordHash = await bcrypt.hash('formateur123', 10);
    const [profTcheki, profLawson, profKodjo, profAliMizou, profAmelina, profTete] = await User.insertMany([
      { name: 'Dr TCHEKI', email: 'tcheki@ucao-uut.tg', password: formateurRITPasswordHash, role: 'formateur', institute: 'DGI' },
      { name: 'Mme LAWSON B.', email: 'lawson.b@ucao-uut.tg', password: formateurRITPasswordHash, role: 'formateur', institute: 'DGI' },
      { name: 'Prof KODJO', email: 'kodjo@ucao-uut.tg', password: formateurRITPasswordHash, role: 'formateur', institute: 'DGI' },
      { name: 'ALI MIZOU', email: 'ali.mizou@ucao-uut.tg', password: formateurRITPasswordHash, role: 'formateur', institute: 'DGI' },
      { name: 'M. AMELINA', email: 'amelina@ucao-uut.tg', password: formateurRITPasswordHash, role: 'formateur', institute: 'DGI' },
      { name: 'M. TETE', email: 'tete@ucao-uut.tg', password: formateurRITPasswordHash, role: 'formateur', institute: 'DGI' },
    ]);

    // Étudiant L3 RIT (pour voir l'emploi du temps)
    const etudiantL3RIT = await User.create({
      name: 'Étudiant L3 RIT',
      email: 'l3rit@ucao-uut.tg',
      password: 'etudiant123',
      role: 'etudiant',
      student_number: '2024-004',
      institute: 'DGI',
      niveau: 'licence3',
      filiere: filiereRIT,
      identity_verified: true,
    });

    console.log('👤 Utilisateurs créés (super-admin, 3 admins institut, formateurs dont 6 RIT, étudiants dont L3 DA et L3 RIT)');

    // --- Cours (scopés au tenant DGI, semestre + année) ---
    const courses = await Course.insertMany([
      {
        title: "Introduction à l'Informatique",
        category: 'Technologie',
        filiere: "Développement d'application (DA)",
        niveau: 'licence1',
        institution: 'UCAO-UUT',
        institut: 'DGI',
        semester: 'harmattan',
        academic_year: seedYear,
        description: "Cours fondamental sur les bases de l'informatique et de la programmation. Histoire des ordinateurs, systèmes d'exploitation, algorithmes et structures de données.",
        created_by: formateur._id,
        status: 'published',
      },
      {
        title: 'Algorithmes et Structures de Données',
        category: 'Technologie',
        filiere: "Développement d'application (DA)",
        niveau: 'licence1',
        institution: 'UCAO-UUT',
        institut: 'DGI',
        semester: 'harmattan',
        academic_year: seedYear,
        description: 'Apprentissage des algorithmes fondamentaux (tri, recherche) et des structures de données (listes, arbres, graphes).',
        created_by: formateur._id,
        status: 'published',
      },
      {
        title: 'Base de Données',
        category: 'Technologie',
        filiere: "Développement d'application (DA)",
        niveau: 'licence2',
        institution: 'UCAO-UUT',
        institut: 'DGI',
        semester: 'harmattan',
        academic_year: seedYear,
        description: 'Systèmes de gestion de bases de données relationnelles (SQL) et introduction au NoSQL.',
        created_by: formateur._id,
        status: 'published',
      },
      {
        title: 'Réseaux et Télécommunications',
        category: 'Technologie',
        filiere: "Développement d'application (DA)",
        niveau: 'licence2',
        institution: 'UCAO-UUT',
        institut: 'DGI',
        semester: 'harmattan',
        academic_year: seedYear,
        description: 'Architecture des réseaux, protocoles (TCP/IP), sécurité réseau et administration.',
        created_by: formateur._id,
        status: 'published',
      },
      {
        title: 'Gestion Financière',
        category: 'Gestion',
        filiere: 'Finance Contrôle Comptabilité (FCC)',
        niveau: 'licence1',
        institution: 'UCAO-UUT',
        institut: 'DGI',
        semester: 'harmattan',
        academic_year: seedYear,
        description: 'Principes de gestion financière et comptabilité pour les entreprises.',
        created_by: formateur._id,
        status: 'published',
      },
    ]);

    // --- Cours DGI RIT Licence 3 - Semestre 6 (mousson) ---
    const academicYearRIT = seedYear;
    const coursesRIT = await Course.insertMany([
      { title: 'Complément Anglais des TICs', category: 'Technologie', filiere: filiereRIT, niveau: 'licence3', institution: 'UCAO-UUT', institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, description: 'Anglais technique appliqué aux technologies de l\'information et de la communication. Vol. horaire : 22h.', created_by: profTcheki._id, status: 'published' },
      { title: 'Systèmes de transmission', category: 'Technologie', filiere: filiereRIT, niveau: 'licence3', institution: 'UCAO-UUT', institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, description: 'Systèmes de transmission pour les réseaux et télécommunications. Vol. horaire : 33h.', created_by: profLawson._id, status: 'published' },
      { title: 'Asservissement', category: 'Sciences', filiere: filiereRIT, niveau: 'licence3', institution: 'UCAO-UUT', institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, description: 'Asservissement et régulation. Parcours RIT. Vol. horaire : 33h.', created_by: profKodjo._id, status: 'published' },
      { title: 'Administration Système', category: 'Technologie', filiere: filiereRIT, niveau: 'licence3', institution: 'UCAO-UUT', institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, description: 'Administration des systèmes et serveurs. Vol. horaire : 33h.', created_by: profLawson._id, status: 'published' },
      { title: 'Projet Télécoms', category: 'Technologie', filiere: filiereRIT, niveau: 'licence3', institution: 'UCAO-UUT', institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, description: 'Projet en télécommunications. Vol. horaire : 22h.', created_by: profLawson._id, status: 'published' },
      { title: 'Initiation à la maintenance', category: 'Technologie', filiere: filiereRIT, niveau: 'licence3', institution: 'UCAO-UUT', institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, description: 'Initiation à la maintenance des équipements. Vol. horaire : 33h.', created_by: profAliMizou._id, status: 'published' },
      { title: 'Séminaire RIT', category: 'Technologie', filiere: filiereRIT, niveau: 'licence3', institution: 'UCAO-UUT', institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, description: 'Séminaire Réseaux Informatique et Télécommunications. Vol. horaire : 33h.', created_by: profAmelina._id, status: 'published' },
      { title: 'Projet Réseaux', category: 'Technologie', filiere: filiereRIT, niveau: 'licence3', institution: 'UCAO-UUT', institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, description: 'Projet en réseaux. Vol. horaire : 33h.', created_by: profTete._id, status: 'published' },
    ]);

    console.log(`📚 ${courses.length + coursesRIT.length} cours créés (dont ${coursesRIT.length} RIT L3 mousson)`);

    // --- Affectations formateur ↔ semestre/année/institut/cours ---
    await InstructorAssignment.insertMany([
      { user_id: formateur._id, institut: 'DGI', semester: 'harmattan', academic_year: seedYear, course_id: courses[0]._id },
      { user_id: formateur._id, institut: 'DGI', semester: 'harmattan', academic_year: seedYear, course_id: courses[1]._id },
      { user_id: formateur._id, institut: 'DGI', semester: 'harmattan', academic_year: seedYear, course_id: courses[2]._id },
      { user_id: formateur._id, institut: 'DGI', semester: 'harmattan', academic_year: seedYear, course_id: courses[3]._id },
      { user_id: formateur._id, institut: 'DGI', semester: 'harmattan', academic_year: seedYear, course_id: courses[4]._id },
      // RIT L3 mousson
      { user_id: profTcheki._id, institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, course_id: coursesRIT[0]._id },
      { user_id: profLawson._id, institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, course_id: coursesRIT[1]._id },
      { user_id: profKodjo._id, institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, course_id: coursesRIT[2]._id },
      { user_id: profLawson._id, institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, course_id: coursesRIT[3]._id },
      { user_id: profLawson._id, institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, course_id: coursesRIT[4]._id },
      { user_id: profAliMizou._id, institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, course_id: coursesRIT[5]._id },
      { user_id: profAmelina._id, institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, course_id: coursesRIT[6]._id },
      { user_id: profTete._id, institut: 'DGI', semester: 'mousson', academic_year: academicYearRIT, course_id: coursesRIT[7]._id },
    ]);
    console.log('👤 Affectations formateurs créées');

    // --- Actualités (scopées au tenant DGI) ---
    await News.insertMany([
      {
        title: "Inscription ouverte pour le semestre 2025",
        content: "Les inscriptions pour le semestre de printemps 2025 sont maintenant ouvertes. Tous les étudiants sont invités à s'inscrire avant le 15 février 2025.\n\n**Informations importantes :**\n- Date limite : 15 février 2025\n- Début des cours : 1er mars 2025\n- Documents requis : Carte d'étudiant, relevés de notes",
        image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800',
        created_by: superAdmin._id,
        status: 'published',
        institut: 'DGI',
      },
      {
        title: "Nouveau partenariat avec l'industrie",
        content: "L'UCAO-UUT annonce un nouveau partenariat stratégique avec plusieurs entreprises locales pour offrir des stages et opportunités d'emploi aux étudiants.",
        image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800',
        created_by: superAdmin._id,
        status: 'published',
        institut: 'DGI',
      },
      {
        title: 'Conférence sur l\'innovation technologique',
        content: 'Une grande conférence sur l\'innovation technologique se tiendra le 25 janvier 2025. Inscrivez-vous dès maintenant pour participer à cet événement exceptionnel.',
        image: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800',
        created_by: superAdmin._id,
        status: 'published',
        institut: 'DGI',
      },
      {
        title: 'Résultats des examens disponibles',
        content: 'Les résultats des examens du semestre précédent sont maintenant disponibles sur la plateforme. Connectez-vous pour consulter vos notes.',
        image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800',
        created_by: superAdmin._id,
        status: 'published',
        institut: 'DGI',
      },
    ]);

    console.log('📰 Actualités créées');

    // --- Calendrier d'évaluations (semestre + année universitaire) ---
    const now = new Date();
    await EvaluationCalendar.insertMany([
      {
        title: 'Examen Final - Introduction à l\'Informatique',
        description: 'Examen final du cours. Durée : 3 heures.',
        institut: 'DGI',
        filiere: "Développement d'application (DA)",
        niveau: 'licence1',
        evaluation_date: new Date(now.getFullYear(), now.getMonth() + 1, 15),
        start_time: '08:00',
        end_time: '11:00',
        location: 'Amphithéâtre A',
        type: 'examen',
        course_id: courses[0]._id,
        semester: 'harmattan',
        academic_year: seedYear,
      },
      {
        title: 'Contrôle Continu - Base de Données',
        description: 'Contrôle continu sur les bases de données relationnelles.',
        institut: 'DGI',
        filiere: "Développement d'application (DA)",
        niveau: 'licence2',
        evaluation_date: new Date(now.getFullYear(), now.getMonth() + 1, 10),
        start_time: '14:00',
        end_time: '16:00',
        location: 'Salle 201',
        type: 'controle',
        course_id: courses[2]._id,
        semester: 'harmattan',
        academic_year: seedYear,
      },
      {
        title: 'TP - Algorithmes',
        description: 'Travaux pratiques sur les algorithmes de tri et de recherche.',
        institut: 'DGI',
        filiere: "Développement d'application (DA)",
        niveau: 'licence1',
        evaluation_date: new Date(now.getFullYear(), now.getMonth() + 1, 5),
        start_time: '10:00',
        end_time: '12:00',
        location: 'Laboratoire Informatique',
        type: 'tp',
        course_id: courses[0]._id,
        semester: 'harmattan',
        academic_year: seedYear,
      },
      {
        title: 'Projet - Réseaux',
        description: 'Présentation des projets finaux.',
        institut: 'DGI',
        filiere: "Développement d'application (DA)",
        niveau: 'licence2',
        evaluation_date: new Date(now.getFullYear(), now.getMonth() + 1, 20),
        start_time: '09:00',
        end_time: '17:00',
        location: 'Salle de Conférence',
        type: 'projet',
        course_id: courses[3]._id,
        semester: 'harmattan',
        academic_year: seedYear,
      },
      // DGI / DA / Licence 3 (ex. calendrier examens Harmattan)
      {
        title: 'DROIT DES AFFAIRES L3',
        description: 'Examen Droit des affaires.',
        institut: 'DGI',
        filiere: "Développement d'application (DA)",
        niveau: 'licence3',
        evaluation_date: new Date(2026, 0, 22),
        start_time: '11:30',
        end_time: '13:30',
        location: 'Salle 1.4',
        type: 'examen',
        semester: 'harmattan',
        academic_year: seedYear,
      },
      {
        title: 'GÉNIE LOGICIEL L3 MIDA',
        description: 'Examen Génie logiciel.',
        institut: 'DGI',
        filiere: "Développement d'application (DA)",
        niveau: 'licence3',
        evaluation_date: new Date(2026, 0, 30),
        start_time: '08:00',
        end_time: '10:00',
        location: 'Salle 1.4',
        type: 'examen',
        semester: 'harmattan',
        academic_year: seedYear,
      },
      // DGI / RIT / Licence 3 / Semestre 6 (mousson)
      { title: 'Examen - Systèmes de transmission', description: 'Examen final.', institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', evaluation_date: new Date(2026, 4, 15), start_time: '08:00', end_time: '11:00', location: 'Salle 1.4', type: 'examen', course_id: coursesRIT[1]._id, semester: 'mousson', academic_year: academicYearRIT },
      { title: 'Examen - Asservissement', description: 'Examen final.', institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', evaluation_date: new Date(2026, 4, 16), start_time: '08:00', end_time: '11:00', location: 'Salle 1.4', type: 'examen', course_id: coursesRIT[2]._id, semester: 'mousson', academic_year: academicYearRIT },
      { title: 'Examen - Administration Système', description: 'Examen final.', institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', evaluation_date: new Date(2026, 4, 17), start_time: '14:00', end_time: '17:00', location: 'Salle 1.4', type: 'examen', course_id: coursesRIT[3]._id, semester: 'mousson', academic_year: academicYearRIT },
    ]);

    console.log('📅 Calendrier d\'évaluations créé');

    // --- Emplois du temps (semestre + année universitaire) ---
    await Timetable.insertMany([
      { institut: 'DGI', filiere: "Développement d'application (DA)", niveau: 'licence1', course_id: courses[0]._id, day_of_week: 'lundi', start_time: '08:00', end_time: '10:00', room: 'Amphithéâtre A', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      { institut: 'DGI', filiere: "Développement d'application (DA)", niveau: 'licence1', course_id: courses[0]._id, day_of_week: 'mercredi', start_time: '10:00', end_time: '12:00', room: 'Salle 101', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      { institut: 'DGI', filiere: "Développement d'application (DA)", niveau: 'licence1', course_id: courses[1]._id, day_of_week: 'mardi', start_time: '09:00', end_time: '12:00', room: 'Salle 102', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      { institut: 'DGI', filiere: "Développement d'application (DA)", niveau: 'licence2', course_id: courses[2]._id, day_of_week: 'mardi', start_time: '14:00', end_time: '17:00', room: 'Salle 201', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      { institut: 'DGI', filiere: "Développement d'application (DA)", niveau: 'licence2', course_id: courses[3]._id, day_of_week: 'jeudi', start_time: '08:00', end_time: '11:00', room: 'Labo Réseaux', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      { institut: 'DGI', filiere: 'Finance Contrôle Comptabilité (FCC)', niveau: 'licence1', course_id: courses[4]._id, day_of_week: 'vendredi', start_time: '09:00', end_time: '12:00', room: 'Salle 301', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      // DGI / DA (Développement d'Applications) / Licence 3
      { institut: 'DGI', filiere: "Développement d'application (DA)", niveau: 'licence3', course_id: courses[0]._id, day_of_week: 'lundi', start_time: '08:00', end_time: '09:30', room: 'Salle 1.4', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      { institut: 'DGI', filiere: "Développement d'application (DA)", niveau: 'licence3', course_id: courses[1]._id, day_of_week: 'mardi', start_time: '09:00', end_time: '12:30', room: 'Salle 1.4', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      { institut: 'DGI', filiere: "Développement d'application (DA)", niveau: 'licence3', course_id: courses[2]._id, day_of_week: 'mardi', start_time: '14:00', end_time: '16:00', room: 'Salle 1.4', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      { institut: 'DGI', filiere: "Développement d'application (DA)", niveau: 'licence3', course_id: courses[0]._id, day_of_week: 'mercredi', start_time: '10:00', end_time: '12:30', room: 'Salle 1.4', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      { institut: 'DGI', filiere: "Développement d'application (DA)", niveau: 'licence3', course_id: courses[3]._id, day_of_week: 'jeudi', start_time: '08:00', end_time: '12:00', room: 'Salle 1.4', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      { institut: 'DGI', filiere: "Développement d'application (DA)", niveau: 'licence3', course_id: courses[4]._id, day_of_week: 'vendredi', start_time: '08:00', end_time: '12:00', room: 'Salle 1.4', instructor: 'Dr. Jean Dupont', semester: 'harmattan', academic_year: seedYear },
      // DGI / RIT / Licence 3 / Semestre 6 (mousson) - Programme du 9 au 14 février
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[0]._id, day_of_week: 'lundi', start_time: '09:45', end_time: '11:45', room: 'Salle 1.4', instructor: 'Dr TCHEKI', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[1]._id, day_of_week: 'mardi', start_time: '08:30', end_time: '09:30', room: 'Salle 1.4', instructor: 'Mme LAWSON B.', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[1]._id, day_of_week: 'mardi', start_time: '09:45', end_time: '10:45', room: 'Salle 1.4', instructor: 'Mme LAWSON B.', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[6]._id, day_of_week: 'mardi', start_time: '13:45', end_time: '14:45', room: 'Salle 1.4', instructor: 'M. AMELINA', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[6]._id, day_of_week: 'mardi', start_time: '15:00', end_time: '16:00', room: 'Salle 1.4', instructor: 'M. AMELINA', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[2]._id, day_of_week: 'mercredi', start_time: '08:30', end_time: '09:30', room: 'Salle 1.4', instructor: 'Prof KODJO', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[2]._id, day_of_week: 'mercredi', start_time: '09:45', end_time: '10:45', room: 'Salle 1.4', instructor: 'Prof KODJO', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[7]._id, day_of_week: 'mercredi', start_time: '13:45', end_time: '14:45', room: 'Salle 1.4', instructor: 'M. TETE', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[7]._id, day_of_week: 'mercredi', start_time: '15:00', end_time: '16:00', room: 'Salle 1.4', instructor: 'M. TETE', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[3]._id, day_of_week: 'jeudi', start_time: '08:30', end_time: '09:30', room: 'Salle 1.4', instructor: 'Mme LAWSON B.', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[3]._id, day_of_week: 'jeudi', start_time: '09:45', end_time: '10:45', room: 'Salle 1.4', instructor: 'Mme LAWSON B.', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[4]._id, day_of_week: 'samedi', start_time: '07:30', end_time: '08:30', room: 'Salle 1.4', instructor: 'Mme LAWSON B.', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[4]._id, day_of_week: 'samedi', start_time: '08:30', end_time: '09:30', room: 'Salle 1.4', instructor: 'Mme LAWSON B.', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[5]._id, day_of_week: 'samedi', start_time: '09:45', end_time: '10:45', room: 'Salle 1.4', instructor: 'ALI MIZOU', semester: 'mousson', academic_year: academicYearRIT },
      { institut: 'DGI', filiere: filiereRIT, niveau: 'licence3', course_id: coursesRIT[5]._id, day_of_week: 'samedi', start_time: '10:45', end_time: '11:45', room: 'Salle 1.4', instructor: 'ALI MIZOU', semester: 'mousson', academic_year: academicYearRIT },
    ]);

    console.log('🕐 Emplois du temps créés (dont RIT L3 mousson)');

    // --- Discussions et réponses ---
    const disc1 = await Discussion.create({
      title: "Question sur les bases de données",
      content: "Bonjour, j'aimerais comprendre la différence entre les bases de données relationnelles et NoSQL. Quelqu'un peut m'aider ?",
      course_id: courses[2]._id,
      user_id: etudiant1._id,
      is_pinned: true,
    });

    await DiscussionReply.create([
      { discussion_id: disc1._id, user_id: formateur._id, content: "Excellente question ! Les BDD relationnelles utilisent des tables avec des relations définies, tandis que NoSQL est plus flexible pour des données non structurées." },
      { discussion_id: disc1._id, user_id: etudiant2._id, content: "Je recommande la vidéo du cours sur MongoDB, elle explique bien les différences." },
    ]);

    const disc2 = await Discussion.create({
      title: "Problème avec les algorithmes de tri",
      content: "Je bloque sur l'exercice 3 du chapitre sur les algorithmes de tri. Est-ce que quelqu'un a une solution ?",
      course_id: courses[1]._id,
      user_id: etudiant2._id,
      is_pinned: false,
    });

    await DiscussionReply.create([
      { discussion_id: disc2._id, user_id: formateur._id, content: "Revoyez la section 2.3 sur le tri fusion. L'exercice 3 utilise le même principe avec un tableau de 8 éléments." },
    ]);

    await Discussion.create({
      title: "Discussion générale sur le rythme des cours",
      content: "Qu'est-ce que vous pensez du rythme du semestre ? Trouvez-vous qu'il est adapté ?",
      course_id: null,
      user_id: etudiant1._id,
      is_pinned: false,
    });

    console.log('💬 Discussions et réponses créées');

    console.log('\n✅ Seed terminé avec succès.\n');
    console.log('Comptes de test :');
    console.log('  Super-admin : admin@ucao-uut.tg / admin123');
    console.log('  Admin DGI   : admin-dgi@ucao-uut.tg / admin123');
    console.log('  Admin ISSJ  : admin-issj@ucao-uut.tg / admin123');
    console.log('  Admin ISEG  : admin-iseg@ucao-uut.tg / admin123');
    console.log('  Formateur   : jean.dupont@ucao-uut.tg / formateur123');
    console.log('  Formateurs RIT (tous : formateur123) : tcheki@ucao-uut.tg, lawson.b@ucao-uut.tg, kodjo@ucao-uut.tg, ali.mizou@ucao-uut.tg, amelina@ucao-uut.tg, tete@ucao-uut.tg');
    console.log('  Étudiant  : marie.kouassi@ucao-uut.tg / etudiant123 (Licence 1)');
    console.log('  Étudiant  : jean.amevor@ucao-uut.tg / etudiant123 (Licence 2)');
    console.log('  Étudiant  : l3rit@ucao-uut.tg / etudiant123 (Licence 3 RIT – emploi du temps mousson)');
  } catch (err) {
    console.error('❌ Erreur lors du seed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Déconnecté de MongoDB');
    process.exit(0);
  }
}

seed();
