const fs = require('fs');
const path = require('path');

class GroupRegistry {
    constructor() {
        this.filePath = path.join(__dirname, '../../registeredGroups.json');
        this.groups = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading groups:', error);
        }
        return {};
    }

    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.groups, null, 2));
        } catch (error) {
            console.error('Error saving groups:', error);
        }
    }

    register(groupJid, kota) {
        this.groups[groupJid] = {
            kota: kota.toLowerCase(),
            registeredAt: new Date().toISOString(),
            lastNotified: {}
        };
        this.save();
    }

    unregister(groupJid) {
        delete this.groups[groupJid];
        this.save();
    }

    get(groupJid) {
        return this.groups[groupJid];
    }

    getAll() {
        return this.groups;
    }

    updateLastNotified(groupJid, waktu) {
        if (this.groups[groupJid]) {
            this.groups[groupJid].lastNotified[waktu] = new Date().toISOString();
            this.save();
        }
    }

    isNotifiedToday(groupJid, waktu) {
        const group = this.groups[groupJid];
        if (!group || !group.lastNotified[waktu]) return false;

        const lastNotified = new Date(group.lastNotified[waktu]);
        const today = new Date();
        
        return lastNotified.toDateString() === today.toDateString();
    }
}

module.exports = new GroupRegistry();
