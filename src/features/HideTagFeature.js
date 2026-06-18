const BaseFeature = require('../core/BaseFeature');
const { normalizeUserJid } = require('../utils/JidHelper');

class HideTagFeature extends BaseFeature {
    constructor() {
        super('hidetag', 'Tag semua member tanpa tampilkan username', false, 'group');
    }

    async execute(ctx, client, args) {
        try {
            if (!ctx.roomId.endsWith('@g.us')) {
                await ctx.reply('❌ Perintah ini hanya bisa digunakan di grup!');
                return;
            }

            const groupMetadata = await client.group.metadata(ctx.roomId);
            const participants = groupMetadata.participants || groupMetadata.res?.participants;
            const mentions = participants.map(p => normalizeUserJid(p.id));

            let text = args.join(' ');
            if (!text) {
                await ctx.reply('❌ Format: `.hidetag pesan`');
                return;
            }

            await client.send(ctx.roomId).text(text).mentions(mentions);

        } catch (error) {
            console.error('HideTag error:', error.message);
            await ctx.reply('❌ Terjadi kesalahan!');
        }
    }
}

module.exports = HideTagFeature;
