const axios = require('axios');
const config = require('../config/config');
const GroupSystem = require('./GroupSystem');
const PersonalSholatSystem = require('./PersonalSholatSystem');

class SholatScheduler {
    constructor(sock) {
        this.sock = sock;
        this.isConnected = false;
        this.retryQueue = new Map();
        this.currentJadwal = new Map();
        this.lastBannerIndex = -1;
        this.imsakMessageCache = new Map();
        this.timers = [];
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
        console.log('[SCHEDULER] Starting event-driven prayer scheduler...');
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
        this.isConnected = true;
        this.scheduleAllReminders();
        this.scheduleMidnightReset();
    }

    scheduleMidnightReset() {
        const now = new Date();
        const mid = new Date(now);
        mid.setDate(mid.getDate() + 1);
        mid.setHours(0, 1, 0, 0);
        const delay = mid.getTime() - now.getTime();
        setTimeout(() => {
            console.log('[SCHEDULER] Midnight reset');
            this.currentJadwal.clear();
            this.imsakMessageCache.clear();
            this.scheduleAllReminders();
            this.scheduleMidnightReset();
        }, delay);
    }

    clearTimers() {
        this.timers.forEach(clearTimeout);
        this.timers = [];
    }

    async scheduleAllReminders() {
        this.clearTimers();
        const groups = await GroupSystem.getAll();
        const personalUsers = await PersonalSholatSystem.getAll();
        const cities = new Set();
        groups.forEach(g => cities.add(g.kota));
        personalUsers.forEach(u => cities.add(u.kota));
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
        const today = formatter.format(now);

        console.log(`[SCHEDULER] Scheduling ${cities.size} cities, ${groups.length} groups, ${personalUsers.length} personal`);

        for (const kota of cities) {
            const jadwal = await this.getJadwalFresh(kota, today);
            if (!jadwal) continue;
            const prayers = [
                { name: 'Imsak', time: jadwal.imsak }, { name: 'Subuh', time: jadwal.subuh },
                { name: 'Dhuha', time: jadwal.dhuha }, { name: 'Dzuhur', time: jadwal.dzuhur },
                { name: 'Ashar', time: jadwal.ashar }, { name: 'Maghrib', time: jadwal.maghrib },
                { name: 'Isya', time: jadwal.isya }
            ];
            for (const prayer of prayers) {
                if (!prayer.time) continue;
                const [h, m] = prayer.time.split(':').map(Number);
                
                // Cari waktu target hari ini di WIB (Asia/Jakarta)
                const now = new Date();
                
                // Buat tanggal target hari ini di timezone Jakarta
                const formatterWib = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'Asia/Jakarta',
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    hour12: false
                });

                const parts = formatterWib.formatToParts(now);
                const wibYear = Number(parts.find(p => p.type === 'year').value);
                const wibMonth = Number(parts.find(p => p.type === 'month').value) - 1; // 0-indexed month
                const wibDay = Number(parts.find(p => p.type === 'day').value);

                // Buat Date target dalam format UTC berdasarkan waktu WIB yang diinginkan
                // Mengingat Jakarta adalah UTC+7, kita bisa menghitung waktu UTC dari jam WIB
                // UTC = WIB - 7 jam
                const targetUtc = Date.UTC(wibYear, wibMonth, wibDay, h - 7, m, 0, 0);
                const currentUtc = now.getTime(); // Waktu absolut saat ini
                const delay = targetUtc - currentUtc;
                
                if (delay <= 0) continue;
                const timer = setTimeout(() => this.handlePrayerTime(kota, prayer.name, prayer.time, groups, personalUsers, jadwal.subuh), delay);
                this.timers.push(timer);
                console.log(`[SCHEDULER] Timer: ${kota} ${prayer.name} ${prayer.time} (${Math.round(delay / 1000)}s)`);
            }
        }
    }

    async handlePrayerTime(kota, nama, waktu, allGroups, allUsers, subuhTime) {
        if (!this.isConnected) {
            console.log(`[SCHEDULER] Not connected, queueing ${nama} ${kota}`);
            for (const g of allGroups.filter(g => g.kota === kota)) {
                const jid = g.group_id || g.groupId;
                this.retryQueue.set(`${jid}_${nama}`, { groupJid: jid, nama, waktu, kota, subuhTime });
            }
            return;
        }
        for (const groupData of allGroups.filter(g => g.kota === kota)) {
            const jid = groupData.group_id || groupData.groupId;
            if (await GroupSystem.isNotifiedToday(jid, nama)) continue;
            // Rekonstruksi object supaya konsisten untuk sendGroupReminder
            await this.sendGroupReminder({ groupId: jid, kota: groupData.kota, lat: groupData.latitude, lng: groupData.longitude, mapsUrl: groupData.maps_url }, nama, waktu, kota, subuhTime);
            await GroupSystem.updateLastNotified(jid, nama);
        }
        for (const userData of allUsers.filter(u => u.kota === kota)) {
            const uid = userData.userId;
            if (['Subuh', 'Dzuhur', 'Dhuha'].includes(nama)) {
                if (await PersonalSholatSystem.isNotifiedToday(uid, nama)) continue;
                await this.sendPersonalReminder(uid, nama, waktu, kota);
                await PersonalSholatSystem.updateLastNotified(uid, nama);
            }
        }
    }

    async sendGroupReminder(groupData, nama, waktu, kota, subuhTime) {
        const jid = groupData.groupId;
        try {
            if (nama === 'Subuh' && this.imsakMessageCache.has(jid)) {
                const key = this.imsakMessageCache.get(jid);
                try { await this.sock.sendMessage(jid, { delete: key }); } catch { }
                this.imsakMessageCache.delete(jid);
            }
            const isFriday = new Date().getDay() === 5;
            let msg = `*Hai Teman-Teman 👋*\n*Sekedar Mengingatkan Waktu Sholat ${nama.toUpperCase()}*\n\n\`Jam :\` *${waktu}*\n\`Kota :\` *${kota.toUpperCase()}*\n\n> _Semoga Allah memberikan kemudahan dalam ibadah kita_ 🤲`;
            if (nama === 'Imsak') msg = `*Hai Teman-Teman 👋*\n*Sekedar Mengingatkan Waktu Imsak*\n*Sebentar Lagi Subuh, Ayo Siap-Siap! 🕌*\n\n\`Imsak :\` *${waktu}*\n\`Subuh :\` *${subuhTime}*\n\`Kota :\` *${kota.toUpperCase()}*\n\n> _Semoga Allah memberikan kemudahan dalam ibadah kita_ 🤲`;
            if (nama === 'Maghrib') msg = `*Hai Teman-Teman 👋*\n*Sekedar Mengingatkan Waktu Sholat ${nama.toUpperCase()}*\n*Ayo Buruan Sholat Keburu Isya! ⏰*\n\n\`Jam :\` *${waktu}*\n\`Kota :\` *${kota.toUpperCase()}*\n\n> _Semoga Allah memberikan kemudahan dalam ibadah kita_ 🤲`;
            if (nama === 'Dzuhur' && isFriday) msg = `*Hai Teman-Teman 👋*\n*Sekedar Mengingatkan Sholat Jumat*\n*Ayo Jumatan Teman-Teman! 🕌*\n\n\`Jam :\` *${waktu}*\n\`Kota :\` *${kota.toUpperCase()}*\n\n> _Jangan lupa sholat Jumat ya, semoga berkah dan diterima ibadahnya_ 🤲`;

            const slug = kota.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const sourceUrl = `https://jadwal-sholat.kompas.com/${slug}`;

            const footerText = `Sumber: Kompas\nUpdate: ${new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())} WIB`;

            const thumbnail = groupData.lat && groupData.lng
                ? `https://maps.googleapis.com/maps/api/staticmap?center=${Number(groupData.lat)},${Number(groupData.lng)}&zoom=15&size=640x360&markers=color:red%7C${Number(groupData.lat)},${Number(groupData.lng)}`
                : undefined;

            await this.sock.sendMessage(jid, {
                interactiveMessage: {
                    title: `${msg}\n`,
                    footer: footerText,
                    thumbnail,
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'cta_url',
                                buttonParamsJson: JSON.stringify({
                                    display_text: 'Source Jadwal',
                                    url: sourceUrl
                                })
                            }
                        ]
                    }
                }
            });
            if (nama === 'Imsak') this.imsakMessageCache.set(jid, null);
            console.log(`[SCHEDULER] Sent ${nama} to ${jid}`);
        } catch (e) {
            console.error(`[SCHEDULER] sendGroupReminder error:`, e.message);
        }
    }

    async sendPersonalReminder(userId, nama, waktu, kota) {
        try {
            for (let i = 0; i < 3; i++) {
                await this.sock.sendMessage(userId, { text: '🕌 *AYO SHOLAT*' });
                await new Promise(r => setTimeout(r, 1000));
            }
            const isFriday = new Date().getDay() === 5;
            let msg = `*Hai 👋*\n*Sekedar Mengingatkan Waktu Sholat ${nama.toUpperCase()}*\n\n\`Jam :\` *${waktu}*\n\`Kota :\` *${kota.toUpperCase()}*\n\n> _Semoga Allah memberikan kemudahan dalam ibadah kita_ 🤲`;
            if (nama === 'Dzuhur' && isFriday) msg = `*Hai 👋*\n*Sekedar Mengingatkan Sholat Jumat*\n*Ayo Jumatan! 🕌*\n\n\`Jam :\` *${waktu}*\n\`Kota :\` *${kota.toUpperCase()}*\n\n> _Jangan lupa sholat Jumat ya_ 🤲`;
            await this.sock.sendMessage(userId, { text: msg });
            console.log(`[SCHEDULER] Personal ${nama} reminder sent to ${userId}`);
        } catch (e) {
            console.error(`[SCHEDULER] sendPersonalReminder error:`, e.message);
        }
    }

    async processRetryQueue() {
        if (this.retryQueue.size === 0) return;
        console.log(`[SCHEDULER] Processing ${this.retryQueue.size} queued messages...`);
        for (const [key, data] of this.retryQueue.entries()) {
            try {
                const groupData = { groupId: data.groupJid, kota: data.kota };
                await this.sendGroupReminder(groupData, data.nama, data.waktu, data.kota, data.subuhTime);
                await GroupSystem.updateLastNotified(data.groupJid, data.nama);
                this.retryQueue.delete(key);
            } catch (e) {
                console.error(`[SCHEDULER] Retry failed:`, e.message);
            }
        }
    }

    getJadwalFresh(kota, today) {
        const cacheKey = `${kota}_${today}`;
        if (this.currentJadwal.has(cacheKey)) return Promise.resolve(this.currentJadwal.get(cacheKey));
        return this.fetchJadwal(kota).then(jadwal => {
            if (jadwal) {
                this.currentJadwal.set(cacheKey, jadwal);
                console.log(`[SCHEDULER] Fetched jadwal for ${kota}:`, Object.values(jadwal).join(' '));
            }
            return jadwal;
        });
    }

    async fetchJadwal(kota) {
        try {
            const searchUrl = `${config.apis.myquran.sholat.search}/${encodeURIComponent(kota.toLowerCase())}`;
            const searchRes = await axios.get(searchUrl, { timeout: 10000 });
            if (!searchRes.data.status || !searchRes.data.data.length) return null;
            const cityId = searchRes.data.data[0].id;
            const jadwalRes = await axios.get(`${config.apis.myquran.sholat.jadwal}/${cityId}/today`, { timeout: 10000 });
            if (!jadwalRes.data.status || !jadwalRes.data.data.jadwal) return null;
            const jadwal = Object.values(jadwalRes.data.data.jadwal)[0];
            return {
                imsak: jadwal.imsak, subuh: jadwal.subuh, terbit: jadwal.terbit,
                dhuha: jadwal.dhuha, dzuhur: jadwal.dzuhur,
                ashar: jadwal.ashar, maghrib: jadwal.maghrib, isya: jadwal.isya
            };
        } catch (e) {
            console.error(`[SCHEDULER] fetchJadwal error for ${kota}:`, e.message);
            return null;
        }
    }

    rebuild() {
        console.log('[SCHEDULER] Rebuilding schedule...');
        this.scheduleAllReminders();
    }

    stop() {
        this.clearTimers();
        this.imsakMessageCache.clear();
        console.log('[SCHEDULER] Stopped');
    }
}

module.exports = SholatScheduler;
