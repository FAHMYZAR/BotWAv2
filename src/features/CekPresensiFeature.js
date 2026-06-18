const BaseFeature = require('../core/BaseFeature');
const { cekPresensi } = require('../utils/PresensiHelper');

class CekPresensiFeature extends BaseFeature {
    constructor() {
        super('cekpresensi', 'Cek jadwal presensi hari ini (nim dan/atau password opsional)', false, 'info');
    }

    async execute(ctx, client, args) {
        try {
            let nim, password = null;

            // Format: .cekpresensi <nim> [password]
            if (args.length > 0) {
                nim = args[0];
                if (args.length > 1) password = args[1];
            } else {
                await client.send(ctx.remoteJid).text('❌ Masukkan NIM!\n\n*Contoh:*\n> `.cekpresensi 243200330` (auto password)\n> `.cekpresensi 243200330 Pass243200330` (manual password)');
                return;
            }

            await ctx.react('⏳');

            const result = await cekPresensi(nim, password);

            await ctx.react('');

            if (!result || result.total === 0) {
                await client.send(ctx.remoteJid).text(`📋 *Ringkasan Presensi*\n\n✅ Tidak ada jadwal perkuliahan hari ini.`);
                return;
            }

            const todayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const todayName = todayNames[new Date().getDay()];
            
            const formatDate = (date) => {
                const pad = (n) => n.toString().padStart(2, '0');
                const d = new Date(date);
                return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())} WIB`;
            };

            let message = `📋 *RINGKASAN PRESENSI - ${todayName.toUpperCase()}*\n`;
            message += `Nama: ${result.nama}\n`;
            message += `NIM: ${result.nim}\n\n`;
            message += `Sudah: ${result.sudah} | Belum: ${result.belum}\n\n`;
            result.list.forEach((item, i) => {
                const statusStr = item.status === 'sudah' ? '✅ Sudah' : '❌ Belum';
                message += `> _${i + 1}. ${item.matakuliah} (${item.kelas})_\n`;
                message += `   \`Jam :\` ${item.jam}\n`;
                message += `   \`Ruangan :\` ${item.ruang}\n`;
                message += `   \`Status :\` ${statusStr}\n`;
                if (i < result.list.length - 1) message += '\n';
            });

            message += `\n_Update: ${formatDate(result.updatedAt)}_\n`;
            message += `_EL-RUWET TEAM_`;

            await client.send(ctx.remoteJid).text(message);

        } catch (error) {
            console.error('CekPresensi error:', error);
            await ctx.react('');
            await client.send(ctx.remoteJid).text(`❌ *Cek Presensi Gagal!*\n\n${error.message}\n\n💡 Pastikan NIM dan password benar.`);
        }
    }
}

module.exports = CekPresensiFeature;
