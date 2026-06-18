const BaseFeature = require('../core/BaseFeature');
const { Downloader } = require('@tobyg74/tiktok-api-dl');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class TiktokFeature extends BaseFeature {
    constructor() {
        super('tt', 'Download video TikTok HD tanpa watermark', false, 'download');
    }

    async execute(ctx, client, args) {
        try {
            const url = args[0];

            if (!url || !url.includes('tiktok.com')) {
                await client.sendMessage(ctx.remoteJid, { 
                    text: '❌ Berikan URL TikTok yang valid!\n\nContoh: .tt https://vt.tiktok.com/xxxxx' 
                });
                return;
            }

            await ctx.react('⏳');

            const result = await Downloader(url, { version: 'v3' });
            console.log('TikTok result:', JSON.stringify(result, null, 2));

            if (!result.status || !result.result) {
                await client.sendMessage(ctx.remoteJid, { 
                    text: '❌ Gagal download! URL tidak valid atau video private.' 
                });
                return;
            }

            const data = result.result;
            const videoUrl = data.videoHD || data.videoSD;
            
            if (!videoUrl) {
                await client.sendMessage(ctx.remoteJid, { text: '❌ Video tidak ditemukan!' });
                return;
            }

            const videoBuffer = await axios.get(videoUrl, { responseType: 'arraybuffer' });
            const desc = (data.desc || 'No description').substring(0, 100);
            const caption = 
                `🎵 *TIKTOK DOWNLOADER*\n\n` +
                `*👤 AUTHOR*\n` +
                `> \`${data.author?.nickname || 'Unknown'}\`\n\n` +
                `*📝 DESCRIPTION*\n` +
                `> \`${desc}\`\n\n` +
                `_🔥 No Watermark HD Quality_`;

            await ctx.react('');

            await client.sendMessage(ctx.remoteJid, {
                video: Buffer.from(videoBuffer.data),
                caption: caption
            });

        } catch (error) {
            console.error('TikTok download error:', error);
            await client.sendMessage(ctx.remoteJid, { 
                text: '❌ Terjadi kesalahan saat download! Coba lagi nanti.' 
            });
        }
    }
}

module.exports = TiktokFeature;

