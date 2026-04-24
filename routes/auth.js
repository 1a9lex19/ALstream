const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getDbConnection, dbRun, dbGet } = require('../database');

// --- PAGE LOGIN / REGISTER ---
router.get('/login', (req, res) => {
    res.render('auth', { error: null });
});

// --- TRAITEMENT INSCRIPTION ---
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    let db_conn;
    try {
        db_conn = await getDbConnection('Users');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await dbRun(db_conn, 
            `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, 
            [username, email, hashedPassword]
        );
        
        req.session.user = { id: result.lastID, username, email };
        res.redirect('/profile');
    } catch (e) {
        console.error("Erreur register:", e.message);
        res.render('auth', { error: "Nom d'utilisateur ou email déjà pris." });
    } finally {
        if (db_conn) await db_conn.end();
    }
});

// --- TRAITEMENT CONNEXION ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    let db_conn;
    try {
        db_conn = await getDbConnection('Users');
        const user = await dbGet(db_conn, `SELECT * FROM users WHERE email = ?`, [email]);
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('auth', { error: "Identifiants incorrects." });
        }
        
        req.session.user = { id: user.id, username: user.username, email: user.email };
        res.redirect('/profile');
    } catch (e) {
        console.error("Erreur login:", e.message);
        res.render('auth', { error: "Erreur serveur." });
    } finally {
        if (db_conn) await db_conn.end();
    }
});

// --- DECONNEXION ---
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- PROFIL ---
router.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('profile');
});

module.exports = router;