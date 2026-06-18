const BaseFeature = require('../core/BaseFeature');
const AdminHelper = require('../utils/AdminHelper');

class AddFeature extends BaseFeature {
    constructor() {
        super('add', 'Tambah member ke grup', false, 'admin');
    }

    async execute(ctx, client, args) {
        try {
            const groupId = ctx.roomId;
            
            if (!groupId.endsWith('@g.us')) {
                await ctx.reply('❌ Perintah ini hanya untuk grup!');
                return;
            }

            const senderId = ctx.senderId;
            
            if (!await AdminHelper.canExecuteAdminCommand(client, groupId, senderId)) {
                await ctx.reply('❌ Hanya admin yang bisa add member!');
                return;
            }

            if (!await AdminHelper.isBotAdmin(client, groupId)) {
                await ctx.reply('❌ Bot harus jadi admin untuk add member!');
                return;
            }

            const phoneNumber = args[0];
            
            if (!phoneNumber) {
                await ctx.reply('❌ Berikan nomor yang ingin ditambahkan!\n\nContoh:\n> `.add 628123456789`\n> `.add 08123456789`');
                return;
            }

            const targetJid = AdminHelper.formatPhoneNumber(phoneNumber);

            const [result] = await client.onWhatsApp(targetJid);
            if (!result || !result.exists) {
                await ctx.reply('❌ Nomor tidak terdaftar di WhatsApp!');
                return;
            }

            await client.group.addMember(groupId, [targetJid]);
            
            await ctx.reply(`✅ Member berhasil ditambahkan!`, {
                mentions: [targetJid]
            });

        } catch (error) {
            console.error('Add error:', error);
            
            let errorMsg = '❌ Gagal menambahkan member!';
            if (error.message.includes('403')) {
                errorMsg = '❌ Member ini memblokir bot atau privacy setting tidak mengizinkan!';
            } else if (error.message.includes('409')) {
                errorMsg = '❌ Member sudah ada di grup!';
            }
            
            await ctx.reply(errorMsg);
        }
    }
}

module.exports = AddFeature;
