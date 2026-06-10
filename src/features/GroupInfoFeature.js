const BaseFeature = require('../core/BaseFeature');

class GroupInfoFeature extends BaseFeature {
    constructor() {
        super('groupinfo', 'Lihat info lengkap grup', false, 'admin');
        this.aliases = ['infogrup', 'infogroup'];
    }

    async execute(m, sock, args) {
        try {
            const groupId = m.key.remoteJid;
            
            if (!groupId.endsWith('@g.us')) {
                await sock.sendMessage(groupId, { text: '❌ Perintah ini hanya untuk grup!' });
                return;
            }

            const metadata = await sock.groupMetadata(groupId);
            const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            const members = metadata.participants.filter(p => !p.admin);
            
            const creationDate = new Date(metadata.creation * 1000);
            const formattedDate = creationDate.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            let message = `📊 *INFO GRUP*\n\n`;
            message += `*Nama:* ${metadata.subject}\n`;
            message += `*ID:* ${groupId.split('@')[0]}\n`;
            message += `*Dibuat:* ${formattedDate}\n`;
            if (metadata.owner) {
                message += `*Owner:* @${metadata.owner.split('@')[0]}\n\n`;
            } else {
                message += `\n`;
            }
            
            message += `*Deskripsi:*\n${metadata.desc || 'Tidak ada deskripsi'}\n\n`;
            
            message += `*Statistik:*\n`;
            message += `> Total Member: ${metadata.participants.length}\n`;
            message += `> Admin: ${admins.length}\n`;
            message += `> Member: ${members.length}\n\n`;
            
            message += `*Pengaturan:*\n`;
            message += `> Kirim Pesan: ${metadata.announce ? 'Hanya Admin' : 'Semua Member'}\n`;
            message += `> Edit Info: ${metadata.restrict ? 'Hanya Admin' : 'Semua Member'}\n`;

            const mentions = metadata.owner ? [metadata.owner] : [];
            await sock.sendMessage(groupId, { 
                text: message,
                mentions
            });

        } catch (error) {
            console.error('GroupInfo error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal menampilkan info grup!' });
        }
    }
}

module.exports = GroupInfoFeature;
