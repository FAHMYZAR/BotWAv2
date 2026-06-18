const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class DeleteFeature extends BaseFeature {
    constructor() {
        super('delete', 'Hapus pesan (reply pesan yang ingin dihapus)', false, 'admin');
        this.aliases = ['del'];
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
                await client.send(groupId).text('❌ Hanya admin yang bisa delete pesan!');
                return;
            }

            if (!await AdminHelper.isBotAdmin(client, groupId)) {
                await client.send(groupId).text('❌ Bot harus jadi admin untuk delete pesan!');
                return;
            }

            const quotedMessage = (await ctx.replied().catch(()=>null))?.message;
            const quotedKey = (await ctx.replied().catch(()=>null))?.uniqueId;
            const quotedParticipant = (await ctx.replied().catch(()=>null))?.senderJid;
            
            if (!quotedMessage || !quotedKey) {
                await client.send(groupId).text('❌ Reply pesan yang ingin dihapus!\n\nContoh:\n> Reply pesan + `.delete`\n> Reply pesan + `.del`');
                return;
            }

            await client.delete({
                remoteJid: groupId,
                fromMe: false,
                id: quotedKey,
                participant: quotedParticipant
            });

            await client.send(groupId).text('✅ Pesan berhasil dihapus!');

        } catch (error) {
            console.error('Delete error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal menghapus pesan!');
        }
    }
}

module.exports = DeleteFeature;
