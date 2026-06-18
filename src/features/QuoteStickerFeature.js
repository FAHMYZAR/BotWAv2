const BaseFeature = require('../core/BaseFeature');
const { QuoteGenerator } = require('qc-generator-whatsapp');
const sharp = require('sharp');
const axios = require('axios');

class QuoteStickerFeature extends BaseFeature {
    constructor() {
        super('q', 'Ubah quoted message jadi stiker (Gaya Quotly)', false, 'media');
    }

    async execute(ctx, client, args) {
        try {
            const quoted = await ctx.replied().catch(() => null);
            
            if (!quoted) {
                await ctx.reply('❌ Reply pesan yang ingin dijadikan stiker!');
                return;
            }

            await ctx.react('⏳');

            const quotedSender = quoted.senderId || quoted.sender?.jid || ctx.senderId;
            let name = quoted.senderName || quoted.sender?.pushName;
            
            const findInStore = (jid) => {
                if (!jid || !global.store?.contacts) return null;
                if (global.store.contacts[jid]?.name) return global.store.contacts[jid].name;
                const number = jid.split('@')[0];
                for (const [key, contact] of Object.entries(global.store.contacts)) {
                    const keyNumber = key.split('@')[0];
                    if (keyNumber === number && contact.name) return contact.name;
                }
                return null;
            };
            
            name = findInStore(quotedSender) || name || quotedSender.split('@')[0];
            
            let ppBuffer = null;
            try {
                const ppUrl = await client.profilePicture(quotedSender);
                if (ppUrl) {
                    const response = await axios.get(ppUrl, {
                        responseType: 'arraybuffer',
                        timeout: 5000
                    });
                    ppBuffer = Buffer.from(response.data);
                }
            } catch (e) {
                ppBuffer = null;
            }
            
            const text = quoted.text || quoted.media?.caption || '';
            
            let mediaBuffer = null;
            if (quoted.media) {
                try {
                    const buffer = await quoted.media.buffer();
                    mediaBuffer = quoted.media.type === 'sticker' ? await sharp(buffer).png().toBuffer() : buffer;
                } catch (e) {
                    console.error('Failed to download quoted media:', e);
                }
            }

            const timestamp = quoted.timestamp ? Math.floor(quoted.timestamp / 1000) : Math.floor(Date.now() / 1000);
            const date = new Date(timestamp * 1000);
            const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            const uniqueId = parseInt(quotedSender.replace(/\D/g, '').slice(-8)) || Math.floor(Math.random() * 999999);
            
            const params = {
                type: 'quote',
                backgroundColor: '#1b2226',
                width: 768,
                scale: 2,
                messages: [
                    {
                        avatar: true,
                        from: {
                            id: uniqueId,
                            name: name,
                            photo: ppBuffer ? { buffer: ppBuffer } : {},
                            time: time
                        },
                        text: text,
                        media: mediaBuffer ? { buffer: mediaBuffer } : undefined
                    }
                ]
            };

            const result = await QuoteGenerator(params);
            
            const stickerBuffer = await sharp(result.image)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 95 })
                .toBuffer();
            
            await client.send(ctx.roomId).sticker(stickerBuffer);

        } catch (error) {
            console.error('QuoteSticker error:', error);
            await ctx.reply('❌ Gagal membuat stiker!');
        }
    }
}

module.exports = QuoteStickerFeature;
