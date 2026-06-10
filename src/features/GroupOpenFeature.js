const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class GroupOpenFeature extends BaseFeature {
    constructor() {
        super('open', 'Buka grup (semua bisa kirim)', false, 'admin');
        this.aliases = ['unmute'];
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
                await sock.sendMessage(groupId, { text: '❌ Hanya admin yang bisa open grup!' });
                return;
            }

            if (!await AdminHelper.isBotAdmin(sock, groupId)) {
                await sock.sendMessage(groupId, { text: '❌ Bot harus jadi admin untuk open grup!' });
                return;
            }

            await sock.groupSettingUpdate(groupId, 'not_announcement');
            
            await sock.sendMessage(groupId, { 
                text: `🔓 *GRUP DIBUKA*\n\nSemua member bisa mengirim pesan!` 
            });

        } catch (error) {
            console.error('GroupOpen error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal membuka grup!' });
        }
    }
}

module.exports = GroupOpenFeature;
