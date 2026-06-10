const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');
const WarnSystem = require('../utils/WarnSystem');

class WarnListFeature extends BaseFeature {
    constructor() {
        super('warnlist', 'Lihat daftar warning di grup', false, 'admin');
    }

    async execute(m, sock, args) {
        try {
            const groupId = m.key.remoteJid;
            
            if (!groupId.endsWith('@g.us')) {
                await sock.sendMessage(groupId, { text: '❌ Perintah ini hanya untuk grup!' });
                return;
            }

            const senderId = m.key.participant || m.key.remoteJid;
            
            if (!await AdminHelper.canExecuteAdminCommand(sock, groupId, senderId)) {
                await sock.sendMessage(groupId, { text: '❌ Hanya admin yang bisa lihat warning list!' });
                return;
            }

            const allWarns = await WarnSystem.getAllWarnsInGroup(groupId);
            
            if (allWarns.length === 0) {
                await sock.sendMessage(groupId, { text: '✅ Tidak ada member yang punya warning!' });
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

            await sock.sendMessage(groupId, { 
                text: message,
                mentions: mentions
            });

        } catch (error) {
            console.error('WarnList error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal menampilkan warning list!' });
        }
    }
}

module.exports = WarnListFeature;
