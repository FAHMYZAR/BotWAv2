const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class AttpFeature extends BaseFeature {
    constructor() {
        super('attp', 'Buat sticker animasi dari text', false, 'media');
    }

    async execute(ctx, client, args) {
        try {
            let text = args.join(' ');

            // Check if replying to a message
            if (!text && (await ctx.replied().catch(()=>null))?.message) {
                const quotedText = (await ctx.replied().catch(()=>null))?.message.conversation ||
                                  (await ctx.replied().catch(()=>null))?.message.extendedTextMessage?.text ||
                                  '';
                text = quotedText;
            }

            if (!text) {
                await client.send(ctx.remoteJid).text('❌ Masukkan text atau reply pesan!\n\nContoh:\n> .attp Halo\n> Reply pesan + .attp');
                return;
            }

            await ctx.react('⏳');

            const response = await axios.get(`${config.apis.lolhuman}/attp`, {
                params: { 
                    apikey: config.lolhumanApiKey,
                    text: text
                },
                responseType: 'arraybuffer',
                timeout: 15000
            });

            await ctx.react('');
            await client.send(ctx.remoteJid).sticker(Buffer.from(response.data)
            );

        } catch (error) {
            console.error('ATTP error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal membuat sticker!');
        }
    }
}

module.exports = AttpFeature;
