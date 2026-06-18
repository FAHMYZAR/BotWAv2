const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class GetJidFeature extends BaseFeature {
    constructor() {
        super('getjid', 'Ambil JID user (untuk @lid format)', false, 'owner');
    }

    async execute(ctx, client, args) {
        try {
            const groupId = ctx.remoteJid;
            const targetJid = await AdminHelper.extractJidFromCtx(ctx);
            
            if (!targetJid) {
                await client.send(groupId).text('❌ Tag atau reply pesan user untuk ambil JID!\n\nContoh:\n> `/getjid @user`\n> Reply pesan + `/getjid`');
                return;
            }

            // Extract number
            const number = targetJid
                .replace('@s.whatsapp.net', '')
                .replace('@c.us', '')
                .replace('@lid', '')
                .split(':')[0]
                .split('@')[0];

            let message = '*📋 USER INFO*\n\n';
            message += `*JID:* \`${targetJid}\`\n`;
            message += `*Number:* ${number}\n`;
            message += `*Format:* ${targetJid.includes('@lid') ? '@lid (Newsletter/Channel)' : '@s.whatsapp.net (Normal)'}\n\n`;
            message += `_Copy JID di atas untuk proteksi user_`;

            await client.send(groupId).text(message).mentions([targetJid]
            );

        } catch (error) {
            console.error('GetJid error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal mengambil JID!');
        }
    }
}

module.exports = GetJidFeature;
