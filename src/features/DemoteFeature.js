const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class DemoteFeature extends BaseFeature {
    constructor() {
        super('demote', 'Cabut admin member', false, 'admin');
    }

    async execute(ctx, client, args) {
        try {
            const groupId = ctx.roomId;
            
            if (!groupId.endsWith('@g.us')) {
                await ctx.reply('❌ Perintah ini hanya untuk grup!');
                return;
            }

            const senderId = ctx.senderId;
            
            if (!await AdminHelper.canExecuteAdminCommand(client, groupId, senderId)) {
                await ctx.reply('❌ Hanya admin yang bisa demote member!');
                return;
            }

            if (!await AdminHelper.isBotAdmin(client, groupId)) {
                await ctx.reply('❌ Bot harus jadi admin untuk demote member!');
                return;
            }

            const targetJid = await AdminHelper.extractJidFromCtx(ctx);
            
            if (!targetJid) {
                await ctx.reply('❌ Tag atau reply pesan admin yang ingin di-demote!\n\nContoh:\n> `/demote @user`\n> Reply pesan + `/demote`');
                return;
            }

            // Check if target is bot
            if (await AdminHelper.isBotJid(client, targetJid, groupId)) {
                await ctx.reply('🛡️');
                return;
            }

            // Check if target is protected
            if (AdminHelper.isProtected(targetJid)) {
                await ctx.reply('🛡️');
                return;
            }

            if (!await AdminHelper.isGroupAdmin(client, groupId, targetJid)) {
                await ctx.reply('❌ Member ini bukan admin!');
                return;
            }

            await client.group.demote(groupId, [targetJid]);
            
            await ctx.reply(`✅ Admin berhasil di-demote!`, {
                mentions: [targetJid]
            });

        } catch (error) {
            console.error('Demote error:', error);
            await ctx.reply('❌ Gagal demote admin!');
        }
    }
}

module.exports = DemoteFeature;
