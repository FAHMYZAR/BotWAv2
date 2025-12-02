const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class CekSholatFeature extends BaseFeature {
    constructor() {
        super('ceksholat', 'Cek jadwal sholat kota di Indonesia', false);
        this.banners = [
            'https://files.catbox.moe/iu92u8.jpg',
            'https://files.catbox.moe/v7u6aw.jpg',
            'https://files.catbox.moe/i5w2ha.webp',
            'https://files.catbox.moe/ceshuw.jpeg',
            'https://s6.imgcdn.dev/YPwUOS.jpg'
        ];
        this.lastBannerIndex = -1;
    }

    getRandomBanner() {
        let index;
        do {
            index = Math.floor(Math.random() * this.banners.length);
        } while (index === this.lastBannerIndex && this.banners.length > 1);
        
        this.lastBannerIndex = index;
        return this.banners[index];
    }

    formatDate(dateStr) {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
        const [year, month, day] = dateStr.split('-');
        return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year.slice(-2)}`;
    }

    async execute(m, sock, args) {
        try {
            let kota = args.join(' ');

            if (!kota) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Masukkan nama kota!\n\nContoh:\n> `.ceksholat Bantul`\n> `.ceksholat Jakarta`\n> `.ceksholat Sleman`' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '🕌', key: m.key }
            });

            kota = kota.toLowerCase();
            const url = `${config.apis.lolhuman}/sholat/${encodeURIComponent(kota)}?apikey=${config.lolhumanApiKey}`;
            
            const apiResponse = await axios.get(url, { timeout: 5000 });
            const response = apiResponse.data;

            if (response.status !== 200 || !response.result) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Kota tidak ditemukan! Pastikan nama kota benar.' 
                });
                return;
            }

            const data = response.result;
            const formattedDate = this.formatDate(data.tanggal);

            let message = `🕌 *JADWAL SHOLAT ${data.wilayah.toUpperCase()}*\n`;
            message += `*${formattedDate}*\n\n`;
            message += `\`Imsak :\` ${data.imsak}\n`;
            message += `\`Subuh :\` ${data.subuh}\n`;
            message += `\`Terbit :\` ${data.terbit}\n`;
            message += `\`Dhuha :\` ${data.dhuha}\n`;
            message += `\`Dzuhur :\` ${data.dzuhur}\n`;
            message += `\`Ashar :\` ${data.ashar}\n`;
            message += `\`Maghrib :\` ${data.maghrib}\n`;
            message += `\`Isya :\` ${data.isya}`;

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            
            const banner = this.getRandomBanner();
            
            await sock.sendMessage(m.key.remoteJid, {
                text: message,
                contextInfo: {
                    externalAdReply: {
                        title: `Jadwal Sholat ${data.wilayah}`,
                        body: formattedDate,
                        thumbnailUrl: banner,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            });

        } catch (error) {
            console.error('CekSholat error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            
            let errorMsg = '❌ Terjadi kesalahan saat mengecek jadwal sholat!';
            if (error.message === 'timeout' || error.message === 'parse_error') {
                errorMsg = '❌ Lokasi tidak ditemukan!\n\nℹ️ Gunakan nama *Kabupaten/Kota.*\n\nContoh:\n> `.ceksholat Bantul` ✅\n> `.ceksholat Kasihan` ❌';
            }
            
            await sock.sendMessage(m.key.remoteJid, { text: errorMsg });
        }
    }
}

module.exports = CekSholatFeature;
