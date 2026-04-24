const express = require('express');
const router = express.Router();
const { getDbConnection, dbAll } = require('../database');

// Mapping type URL → DB interne
const TYPE_TO_DB = {
    'anime': ['Anime'],
    'movie': ['Movies'],
    'tv': ['TV Shows'],
    'all': ['Anime', 'Movies', 'TV Shows'],
    'default': ['Anime', 'Movies', 'TV Shows'],
};

router.get('/search-live', async (req, res) => {
    const query = (req.query.q || '').trim();
    if (!query || query.length < 2) return res.json([]);

    // Détermine quelles DBs interroger selon le filtre actif
    const typeParam = (req.query.type || 'all').toLowerCase();
    const dbTypes = TYPE_TO_DB[typeParam] || TYPE_TO_DB['all'];

    let allResults = [];

    for (const type of dbTypes) {
        let conn;
        try {
            conn = await getDbConnection(type);
            const sql = `
                SELECT titre, slug, affiche, synopsis 
                FROM animes 
                WHERE LOWER(titre) LIKE LOWER(?) 
                ORDER BY CASE WHEN LOWER(titre) LIKE LOWER(?) THEN 1 ELSE 2 END, titre ASC 
                LIMIT 5`;
            const results = await dbAll(conn, sql, [`%${query}%`, `${query}%`]);
            if (results.length > 0) {
                allResults = allResults.concat(results.map(r => ({ ...r, category: type })));
            }
        } catch (e) {
            console.error(`⚠️ Erreur SQL dans ${type}: ${e.message}`);
        } finally {
            if (conn) await conn.end();
        }
    }

    // Dédoublonnage + tri
    const unique = allResults.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
    unique.sort((a, b) => a.titre.localeCompare(b.titre));

    res.json(unique.slice(0, 10));
});

module.exports = router;