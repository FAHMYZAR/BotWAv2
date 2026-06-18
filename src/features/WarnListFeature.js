const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');
const WarnSystem = require('../utils/WarnSystem');

class WarnListFeature extends BaseFeature {
    constructor() {
        super('warnlist', 'Lihat daftar warning di grup', false, 'admin');
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
                await client.send(groupId).text('❌ Hanya admin yang bisa lihat warning list!');
                return;
            }

            const allWarns = await WarnSystem.getAllWarnsInGroup(groupId);
            
            if (allWarns.length === 0) {
                await client.send(groupId).text('✅ Tidak ada member yang punya warning!');
                return;
            }

            let message = `*DAFTAR WARNING*\n\n`;
            
            for (let i = 0; i < allWarns.length; i++) {
                const warn = allWarns[i];
                const phone = warn.userId.split('@')[0];
                message += `*${i + 1}.* @${phone}\n`;
                message += `Warn: ${warn.totalWarns}/${WarnSystem.maxWarns}\n`;
                
                if (warn.warns.length > 0) {
                    const lastWarn = warn.warns[warn.warns.length - 1];
                    message += `Terakhir: ${lastWarn.reason}\n`;
                }
                message += `\n`;
            }

            const mentions = allWarns.map(w => w.userId);

            await client.send(groupId).text(message).mentions(mentions
            );

        } catch (error) {
            console.error('WarnList error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal menampilkan warning list!');
        }
    }
}

module.exports = WarnListFeature;
