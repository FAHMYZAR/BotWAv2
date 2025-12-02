const BaseFeature = require('../core/BaseFeature');
const { bratGenerator } = require('qc-generator-whatsapp');

class BratFeature extends BaseFeature {
    constructor() {
        super('brat', 'Membuat stiker brat', false);
    }

    async execute(m, sock, args) {
        try {
            let text = args.join(' ');

            // Check if replying to a message
            if (!text && m.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedText = m.message.extendedTextMessage.contextInfo.quotedMessage.conversation ||
                                  m.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text ||
                                  '';
                text = quotedText;
            }

            if (!text) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Masukkan teks atau reply pesan!\n\nContoh:\n> .brat hello world\n> Reply pesan + .brat' 
                });
                return;
            }
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '⏳', key: m.key }
            });

            const imageBuffer = await bratGenerator(text);
            
            // Convert to proper WebP sticker
            const sharp = require('sharp');
            const stickerBuffer = await sharp(imageBuffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 95 })
                .toBuffer();
            
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { sticker: stickerBuffer });

        } catch (error) {
            console.error('Brat error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Gagal membuat Brat Sticker. Coba lagi nanti.' 
            });
        }
    }
}

module.exports = BratFeature;
