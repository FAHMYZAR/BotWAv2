const BaseFeature = require('../core/BaseFeature');
const KeynoteSystem = require('../utils/KeynoteSystem');

class DelNoteFeature extends BaseFeature {
    constructor() {
        super('delnote', 'Hapus catatan', true, 'owner');
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
            const note = await KeynoteSystem.getKeynote(noteName);

            if (!note) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ *Catatan tidak ditemukan!*\n\n📝 Nama: ${noteName}\n⚠️ Catatan tidak ada di database`
                });
                return;
            }

            const noteContent = note.content;
            
            // Delete note
            const success = await KeynoteSystem.deleteKeynote(noteName);
            if (!success) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ Gagal menghapus keynote "${noteName}"!` 
                });
                return;
            }

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
