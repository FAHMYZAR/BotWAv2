class GreetingsHandler {
    constructor(sock) {
        this.sock = sock;
        this.welcomeBanner = 'https://files.catbox.moe/fghoxj.webp';
        this.goodbyeBanner = 'https://files.catbox.moe/5cl9sb.jpg';
        this.processing = new Set();
    }

    async handleJoin(groupJid, participants) {
        const key = `join_${groupJid}`;
        if (this.processing.has(key)) {
            console.log('[GREETINGS] Already processing join for', groupJid);
            return;
        }
        
        this.processing.add(key);
        
        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const mentions = participants.map(p => p.phoneNumber || p.id || p);
            const names = mentions.map(p => `@${p.split('@')[0]}`).join(', ');
            
            let message = `👋 *SELAMAT DATANG!*\n\n`;
            message += `Halo ${names}!\n`;
            message += `Selamat bergabung di *${groupMetadata.subject}*\n\n`;
            message += `Semoga betah dan jangan lupa baca deskripsi grup ya!`;

            await this.sock.sendMessage(groupJid, {
                text: message,
                mentions: mentions,
                contextInfo: {
                    externalAdReply: {
                        title: 'Selamat Datang!',
                        body: groupMetadata.subject,
                        thumbnailUrl: this.welcomeBanner,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            });
        } catch (error) {
            console.error('[GREETINGS] Join error:', error.message);
        } finally {
            this.processing.delete(key);
        }
    }

    async handleLeave(groupJid, participants) {
        const key = `leave_${groupJid}`;
        if (this.processing.has(key)) {
            console.log('[GREETINGS] Already processing leave for', groupJid);
            return;
        }
        
        this.processing.add(key);
        
        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const mentions = participants.map(p => p.phoneNumber || p.id || p);
            const names = mentions.map(p => `@${p.split('@')[0]}`).join(', ');
            
            let message = `👋 *SAYONARA!*\n\n`;
            message += `${names} telah meninggalkan grup\n\n`;
            message += `Semoga sukses selalu di luar sana!\n`;
            message += `Terima kasih sudah menjadi bagian dari *${groupMetadata.subject}*`;

            await this.sock.sendMessage(groupJid, {
                text: message,
                mentions: mentions,
                contextInfo: {
                    externalAdReply: {
                        title: 'Sayonara!',
                        body: groupMetadata.subject,
                        thumbnailUrl: this.goodbyeBanner,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            });
        } catch (error) {
            console.error('[GREETINGS] Leave error:', error.message);
        } finally {
            this.processing.delete(key);
        }
    }
}

module.exports = GreetingsHandler;
