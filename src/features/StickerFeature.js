const BaseFeature = require('../core/BaseFeature');
const sharp = require('sharp');

class StickerFeature extends BaseFeature {
    constructor() {
        super('sticker', 'Buat sticker dari gambar/video (sticker/s)', false, 'media');
        this.aliases = ['s'];
    }

    async execute(ctx, client, args) {
        try {
            const quoted = await ctx.replied().catch(() => null);
            const buffer = await (ctx.media?.buffer() || quoted?.media?.buffer());

            if (!buffer) {
                await ctx.reply('❌ Kirim/Reply gambar/video dengan .sticker atau .s\n\nTips: Video akan jadi sticker animasi!');
                return;
            }

            const stickerBuffer = await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp()
                .toBuffer();

            await client.send(ctx.roomId).sticker(stickerBuffer);
        } catch (error) {
            console.error('Sticker error:', error);
            await ctx.reply('❌ Gagal membuat sticker!');
        }
    }
}

module.exports = StickerFeature;
