const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class GetJidFeature extends BaseFeature {
    constructor() {
        super('getjid', 'Ambil JID user (untuk @lid format)', false, 'owner');
    }

    async execute(m, sock, args) {
        try {
            const groupId = m.key.remoteJid;
            const targetJid = AdminHelper.extractJid(m);
            
            if (!targetJid) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Tag atau reply pesan user untuk ambil JID!\n\nContoh:\n> `/getjid @user`\n> Reply pesan + `/getjid`' 
                });
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

            await sock.sendMessage(groupId, { 
                text: message,
                mentions: [targetJid]
            });

        } catch (error) {
            console.error('GetJid error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal mengambil JID!' });
        }
    }
}

module.exports = GetJidFeature;
