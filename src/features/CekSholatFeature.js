const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const cheerio = require('cheerio');

class CekSholatFeature extends BaseFeature {
    constructor() {
        super('ceksholat', 'Cek jadwal sholat kota di Indonesia', false, 'info');
        this.baseUrl = 'https://jadwal-sholat.kompas.com';
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
        console.log('[CEKSHOLAT] Fetch page:', url);
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
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
        console.log('[CEKSHOLAT] Resolve city:', kota, '->', slug);
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

    async execute(m, sock, args) {
        try {
            const kota = args.join(' ');
            console.log('[CEKSHOLAT] Command args:', args);

            if (!kota) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Masukkan nama kota!\n\nContoh:\n> `.ceksholat Blora`\n> `.ceksholat Bantul`\n> `.ceksholat Sleman`'
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '🕌', key: m.key }
            });

            const { label, page } = await this.resolveCity(kota);
            console.log('[CEKSHOLAT] Resolved label:', label);
            const jadwal = this.extractTodaySchedule(page);
            const activePrayer = this.extractActivePrayer(page);
            console.log('[CEKSHOLAT] Jadwal:', jadwal);
            console.log('[CEKSHOLAT] Active:', activePrayer);

            if (!jadwal) {
                await sock.sendMessage(m.key.remoteJid, { react: { text: '', key: m.key } });
                await sock.sendMessage(m.key.remoteJid, { text: '❌ Jadwal sholat tidak tersedia untuk hari ini!' });
                return;
            }

            let message = `🕌 *JADWAL SHOLAT ${String(label).toUpperCase()}*\n`;
            message += `*${jadwal.tanggal}*\n\n`;
            message += `\`Subuh :\` ${jadwal.subuh}\n`;
            message += `\`Terbit :\` ${jadwal.terbit}\n`;
            message += `\`Dzuhur :\` ${jadwal.dzuhur}\n`;
            message += `\`Ashar :\` ${jadwal.ashar}\n`;
            message += `\`Maghrib :\` ${jadwal.maghrib}\n`;
            message += `\`Isya :\` ${jadwal.isya}`;

            if (activePrayer?.time) {
                message += `\n\n> _Menuju ${activePrayer.name}: ${activePrayer.time}_`;
            }

            console.log('[CEKSHOLAT] Sending message...');
            await sock.sendMessage(m.key.remoteJid, { react: { text: '', key: m.key } });
            await sock.sendMessage(m.key.remoteJid, { text: message });
            console.log('[CEKSHOLAT] Message sent');
        } catch (error) {
            console.error('CekSholat error:', error.message, error.stack);
            await sock.sendMessage(m.key.remoteJid, { react: { text: '', key: m.key } });
            let errorMsg = '❌ Terjadi kesalahan saat mengecek jadwal sholat!';
            if (error.message === 'Kota tidak ditemukan') {
                errorMsg = '❌ Kota tidak ditemukan! Pastikan nama kota benar.';
            } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
                errorMsg = '❌ Koneksi bermasalah, coba lagi nanti!';
            }
            await sock.sendMessage(m.key.remoteJid, { text: errorMsg });
        }
    }
}

module.exports = CekSholatFeature;
