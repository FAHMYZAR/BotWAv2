const BaseFeature = require('../core/BaseFeature');
const { delay } = require('@whiskeysockets/baileys');

class PurgeFeature extends BaseFeature {
    constructor() {
        super('purge', 'Hapus pesan dari quoted sampai terbaru', true);
    }

    async execute(m, sock, args) {
        try {
            const quoted = m.message.extendedTextMessage?.contextInfo;
            
            if (!quoted || !quoted.stanzaId) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Reply pesan yang ingin dijadikan awal penghapusan!' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { text: '🔥 Memulai purge...' });

            // Delete command message
            await sock.sendMessage(m.key.remoteJid, { delete: m.key });
            await delay(500);

            // Note: Baileys tidak support fetch messages history seperti whatsapp-web.js
            // Jadi kita hanya bisa delete message yang kita reply
            await sock.sendMessage(m.key.remoteJid, { 
                delete: { 
                    remoteJid: m.key.remoteJid, 
                    fromMe: true, 
                    id: quoted.stanzaId, 
                    participant: quoted.participant 
                } 
            });

            await sock.sendMessage(m.key.remoteJid, { 
                text: '✅ Purge selesai!\n\n_Note: Baileys hanya bisa delete message yang di-reply._' 
            });

        } catch (error) {
            console.error('Purge error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Gagal purge!' 
            });
        }
    }
}

module.exports = PurgeFeature;
