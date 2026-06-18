const BaseFeature = require('../core/BaseFeature');
const { doPresensi } = require('../utils/PresensiHelper');

class PresensiFeature extends BaseFeature {
    constructor() {
        super('presensi', 'Presensi perkuliahan otomatis dengan kode presensi', false, 'akademik');
    }

    async execute(ctx, client, args) {
        try {
            // Validasi argumen
            if (args.length < 2) {
                await client.send(ctx.remoteJid).text(`❌ *Format salah!*\n\n*Penggunaan:*\n> .presensi <NIM> <Kode>\n\n*Contoh:*\n> .presensi 123456789 ABC123\n\n*Keterangan:*\n• NIM: Nomor Induk Mahasiswa\n• Kode: Kode presensi dari dosen`);
                return;
            }

            const [nim, kodePresensi] = args;

            // Validasi NIM
            if (!/^\d+$/.test(nim)) {
                await client.send(ctx.remoteJid).text('❌ NIM harus berupa angka!');
                return;
            }

            // Validasi kode presensi (minimal 3 karakter)
            if (kodePresensi.length < 3) {
                await client.send(ctx.remoteJid).text('❌ Kode presensi minimal 3 karakter!');
                return;
            }

            // React loading
            await ctx.react('⏳');

            // Proses presensi (auto-detect password)
            const result = await doPresensi(nim, kodePresensi);

            // Clear loading reaction
            await ctx.react('');

            // Format response berdasarkan status dari API
            if (result.status === 'success') {
                await ctx.react('✅');
                
                let response = `✅ ${result.message}\n\n`;
                response += `📚 *Matakuliah:* ${result.matakuliah}\n`;
                response += `📝 *Pertemuan:* ${result.pertemuan}`;

                await client.send(ctx.remoteJid).text(response);
            } else if (result.status === 'info') {
                await ctx.react('ℹ️');
                await client.send(ctx.remoteJid).text(`ℹ️ ${result.message}`);
            } else {
                await ctx.react('❌');
                await client.send(ctx.remoteJid).text(`❌ ${result.message}`);
            }

        } catch (error) {
            console.error('[PRESENSI FEATURE ERROR]:', error);
            
            await ctx.react('❌');

            let errorMessage = '❌ *Terjadi Kesalahan!*\n\n';
            
            if (error.message.includes('Login gagal')) {
                errorMessage += '🔐 *Login Gagal!*\n\n';
                errorMessage += '💡 *Pastikan:*\n';
                errorMessage += '• NIM sudah benar\n';
                errorMessage += '• Password sudah benar\n';
                errorMessage += '• Akun RAISING aktif';
            } else if (error.message.includes('CSRF token')) {
                errorMessage += '🔒 *Token Security Bermasalah!*\n\n';
                errorMessage += '💡 *Coba beberapa saat lagi*';
            } else if (error.message.includes('ID mahasiswa')) {
                errorMessage += '🆔 *ID Mahasiswa Tidak Ditemukan!*\n\n';
                errorMessage += '💡 *Pastikan:*\n';
                errorMessage += '• Akun sudah terdaftar\n';
                errorMessage += '• Session valid';
            } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                errorMessage += '⏱️ *Koneksi Timeout!*\n\n';
                errorMessage += '💡 *Server RAISING lambat, coba lagi*';
            } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
                errorMessage += '🌐 *Tidak Dapat Terhubung ke Server!*\n\n';
                errorMessage += '💡 *Pastikan:*\n';
                errorMessage += '• Koneksi internet stabil\n';
                errorMessage += '• DNS dapat resolve raising.almaata.ac.id';
            } else {
                errorMessage += `📋 *Detail:* ${error.message}\n\n`;
                errorMessage += '💡 *Coba beberapa saat lagi*';
            }

            await client.send(ctx.remoteJid).text(errorMessage);
        }
    }
}

module.exports = PresensiFeature;
