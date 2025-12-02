const BaseFeature = require('../core/BaseFeature');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class HdFeature extends BaseFeature {
    constructor() {
        super('hdsw', 'Convert document video ke media player HD dengan kompresi smart (max 15MB)', false);
    }

    async execute(m, sock, args) {
        try {
            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const documentMessage = m.message.documentMessage || quoted?.documentMessage;

            if (!documentMessage) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Reply document video dengan .hdsw [caption] untuk convert ke media player HD!' 
                });
                return;
            }

            // Get custom caption dari args
            const customCaption = args.join(' ').trim();

            // Cek apakah document adalah video
            const mimetype = documentMessage.mimetype || '';
            if (!mimetype.includes('video')) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Document harus berupa video!' 
                });
                return;
            }

            // Cek ukuran file (max 100MB)
            const fileSize = documentMessage.fileLength || 0;
            const sizeInMB = fileSize / (1024 * 1024);
            
            if (sizeInMB > 100) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ Video terlalu besar! (${sizeInMB.toFixed(2)} MB)\nMaksimal 100 MB.` 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { 
                text: `⏳ Processing video HD (${sizeInMB.toFixed(2)} MB)...` 
            });

            // Download document
            const buffer = await downloadMediaMessage(
                { message: { documentMessage } },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );

            if (!buffer) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Gagal download video!' 
                });
                return;
            }

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const inputFile = path.join(tempDir, `hd_input_${Date.now()}.mp4`);
            const outputFile = path.join(tempDir, `hd_output_${Date.now()}.mp4`);
            fs.writeFileSync(inputFile, buffer);

            // Compress dengan prioritas HD quality + small size + audio jernih
            // CRF 23 = balance perfect antara quality & size (lower = better quality, bigger size)
            // preset slow = kompresi maksimal dengan quality terjaga
            const ffmpegCmd = `ffmpeg -i "${inputFile}" -c:v libx264 -preset slow -crf 23 -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease" -c:a aac -b:a 192k -movflags +faststart -y "${outputFile}"`;
            
            await execPromise(ffmpegCmd);

            // Kirim video hasil kompresi
            const compressedBuffer = fs.readFileSync(outputFile);
            
            await sock.sendMessage(m.key.remoteJid, {
                video: compressedBuffer,
                caption: customCaption || '',
                gifPlayback: false
            });

            // Cleanup
            fs.unlinkSync(inputFile);
            fs.unlinkSync(outputFile);

        } catch (error) {
            console.error('HD error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Gagal memproses video!' 
            });
        }
    }
}

module.exports = HdFeature;
