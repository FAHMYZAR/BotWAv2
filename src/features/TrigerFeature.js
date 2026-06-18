const BaseFeature = require('../core/BaseFeature');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');

class TrigerFeature extends BaseFeature {
    constructor() {
        super('triger', 'Buat efek "triggered" deep-fried', false, 'fun');
    }

    async execute(ctx, client, args) {
        try {
            const quoted = await ctx.replied().catch(() => null);
            const media = ctx.media || quoted?.media;
            const buffer = await media?.buffer();

            if (!buffer) {
                await ctx.reply('❌ Kirim gambar/sticker atau reply gambar/sticker!');
                return;
            }

            await ctx.react('⏳');

            let deepFried = await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toFormat('png')
                .toBuffer();
            
            deepFried = await sharp(deepFried)
                .modulate({
                    brightness: 1.0,
                    saturation: 2.5,
                    hue: Math.floor(Math.random() * 60) - 30
                })
                .linear(1.3, -15)
                .toFormat('png')
                .toBuffer();
            
            const canvas = createCanvas(512, 512);
            const canvasCtx = canvas.getContext('2d');
            
            const img = await loadImage(deepFried);
            canvasCtx.drawImage(img, 0, 0, 512, 512);
            
            const emojis = ['😂', '💀', '🔥', '💯', '😭', '🤣', '👌', '💥'];
            const colors = ['#FF0000', '#FF6B00', '#FFD700', '#00FF00', '#00FFFF', '#0080FF', '#FF00FF', '#FF1493'];
            canvasCtx.font = 'bold 60px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
            
            for (let i = 0; i < 8; i++) {
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                const color = colors[Math.floor(Math.random() * colors.length)];
                const x = Math.random() * 450 + 30;
                const y = Math.random() * 450 + 30;
                const rotation = Math.random() * Math.PI * 2;
                
                canvasCtx.save();
                canvasCtx.translate(x, y);
                canvasCtx.rotate(rotation);
                canvasCtx.globalAlpha = 0.8;
                canvasCtx.shadowColor = color;
                canvasCtx.shadowBlur = 15;
                canvasCtx.fillStyle = color;
                canvasCtx.fillText(emoji, 0, 0);
                canvasCtx.restore();
            }
            
            const centerX = Math.random() * 312 + 100;
            const centerY = Math.random() * 312 + 100;
            const radius = 120;
            const strength = 0.4;
            
            const tempCanvas = createCanvas(512, 512);
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(canvas, 0, 0);
            const tempData = tempCtx.getImageData(0, 0, 512, 512);
            
            const imageData = canvasCtx.getImageData(0, 0, 512, 512);
            const pixels = imageData.data;
            
            for (let y = 0; y < 512; y++) {
                for (let x = 0; x < 512; x++) {
                    const dx = x - centerX;
                    const dy = y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < radius) {
                        const percent = (radius - distance) / radius;
                        const angle = percent * percent * strength * Math.PI * 2;
                        
                        const cos = Math.cos(angle);
                        const sin = Math.sin(angle);
                        
                        const srcX = Math.round(centerX + (dx * cos - dy * sin));
                        const srcY = Math.round(centerY + (dx * sin + dy * cos));
                        
                        if (srcX >= 0 && srcX < 512 && srcY >= 0 && srcY < 512) {
                            const srcIdx = (srcY * 512 + srcX) * 4;
                            const dstIdx = (y * 512 + x) * 4;
                            pixels[dstIdx] = tempData.data[srcIdx];
                            pixels[dstIdx + 1] = tempData.data[srcIdx + 1];
                            pixels[dstIdx + 2] = tempData.data[srcIdx + 2];
                            pixels[dstIdx + 3] = tempData.data[srcIdx + 3];
                        }
                    }
                }
            }
            
            canvasCtx.putImageData(imageData, 0, 0);
            
            const swirlBuffer = canvas.toBuffer('image/png');
            
            const triggeredImage = await sharp(swirlBuffer)
                .modulate({ saturation: 1.3 })
                .webp({ quality: 80 })
                .toBuffer();

            await client.send(ctx.roomId).sticker(triggeredImage);

        } catch (error) {
            console.error('Triger error:', error);
            await ctx.reply('❌ Gagal membuat triggered effect!');
        }
    }
}

module.exports = TrigerFeature;
