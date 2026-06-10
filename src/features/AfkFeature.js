const BaseFeature = require('../core/BaseFeature');
const AfkSystem = require('../utils/AfkSystem');

class AfkFeature extends BaseFeature {
    constructor() {
        super('afk', 'Set status AFK dengan alasan', false, 'fun');
    }

    async execute(m, sock, args) {
        try {
            const userId = m.key.participant || m.key.remoteJid;
            const reason = args.join(' ') || 'Tidak ada alasan';
            const name = m.pushName || 'User';

            await AfkSystem.setAfk(userId, reason, name);

            await sock.sendMessage(m.key.remoteJid, {
                text: `*${name}* sekarang AFK\nAlasan: ${reason}`,
                mentions: [userId]
            });

        } catch (error) {
            console.error('Afk error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal set AFK!' });
        }
    }
}

module.exports = AfkFeature;
