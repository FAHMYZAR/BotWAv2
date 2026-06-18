const BaseFeature = require('../core/BaseFeature');
const KeynoteSystem = require('../utils/KeynoteSystem');

class DelNoteFeature extends BaseFeature {
    constructor() {
        super('delnote', 'Hapus catatan', true, 'owner');
    }

    async execute(ctx, client, args) {
        try {
            if (!args.length) {
                await client.send(ctx.remoteJid).text('❌ Format: !delnote [nama]\n\n📝 Contoh: !delnote aku');
                return;
            }

            const noteName = args[0];
            const note = await KeynoteSystem.getKeynote(noteName);

            if (!note) {
                await client.send(ctx.remoteJid).text(`❌ *Catatan tidak ditemukan!*\n\n📝 Nama: ${noteName}\n⚠️ Catatan tidak ada di database`);
                return;
            }

            const noteContent = note.content;
            
            // Delete note
            const success = await KeynoteSystem.deleteKeynote(noteName);
            if (!success) {
                await client.send(ctx.remoteJid).text(`❌ Gagal menghapus keynote "${noteName}"!`);
                return;
            }

            await client.send(ctx.remoteJid).text(`🗑️ *Catatan Berhasil Dihapus!*\n\n` +
                      `📝 Nama: ${noteName}\n` +
                      `📄 Content: ${noteContent}\n\n` +
                      `✅ Catatan telah dihapus dari database`);

        } catch (error) {
            console.error('DelNote error:', error);
            await client.send(ctx.remoteJid).text('❌ Terjadi kesalahan saat menghapus catatan!');
        }
    }
}

module.exports = DelNoteFeature;
