const BaseFeature = require('../core/BaseFeature');
const fetchJadwalKuliah = require('../utils/KuliahHelper');

class CekUjianFeature extends BaseFeature {
    constructor() {
        super('cekujian', 'Cek jadwal ujian hari ini atau hari tertentu', false, 'akademik');
    }

    getDayNumber(dayName) {
        const days = {
            'minggu': 0, 'senin': 1, 'selasa': 2, 'rabu': 3,
            'kamis': 4, 'jumat': 5, 'sabtu': 6
        };
        return days[dayName.toLowerCase()];
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

            const data = await fetchJadwalKuliah();

            if (data.ujian?.isHtml) {
                await ctx.react('');
                await client.send(ctx.remoteJid).text(`❌ *Login Gagal!*\n\n${data.ujian?.message}\n\nKemungkinan:\n• Session expired\n• Username/password salah\n• Server RAISING bermasalah`);
                return;
            }

            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const now = new Date();
            
            let targetDay, targetDayName;
            if (args.length > 0) {
                const dayNumber = this.getDayNumber(args[0]);
                if (dayNumber === undefined) {
                    await ctx.react('');
                    await client.send(ctx.remoteJid).text('❌ Nama hari tidak valid!\n\nContoh:\n> .cekujian senin\n> .cekujian jumat');
                    return;
                }
                targetDay = dayNumber;
                targetDayName = days[dayNumber];
            } else {
                targetDay = now.getDay();
                targetDayName = days[targetDay];
            }
            
            const todayDate = now.toISOString().split('T')[0];

            const ujianList = Array.isArray(data.ujian) ? data.ujian : [];
            const targetDate = args.length > 0 ? null : todayDate;
            const ujianHariIni = ujianList.filter(u => {
                if (targetDate) {
                    return u.tanggal_ujian === targetDate;
                } else {
                    const ujianDate = new Date(u.tanggal_ujian);
                    return ujianDate.getDay() === targetDay;
                }
            });

            const jadwalDate = ujianHariIni[0]?.tanggal_ujian || todayDate;
            const formattedDate = this.formatDate(jadwalDate);

            if (ujianHariIni.length === 0) {
                await ctx.react('');
                await client.send(ctx.remoteJid).text(`📅 *JADWAL UJIAN ${targetDayName.toUpperCase()}, ${formattedDate}*\n\n✅ Tidak ada jadwal ujian!`);
                return;
            }

            let message = `📅 *JADWAL UJIAN ${targetDayName.toUpperCase()}, ${formattedDate}*\n\n`;

            ujianHariIni.forEach((u, i) => {
                message += `> _${i + 1}. ${u.nama_matakuliah}_\n`;
                message += `   \`Jam :\` ${u.waktu_ujian}\n`;
                message += `   \`Kelas :\` ${u.nama_ruang}\n`;
                message += `   \`Jenis :\` ${u.jenis_ujian}\n`;
                message += `   \`Tipe :\` ${u.tipe_ujian}\n`;
                if (i < ujianHariIni.length - 1) message += `\n`;
            });

            await ctx.react('');
            await client.send(ctx.remoteJid).text(message);

        } catch (error) {
            console.error('CekUjian error:', error);
            await client.send(ctx.remoteJid).text(`❌ Terjadi kesalahan saat mengambil jadwal ujian!\n\nError: ${error.message}`);
        }
    }
}

module.exports = CekUjianFeature;
