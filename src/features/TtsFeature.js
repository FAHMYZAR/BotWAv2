const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const ffmpegPath = require('ffmpeg-static');

class TtsFeature extends BaseFeature {
    constructor() {
        super('tts', 'Convert text to speech voice note', false, 'media');
    }

    async execute(m, sock, args) {
        try {
            let lang = 'id'; // Default bahasa Indonesia
            let text = args.join(' ');

            // Cek apakah ada parameter bahasa (id, en, ja, dll)
            const supportedLangs = ['id', 'en', 'ja', 'ko', 'ar', 'zh', 'es', 'fr', 'de', 'ru', 'pt', 'it', 'th', 'vi', 'nl', 'tr', 'hi'];
            if (args.length > 0 && supportedLangs.includes(args[0].toLowerCase())) {
                lang = args[0].toLowerCase();
                text = args.slice(1).join(' ');
            }

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

            // Validasi
            if (!text || text.trim() === '') {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Format salah!\n\nCara pakai:\n> `.tts <text>` - Ubah text jadi voice note (Bahasa ID)\n> `.tts <lang> <text>` - Dengan bahasa tertentu\n> Reply pesan dengan `.tts` - Ubah pesan yang di-reply\n\nBahasa tersedia:\n> `id` 🇮🇩 Indonesia\n> `en` 🇬🇧 English\n> `ja` 🇯🇵 Japanese\n> `ko` 🇰🇷 Korean\n> `ar` 🇸🇦 Arabic\n\nContoh:\n> `.tts Halo selamat pagi`\n> `.tts en Good morning`\n> Reply pesan lalu ketik `.tts`' 
                });
                return;
            }

            // Batasi panjang text
            if (text.length > 1000) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Text terlalu panjang! Maksimal 1000 karakter.' 
                });
                return;
            }

            // React loading
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '🔊', key: m.key }
            });

            // Generate TTS menggunakan API
            const mp3Buffer = await this.generateTTS(text, lang);
            
            // Convert MP3 to Opus (WhatsApp compatible format)
            const audioBuffer = await this.convertToOpus(mp3Buffer);

            // Hapus react loading
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '', key: m.key }
            });

            // Kirim sebagai voice note (PTT - Push To Talk)
            await sock.sendMessage(m.key.remoteJid, {
                audio: audioBuffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true // Ini yang membuat jadi voice note
            });

        } catch (error) {
            console.error('TTS error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: `❌ Gagal membuat voice note!\n\nError: ${error.message}` 
            });
        }
    }

    async generateTTS(text, lang = 'id') {
        try {
            // Coba menggunakan Google Translate TTS API (gratis)
            const url = `https://translate.google.com/translate_tts`;
            const response = await axios.get(url, {
                params: {
                    ie: 'UTF-8',
                    q: text,
                    tl: lang,
                    client: 'tw-ob',
                    ttsspeed: 1
                },
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            return Buffer.from(response.data);

        } catch (error) {
            // Backup: coba gunakan API lain jika Google gagal
            if (config.apis?.lolhuman && config.lolhumanApiKey) {
                try {
                    const response = await axios.get(`${config.apis.lolhuman}/tts`, {
                        params: {
                            apikey: config.lolhumanApiKey,
                            text: text,
                            lang: lang
                        },
                        responseType: 'arraybuffer',
                        timeout: 30000
                    });
                    return Buffer.from(response.data);
                } catch (err) {
                    console.error('Backup TTS API error:', err);
                }
            }

            // Jika semua API gagal
            throw new Error('Gagal generate audio dari semua TTS API');
        }
    }

    async convertToOpus(mp3Buffer) {
        const tempDir = path.join(__dirname, '../../temp');
        const inputPath = path.join(tempDir, `tts_${Date.now()}.mp3`);
        const outputPath = path.join(tempDir, `tts_${Date.now()}.opus`);

        try {
            // Pastikan folder temp ada
            await fs.mkdir(tempDir, { recursive: true });

            // Simpan MP3 buffer ke file
            await fs.writeFile(inputPath, mp3Buffer);

            // Convert MP3 ke Opus menggunakan FFmpeg
            await execPromise(`"${ffmpegPath}" -i "${inputPath}" -c:a libopus -b:a 128k "${outputPath}"`);

            // Baca hasil konversi
            const opusBuffer = await fs.readFile(outputPath);

            // Hapus file temporary
            await fs.unlink(inputPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});

            return opusBuffer;

        } catch (error) {
            // Cleanup on error
            await fs.unlink(inputPath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});
            
            console.error('Convert to Opus error:', error);
            // Jika konversi gagal, return MP3 buffer original
            return mp3Buffer;
        }
    }
}

module.exports = TtsFeature;

