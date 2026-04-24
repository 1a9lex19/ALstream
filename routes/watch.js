const express = require('express');
const router = express.Router();
const { getDbConnection, dbGet, dbAll } = require('../database');

router.get('/:slug', async (req, res) => {
    const slug = req.params.slug;
    
    // On parcourt les bases de données pour trouver le contenu
    const dbTypes = ['Anime', 'Movies', 'TV Shows'];
    let anime = null;
    let db_conn_used = null;
    let foundType = '';

    for (const type of dbTypes) {
        let conn;
        try {
            conn = await getDbConnection(type);
            anime = await dbGet(conn, "SELECT * FROM animes WHERE slug = ?", [slug]);
            if (anime) {
                db_conn_used = conn;
                foundType = type;
                break;
            }
        } finally {
            if (conn && conn !== db_conn_used) await conn.end();
        }
    }

    if (!anime) {
        return res.status(404).render('error', { message: "Contenu introuvable." });
    }

    try {
        const episodes = await dbAll(db_conn_used, "SELECT * FROM episodes WHERE anime_id = ? ORDER BY saison, episode", [anime.id]);
        
        let hasVO = false;
        let hasVF = false;
        let defaultLang = 'ALL';

        if (episodes.length > 0) {
            hasVO = episodes.some(ep => ep.langue?.toUpperCase() === 'VOSTFR' || ep.langue?.toUpperCase() === 'VO');
            hasVF = episodes.some(ep => ep.langue?.toUpperCase() === 'VF');
            defaultLang = hasVO ? 'vostfr' : (hasVF ? 'vf' : 'ALL');
        }

        // --- NOUVEAU: Récupérer les lecteurs pour chaque épisode et DÉDUPLIQUER ---
        const epMap = new Map();

        for (let ep of episodes) {
            try {
                // On essaie de récupérer de la table `lecteurs` s'ils sont dans la db séparée
                ep.lecteurs = await dbAll(db_conn_used, "SELECT url, nom FROM lecteurs WHERE episode_id = ?", [ep.id]);
            } catch (err) {
                // S'il n'y a pas de table lecteurs ou autre erreur, on initialise à un tableau vide
                ep.lecteurs = [];
                console.warn("Erreur chargement des lecteurs (peut être normale si la colonne/table diffère) :", err.message);
            }

            // Fallback: Si `ep.lecteurs` (la colonne ou variable) est une string JSON, on la parse
            if (typeof ep.lecteurs === 'string') {
                try {
                    ep.lecteurs = JSON.parse(ep.lecteurs);
                } catch(e) {
                    ep.lecteurs = [];
                }
            }

            // Clé unique par saison, épisode et langue
            const key = `${ep.saison}_${ep.episode}_${ep.langue?.toUpperCase()}`;
            if (epMap.has(key)) {
                // L'épisode existe déjà, on fusionne les lecteurs pour garder ceux qui marchent
                const existingEp = epMap.get(key);
                existingEp.lecteurs = [...existingEp.lecteurs, ...ep.lecteurs];
            } else {
                epMap.set(key, ep);
            }
        }

        const deduplicatedEpisodes = Array.from(epMap.values());

        res.render('watch', { 
            anime, 
            episodes: deduplicatedEpisodes,
            contentType: foundType,
            hasVO,
            hasVF,
            defaultLang
        });

    } catch (e) {
        res.status(500).render('error', { message: "Erreur chargement." });
    } finally {
        if (db_conn_used) await db_conn_used.end();
    }
});

module.exports = router;