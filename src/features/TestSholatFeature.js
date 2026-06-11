const BaseFeature = require('../core/BaseFeature');
const GroupSystem = require('../utils/GroupSystem');

class TestSholatFeature extends BaseFeature {
    constructor() {
        super('testsholat', 'Test schedule pengingat sholat di grup ini', true, 'owner');
    }

    async execute(m, sock, args) {
        try {
            if (!m.key.remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(m.key.remoteJid, { text: '❌ Fitur ini hanya bisa dipakai di grup!' });
                return;
            }

            const groupId = m.key.remoteJid;
            const groups = await GroupSystem.getAll();
            const groupData = groups.find(g => g.groupId === groupId);

            if (!groupData) {
                await sock.sendMessage(groupId, { text: '❌ Grup ini belum didaftarkan untuk pengingat sholat. Gunakan .daftargc <kota>' });
                return;
            }

            // Baca delay dari argumen, default 5 detik
            let delaySeconds = 5;
            if (args.length > 0 && !isNaN(args[0])) {
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
                    // Pakai sendGroupReminder dari scheduler yang sudah jalan
                    await global.sholatScheduler.sendGroupReminder(
                        groupData, 
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