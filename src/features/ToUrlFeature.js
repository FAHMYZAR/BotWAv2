const BaseFeature = require('../core/BaseFeature');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class ToUrlFeature extends BaseFeature {
    constructor() {
        super('tourl', 'Mengubah media menjadi URL', false);
    }

    async execute(m, sock, args) {
        try {
            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageMessage = m.message.imageMessage || quoted?.imageMessage;
            const videoMessage = m.message.videoMessage || quoted?.videoMessage;

            if (!imageMessage && !videoMessage) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Reply atau kirim gambar/video dengan caption .tourl' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { text: '⏳ Mengupload media...' });

            let buffer;
            let mime;

            if (imageMessage) {
                buffer = await downloadMediaMessage(
                    { message: { imageMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
                mime = 'image';
            } else {
                buffer = await downloadMediaMessage(
                    { message: { videoMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
                mime = 'video';
            }

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

            const tempFileName = `temp_${Date.now()}.${mime === 'image' ? 'jpg' : 'mp4'}`;
            const tempPath = path.join(tempDir, tempFileName);
            fs.writeFileSync(tempPath, buffer);

            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', fs.createReadStream(tempPath));

            const res = await axios.post(config.apis.catbox, form, {
                headers: form.getHeaders()
            });

            fs.unlinkSync(tempPath);

            if (res.data && typeof res.data === 'string' && res.data.startsWith('https://')) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `✅ *URL:*\n${res.data}` 
                });
            } else {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Gagal mengupload ke Catbox!' 
                });
            }

        } catch (error) {
            console.error('ToUrl error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat mengupload media!' 
            });
        }
    }
}

module.exports = ToUrlFeature;
