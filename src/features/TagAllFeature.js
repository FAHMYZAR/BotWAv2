const BaseFeature = require('../core/BaseFeature');
const { normalizeUserJid } = require('../utils/JidHelper');

class TagAllFeature extends BaseFeature {
    constructor() {
        super('tagall', 'Tag semua member grup', false, 'group');
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

            const quoted = await ctx.replied().catch(() => null);
            let text = args.join(' ');

            if (quoted) {
                const quotedText = quoted.text || quoted.media?.caption || 'Media';
                text = text || '📢 *PERHATIAN!*';
                
                let message = `${text}\n\n`;
                message += `━━━━━━━━━━━━━━━\n`;
                message += `${quotedText}\n`;
                message += `━━━━━━━━━━━━━━━\n\n`;
                message += mentions.map(jid => `@${jid.split('@')[0]}`).join('\n');

                await client.send(ctx.roomId).text(message).mentions(mentions);
            } else {
                text = text || '📢 *TAG ALL*';
                
                let message = `${text}\n\n`;
                message += mentions.map(jid => `@${jid.split('@')[0]}`).join('\n');

                await client.send(ctx.roomId).text(message).mentions(mentions);
            }

        } catch (error) {
            console.error('TagAll error:', error.message);
            await ctx.reply('❌ Terjadi kesalahan saat tag all!');
        }
    }
}

module.exports = TagAllFeature;
