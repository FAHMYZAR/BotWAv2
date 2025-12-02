const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class InstagramFeature extends BaseFeature {
    constructor() {
        super('ig', 'Download video/foto Instagram (reel/post)', false);
    }

    async execute(m, sock, args) {
        try {
            const url = args[0];

            if (!url || !url.includes('instagram.com')) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '📸 *INSTAGRAM DOWNLOADER*\n\n❌ Berikan URL Instagram yang valid!\n\n*SUPPORT*\n> Reel\n> Post\n\n*CONTOH*\n> .ig https://instagram.com/reel/xxxxx\n> .ig https://instagram.com/p/xxxxx' 
                });
                return;
            }

            if (url.includes('/stories/')) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '📸 *INSTAGRAM DOWNLOADER*\n\n❌ Story tidak support!\n\n*SUPPORT*\n> Reel\n> Post' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            const response = await axios.get(`${config.apis.instagram}/igdl`, {
                params: { url },
                timeout: 60000
            });

            if (!response.data.url || !response.data.url.status || !response.data.url.data) {
                throw new Error('API returned error');
            }

            const mediaData = response.data.url.data;

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            // Remove duplicates based on URL
            const uniqueMedia = [];
            const seenUrls = new Set();
            for (const media of mediaData) {
                if (!seenUrls.has(media.url)) {
                    seenUrls.add(media.url);
                    uniqueMedia.push(media);
                }
            }

            // Send all unique media
            for (let i = 0; i < uniqueMedia.length; i++) {
                const media = uniqueMedia[i];
                const isLastMedia = i === uniqueMedia.length - 1;
                const caption = isLastMedia ? `📸 *INSTAGRAM DOWNLOADER*\n\n_No Watermark HD Quality_` : undefined;
                
                try {
                    const mediaResponse = await axios.get(media.url, {
                        responseType: 'arraybuffer',
                        timeout: 120000
                    });

                    const buffer = Buffer.from(mediaResponse.data);
                    const contentType = mediaResponse.headers['content-type'] || '';
                    
                    // Detect file type from magic bytes
                    const magicBytes = buffer.slice(0, 12).toString('hex');
                    const isVideo = magicBytes.startsWith('000000') && (magicBytes.includes('667479706d703432') || magicBytes.includes('6674797069736f6d')) || // mp4
                                   magicBytes.startsWith('1a45dfa3') || // webm
                                   contentType.includes('video');
                    
                    console.log(`Media ${i + 1}: magic=${magicBytes.substring(0, 16)}, content-type=${contentType}, isVideo=${isVideo}`);

                    if (isVideo) {
                        await sock.sendMessage(m.key.remoteJid, {
                            video: buffer,
                            caption: caption
                        });
                    } else {
                        await sock.sendMessage(m.key.remoteJid, {
                            image: buffer,
                            caption: caption
                        });
                    }

                    // Delay between multiple media
                    if (!isLastMedia) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (mediaError) {
                    console.error(`Failed to send media ${i + 1}:`, mediaError.message);
                }
            }

        } catch (error) {
            console.error('Instagram error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat download! Pastikan URL valid dan konten tidak private.' 
            });
        }
    }
}

module.exports = InstagramFeature;
