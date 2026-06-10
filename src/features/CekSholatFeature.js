const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config/config');

class CekSholatFeature extends BaseFeature {
    constructor() {
        super('ceksholat', 'Cek jadwal sholat kota di Indonesia', false, 'info');
        this.banners = config.sholatBanners;
        this.lastBannerIndex = -1;
        this.baseUrl = 'https://jadwal-sholat.kompas.com';
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
            if (value && text) {
                cities.push({ value, text });
            }
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
        if (!activeElement.length) {
            return null;
        }

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
            if (!matched) {
                throw new Error('Kota tidak ditemukan');
            }
            const cityPage = await this.fetchPage(matched.value);
            return { slug: matched.value, label: matched.text, page: cityPage };
        }
    }

    async execute(m, sock, args) {
        try {
            const kota = args.join(' ');

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
            const jadwal = this.extractTodaySchedule(page);

            if (!jadwal) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Jadwal sholat tidak tersedia untuk hari ini!'
                });
                return;
            }

            const activePrayer = this.extractActivePrayer(page);

            let message = `🕌 *JADWAL SHOLAT ${label.toUpperCase()}*\n`;
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

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            const banner = this.getRandomBanner();

            await sock.sendMessage(m.key.remoteJid, {
                text: message,
                contextInfo: {
                    externalAdReply: {
                        title: `Jadwal Sholat ${label}`,
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
