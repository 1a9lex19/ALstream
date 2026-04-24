const express = require('express');
const router = express.Router();
const { getDbConnection, dbAll } = require('../database');

// --- PAGE D'ACCUEIL ---
router.get('/', (req, res) => res.render('landing'));

// --- PAGE PLANNING (lecture MySQL) ---
router.get('/planning', async (req, res) => {
    const daysOrder = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    // Structure vide par défaut
    const finalPlanning = {};
    daysOrder.forEach(day => finalPlanning[day] = { date: '', animes: [] });

    let db_conn;
    try {
        db_conn = await getDbConnection('Planning');

        const rows = await dbAll(db_conn,
            `SELECT jour, date_jour, titre, slug, affiche, heure, type, langue
             FROM planning
             ORDER BY
               FIELD(jour, 'Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'),
               heure ASC`
        );

        rows.forEach(item => {
            if (finalPlanning[item.jour]) {
                finalPlanning[item.jour].animes.push(item);
                if (!finalPlanning[item.jour].date && item.date_jour) {
                    finalPlanning[item.jour].date = item.date_jour;
                }
            }
        });

    } catch (err) {
        console.error('⚠️  [Planning] Erreur lecture DB:', err.message);
        console.error('   → Lance le bot : node Bots/Planning_Crunchyroll.js');
    } finally {
        if (db_conn) await db_conn.end();
    }

    const jsDayMap = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const todayName = jsDayMap[new Date().getDay()];

    res.render('planning', {
        planning: finalPlanning,
        daysOrder: daysOrder,
        today: todayName,
        user: req.session?.user || null,
    });
});

// Auth fallback
router.get('/login', (req, res) => res.render('auth', { error: null }));

// --- PAGE PARAMETRES ---
router.get('/settings', (req, res) => {
    res.render('settings', {
        user: req.session?.user || null,
        pageTitle: "Paramètres"
    });
});

module.exports = router;