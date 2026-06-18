const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class ReminiFeature extends BaseFeature {
    constructor() {
        super('remini', 'Enhance kualitas gambar menjadi HD', false, 'media');
        this.processing = new Set();
        this.maxSize = 10 * 1024 * 1024; // 10MB
    }

    async uploadToCatbox(buffer) {
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempPath = path.join(tempDir, `remini_${Date.now()}.jpg`);
        fs.writeFileSync(tempPath, buffer);

        try {
            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', fs.createReadStream(tempPath));

            const { data } = await axios.post(config.apis.catbox, form, {
                headers: form.getHeaders(),
                timeout: 30000
            });

            if (!data || typeof data !== 'string' || !data.startsWith('https://')) throw new Error('Invalid response from Catbox');
            return data;
        } finally {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }
    }

    async reminiImage(imageUrl) {
        const { data } = await axios.get(`${config.apis.resita}/tools/remini`, {
            params: {
                link: imageUrl,
                apikey: config.resitaApiKey
            }
        });
        
        if (!data.success || !data.data) throw new Error('API remini gagal');
        return data.data;
    }

    async execute(ctx, client, args) {
        try {
            if (this.processing.has(ctx.roomId)) {
                await ctx.reply('⏳ Masih ada proses yang belum selesai, tunggu sebentar ya!');
                return;
            }

            const quoted = await ctx.replied().catch(() => null);
            const media = ctx.media || quoted?.media;
            const buffer = await media?.buffer();

            if (!buffer || media?.type !== 'image') {
                await ctx.reply('❌ Reply atau kirim gambar dengan caption `.remini`');
                return;
            }

            this.processing.add(ctx.roomId);

            if (buffer.length > this.maxSize) {
                await ctx.reply('❌ Gambar terlalu besar! Maksimal 10MB');
                return;
            }

            let imageUrl;
            try {
                imageUrl = await this.uploadToCatbox(buffer);
            } catch (uploadError) {
                console.error('Catbox upload failed:', uploadError.message);
                await ctx.reply('❌ Gagal upload gambar! Coba lagi nanti');
                return;
            }

            const enhancedUrl = await this.reminiImage(imageUrl);
            await client.send(ctx.roomId).image({ url: enhancedUrl }, { caption: '✅ Gambar berhasil di-enhance!\n\n✨ Enhanced by Remini AI' });

        } catch (error) {
            console.error('Remini error:', error.message);
            
            let errorMsg = '❌ Gagal enhance gambar!';
            if (error.message.includes('API remini gagal')) errorMsg = '❌ API Remini sedang bermasalah! Coba lagi nanti';
            
            await ctx.reply(errorMsg);
        } finally {
            this.processing.delete(ctx.roomId);
        }
    }
}

module.exports = ReminiFeature;
