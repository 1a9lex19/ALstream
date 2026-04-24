const mysql = require('mysql2/promise'); // <-- On utilise la version avec 'promise'

// --- CONFIGURATION DE LA CONNEXION MYSQL ---
// Par défaut, l'utilisateur est 'root' sans mot de passe avec XAMPP
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    // Pas de 'database' ici, on la choisira au moment de la connexion
};

// --- NOUVELLE FONCTION POUR OBTENIR LA CONNEXION DB ---
// Cette fonction ne crée pas de pool, elle ouvre une connexion simple pour chaque requête.
// C'est moins performant mais plus simple à gérer pour la fermeture (db_conn.end()).
async function getDbConnection(contentType) {
    let dbName;
    switch (contentType) {
        case 'Anime': dbName = 'alstream_animes'; break;
        case 'Movies': dbName = 'alstream_movies'; break;
        case 'TV Shows': dbName = 'alstream_tv_shows'; break;
        case 'Users': dbName = 'alstream_users'; break;
        case 'Planning': dbName = 'alstream_planning'; break;
        default: dbName = 'alstream_animes'; break;
    }

    try {
        const connection = await mysql.createConnection({
            ...dbConfig,
            database: dbName
        });
        return connection;
    } catch (err) {
        console.error(`❌ Erreur de connexion à la DB MySQL '${dbName}':`, err.message);
        throw err;
    }
}

// --- INITIALISATION DE LA DB UTILISATEURS (pour la première exécution) ---
async function initUsersDb() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`alstream_users\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`);
        console.log("✅ Base de données 'alstream_users' assurée.");

        // On se reconnecte à la bonne DB pour créer la table
        await connection.end();
        connection = await getDbConnection('Users');

        // Note : le code SQL est adapté pour MySQL (VARCHAR au lieu de TEXT pour les clés/titres, etc.)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
              id int(11) NOT NULL AUTO_INCREMENT,
              username varchar(100) NOT NULL,
              email varchar(255) NOT NULL,
              password varchar(255) NOT NULL,
              created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              UNIQUE KEY username (username),
              UNIQUE KEY email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);
        console.log("✅ Table 'users' assurée dans alstream_users.");
    } catch (err) {
        console.error("❌ Erreur lors de l'initialisation de la DB Users:", err.message);
    } finally {
        if (connection) await connection.end();
    }
}

// --- NOUVEAUX WRAPPERS SQL (pour mysql2) ---
// db.query renvoie un tableau : [rows, fields]
const dbAll = async (db_conn, sql, params = []) => {
    const [rows] = await db_conn.query(sql, params);
    return rows;
};

const dbGet = async (db_conn, sql, params = []) => {
    const [rows] = await db_conn.query(sql, params);
    return rows[0] || null;
};

const dbRun = async (db_conn, sql, params = []) => {
    const [result] = await db_conn.query(sql, params);
    // Renvoie un objet similaire à l'ancien pour la compatibilité
    return { lastID: result.insertId, changes: result.affectedRows };
};


// --- INITIALISATION DE LA DB PLANNING ---
async function initPlanningDb() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`alstream_planning\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`);
        console.log("✅ Base de données 'alstream_planning' assurée.");

        await connection.end();
        connection = await getDbConnection('Planning');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS planning (
              id          INT(11) NOT NULL AUTO_INCREMENT,
              jour        VARCHAR(20)  NOT NULL COMMENT 'Lundi, Mardi...',
              date_jour   VARCHAR(10)  DEFAULT NULL COMMENT 'DD/MM',
              titre       VARCHAR(255) NOT NULL,
              slug        VARCHAR(255) NOT NULL,
              affiche     TEXT         DEFAULT NULL,
              heure       VARCHAR(10)  DEFAULT NULL COMMENT 'HHhMM',
              type        VARCHAR(20)  DEFAULT 'TV',
              langue      VARCHAR(20)  DEFAULT 'VOSTFR',
              source      VARCHAR(50)  DEFAULT 'Crunchyroll',
              updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              UNIQUE KEY  uk_slug_jour (slug, jour),
              INDEX       idx_jour (jour)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);
        console.log("✅ Table 'planning' assurée dans alstream_planning.");
    } catch (err) {
        console.error("❌ Erreur lors de l'initialisation de la DB Planning:", err.message);
    } finally {
        if (connection) await connection.end();
    }
}

// On exporte toutes les fonctions nécessaires
module.exports = {
    getDbConnection,
    initUsersDb,
    initPlanningDb,
    dbAll,
    dbGet,
    dbRun,
    dbs: {
        ANIME: 'Anime',
        MOVIES: 'Movies',
        TV_SHOWS: 'TV Shows',
        USERS: 'Users',
        PLANNING: 'Planning'
    }
};
