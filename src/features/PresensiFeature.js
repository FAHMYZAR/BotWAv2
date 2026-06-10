const BaseFeature = require('../core/BaseFeature');
const { doPresensi } = require('../utils/PresensiHelper');

class PresensiFeature extends BaseFeature {
    constructor() {
        super('presensi', 'Presensi perkuliahan otomatis dengan kode presensi', false, 'akademik');
    }

    async execute(m, sock, args) {
        try {
            // Validasi argumen
            if (args.length < 2) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: `❌ *Format salah!*\n\n*Penggunaan:*\n> .presensi <NIM> <Kode>\n\n*Contoh:*\n> .presensi 123456789 ABC123\n\n*Keterangan:*\n• NIM: Nomor Induk Mahasiswa\n• Kode: Kode presensi dari dosen`
                });
                return;
            }

            const [nim, kodePresensi] = args;

            // Validasi NIM
            if (!/^\d+$/.test(nim)) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ NIM harus berupa angka!'
                });
                return;
            }

            // Validasi kode presensi (minimal 3 karakter)
            if (kodePresensi.length < 3) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Kode presensi minimal 3 karakter!'
                });
                return;
            }

            // React loading
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '⏳', key: m.key }
            });

            // Proses presensi (auto-detect password)
            const result = await doPresensi(nim, kodePresensi);

            // Clear loading reaction
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            // Format response berdasarkan status dari API
            if (result.status === 'success') {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '✅', key: m.key }
                });
                
                let response = `✅ ${result.message}\n\n`;
                response += `📚 *Matakuliah:* ${result.matakuliah}\n`;
                response += `📝 *Pertemuan:* ${result.pertemuan}`;

                await sock.sendMessage(m.key.remoteJid, { text: response });
            } else if (result.status === 'info') {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: 'ℹ️', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, {
                    text: `ℹ️ ${result.message}`
                });
            } else {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '❌', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `❌ ${result.message}` 
                });
            }

        } catch (error) {
            console.error('[PRESENSI FEATURE ERROR]:', error);
            
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '❌', key: m.key }
            });

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

            await sock.sendMessage(m.key.remoteJid, { text: errorMessage });
        }
    }
}

module.exports = PresensiFeature;
