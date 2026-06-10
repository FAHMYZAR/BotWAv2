const BaseFeature = require('../core/BaseFeature');
const GroupSystem = require('../utils/GroupSystem');
const AdminHelper = require('../utils/AdminHelper');
const config = require('../config/config');

class DaftarGcFeature extends BaseFeature {
    constructor() {
        super('daftargc', 'Daftarkan grup (admin grup bisa daftar)', false, 'group');
    }

    async execute(m, sock, args) {
        try {
            const groupId = m.key.remoteJid;
            const senderId = m.key.participant || m.key.remoteJid;
            const isOwner = m.key.fromMe || senderId.replace('@s.whatsapp.net', '') === config.ownerNumber;

            if (!groupId.endsWith('@g.us')) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Perintah ini hanya bisa digunakan di grup!' 
                });
                return;
            }

            // Cek apakah user adalah owner bot atau admin grup
            const isGroupAdmin = await AdminHelper.isGroupAdmin(sock, groupId, senderId);
            
            if (!isOwner && !isGroupAdmin) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Hanya owner bot atau admin grup yang bisa daftarkan grup!' 
                });
                return;
            }

            const kota = args.join(' ');
            if (!kota) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Masukkan nama kota!\n\nContoh:\n> `/daftargc Bantul`\n> `.daftargc Yogyakarta`' 
                });
                return;
            }

            // Daftar grup dan ambil SEMUA admin grup
            const metadata = await sock.groupMetadata(groupId);
            const allAdmins = metadata.participants
                .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                .map(p => p.id);
            
            await GroupSystem.register(groupId, kota, senderId);
            
            // Rebuild scheduler timers
            if (global.sholatScheduler) {
                global.sholatScheduler.rebuild();
            }
            
            // Simpan SEMUA admin grup, bukan hanya yang daftar
            for (const adminJid of allAdmins) {
                await GroupSystem.addGroupAdmin(groupId, adminJid);
            }
            
            let message = `✅ *GRUP BERHASIL DIDAFTARKAN!*\n\n`;
            message += `*Grup:* ${metadata.subject}\n`;
            message += `*Lokasi:* ${kota}\n`;
            message += `*Didaftarkan oleh:* @${senderId.split('@')[0]}\n\n`;
            message += `🕌 *FITUR AKTIF:*\n`;
            message += `> Auto reminder sholat\n`;
            message += `> Admin grup bisa pakai prefix \`/\`\n`;
            message += `> Welcome/leave message\n\n`;
            message += `👑 *ADMIN TERDAFTAR (${allAdmins.length}):*\n`;
            allAdmins.forEach((admin, i) => {
                message += `${i + 1}. @${admin.split('@')[0]}\n`;
            });
            message += `\n_Semua admin sekarang punya akses owner!_`;

            await sock.sendMessage(groupId, { 
                text: message,
                mentions: [senderId, ...allAdmins]
            });

        } catch (error) {
            console.error('DaftarGc error:', error.message);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan!' 
            });
        }
    }
}

module.exports = DaftarGcFeature;
