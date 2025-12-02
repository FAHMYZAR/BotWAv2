const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class YoutubeFeature extends BaseFeature {
    constructor() {
        super('yt', 'Download video YouTube', false);
    }

    async execute(m, sock, args) {
        try {
            const url = args[0];

            if (!url || !url.includes('youtu')) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Berikan URL YouTube yang valid!\n\nContoh: .yt https://youtu.be/xxxxx' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            let downloadUrl, title;
            
            try {
                // Try primary API
                const metadataResponse = await axios.get(`${config.apis.youtube}/metadata`, {
                    params: { url },
                    timeout: 30000
                });

                title = metadataResponse.data.title;

                const qualities = ['1080p', '720p', '480p', '360p'];
                let downloadResponse;

                for (const quality of qualities) {
                    try {
                        downloadResponse = await axios.post(`${config.apis.youtube}/download`, {
                            url,
                            quality,
                            bitrate: null,
                            x_lang: null
                        }, { timeout: 300000 });

                        if (downloadResponse.data.is_success) break;
                    } catch (error) {
                        if (quality === '360p') throw error;
                    }
                }

                if (!downloadResponse.data.is_success) {
                    throw new Error('Primary API failed');
                }

                downloadUrl = downloadResponse.data.link;
                if (downloadUrl.startsWith('//')) {
                    downloadUrl = `https:${downloadUrl}`;
                } else if (downloadUrl.startsWith('/')) {
                    downloadUrl = `https://api.apakah.my.id${downloadUrl}`;
                }
            } catch (primaryError) {
                console.log('Primary API failed, trying ytv2 fallback...');
                
                // Fallback to ytv2 API
                const convertResponse = await axios.post(`${config.apis.youtubev2}/convert`, {
                    url,
                    format: 'mp4'
                }, { timeout: 60000 });

                if (!convertResponse.data.success) {
                    throw new Error('Both APIs failed');
                }

                downloadUrl = convertResponse.data.download_url;
                title = convertResponse.data.title || 'YouTube Video';
            }

            const videoResponse = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 300000
            });

            const videoBuffer = Buffer.from(videoResponse.data);
            const sizeInMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);

            const caption = 
                `🎥 *YOUTUBE DOWNLOADER*\n\n` +
                `*📝 TITLE*\n` +
                `> \`${title}\`\n\n` +
                `*📦 SIZE*\n` +
                `> \`${sizeInMB} MB\`\n\n` +
                `_🔥 Downloaded by FAHMYZZX-BOT_`;

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
            console.error('YouTube error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat download! Video mungkin terlalu besar, private, atau tidak tersedia.' 
            });
        }
    }
}

module.exports = YoutubeFeature;
