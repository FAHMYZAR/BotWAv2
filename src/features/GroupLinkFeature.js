const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class GroupLinkFeature extends BaseFeature {
    constructor() {
        super('grouplink', 'Dapatkan link invite grup', false, 'admin');
        this.aliases = ['linkgrup', 'linkgroup'];
    }

    async execute(ctx, client, args) {
        try {
            const groupId = ctx.remoteJid;
            
            if (!groupId.endsWith('@g.us')) {
                await client.send(groupId).text('❌ Perintah ini hanya untuk grup!');
                return;
            }

            const senderId = ctx.senderJid || ctx.remoteJid;
            
            if (!await AdminHelper.canExecuteAdminCommand(client, groupId, senderId)) {
                await client.send(groupId).text('❌ Hanya admin yang bisa ambil link grup!');
                return;
            }

            if (!await AdminHelper.isBotAdmin(client, groupId)) {
                await client.send(groupId).text('❌ Bot harus jadi admin untuk ambil link grup!');
                return;
            }

            const code = await client.group.inviteCode(groupId);
            const link = `https://chat.whatsapp.com/${code}`;
            
            const metadata = await client.group.metadata(groupId);
            
            let message = `🔗 *LINK GRUP*\n\n`;
            message += `*Nama:* ${metadata.subject}\n`;
            message += `*Link:* ${link}\n\n`;
            message += `_Jangan share ke sembarang orang!_`;

            await client.send(groupId).text(message);

        } catch (error) {
            console.error('GroupLink error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal mendapatkan link grup!');
        }
    }
}

module.exports = GroupLinkFeature;
