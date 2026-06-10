const fs = require('fs');
const path = require('path');
const Database = require('./Database');

class ProtectionSystem {
    constructor() {
        this.filePath = path.join(process.cwd(), 'protected.json');
        this.data = this.load();
        this.useMongo = false;
    }

    async init() {
        await this.loadFromDb();
        console.log('✅ ProtectionSystem using SQLite');
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            }
        } catch (error) {
            console.error('Error loading protected data:', error);
        }
        return { numbers: [], jids: [] };
    }

    async loadFromDb() {
        const docs = Database.all(`SELECT type, value FROM protected_entries`);
        this.data = {
            numbers: docs.filter(d => d.type === 'number').map(d => d.value),
            jids: docs.filter(d => d.type === 'jid').map(d => d.value)
        };
    }

    async save() {
        try {
            Database.transaction(() => {
                Database.run(`DELETE FROM protected_entries`);
                for (const value of this.data.numbers) {
                    Database.run(`INSERT OR IGNORE INTO protected_entries (type, value) VALUES (?, ?)`, 'number', value);
                }
                for (const value of this.data.jids) {
                    Database.run(`INSERT OR IGNORE INTO protected_entries (type, value) VALUES (?, ?)`, 'jid', value);
                }
            })();
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving protected data:', error);
            return false;
        }
    }

    addNumber(number) {
        if (!this.data.numbers.includes(number)) {
            this.data.numbers.push(number);
            this.save();
            return true;
        }
        return false;
    }

    removeNumber(number) {
        const index = this.data.numbers.indexOf(number);
        if (index > -1) {
            this.data.numbers.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }

    addJid(jid) {
        if (!this.data.jids.includes(jid)) {
            this.data.jids.push(jid);
            this.save();
            return true;
        }
        return false;
    }

    removeJid(jid) {
        const index = this.data.jids.indexOf(jid);
        if (index > -1) {
            this.data.jids.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }

    isProtectedNumber(number) {
        return this.data.numbers.includes(number);
    }

    isProtectedJid(jid) {
        return this.data.jids.includes(jid);
    }

    getAll() {
        return this.data;
    }
}

module.exports = new ProtectionSystem();
