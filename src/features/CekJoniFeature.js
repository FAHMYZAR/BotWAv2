const BaseFeature = require('../core/BaseFeature');

class CekJoniFeature extends BaseFeature {
    constructor() {
        super('cekjoni', 'Fitur lucu cek ukuran joni', false, 'fun');
    }

    async execute(ctx, client, args) {
        try {
            const quoted = (await ctx.replied().catch(()=>null));
            
            if (!quoted || !quoted.participant) {
                await client.sendMessage(ctx.remoteJid, { 
                    text: '❌ Reply pesan seseorang untuk mengukur!' 
                });
                return;
            }

            const targetJid = quoted.participant;
            let name = targetJid.split('@')[0];
            
            // Coba ambil nama dari store
            try {
                const contact = global.store?.contacts?.[targetJid];
                if (contact?.name) name = contact.name;
            } catch {}

            // Progress animation (editable)
            const progressMsg = await client.sendMessage(ctx.remoteJid, { 
                text: '🔄 *Calculating size...*\n```[▒▒▒▒▒▒▒▒▒▒] 0%```' 
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await client.sendMessage(ctx.remoteJid, { 
                text: '🔄 *Analyzing data...*\n```[██████▒▒▒▒] 60%```',
                edit: progressMsg.key
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await client.sendMessage(ctx.remoteJid, { 
                text: '🔄 *Final calculation...*\n```[██████████] 100%```',
                edit: progressMsg.key
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));

            const size = Math.floor(Math.random() * 50) + 1;

            let sizeEmoji;
            if (size < 10) sizeEmoji = '🤏🍆';
            else if (size < 20) sizeEmoji = '😐🍆';
            else if (size < 30) sizeEmoji = '😎🍆';
            else if (size < 40) sizeEmoji = '😏🍆';
            else sizeEmoji = '🍆🍆';

            await client.sendMessage(ctx.remoteJid, {
                text: `*Hasil perhitungan ukuran joni* ${sizeEmoji}\n\n` +
                      `*Nama:* ${name}\n` +
                      `*Ukuran Joni:* ${size}cm\n\n` +
                      `_Awwokwokowk Ukuran Joni🍆 nya ternyata ${size}cm_🤣`,
                edit: progressMsg.key
            });

        } catch (error) {
            console.error('CekJoni error:', error.message);
            await client.sendMessage(ctx.remoteJid, { 
                text: '❌ Terjadi kesalahan!' 
            });
        }
    }
}

module.exports = CekJoniFeature;

