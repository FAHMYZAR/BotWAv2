const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class ToUrlFeature extends BaseFeature {
    constructor() {
        super('tourl', 'Mengubah media menjadi URL', false, 'tools');
    }

    async execute(ctx, client, args) {
        try {
            const quoted = await ctx.replied().catch(() => null);
            const media = ctx.media || quoted?.media;
            const buffer = await media?.buffer();

            if (!buffer) {
                await ctx.reply('❌ Reply atau kirim gambar/video dengan caption .tourl');
                return;
            }

            await ctx.reply('⏳ Mengupload media...');

            const mime = media.type === 'video' ? 'video' : 'image';
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

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
                await ctx.reply(`✅ *URL:*\n${res.data}`);
            } else {
                await ctx.reply('❌ Gagal mengupload ke Catbox!');
            }

        } catch (error) {
            console.error('ToUrl error:', error);
            await ctx.reply('❌ Terjadi kesalahan saat mengupload media!');
        }
    }
}

module.exports = ToUrlFeature;
