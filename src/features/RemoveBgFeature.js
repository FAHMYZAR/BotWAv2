const BaseFeature = require('../core/BaseFeature');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class RemoveBgFeature extends BaseFeature {
    constructor() {
        super('rmbg', 'Hapus background gambar', false);
        this.processing = new Set();
        this.maxSize = 10 * 1024 * 1024; // 10MB
    }

    async uploadToCatbox(buffer) {
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempPath = path.join(tempDir, `rmbg_${Date.now()}.png`);
        fs.writeFileSync(tempPath, buffer);

        try {
            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', fs.createReadStream(tempPath));

            const { data } = await axios.post(config.apis.catbox, form, {
                headers: form.getHeaders(),
                timeout: 30000
            });

            if (!data || typeof data !== 'string' || !data.startsWith('https://')) {
                throw new Error('Invalid response from Catbox');
            }

            return data;
        } finally {
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }

    async removeBg(imageUrl) {
        const { data } = await axios.get(`${config.apis.resita}/tools/removebg`, {
            params: {
                link: imageUrl,
                apikey: config.resitaApiKey
            },
            timeout: 60000
        });
        
        if (!data.success || !data.data) {
            throw new Error('API removebg gagal');
        }
        
        return data.data;
    }

    async execute(m, sock, args) {
        try {
            if (this.processing.has(m.key.remoteJid)) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '⏳ Masih ada proses yang belum selesai, tunggu sebentar ya!' 
                });
                return;
            }

            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageMessage = m.message.imageMessage || quoted?.imageMessage;

            if (!imageMessage) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Reply atau kirim gambar dengan caption `.rmbg`' 
                });
                return;
            }

            this.processing.add(m.key.remoteJid);

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '⏳', key: m.key }
            });

            const buffer = await downloadMediaMessage(
                { message: { imageMessage } },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );

            if (buffer.length > this.maxSize) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Gambar terlalu besar! Maksimal 10MB' 
                });
                return;
            }

            let imageUrl;
            try {
                imageUrl = await this.uploadToCatbox(buffer);
            } catch (uploadError) {
                console.error('Catbox upload failed:', uploadError.message);
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Gagal upload gambar! Coba lagi nanti' 
                });
                return;
            }

            const resultUrl = await this.removeBg(imageUrl);

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            // Send as document PNG
            await sock.sendMessage(m.key.remoteJid, {
                document: { url: resultUrl },
                mimetype: 'image/png',
                fileName: 'nobg.png',
                caption: '✅ Background berhasil dihapus!\n\n🔗 Link: ' + resultUrl
            });

        } catch (error) {
            console.error('RemoveBg error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            
            let errorMsg = '❌ Gagal hapus background!';
            if (error.message.includes('API removebg gagal')) {
                errorMsg = '❌ API RemoveBG sedang bermasalah! Coba lagi nanti';
            }
            
            await sock.sendMessage(m.key.remoteJid, { text: errorMsg });
        } finally {
            this.processing.delete(m.key.remoteJid);
        }
    }
}

module.exports = RemoveBgFeature;
