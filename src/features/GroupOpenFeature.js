const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class GroupOpenFeature extends BaseFeature {
    constructor() {
        super('open', 'Buka grup (semua bisa kirim)', false, 'admin');
        this.aliases = ['unmute'];
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
                await client.send(groupId).text('❌ Hanya admin yang bisa open grup!');
                return;
            }

            if (!await AdminHelper.isBotAdmin(client, groupId)) {
                await client.send(groupId).text('❌ Bot harus jadi admin untuk open grup!');
                return;
            }

            await client.group.setting(groupId, 'not_announcement');
            
            await client.send(groupId).text(`🔓 *GRUP DIBUKA*\n\nSemua member bisa mengirim pesan!`);

        } catch (error) {
            console.error('GroupOpen error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal membuka grup!');
        }
    }
}

module.exports = GroupOpenFeature;
