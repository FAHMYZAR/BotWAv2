const BaseFeature = require('../core/BaseFeature');
const GroupSystem = require('../utils/GroupSystem');
const AdminHelper = require('../utils/AdminHelper');
const config = require('../config/config');

class HapusGcFeature extends BaseFeature {
    constructor() {
        super('hapusgc', 'Hapus grup dari daftar (admin grup bisa hapus)', false, 'group');
    }

    async execute(m, sock, args) {
        try {
            const groupId = m.key.remoteJid;
            const senderId = m.key.participant || m.key.remoteJid;
            const isOwner = m.key.fromMe || senderId.replace('@s.whatsapp.net', '') === config.ownerNumber;

            if (!groupId.endsWith('@g.us')) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Perintah ini hanya bisa digunakan di grup!' 
                });
                return;
            }

            const isGroupAdmin = await AdminHelper.isGroupAdmin(sock, groupId, senderId);
            
            if (!isOwner && !isGroupAdmin) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Hanya owner bot atau admin grup yang bisa hapus grup!' 
                });
                return;
            }

            const group = await GroupSystem.get(groupId);
            if (!group) {
                await sock.sendMessage(groupId, { 
                    text: '❌ Grup ini belum terdaftar!' 
                });
                return;
            }

            await GroupSystem.unregister(groupId);
            
            // Rebuild scheduler timers
            if (global.sholatScheduler) {
                global.sholatScheduler.rebuild();
            }

            await sock.sendMessage(groupId, { 
                text: '✅ Grup berhasil dihapus dari daftar!\n\n_Fitur auto reminder dan akses owner untuk admin grup dinonaktifkan._' 
            });

        } catch (error) {
            console.error('HapusGc error:', error.message);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan!' 
            });
        }
    }
}

module.exports = HapusGcFeature;
