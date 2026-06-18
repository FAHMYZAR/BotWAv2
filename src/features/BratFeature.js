const BaseFeature = require('../core/BaseFeature');
const { bratGenerator } = require('qc-generator-whatsapp');

class BratFeature extends BaseFeature {
    constructor() {
        super('brat', 'Membuat stiker brat', false, 'media');
    }

    async execute(ctx, client, args) {
        try {
            let text = args.join(' ');

            // Check if replying to a message
            if (!text && (await ctx.replied().catch(()=>null))?.message) {
                const quotedText = (await ctx.replied().catch(()=>null))?.message.conversation ||
                                  (await ctx.replied().catch(()=>null))?.message.extendedTextMessage?.text ||
                                  '';
                text = quotedText;
            }

            if (!text) {
                await client.send(ctx.remoteJid).text('❌ Masukkan teks atau reply pesan!\n\nContoh:\n> .brat hello world\n> Reply pesan + .brat');
                return;
            }
            await ctx.react('⏳');

            const imageBuffer = await bratGenerator(text);
            
            // Convert to proper WebP sticker
            const sharp = require('sharp');
            const stickerBuffer = await sharp(imageBuffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 95 })
                .toBuffer();
            
            await ctx.react('');
            await client.send(ctx.remoteJid).sticker(stickerBuffer );

        } catch (error) {
            console.error('Brat error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal membuat Brat Sticker. Coba lagi nanti.');
        }
    }
}

module.exports = BratFeature;
