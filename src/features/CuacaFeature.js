const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class CuacaFeature extends BaseFeature {
    constructor() {
        super('cuaca', 'Cek cuaca kota di Indonesia', false);
    }

    getWeatherBanner(cuaca, description) {
        const weather = cuaca.toLowerCase();
        const desc = description.toLowerCase();

        // Hujan
        if (weather.includes('rain') || desc.includes('rain')) {
            return 'https://media.suara.com/pictures/653x366/2022/05/11/43846-ilustrasi-hujan-bacaan-doa-turun-hujan-dan-artinyapixabay.jpg';
        }
        // Berawan/Mendung
        if (weather.includes('clouds') || desc.includes('cloud') || desc.includes('overcast')) {
            return 'https://akcdn.detik.net.id/community/media/visual/2025/01/05/potret-mendung-hitam-menggelanyut-di-langit-jakarta_43.jpeg?w=400&q=90';
        }
        // Cerah
        if (weather.includes('clear') || desc.includes('clear')) {
            return 'https://images.unsplash.com/photo-1601297183305-6df142704ea2?w=800';
        }
        // Gerimis/Drizzle
        if (weather.includes('drizzle') || desc.includes('drizzle')) {
            return 'https://media.suara.com/pictures/653x366/2022/05/11/43846-ilustrasi-hujan-bacaan-doa-turun-hujan-dan-artinyapixabay.jpg';
        }
        // Badai
        if (weather.includes('thunderstorm') || desc.includes('thunder')) {
            return 'https://media.suara.com/pictures/653x366/2022/05/11/43846-ilustrasi-hujan-bacaan-doa-turun-hujan-dan-artinyapixabay.jpg';
        }
        // Default
        return 'https://lh4.googleusercontent.com/proxy/ou4voJsmQDMGoQocyZvWROlwQkgOEU9B-xn0eNt25g7u1xVFMwjoh8NvZ9AAu0v2fA3zPJ91ai6NzLYoTAmyoQmb9Abi_y_xB7OKB886dd9EvoEdNVhVFuT16jrRXZLbuxDeg8RvNt1DfajITZQ2vfriF_ptBdDzDicEluTOAvTYDJzs3w6cnplKZ93DScBJ_a4z-Agh-M7G';
    }

    translateWeather(description) {
        const translations = {
            'clear sky': 'Langit Cerah',
            'few clouds': 'Sedikit Berawan',
            'scattered clouds': 'Berawan Tersebar',
            'broken clouds': 'Berawan',
            'overcast clouds': 'Mendung',
            'light rain': 'Hujan Ringan',
            'moderate rain': 'Hujan Sedang',
            'heavy rain': 'Hujan Lebat',
            'drizzle': 'Gerimis',
            'thunderstorm': 'Badai Petir',
            'mist': 'Kabut',
            'fog': 'Kabut Tebal'
        };
        return translations[description.toLowerCase()] || description;
    }

    async execute(m, sock, args) {
        try {
            const kota = args.join(' ');

            if (!kota) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Masukkan nama kota!\n\nContoh:\n> `.cuaca Yogyakarta`\n> `.cuaca Jakarta`\n> `.cuaca Blora`' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { text: '🌤️ Mengecek cuaca...' });

            const response = await axios.get(`${config.apis.lolhuman}/cuaca/${encodeURIComponent(kota)}`, {
                params: { apikey: config.lolhumanApiKey },
                timeout: 10000
            });

            if (response.data.status !== 200 || !response.data.result) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Kota tidak ditemukan! Pastikan nama kota benar.' 
                });
                return;
            }

            const data = response.data.result;
            const weatherDesc = this.translateWeather(data.description);
            const bannerUrl = this.getWeatherBanner(data.cuaca, data.description);

            const mapsUrl = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;

            let message = `🌤️ *CUACA ${data.tempat.toUpperCase()}*\n\n`;
            message += `*🌡️ SUHU*\n> \`${data.suhu}\`\n`;
            message += `*☁️ KONDISI*\n> \`${weatherDesc}\`\n`;
            message += `*💧 KELEMBAPAN*\n> \`${data.kelembapan}\`\n`;
            message += `*💨 ANGIN*\n> \`${data.angin}\`\n`;
            message += `*🌊 TEKANAN UDARA*\n> \`${data.udara}\`\n`;
            message += `*📍 LOKASI*\n> ${mapsUrl}\n\n`;
            message += `_🔥 FAHMYZZX-BOT © ${new Date().getFullYear()}_`;

            // Download banner
            try {
                const bannerResponse = await axios.get(bannerUrl, { 
                    responseType: 'arraybuffer', 
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                await sock.sendMessage(m.key.remoteJid, {
                    image: Buffer.from(bannerResponse.data),
                    caption: message
                });
            } catch (err) {
                console.error('Banner download error:', err.message);
                // Fallback tanpa banner
                await sock.sendMessage(m.key.remoteJid, { text: message });
            }

        } catch (error) {
            console.error('Cuaca error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat mengecek cuaca!' 
            });
        }
    }
}

module.exports = CuacaFeature;
