const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class YtPlayFeature extends BaseFeature {
    constructor() {
        super('ytplay', 'Search dan play musik YouTube', false);
        this.searchCache = new Map();
        this.pageCache = new Map();
        this.messageCache = new Map();
    }

    async execute(m, sock, args) {
        try {
            const query = args.join(' ');

            if (!query) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Masukkan kata kunci pencarian!\n\nContoh: .ytplay alan walker faded' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '🔍', key: m.key } });

            const searchResponse = await axios.get(`${config.apis.youtube}/search`, {
                params: { 
                    q: query,
                    limit: 25
                },
                timeout: 30000
            });

            const results = searchResponse.data.results;

            if (!results || results.length === 0) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ Tidak ditemukan hasil untuk: *${query}*` 
                });
                return;
            }

            // Save search results to cache
            const userId = m.key.participant || m.key.remoteJid;
            this.searchCache.set(userId, results);
            this.pageCache.set(userId, 0); // Start from page 0

            // Show first page
            await this.showPage(m, sock, userId, 0, true);



        } catch (error) {
            console.error('YtPlay search error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat mencari!' 
            });
        }
    }

    async showPage(m, sock, userId, page, isNew = false) {
        const results = this.searchCache.get(userId);
        if (!results) return;

        const itemsPerPage = 5;
        const totalPages = Math.ceil(results.length / itemsPerPage);
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageResults = results.slice(start, end);

        await sock.sendMessage(m.key.remoteJid, {
            react: { text: '', key: m.key }
        });

        let message = `🎵 *YOUTUBE MUSIC SEARCH*\n\n`;
        message += `📊 *RESULTS*\n`;
        message += `> Page \`${page + 1}/${totalPages}\`\n\n`;

        pageResults.forEach((video, index) => {
            const globalIndex = start + index + 1;
            const shortTitle = video.title.length > 45 ? video.title.substring(0, 45) + '...' : video.title;
            message += `*${globalIndex}.* ${shortTitle}\n`;
            message += `> Duration: \`${video.duration}\`\n\n`;
        });

        message += `🎶 *COMMANDS*\n`;
        message += `> \`+number\` - Untuk memutar audio\n`;
        if (page < totalPages - 1) {
            message += `> \`>next\` - Next page\n`;
        }
        if (page > 0) {
            message += `> \`<prev\` - Previous page\n`;
        }

        if (isNew) {
            const sent = await sock.sendMessage(m.key.remoteJid, {
                text: message
            });
            this.messageCache.set(userId, sent.key);
        } else {
            const messageKey = this.messageCache.get(userId);
            if (messageKey) {
                await sock.sendMessage(m.key.remoteJid, {
                    edit: messageKey,
                    text: message
                });
            }
        }

        this.pageCache.set(userId, page);
    }

    async handleNext(m, sock) {
        const userId = m.key.participant || m.key.remoteJid;
        const currentPage = this.pageCache.get(userId) || 0;
        const results = this.searchCache.get(userId);

        if (!results) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Hasil pencarian sudah expired. Silakan search ulang dengan .ytplay' 
            });
            return;
        }

        const totalPages = Math.ceil(results.length / 5);
        if (currentPage >= totalPages - 1) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Sudah di halaman terakhir!' 
            });
            return;
        }

        await this.showPage(m, sock, userId, currentPage + 1, false);
    }

    async handlePrev(m, sock) {
        const userId = m.key.participant || m.key.remoteJid;
        const currentPage = this.pageCache.get(userId) || 0;
        const results = this.searchCache.get(userId);

        if (!results) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Hasil pencarian sudah expired. Silakan search ulang dengan .ytplay' 
            });
            return;
        }

        if (currentPage <= 0) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Sudah di halaman pertama!' 
            });
            return;
        }

        await this.showPage(m, sock, userId, currentPage - 1, false);
    }

    async handleSelection(m, sock, selection) {
        try {
            const userId = m.key.participant || m.key.remoteJid;
            const results = this.searchCache.get(userId);

            if (!results) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Hasil pencarian sudah expired. Silakan search ulang dengan .ytplay' 
                });
                return;
            }

            const index = parseInt(selection) - 1;
            if (index < 0 || index >= results.length) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ Nomor tidak valid! Pilih 1-${results.length}` 
                });
                return;
            }

            const selectedVideo = results[index];
            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            const videoUrl = `https://www.youtube.com/watch?v=${selectedVideo.id}`;

            console.log('Downloading audio:', selectedVideo.title);

            // Use Ferdev API for download
            const downloadResponse = await axios.get(`${config.apis.resita}/downloader/ytmp3`, {
                params: {
                    link: videoUrl,
                    apikey: config.resitaApiKey
                },
                timeout: 60000
            });

            if (!downloadResponse.data.success) {
                throw new Error('Download failed');
            }

            const downloadLink = downloadResponse.data.data.dlink;

            const audioResponse = await axios.get(downloadLink, {
                responseType: 'arraybuffer',
                timeout: 300000
            });

            const audioBuffer = Buffer.from(audioResponse.data);
            const sizeInMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            // Send as audio with metadata
            await sock.sendMessage(m.key.remoteJid, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                contextInfo: {
                    externalAdReply: {
                        title: selectedVideo.title,
                        body: `Duration: ${selectedVideo.duration} | Size: ${sizeInMB} MB`,
                        mediaType: 2,
                        thumbnail: null,
                        sourceUrl: videoUrl
                    }
                }
            });

            // Clear cache after successful download
            this.searchCache.delete(userId);
            this.pageCache.delete(userId);

        } catch (error) {
            console.error('YtPlay download error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat memutar audio!' 
            });
        }
    }
}

module.exports = YtPlayFeature;
