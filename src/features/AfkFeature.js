const BaseFeature = require('../core/BaseFeature');
const AfkSystem = require('../utils/AfkSystem');

class AfkFeature extends BaseFeature {
    constructor() {
        super('afk', 'Set status AFK dengan alasan', false, 'fun');
    }

    async execute(ctx, client, args) {
        try {
            const userId = ctx.senderJid || ctx.remoteJid;
            const reason = args.join(' ') || 'Tidak ada alasan';
            const name = ctx.senderName || 'User';

            await AfkSystem.setAfk(userId, reason, name);

            await client.send(ctx.remoteJid).text(`*${name}* sekarang AFK\nAlasan: ${reason}`).mentions([userId]
            );

        } catch (error) {
            console.error('Afk error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal set AFK!');
        }
    }
}

module.exports = AfkFeature;
