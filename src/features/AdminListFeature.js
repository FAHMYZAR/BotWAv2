const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class AdminListFeature extends BaseFeature {
    constructor() {
        super('adminlist', 'Lihat daftar admin grup', false, 'admin');
        this.aliases = ['listadmin'];
    }

    async execute(ctx, client, args) {
        try {
            const groupId = ctx.remoteJid;
            
            if (!groupId.endsWith('@g.us')) {
                await client.send(groupId).text('❌ Perintah ini hanya untuk grup!');
                return;
            }

            const metadata = await client.group.metadata(groupId);
            const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            
            if (admins.length === 0) {
                await client.send(groupId).text('❌ Tidak ada admin di grup ini!');
                return;
            }

            let message = `*DAFTAR ADMIN*\n\n`;
            message += `*Grup:* ${metadata.subject}\n`;
            message += `*Total Admin:* ${admins.length}\n\n`;

            admins.forEach((admin, index) => {
                const role = admin.admin === 'superadmin' ? 'Owner' : 'Admin';
                message += `*${index + 1}.* @${admin.id.split('@')[0]}\n`;
                message += `Role: ${role}\n\n`;
            });

            const mentions = admins.map(a => a.id);

            await client.send(groupId).text(message).mentions(mentions
            );

        } catch (error) {
            console.error('AdminList error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal menampilkan daftar admin!');
        }
    }
}

module.exports = AdminListFeature;
