const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class ResetLinkFeature extends BaseFeature {
    constructor() {
        super('resetlink', 'Reset link invite grup', false, 'admin');
        this.aliases = ['revoke'];
    }

    async execute(ctx, client, args) {
        try {
            const groupId = ctx.remoteJid;
            
            if (!groupId.endsWith('@g.us')) {
                await client.sendMessage(groupId, { text: '❌ Perintah ini hanya untuk grup!' });
                return;
            }

            const senderId = ctx.senderJid || ctx.remoteJid;
            
            if (!await AdminHelper.canExecuteAdminCommand(sock, groupId, senderId)) {
                await client.sendMessage(groupId, { text: '❌ Hanya admin yang bisa reset link grup!' });
                return;
            }

            if (!await AdminHelper.isBotAdmin(sock, groupId)) {
                await client.sendMessage(groupId, { text: '❌ Bot harus jadi admin untuk reset link grup!' });
                return;
            }

            await client.groupRevokeInvite(groupId);
            const newCode = await client.groupInviteCode(groupId);
            const newLink = `https://chat.whatsapp.com/${newCode}`;
            
            let message = `✅ *LINK GRUP BERHASIL DIRESET*\n\n`;
            message += `*Link Baru:* ${newLink}\n\n`;
            message += `_Link lama sudah tidak bisa digunakan!_`;

            await client.sendMessage(groupId, { text: message });

        } catch (error) {
            console.error('ResetLink error:', error);
            await client.sendMessage(ctx.remoteJid, { text: '❌ Gagal reset link grup!' });
        }
    }
}

module.exports = ResetLinkFeature;

