const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class PurgeFeature extends BaseFeature {
    constructor() {
        super('purge', 'Hapus pesan dari reply sampai terakhir', false, 'admin');
        if (!global.messageStore) {
            global.messageStore = {};
        }
    }

    async execute(ctx, client, args) {
        try {
            const chatId = ctx.remoteJid;
            const senderId = ctx.senderJid || ctx.remoteJid;
            
            if (!chatId.endsWith('@g.us')) {
                await client.send(chatId).text('❌ Perintah ini hanya untuk grup!');
                return;
            }
            
            if (!await AdminHelper.canExecuteAdminCommand(client, chatId, senderId)) {
                await client.send(chatId).text('❌ Hanya admin yang bisa purge!');
                return;
            }
            
            if (!await AdminHelper.isBotAdmin(client, chatId)) {
                await client.send(chatId).text('❌ Bot harus jadi admin untuk purge!');
                return;
            }
            
            const quoted = ctx.message.extendedTextMessage?.contextInfo;
            if (!quoted || !quoted.stanzaId) {
                await client.send(chatId).text('❌ Reply pesan yang ingin dijadikan awal purge!\n\nContoh:\n> Reply pesan + `/purge`');
                return;
            }
            
            const quotedTimestamp = quoted.messageTimestamp || 0;
            const messageStore = global.messageStore[chatId] || [];
            
            const messagesToDelete = messageStore.filter(msg => {
                const msgTimestamp = msg.messageTimestamp || 0;
                return msgTimestamp >= quotedTimestamp && msg.key.id !== ctx.uniqueId;
            });
            
            if (messagesToDelete.length === 0) {
                await client.send(chatId).text('❌ Tidak ada pesan yang bisa dihapus!\n\n_Note: Bot hanya bisa hapus pesan yang dikirim setelah bot online._');
                return;
            }
            
            const notif = await client.send(chatId).text(`🔥 Menghapus ${messagesToDelete.length} pesan...`);
            
            let deleted = 0;
            for (const msg of messagesToDelete) {
                try {
                    await client.delete(msg.key);
                    deleted++;
                } catch (e) {
                    console.log('[PURGE] Failed to delete:', msg.key.id);
                }
            }
            
            await client.delete(notif.key);
            await client.delete(ctx.key);
            
            global.messageStore[chatId] = messageStore.filter(msg => {
                const msgTimestamp = msg.messageTimestamp || 0;
                return msgTimestamp < quotedTimestamp;
            });
            
            console.log(`[PURGE] Deleted ${deleted}/${messagesToDelete.length} messages in ${chatId}`);

        } catch (error) {
            console.error('Purge error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal purge! Error: ' + error.message);
        }
    }
}

module.exports = PurgeFeature;
