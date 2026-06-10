const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class HadisFeature extends BaseFeature {
    constructor() {
        super('hadis', 'Dapatkan hadis acak dari Ensiklopedia Hadis', false, 'info');
    }

    async execute(m, sock, args) {
        try {
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '📖', key: m.key }
            });

            const response = await axios.get(config.apis.myquran.hadis.random, {
                timeout: 10000
            });

            if (!response.data.status || !response.data.data) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Gagal mengambil hadis!' 
                });
                return;
            }

            const hadis = response.data.data;
            
            let message = `*HADIS PILIHAN*\n\n`;
            message += `*${hadis.text.id}*\n\n`;
            message += `\`Riwayat :\` ${hadis.takhrij}\n`;
            message += `\`Status :\` ${hadis.grade}`;
            
            if (hadis.hikmah) {
                message += `\n\n*Hikmah:*\n${hadis.hikmah}`;
            }

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            await sock.sendMessage(m.key.remoteJid, {
                text: message,
                contextInfo: {
                    externalAdReply: {
                        title: 'Hadis Ensiklopedia',
                        body: `ID: ${hadis.id} • ${hadis.grade}`,
                        thumbnailUrl: 'https://files.catbox.moe/iu92u8.jpg',
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            });

        } catch (error) {
            console.error('Hadis error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat mengambil hadis!' 
            });
        }
    }

    // Method untuk scheduler (tanpa interaksi user)
    static async getRandomHadis() {
        try {
            const response = await axios.get(config.apis.myquran.hadis.random, {
                timeout: 10000
            });

            if (!response.data.status || !response.data.data) {
                return null;
            }

            const hadis = response.data.data;
            
            let message = `*${hadis.text.id}*\n\n`;
            message += `\`Riwayat :\` ${hadis.takhrij}\n`;
            message += `\`Status :\` ${hadis.grade}`;
            
            if (hadis.hikmah) {
                message += `\n\n*Hikmah:*\n${hadis.hikmah}`;
            }

            return message;
        } catch (error) {
            console.error('Random hadis error:', error.message);
            return null;
        }
    }
}

module.exports = HadisFeature;