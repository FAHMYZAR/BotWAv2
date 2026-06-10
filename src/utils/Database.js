const fs = require('fs');
const path = require('path');

let BunSQLite = null;
try {
    BunSQLite = require('bun:sqlite');
} catch {
    BunSQLite = null;
}

class Database {
    constructor() {
        this.db = null;
        this.connected = false;
        this.dbDir = path.join(process.cwd(), 'data');
        this.dbPath = path.join(this.dbDir, 'botwa.db');
    }

    async connect() {
        if (this.connected) return;
        if (!BunSQLite?.Database) {
            throw new Error('SQLite backend membutuhkan Bun runtime');
        }

        fs.mkdirSync(this.dbDir, { recursive: true });
        this.db = new BunSQLite.Database(this.dbPath, { create: true });
        this.db.exec('PRAGMA journal_mode = WAL;');
        this.db.exec('PRAGMA synchronous = NORMAL;');
        this.db.exec('PRAGMA foreign_keys = ON;');
        this.createSchema();
        this.connected = true;
        await this.initializeSystems();
        console.log('✅ SQLite connected:', this.dbPath);
    }

    createSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS afk (
                user_id TEXT PRIMARY KEY,
                reason TEXT NOT NULL DEFAULT '',
                name TEXT NOT NULL DEFAULT '',
                timestamp INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS keynotes (
                key TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                author TEXT NOT NULL DEFAULT '',
                created INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS warns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                reason TEXT NOT NULL DEFAULT '',
                admin_id TEXT NOT NULL DEFAULT '',
                timestamp INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_warns_group_user ON warns(group_id, user_id);
            CREATE INDEX IF NOT EXISTS idx_warns_timestamp ON warns(timestamp);

            CREATE TABLE IF NOT EXISTS groups (
                group_id TEXT PRIMARY KEY,
                kota TEXT NOT NULL DEFAULT '',
                registered_at INTEGER NOT NULL,
                registered_by TEXT,
                group_admins TEXT NOT NULL DEFAULT '[]',
                last_notified TEXT NOT NULL DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS protected_entries (
                type TEXT NOT NULL,
                value TEXT NOT NULL,
                PRIMARY KEY (type, value)
            );

            CREATE TABLE IF NOT EXISTS deleted_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                message_id TEXT,
                sender TEXT,
                sender_name TEXT,
                text TEXT,
                caption TEXT,
                media_type TEXT,
                timestamp INTEGER,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_deleted_messages_chat_created ON deleted_messages(chat_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_deleted_messages_created ON deleted_messages(created_at);

            CREATE TABLE IF NOT EXISTS personal_sholat (
                user_id TEXT PRIMARY KEY,
                kota TEXT NOT NULL,
                registered_at INTEGER NOT NULL,
                last_notified TEXT NOT NULL DEFAULT '{}'
            );
        `);
    }

    async initializeSystems() {
        const AfkSystem = require('./AfkSystem');
        const KeynoteSystem = require('./KeynoteSystem');
        const WarnSystem = require('./WarnSystem');
        const ProtectionSystem = require('./ProtectionSystem');
        const GroupSystem = require('./GroupSystem');
        const DatabaseManager = require('./DatabaseManager');

        await AfkSystem.init();
        await KeynoteSystem.init();
        await WarnSystem.init();
        await ProtectionSystem.init();
        await GroupSystem.init();
        DatabaseManager.startScheduledCleanup();
        console.log('✅ All systems initialized');
    }

    ensureConnected() {
        if (!this.connected || !this.db) {
            throw new Error('Database not connected');
        }
    }

    run(sql, ...params) {
        this.ensureConnected();
        return this.db.query(sql).run(...params);
    }

    get(sql, ...params) {
        this.ensureConnected();
        return this.db.query(sql).get(...params) || null;
    }

    all(sql, ...params) {
        this.ensureConnected();
        return this.db.query(sql).all(...params);
    }

    transaction(fn) {
        this.ensureConnected();
        return this.db.transaction(fn);
    }

    toTimestamp(value = new Date()) {
        return value instanceof Date ? value.getTime() : Number(value);
    }

    fromTimestamp(value) {
        return value ? new Date(Number(value)) : null;
    }

    parseJson(value, fallback) {
        try {
            return value ? JSON.parse(value) : fallback;
        } catch {
            return fallback;
        }
    }

    async close() {
        if (this.db?.close) {
            this.db.close();
        }
        this.db = null;
        this.connected = false;
    }

    isConnected() {
        return this.connected;
    }
}

module.exports = new Database();
