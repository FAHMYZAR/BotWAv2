const BaseFeature = require('../core/BaseFeature');
const GroupRegistry = require('../utils/GroupRegistry');

class HapusGcFeature extends BaseFeature {
    constructor() {
        super('hapusgc', 'Hapus grup dari auto reminder sholat', true);
    }

    async execute(m, sock, args) {
        try {
            if (!m.key.remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Perintah ini hanya bisa digunakan di grup!' 
                });
                return;
            }

            const group = GroupRegistry.get(m.key.remoteJid);
            if (!group) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Grup ini belum terdaftar!' 
                });
                return;
            }

            GroupRegistry.unregister(m.key.remoteJid);

            await sock.sendMessage(m.key.remoteJid, { 
                text: '✅ Grup berhasil dihapus dari auto reminder sholat!' 
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
