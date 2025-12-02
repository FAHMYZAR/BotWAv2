/**
 * Template untuk membuat fitur baru
 * 
 * Cara menggunakan:
 * 1. Copy file ini ke src/features/
 * 2. Rename sesuai nama fitur (contoh: DownloadFeature.js)
 * 3. Edit constructor dan execute method
 * 4. Restart bot (npm run dev)
 * 5. Fitur otomatis terdaftar!
 */

const BaseFeature = require('./src/core/BaseFeature');
const MessageHelper = require('./src/utils/MessageHelper');

class TemplateFeature extends BaseFeature {
    constructor() {
        // super(command_name, description, ownerOnly)
        super('template', 'Deskripsi fitur template', false);
    }

    async execute(message, chat, args) {
        try {
            // ============================================
            // CONTOH: Mengambil quoted message
            // ============================================
            const quotedMsg = await MessageHelper.getQuotedMessage(message);
            if (!quotedMsg) {
                await chat.sendMessage('❌ Reply pesan terlebih dahulu!');
                return;
            }

            // ============================================
            // CONTOH: Mengambil contact info
            // ============================================
            const contact = await MessageHelper.getContact(message);
            const name = contact.pushname || 'Unknown';

            // ============================================
            // CONTOH: Download media
            // ============================================
            const media = await MessageHelper.downloadMedia(message);
            if (!media) {
                await chat.sendMessage('❌ Tidak ada media!');
                return;
            }

            // ============================================
            // CONTOH: Validasi arguments
            // ============================================
            if (args.length < 1) {
                await chat.sendMessage('❌ Format: !template [argument]');
                return;
            }

            const argument = args[0];

            // ============================================
            // CONTOH: Send message dengan retry
            // ============================================
            await MessageHelper.sendWithRetry(
                chat, 
                '✅ Fitur template berhasil dijalankan!',
                {},
                3 // retry 3x jika gagal
            );

            // ============================================
            // CONTOH: Send media
            // ============================================
            // await chat.sendMessage(media, { 
            //     caption: 'Caption here',
            //     sendMediaAsSticker: true 
            // });

            // ============================================
            // CONTOH: Progress indicator
            // ============================================
            // const msg = await chat.sendMessage('⏳ Processing...');
            // // Do something...
            // await msg.edit('✅ Done!');

        } catch (error) {
            // Error handling otomatis dari BaseFeature
            await this.handleError(chat, error);
        }
    }
}

module.exports = TemplateFeature;

/**
 * TIPS:
 * 
 * 1. Gunakan MessageHelper untuk operasi message
 * 2. Gunakan SystemHelper untuk info sistem
 * 3. Selalu gunakan try-catch
 * 4. Validasi input dari user
 * 5. Berikan feedback yang jelas
 * 6. Log error untuk debugging
 * 
 * CONTOH FITUR OWNER ONLY:
 * super('admin', 'Admin command', true); // true = owner only
 * 
 * CONTOH MENGAKSES CONFIG:
 * const config = require('./config/config');
 * const prefix = config.getPrefix(isOwner);
 */
