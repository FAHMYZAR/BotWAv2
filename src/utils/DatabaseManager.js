const fs = require('fs');
const Database = require('./Database');

class DatabaseManager {
    constructor() {
        this.cleanupAfterMs = 3 * 24 * 60 * 60 * 1000;
        this.cleanupIntervalMs = 3 * 24 * 60 * 60 * 1000;
        this.interval = null;
    }

    async performCleanup() {
        try {
            if (!Database.isConnected()) return;

            const cutoff = Date.now() - this.cleanupAfterMs;
            const afk = Database.run(`DELETE FROM afk WHERE timestamp < ?`, cutoff).changes;
            const warns = Database.run(`DELETE FROM warns WHERE timestamp < ?`, cutoff).changes;
            const deletedMessages = Database.run(`DELETE FROM deleted_messages WHERE created_at < ?`, cutoff).changes;

            Database.run('PRAGMA wal_checkpoint(TRUNCATE);');
            Database.run('VACUUM;');

            console.log(`✅ SQLite cleanup done: afk=${afk}, warns=${warns}, deleted_messages=${deletedMessages}`);
        } catch (error) {
            console.error('SQLite cleanup error:', error.message);
        }
    }

    startScheduledCleanup() {
        if (this.interval) return;
        this.interval = setInterval(() => {
            this.performCleanup();
        }, this.cleanupIntervalMs);
        console.log('✅ SQLite cleanup scheduled every 3 days');
    }

    async setupTTLIndexes() {
        return true;
    }

    async checkDatabaseSize() {
        return await this.getStorageStats();
    }

    async getStorageStats() {
        try {
            if (!Database.isConnected()) return null;
            const tables = Database.all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
            const size = fs.existsSync(Database.dbPath) ? fs.statSync(Database.dbPath).size : 0;
            const counts = {};

            for (const table of tables) {
                const row = Database.get(`SELECT COUNT(*) as count FROM ${table.name}`);
                counts[table.name] = row ? row.count : 0;
            }

            return {
                totalSize: `${(size / (1024 * 1024)).toFixed(2)} MB`,
                collections: tables.length,
                counts
            };
        } catch (error) {
            console.error('Storage stats error:', error.message);
            return null;
        }
    }
}

module.exports = new DatabaseManager();
