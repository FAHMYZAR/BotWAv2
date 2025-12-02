const BaseFeature = require('../core/BaseFeature');
const config = require('../config/config');

class ModeFeature extends BaseFeature {
    constructor() {
        super('mode', 'Ubah mode bot (public/private)', true);
    }

    async execute(m, sock, args) {
        try {
            // Jika tanpa argument, tampilkan status
            if (!args.length) {
                const currentMode = config.mode;
                const modeIcon = currentMode === 'public' ? '🌐' : '🔒';
                const modeDesc = currentMode === 'public' 
                    ? 'Bot bisa dipakai di grup & private chat'
                    : 'Bot hanya bisa dipakai di private chat';

                await sock.sendMessage(m.key.remoteJid, { 
                    text: `${modeIcon} *MODE BOT*\n\n` +
                          `📊 Status: *${currentMode.toUpperCase()}*\n` +
                          `📝 Deskripsi: ${modeDesc}\n\n` +
                          `💡 Ubah mode:\n` +
                          `• !mode public - Aktifkan di grup\n` +
                          `• !mode private - Hanya private chat`
                });
                return;
            }

            const newMode = args[0].toLowerCase();

            if (newMode !== 'public' && newMode !== 'private') {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Mode tidak valid!\n\n' +
                          '✅ Pilihan:\n' +
                          '• public - Bot aktif di grup & private\n' +
                          '• private - Bot hanya di private chat'
                });
                return;
            }

            const success = config.setMode(newMode);

            if (success) {
                const modeIcon = newMode === 'public' ? '🌐' : '🔒';
                const modeDesc = newMode === 'public' 
                    ? 'Bot sekarang bisa dipakai di grup & private chat'
                    : 'Bot sekarang hanya bisa dipakai di private chat';

                await sock.sendMessage(m.key.remoteJid, { 
                    text: `${modeIcon} *MODE BERHASIL DIUBAH!*\n\n` +
                          `📊 Mode baru: *${newMode.toUpperCase()}*\n` +
                          `📝 ${modeDesc}\n\n` +
                          `✅ Perubahan langsung aktif!`
                });
            } else {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Gagal mengubah mode!'
                });
            }

        } catch (error) {
            console.error('Mode error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat mengubah mode!'
            });
        }
    }
}

module.exports = ModeFeature;
