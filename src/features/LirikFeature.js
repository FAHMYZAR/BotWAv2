const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class LirikFeature extends BaseFeature {
    constructor() {
        super('lirik', 'Cari lirik lagu', false);
    }

    async execute(m, sock, args) {
        try {
            const judul = args.join(' ');

            if (!judul) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Masukkan judul lagu!\n\nContoh: .lirik faded' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '🎵', key: m.key } });

            const response = await axios.get(`${config.apis.resita}/search/lirik`, {
                params: { judul, apikey: config.resitaApiKey },
                timeout: 30000
            });

            if (!response.data.success) {
                throw new Error('API returned error');
            }

            const data = response.data.data;
            
            let message = `🎵 *LIRIK LAGU*\n\n`;
            message += `*🎤 ARTIS*\n> \`${data.artis}\`\n`;
            message += `*📝 JUDUL*\n> \`${data.judul}\`\n\n`;
            message += `*📜 LIRIK*\n${data.lirik}`;

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            await sock.sendMessage(m.key.remoteJid, { 
                text: message 
            });

        } catch (error) {
            console.error('Lirik error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Lirik tidak ditemukan! Coba judul lagu yang lain.' 
            });
        }
    }
}

module.exports = LirikFeature;
