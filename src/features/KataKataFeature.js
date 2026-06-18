const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class KataKataFeature extends BaseFeature {
    constructor() {
        super('katakata', 'Random kata-kata bijak (Jawa, Galau, Dilan)', false, 'fun');
        this.aliases = ['kata', 'quote'];
        this.quoteTypes = [
            { name: 'Jawa', url: config.apis.pitucode.jawaquote, emoji: '🏛️' },
            { name: 'Galau', url: config.apis.pitucode.galauquote, emoji: '💔' },
            { name: 'Dilan', url: config.apis.pitucode.dilanquote, emoji: '💕' }
        ];
    }

    getRandomQuoteType() {
        const randomIndex = Math.floor(Math.random() * this.quoteTypes.length);
        return this.quoteTypes[randomIndex];
    }

    async execute(ctx, client, args) {
        try {
            await ctx.react('💭');

            const quoteType = this.getRandomQuoteType();
            
            const response = await axios.get(quoteType.url, {
                params: { apikey: config.pituCodeApiKey },
                timeout: 10000
            });

            if (!response.data.success || !response.data.result) {
                await ctx.react('');
                await client.send(ctx.remoteJid).text('❌ Gagal mengambil kata-kata!');
                return;
            }

            const quote = response.data.result;
            
            await ctx.react('');

            await client.send(ctx.remoteJid).text(quote);

        } catch (error) {
            console.error('KataKata error:', error.message);
            await ctx.react('');
            await client.send(ctx.remoteJid).text('❌ Terjadi kesalahan saat mengambil kata-kata!');
        }
    }
}

module.exports = KataKataFeature;