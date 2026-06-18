const BaseFeature = require('../core/BaseFeature');
const PersonalSholatSystem = require('../utils/PersonalSholatSystem');

class BatalSholatFeature extends BaseFeature {
    constructor() {
        super('batalsholat', 'Batal reminder sholat personal', false);
    }

    async execute(ctx, client, args) {
        try {
            if (ctx.roomId.endsWith('@g.us')) {
                await ctx.reply('❌ Fitur ini hanya untuk chat pribadi!');
                return;
            }

            await PersonalSholatSystem.unregister(ctx.senderId);
            
            if (global.sholatScheduler) {
                global.sholatScheduler.rebuild();
            }

            await ctx.reply('✅ Reminder sholat berhasil dibatalkan.\n\nKetik *.daftarsholat <kota>* untuk daftar lagi.');

        } catch (error) {
            console.error('[BATAL SHOLAT ERROR]:', error);
            await ctx.reply('❌ Terjadi kesalahan!');
        }
    }
}

module.exports = BatalSholatFeature;
