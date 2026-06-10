const BaseFeature = require('../core/BaseFeature');
const PersonalSholatSystem = require('../utils/PersonalSholatSystem');

class BatalSholatFeature extends BaseFeature {
    constructor() {
        super('batalsholat', 'Batal reminder sholat personal', false);
    }

    async execute(m, sock, args) {
        try {
            if (m.key.remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Fitur ini hanya untuk chat pribadi!'
                });
                return;
            }

            await PersonalSholatSystem.unregister(m.key.remoteJid);

            await sock.sendMessage(m.key.remoteJid, {
                text: '✅ Reminder sholat berhasil dibatalkan.\n\nKetik *.daftarsholat <kota>* untuk daftar lagi.'
            });

        } catch (error) {
            console.error('[BATAL SHOLAT ERROR]:', error);
            await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Terjadi kesalahan!'
            });
        }
    }
}

module.exports = BatalSholatFeature;
