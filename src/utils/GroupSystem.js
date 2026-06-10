const Database = require('./Database');

class GroupSystem {
    constructor() {
        this.useMongo = false;
    }

    async init() {
        console.log('✅ GroupSystem using SQLite');
    }

    async register(groupJid, kota, registeredBy = null) {
        try {
            const existing = await this.get(groupJid);
            Database.run(
                `INSERT OR REPLACE INTO groups (group_id, kota, registered_at, registered_by, group_admins, last_notified) VALUES (?, ?, ?, ?, ?, ?)`,
                groupJid,
                kota.toLowerCase(),
                existing ? existing.registered_at : Database.toTimestamp(),
                registeredBy,
                existing ? existing.group_admins : '[]',
                existing ? existing.last_notified : '{}'
            );
            return true;
        } catch (error) {
            console.error('Register group error:', error);
            return false;
        }
    }

    async unregister(groupJid) {
        const result = Database.run(`DELETE FROM groups WHERE group_id = ?`, groupJid);
        return result.changes > 0;
    }

    async get(groupJid) {
        return Database.get(`SELECT * FROM groups WHERE group_id = ?`, groupJid);
    }

    async getAll() {
        return Database.all(`SELECT * FROM groups`);
    }

    async addGroupAdmin(groupJid, adminJid) {
        const group = await this.get(groupJid);
        if (!group) return false;

        const admins = Database.parseJson(group.group_admins, []);
        if (!admins.includes(adminJid)) {
            admins.push(adminJid);
            Database.run(`UPDATE groups SET group_admins = ? WHERE group_id = ?`, JSON.stringify(admins), groupJid);
        }
        return true;
    }

    async isGroupAdmin(groupJid, userJid) {
        const group = await this.get(groupJid);
        if (!group) return false;
        const admins = Database.parseJson(group.group_admins, []);
        return admins.includes(userJid);
    }

    async updateLastNotified(groupJid, waktu) {
        const group = await this.get(groupJid);
        if (!group) return false;
        const notified = Database.parseJson(group.last_notified, {});
        notified[waktu] = Database.toTimestamp();
        Database.run(`UPDATE groups SET last_notified = ? WHERE group_id = ?`, JSON.stringify(notified), groupJid);
        return true;
    }

    async isNotifiedToday(groupJid, waktu) {
        const group = await this.get(groupJid);
        if (!group) return false;
        const notified = Database.parseJson(group.last_notified, {});
        if (!notified[waktu]) return false;

        const lastNotified = Database.fromTimestamp(notified[waktu]);
        const today = new Date();
        return lastNotified && lastNotified.toDateString() === today.toDateString();
    }
}

module.exports = new GroupSystem();
