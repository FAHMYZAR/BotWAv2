const Database = require('./Database');

class WarnSystem {
    constructor() {
        this.useMongo = false;
        this.maxWarns = 3;
    }

    async init() {
        console.log('✅ WarnSystem using SQLite');
    }

    async addWarn(groupId, userId, reason, adminId) {
        Database.run(
            `INSERT INTO warns (group_id, user_id, reason, admin_id, timestamp) VALUES (?, ?, ?, ?, ?)`,
            groupId,
            userId,
            reason,
            adminId,
            Database.toTimestamp()
        );
        return await this.getWarnCount(groupId, userId);
    }

    async getWarns(groupId, userId) {
        return Database.all(`SELECT * FROM warns WHERE group_id = ? AND user_id = ? ORDER BY timestamp DESC`, groupId, userId);
    }

    async getWarnCount(groupId, userId) {
        const row = Database.get(`SELECT COUNT(*) as count FROM warns WHERE group_id = ? AND user_id = ?`, groupId, userId);
        return row ? row.count : 0;
    }

    async removeWarn(groupId, userId) {
        const row = Database.get(`SELECT id FROM warns WHERE group_id = ? AND user_id = ? ORDER BY timestamp DESC LIMIT 1`, groupId, userId);
        if (row) {
            const result = Database.run(`DELETE FROM warns WHERE id = ?`, row.id);
            return result.changes > 0;
        }
        return false;
    }

    async clearWarns(groupId, userId) {
        const result = Database.run(`DELETE FROM warns WHERE group_id = ? AND user_id = ?`, groupId, userId);
        return result.changes;
    }

    async getAllWarns(groupId) {
        return Database.all(`SELECT * FROM warns WHERE group_id = ? ORDER BY timestamp DESC`, groupId);
    }

    async shouldKick(groupId, userId) {
        const count = await this.getWarnCount(groupId, userId);
        return count >= this.maxWarns;
    }

    async resetWarns(groupId, userId) {
        return await this.clearWarns(groupId, userId);
    }

    async getAllWarnsInGroup(groupId) {
        const rows = Database.all(`
            SELECT user_id, COUNT(*) as totalWarns,
                   json_group_array(json_object('reason', reason, 'adminId', admin_id, 'timestamp', timestamp)) as warns_json
            FROM warns
            WHERE group_id = ?
            GROUP BY user_id
            ORDER BY totalWarns DESC
        `, groupId);

        return rows.map(r => ({
            _id: r.user_id,
            userId: r.user_id,
            totalWarns: r.totalWarns,
            warns: Database.parseJson(r.warns_json, [])
        }));
    }
}

module.exports = new WarnSystem();
