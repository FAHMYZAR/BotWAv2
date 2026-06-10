const Database = require('./Database');

class AfkSystem {
    constructor() {
        this.useMongo = false;
    }

    async init() {
        console.log('✅ AfkSystem using SQLite');
    }

    async setAfk(userId, reason, name) {
        Database.run(
            `INSERT OR REPLACE INTO afk (user_id, reason, name, timestamp) VALUES (?, ?, ?, ?)`,
            userId,
            reason || 'Tidak ada alasan',
            name,
            Database.toTimestamp()
        );
    }

    async getAfk(userId) {
        return Database.get(`SELECT * FROM afk WHERE user_id = ?`, userId);
    }

    async removeAfk(userId) {
        const result = Database.run(`DELETE FROM afk WHERE user_id = ?`, userId);
        return result.changes > 0;
    }

    async isAfk(userId) {
        const row = Database.get(`SELECT 1 FROM afk WHERE user_id = ?`, userId);
        return !!row;
    }

    async getAfkDuration(userId) {
        const afk = await this.getAfk(userId);
        if (!afk) return null;

        const duration = Date.now() - afk.timestamp;
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} hari`;
        if (hours > 0) return `${hours} jam`;
        if (minutes > 0) return `${minutes} menit`;
        return `${seconds} detik`;
    }
}

module.exports = new AfkSystem();
