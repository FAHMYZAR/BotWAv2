const BaseFeature = require('../core/BaseFeature');
const MessageTracker = require('../utils/MessageTracker');

class UndeleteFeature extends BaseFeature {
    constructor() {
        super('undelete', 'Lihat pesan yang telah dihapus', false, 'tools');
        this.aliases = ['undel'];
    }

    formatDeletedMessage(msg, index) {
        const time = new Date(msg.deletedAt).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let content = '';
        if (msg.text) {
            content = msg.text;
        } else if (msg.caption) {
            content = `[${msg.mediaType}] ${msg.caption}`;
        } else if (msg.mediaType) {
            content = `[${msg.mediaType}]`;
        } else {
            content = '[Pesan tidak diketahui]';
        }

        return `*${index + 1}.* ${msg.senderName || 'Unknown'} (${time})\n${content}`;
    }

    async execute(ctx, client, args) {
        try {
            const count = parseInt(args[0]) || 5;
            
            if (count < 1 || count > 20) {
                await client.sendMessage(ctx.remoteJid, { 
                    text: '❌ Jumlah pesan harus antara 1-20!\n\nContoh:\n> `.undelete 3` atau `.undel 3` - Lihat 3 pesan terakhir yang dihapus\n> `.undelete 10` atau `.undel 10` - Lihat 10 pesan terakhir yang dihapus' 
                });
                return;
            }

            const deletedMessages = await MessageTracker.getDeletedMessages(ctx.remoteJid, count);
            
            if (!deletedMessages || deletedMessages.length === 0) {
                await client.sendMessage(ctx.remoteJid, { 
                    text: '📭 Tidak ada pesan yang dihapus di chat ini.' 
                });
                return;
            }

            let message = `🗑️ *PESAN YANG DIHAPUS* (${deletedMessages.length} terakhir)\n\n`;
            
            deletedMessages.forEach((msg, index) => {
                message += this.formatDeletedMessage(msg, index);
                if (index < deletedMessages.length - 1) {
                    message += '\n\n';
                }
            });

            message += '\n\n_💡 Pesan disimpan maksimal 50 per chat_';

            await client.sendMessage(ctx.remoteJid, { text: message });

        } catch (error) {
            console.error('Undelete error:', error.message);
            await client.sendMessage(ctx.remoteJid, { 
                text: '❌ Terjadi kesalahan saat mengambil pesan yang dihapus!' 
            });
        }
    }
}

module.exports = UndeleteFeature;
