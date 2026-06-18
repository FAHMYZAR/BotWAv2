const BaseFeature = require('../core/BaseFeature');
const PhoneLookup = require('../utils/PhoneLookup');
const axios = require('axios');

class GetContactFeature extends BaseFeature {
    constructor() {
        super('getcontact', 'Cek info nomor telepon', false, 'tools');
    }

    async execute(ctx, client, args) {
        try {
            let phoneNumber = args[0];

            if ((await ctx.replied().catch(()=>null))?.senderJid) {
                phoneNumber = (await ctx.replied().catch(()=>null))?.senderJid.split('@')[0];
            } else if (ctx.mentions?.[0]) {
                phoneNumber = ctx.mentions[0].split('@')[0];
            }

            if (!phoneNumber) {
                await client.send(ctx.remoteJid).text('❌ Berikan nomor telepon!\n\nContoh:\n> `.getcontact 628123456789`\n> Reply pesan seseorang\n> Tag seseorang');
                return;
            }

            await client.send(ctx.remoteJid).text('🔍 Mencari info nomor...');

            const results = await PhoneLookup.lookup(client, phoneNumber);

            if (!results.sources || results.sources.length === 0) {
                await client.send(ctx.remoteJid).text('❌ Tidak dapat menemukan info untuk nomor ini!');
                return;
            }

            const numVerify = results.sources.find(s => s.source === 'NumVerify');
            const whatsapp = results.sources.find(s => s.source === 'WhatsApp');

            let message = `📞 *INFO NOMOR*\n\n`;
            message += `*📱 NOMOR*\n> \`+${results.number}\`\n\n`;

            if (numVerify) {
                message += `*🌍 NUMVERIFY*\n`;
                if (numVerify.valid !== undefined) message += `> Valid: \`${numVerify.valid ? 'Ya' : 'Tidak'}\`\n`;
                if (numVerify.country) message += `> Negara: \`${numVerify.country}\`\n`;
                if (numVerify.location) message += `> Lokasi: \`${numVerify.location}\`\n`;
                if (numVerify.carrier) message += `> Operator: \`${numVerify.carrier}\`\n`;
                if (numVerify.lineType) message += `> Tipe: \`${numVerify.lineType}\`\n`;
                message += `\n`;
            }

            if (whatsapp) {
                message += `*💬 WHATSAPP*\n`;
                message += `> Terdaftar: \`${whatsapp.exists ? 'Ya' : 'Tidak'}\`\n`;
                if (whatsapp.exists) {
                    if (whatsapp.name) message += `> Nama: \`${whatsapp.name}\`\n`;
                    if (whatsapp.about) message += `> About: \`${whatsapp.about}\`\n`;
                }
                message += `\n`;
            }

            message += `_🔥 EL-RUWET [BOT + AI] © ${new Date().getFullYear()}_`;

            // Kirim dengan profile pic sebagai banner jika ada
            if (whatsapp?.profilePicUrl) {
                try {
                    const picResponse = await axios.get(whatsapp.profilePicUrl, { responseType: 'arraybuffer' });
                    await client.send(ctx.remoteJid).image(Buffer.from(picResponse.data), { caption: message
                     });
                } catch {
                    await client.send(ctx.remoteJid).text(message);
                }
            } else {
                await client.send(ctx.remoteJid).text(message);
            }

        } catch (error) {
            console.error('GetContact error:', error);
            await client.send(ctx.remoteJid).text('❌ Terjadi kesalahan saat mencari info nomor!');
        }
    }
}

module.exports = GetContactFeature;
