const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class PromoteFeature extends BaseFeature {
    constructor() {
        super('promote', 'Jadikan member sebagai admin', false, 'admin');
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
                await sock.sendMessage(groupId, { text: '❌ Hanya admin yang bisa promote member!' });
                return;
            }

            if (!await AdminHelper.isBotAdmin(sock, groupId)) {
                await sock.sendMessage(groupId, { text: '❌ Bot harus jadi admin untuk promote member!' });
                return;
            }

            const targetJid = AdminHelper.extractJid(m);
            
            if (!targetJid) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Tag atau reply pesan member yang ingin di-promote!\n\nContoh:\n> `.promote @user`\n> Reply pesan + `.promote`' 
                });
                return;
            }

            if (await AdminHelper.isGroupAdmin(sock, groupId, targetJid)) {
                await sock.sendMessage(groupId, { text: '❌ Member ini sudah admin!' });
                return;
            }

            await sock.groupParticipantsUpdate(groupId, [targetJid], 'promote');
            
            await sock.sendMessage(groupId, { 
                text: `✅ Member berhasil di-promote menjadi admin!`,
                mentions: [targetJid]
            });

        } catch (error) {
            console.error('Promote error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal promote member!' });
        }
    }
}

module.exports = PromoteFeature;
