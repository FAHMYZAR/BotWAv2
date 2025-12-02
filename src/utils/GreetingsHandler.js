const axios = require('axios');

class GreetingsHandler {
    constructor(sock) {
        this.sock = sock;
        this.welcomeBanner = 'https://files.catbox.moe/fghoxj.webp';
        this.goodbyeBanner = 'https://files.catbox.moe/5cl9sb.jpg';
    }

    async handleJoin(groupJid, participants) {
        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const mentions = participants.map(p => p.phoneNumber || p.id || p);
            const names = mentions.map(p => `@${p.split('@')[0]}`).join(', ');
            
            let message = `👋 *SELAMAT DATANG!*\n\n`;
            message += `Halo ${names}!\n`;
            message += `Selamat bergabung di *${groupMetadata.subject}*\n\n`;
            message += `Semoga betah dan jangan lupa baca deskripsi grup ya!`;

            const bannerResponse = await axios.get(this.welcomeBanner, { 
                responseType: 'arraybuffer',
                timeout: 5000
            });

            await this.sock.sendMessage(groupJid, {
                image: Buffer.from(bannerResponse.data),
                caption: message,
                mentions: mentions
            });
        } catch (error) {
            console.error('Greetings Join error:', error.message);
        }
    }

    async handleLeave(groupJid, participants) {
        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const mentions = participants.map(p => p.phoneNumber || p.id || p);
            const names = mentions.map(p => `@${p.split('@')[0]}`).join(', ');
            
            let message = `👋 *SAYONARA!*\n\n`;
            message += `${names} telah meninggalkan grup\n\n`;
            message += `Semoga sukses selalu di luar sana!\n`;
            message += `Terima kasih sudah menjadi bagian dari *${groupMetadata.subject}*`;

            const bannerResponse = await axios.get(this.goodbyeBanner, { 
                responseType: 'arraybuffer',
                timeout: 5000
            });

            await this.sock.sendMessage(groupJid, {
                image: Buffer.from(bannerResponse.data),
                caption: message,
                mentions: mentions
            });
        } catch (error) {
            console.error('Greetings Leave error:', error.message);
        }
    }
}

module.exports = GreetingsHandler;
