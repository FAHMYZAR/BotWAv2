const BaseFeature = require('../core/BaseFeature');

class HideTagFeature extends BaseFeature {
    constructor() {
        super('hidetag', 'Tag semua member tanpa tampilkan username', true);
    }

    async execute(m, sock, args) {
        try {
            if (!m.key.remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Perintah ini hanya bisa digunakan di grup!' 
                });
                return;
            }

            const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
            const participants = groupMetadata.participants;
            const mentions = participants.map(p => p.id);

            let text = args.join(' ');
            const quotedMsg = m.message?.extendedTextMessage?.contextInfo;

            if (quotedMsg && quotedMsg.stanzaId) {
                // Mode 1: Reply ke pesan yang di-quote dengan tag
                if (!text) {
                    text = '📢';
                }

                await sock.sendMessage(m.key.remoteJid, {
                    text: text,
                    mentions: mentions
                }, {
                    quoted: {
                        key: {
                            remoteJid: m.key.remoteJid,
                            fromMe: false,
                            id: quotedMsg.stanzaId,
                            participant: quotedMsg.participant
                        },
                        message: quotedMsg.quotedMessage
                    }
                });
            } else {
                // Mode 2: Kirim pesan baru dengan tag
                if (!text) {
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: '❌ Format: `/hidetag pesan` atau reply pesan' 
                    });
                    return;
                }

                await sock.sendMessage(m.key.remoteJid, {
                    text: text,
                    mentions: mentions
                });
            }

        } catch (error) {
            console.error('HideTag error:', error.message);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan!' 
            });
        }
    }
}

module.exports = HideTagFeature;
