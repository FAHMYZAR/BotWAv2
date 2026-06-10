const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class PurgeFeature extends BaseFeature {
    constructor() {
        super('purge', 'Hapus pesan dari reply sampai terakhir', false, 'admin');
        if (!global.messageStore) {
            global.messageStore = {};
        }
    }

    async execute(m, sock, args) {
        try {
            const chatId = m.key.remoteJid;
            const senderId = m.key.participant || m.key.remoteJid;
            
            if (!chatId.endsWith('@g.us')) {
                await sock.sendMessage(chatId, { text: '❌ Perintah ini hanya untuk grup!' });
                return;
            }
            
            if (!await AdminHelper.canExecuteAdminCommand(sock, chatId, senderId)) {
                await sock.sendMessage(chatId, { text: '❌ Hanya admin yang bisa purge!' });
                return;
            }
            
            if (!await AdminHelper.isBotAdmin(sock, chatId)) {
                await sock.sendMessage(chatId, { text: '❌ Bot harus jadi admin untuk purge!' });
                return;
            }
            
            const quoted = m.message.extendedTextMessage?.contextInfo;
            if (!quoted || !quoted.stanzaId) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Reply pesan yang ingin dijadikan awal purge!\n\nContoh:\n> Reply pesan + `/purge`' 
                });
                return;
            }
            
            const quotedTimestamp = quoted.messageTimestamp || 0;
            const messageStore = global.messageStore[chatId] || [];
            
            const messagesToDelete = messageStore.filter(msg => {
                const msgTimestamp = msg.messageTimestamp || 0;
                return msgTimestamp >= quotedTimestamp && msg.key.id !== m.key.id;
            });
            
            if (messagesToDelete.length === 0) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Tidak ada pesan yang bisa dihapus!\n\n_Note: Bot hanya bisa hapus pesan yang dikirim setelah bot online._' 
                });
                return;
            }
            
            const notif = await sock.sendMessage(chatId, { 
                text: `🔥 Menghapus ${messagesToDelete.length} pesan...` 
            });
            
            let deleted = 0;
            for (const msg of messagesToDelete) {
                try {
                    await sock.sendMessage(chatId, { delete: msg.key });
                    deleted++;
                } catch (e) {
                    console.log('[PURGE] Failed to delete:', msg.key.id);
                }
            }
            
            await sock.sendMessage(chatId, { delete: notif.key });
            await sock.sendMessage(chatId, { delete: m.key });
            
            global.messageStore[chatId] = messageStore.filter(msg => {
                const msgTimestamp = msg.messageTimestamp || 0;
                return msgTimestamp < quotedTimestamp;
            });
            
            console.log(`[PURGE] Deleted ${deleted}/${messagesToDelete.length} messages in ${chatId}`);

        } catch (error) {
            console.error('Purge error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Gagal purge! Error: ' + error.message
            });
        }
    }
}

module.exports = PurgeFeature;
