const BaseFeature = require('../core/BaseFeature');

class PingFeature extends BaseFeature {
    constructor() {
        super('ping', 'Cek response time bot', false);
    }

    async execute(m, sock, args) {
        try {
            const start = Date.now();
            await sock.sendMessage(m.key.remoteJid, { text: '🏓 Pong!' });
            const latency = Date.now() - start;
            await sock.sendMessage(m.key.remoteJid, { text: `⚡ Response time: ${latency}ms` });
        } catch (error) {
            await this.handleError(m, sock, error);
        }
    }

    async handleError(m, sock, error) {
        console.error(`${this.name} error:`, error);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Terjadi kesalahan!' });
    }
}

module.exports = PingFeature;
