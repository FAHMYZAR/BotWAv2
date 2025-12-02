const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');
const sharp = require('sharp');

class HugFeature extends BaseFeature {
    constructor() {
        super('hug', 'Random hug anime sticker', false);
    }

    async execute(m, sock, args) {
        try {
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '❤️', key: m.key }
            });

            const response = await axios.get(`${config.apis.lolhuman}/random/sfw/hug`, {
                params: { apikey: config.lolhumanApiKey },
                responseType: 'arraybuffer',
                timeout: 15000
            });

            const webp = await sharp(response.data, { animated: true })
                .webp({ quality: 95 })
                .toBuffer();

            await sock.sendMessage(m.key.remoteJid, {
                sticker: webp
            });

        } catch (error) {
            console.error('Hug error:', error.message);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Gagal mengirim pelukan!' 
            });
        }
    }
}

module.exports = HugFeature;
