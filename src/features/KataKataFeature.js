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

    async execute(m, sock, args) {
        try {
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '💭', key: m.key }
            });

            const quoteType = this.getRandomQuoteType();
            
            const response = await axios.get(quoteType.url, {
                params: { apikey: config.pituCodeApiKey },
                timeout: 10000
            });

            if (!response.data.success || !response.data.result) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Gagal mengambil kata-kata!' 
                });
                return;
            }

            const quote = response.data.result;
            
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            await sock.sendMessage(m.key.remoteJid, {
                text: quote
            });

        } catch (error) {
            console.error('KataKata error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat mengambil kata-kata!' 
            });
        }
    }
}

module.exports = KataKataFeature;