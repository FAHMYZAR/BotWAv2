const BaseFeature = require('../core/BaseFeature');
const GroupSystem = require('../utils/GroupSystem');
const AdminHelper = require('../utils/AdminHelper');

class TestSholatFeature extends BaseFeature {
    constructor() {
        super('testsholat', 'Test schedule pengingat sholat di grup ini', false, 'group');
    }

    async execute(m, sock, args) {
        try {
            if (!m.key.remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(m.key.remoteJid, { text: '❌ Fitur ini hanya bisa dipakai di grup!' });
                return;
            }

            const groupId = m.key.remoteJid;
            const senderId = m.key.participant || m.key.remoteJid;
            const config = require('../config/config');
            const isOwner = m.key.fromMe || senderId.replace('@s.whatsapp.net', '') === config.ownerNumber;
            const isGroupAdmin = await AdminHelper.isGroupAdmin(sock, groupId, senderId);

            if (!isOwner && !isGroupAdmin) {
                await sock.sendMessage(groupId, { text: '❌ Hanya owner bot atau admin grup yang bisa test sholat!' });
                return;
            }

            const groups = await GroupSystem.getAll();
            const groupData = groups.find(g => g.group_id === groupId);

            if (!groupData) {
                await sock.sendMessage(groupId, { text: '❌ Grup ini belum didaftarkan untuk pengingat sholat. Gunakan .daftargc <kota>' });
                return;
            }

            // Baca delay dari argumen, default 5 detik
            let delaySeconds = 5;
            if (args.length > 0 && !isNaN(parseInt(args[0]))) {
                delaySeconds = parseInt(args[0]);
            }
            const delayMs = delaySeconds * 1000;

            const kota = groupData.kota;
            const targetName = args[1] || 'Maghrib';
            const targetTime = '17:45'; // Waktu dummy
            const targetSubuh = '04:15'; // Waktu dummy
            
            await sock.sendMessage(groupId, { 
                text: `✅ *Test Reminder Sholat Aktif*\n\nTimer diset selama ${delaySeconds} detik untuk waktu *${targetName}* di *${kota}*.` 
            });

            console.log(`[TEST-SCHEDULER] Test sholat ${targetName} for ${groupId} in ${delaySeconds}s`);
            
            setTimeout(async () => {
                if (global.sholatScheduler) {
                    await global.sholatScheduler.sendGroupReminder(
                        { 
                            groupId: groupData.group_id, 
                            kota: groupData.kota,
                            lat: groupData.latitude,
                            lng: groupData.longitude,
                            mapsUrl: groupData.maps_url
                        }, 
                        targetName, 
                        targetTime, 
                        kota, 
                        targetSubuh
                    );
                } else {
                    await sock.sendMessage(groupId, { text: '❌ Scheduler tidak aktif!' });
                }
            }, delayMs);

        } catch (error) {
            console.error('[TEST SHOLAT ERROR]:', error);
            await sock.sendMessage(m.key.remoteJid, { text: `❌ Gagal mengetes sholat: ${error.message}` });
        }
    }
}

module.exports = TestSholatFeature;