const BaseFeature = require('../core/BaseFeature');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');

class StickerFeature extends BaseFeature {
    constructor() {
        super('sticker', 'Buat sticker dari gambar/video (sticker/s)', false);
        this.aliases = ['s']; // Shortcut
    }

    async execute(m, sock, args) {
        try {
            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageMessage = m.message.imageMessage || quoted?.imageMessage;
            const videoMessage = m.message.videoMessage || quoted?.videoMessage;

            if (!imageMessage && !videoMessage) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Kirim/Reply gambar/video dengan .sticker atau .s\n\nTips: Video akan jadi sticker animasi!' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            let buffer;
            if (imageMessage) {
                buffer = await downloadMediaMessage(
                    { message: { imageMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
            } else {
                buffer = await downloadMediaMessage(
                    { message: { videoMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
            }

            const stickerBuffer = await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp()
                .toBuffer();

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            await sock.sendMessage(m.key.remoteJid, {
                sticker: stickerBuffer
            });

        } catch (error) {
            console.error('Sticker error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Gagal membuat sticker!' 
            });
        }
    }
}

module.exports = StickerFeature;
