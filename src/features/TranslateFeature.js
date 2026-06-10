const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class TranslateFeature extends BaseFeature {
    constructor() {
        super('tr', 'Translate text ke bahasa lain', false, 'tools');
    }

    getFlag(langCode) {
        const flags = {
            'id': '🇮🇩',
            'en': '🇬🇧',
            'ja': '🇯🇵',
            'ko': '🇰🇷',
            'ar': '🇸🇦',
            'zh': '🇨🇳',
            'es': '🇪🇸',
            'fr': '🇫🇷',
            'de': '🇩🇪',
            'ru': '🇷🇺',
            'pt': '🇵🇹',
            'it': '🇮🇹',
            'th': '🇹🇭',
            'vi': '🇻🇳',
            'nl': '🇳🇱',
            'tr': '🇹🇷',
            'hi': '🇮🇳'
        };
        return flags[langCode] || '🌐';
    }

    async execute(m, sock, args) {
        try {
            let targetLang = args[0];
            let text = args.slice(1).join(' ');

            // Jika reply pesan
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
                const quotedText = quoted.conversation || 
                                  quoted.extendedTextMessage?.text || 
                                  quoted.imageMessage?.caption || 
                                  quoted.videoMessage?.caption;
                if (quotedText) {
                    text = quotedText;
                }
            }

            if (!targetLang || !text) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Format salah!\n\nContoh:\n> `/tr id Good morning`\n> Reply pesan: `/tr id`\n\nKode bahasa:\n> `id` - Indonesia\n> `en` - English\n> `ja` - Japanese\n> `ko` - Korean\n> `ar` - Arabic' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '🔄', key: m.key }
            });

            const response = await axios.get(`${config.apis.lolhuman}/translate/auto/${targetLang}`, {
                params: { 
                    apikey: config.lolhumanApiKey,
                    text: text
                },
                timeout: 10000
            });

            if (response.data.status !== 200 || !response.data.result) {
                await sock.sendMessage(m.key.remoteJid, {
                    react: { text: '', key: m.key }
                });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Gagal menerjemahkan!' 
                });
                return;
            }

            const data = response.data.result;
            const flag = this.getFlag(data.to);
            
            let message = `${flag}\n`;
            message += `\`${data.translated}\`\n`;

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { text: message });

        } catch (error) {
            console.error('Translate error:', error.message);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat menerjemahkan!' 
            });
        }
    }
}

module.exports = TranslateFeature;
