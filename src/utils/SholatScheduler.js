const axios = require('axios');
const config = require('../config/config');
const GroupSystem = require('./GroupSystem');
const PersonalSholatSystem = require('./PersonalSholatSystem');

class SholatScheduler {
    constructor(sock) {
        this.sock = sock;
        this.interval = null;
        this.dailyResetInterval = null;
        this.isConnected = false;
        this.retryQueue = new Map();
        this.currentJadwal = new Map();
        this.lastBannerIndex = -1;
        this.imsakMessageCache = new Map();
        this.lastFetchDate = null;
    }

    getRandomBanner() {
        let index;
        do {
            index = Math.floor(Math.random() * config.sholatBanners.length);
        } while (index === this.lastBannerIndex && config.sholatBanners.length > 1);
        
        this.lastBannerIndex = index;
        return config.sholatBanners[index];
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
        this.dailyResetInterval = setInterval(async () => await this.checkDailyReset(), 60000);
        
        this.interval = setInterval(async () => await this.check(), 60000);
        this.check();
    }

    async checkDailyReset() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        if (currentTime === '00:01') {
            console.log('[SCHEDULER] Daily reset: Clearing lastNotified and fetching fresh jadwal...');
            
            // Clear all lastNotified - handled by MongoDB TTL
            const groups = await GroupSystem.getAll();
            console.log(`[SCHEDULER] Found ${groups.length} groups for daily reset`);
            // Groups are already saved in MongoDB
            
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
                
                await GroupSystem.updateLastNotified(data.groupJid, data.nama);
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
        const groups = await GroupSystem.getAll();
        const personalUsers = await PersonalSholatSystem.getAll();
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const today = now.toISOString().split('T')[0];
        
        // Get all unique cities
        const cities = new Set();
        groups.forEach(g => cities.add(g.kota));
        personalUsers.forEach(u => cities.add(u.kota));
        
        // Check if current time is near any prayer time (±5 minutes)
        let shouldCheck = false;
        for (const kota of cities) {
            const jadwal = await this.getJadwalFresh(kota, today);
            if (!jadwal) continue;
            
            const waktuSholat = [jadwal.imsak, jadwal.subuh, jadwal.dhuha, jadwal.dzuhur, jadwal.ashar, jadwal.maghrib, jadwal.isya];
            
            for (const waktu of waktuSholat) {
                if (!waktu) continue;
                const normalizedWaktu = waktu.substring(0, 5);
                
                if (this.isNearTime(currentTime, normalizedWaktu, 5)) {
                    shouldCheck = true;
                    break;
                }
            }
            if (shouldCheck) break;
        }
        
        if (!shouldCheck) {
            console.log(`[SCHEDULER] ${currentTime} - Not near any prayer time, skipping`);
            return;
        }
        
        console.log(`[SCHEDULER] Checking at ${currentTime}, ${groups.length} groups, ${personalUsers.length} personal users`);

        // Process groups
        for (const groupData of groups) {
            const groupJid = groupData.groupId;
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
                        if (!(await GroupSystem.isNotifiedToday(groupJid, nama))) {
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
                            
                            await GroupSystem.updateLastNotified(groupJid, nama);
                        } else {
                            console.log(`[SCHEDULER] ${nama} already notified today for ${groupJid}`);
                        }
                    }
                }
            } catch (error) {
                console.error(`[SCHEDULER] Error for ${groupJid}:`, error.message);
            }
        }

        // Process personal users
        for (const userData of personalUsers) {
            const userId = userData.userId;
            try {
                const jadwal = await this.getJadwalFresh(userData.kota, today);
                if (!jadwal) continue;

                const waktuSholat = {
                    'Subuh': jadwal.subuh,
                    'Dzuhur': jadwal.dzuhur,
                    'Ashar': jadwal.ashar,
                    'Maghrib': jadwal.maghrib,
                    'Isya': jadwal.isya
                };

                for (const [nama, waktu] of Object.entries(waktuSholat)) {
                    const normalizedWaktu = waktu ? waktu.substring(0, 5) : '';
                    
                    if (currentTime === normalizedWaktu) {
                        if (!(await PersonalSholatSystem.isNotifiedToday(userId, nama))) {
                            console.log(`[SCHEDULER] Sending ${nama} reminder to personal user ${userId}`);
                            
                            if (!this.isConnected) {
                                console.log(`[SCHEDULER] Connection not ready, skipping personal user`);
                                continue;
                            }
                            
                            await this.sendPersonalReminder(userId, nama, waktu, userData.kota);
                            await PersonalSholatSystem.updateLastNotified(userId, nama);
                        }
                    }
                }
            } catch (error) {
                console.error(`[SCHEDULER] Error for personal user ${userId}:`, error.message);
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
            // Search for city using MyQuran API
            const searchUrl = `${config.apis.myquran.sholat.search}/${encodeURIComponent(kota.toLowerCase())}`;
            const searchResponse = await axios.get(searchUrl, { timeout: 10000 });
            
            if (!searchResponse.data.status || !searchResponse.data.data.length) {
                return null;
            }

            const cityData = searchResponse.data.data[0];
            
            // Get today's prayer schedule
            const jadwalUrl = `${config.apis.myquran.sholat.jadwal}/${cityData.id}/today`;
            const jadwalResponse = await axios.get(jadwalUrl, { timeout: 10000 });
            
            if (!jadwalResponse.data.status || !jadwalResponse.data.data.jadwal) {
                return null;
            }

            const data = jadwalResponse.data.data;
            const today = Object.keys(data.jadwal)[0];
            const jadwal = data.jadwal[today];

            return {
                imsak: jadwal.imsak,
                subuh: jadwal.subuh,
                terbit: jadwal.terbit,
                dhuha: jadwal.dhuha,
                dzuhur: jadwal.dzuhur,
                ashar: jadwal.ashar,
                maghrib: jadwal.maghrib,
                isya: jadwal.isya
            };
        } catch (error) {
            console.error(`[SCHEDULER] Error fetching jadwal for ${kota}:`, error.message);
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
            const bannerUrl = this.getRandomBanner();
            
            // Check if Friday for Dzuhur
            const now = new Date();
            const isFriday = now.getDay() === 5;

            let message = `*Hai Teman-Teman 👋*\n`;
            
            if (nama === 'Imsak') {
                message += `*Sekedar Mengingatkan Waktu Imsak*\n`;
                message += `*Sebentar Lagi Subuh, Ayo Siap-Siap! 🕌*\n\n`;
                message += `\`Imsak :\` *${waktu}*\n`;
                message += `\`Subuh :\` *${subuhTime}*\n`;
                message += `\`Kota :\` *${kota.toUpperCase()}*\n\n`;
                message += `> _Semoga Allah memberikan kemudahan dalam ibadah kita_ 🤲`;
            } else if (nama === 'Dzuhur' && isFriday) {
                message += `*Sekedar Mengingatkan Sholat Jumat*\n`;
                message += `*Ayo Jumatan Teman-Teman! 🕌*\n\n`;
                message += `\`Jam :\` *${waktu}*\n`;
                message += `\`Kota :\` *${kota.toUpperCase()}*\n\n`;
                message += `> _Jangan lupa sholat Jumat ya, semoga berkah dan diterima ibadahnya_ 🤲`;
            } else if (nama === 'Maghrib') {
                message += `*Sekedar Mengingatkan Waktu Sholat ${nama.toUpperCase()}*\n`;
                message += `*Ayo Buruan Sholat Keburu Isya! ⏰*\n\n`;
                message += `\`Jam :\` *${waktu}*\n`;
                message += `\`Kota :\` *${kota.toUpperCase()}*\n\n`;
                message += `> _Semoga Allah memberikan kemudahan dalam ibadah kita_ 🤲`;
            } else {
                message += `*Sekedar Mengingatkan Waktu Sholat ${nama.toUpperCase()}*\n\n`;
                message += `\`Jam :\` *${waktu}*\n`;
                message += `\`Kota :\` *${kota.toUpperCase()}*\n\n`;
                message += `> _Semoga Allah memberikan kemudahan dalam ibadah kita_ 🤲`;
            }

            const messageData = {
                text: message,
                contextInfo: {
                    externalAdReply: {
                        title: `Waktu Sholat ${nama}`,
                        body: `${kota.toUpperCase()} - ${waktu}`,
                        thumbnailUrl: bannerUrl,
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
            let message = `*WAKTU DHUHA*\n\n`;
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

            const bannerUrl = this.getRandomBanner();

            let message = `*Hai Teman-Teman 👋*\n`;
            message += `*Sekedar Mengingatkan Waktu Sholat SUBUH*\n\n`;
            message += `\`Jam :\` *${waktu}*\n`;
            message += `\`Kota :\` *${kota.toUpperCase()}*\n\n`;
            message += `> _Semoga Allah memberikan kemudahan dalam ibadah kita_ 🤲`;

            const messageData = {
                text: message,
                contextInfo: {
                    externalAdReply: {
                        title: 'Waktu Sholat Subuh',
                        body: `${kota.toUpperCase()} - ${waktu}`,
                        thumbnailUrl: bannerUrl,
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

    async sendPersonalReminder(userId, nama, waktu, kota) {
        try {
            // Send 3x "Ayo sholat" first
            for (let i = 0; i < 3; i++) {
                await this.sock.sendMessage(userId, { text: '🕌 *AYO SHOLAT*' });
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Check if Friday for Dzuhur
            const now = new Date();
            const isFriday = now.getDay() === 5;
            const bannerUrl = this.getRandomBanner();

            let message = `*Hai 👋*\n`;
            
            if (nama === 'Dzuhur' && isFriday) {
                message += `*Sekedar Mengingatkan Sholat Jumat*\n`;
                message += `*Ayo Jumatan! 🕌*\n\n`;
                message += `\`Jam :\` *${waktu}*\n`;
                message += `\`Kota :\` *${kota.toUpperCase()}*\n\n`;
                message += `> _Jangan lupa sholat Jumat ya, semoga berkah dan diterima ibadahnya_ 🤲`;
            } else {
                message += `*Sekedar Mengingatkan Waktu Sholat ${nama.toUpperCase()}*\n\n`;
                message += `\`Jam :\` *${waktu}*\n`;
                message += `\`Kota :\` *${kota.toUpperCase()}*\n\n`;
                message += `> _Semoga Allah memberikan kemudahan dalam ibadah kita_ 🤲`;
            }

            try {
                await this.sock.sendMessage(userId, {
                    text: message,
                    contextInfo: {
                        externalAdReply: {
                            title: `Waktu Sholat ${nama}`,
                            body: `${kota.toUpperCase()} - ${waktu}`,
                            thumbnailUrl: bannerUrl,
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                });
            } catch (bannerError) {
                console.log(`[SCHEDULER] Banner failed for personal user, sending text only`);
                await this.sock.sendMessage(userId, { text: message });
            }

            console.log(`[SCHEDULER] Sent personal ${nama} reminder to ${userId}`);
        } catch (error) {
            console.error(`[SCHEDULER] Failed to send personal reminder:`, error.message);
        }
    }

    isNearTime(currentTime, targetTime, minutesRange) {
        const [currentH, currentM] = currentTime.split(':').map(Number);
        const [targetH, targetM] = targetTime.split(':').map(Number);
        
        const currentMinutes = currentH * 60 + currentM;
        const targetMinutes = targetH * 60 + targetM;
        
        const diff = Math.abs(currentMinutes - targetMinutes);
        return diff <= minutesRange;
    }
}

module.exports = SholatScheduler;
