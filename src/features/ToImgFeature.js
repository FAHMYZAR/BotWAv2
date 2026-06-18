const BaseFeature = require('../core/BaseFeature');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class ToImgFeature extends BaseFeature {
    constructor() {
        super('toimg', 'Mengonversi stiker menjadi gambar', false, 'media');
    }

    async execute(ctx, client, args) {
        try {
            const quoted = await ctx.replied().catch(() => null);
            const media = ctx.media || quoted?.media;
            const buffer = await media?.buffer();

            if (!buffer) {
                await ctx.reply('⚠️ Kirim/Reply sticker atau video dengan .toimg!');
                return;
            }

            if (media.type === 'video') {
                await client.send(ctx.roomId).video(buffer, { gifPlayback: true, caption: '🎬 Video as GIF' });
                return;
            }

            const isAnimated = Boolean(media.isAnimated || quoted?.message?.stickerMessage?.isAnimated);

            await ctx.reply('⏳ Mengonversi stiker...');

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
                    await ctx.reply(`❌ Konversi gagal: ${err?.message || 'Tidak diketahui'}`);
                    return;
                }

                const mediaBuffer = fs.readFileSync(outputPath);
                
                if (isAnimated) {
                    await client.send(ctx.roomId).video(mediaBuffer, { gifPlayback: true, caption: '🎉 Sticker animasi → GIF!' });
                } else {
                    await client.send(ctx.roomId).image(mediaBuffer, { caption: '🎉 Sticker → Image!' });
                }

                fs.unlinkSync(outputPath);
            });

        } catch (error) {
            console.error('ToImg error:', error);
            await ctx.reply(`❌ Gagal mengonversi: ${error.message}`);
        }
    }
}

module.exports = ToImgFeature;
