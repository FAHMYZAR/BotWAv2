const { normalizeRecipient, normalizeUserJid } = require('./JidHelper');

class GreetingsHandler {
    constructor(client) {
        this.client = client;
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
            groupJid = normalizeRecipient(groupJid);
            const groupMetadata = await this.client.group.metadata(groupJid);
            const mentions = participants.map(p => normalizeUserJid(p.phoneNumber || p.id || p)).filter(Boolean);
            const names = mentions.map(p => `@${p.split('@')[0]}`).join(', ');
            
            let message = `👋 *SELAMAT DATANG!*\n\n`;
            message += `Halo ${names}!\n`;
            message += `Selamat bergabung di *${groupMetadata.subject}*\n\n`;
            message += `Semoga betah dan jangan lupa baca deskripsi grup ya!`;

            await this.client.send(groupJid).text(message).mentions(mentions);
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
            groupJid = normalizeRecipient(groupJid);
            const groupMetadata = await this.client.group.metadata(groupJid);
            const mentions = participants.map(p => normalizeUserJid(p.phoneNumber || p.id || p)).filter(Boolean);
            const names = mentions.map(p => `@${p.split('@')[0]}`).join(', ');
            
            let message = `👋 *SAYONARA!*\n\n`;
            message += `${names} telah meninggalkan grup\n\n`;
            message += `Semoga sukses selalu di luar sana!\n`;
            message += `Terima kasih sudah menjadi bagian dari *${groupMetadata.subject}*`;

            await this.client.send(groupJid).text(message).mentions(mentions);
        } catch (error) {
            console.error('[GREETINGS] Leave error:', error.message);
        } finally {
            this.processing.delete(key);
        }
    }
}

module.exports = GreetingsHandler;
