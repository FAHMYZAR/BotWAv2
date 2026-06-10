const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class DemoteFeature extends BaseFeature {
    constructor() {
        super('demote', 'Cabut admin member', false, 'admin');
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
                await sock.sendMessage(groupId, { text: '❌ Hanya admin yang bisa demote member!' });
                return;
            }

            if (!await AdminHelper.isBotAdmin(sock, groupId)) {
                await sock.sendMessage(groupId, { text: '❌ Bot harus jadi admin untuk demote member!' });
                return;
            }

            const targetJid = AdminHelper.extractJid(m);
            
            console.log('[DEMOTE] ======================');
            console.log('[DEMOTE] Command executed');
            console.log('[DEMOTE] Group:', groupId);
            console.log('[DEMOTE] Sender:', senderId);
            console.log('[DEMOTE] Target JID:', targetJid);
            
            if (!targetJid) {
                console.log('[DEMOTE] ❌ No target JID found');
                await sock.sendMessage(groupId, { 
                    text: '❌ Tag atau reply pesan admin yang ingin di-demote!\n\nContoh:\n> `/demote @user`\n> Reply pesan + `/demote`' 
                });
                return;
            }
            
            // Check if target is bot
            console.log('[DEMOTE] Checking if target is bot...');
            if (await AdminHelper.isBotJid(sock, targetJid, groupId)) {
                console.log('[DEMOTE] 🚫 BLOCKED - Target is bot!');
                await sock.sendMessage(groupId, { text: '🛡️' });
                return;
            }
            
            // Check if target is protected
            console.log('[DEMOTE] Checking if target is protected...');
            if (AdminHelper.isProtected(targetJid)) {
                console.log('[DEMOTE] 🚫 BLOCKED - Target is protected!');
                await sock.sendMessage(groupId, { text: '🛡️' });
                return;
            }
            
            console.log('[DEMOTE] ✅ All checks passed, proceeding with demote...')

            if (!await AdminHelper.isGroupAdmin(sock, groupId, targetJid)) {
                await sock.sendMessage(groupId, { text: '❌ Member ini bukan admin!' });
                return;
            }

            await sock.groupParticipantsUpdate(groupId, [targetJid], 'demote');
            
            await sock.sendMessage(groupId, { 
                text: `✅ Admin berhasil di-demote!`,
                mentions: [targetJid]
            });

        } catch (error) {
            console.error('Demote error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal demote admin!' });
        }
    }
}

module.exports = DemoteFeature;
