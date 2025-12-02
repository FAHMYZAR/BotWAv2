const BaseFeature = require('../core/BaseFeature');
const { loadKeynotes } = require('../../keynoteDB');

class ListNoteFeature extends BaseFeature {
    constructor() {
        super('listnote', 'Lihat daftar semua catatan', false);
    }

    async execute(m, sock, args) {
        try {
            const store = loadKeynotes();
            
            // Get all note names using Object.keys (safe from prototype pollution)
            const noteNames = Object.keys(store.notes).filter(key => 
                Object.prototype.hasOwnProperty.call(store.notes, key)
            );

            if (noteNames.length === 0) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '📝 *DAFTAR CATATAN*\n\n❌ Belum ada catatan tersimpan\n\n💡 Tambah catatan: !addkeynote [nama] [isi]'
                });
                return;
            }

            let message = `📝 *DAFTAR CATATAN*\n\n`;
            message += `🔖 Prefix: ${store.prefix}\n`;
            message += `📊 Total: ${noteNames.length} catatan\n\n`;

            noteNames.forEach((name, index) => {
                message += `${index + 1}. ${store.prefix}${name}\n`;
            });

            message += `\n💡 Akses: Ketik ${store.prefix}[nama]`;

            await sock.sendMessage(m.key.remoteJid, { text: message });

        } catch (error) {
            console.error('ListNote error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat mengambil daftar catatan!'
            });
        }
    }
}

module.exports = ListNoteFeature;
