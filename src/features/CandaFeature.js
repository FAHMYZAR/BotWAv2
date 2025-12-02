const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class CandaFeature extends BaseFeature {
    constructor() {
        super('canda', 'Dapatkan jokes receh random', false);
    }

    async execute(m, sock, args) {
        try {
            const type = args[0]?.toLowerCase();

            if (type === 'image' || type === 'img') {
                const { data } = await axios.get(`${config.apis.candaan}/image/random`);
                await sock.sendMessage(m.key.remoteJid, {
                    image: { url: data.data.url }
                });
            } else {
                const { data } = await axios.get(`${config.apis.candaan}/text/random`);
                await sock.sendMessage(m.key.remoteJid, {
                    text: data.data
                });
            }

        } catch (error) {
            console.error('Canda error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Gagal mengambil candaan! Coba lagi nanti'
            });
        }
    }
}

module.exports = CandaFeature;
