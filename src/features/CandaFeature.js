const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class CandaFeature extends BaseFeature {
    constructor() {
        super('canda', 'Dapatkan jokes receh random', false, 'fun');
    }

    async execute(ctx, client, args) {
        try {
            const type = args[0]?.toLowerCase();

            if (type === 'image' || type === 'img') {
                const { data } = await axios.get(`${config.apis.candaan}/image/random`);
                await client.send(ctx.remoteJid).image({ url: data.data.url });
            } else {
                const { data } = await axios.get(`${config.apis.candaan}/text/random`);
                await client.send(ctx.remoteJid).text(data.data);
            }

        } catch (error) {
            console.error('Canda error:', error.message);
            await client.send(ctx.remoteJid).text('❌ Gagal mengambil candaan! Coba lagi nanti');
        }
    }
}

module.exports = CandaFeature;
