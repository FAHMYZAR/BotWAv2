const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');
const WarnSystem = require('../utils/WarnSystem');

class WarnFeature extends BaseFeature {
    constructor() {
        super('warn', 'Beri warning ke member (3x = kick)', false, 'admin');
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
                await client.send(groupId).text('❌ Hanya admin yang bisa warn member!');
                return;
            }

            const targetJid = await AdminHelper.extractJidFromCtx(ctx);
            
            if (!targetJid) {
                await client.send(groupId).text('❌ Tag atau reply pesan member yang ingin di-warn!\n\nContoh:\n> `/warn @user spam`\n> Reply pesan + `/warn alasan`');
                return;
            }

            // Check if target is bot
            if (await AdminHelper.isBotJid(client, targetJid, groupId)) {
                console.log('[WARN] 🚫 BLOCKED - Target is bot!');
                await client.send(groupId).text('🛡️');
                return;
            }

            // Check if target is protected
            if (AdminHelper.isProtected(targetJid)) {
                console.log('[WARN] 🚫 BLOCKED - Target is protected!');
                await client.send(groupId).text('🛡️');
                return;
            }

            if (await AdminHelper.isGroupAdmin(client, groupId, targetJid)) {
                await client.send(groupId).text('❌ Tidak bisa warn admin!');
                return;
            }

            const reason = args.join(' ') || 'Tidak ada alasan';
            const totalWarns = await WarnSystem.addWarn(groupId, targetJid, reason, senderId);

            let message = `⚠️ *WARNING*\n\n`;
            message += `Member: @${targetJid.split('@')[0]}\n`;
            message += `Alasan: ${reason}\n`;
            message += `Total Warn: ${totalWarns}/${WarnSystem.maxWarns}\n\n`;

            if (await WarnSystem.shouldKick(groupId, targetJid)) {
                if (await AdminHelper.isBotAdmin(client, groupId)) {
                    await client.group.removeMember(groupId, [targetJid]);
                    message += `❌ Member telah di-kick karena mencapai ${WarnSystem.maxWarns} warning!`;
                    await WarnSystem.resetWarns(groupId, targetJid);
                } else {
                    message += `⚠️ Member seharusnya di-kick, tapi bot bukan admin!`;
                }
            } else {
                message += `⚠️ ${WarnSystem.maxWarns - totalWarns} warning lagi akan di-kick!`;
            }

            await client.send(groupId).text(message).mentions([targetJid]
            );

        } catch (error) {
            console.error('Warn error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal memberi warning!');
        }
    }
}

module.exports = WarnFeature;
