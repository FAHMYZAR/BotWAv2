const Database = require('./Database');

class PersonalSholatSystem {
    static async register(userId, kota) {
        Database.run(
            `INSERT OR REPLACE INTO personal_sholat (user_id, kota, registered_at, last_notified) VALUES (?, ?, ?, ?)`,
            userId,
            kota.toLowerCase(),
            Database.toTimestamp(),
            '{}'
        );
    }

    static async unregister(userId) {
        const result = Database.run(`DELETE FROM personal_sholat WHERE user_id = ?`, userId);
        return result.changes > 0;
    }

    static async getAll() {
        return Database.all(`SELECT * FROM personal_sholat`);
    }

    static async isNotifiedToday(userId, nama) {
        const user = Database.get(`SELECT * FROM personal_sholat WHERE user_id = ?`, userId);
        if (!user) return false;

        const notified = Database.parseJson(user.last_notified, {});
        if (!notified[nama]) return false;

        const lastNotified = Database.fromTimestamp(notified[nama]);
        const today = new Date();
        return lastNotified && lastNotified.toDateString() === today.toDateString();
    }

    static async updateLastNotified(userId, nama) {
        const user = Database.get(`SELECT * FROM personal_sholat WHERE user_id = ?`, userId);
        if (!user) return;
        const notified = Database.parseJson(user.last_notified, {});
        notified[nama] = Database.toTimestamp();
        Database.run(`UPDATE personal_sholat SET last_notified = ? WHERE user_id = ?`, JSON.stringify(notified), userId);
    }
}

module.exports = PersonalSholatSystem;
