const BaseFeature = require('../core/BaseFeature');
const GroupSystem = require('../utils/GroupSystem');
const AdminHelper = require('../utils/AdminHelper');

class CekAdminFeature extends BaseFeature {
    constructor() {
        super('cekadmin', 'Cek status admin (debugging)', false, 'tools');
    }

    async execute(ctx, client, args) {
        try {
            const groupId = ctx.remoteJid;
            const senderId = ctx.senderJid || ctx.remoteJid;

            if (!groupId.endsWith('@g.us')) {
                await client.send(groupId).text('❌ Perintah ini hanya untuk grup!');
                return;
            }

            const registeredGroup = await GroupSystem.get(groupId);
            const isGroupAdmin = await AdminHelper.isGroupAdmin(client, groupId, senderId);
            const isInDatabase = registeredGroup && registeredGroup.groupAdmins && registeredGroup.groupAdmins.includes(senderId);

            let message = `🔍 *CEK STATUS ADMIN*\n\n`;
            message += `*User:* @${senderId.split('@')[0]}\n\n`;
            message += `*Status:*\n`;
            message += `> Grup Terdaftar: ${registeredGroup ? '✅ Ya' : '❌ Tidak'}\n`;
            message += `> Admin di WA: ${isGroupAdmin ? '✅ Ya' : '❌ Tidak'}\n`;
            message += `> Admin di Database: ${isInDatabase ? '✅ Ya' : '❌ Tidak'}\n`;
            message += `> Bisa Pakai \`/\`: ${isInDatabase ? '✅ Ya' : '❌ Tidak'}\n\n`;

            if (registeredGroup) {
                message += `*Admin Terdaftar (${registeredGroup.groupAdmins?.length || 0}):*\n`;
                if (registeredGroup.groupAdmins && registeredGroup.groupAdmins.length > 0) {
                    registeredGroup.groupAdmins.forEach((admin, i) => {
                        message += `${i + 1}. @${admin.split('@')[0]}\n`;
                    });
                } else {
                    message += `_Tidak ada admin terdaftar_\n`;
                }
                message += `\n_Gunakan \`/syncadmin\` untuk update admin_`;
            } else {
                message += `_Daftar grup dulu dengan \`/daftargc [kota]\`_`;
            }

            const mentions = [senderId];
            if (registeredGroup?.groupAdmins) {
                mentions.push(...registeredGroup.groupAdmins);
            }

            await client.send(groupId).text(message).mentions(mentions
            );

        } catch (error) {
            console.error('CekAdmin error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal cek status admin!');
        }
    }
}

module.exports = CekAdminFeature;
