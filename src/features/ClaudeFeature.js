const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class ClaudeFeature extends BaseFeature {
    constructor() {
        super('claude', 'Chat dengan Claude AI', false);
    }

    async execute(m, sock, args) {
        try {
            let prompt = args.join(' ');

            // Check if replying to a message
            if (m.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedText = m.message.extendedTextMessage.contextInfo.quotedMessage.conversation ||
                                  m.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text ||
                                  '';
                
                if (quotedText) {
                    prompt = prompt ? `${quotedText}\n\n${prompt}` : quotedText;
                }
            }

            if (!prompt) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Masukkan pertanyaan!\n\nContoh:\n> .claude halo\n> Reply pesan + .claude apakah ini benar?' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '🤖', key: m.key } });

            const response = await axios.get(`${config.apis.resita}/ai/claude`, {
                params: { prompt, apikey: config.resitaApiKey },
                timeout: 60000
            });

            if (!response.data.success) {
                throw new Error('API returned error');
            }

            const reply = response.data.message;

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            await sock.sendMessage(m.key.remoteJid, { 
                text: `${reply}`,
                contextInfo: m.message.extendedTextMessage?.contextInfo?.quotedMessage ? {
                    stanzaId: m.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: m.message.extendedTextMessage.contextInfo.participant,
                    quotedMessage: m.message.extendedTextMessage.contextInfo.quotedMessage
                } : undefined
            });

        } catch (error) {
            console.error('Claude error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat menghubungi Claude AI!' 
            });
        }
    }
}

module.exports = ClaudeFeature;
