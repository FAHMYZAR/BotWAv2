const BaseFeature = require('../core/BaseFeature');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');

class GeminiFeature extends BaseFeature {
    constructor() {
        super('gem', 'Chat dengan Gemini Pintar (gem/g)', false);
        this.aliases = ['g'];
        this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    }

    getCurrentDateTime() {
        const now = new Date();
        const jakartaTime = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(now);
        return jakartaTime;
    }

    detectUrl(text) {
        const urlPattern = /https?:\/\/[^\s]+/g;
        return text.match(urlPattern) || [];
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
                    text: '❌ Masukkan pertanyaan!\n\nContoh:\n> .gem halo\n> .g siapa presiden indonesia?\n> Reply pesan + .gem apakah ini benar?' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '💎', key: m.key } });

            const currentDateTime = this.getCurrentDateTime();
            const systemInstruction = `Jawab secara singkat dan cepat dengan format style WhatsApp:
- Tebal pakai *1 bintang* bukan double
- Miring pakai _underscore_
- Code pakai 'single quote'
- Quote pakai > di awal baris
- JANGAN pakai emoji yang lebay
- Langsung to the point, jangan bertele-tele
- WAJIB pakai Google Search untuk pertanyaan tentang: berita terkini, kondisi belahan dunia manapun hari ini, tanggal sekarang, peristiwa terbaru, data real-time
- Tanggal dan waktu saat ini adalah ${currentDateTime} WIB`;

            const urls = this.detectUrl(prompt);
            
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-flash-latest',
                systemInstruction: systemInstruction
            });

            const tools = [];
            if (urls.length > 0) {
                tools.push({ googleSearch: {} }, { codeExecution: {} });
            } else {
                tools.push({ googleSearch: {} });
            }

            let finalPrompt = prompt;
            if (urls.length > 0) {
                finalPrompt = `URL yang perlu dianalisis: ${urls[0]}\n\nPertanyaan: ${prompt}`;
            }

            let reply;
            try {
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
                    tools: tools
                });
                reply = result.response.text();
            } catch (error) {
                console.log('Gemini with tools failed, trying without tools...');
                const fallbackModel = this.genAI.getGenerativeModel({
                    model: 'gemini-flash-latest',
                    systemInstruction: systemInstruction
                });
                const result = await fallbackModel.generateContent(prompt);
                reply = result.response.text();
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '', key: m.key } });

            await sock.sendMessage(m.key.remoteJid, { 
                text: reply,
                contextInfo: m.message.extendedTextMessage?.contextInfo?.quotedMessage ? {
                    stanzaId: m.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: m.message.extendedTextMessage.contextInfo.participant,
                    quotedMessage: m.message.extendedTextMessage.contextInfo.quotedMessage
                } : undefined
            });

        } catch (error) {
            console.error('Gemini error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Terjadi kesalahan saat menghubungi Gemini!' 
            });
        }
    }
}

module.exports = GeminiFeature;