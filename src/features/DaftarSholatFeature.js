const BaseFeature = require('../core/BaseFeature');
const PersonalSholatSystem = require('../utils/PersonalSholatSystem');
const axios = require('axios');
const config = require('../config/config');

class DaftarSholatFeature extends BaseFeature {
    constructor() {
        super('daftarsholat', 'Daftar reminder sholat personal', false);
    }

    async execute(m, sock, args) {
        try {
            // Hanya bisa di chat pribadi
            if (m.key.remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Fitur ini hanya untuk chat pribadi!'
                });
                return;
            }

            if (args.length === 0) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: `❌ *Format salah!*\n\n*Penggunaan:*\n> .daftarsholat <kota>\n\n*Contoh:*\n> .daftarsholat Yogyakarta\n> .daftarsholat Jakarta`
                });
                return;
            }

            const kota = args.join(' ');

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '⏳', key: m.key }
            });

            // Validasi kota via API
            const searchUrl = `${config.apis.myquran.sholat.search}/${encodeURIComponent(kota.toLowerCase())}`;
            const searchResponse = await axios.get(searchUrl, { timeout: 10000 });

            if (!searchResponse.data.status || !searchResponse.data.data.length) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '❌', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, {
                    text: `❌ Kota *${kota}* tidak ditemukan!\n\nPastikan nama kota benar.`
                });
                return;
            }

            const cityData = searchResponse.data.data[0];

            // Register user
            await PersonalSholatSystem.register(m.key.remoteJid, cityData.lokasi);
            
            if (global.sholatScheduler) {
                global.sholatScheduler.rebuild();
            }

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '✅', key: m.key }
            });

            await sock.sendMessage(m.key.remoteJid, {
                text: `✅ *Berhasil Daftar Reminder Sholat!*\n\n📍 *Kota:* ${cityData.lokasi}\n\n🔔 Kamu akan mendapat reminder setiap waktu sholat.\n\n💡 Ketik *.batalsholat* untuk berhenti.`
            });

        } catch (error) {
            console.error('[DAFTAR SHOLAT ERROR]:', error);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '❌', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Terjadi kesalahan! Coba lagi nanti.'
            });
        }
    }
}

module.exports = DaftarSholatFeature;
