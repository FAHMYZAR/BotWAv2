const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class AddFeature extends BaseFeature {
    constructor() {
        super('add', 'Tambah member ke grup', false, 'admin');
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
                await sock.sendMessage(groupId, { text: '❌ Hanya admin yang bisa add member!' });
                return;
            }

            if (!await AdminHelper.isBotAdmin(sock, groupId)) {
                await sock.sendMessage(groupId, { text: '❌ Bot harus jadi admin untuk add member!' });
                return;
            }

            const phoneNumber = args[0];
            
            if (!phoneNumber) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Berikan nomor yang ingin ditambahkan!\n\nContoh:\n> `.add 628123456789`\n> `.add 08123456789`' 
                });
                return;
            }

            const targetJid = AdminHelper.formatPhoneNumber(phoneNumber);

            const [result] = await sock.onWhatsApp(targetJid);
            if (!result || !result.exists) {
                await sock.sendMessage(groupId, { text: '❌ Nomor tidak terdaftar di WhatsApp!' });
                return;
            }

            await sock.groupParticipantsUpdate(groupId, [targetJid], 'add');
            
            await sock.sendMessage(groupId, { 
                text: `✅ Member berhasil ditambahkan!`,
                mentions: [targetJid]
            });

        } catch (error) {
            console.error('Add error:', error);
            
            let errorMsg = '❌ Gagal menambahkan member!';
            if (error.message.includes('403')) {
                errorMsg = '❌ Member ini memblokir bot atau privacy setting tidak mengizinkan!';
            } else if (error.message.includes('409')) {
                errorMsg = '❌ Member sudah ada di grup!';
            }
            
            await sock.sendMessage(m.key.remoteJid, { text: errorMsg });
        }
    }
}

module.exports = AddFeature;
