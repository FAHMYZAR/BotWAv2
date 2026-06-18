const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class KickFeature extends BaseFeature {
    constructor() {
        super('kick', 'Kick member dari grup (tag/reply)', false, 'admin');
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
                await ctx.reply('❌ Hanya admin yang bisa kick member!');
                return;
            }

            if (!await AdminHelper.isBotAdmin(client, groupId)) {
                await ctx.reply('❌ Bot harus jadi admin untuk kick member!');
                return;
            }

            const targetJid = await AdminHelper.extractJidFromCtx(ctx);
            
            if (!targetJid) {
                await ctx.reply('❌ Tag atau reply pesan member yang ingin di-kick!\n\nContoh:\n> `/kick @user`\n> Reply pesan + `/kick`');
                return;
            }

            // Check if target is bot
            if (await AdminHelper.isBotJid(client, targetJid, groupId)) {
                console.log('[KICK] 🚫 BLOCKED - Target is bot!');
                await ctx.reply('🛡️');
                return;
            }

            // Check if target is protected
            if (AdminHelper.isProtected(targetJid)) {
                console.log('[KICK] 🚫 BLOCKED - Target is protected!');
                await ctx.reply('🛡️');
                return;
            }

            if (await AdminHelper.isGroupAdmin(client, groupId, targetJid)) {
                await ctx.reply('❌ Tidak bisa kick admin!');
                return;
            }

            await client.group.removeMember(groupId, [targetJid]);
            
            await ctx.reply(`✅ Member berhasil di-kick!`, {
                mentions: [targetJid]
            });

        } catch (error) {
            console.error('Kick error:', error);
            await ctx.reply('❌ Gagal kick member!');
        }
    }
}

module.exports = KickFeature;
