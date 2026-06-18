const BaseFeature = require('../core/BaseFeature');
const KeynoteSystem = require('../utils/KeynoteSystem');

class ListNoteFeature extends BaseFeature {
    constructor() {
        super('listnote', 'Lihat daftar semua catatan', false, 'info');
    }

    async execute(ctx, client, args) {
        try {
            const notes = await KeynoteSystem.getAllKeynotes();
            const prefix = await KeynoteSystem.getPrefix();
            
            if (notes.length === 0) {
                await client.send(ctx.remoteJid).text('📝 *DAFTAR CATATAN*\n\n❌ Belum ada catatan tersimpan\n\n💡 Tambah catatan: !addkeynote [nama] [isi]');
                return;
            }

            let message = `📝 *DAFTAR CATATAN*\n\n`;
            message += `🔖 Prefix: ${prefix}\n`;
            message += `📊 Total: ${notes.length} catatan\n\n`;

            notes.forEach((note, index) => {
                message += `${index + 1}. ${prefix}${note.key}\n`;
            });

            message += `\n💡 Akses: Ketik ${prefix}[nama]`;

            await client.send(ctx.remoteJid).text(message);

        } catch (error) {
            console.error('ListNote error:', error);
            await client.send(ctx.remoteJid).text('❌ Terjadi kesalahan saat mengambil daftar catatan!');
        }
    }
}

module.exports = ListNoteFeature;
