const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');
const WarnSystem = require('../utils/WarnSystem');

class UnwarnFeature extends BaseFeature {
    constructor() {
        super('unwarn', 'Hapus 1 warning member', false, 'admin');
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
                await sock.sendMessage(groupId, { text: '❌ Hanya admin yang bisa unwarn member!' });
                return;
            }

            const targetJid = AdminHelper.extractJid(m);
            
            if (!targetJid) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Tag atau reply pesan member yang ingin di-unwarn!\n\nContoh:\n> `.unwarn @user`\n> Reply pesan + `.unwarn`' 
                });
                return;
            }

            const removed = await WarnSystem.removeWarn(groupId, targetJid);
            
            if (!removed) {
                await sock.sendMessage(groupId, { text: '❌ Member ini tidak punya warning!' });
                return;
            }

            const totalWarns = await WarnSystem.getWarnCount(groupId, targetJid);
            
            await sock.sendMessage(groupId, { 
                text: `✅ 1 warning dihapus!\n\nMember: @${targetJid.split('@')[0]}\nSisa Warn: ${totalWarns}/${WarnSystem.maxWarns}`,
                mentions: [targetJid]
            });

        } catch (error) {
            console.error('Unwarn error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal menghapus warning!' });
        }
    }
}

module.exports = UnwarnFeature;
