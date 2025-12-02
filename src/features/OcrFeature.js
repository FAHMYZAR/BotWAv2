const BaseFeature = require('../core/BaseFeature');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class OcrFeature extends BaseFeature {
    constructor() {
        super('ocr', 'Extract text dari gambar', false);
        this.processing = new Set();
        this.maxSize = 10 * 1024 * 1024; // 10MB
    }

    async uploadToCatbox(buffer) {
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempPath = path.join(tempDir, `ocr_${Date.now()}.jpg`);
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

    async extractText(imageUrl) {
        const { data } = await axios.get(`${config.apis.resita}/tools/ocr`, {
            params: {
                link: imageUrl,
                apikey: config.resitaApiKey
            },
            timeout: 60000
        });
        
        if (!data.success || !data.text) {
            throw new Error('API OCR gagal');
        }
        
        return data.text;
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
                    text: '❌ Reply atau kirim gambar dengan caption `.ocr`' 
                });
                return;
            }

            this.processing.add(m.key.remoteJid);

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '📄', key: m.key }
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

            const extractedText = await this.extractText(imageUrl);

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            await sock.sendMessage(m.key.remoteJid, {
                text: `📄 *OCR Result*\n\n${extractedText}\n\n_✨ Extracted by FAHMYZZX-BOT_`
            });

        } catch (error) {
            console.error('OCR error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            
            let errorMsg = '❌ Gagal extract text dari gambar!';
            if (error.message.includes('API OCR gagal')) {
                errorMsg = '❌ API OCR sedang bermasalah! Coba lagi nanti';
            }
            
            await sock.sendMessage(m.key.remoteJid, { text: errorMsg });
        } finally {
            this.processing.delete(m.key.remoteJid);
        }
    }
}

module.exports = OcrFeature;
