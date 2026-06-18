const BaseFeature = require('../core/BaseFeature');

class TranslateFeature extends BaseFeature {
    constructor() {
        super('tr', 'Translate text ke bahasa lain', false, 'tools');
    }

    getFlag(langCode) {
        const flags = {
            id: '🇮🇩', en: '🇬🇧', ja: '🇯🇵', ko: '🇰🇷', ar: '🇸🇦', zh: '🇨🇳',
            es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', ru: '🇷🇺', pt: '🇵🇹', it: '🇮🇹',
            th: '🇹🇭', vi: '🇻🇳', nl: '🇳🇱', tr: '🇹🇷', hi: '🇮🇳'
        };
        return flags[langCode] || '🌐';
    }

    async execute(ctx, client, args) {
        try {
            let targetLang = args[0];
            let text = args.slice(1).join(' ');
            const jid = ctx.roomId || ctx.remoteJid || ctx.senderId;

            const quoted = await ctx.replied?.().catch(() => null);
            if (quoted?.text && !text) text = quoted.text;

            if (!targetLang || !text) {
                await client.send(jid).text('❌ Format salah!\n\nContoh:\n> `/tr id Good morning`\n> Reply pesan: `/tr id`\n\nKode bahasa:\n> `id` - Indonesia\n> `en` - English\n> `ja` - Japanese\n> `ko` - Korean\n> `ar` - Arabic');
                return;
            }

            await ctx.react('🔄');
            const axios = require('axios');
            const config = require('../config/config');
            const response = await axios.get(`${config.apis.lolhuman}/translate/auto/${targetLang}`, {
                params: { apikey: config.lolhumanApiKey, text },
                timeout: 10000
            });

            if (response.data.status !== 200 || !response.data.result) {
                await ctx.react('');
                await client.send(jid).text('❌ Gagal menerjemahkan!');
                return;
            }

            const data = response.data.result;
            await ctx.react('');
            await client.send(jid).text(`${this.getFlag(data.to)}\n\`${data.translated}\``);
        } catch (error) {
            console.error('Translate error:', error.message);
            const jid = ctx.roomId || ctx.remoteJid || ctx.senderId;
            await client.send(jid).text('❌ Terjadi kesalahan saat menerjemahkan!');
        }
    }
}

module.exports = TranslateFeature;
