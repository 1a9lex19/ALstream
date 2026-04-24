const express = require('express');
const router = express.Router();
const { getDbConnection, dbAll, dbGet } = require('../database'); // On importe les fonctions adaptées

router.get('/', async (req, res) => {
    const filterType = req.query.type || 'Anime';
    const sortBy = req.query.sort || 'date';
    const page = parseInt(req.query.page) || 1;
    const limit = 75;
    const offset = (page - 1) * limit;

    let db_conn;
    let pageTitle = "Catalogue Complet";

    try {
        // --- SÉLECTION DE LA BASE DE DONNÉES ET DU TITRE ---
        switch (filterType) {
            case 'Movies':
                pageTitle = "Films";
                break;
            case 'Anime':
                pageTitle = "Animes";
                break;
            case 'TV Shows':
                pageTitle = "Séries TV";
                break;
            default:
                pageTitle = "Animes";
                break;
        }

        db_conn = await getDbConnection(filterType);

        // Condition SQL pour ne pas afficher les contenus dont la date de sortie est dans le futur
        const futureDateFilter = `
            WHERE animes.date_sortie IS NULL 
            OR TRIM(animes.date_sortie) = '' 
            OR COALESCE(
                STR_TO_DATE(SUBSTRING_INDEX(animes.date_sortie, ' to ', 1), '%b %d, %Y'),
                STR_TO_DATE(animes.date_sortie, '%Y-%m-%d'),
                STR_TO_DATE(CONCAT('Jan 1, ', RIGHT(TRIM(animes.date_sortie), 4)), '%b %d, %Y')
            ) <= CURDATE()
        `;

        // --- REQUÊTE SQL OPTIMISÉE POUR COUNT ---
        // Le GROUP BY rend le COUNT(*) direct incorrect. Il faut compter le résultat groupé.
        const countQuery = `SELECT COUNT(id) as total FROM (
                                SELECT animes.id FROM animes
                                LEFT JOIN episodes ON episodes.anime_id = animes.id
                                ${futureDateFilter}
                                GROUP BY animes.id
                            ) as subquery`;

        // --- REQUÊTE PRINCIPALE AVEC JOIN ET GROUP BY ---
        let sqlQuery = `
            SELECT 
                animes.*,
                MAX(CASE WHEN UPPER(episodes.langue) = 'VF' THEN 1 ELSE 0 END) as has_vf,
                MAX(CASE WHEN UPPER(episodes.langue) IN ('VOSTFR', 'VO') THEN 1 ELSE 0 END) as has_vostfr
            FROM animes
            LEFT JOIN episodes ON episodes.anime_id = animes.id
            ${futureDateFilter}
            GROUP BY animes.id
        `;

        // --- LOGIQUE DE TRI ---
        if (sortBy === 'alpha') {
            sqlQuery += " ORDER BY animes.titre ASC";
        } else if (sortBy === 'ranking') {
            sqlQuery += " ORDER BY animes.note DESC, animes.titre ASC";
        } else { // default is 'date'
            // date_sortie can be Jikan format ("Apr 3, 2024 to ...") or ISO ("2024-06-19").
            // We parse both formats to sort chronologically (most recent first).
            sqlQuery += ` ORDER BY COALESCE(
                STR_TO_DATE(SUBSTRING_INDEX(animes.date_sortie, ' to ', 1), '%b %d, %Y'),
                STR_TO_DATE(animes.date_sortie, '%Y-%m-%d'),
                STR_TO_DATE(CONCAT('Jan 1, ', RIGHT(TRIM(animes.date_sortie), 4)), '%b %d, %Y')
            ) DESC, animes.titre ASC`;
        }

        // --- PAGINATION ---
        sqlQuery += " LIMIT ? OFFSET ?";

        // Lancer les deux requêtes en parallèle pour la performance
        const [countResult, results] = await Promise.all([
            dbGet(db_conn, countQuery, []),
            dbAll(db_conn, sqlQuery, [limit, offset])
        ]);

        const totalItems = countResult.total;
        const totalPages = Math.ceil(totalItems / limit);

        res.render('catalog', {
            animes: results,
            pageTitle: pageTitle,
            currentFilter: filterType,
            currentSort: sortBy,
            currentPage: page,
            totalPages: totalPages,
            categories: { "Anime": [], "Movies": [], "TV Shows": [] }
        });

    } catch (err) {
        console.error("❌ Erreur BDD dans /catalog:", err.message);
        res.status(500).send("Erreur lors de la récupération des données du catalogue.");
    } finally {
        // --- TRÈS IMPORTANT : Toujours fermer la connexion avec end() ---
        if (db_conn) await db_conn.end();
    }
});

module.exports = router;