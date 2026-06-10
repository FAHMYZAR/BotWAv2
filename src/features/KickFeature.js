const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class KickFeature extends BaseFeature {
    constructor() {
        super('kick', 'Kick member dari grup (tag/reply)', false, 'admin');
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
                await sock.sendMessage(groupId, { text: '❌ Hanya admin yang bisa kick member!' });
                return;
            }

            if (!await AdminHelper.isBotAdmin(sock, groupId)) {
                await sock.sendMessage(groupId, { text: '❌ Bot harus jadi admin untuk kick member!' });
                return;
            }

            const targetJid = AdminHelper.extractJid(m);
            
            if (!targetJid) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Tag atau reply pesan member yang ingin di-kick!\n\nContoh:\n> `/kick @user`\n> Reply pesan + `/kick`' 
                });
                return;
            }

            // Check if target is bot
            if (await AdminHelper.isBotJid(sock, targetJid, groupId)) {
                console.log('[KICK] 🚫 BLOCKED - Target is bot!');
                await sock.sendMessage(groupId, { text: '🛡️' });
                return;
            }

            // Check if target is protected
            if (AdminHelper.isProtected(targetJid)) {
                console.log('[KICK] 🚫 BLOCKED - Target is protected!');
                await sock.sendMessage(groupId, { text: '🛡️' });
                return;
            }

            if (await AdminHelper.isGroupAdmin(sock, groupId, targetJid)) {
                await sock.sendMessage(groupId, { text: '❌ Tidak bisa kick admin!' });
                return;
            }

            await sock.groupParticipantsUpdate(groupId, [targetJid], 'remove');
            
            await sock.sendMessage(groupId, { 
                text: `✅ Member berhasil di-kick!`,
                mentions: [targetJid]
            });

        } catch (error) {
            console.error('Kick error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal kick member!' });
        }
    }
}

module.exports = KickFeature;
