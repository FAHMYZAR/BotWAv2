const BaseFeature = require('../core/BaseFeature');
const GroupSystem = require('../utils/GroupSystem');
const AdminHelper = require('../utils/AdminHelper');
const config = require('../config/config');

class HapusGcFeature extends BaseFeature {
    constructor() {
        super('hapusgc', 'Hapus grup dari daftar (admin grup bisa hapus)', false, 'group');
    }

    async execute(ctx, client, args) {
        try {
            const groupId = ctx.remoteJid;
            const senderId = ctx.senderJid || ctx.remoteJid;
            const isOwner = ctx.isFromMe || senderId.replace('@s.whatsapp.net', '') === config.ownerNumber;

            if (!groupId.endsWith('@g.us')) {
                await client.send(groupId).text('❌ Perintah ini hanya bisa digunakan di grup!');
                return;
            }

            const isGroupAdmin = await AdminHelper.isGroupAdmin(client, groupId, senderId);
            
            if (!isOwner && !isGroupAdmin) {
                await client.send(groupId).text('❌ Hanya owner bot atau admin grup yang bisa hapus grup!');
                return;
            }

            const group = await GroupSystem.get(groupId);
            if (!group) {
                await client.send(groupId).text('❌ Grup ini belum terdaftar!');
                return;
            }

            await GroupSystem.unregister(groupId);
            
            // Rebuild scheduler timers
            if (global.sholatScheduler) {
                global.sholatScheduler.rebuild();
            }

            await client.send(groupId).text('✅ Grup berhasil dihapus dari daftar!\n\n_Fitur auto reminder dan akses owner untuk admin grup dinonaktifkan._');

        } catch (error) {
            console.error('HapusGc error:', error.message);
            await client.send(ctx.remoteJid).text('❌ Terjadi kesalahan!');
        }
    }
}

module.exports = HapusGcFeature;
