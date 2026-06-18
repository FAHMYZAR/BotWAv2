const BaseFeature = require('../core/BaseFeature');
const PersonalSholatSystem = require('../utils/PersonalSholatSystem');
const axios = require('axios');
const config = require('../config/config');

class DaftarSholatFeature extends BaseFeature {
    constructor() {
        super('daftarsholat', 'Daftar reminder sholat personal', false);
    }

    async execute(ctx, client, args) {
        try {
            if (ctx.roomId.endsWith('@g.us')) {
                await ctx.reply('❌ Fitur ini hanya untuk chat pribadi!');
                return;
            }

            if (args.length === 0) {
                await ctx.reply(`❌ *Format salah!*\n\n*Penggunaan:*\n> .daftarsholat <kota>\n\n*Contoh:*\n> .daftarsholat Yogyakarta\n> .daftarsholat Jakarta`);
                return;
            }

            const kota = args.join(' ');
            await ctx.react('⏳');

            const searchUrl = `${config.apis.myquran.sholat.search}/${encodeURIComponent(kota.toLowerCase())}`;
            const searchResponse = await axios.get(searchUrl, { timeout: 10000 });

            if (!searchResponse.data.status || !searchResponse.data.data.length) {
                await ctx.react('❌');
                await ctx.reply(`❌ Kota *${kota}* tidak ditemukan!\n\nPastikan nama kota benar.`);
                return;
            }

            const cityData = searchResponse.data.data[0];

            await PersonalSholatSystem.register(ctx.senderId, cityData.lokasi);
            
            if (global.sholatScheduler) {
                global.sholatScheduler.rebuild();
            }

            await ctx.react('✅');
            await ctx.reply(`✅ *Berhasil Daftar Reminder Sholat!*\n\n📍 *Kota:* ${cityData.lokasi}\n\n🔔 Kamu akan mendapat reminder setiap waktu sholat.\n\n💡 Ketik *.batalsholat* untuk berhenti.`);

        } catch (error) {
            console.error('[DAFTAR SHOLAT ERROR]:', error);
            await ctx.react('❌');
            await ctx.reply('❌ Terjadi kesalahan! Coba lagi nanti.');
        }
    }
}

module.exports = DaftarSholatFeature;
