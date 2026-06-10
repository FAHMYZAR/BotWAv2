const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class ResetLinkFeature extends BaseFeature {
    constructor() {
        super('resetlink', 'Reset link invite grup', false, 'admin');
        this.aliases = ['revoke'];
    }

    async execute(m, sock, args) {
        try {
            const groupId = m.key.remoteJid;
            
            if (!groupId.endsWith('@g.us')) {
                await sock.sendMessage(groupId, { text: '❌ Perintah ini hanya untuk grup!' });
                return;
            }

            const senderId = m.key.participant || m.key.remoteJid;
            
            if (!await AdminHelper.canExecuteAdminCommand(sock, groupId, senderId)) {
                await sock.sendMessage(groupId, { text: '❌ Hanya admin yang bisa reset link grup!' });
                return;
            }

            if (!await AdminHelper.isBotAdmin(sock, groupId)) {
                await sock.sendMessage(groupId, { text: '❌ Bot harus jadi admin untuk reset link grup!' });
                return;
            }

            await sock.groupRevokeInvite(groupId);
            const newCode = await sock.groupInviteCode(groupId);
            const newLink = `https://chat.whatsapp.com/${newCode}`;
            
            let message = `✅ *LINK GRUP BERHASIL DIRESET*\n\n`;
            message += `*Link Baru:* ${newLink}\n\n`;
            message += `_Link lama sudah tidak bisa digunakan!_`;

            await sock.sendMessage(groupId, { text: message });

        } catch (error) {
            console.error('ResetLink error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal reset link grup!' });
        }
    }
}

module.exports = ResetLinkFeature;
