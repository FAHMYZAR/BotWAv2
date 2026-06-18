const BaseFeature = require('../core/BaseFeature');

class PingFeature extends BaseFeature {
    constructor() {
        super('ping', 'Cek response time bot', false, 'tools');
    }

    async execute(ctx, client, args) {
        try {
            const start = Date.now();
            await client.send(ctx.roomId).text('🏓 Pong!');
            const latency = Date.now() - start;
            await client.send(ctx.roomId).text(`⚡ Response time: ${latency}ms`);
        } catch (error) {
            await ctx.reply('❌ Terjadi kesalahan!');
        }
    }
}

module.exports = PingFeature;
