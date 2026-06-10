const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');
const ProtectionSystem = require('../utils/ProtectionSystem');

class ProtectFeature extends BaseFeature {
    constructor() {
        super('protect', 'Tambah user ke protected list', true, 'owner');
    }

    async execute(m, sock, args) {
        try {
            const groupId = m.key.remoteJid;
            const targetJid = AdminHelper.extractJid(m);
            
            if (!targetJid) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Tag atau reply pesan user yang ingin diproteksi!\n\nContoh:\n> `/protect @user`\n> Reply pesan + `/protect`' 
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

            // Add both number and JID
            const addedNumber = ProtectionSystem.addNumber(number);
            const addedJid = ProtectionSystem.addJid(targetJid);

            if (addedNumber || addedJid) {
                await sock.sendMessage(groupId, { 
                    text: `✅ User berhasil diproteksi!\n\nNumber: ${number}\nJID: ${targetJid}\n\n🛡️ User ini tidak bisa di-kick, demote, atau warn.`,
                    mentions: [targetJid]
                });
            } else {
                await sock.sendMessage(groupId, { 
                    text: '⚠️ User sudah ada di protected list!',
                    mentions: [targetJid]
                });
            }

        } catch (error) {
            console.error('Protect error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal memproteksi user!' });
        }
    }
}

module.exports = ProtectFeature;
