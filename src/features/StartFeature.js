const BaseFeature = require('../core/BaseFeature');
const fs = require('fs');
const path = require('path');

class StartFeature extends BaseFeature {
    constructor() {
        super('start', 'Pesan selamat datang', false, 'info');
    }

    async execute(m, sock, args) {
        try {
            const imagePath = path.join(__dirname, '../../disk/welcome.png');
            const imageBuffer = fs.readFileSync(imagePath);
            
            const caption = 
                `👋 *SELAMAT DATANG!*\n\n` +
                `*📋 INFO*\n` +
                `> Gunakan \`.help\` untuk melihat daftar perintah\n\n` +
                `_🔥 EL-RUWET [BOT + AI] © ${new Date().getFullYear()}_`;

            await sock.sendMessage(m.key.remoteJid, {
                image: imageBuffer,
                caption: caption
            });

        } catch (error) {
            await this.handleError(m, sock, error);
        }
    }

    async handleError(m, sock, error) {
        console.error(`${this.name} error:`, error);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Terjadi kesalahan!' });
    }
}

module.exports = StartFeature;
