const BaseFeature = require('../core/BaseFeature');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');

class TrigerFeature extends BaseFeature {
    constructor() {
        super('triger', 'Buat efek "triggered" deep-fried', false);
    }

    async execute(m, sock, args) {
        try {
            let imageBuffer;

            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageMessage = m.message.imageMessage || quoted?.imageMessage;
            const stickerMessage = m.message.stickerMessage || quoted?.stickerMessage;

            if (!imageMessage && !stickerMessage) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Kirim gambar/sticker atau reply gambar/sticker!' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { text: '⏳ Deep frying...' });

            if (imageMessage) {
                imageBuffer = await downloadMediaMessage(
                    { message: { imageMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
            } else {
                imageBuffer = await downloadMediaMessage(
                    { message: { stickerMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
            }
            
            // Step 1: Deep fry - kompresi brutal + saturasi ekstrem (dengan alpha channel)
            let deepFried = await sharp(imageBuffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toFormat('png')
                .toBuffer();
            
            // Step 2: Saturasi & brightness ekstrem
            deepFried = await sharp(deepFried)
                .modulate({
                    brightness: 1.0,
                    saturation: 2.5,
                    hue: Math.floor(Math.random() * 60) - 30
                })
                .linear(1.3, -15)
                .toFormat('png')
                .toBuffer();
            
            // Step 3: Buat swirl effect dengan canvas
            const canvas = createCanvas(512, 512);
            const ctx = canvas.getContext('2d');
            
            // Load gambar deep fried ke canvas
            const img = await loadImage(deepFried);
            ctx.drawImage(img, 0, 0, 512, 512);
            
            // Tambah emoji colorful SEBELUM swirl (biar kena efek swirl)
            const emojis = ['😂', '💀', '🔥', '💯', '😭', '🤣', '👌', '💥'];
            const colors = ['#FF0000', '#FF6B00', '#FFD700', '#00FF00', '#00FFFF', '#0080FF', '#FF00FF', '#FF1493'];
            ctx.font = 'bold 60px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
            
            for (let i = 0; i < 8; i++) {
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                const color = colors[Math.floor(Math.random() * colors.length)];
                const x = Math.random() * 450 + 30;
                const y = Math.random() * 450 + 30;
                const rotation = Math.random() * Math.PI * 2;
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rotation);
                ctx.globalAlpha = 0.8;
                
                // Glow effect
                ctx.shadowColor = color;
                ctx.shadowBlur = 15;
                ctx.fillStyle = color;
                
                ctx.fillText(emoji, 0, 0);
                ctx.restore();
            }
            
            // Apply swirl effect di posisi random
            const centerX = Math.random() * 312 + 100; // Random X: 100-412
            const centerY = Math.random() * 312 + 100; // Random Y: 100-412
            const radius = 120;
            const strength = 0.4;
            
            // Get image data untuk swirl (ambil dari canvas yang sudah ada emoji)
            const tempCanvas = createCanvas(512, 512);
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(canvas, 0, 0);
            const tempData = tempCtx.getImageData(0, 0, 512, 512);
            
            const imageData = ctx.getImageData(0, 0, 512, 512);
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
            
            ctx.putImageData(imageData, 0, 0);
            
            const swirlBuffer = canvas.toBuffer('image/png');
            
            // Step 4: Apply saturasi ke emoji juga
            const triggeredImage = await sharp(swirlBuffer)
                .modulate({
                    saturation: 1.3 // Saturasi ringan untuk emoji
                })
                .webp({ quality: 80 })
                .toBuffer();

            await sock.sendMessage(m.key.remoteJid, {
                sticker: triggeredImage
            });

        } catch (error) {
            console.error('Triger error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Gagal membuat triggered effect!' 
            });
        }
    }
}

module.exports = TrigerFeature;
