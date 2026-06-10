const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class GroupLinkFeature extends BaseFeature {
    constructor() {
        super('grouplink', 'Dapatkan link invite grup', false, 'admin');
        this.aliases = ['linkgrup', 'linkgroup'];
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
                await sock.sendMessage(groupId, { text: '❌ Hanya admin yang bisa ambil link grup!' });
                return;
            }

            if (!await AdminHelper.isBotAdmin(sock, groupId)) {
                await sock.sendMessage(groupId, { text: '❌ Bot harus jadi admin untuk ambil link grup!' });
                return;
            }

            const code = await sock.groupInviteCode(groupId);
            const link = `https://chat.whatsapp.com/${code}`;
            
            const metadata = await sock.groupMetadata(groupId);
            
            let message = `🔗 *LINK GRUP*\n\n`;
            message += `*Nama:* ${metadata.subject}\n`;
            message += `*Link:* ${link}\n\n`;
            message += `_Jangan share ke sembarang orang!_`;

            await sock.sendMessage(groupId, { text: message });

        } catch (error) {
            console.error('GroupLink error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal mendapatkan link grup!' });
        }
    }
}

module.exports = GroupLinkFeature;
