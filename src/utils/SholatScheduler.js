const axios = require('axios');
const config = require('../config/config');
const GroupRegistry = require('./GroupRegistry');

class SholatScheduler {
    constructor(sock) {
        this.sock = sock;
        this.interval = null;
        this.dailyResetInterval = null;
        this.isConnected = false;
        this.retryQueue = new Map();
        this.currentJadwal = new Map();
        this.banners = [
            'https://files.catbox.moe/iu92u8.jpg',
            'https://files.catbox.moe/v7u6aw.jpg',
            'https://files.catbox.moe/i5w2ha.webp',
            'https://files.catbox.moe/ceshuw.jpeg',
            'https://s6.imgcdn.dev/YPwUOS.jpg'
        ];
        this.lastBannerIndex = -1;
        this.imsakMessageCache = new Map();
        this.quotes = require('./data-quotes.json');
        this.lastFetchDate = null;
    }

    getRandomBanner() {
        let index;
        do {
            index = Math.floor(Math.random() * this.banners.length);
        } while (index === this.lastBannerIndex && this.banners.length > 1);
        
        this.lastBannerIndex = index;
        return this.banners[index];
    }

    getRandomQuote() {
        const randomIndex = Math.floor(Math.random() * this.quotes.length);
        return this.quotes[randomIndex];
    }

    start() {
        console.log('[SCHEDULER] Starting sholat reminder...');
        
        // Monitor connection status
        this.sock.ev.on('connection.update', (update) => {
            if (update.connection === 'open') {
                this.isConnected = true;
                console.log('[SCHEDULER] Connection restored, processing retry queue...');
                this.processRetryQueue();
            } else if (update.connection === 'close') {
                this.isConnected = false;
                console.log('[SCHEDULER] Connection lost');
            }
        });
        
        // Daily reset at 00:01
        this.dailyResetInterval = setInterval(() => this.checkDailyReset(), 60000);
        
        this.interval = setInterval(() => this.check(), 60000);
        this.check();
    }

    checkDailyReset() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        if (currentTime === '00:01') {
            console.log('[SCHEDULER] Daily reset: Clearing lastNotified and fetching fresh jadwal...');
            
            // Clear all lastNotified
            const groups = GroupRegistry.getAll();
            for (const groupJid in groups) {
                groups[groupJid].lastNotified = {};
            }
            GroupRegistry.groups = groups;
            GroupRegistry.save();
            
            // Clear jadwal cache
            this.currentJadwal.clear();
            this.lastFetchDate = null;
            
            console.log('[SCHEDULER] Daily reset completed');
        }
    }

    async processRetryQueue() {
        if (this.retryQueue.size === 0) return;
        
        console.log(`[SCHEDULER] Processing ${this.retryQueue.size} queued messages...`);
        
        for (const [key, data] of this.retryQueue.entries()) {
            try {
                if (data.nama === 'Subuh' && this.imsakMessageCache.has(data.groupJid)) {
                    await this.deleteAndSendSubuh(data.groupJid, this.imsakMessageCache.get(data.groupJid), data.waktu, data.kota);
                    this.imsakMessageCache.delete(data.groupJid);
                } else if (data.nama === 'Dhuha') {
                    await this.sendDhuhaReminder(data.groupJid, data.waktu, data.kota);
                } else {
                    const messageKey = await this.sendReminder(data.groupJid, data.nama, data.waktu, data.kota, data.subuhTime);
                    if (data.nama === 'Imsak' && messageKey) {
                        this.imsakMessageCache.set(data.groupJid, messageKey);
                    }
                }
                
                GroupRegistry.updateLastNotified(data.groupJid, data.nama);
                this.retryQueue.delete(key);
            } catch (error) {
                console.error(`[SCHEDULER] Retry failed for ${data.nama}:`, error.message);
            }
        }
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            console.log('[SCHEDULER] Stopped sholat reminder');
        }
        if (this.dailyResetInterval) {
            clearInterval(this.dailyResetInterval);
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
                const jadwal = await this.getJadwalFresh(groupData.kota, today);
                if (!jadwal) {
                    console.log(`[SCHEDULER] No jadwal for ${groupData.kota}`);
                    continue;
                }

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
                    // Normalize time format (remove seconds if exists)
                    const normalizedWaktu = waktu ? waktu.substring(0, 5) : '';
                    
                    if (currentTime === normalizedWaktu) {
                        if (!GroupRegistry.isNotifiedToday(groupJid, nama)) {
                            console.log(`[SCHEDULER] Sending ${nama} reminder to ${groupJid}`);
                            
                            if (!this.isConnected) {
                                console.log(`[SCHEDULER] Connection not ready, queueing ${nama} for ${groupJid}`);
                                this.retryQueue.set(`${groupJid}_${nama}`, {
                                    groupJid,
                                    nama,
                                    waktu,
                                    kota: groupData.kota,
                                    subuhTime: jadwal.subuh
                                });
                                continue;
                            }
                            
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

    async getJadwalFresh(kota, today) {
        // Fetch fresh jadwal only once per day
        if (this.lastFetchDate !== today) {
            console.log(`[SCHEDULER] Fetching fresh jadwal for new day: ${today}`);
            this.currentJadwal.clear();
            this.lastFetchDate = today;
        }
        
        const cacheKey = `${kota}_${today}`;
        
        if (this.currentJadwal.has(cacheKey)) {
            return this.currentJadwal.get(cacheKey);
        }

        console.log(`[SCHEDULER] Fetching jadwal from API for ${kota}`);
        const jadwal = await this.getJadwal(kota);
        
        if (jadwal) {
            console.log(`[SCHEDULER] ${kota} jadwal:`, {
                imsak: jadwal.imsak,
                subuh: jadwal.subuh,
                dhuha: jadwal.dhuha,
                dzuhur: jadwal.dzuhur,
                ashar: jadwal.ashar,
                maghrib: jadwal.maghrib,
                isya: jadwal.isya
            });
            this.currentJadwal.set(cacheKey, jadwal);
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

    async sendWithRetry(groupJid, message, nama, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                if (!this.isConnected) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                
                const sent = await this.sock.sendMessage(groupJid, message);
                console.log(`[SCHEDULER] Sent ${nama} reminder to ${groupJid}`);
                return sent.key;
            } catch (error) {
                console.error(`[SCHEDULER] Send attempt ${i + 1}/${maxRetries} failed:`, error.message);
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
        }
        throw new Error('Max retries reached');
    }

    async sendReminder(groupJid, nama, waktu, kota, subuhTime = null) {
        try {
            const banner = this.getRandomBanner();
            const quote = this.getRandomQuote();

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
            message += `> ${quote}`;

            const messageData = {
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
            };

            return await this.sendWithRetry(groupJid, messageData, nama);
        } catch (error) {
            console.error(`[SCHEDULER] Failed to send reminder:`, error.message);
            return null;
        }
    }

    async sendDhuhaReminder(groupJid, waktu, kota) {
        try {
            let message = `🕌 *WAKTU DHUHA*\n\n`;
            message += `> _Bagi yang ingin sholat Dhuha, waktu sudah menunjukkan pukul_ \`${waktu}\`\n`;
            message += `> _Lokasi_ : *${kota.toUpperCase()}*`;

            const messageData = { text: message };
            return await this.sendWithRetry(groupJid, messageData, 'Dhuha');
        } catch (error) {
            console.error(`[SCHEDULER] Failed to send Dhuha reminder:`, error.message, error.stack);
            return null;
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
            const quote = this.getRandomQuote();

            let message = `*Hai Teman-Teman 👋*\n`;
            message += `*Sudah Masuk Waktu Sholat SUBUH*\n\n`;
            message += `\`Jam :\` *${waktu}*\n`;
            message += `\`Kota :\` *${kota.toUpperCase()}*\n\n`;
            message += `> ${quote}`;

            const messageData = {
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
            };

            await this.sendWithRetry(groupJid, messageData, 'Subuh');
            console.log(`[SCHEDULER] Deleted Imsak and sent Subuh for ${groupJid}`);
        } catch (error) {
            console.error(`[SCHEDULER] Failed to delete and send Subuh:`, error.message);
        }
    }
}

module.exports = SholatScheduler;
