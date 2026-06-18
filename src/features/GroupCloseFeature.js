const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class GroupCloseFeature extends BaseFeature {
    constructor() {
        super('close', 'Tutup grup (hanya admin bisa kirim)', false, 'admin');
        this.aliases = ['mute'];
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
                await client.send(groupId).text('❌ Hanya admin yang bisa close grup!');
                return;
            }

            if (!await AdminHelper.isBotAdmin(client, groupId)) {
                await client.send(groupId).text('❌ Bot harus jadi admin untuk close grup!');
                return;
            }

            await client.group.setting(groupId, 'announcement');
            
            await client.send(groupId).text(`🔒 *GRUP DITUTUP*\n\nHanya admin yang bisa mengirim pesan!`);

        } catch (error) {
            console.error('GroupClose error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal menutup grup!');
        }
    }
}

module.exports = GroupCloseFeature;
