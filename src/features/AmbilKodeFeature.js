const BaseFeature = require('../core/BaseFeature');
const fetchJadwalKuliah = require('../utils/KuliahHelper');

class AmbilKodeFeature extends BaseFeature {
    constructor() {
        super('ambilkode', 'Ambil kode presensi dari jadwal kuliah', false, 'info');
    }

    async execute(ctx, client, args) {
        try {
            await ctx.react('⏳');

            let type = 'rpl'; // default to RPL
            if (args.length > 0 && ['rpl', 'ds'].includes(args[0].toLowerCase())) {
                type = args[0].toLowerCase();
            }

            const data = await fetchJadwalKuliah(type);

            if (data.kuliah?.isHtml) {
                await ctx.react('');
                await client.send(ctx.remoteJid).text(`*Login Gagal!*\n\n${data.kuliah?.message}\n Server RAISING bermasalah`);
                return;
            }

            const kuliahList = Array.isArray(data.kuliah) ? data.kuliah : (data.kuliah.data || []);
            
            // Filter hanya jadwal hari ini
            const today = new Date().getDay();
            const kuliahHariIni = kuliahList.filter(j => j.day_of_week_number == today);
            
            // Deduplikasi berdasarkan kombinasi nama_matakuliah + jam_awal + kelas
            // Ini penting agar matakuliah sama dengan kelas berbeda tetap muncul
            const uniqueKuliah = kuliahHariIni.filter((j, index, self) => 
                index === self.findIndex(k => 
                    k.nama_matakuliah === j.nama_matakuliah &&
                    k.jam_awal === j.jam_awal &&
                    k.nama_kelas === j.nama_kelas
                )
            );
            
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const todayName = days[today];
            
            const displayType = type === 'ds' ? 'DATA-SCIENCE' : type.toUpperCase();

            if (uniqueKuliah.length === 0) {
                await ctx.react('');
                await client.send(ctx.remoteJid).text(`*KODE PRESENSI ${displayType} ${todayName.toUpperCase()}*\n\n❌ Tidak ada jadwal kuliah hari ini!`);
                return;
            }

            let message = `*KODE PRESENSI ${displayType} ${todayName.toUpperCase()}*\n\n`;
            let hasCode = false;

            uniqueKuliah.forEach((jadwal, i) => {
                const kodePresensi = jadwal.kode || 'Belum dibuka';
                const namaMatkul = jadwal.nama_matakuliah || 'N/A';
                const kelas = jadwal.nama_kelas || '';
                
                message += `*${namaMatkul} (${kelas})*: \`${kodePresensi}\`\n`;
                
                if (kodePresensi !== 'Belum dibuka') {
                    hasCode = true;
                }
            });

            const lastKode = uniqueKuliah
                .filter(j => j.kode && j.kode !== 'Belum dibuka')
                .pop()?.kode;

            if (hasCode) {
                message += '\n_*Klik tombol untuk copy kode terbaru*_';
            } else {
                message += '_Semua kode presensi belum dibuka_';
            }

            await ctx.react('');

            if (lastKode) {
                await client.sendMessage(ctx.remoteJid, {
                    interactiveMessage: {
                        title: `${message}\n`,
                        footer: 'EL-RUWET BOT',
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: 'cta_copy',
                                    buttonParamsJson: JSON.stringify({
                                        display_text: `Copy ${lastKode}`,
                                        copy_code: lastKode
                                    })
                                }
                            ],
                            messageParamsJson: JSON.stringify({
                                limited_time_offer: {
                                    text: 'Kode Presensi',
                                    copy_code: lastKode,
                                    expiration_time: Date.now() + (60 * 60 * 1000)
                                }
                            })
                        }
                    }
                });
            } else {
                await client.send(ctx.remoteJid).text(message);
            }

        } catch (error) {
            console.error('AmbilKode error:', error);
            await ctx.react('');
            await client.send(ctx.remoteJid).text(`Terjadi kesalahan saat mengambil kode presensi!\n\nError: ${error.message}`);
        }
    }
}

module.exports = AmbilKodeFeature;