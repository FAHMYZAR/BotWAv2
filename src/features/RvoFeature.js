const BaseFeature = require('../core/BaseFeature');

class RvoFeature extends BaseFeature {
    constructor() {
        super('rvo', 'Ekstrak media view once', false, 'owner');
    }

    async execute(ctx, client, args) {
        try {
            const quoted = await ctx.replied().catch(() => null);
            const media = quoted?.media;
            const buffer = await media?.buffer();
            
            if (!quoted || !buffer) {
                await ctx.reply('❌ Balas ke media (View Once atau biasa) yang mau diambil!');
                return;
            }

            await ctx.reply('⏳ Mengekstrak media...');

            const caption = media.caption || quoted.text || '';
            const messageCaption = caption ? `*Pesan:* ${caption}` : '✅ Media berhasil diambil!';

            if (media.type === 'image') {
                await client.send(ctx.roomId).image(buffer, { caption: messageCaption });
            } else if (media.type === 'video') {
                await client.send(ctx.roomId).video(buffer, { caption: messageCaption });
            } else if (media.type === 'audio') {
                await client.send(ctx.roomId).audio(buffer);
            } else {
                await ctx.reply('❌ Media tidak didukung untuk diekstrak!');
            }

        } catch (error) {
            console.error('RVO error:', error);
            await ctx.reply(`❌ Gagal memproses media: ${error.message}`);
        }
    }
}

module.exports = RvoFeature;
