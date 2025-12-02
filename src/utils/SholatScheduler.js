const axios = require('axios');
const config = require('../config/config');
const GroupRegistry = require('./GroupRegistry');

class SholatScheduler {
    constructor(sock) {
        this.sock = sock;
        this.interval = null;
        this.banners = [
            'https://files.catbox.moe/iu92u8.jpg',
            'https://files.catbox.moe/v7u6aw.jpg',
            'https://files.catbox.moe/i5w2ha.webp',
            'https://files.catbox.moe/ceshuw.jpeg',
            'https://s6.imgcdn.dev/YPwUOS.jpg'
        ];
        this.lastBannerIndex = -1;
        this.imsakMessageCache = new Map();
        this.jadwalCache = new Map();
        
        // Juz mapping
        this.juzSurah = {
            1: [1, 2],
            2: [2],
            22: [36],
            27: [55, 56],
            30: [78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114]
        };
        
        this.tigaQul = [112, 113, 114];
    }

    getRandomBanner() {
        let index;
        do {
            index = Math.floor(Math.random() * this.banners.length);
        } while (index === this.lastBannerIndex && this.banners.length > 1);
        
        this.lastBannerIndex = index;
        return this.banners[index];
    }

    async getRandomAyat() {
        try {
            const juzOptions = [1, 2, 22, 27, 30];
            const selectedJuz = juzOptions[Math.floor(Math.random() * juzOptions.length)];
            
            const surahList = this.juzSurah[selectedJuz];
            const surah = surahList[Math.floor(Math.random() * surahList.length)];
            
            if (this.tigaQul.includes(surah)) {
                return await this.getFullSurah(surah);
            }
            
            const ayat = Math.floor(Math.random() * 10) + 1;
            const url = `${config.apis.lolhuman}/quran/${surah}/${ayat}?apikey=${config.lolhumanApiKey}`;
            
            const response = await axios.get(url, { timeout: 5000 });
            if (response.data.status === 200 && response.data.result && response.data.result.ayat && response.data.result.ayat[0]) {
                return {
                    surah: response.data.result.surah,
                    nomor: response.data.result.nomor,
                    ayat: response.data.result.ayat[0]
                };
            }
            return null;
        } catch {
            return null;
        }
    }

    async getFullSurah(surahNumber) {
        try {
            const url = `${config.apis.lolhuman}/quran/${surahNumber}?apikey=${config.lolhumanApiKey}`;
            const response = await axios.get(url, { timeout: 5000 });
            
            if (response.data.status === 200 && response.data.result && response.data.result.ayat) {
                const ayatList = response.data.result.ayat;
                
                const arabText = ayatList.map(a => a.arab).join(' ۝ ');
                const indonesiaText = ayatList.map((a, i) => `${i + 1}. ${a.indonesia}`).join('\n');
                
                return {
                    surah: response.data.result.surah,
                    nomor: response.data.result.nomor,
                    ayat: {
                        ayat: `1-${ayatList.length}`,
                        arab: arabText,
                        indonesia: indonesiaText
                    }
                };
            }
            return null;
        } catch {
            return null;
        }
    }

    start() {
        console.log('[SCHEDULER] Starting sholat reminder...');
        this.interval = setInterval(() => this.check(), 60000);
        this.check();
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            console.log('[SCHEDULER] Stopped sholat reminder');
        }
    }

    async check() {
        const groups = GroupRegistry.getAll();
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const today = now.toISOString().split('T')[0]; // Already WIB from Docker TZ
        
        console.log(`[SCHEDULER] Checking at ${currentTime}, ${Object.keys(groups).length} groups registered`);

        for (const [groupJid, groupData] of Object.entries(groups)) {
            try {
                const jadwal = await this.getJadwalCached(groupData.kota, today);
                if (!jadwal) continue;

                const waktuSholat = {
                    'Imsak': jadwal.imsak,
                    'Subuh': jadwal.subuh,
                    'Dhuha': jadwal.dhuha,
                    'Dzuhur': jadwal.dzuhur,
                    'Ashar': jadwal.ashar,
                    'Maghrib': jadwal.maghrib,
                    'Isya': jadwal.isya
                };

                for (const [nama, waktu] of Object.entries(waktuSholat)) {
                    if (currentTime === waktu) {
                        if (!GroupRegistry.isNotifiedToday(groupJid, nama)) {
                            console.log(`[SCHEDULER] Sending ${nama} reminder to ${groupJid}`);
                            
                            if (nama === 'Subuh') {
                                const imsakKey = this.imsakMessageCache.get(groupJid);
                                if (imsakKey) {
                                    await this.deleteAndSendSubuh(groupJid, imsakKey, waktu, groupData.kota);
                                    this.imsakMessageCache.delete(groupJid);
                                } else {
                                    await this.sendReminder(groupJid, nama, waktu, groupData.kota, jadwal.subuh);
                                }
                            } else if (nama === 'Dhuha') {
                                await this.sendDhuhaReminder(groupJid, waktu, groupData.kota);
                            } else {
                                const messageKey = await this.sendReminder(groupJid, nama, waktu, groupData.kota, jadwal.subuh);
                                if (nama === 'Imsak' && messageKey) {
                                    this.imsakMessageCache.set(groupJid, messageKey);
                                }
                            }
                            
                            GroupRegistry.updateLastNotified(groupJid, nama);
                        } else {
                            console.log(`[SCHEDULER] ${nama} already notified today for ${groupJid}`);
                        }
                    }
                }
            } catch (error) {
                console.error(`[SCHEDULER] Error for ${groupJid}:`, error.message);
            }
        }
    }

    async getJadwalCached(kota, today) {
        const cacheKey = `${kota}_${today}`;
        
        if (this.jadwalCache.has(cacheKey)) {
            console.log(`[SCHEDULER] Using cached jadwal for ${kota}`);
            return this.jadwalCache.get(cacheKey);
        }

        console.log(`[SCHEDULER] Fetching jadwal from API for ${kota}`);
        const jadwal = await this.getJadwal(kota);
        
        if (jadwal) {
            this.jadwalCache.set(cacheKey, jadwal);
            
            for (const key of this.jadwalCache.keys()) {
                if (!key.endsWith(today)) {
                    this.jadwalCache.delete(key);
                }
            }
        }
        
        return jadwal;
    }

    async getJadwal(kota) {
        try {
            const url = `${config.apis.lolhuman}/sholat/${encodeURIComponent(kota)}?apikey=${config.lolhumanApiKey}`;
            const response = await axios.get(url, { timeout: 5000 });
            if (response.data.status === 200 && response.data.result) {
                return response.data.result;
            }
            return null;
        } catch {
            return null;
        }
    }

    async sendReminder(groupJid, nama, waktu, kota, subuhTime = null) {
        try {
            const banner = this.getRandomBanner();
            const ayatData = await this.getRandomAyat();

            let message = `*Hai Teman-Teman 👋*\n`;
            
            if (nama === 'Imsak') {
                message += `*Sudah Masuk Waktu Imsak Nih!*\n`;
                message += `*Sebentar Lagi Subuh, Ayo Siap-Siap! 🕌*\n\n`;
                message += `\`Imsak :\` *${waktu}*\n`;
                message += `\`Subuh :\` *${subuhTime}*\n`;
            } else if (nama === 'Maghrib') {
                message += `*Sudah Masuk Waktu Sholat ${nama.toUpperCase()}*\n`;
                message += `*Ayo Buruan Sholat Keburu Isya! ⏰*\n\n`;
                message += `\`Jam :\` *${waktu}*\n`;
            } else {
                message += `*Sudah Masuk Waktu Sholat ${nama.toUpperCase()}*\n\n`;
                message += `\`Jam :\` *${waktu}*\n`;
            }
            
            message += `\`Kota :\` *${kota.toUpperCase()}*\n\n`;
            message += `بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ\n`;
            
            if (ayatData) {
                message += `${ayatData.ayat.arab}\n\n`;
                message += `_"${ayatData.ayat.indonesia}"_\n`;
                message += `_(QS. ${ayatData.surah} ${ayatData.nomor}:${ayatData.ayat.ayat})_`;
            }

            const sent = await this.sock.sendMessage(groupJid, {
                text: message,
                contextInfo: {
                    externalAdReply: {
                        title: nama === 'Imsak' ? 'Imsak - Siap-Siap Subuh!' : `Sholat ${nama} Yok!`,
                        body: `${waktu} - ${kota.toUpperCase()}`,
                        thumbnailUrl: banner,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            });

            console.log(`[SCHEDULER] Sent ${nama} reminder to ${groupJid}`);
            return sent.key;
        } catch (error) {
            console.error(`[SCHEDULER] Failed to send reminder:`, error.message);
            return null;
        }
    }

    async sendDhuhaReminder(groupJid, waktu, kota) {
        try {
            let message = `🕌 *WAKTU DHUHA*\n\n`;
            message += `_Bagi yang ingin sholat Dhuha, waktu sudah menunjukkan pukul_ \`${waktu}\`\n`;
            message += `\`Lokasi :\` ${kota.toUpperCase()}`;

            await this.sock.sendMessage(groupJid, {
                text: message
            });

            console.log(`[SCHEDULER] Sent Dhuha reminder to ${groupJid}`);
        } catch (error) {
            console.error(`[SCHEDULER] Failed to send Dhuha reminder:`, error.message);
        }
    }

    async deleteAndSendSubuh(groupJid, messageKey, waktu, kota) {
        try {
            try {
                await this.sock.sendMessage(groupJid, {
                    delete: messageKey
                });
            } catch (e) {
                console.log('[SCHEDULER] Failed to delete Imsak message, continuing...');
            }

            const banner = this.getRandomBanner();
            const ayatData = await this.getRandomAyat();

            let message = `*Hai Teman-Teman 👋*\n`;
            message += `*Sudah Masuk Waktu Sholat SUBUH*\n\n`;
            message += `\`Jam :\` *${waktu}*\n`;
            message += `\`Kota :\` *${kota.toUpperCase()}*\n\n`;
            message += `بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ\n`;
            
            if (ayatData) {
                message += `${ayatData.ayat.arab}\n\n`;
                message += `_"${ayatData.ayat.indonesia}"_\n`;
                message += `_(QS. ${ayatData.surah} ${ayatData.nomor}:${ayatData.ayat.ayat})_`;
            }

            await this.sock.sendMessage(groupJid, {
                text: message,
                contextInfo: {
                    externalAdReply: {
                        title: 'Sholat Subuh Yok!',
                        body: `${waktu} - ${kota.toUpperCase()}`,
                        thumbnailUrl: banner,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            });

            console.log(`[SCHEDULER] Deleted Imsak and sent Subuh for ${groupJid}`);
        } catch (error) {
            console.error(`[SCHEDULER] Failed to delete and send Subuh:`, error.message);
        }
    }
}

module.exports = SholatScheduler;
