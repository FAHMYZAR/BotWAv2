const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class AttpFeature extends BaseFeature {
    constructor() {
        super('attp', 'Buat sticker animasi dari text', false);
    }

    async execute(m, sock, args) {
        try {
            let text = args.join(' ');

            // Check if replying to a message
            if (!text && m.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedText = m.message.extendedTextMessage.contextInfo.quotedMessage.conversation ||
                                  m.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text ||
                                  '';
                text = quotedText;
            }

            if (!text) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Masukkan text atau reply pesan!\n\nContoh:\n> .attp Halo\n> Reply pesan + .attp' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '⏳', key: m.key }
            });

            const response = await axios.get(`${config.apis.lolhuman}/attp`, {
                params: { 
                    apikey: config.lolhumanApiKey,
                    text: text
                },
                responseType: 'arraybuffer',
                timeout: 15000
            });

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, {
                sticker: Buffer.from(response.data)
            });

        } catch (error) {
            console.error('ATTP error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Gagal membuat sticker!' 
            });
        }
    }
}

module.exports = AttpFeature;
