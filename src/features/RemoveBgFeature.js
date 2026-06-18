const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class RemoveBgFeature extends BaseFeature {
    constructor() {
        super('rmbg', 'Hapus background gambar', false, 'media');
        this.processing = new Set();
        this.maxSize = 10 * 1024 * 1024; // 10MB
    }

    async uploadToCatbox(buffer) {
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

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

            if (!data || typeof data !== 'string' || !data.startsWith('https://')) throw new Error('Invalid response from Catbox');
            return data;
        } finally {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
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
        
        if (!data.success || !data.data) throw new Error('API removebg gagal');
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
                await ctx.reply('❌ Reply atau kirim gambar dengan caption `.rmbg`');
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

            const resultUrl = await this.removeBg(imageUrl);
            await client.send(ctx.roomId).document({ url: resultUrl }, {
                mimetype: 'image/png',
                fileName: 'nobg.png',
                caption: '✅ Background berhasil dihapus!\n\n🔗 Link: ' + resultUrl
            });

        } catch (error) {
            console.error('RemoveBg error:', error.message);
            
            let errorMsg = '❌ Gagal hapus background!';
            if (error.message.includes('API removebg gagal')) errorMsg = '❌ API RemoveBG sedang bermasalah! Coba lagi nanti';
            
            await ctx.reply(errorMsg);
        } finally {
            this.processing.delete(ctx.roomId);
        }
    }
}

module.exports = RemoveBgFeature;
