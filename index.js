require('dotenv').config();
const express = require('express');
const compression = require('compression');
const path = require('path');
const session = require('express-session');
const { initUsersDb, initPlanningDb } = require('./database');

const app = express();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 8000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'secret_dev_key';

// --- INITIALISATION BDD UTILISATEURS ---
initUsersDb();
initPlanningDb();

// --- MIDDLEWARE OPTIMISATIONS ---
app.use(compression());

// --- SETUP VIEW ENGINE ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', etag: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- SESSION ---
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// --- GLOBAL MIDDLEWARES ---
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    // Les catégories sont maintenant gérées directement dans les routes si nécessaire
    res.locals.categories = { "Anime": [], "Movies": [], "TV Shows": [] };
    next();
});

// --- ROUTES ---
const generalRoutes = require('./routes/general');
const catalogRoutes = require('./routes/catalog');
const watchRoutes = require('./routes/watch');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth'); // Suggestion: séparer aussi les routes d'authentification

app.use('/', generalRoutes);
app.use('/catalog', catalogRoutes);
app.use('/watch', watchRoutes);
app.use('/api', apiRoutes);
app.use('/', authRoutes); // Utiliser les routes d'authentification

const { fork } = require('child_process');

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`🎬 ALStream optimisé démarré sur http://localhost:${PORT}`);

    // Démarrage du daemon Torrent Auto-Updater en arrière-plan
    //const torrentBotPath = path.join(__dirname, 'Bots', 'Torrent_AutoUploader.js');
    //const torrentBot = fork(torrentBotPath);

    /*torrentBot.on('error', (err) => {
        console.error("❌ Erreur critique du Bot Torrent:", err);
    });
    
    torrentBot.on('exit', (code) => {
        console.log(`⚠️ Le Bot Torrent s'est arrêté avec le code : ${code}`);
    });*/
});