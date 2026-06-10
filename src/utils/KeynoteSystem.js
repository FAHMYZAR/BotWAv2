const Database = require('./Database');

class KeynoteSystem {
    constructor() {
        this.useMongo = false;
        this.defaultPrefix = '#';
    }

    async init() {
        console.log('✅ KeynoteSystem using SQLite');
    }

    async addKeynote(key, content, author) {
        Database.run(
            `INSERT OR REPLACE INTO keynotes (key, content, author, created) VALUES (?, ?, ?, ?)`,
            key,
            content,
            author,
            Database.toTimestamp()
        );
        return true;
    }

    async getKeynote(key) {
        return Database.get(`SELECT * FROM keynotes WHERE key = ?`, key);
    }

    async deleteKeynote(key) {
        const result = Database.run(`DELETE FROM keynotes WHERE key = ?`, key);
        return result.changes > 0;
    }

    async getAllKeynotes() {
        return Database.all(`SELECT * FROM keynotes ORDER BY created DESC`);
    }

    async setPrefix(prefix) {
        Database.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, 'keynote_prefix', prefix);
        return true;
    }

    async getPrefix() {
        const setting = Database.get(`SELECT value FROM settings WHERE key = ?`, 'keynote_prefix');
        return setting ? setting.value : this.defaultPrefix;
    }
}

module.exports = new KeynoteSystem();
