const BaseFeature = require('../core/BaseFeature');

class TagAllFeature extends BaseFeature {
    constructor() {
        super('tagall', 'Tag semua member grup', true);
    }

    async execute(m, sock, args) {
        try {
            // Cek apakah di grup
            if (!m.key.remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Perintah ini hanya bisa digunakan di grup!' 
                });
                return;
            }

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
            const participants = groupMetadata.participants;

            // Get all member JIDs
            const mentions = participants.map(p => p.id);

            // Cek apakah ada pesan yang di-reply
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            let text = args.join(' ');

            if (quoted) {
                // Jika reply pesan, forward pesan yang di-reply dengan tag all
                const quotedText = quoted.conversation || 
                                  quoted.extendedTextMessage?.text || 
                                  quoted.imageMessage?.caption || 
                                  quoted.videoMessage?.caption || 
                                  'Media';

                text = text || '📢 *PERHATIAN!*';
                
                let message = `${text}\n\n`;
                message += `━━━━━━━━━━━━━━━\n`;
                message += `${quotedText}\n`;
                message += `━━━━━━━━━━━━━━━\n\n`;
                message += mentions.map(jid => `@${jid.split('@')[0]}`).join('\n');

                await sock.sendMessage(m.key.remoteJid, {
                    text: message,
                    mentions: mentions
                });
            } else {
                // Jika tidak ada reply, kirim pesan custom dengan tag all
                text = text || '📢 *TAG ALL*';
                
                let message = `${text}\n\n`;
                message += mentions.map(jid => `@${jid.split('@')[0]}`).join('\n');

                await sock.sendMessage(m.key.remoteJid, {
                    text: message,
                    mentions: mentions
                });
            }

        } catch (error) {
            console.error('TagAll error:', error.message);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat tag all!' 
            });
        }
    }
}

module.exports = TagAllFeature;
