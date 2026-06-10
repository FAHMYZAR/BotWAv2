const BaseFeature = require('../core/BaseFeature');
const { cekPresensi } = require('../utils/PresensiHelper');

class CekPresensiFeature extends BaseFeature {
    constructor() {
        super('cekpresensi', 'Cek jadwal presensi hari ini (nim dan/atau password opsional)', false, 'info');
    }

    async execute(m, sock, args) {
        try {
            let nim, password = null;

            // Format: .cekpresensi <nim> [password]
            if (args.length > 0) {
                nim = args[0];
                if (args.length > 1) password = args[1];
            } else {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Masukkan NIM!\n\n*Contoh:*\n> `.cekpresensi 243200330` (auto password)\n> `.cekpresensi 243200330 Pass243200330` (manual password)'
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            const result = await cekPresensi(nim, password);

            await sock.sendMessage(m.key.remoteJid, { react: { text: '', key: m.key } });

            if (!result || result.total === 0) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: `📋 *Ringkasan Presensi*\n\n✅ Tidak ada jadwal perkuliahan hari ini.`
                });
                return;
            }

            const todayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const todayName = todayNames[new Date().getDay()];
            
            let message = `📋 *Ringkasan Presensi - ${todayName.toUpperCase()}*\n\n`;
            message += `✅ Sudah: ${result.sudah}\n`;
            message += `❌ Belum: ${result.belum}\n`;
            message += `📚 Total: ${result.total}\n\n`;
            message += `━━━━━━━━━━━━━━━━━\n\n`;

            result.list.forEach((item, i) => {
                const icon = item.status === 'sudah' ? '✅' : '❌';
                message += `${icon} *${item.matakuliah} (${item.kelas})*\n`;
                message += `   🕐 ${item.jam}\n`;
                message += `   📍 ${item.ruang}\n`;
                if (i < result.list.length - 1) message += '\n';
            });

            await sock.sendMessage(m.key.remoteJid, { text: message });

        } catch (error) {
            console.error('CekPresensi error:', error);
            await sock.sendMessage(m.key.remoteJid, { react: { text: '', key: m.key } });
            await sock.sendMessage(m.key.remoteJid, {
                text: `❌ *Cek Presensi Gagal!*\n\n${error.message}\n\n💡 Pastikan NIM dan password benar.`
            });
        }
    }
}

module.exports = CekPresensiFeature;
