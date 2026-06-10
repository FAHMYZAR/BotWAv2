const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class CekSholatFeature extends BaseFeature {
    constructor() {
        super('ceksholat', 'Cek jadwal sholat kota di Indonesia', false, 'info');
        this.banners = config.sholatBanners;
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

            // Search for city using MyQuran API
            const searchUrl = `${config.apis.myquran.sholat.search}/${encodeURIComponent(kota.toLowerCase())}`;
            const searchResponse = await axios.get(searchUrl, { timeout: 10000 });
            
            if (!searchResponse.data.status || !searchResponse.data.data.length) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Kota tidak ditemukan! Pastikan nama kota benar.\n\nContoh: Bantul, Jakarta, Semarang' 
                });
                return;
            }

            const cityData = searchResponse.data.data[0];
            
            // Get today's prayer schedule
            const jadwalUrl = `${config.apis.myquran.sholat.jadwal}/${cityData.id}/today`;
            const jadwalResponse = await axios.get(jadwalUrl, { timeout: 10000 });
            
            if (!jadwalResponse.data.status || !jadwalResponse.data.data.jadwal) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Jadwal sholat tidak tersedia untuk hari ini!' 
                });
                return;
            }

            const data = jadwalResponse.data.data;
            const today = Object.keys(data.jadwal)[0];
            const jadwal = data.jadwal[today];

            let message = `🕌 *JADWAL SHOLAT ${data.kabko}*\n`;
            message += `*${jadwal.tanggal}*\n\n`;
            message += `\`Imsak :\` ${jadwal.imsak}\n`;
            message += `\`Subuh :\` ${jadwal.subuh}\n`;
            message += `\`Terbit :\` ${jadwal.terbit}\n`;
            message += `\`Dhuha :\` ${jadwal.dhuha}\n`;
            message += `\`Dzuhur :\` ${jadwal.dzuhur}\n`;
            message += `\`Ashar :\` ${jadwal.ashar}\n`;
            message += `\`Maghrib :\` ${jadwal.maghrib}\n`;
            message += `\`Isya :\` ${jadwal.isya}`;

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            
            const banner = this.getRandomBanner();
            
            await sock.sendMessage(m.key.remoteJid, {
                text: message,
                contextInfo: {
                    externalAdReply: {
                        title: `Jadwal Sholat ${data.kabko}`,
                        body: jadwal.tanggal,
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
            if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
                errorMsg = '❌ Koneksi bermasalah, coba lagi nanti!';
            }
            
            await sock.sendMessage(m.key.remoteJid, { text: errorMsg });
        }
    }
}

module.exports = CekSholatFeature;
