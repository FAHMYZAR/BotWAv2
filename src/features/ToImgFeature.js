const BaseFeature = require('../core/BaseFeature');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class ToImgFeature extends BaseFeature {
    constructor() {
        super('toimg', 'Mengonversi stiker menjadi gambar', false);
    }

    async execute(m, sock, args) {
        try {
            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const stickerMessage = m.message.stickerMessage || quoted?.stickerMessage;
            const videoMessage = m.message.videoMessage || quoted?.videoMessage;

            if (!stickerMessage && !videoMessage) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '⚠️ Kirim/Reply sticker atau video dengan .toimg!' 
                });
                return;
            }

            // Handle video to gif
            if (videoMessage) {
                await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });
                
                const buffer = await downloadMediaMessage(
                    { message: { videoMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );

                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });

                await sock.sendMessage(m.key.remoteJid, {
                    video: buffer,
                    gifPlayback: true,
                    caption: '🎬 Video as GIF'
                });
                return;
            }

            const isAnimated = stickerMessage.isAnimated;

            await sock.sendMessage(m.key.remoteJid, { text: '⏳ Mengonversi stiker...' });

            const buffer = await downloadMediaMessage(
                { message: { stickerMessage } },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );

            if (!buffer) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Gagal mengunduh stiker!' 
                });
                return;
            }

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const baseName = `${Date.now()}`;
            const webpPath = path.join(tempDir, `${baseName}.webp`);
            const outputExt = isAnimated ? 'mp4' : 'png';
            const outputPath = path.join(tempDir, `${baseName}.${outputExt}`);

            fs.writeFileSync(webpPath, buffer);

            exec(`ffmpeg -i "${webpPath}" "${outputPath}"`, async (err) => {
                fs.unlinkSync(webpPath);

                if (err || !fs.existsSync(outputPath)) {
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: `❌ Konversi gagal: ${err?.message || 'Tidak diketahui'}` 
                    });
                    return;
                }

                const mediaBuffer = fs.readFileSync(outputPath);
                
                if (isAnimated) {
                    await sock.sendMessage(m.key.remoteJid, { 
                        video: mediaBuffer,
                        gifPlayback: true,
                        caption: '🎉 Sticker animasi → GIF!' 
                    });
                } else {
                    await sock.sendMessage(m.key.remoteJid, { 
                        image: mediaBuffer, 
                        caption: '🎉 Sticker → Image!' 
                    });
                }

                fs.unlinkSync(outputPath);
            });

        } catch (error) {
            console.error('ToImg error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: `❌ Gagal mengonversi: ${error.message}` 
            });
        }
    }
}

module.exports = ToImgFeature;
