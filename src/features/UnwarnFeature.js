const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');
const WarnSystem = require('../utils/WarnSystem');

class UnwarnFeature extends BaseFeature {
    constructor() {
        super('unwarn', 'Hapus 1 warning member', false, 'admin');
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
                await client.send(groupId).text('❌ Hanya admin yang bisa unwarn member!');
                return;
            }

            const targetJid = await AdminHelper.extractJidFromCtx(ctx);
            
            if (!targetJid) {
                await client.send(groupId).text('❌ Tag atau reply pesan member yang ingin di-unwarn!\n\nContoh:\n> `.unwarn @user`\n> Reply pesan + `.unwarn`');
                return;
            }

            const removed = await WarnSystem.removeWarn(groupId, targetJid);
            
            if (!removed) {
                await client.send(groupId).text('❌ Member ini tidak punya warning!');
                return;
            }

            const totalWarns = await WarnSystem.getWarnCount(groupId, targetJid);
            
            await client.send(groupId).text(`✅ 1 warning dihapus!\n\nMember: @${targetJid.split('@')[0]}\nSisa Warn: ${totalWarns}/${WarnSystem.maxWarns}`).mentions([targetJid]
            );

        } catch (error) {
            console.error('Unwarn error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal menghapus warning!');
        }
    }
}

module.exports = UnwarnFeature;
