const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class PromoteFeature extends BaseFeature {
    constructor() {
        super('promote', 'Jadikan member sebagai admin', false, 'admin');
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
                await ctx.reply('❌ Hanya admin yang bisa promote member!');
                return;
            }

            if (!await AdminHelper.isBotAdmin(client, groupId)) {
                await ctx.reply('❌ Bot harus jadi admin untuk promote member!');
                return;
            }

            const targetJid = await AdminHelper.extractJidFromCtx(ctx);
            
            if (!targetJid) {
                await ctx.reply('❌ Tag atau reply pesan member yang ingin di-promote!\n\nContoh:\n> `.promote @user`\n> Reply pesan + `.promote`');
                return;
            }

            if (await AdminHelper.isGroupAdmin(client, groupId, targetJid)) {
                await ctx.reply('❌ Member ini sudah admin!');
                return;
            }

            await client.group.promote(groupId, [targetJid]);
            
            await ctx.reply(`✅ Member berhasil di-promote menjadi admin!`, {
                mentions: [targetJid]
            });

        } catch (error) {
            console.error('Promote error:', error);
            await ctx.reply('❌ Gagal promote member!');
        }
    }
}

module.exports = PromoteFeature;
