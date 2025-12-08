const BaseFeature = require('../core/BaseFeature');
const fetchJadwalKuliah = require('../utils/KuliahHelper');

class CekKuliahFeature extends BaseFeature {
    constructor() {
        super('cekkuliah', 'Cek jadwal kuliah & ujian hari ini atau hari tertentu', false);
    }

    getDayNumber(dayName) {
        const days = {
            'minggu': 0, 'senin': 1, 'selasa': 2, 'rabu': 3,
            'kamis': 4, 'jumat': 5, 'sabtu': 6
        };
        return days[dayName.toLowerCase()];
    }

    removeGelar(nama) {
        if (!nama) return 'N/A';
        return nama
            .replace(/,?\s*(S\.Pd|S\.T|S\.Kom|S\.Si|S\.Sos|M\.Pd|M\.T|M\.Kom|M\.Si|Dr\.|Prof\.)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    formatDate(date) {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
        const d = new Date(date);
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
            const now = new Date();
            
            // Check if user specified a day
            let targetDay, targetDayName;
            if (args.length > 0) {
                const dayNumber = this.getDayNumber(args[0]);
                if (dayNumber === undefined) {
                    await sock.sendMessage(m.key.remoteJid, {
                        react: { text: '', key: m.key }
                    });
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: '❌ Nama hari tidak valid!\n\nContoh:\n> .cekkuliah senin\n> .cekkuliah jumat' 
                    });
                    return;
                }
                targetDay = dayNumber;
                targetDayName = days[dayNumber];
            } else {
                targetDay = now.getDay();
                targetDayName = days[targetDay];
            }
            
            const todayDate = now.toISOString().split('T')[0];

            // Process Kuliah with deduplication
            const kuliahList = Array.isArray(data.kuliah) ? data.kuliah : (data.kuliah.data || []);
            const uniqueKuliah = kuliahList.filter((j, index, self) => 
                index === self.findIndex(k => 
                    k.nama_matakuliah === j.nama_matakuliah &&
                    k.jam_awal === j.jam_awal &&
                    k.day_of_week_number === j.day_of_week_number
                )
            );
            const kuliahHariIni = uniqueKuliah.filter(j => j.day_of_week_number == targetDay);

            // Process Ujian
            const ujianList = Array.isArray(data.ujian) ? data.ujian : (data.ujian.data || []);
            const ujianHariIni = ujianList.filter(u => u.tanggal_ujian === todayDate);

            // Get tanggal from jadwal (prioritas kuliah, fallback ujian, fallback today)
            const jadwalDate = kuliahHariIni[0]?.tanggal_pertemuan_presensi || ujianHariIni[0]?.tanggal_ujian || todayDate;
            const formattedDate = this.formatDate(jadwalDate);

            // Jika keduanya kosong
            if (kuliahHariIni.length === 0 && ujianHariIni.length === 0) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `📅 *JADWAL ${targetDayName.toUpperCase()}, ${formattedDate}*\n\n✅ Tidak ada jadwal!` 
                });
                return;
            }

            let message = `📅 *JADWAL ${targetDayName.toUpperCase()}, ${formattedDate}*\n\n`;

            // Tampilkan Kuliah jika ada
            if (kuliahHariIni.length > 0) {
                message += `*KULIAH*\n`;
                kuliahHariIni.forEach((j, i) => {
                    message += `> _${i + 1}. ${j.nama_matakuliah}_\n`;
                    message += `   \`Jam :\` ${j.jam_awal} - ${j.jam_akhir}\n`;
                    message += `   \`Kelas :\` ${j.nama_ruang} | ${j.nama_kelas}\n`;
                    message += `   \`Dosen :\` ${this.removeGelar(j.nama_dosen_pengampu_koordinator)}\n`;
                    if (i < kuliahHariIni.length - 1) message += `\n`;
                });
                if (ujianHariIni.length > 0) message += `\n\n`;
            }

            // Tampilkan Ujian jika ada
            if (ujianHariIni.length > 0) {
                message += `*UJIAN*\n`;
                ujianHariIni.forEach((u, i) => {
                    message += `> _${i + 1}. ${u.nama_matakuliah || u.matakuliah}_\n`;
                    message += `   \`Jam :\` ${u.jam_mulai} - ${u.jam_selesai}\n`;
                    message += `   \`Ruangan :\` ${u.ruangan || 'N/A'}\n`;
                    message += `   \`Jenis Ujian :\` ${u.jenis_ujian || 'Ujian'}\n`;
                    if (i < ujianHariIni.length - 1) message += `\n`;
                });
            }

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { text: message });

        } catch (error) {
            console.error('CekKuliah error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: `❌ Terjadi kesalahan saat mengambil jadwal!\n\nError: ${error.message}` 
            });
        }
    }
}

module.exports = CekKuliahFeature;
