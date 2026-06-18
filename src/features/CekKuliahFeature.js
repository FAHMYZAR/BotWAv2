const BaseFeature = require('../core/BaseFeature');
const fetchJadwalKuliah = require('../utils/KuliahHelper');

class CekKuliahFeature extends BaseFeature {
    constructor() {
        super('cekkuliah', 'Cek jadwal kuliah hari ini atau hari tertentu', false, 'akademik');
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

    async execute(ctx, client, args) {
        try {
            await ctx.react('⏳');

            let type = 'rpl'; // default to RPL
            let dayArg = null;

            if (args.length > 0) {
                if (['rpl', 'ds'].includes(args[0].toLowerCase())) {
                    type = args[0].toLowerCase();
                    if (args.length > 1) {
                        dayArg = args[1];
                    }
                } else {
                    dayArg = args[0];
                }
            }

            const data = await fetchJadwalKuliah(type);

            if (data.kuliah?.isHtml || data.ujian?.isHtml) {
                await ctx.react('');
                await client.send(ctx.remoteJid).text(`❌ *Login Gagal!*\n\n${data.kuliah?.message || data.ujian?.message}\n\nKemungkinan:\n• Session expired\n• Username/password salah\n• Server RAISING bermasalah`);
                return;
            }

            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const now = new Date();
            
            // Check if user specified a day
            let targetDay, targetDayName;
            if (dayArg) {
                const dayNumber = this.getDayNumber(dayArg);
                if (dayNumber === undefined) {
                    await ctx.react('');
                    await client.send(ctx.remoteJid).text('❌ Nama hari tidak valid!\n\nContoh:\n> .cekkuliah rpl senin\n> .cekkuliah ds jumat');
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

            // Get tanggal from jadwal kuliah
            const jadwalDate = kuliahHariIni[0]?.tanggal_pertemuan_presensi || todayDate;
            const formattedDate = this.formatDate(jadwalDate);

            // Jika kosong
            if (kuliahHariIni.length === 0) {
                await ctx.react('');
                await client.send(ctx.remoteJid).text(`📅 *JADWAL ${targetDayName.toUpperCase()}, ${formattedDate}*\n\n✅ Tidak ada jadwal!`);
                return;
            }

            const displayType = type === 'ds' ? 'DATA-SCIENCE' : type.toUpperCase();
            let message = `📅 *JADWAL KULIAH ${displayType} - ${targetDayName.toUpperCase()}, ${formattedDate}*\n\n`;

            kuliahHariIni.forEach((j, i) => {
                const tipe = j.tipe_pertemuan_presensi === 'T' ? 'Teori' : 
                            j.tipe_pertemuan_presensi === 'P' ? 'Praktikum' : 
                            j.tipe_pertemuan_presensi === 'Tt' ? 'Tutorial' : 
                            j.tipe_pertemuan_presensi === 'PIC' ? 'PIC' : 'N/A';
                
                message += `> _${i + 1}. ${j.nama_matakuliah}_\n`;
                message += `   \`Jam :\` ${j.jam_awal} - ${j.jam_akhir}\n`;
                message += `   \`Kelas :\` ${j.nama_ruang} | ${j.nama_kelas}\n`;
                message += `   \`Ket :\` ${j.judul || 'N/A'}\n`;
                message += `   \`Tipe :\` ${tipe}\n`;
                message += `   \`Dosen :\` ${this.removeGelar(j.nama_dosen_pengampu_koordinator)}\n`;
                if (i < kuliahHariIni.length - 1) message += `\n`;
            });

            await ctx.react('');
            await client.send(ctx.remoteJid).text(message);

        } catch (error) {
            console.error('CekKuliah error:', error);
            await client.send(ctx.remoteJid).text(`❌ Terjadi kesalahan saat mengambil jadwal!\n\nError: ${error.message}`);
        }
    }
}

module.exports = CekKuliahFeature;
