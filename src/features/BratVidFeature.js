const BaseFeature = require('../core/BaseFeature');
const { bratVidGenerator, generateAnimatedBratVid } = require('qc-generator-whatsapp');
const fs = require('fs').promises;
const path = require('path');

class BratVidFeature extends BaseFeature {
    constructor() {
        super('bratvid', 'Membuat stiker brat video', false);
    }

    async execute(m, sock, args) {
        try {
            if (!args.length) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Masukkan teks untuk Brat Video!\n\nContoh: .bratvid hello world' 
                });
                return;
            }

            const text = args.join(' ');
            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            // Generate frames
            const frames = await bratVidGenerator(text, 512, 512, '#FFFFFF', '#000000', []);

            // Save frames to temp directory
            const tempDir = path.join(__dirname, '../../temp/bratvid_frames');
            await fs.mkdir(tempDir, { recursive: true });

            for (let i = 0; i < frames.length; i++) {
                await fs.writeFile(path.join(tempDir, `frame_${i + 1}.png`), frames[i]);
            }

            // Generate animated WebP
            const outputPath = path.join(__dirname, '../../temp/bratvid.webp');
            await generateAnimatedBratVid(tempDir, outputPath);

            // Send sticker with proper metadata
            const stickerBuffer = await fs.readFile(outputPath);
            
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            
            await sock.sendMessage(m.key.remoteJid, { 
                sticker: stickerBuffer,
                mimetype: 'image/webp'
            });

            // Cleanup
            await fs.rm(tempDir, { recursive: true });
            await fs.unlink(outputPath);

        } catch (error) {
            console.error('BratVid error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Gagal membuat Brat Video. Coba lagi nanti.' 
            });
        }
    }
}

module.exports = BratVidFeature;
