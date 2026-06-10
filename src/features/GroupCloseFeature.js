const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class GroupCloseFeature extends BaseFeature {
    constructor() {
        super('close', 'Tutup grup (hanya admin bisa kirim)', false, 'admin');
        this.aliases = ['mute'];
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
                await sock.sendMessage(groupId, { text: '❌ Hanya admin yang bisa close grup!' });
                return;
            }

            if (!await AdminHelper.isBotAdmin(sock, groupId)) {
                await sock.sendMessage(groupId, { text: '❌ Bot harus jadi admin untuk close grup!' });
                return;
            }

            await sock.groupSettingUpdate(groupId, 'announcement');
            
            await sock.sendMessage(groupId, { 
                text: `🔒 *GRUP DITUTUP*\n\nHanya admin yang bisa mengirim pesan!` 
            });

        } catch (error) {
            console.error('GroupClose error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal menutup grup!' });
        }
    }
}

module.exports = GroupCloseFeature;
