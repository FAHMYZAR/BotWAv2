const BaseFeature = require('../core/BaseFeature');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

class RvoFeature extends BaseFeature {
    constructor() {
        super('rvo', 'Ekstrak media view once', false);
    }

    async execute(m, sock, args) {
        try {
            const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (!quotedMsg) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Balas ke media (View Once atau biasa) yang mau diambil!' 
                });
                return;
            }

            let viewOnce = 
                quotedMsg?.viewOnceMessageV2Extension?.message ||
                quotedMsg?.viewOnceMessageV2?.message ||
                quotedMsg?.viewOnceMessage?.message ||
                quotedMsg;

            let mediaType, mediaMessage;

            if (viewOnce?.imageMessage) {
                mediaType = 'image';
                mediaMessage = viewOnce.imageMessage;
            } else if (viewOnce?.videoMessage) {
                mediaType = 'video';
                mediaMessage = viewOnce.videoMessage;
            } else if (viewOnce?.audioMessage) {
                mediaType = 'audio';
                mediaMessage = viewOnce.audioMessage;
            } else {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Media tidak didukung untuk diekstrak!' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { text: '⏳ Mengekstrak media...' });

            const buffer = await downloadMediaMessage(
                { message: { [`${mediaType}Message`]: mediaMessage } },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );

            if (!buffer) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Gagal mengunduh media!' 
                });
                return;
            }

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const ext = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'mp3';
            const filename = path.join(tempDir, `${Date.now()}.${ext}`);
            fs.writeFileSync(filename, buffer);

            const caption = mediaMessage.caption || '';

            await sock.sendMessage(m.key.remoteJid, {
                [mediaType]: { url: filename },
                caption: caption ? `*Pesan:* ${caption}` : '✅ Media berhasil diambil!'
            });

            // Hapus file temp setelah kirim
            setTimeout(() => {
                if (fs.existsSync(filename)) {
                    fs.unlinkSync(filename);
                }
            }, 5000);

        } catch (error) {
            console.error('RVO error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: `❌ Gagal memproses media: ${error.message}` 
            });
        }
    }
}

module.exports = RvoFeature;
