const BaseFeature = require('../core/BaseFeature');
const { loadKeynotes, saveKeynotes } = require('../../keynoteDB');

class DelNoteFeature extends BaseFeature {
    constructor() {
        super('delnote', 'Hapus catatan', true);
    }

    async execute(m, sock, args) {
        try {
            if (!args.length) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Format: !delnote [nama]\n\n📝 Contoh: !delnote aku' 
                });
                return;
            }

            const noteName = args[0];
            const store = loadKeynotes();

            // Check if note exists using hasOwnProperty (safe from prototype pollution)
            if (!Object.prototype.hasOwnProperty.call(store.notes, noteName)) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ *Catatan tidak ditemukan!*\n\n📝 Nama: ${noteName}\n⚠️ Catatan tidak ada di database`
                });
                return;
            }

            const noteContent = store.notes[noteName].content;
            
            // Delete note
            delete store.notes[noteName];
            saveKeynotes(store);

            await sock.sendMessage(m.key.remoteJid, { 
                text: `🗑️ *Catatan Berhasil Dihapus!*\n\n` +
                      `📝 Nama: ${noteName}\n` +
                      `📄 Content: ${noteContent}\n\n` +
                      `✅ Catatan telah dihapus dari database`
            });

        } catch (error) {
            console.error('DelNote error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat menghapus catatan!'
            });
        }
    }
}

module.exports = DelNoteFeature;
