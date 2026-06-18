const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config/config');

class CekSholatFeature extends BaseFeature {
    constructor() {
        super('ceksholat', 'Cek jadwal sholat kota di Indonesia', false, 'info');
        this.baseUrl = 'https://jadwal-sholat.kompas.com';
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

    slugify(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    async fetchPage(slug = '') {
        const url = slug ? `${this.baseUrl}/${slug}` : this.baseUrl;
        const response = await axios.get(url, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return cheerio.load(response.data);
    }

    extractCities($) {
        const cities = [];
        $('select.js-imsak option').each((_, el) => {
            const value = $(el).attr('value');
            const text = $(el).text().trim();
            if (value && text) cities.push({ value, text });
        });
        return cities;
    }

    extractTodaySchedule($) {
        const rows = [];
        $('.wPrayertime-table table tbody tr').each((_, el) => {
            const cols = $(el).find('td').map((__, td) => $(td).text().trim()).get();
            if (cols.length >= 7) {
                rows.push({
                    tanggal: cols[0],
                    subuh: cols[1],
                    terbit: cols[2],
                    dzuhur: cols[3],
                    ashar: cols[4],
                    maghrib: cols[5],
                    isya: cols[6]
                });
            }
        });

        const today = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date()).replace(/\//g, '/');

        return rows.find(row => row.tanggal.includes(today)) || rows[0] || null;
    }

    extractActivePrayer($) {
        const activeElement = $('.wPrayertime-table.--headline td.--active');
        if (!activeElement.length) return null;

        const texts = activeElement.text().replace(/\s+/g, ' ').trim();
        const timeMatch = texts.match(/\b\d{2}:\d{2}\b/);
        const prayerMatch = texts.replace(/\d{2}:\d{2}/g, '').trim();

        return {
            name: prayerMatch || 'Waktu Aktif',
            time: timeMatch ? timeMatch[0] : ''
        };
    }

    async resolveCity(kota) {
        const slug = this.slugify(kota);
        try {
            const page = await this.fetchPage(slug);
            const cities = this.extractCities(page);
            const matched = cities.find(city => city.value === slug) || cities.find(city => this.slugify(city.text).includes(slug));
            return { slug: matched?.value || slug, label: matched?.text || kota, page };
        } catch {
            const page = await this.fetchPage();
            const cities = this.extractCities(page);
            const matched = cities.find(city => this.slugify(city.text).includes(slug) || city.value.includes(slug));
            if (!matched) throw new Error('Kota tidak ditemukan');
            const cityPage = await this.fetchPage(matched.value);
            return { slug: matched.value, label: matched.text, page: cityPage };
        }
    }

    getCountdown(targetTimeStr) {
        if (!targetTimeStr) return '';
        const [targetH, targetM] = targetTimeStr.split(':').map(Number);
        const localNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
        
        const targetDate = new Date(localNow);
        targetDate.setHours(targetH, targetM, 0, 0);

        let diffMs = targetDate.getTime() - localNow.getTime();
        if (diffMs < 0) {
            targetDate.setDate(targetDate.getDate() + 1);
            diffMs = targetDate.getTime() - localNow.getTime();
        }

        const h = Math.floor(diffMs / (1000 * 60 * 60));
        const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        let res = '';
        if (h > 0) res += `${h} jam `;
        if (m > 0) res += `${m} menit`;
        return res.trim() || 'kurang dari 1 menit';
    }

    async execute(ctx, client, args) {
        try {
            const targetJid = ctx.roomId || ctx.senderId;
            const kota = args.join(' ');

            if (!kota) {
                await ctx.reply('❌ Masukkan nama kota!\n\nContoh:\n> `.ceksholat Blora`\n> `.ceksholat Bantul`\n> `.ceksholat Sleman`');
                return;
            }

            await ctx.react('🕌');

            const { label, page } = await this.resolveCity(kota);
            const jadwal = this.extractTodaySchedule(page);
            const activePrayer = this.extractActivePrayer(page);

            if (!jadwal) {
                await ctx.reply('❌ Jadwal sholat tidak tersedia untuk hari ini!');
                return;
            }

            const sourceUrl = `${this.baseUrl}/${this.slugify(label)}`;
            const countdown = activePrayer?.time ? this.getCountdown(activePrayer.time) : '';
            let message = `*Jadwal Sholat ${String(label).toUpperCase()}*\n\n`;
            message += `*Jadwal*\n`;
            message += `*Tanggal: ${jadwal.tanggal}*\n`;
            message += `› Subuh: ${jadwal.subuh}\n`;
            message += `› Terbit: ${jadwal.terbit}\n`;
            message += `› Dzuhur: ${jadwal.dzuhur}\n`;
            message += `› Ashar: ${jadwal.ashar}\n`;
            message += `› Maghrib: ${jadwal.maghrib}\n`;
            message += `› Isya: ${jadwal.isya}`;

            if (activePrayer?.time) {
                message += `\n\n_Menuju ${activePrayer.name} ${countdown}_`;
            }

            await ctx.react('');

            try {
                const banner = this.getRandomBanner();
                await client.send(targetJid).buttons(
                    [{ type: 'url', text: 'Source Jadwal', url: sourceUrl }],
                    { image: banner, text: message, footer: '© EL-RUWET TEAM' }
                );
            } catch (err) {
                await client.send(targetJid).text(message + '\n\n' + sourceUrl);
            }
        } catch (error) {
            console.error('CekSholat error:', error.message, error.stack);
            let errorMsg = '❌ Terjadi kesalahan saat mengecek jadwal sholat!';
            if (error.message === 'Kota tidak ditemukan') {
                errorMsg = '❌ Kota tidak ditemukan! Pastikan nama kota benar.';
            } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
                errorMsg = '❌ Koneksi bermasalah, coba lagi nanti!';
            }
            await ctx.reply(errorMsg);
        }
    }
}

module.exports = CekSholatFeature;
