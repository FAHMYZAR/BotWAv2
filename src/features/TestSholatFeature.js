const BaseFeature = require('../core/BaseFeature');

class TestSholatFeature extends BaseFeature {
    constructor() {
        super('testsholat', 'Test tampilan scheduler sholat', false, 'tools');
    }

    async execute(ctx, client, args) {
        try {
            if (!global.sholatScheduler) {
                await ctx.reply('❌ Scheduler belum berjalan!');
                return;
            }

            const delay = 3;
            const targetJid = ctx.roomId || ctx.senderId;
            await ctx.reply(`⏳ Akan dikirim dalam ${delay} detik...`);

            const time = new Date().toLocaleTimeString('id-ID', { 
                timeZone: 'Asia/Jakarta', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false
            });

            setTimeout(async () => {
                try {
                    if (ctx.roomId) {
                        await global.sholatScheduler.sendGroupReminder(
                            {
                                groupId: targetJid,
                                kota: 'Yogyakarta',
                                lat: '-7.7956',
                                lng: '110.3695',
                                mapsUrl: 'https://goo.gl/maps/test'
                            },
                            'Maghrib',
                            time,
                            'Yogyakarta',
                            '04:30'
                        );
                    } else {
                        await global.sholatScheduler.sendPersonalReminder(
                            targetJid,
                            'Maghrib',
                            time,
                            'Yogyakarta'
                        );
                    }

                    await client.send(targetJid).text('✅ Test scheduler selesai!');
                } catch (err) {
                    console.error('TestSholat delayed error:', err);
                    await client.send(targetJid).text('❌ Error saat kirim: ' + err.message);
                }
            }, delay * 1000);

        } catch (error) {
            console.error('TestSholat error:', error);
            await ctx.reply('❌ Terjadi kesalahan saat test scheduler!');
        }
    }
}

module.exports = TestSholatFeature;
