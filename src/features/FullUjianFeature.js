const BaseFeature = require('../core/BaseFeature');
const fetchJadwalKuliah = require('../utils/KuliahHelper');

class FullUjianFeature extends BaseFeature {
    constructor() {
        super('fullujian', 'Lihat semua jadwal ujian', false, 'akademik');
    }

    formatDate(date) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const d = new Date(date);
        const dayName = days[d.getDay()];
        const day = d.getDate();
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `${dayName}, ${day} ${month} ${year}`;
    }

    async execute(m, sock, args) {
        try {
            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            const data = await fetchJadwalKuliah();

            if (data.ujian?.isHtml) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ *Login Gagal!*\n\n${data.ujian?.message}\n\nKemungkinan:\n• Session expired\n• Username/password salah\n• Server RAISING bermasalah` 
                });
                return;
            }

            const ujianList = Array.isArray(data.ujian) ? data.ujian : [];

            if (ujianList.length === 0) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '📅 *JADWAL UJIAN*\n\n✅ Tidak ada jadwal ujian!' 
                });
                return;
            }

            // Group by date
            const groupedByDate = {};
            ujianList.forEach(u => {
                if (!groupedByDate[u.tanggal_ujian]) {
                    groupedByDate[u.tanggal_ujian] = [];
                }
                groupedByDate[u.tanggal_ujian].push(u);
            });

            // Sort dates
            const sortedDates = Object.keys(groupedByDate).sort();

            let message = '📅 *JADWAL UJIAN LENGKAP*\n\n';

            sortedDates.forEach((date, dateIndex) => {
                const formattedDate = this.formatDate(date);
                message += `*${formattedDate}*\n`;

                groupedByDate[date].forEach((u, i) => {
                    message += `> _${i + 1}. ${u.nama_matakuliah}_\n`;
                    message += `   \`Jam :\` ${u.waktu_ujian}\n`;
                    message += `   \`Kelas :\` ${u.nama_ruang}\n`;
                    message += `   \`Jenis :\` ${u.jenis_ujian}\n`;
                    message += `   \`Tipe :\` ${u.tipe_ujian}\n`;
                    if (i < groupedByDate[date].length - 1) message += `\n`;
                });

                if (dateIndex < sortedDates.length - 1) message += `\n\n`;
            });

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { text: message });

        } catch (error) {
            console.error('FullUjian error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: `❌ Terjadi kesalahan saat mengambil jadwal ujian!\n\nError: ${error.message}` 
            });
        }
    }
}

module.exports = FullUjianFeature;
