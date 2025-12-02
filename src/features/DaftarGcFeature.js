const BaseFeature = require('../core/BaseFeature');
const GroupRegistry = require('../utils/GroupRegistry');

class DaftarGcFeature extends BaseFeature {
    constructor() {
        super('daftargc', 'Daftarkan grup untuk auto reminder sholat', true);
    }

    async execute(m, sock, args) {
        try {
            const kota = args.join(' ');

            if (!m.key.remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Perintah ini hanya bisa digunakan di grup!' 
                });
                return;
            }

            if (!kota) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Masukkan nama kota!\n\nContoh: `/daftargc Bantul`' 
                });
                return;
            }

            GroupRegistry.register(m.key.remoteJid, kota);

            await sock.sendMessage(m.key.remoteJid, { 
                text: `✅ Grup berhasil didaftarkan!\n\n🕌 *AUTO REMINDER SHOLAT*\n> Lokasi: \`${kota}\`\n\nBot akan mengirim reminder otomatis saat waktu sholat tiba.` 
            });

        } catch (error) {
            console.error('DaftarGc error:', error.message);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan!' 
            });
        }
    }
}

module.exports = DaftarGcFeature;
