const BaseFeature = require('../core/BaseFeature');
const ProtectionSystem = require('../utils/ProtectionSystem');

class ProtectedListFeature extends BaseFeature {
    constructor() {
        super('protectedlist', 'Lihat daftar protected users', true, 'owner');
    }

    async execute(ctx, client, args) {
        try {
            const data = ProtectionSystem.getAll();
            
            let message = '*🛡️ PROTECTED USERS*\n\n';
            
            message += '*📱 Numbers:*\n';
            if (data.numbers.length > 0) {
                data.numbers.forEach((num, i) => {
                    message += `${i + 1}. ${num}\n`;
                });
            } else {
                message += '- Tidak ada\n';
            }
            
            message += '\n*🆔 JIDs:*\n';
            if (data.jids.length > 0) {
                data.jids.forEach((jid, i) => {
                    message += `${i + 1}. ${jid}\n`;
                });
            } else {
                message += '- Tidak ada\n';
            }
            
            message += `\n*Total:* ${data.numbers.length + data.jids.length} protected users`;

            await client.send(ctx.remoteJid).text(message);

        } catch (error) {
            console.error('ProtectedList error:', error);
            await client.send(ctx.remoteJid).text('❌ Gagal mengambil protected list!');
        }
    }
}

module.exports = ProtectedListFeature;
