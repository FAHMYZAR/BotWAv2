const BaseFeature = require('../core/BaseFeature');
const { getChatJidFromMessage } = require('../utils/JidHelper');

class SwgcFeature extends BaseFeature {
    constructor() {
        super('swgc', 'Kirim status ke WhatsApp Group Chat', false, 'group');
    }

    async execute(ctx, client, args) {
        try {
            const jid = ctx.roomId || ctx.remoteJid || ctx.senderId;
            const isGroup = jid.endsWith('@g.us');
            if (!isGroup) {
                await client.send(jid).text('❌ Fitur ini cuma bisa dipake di grup aja ya!');
                return;
            }
            
            const sender = ctx.senderId || ctx.senderJid;
            const groupMetadata = await client.group.metadata(jid);
            const userParticipant = groupMetadata.participants.find(p => p.id === sender);
            const botId = client.user?.id?.split(':')[0] + '@s.whatsapp.net';
            const botParticipant = groupMetadata.participants.find(p => p.id === botId);
            
            const isUserAdmin = userParticipant?.admin === 'admin' || userParticipant?.admin === 'superadmin';
            const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

            if (!isUserAdmin) {
                await client.send(jid).text('❌ Cuma admin grup yang bisa pake fitur ini!');
                return;
            }
            if (!isBotAdmin) {
                await client.send(jid).text('❌ Jadiin bot admin dulu dong biar bisa kirim status grup!');
                return;
            }

            await ctx.react('⏳');
            const caption = args.join(' ').trim();
            const replied = await ctx.replied?.().catch(() => null);

            if (replied?.media) {
                const media = await replied.media.buffer();
                const type = replied.chatType || '';
                
                if (type === 'image') {
                    await client.send(jid).image(media, { caption: caption || '📸 Status dari grup!' });
                } else if (type === 'video') {
                    await client.send(jid).video(media, { caption: caption || '🎬 Video status dari grup!' });
                } else if (type === 'audio') {
                    await client.send(jid).audio(media, { ptt: false });
                } else {
                    await ctx.react('');
                    await client.send(jid).text('❌ Cuma bisa kirim gambar, video, atau audio ke status grup!');
                    return;
                }
            } else if (caption) {
                await client.send(jid).text(caption);
            } else {
                await ctx.react('');
                await client.send(jid).text('🤔 Mau kirim apa nih ke status grup?\n\n*Cara pakai:*\n• Reply gambar/video + `.swgc caption`\n• `.swgc teks aja` untuk status teks');
                return;
            }
            
            await client.send(jid).text('✅ Status grup berhasil dikirim! 🎉');
            await ctx.react('');
        } catch (error) {
            console.error('SWGC error:', error.message);
            const jid = ctx.roomId || ctx.remoteJid || ctx.senderId;
            await ctx.react('');
            await client.send(jid).text('❌ Waduh ada error nih! Coba lagi ya 😅');
        }
    }
}

module.exports = SwgcFeature;
