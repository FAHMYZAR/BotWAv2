const BaseFeature = require('../core/BaseFeature');
const fetchJadwalKuliah = require('../utils/KuliahHelper');

class FullKuliahFeature extends BaseFeature {
    constructor() {
        super('fullkuliah', 'Lihat semua jadwal kuliah & ujian minggu ini', false);
    }

    removeGelar(nama) {
        if (!nama) return 'N/A';
        return nama
            .replace(/,?\s*(S\.Pd|S\.T|S\.Kom|S\.Si|S\.Sos|M\.Pd|M\.T|M\.Kom|M\.Si|Dr\.|Prof\.)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    formatDate(dateStr) {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
        const d = new Date(dateStr);
        const day = d.getDate();
        const month = months[d.getMonth()];
        const year = d.getFullYear().toString().slice(-2);
        return `${day} ${month} ${year}`;
    }

    async execute(m, sock, args) {
        try {
            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            const data = await fetchJadwalKuliah();

            if (data.kuliah?.isHtml || data.ujian?.isHtml) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ *Login Gagal!*\n\n${data.kuliah?.message || data.ujian?.message}\n\nKemungkinan:\n• Session expired\n• Username/password salah\n• Server RAISING bermasalah` 
                });
                return;
            }

            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            
            // Process Kuliah with deduplication
            const kuliahList = Array.isArray(data.kuliah) ? data.kuliah : (data.kuliah.data || []);
            const uniqueKuliah = kuliahList.filter((j, index, self) => 
                index === self.findIndex(k => 
                    k.nama_matakuliah === j.nama_matakuliah &&
                    k.jam_awal === j.jam_awal &&
                    k.day_of_week_number === j.day_of_week_number
                )
            );
            const kuliahByDay = {};
            uniqueKuliah.forEach(j => {
                const day = j.day_of_week_number;
                if (!kuliahByDay[day]) kuliahByDay[day] = [];
                kuliahByDay[day].push(j);
            });

            // Process Ujian
            const ujianList = Array.isArray(data.ujian) ? data.ujian : (data.ujian.data || []);

            let message = `📅 *JADWAL MINGGU INI*\n\n`;

            // Display by day
            Object.keys(kuliahByDay).sort().forEach(day => {
                const dayName = days[day];
                const kuliah = kuliahByDay[day];
                const tanggal = kuliah[0]?.tanggal_pertemuan_presensi || '';
                const formattedDate = tanggal ? this.formatDate(tanggal) : '';

                message += `*${dayName.toUpperCase()}${formattedDate ? `, ${formattedDate}` : ''}*\n`;

                // Kuliah
                if (kuliah.length > 0) {
                    message += `*Kuliah:*\n`;
                    kuliah.forEach((j, i) => {
                        message += `> _${i + 1}. ${j.nama_matakuliah}_\n`;
                        message += `   \`Jam :\` ${j.jam_awal} - ${j.jam_akhir}\n`;
                        message += `   \`Kelas :\` ${j.nama_ruang} | ${j.nama_kelas}\n`;
                        message += `   \`Dosen :\` ${this.removeGelar(j.nama_dosen_pengampu_koordinator)}\n`;
                        if (i < kuliah.length - 1) message += `\n`;
                    });
                }

                // Ujian for this day
                const ujianDay = ujianList.filter(u => u.tanggal_ujian === tanggal);
                if (ujianDay.length > 0) {
                    message += `\n*Ujian:*\n`;
                    ujianDay.forEach((u, i) => {
                        message += `> _${i + 1}. ${u.nama_matakuliah || u.matakuliah}_\n`;
                        message += `   \`Jam :\` ${u.jam_mulai} - ${u.jam_selesai}\n`;
                        message += `   \`Ruangan :\` ${u.ruangan || 'N/A'}\n`;
                        message += `   \`Jenis Ujian :\` ${u.jenis_ujian || 'Ujian'}\n`;
                        if (i < ujianDay.length - 1) message += `\n`;
                    });
                }

                message += `\n`;
            });

            // Ujian tanpa jadwal kuliah (jika ada)
            const ujianOrphan = ujianList.filter(u => {
                return !Object.values(kuliahByDay).flat().some(k => 
                    k.tanggal_pertemuan_presensi === u.tanggal_ujian
                );
            });

            if (ujianOrphan.length > 0) {
                message += `*UJIAN LAINNYA*\n`;
                ujianOrphan.forEach((u, i) => {
                    message += `> _${i + 1}. ${u.nama_matakuliah || u.matakuliah}_\n`;
                    message += `   \`Tanggal :\` ${u.tanggal_ujian}\n`;
                    message += `   \`Jam :\` ${u.jam_mulai} - ${u.jam_selesai}\n`;
                    message += `   \`Kelas :\` ${u.ruangan || 'N/A'}\n`;
                    message += `   \`Jenis Ujian :\` ${u.jenis_ujian || 'Ujian'}\n`;
                    if (i < ujianOrphan.length - 1) message += `\n`;
                });
            }

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { text: message });

        } catch (error) {
            console.error('FullKuliah error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: `❌ Terjadi kesalahan saat mengambil jadwal!\n\nError: ${error.message}` 
            });
        }
    }
}

module.exports = FullKuliahFeature;
