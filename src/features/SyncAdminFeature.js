const BaseFeature = require('../core/BaseFeature');
const GroupSystem = require('../utils/GroupSystem');
const AdminHelper = require('../utils/AdminHelper');
const config = require('../config/config');

class SyncAdminFeature extends BaseFeature {
    constructor() {
        super('syncadmin', 'Sinkronkan admin grup ke database', false, 'admin');
    }

    async execute(m, sock, args) {
        try {
            const groupId = m.key.remoteJid;
            const senderId = m.key.participant || m.key.remoteJid;
            const isOwner = m.key.fromMe || senderId.replace('@s.whatsapp.net', '') === config.ownerNumber;

            if (!groupId.endsWith('@g.us')) {
                await sock.sendMessage(groupId, { text: '❌ Perintah ini hanya untuk grup!' });
                return;
            }

            const registeredGroup = await GroupSystem.get(groupId);
            if (!registeredGroup) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Grup belum terdaftar! Daftar dulu dengan `/daftargc [kota]`' 
                });
                return;
            }

            const isGroupAdmin = await AdminHelper.isGroupAdmin(sock, groupId, senderId);
            
            if (!isOwner && !isGroupAdmin) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Hanya owner bot atau admin grup yang bisa sync admin!' 
                });
                return;
            }

            const admins = await AdminHelper.getGroupAdmins(sock, groupId);
            
            // Reset dan update semua admin
            registeredGroup.groupAdmins = admins;
            // Update group admins in MongoDB
            for (const adminJid of allAdmins) {
                await GroupSystem.addGroupAdmin(groupId, adminJid);
            }

            let message = `✅ *ADMIN BERHASIL DISINKRONKAN*\n\n`;
            message += `*Total Admin:* ${admins.length}\n\n`;
            message += `Admin yang terdaftar:\n`;
            admins.forEach((admin, i) => {
                message += `${i + 1}. @${admin.split('@')[0]}\n`;
            });
            message += `\n_Semua admin sekarang bisa pakai prefix \`/\`_`;

            await sock.sendMessage(groupId, { 
                text: message,
                mentions: admins
            });

        } catch (error) {
            console.error('SyncAdmin error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal sync admin!' });
        }
    }
}

module.exports = SyncAdminFeature;
