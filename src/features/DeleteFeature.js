const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class DeleteFeature extends BaseFeature {
    constructor() {
        super('delete', 'Hapus pesan (reply pesan yang ingin dihapus)', false, 'admin');
        this.aliases = ['del'];
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
                await sock.sendMessage(groupId, { text: '❌ Hanya admin yang bisa delete pesan!' });
                return;
            }

            if (!await AdminHelper.isBotAdmin(sock, groupId)) {
                await sock.sendMessage(groupId, { text: '❌ Bot harus jadi admin untuk delete pesan!' });
                return;
            }

            const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedKey = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
            const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
            
            if (!quotedMessage || !quotedKey) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Reply pesan yang ingin dihapus!\n\nContoh:\n> Reply pesan + `.delete`\n> Reply pesan + `.del`' 
                });
                return;
            }

            await sock.sendMessage(groupId, {
                delete: {
                    remoteJid: groupId,
                    fromMe: false,
                    id: quotedKey,
                    participant: quotedParticipant
                }
            });

            await sock.sendMessage(groupId, { text: '✅ Pesan berhasil dihapus!' });

        } catch (error) {
            console.error('Delete error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal menghapus pesan!' });
        }
    }
}

module.exports = DeleteFeature;
