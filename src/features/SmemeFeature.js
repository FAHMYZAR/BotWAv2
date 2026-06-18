const BaseFeature = require('../core/BaseFeature');
const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');

class SmemeFeature extends BaseFeature {
    constructor() {
        super('smeme', 'Buat meme dari gambar/sticker (reply gambar + teks)', false, 'media');
    }

    async execute(ctx, client, args) {
        try {
            const quoted = await ctx.replied().catch(() => null);
            const media = quoted?.media;
            
            if (!media || (media.type !== 'image' && media.type !== 'sticker')) {
                await ctx.reply('❌ Reply gambar/sticker dengan teks!\n\nContoh: .smeme teks atas|teks bawah');
                return;
            }

            if (!args.length) {
                await ctx.reply('❌ Masukkan teks!\n\nContoh: .smeme teks atas|teks bawah\nAtau: .smeme teks atas');
                return;
            }

            let buffer = await media.buffer();
            
            if (media.type === 'sticker') {
                buffer = await sharp(buffer).png().toBuffer();
            }

            const text = args.join(' ');
            const [topText, bottomText] = text.includes('|') ? text.split('|') : [text, ''];

            const memeBuffer = await this.createMeme(buffer, topText.trim(), bottomText.trim());

            const stickerBuffer = await sharp(memeBuffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 95 })
                .toBuffer();

            await client.send(ctx.roomId).sticker(stickerBuffer);

        } catch (error) {
            console.error('Smeme error:', error);
            await ctx.reply('❌ Gagal membuat meme!');
        }
    }

    async createMeme(imageBuffer, topText, bottomText) {
        const image = await loadImage(imageBuffer);
        const canvas = createCanvas(image.width, image.height);
        const ctxCanvas = canvas.getContext('2d');

        ctxCanvas.drawImage(image, 0, 0);

        const fontSize = Math.floor(image.width / 10);
        ctxCanvas.font = `900 ${fontSize}px Impact, sans-serif`;
        ctxCanvas.textAlign = 'center';
        ctxCanvas.textBaseline = 'top';

        if (topText) {
            const lines = this.wrapText(ctxCanvas, topText.toUpperCase(), image.width - 20);
            let y = 20;
            lines.forEach(line => {
                this.drawTextWithStroke(ctxCanvas, line, image.width / 2, y, fontSize);
                y += fontSize;
            });
        }

        if (bottomText) {
            const lines = this.wrapText(ctxCanvas, bottomText.toUpperCase(), image.width - 20);
            let y = image.height - (lines.length * fontSize) - 20;
            lines.forEach(line => {
                this.drawTextWithStroke(ctxCanvas, line, image.width / 2, y, fontSize);
                y += fontSize;
            });
        }

        return canvas.toBuffer('image/png');
    }

    drawTextWithStroke(ctx, text, x, y, fontSize) {
        const strokeWidth = Math.floor(fontSize / 8);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(text, x, y);
        
        ctx.lineWidth = strokeWidth * 1.5;
        ctx.strokeText(text, x, y);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, x, y);
    }

    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + ' ' + word).width;
            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }
}

module.exports = SmemeFeature;