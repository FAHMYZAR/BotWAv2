const BaseFeature = require('../core/BaseFeature');
const config = require('../config/config');

class RouterClient {
    constructor() {
        this.baseUrl = String(config.router?.baseUrl || '').replace(/\/$/, '');
        this.apiKey = config.router?.apiKey;
        this.chatModel = config.router?.chatModel;
    }

    get headers() {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
        };
    }

    extractChatText(data) {
        const choice = data?.choices?.[0];
        const messageContent = choice?.message?.content;
        if (typeof messageContent === 'string') return messageContent;
        if (Array.isArray(messageContent)) {
            const joined = messageContent.map((item) => typeof item === 'string' ? item : item?.text || item?.content || '').filter(Boolean).join('\n');
            if (joined) return joined;
        }
        if (typeof choice?.text === 'string') return choice.text;
        if (typeof data?.output_text === 'string') return data.output_text;
        return '';
    }

    async chat(messages) {
        if (!this.baseUrl || !this.apiKey) throw new Error('Router AI belum diset');
        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ model: this.chatModel, stream: false, messages })
        });
        if (!response.ok) throw new Error(await response.text() || 'Router chat gagal');
        return this.extractChatText(await response.json());
    }

    async search(query, maxResults = 5) {
        if (!this.baseUrl || !this.apiKey) throw new Error('Router AI belum diset');
        const response = await fetch(`${this.baseUrl}/v1/search`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ model: 'searxng', query, search_type: 'web', max_results: maxResults, language: 'id' })
        });
        if (!response.ok) throw new Error(await response.text() || 'Router search gagal');
        return response.json();
    }
}

class CuacaFeature extends BaseFeature {
    constructor() {
        super('cuaca', 'Cek cuaca lokasi manapun di dunia (realtime)', false, 'info');
    }

    getCurrentDateTime() {
        return new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(new Date());
    }

    async execute(ctx, client, args) {
        try {
            const lokasi = args.join(' ');

            if (!lokasi) {
                await client.send(ctx.remoteJid).text('❌ Masukkan nama lokasi!\n\n*Contoh:*\n> `.cuaca Jakarta`\n> `.cuaca New York`\n> `.cuaca Tokyo`\n> `.cuaca Paris, France`\n\n✨ Bisa cek cuaca di seluruh dunia!');
                return;
            }

            await ctx.react('🌤️');

            const currentDateTime = this.getCurrentDateTime();
            const systemInstruction = `Kamu adalah asisten cuaca yang memberikan informasi cuaca realtime.

*TUGAS:*
1. Cari data cuaca TERKINI untuk lokasi yang diminta menggunakan Google Search
2. Berikan informasi dalam format yang KONSISTEN dan TERSTRUKTUR
3. Gunakan data REALTIME dari sumber terpercaya (weather.com, accuweather, dll)
4. Waktu pencarian: ${currentDateTime} WIB (Asia/Jakarta)
5. WAJIB cari timezone lokasi dan hitung selisih waktu dengan WIB

*FORMAT OUTPUT WAJIB (STRICT):*
Berikan HANYA dalam format ini, tidak boleh ada teks tambahan:

🌤️ *CUACA [NAMA LOKASI]*

*🌡️ SUHU :* \`[suhu]°C / [suhu]°F\`
*☁️ KONDISI :* \`[kondisi cuaca dalam bahasa Indonesia]\`
*💦 KELEMBAPAN :* \`[kelembapan]%\`
*🌬️ ANGIN :* \`[kecepatan angin] km/jam\`
*🧭 ARAH ANGIN :* \`[arah angin]\`
*🔥 MATAHARI :*
> Terbit: \`[waktu]\` | Terbenam: \`[waktu]\`
*WAKTU [NAMA LOKASI] :* \`[HH:MM] ([Timezone])
*SELISIH :* \`[+/-X jam Y menit dari WIB]\`

_Update: ${currentDateTime} WIB_

*ATURAN PENTING:*
- Gunakan data TERKINI (hari ini, jam ini yaitu ${currentDateTime} di Asia/Jakarta)
- WAJIB tampilkan JAM LOKAL di lokasi tersebut dalam format 24 jam (HH:MM)
- WAJIB hitung SELISIH WAKTU dengan WIB dalam format: "+X jam Y menit" atau "-X jam Y menit"
- Contoh selisih: "+7 jam 0 menit", "-5 jam 30 menit", "+0 jam 30 menit"
- Jika selisih 0 (sama dengan WIB), JANGAN tampilkan baris JAM LOKAL dan SELISIH WAKTU
- Jika lokasi tidak ditemukan, katakan "❌ Lokasi tidak ditemukan"
- Suhu dalam Celsius DAN Fahrenheit
- Kondisi cuaca dalam Bahasa Indonesia
- Waktu matahari dalam format 24 jam (HH:MM)
- JANGAN tambahkan penjelasan atau teks di luar format`;

            const client = new RouterClient();
            const searchResults = await client.search(`cuaca ${lokasi} ${currentDateTime}`, 5);

            if (!searchResults?.data?.length) {
                await ctx.react('');
                await client.send(ctx.remoteJid).text('❌ Lokasi tidak ditemukan!\n\nPastikan nama lokasi benar atau coba format lain:\n> `.cuaca [Kota], [Negara]`');
                return;
            }

            const rawAnswer = await client.chat([
                { role: 'system', content: systemInstruction + '\n\nJawab berdasarkan SEARCH_RESULT di bawah. Jangan mengarang data di luar hasil search.' },
                { role: 'user', content: `SEARCH_RESULT:\n${JSON.stringify(searchResults.data, null, 2)}\n\nBerikan informasi cuaca TERKINI untuk lokasi: ${lokasi}` }
            ]);

            await ctx.react('');

            if (rawAnswer.includes('tidak ditemukan') || rawAnswer.includes('not found')) {
                await client.send(ctx.remoteJid).text('❌ Lokasi tidak ditemukan!\n\nPastikan nama lokasi benar atau coba format lain:\n> `.cuaca [Kota], [Negara]`');
                return;
            }

            await client.send(ctx.remoteJid).text(rawAnswer);

        } catch (error) {
            console.error('Cuaca error:', error.message);
            await ctx.react('');
            await client.send(ctx.remoteJid).text('❌ Terjadi kesalahan saat mengecek cuaca!\n\nCoba lagi dalam beberapa saat.');
        }
    }
}

module.exports = CuacaFeature;
