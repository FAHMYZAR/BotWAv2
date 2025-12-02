const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class FacebookFeature extends BaseFeature {
    constructor() {
        super('fb', 'Download video Facebook', false);
    }

    async execute(m, sock, args) {
        try {
            const url = args[0];

            if (!url || !url.includes('facebook.com')) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Berikan URL Facebook yang valid!\n\nContoh: .fb https://www.facebook.com/share/r/xxxxx' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            const response = await axios.get(`${config.apis.lolhuman}/facebook`, {
                params: { apikey: config.lolhumanApiKey, url },
                timeout: 60000
            });

            if (response.data.status !== 200 || !response.data.result || response.data.result.length === 0) {
                throw new Error('API returned error');
            }

            // result[0] = HD, result[1] = SD
            const urls = response.data.result;
            let videoBuffer;
            let quality = 'HD';

            for (let i = 0; i < urls.length; i++) {
                try {
                    const videoResponse = await axios.get(urls[i], {
                        responseType: 'arraybuffer',
                        timeout: 300000,
                        maxContentLength: 100 * 1024 * 1024
                    });

                    videoBuffer = Buffer.from(videoResponse.data);
                    const sizeInMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);

                    // If HD > 50MB and SD available, try SD
                    if (sizeInMB > 50 && i === 0 && urls.length > 1) {
                        quality = 'SD';
                        continue;
                    }

                    quality = i === 0 ? 'HD' : 'SD';
                    break;
                } catch (error) {
                    if (i === urls.length - 1) throw error;
                    quality = 'SD';
                }
            }

            const sizeInMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);

            const caption = 
                `📘 *FACEBOOK DOWNLOADER*\n\n` +
                `*QUALITY*\n` +
                `> \`${quality}\`\n\n` +
                `*SIZE*\n` +
                `> \`${sizeInMB} MB\`\n\n` +
                `_No Watermark_`;

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            await sock.sendMessage(m.key.remoteJid, {
                video: videoBuffer,
                caption: caption,
                gifPlayback: false,
                jpegThumbnail: null
            });

        } catch (error) {
            console.error('Facebook error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat download! Video mungkin terlalu besar, private, atau tidak tersedia.' 
            });
        }
    }
}

module.exports = FacebookFeature;
