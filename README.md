# Backend Web Academy - UCAO-UUT

Backend Node.js/Express pour la plateforme de gestion de cours et de discussion de l'université UCAO-UUT.

## Technologies

- **Node.js** avec **Express.js**
- **MongoDB** avec **Mongoose**
- **JWT** pour l'authentification
- **bcryptjs** pour le hachage des mots de passe

## Installation

```bash
cd backend-node
npm install
```

## Configuration

1. Créer un fichier `.env` à partir de `.env.example` :
```bash
cp .env.example .env
```

2. Modifier les variables d'environnement dans `.env` :
```
PORT=8000
MONGODB_URI=mongodb://localhost:27017/web-academy
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
```

## Démarrage

### Mode développement
```bash
npm run dev
```

### Mode production
```bash
npm start
```

Le serveur démarre sur `http://localhost:8000`

## API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/user` - Obtenir l'utilisateur actuel (authentifié)

### Cours
- `GET /api/courses` - Liste des cours (avec filtres: filiere, niveau, institution)
- `GET /api/courses/:id` - Détails d'un cours
- `POST /api/courses` - Créer un cours (admin/formateur)
- `PUT /api/courses/:id` - Modifier un cours
- `DELETE /api/courses/:id` - Supprimer un cours

### Discussions
- `GET /api/discussions` - Liste des discussions (avec filtre: course_id)
- `GET /api/discussions/:id` - Détails d'une discussion
- `POST /api/discussions` - Créer une discussion (authentifié)
- `PUT /api/discussions/:id` - Modifier une discussion
- `DELETE /api/discussions/:id` - Supprimer une discussion
- `POST /api/discussions/:id/replies` - Ajouter une réponse (authentifié)

### Actualités
- `GET /api/news` - Liste des actualités publiées
- `GET /api/news/:id` - Détails d'une actualité
- `POST /api/news` - Créer une actualité (admin)
- `PUT /api/news/:id` - Modifier une actualité (admin)
- `DELETE /api/news/:id` - Supprimer une actualité (admin)

### Calendriers d'évaluation
- `GET /api/evaluation-calendars` - Liste des calendriers (avec filtres: filiere, niveau, course_id)
- `GET /api/evaluation-calendars/:id` - Détails d'un calendrier
- `POST /api/evaluation-calendars` - Créer un calendrier (admin)
- `PUT /api/evaluation-calendars/:id` - Modifier un calendrier (admin)
- `DELETE /api/evaluation-calendars/:id` - Supprimer un calendrier (admin)

### Emplois du temps
- `GET /api/timetables` - Liste des emplois du temps (avec filtres: filiere, niveau, day_of_week)
- `GET /api/timetables/:id` - Détails d'un emploi du temps
- `POST /api/timetables` - Créer un emploi du temps (admin)
- `PUT /api/timetables/:id` - Modifier un emploi du temps (admin)
- `DELETE /api/timetables/:id` - Supprimer un emploi du temps (admin)

### Admin
- `GET /api/admin/courses` - Liste de tous les cours (admin)
- `GET /api/admin/users` - Liste de tous les utilisateurs (admin)
- `GET /api/admin/users/:id` - Détails d'un utilisateur (admin)
- `PUT /api/admin/users/:id` - Modifier un utilisateur (admin)
- `DELETE /api/admin/users/:id` - Supprimer un utilisateur (admin)

## Structure du projet

```
backend-node/
├── models/          # Modèles Mongoose
├── routes/          # Routes Express
├── middleware/      # Middlewares (auth, etc.)
├── server.js        # Point d'entrée
└── package.json
```

## Rôles utilisateurs

- **admin** : Accès complet à toutes les fonctionnalités
- **formateur** : Peut créer et gérer ses propres cours
- **etudiant** : Peut consulter les cours et participer aux discussions

