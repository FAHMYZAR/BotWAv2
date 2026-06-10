const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

class KingFeature extends BaseFeature {
    constructor() {
        super('king', ' King - Buat gambar, video, analisa media, chat santai', false, 'ai');
        
        this.ARK_API_KEY = "784d5ed9-f314-4ddb-b2b9-5d7040d85fe0";
        this.CHAT_URL = "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions";
        this.IMAGE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3/images/generations";
        this.VIDEO_URL = "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks";
        
        this.CHAT_MODEL = "gpt-oss-120b-250805";
        this.IMAGE_MODEL = "seedream-4-5-251128";
        this.VISION_MODEL = "seed-1-6-250915";
        this.VIDEO_MODEL = "seedance-1-0-pro-fast-251015";
        this.KIMI_MODEL = "kimi-k2-250905";
    }

    async detectIntent(userInput, hasMedia = false, mediaType = null) {
        const text = userInput.toLowerCase().trim();

        // Jika ada media dan minta jadi sticker
        if (hasMedia && /sticker|stiker/i.test(text)) {
            return mediaType === 'video' ? 'STICKER_GIF' : 'STICKER';
        }

        // Question guard
        const isQuestion = /^(apakah|kenapa|mengapa|bagaimana|what|why|how|is|are|can|does|do)\b/i.test(text) || text.endsWith('?');
        if (isQuestion && !/(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/i.test(text)) {
            return 'CHAT';
        }

        // Video detection
        if (/buat|buatin|create|generate|make/i.test(text) && /video|animasi|animation|gerak|bergerak/i.test(text)) {
            return 'VIDEO';
        }

        // Image detection
        if (/buat|buatin|create|generate|draw|design|make/i.test(text) && /gambar|image|foto|photo/i.test(text)) {
            return 'IMAGE';
        }

        // Vision for media analysis
        if (hasMedia || /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/i.test(text)) {
            if (/analisa|analyze|describe|jelaskan|lihat|what is|apa ini/i.test(text)) {
                return 'VISION';
            }
            return 'VISION'; // Default for media
        }

        return 'CHAT';
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

    async chat(message) {
        const currentDateTime = this.getCurrentDateTime();
        const systemInstruction = `Kamu adalah *King *, asisten  yang terintegrasi dalam bot WhatsApp.

*IDENTITAS (hanya jawab jika ditanya spesifik):*
- Nama: King 
- Dibuat oleh: EL-RUWET Team
- Platform: WhatsApp Bot

*ATURAN PENTING:*
1. JANGAN awali jawaban dengan "Saya King " atau "Sebagai asisten" kecuali ditanya spesifik tentang identitas
2. Langsung jawab pertanyaan tanpa perkenalan
3. Singkat, padat, to the point
4. Natural seperti chat biasa
5. Minimal emoji, hanya gunakan jika benar-benar perlu

*FORMAT WHATSAPP:*
- Gunakan: *tebal*, _miring_, \`code\`, > quote
- JANGAN gunakan LaTeX/MathJax ($, $$, \\(, \\[)
- Untuk matematika gunakan format plain text:
  ❌ Salah: $x^2 + 5x = 10$ atau $$\\frac{1}{2}$$
  ✅ Benar: x² + 5x = 10 atau 1/2 atau (1/2)
- Gunakan unicode: ², ³, ×, ÷, ≈, ≠, ≤, ≥, √, π

*TOOLS & DATA:*
- Berikan informasi terkini dan akurat
- Waktu sekarang: ${currentDateTime} WIB
- Gunakan pengetahuan terbaru untuk jawaban yang relevan

*PERSONALITY:*
- Natural dan santai
- Langsung ke inti
- Tidak bertele-tele
- Ramah tapi efisien
- Minimal emoji`;

        const response = await axios.post(this.CHAT_URL, {
            model: this.CHAT_MODEL,
            max_completion_tokens: 65535,
            messages: [
                { 
                    role: "system", 
                    content: systemInstruction
                },
                { role: "user", content: message }
            ],
            reasoning_effort: "medium"
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.ARK_API_KEY}`
            }
        });
        return response.data;
    }

    async generateImage(prompt) {
        const response = await axios.post(this.IMAGE_URL, {
            model: this.IMAGE_MODEL,
            prompt,
            sequential_image_generation: "disabled",
            response_format: "url",
            size: "2K",
            stream: false,
            watermark: false
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.ARK_API_KEY}`
            }
        });
        return response.data;
    }

    async vision(imageUrl, questionText) {
        let url;
        
        if (Buffer.isBuffer(imageUrl)) {
            url = `data:image/jpeg;base64,${imageUrl.toString('base64')}`;
        } else if (fs.existsSync(imageUrl)) {
            const imageData = fs.readFileSync(imageUrl, { encoding: 'base64' });
            const ext = imageUrl.toLowerCase().split('.').pop();
            const mime = ['jpg', 'jpeg'].includes(ext) ? 'image/jpeg' : 'image/png';
            url = `data:${mime};base64,${imageData}`;
        } else {
            url = imageUrl;
        }
        
        const currentDateTime = this.getCurrentDateTime();
        const visionInstruction = `Kamu adalah King , asisten  untuk analisa visual. Jawab dengan gaya natural dan to the point. Minimal emoji, fokus pada informasi akurat. Waktu sekarang: ${currentDateTime} WIB.`;
        
        const response = await axios.post(this.CHAT_URL, {
            model: this.VISION_MODEL,
            messages: [{
                role: "user",
                content: [
                    { type: "image_url", image_url: { url } },
                    { 
                        type: "text", 
                        text: `${questionText}\n\n${visionInstruction}`
                    }
                ]
            }]
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.ARK_API_KEY}`
            }
        });
        return response.data;
    }

    async generateVideo(prompt, imageUrl = null) {
        const content = [
            {
                type: "text",
                text: `${prompt} --rs 480p --rt 1:1 --dur 4 --cf false`
            }
        ];

        if (imageUrl) {
            let url;
            if (Buffer.isBuffer(imageUrl)) {
                url = `data:image/jpeg;base64,${imageUrl.toString('base64')}`;
            } else {
                url = imageUrl;
            }
            content.push({
                type: "image_url",
                image_url: { url }
            });
        }

        const response = await axios.post(this.VIDEO_URL, {
            model: this.VIDEO_MODEL,
            content
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.ARK_API_KEY}`
            }
        });
        return response.data;
    }

    async checkVideoStatus(taskId) {
        const response = await axios.get(`${this.VIDEO_URL}/${taskId}`, {
            headers: {
                "Authorization": `Bearer ${this.ARK_API_KEY}`
            }
        });
        return response.data;
    }

    async waitForVideo(taskId, sock, chatId, maxWait = 300) {
        const startTime = Date.now();
        let progressMsg = null;
        
        while (true) {
            const result = await this.checkVideoStatus(taskId);
            
            if (result.status === 'succeeded' && result.content) {
                return result.content;
            }
            
            if (result.status === 'failed') {
                throw new Error(result.error || 'Video generation failed');
            }
            
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            if (elapsed > maxWait) {
                throw new Error(`Timeout setelah ${Math.floor(elapsed/60)} menit`);
            }
            
            // Update progress setiap 15 detik
            if (elapsed % 15 === 0 && elapsed > 0) {
                const percent = Math.min(Math.floor((elapsed / maxWait) * 100), 95);
                const progressBar = '█'.repeat(Math.floor(percent/5)) + '░'.repeat(20 - Math.floor(percent/5));
                const newProgress = `🎬 Lagi bikin video nih...\n[${progressBar}] ${percent}%\n⏱️ ${Math.floor(elapsed/60)}:${(elapsed%60).toString().padStart(2,'0')}`;
                
                if (!progressMsg) {
                    progressMsg = await sock.sendMessage(chatId, { text: newProgress });
                } else {
                    await sock.sendMessage(chatId, { text: newProgress, edit: progressMsg.key });
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    simulateImageProgress(sock, chatId, messageKey) {
        let progress = 0;
        const interval = setInterval(async () => {
            progress += Math.random() * 15 + 5; // 5-20% per update
            if (progress > 95) progress = 95;
            
            const filled = Math.floor(progress / 5);
            const empty = 20 - filled;
            const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
            
            const progressText = `Generating image...\n[${progressBar}] ${Math.floor(progress)}%\nProcessing request...`;
            
            try {
                await sock.sendMessage(chatId, { 
                    text: progressText, 
                    edit: messageKey 
                });
            } catch (e) {}
        }, 1500);
        
        return { interval, progress };
    }

    simulateVisionProgress(sock, chatId, messageKey) {
        let progress = 0;
        const interval = setInterval(async () => {
            progress += Math.random() * 20 + 10; // 10-30% per update
            if (progress > 95) progress = 95;
            
            const filled = Math.floor(progress / 5);
            const empty = 20 - filled;
            const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
            
            const progressText = `Analyzing image...\n[${progressBar}] ${Math.floor(progress)}%\nProcessing visual data...`;
            
            try {
                await sock.sendMessage(chatId, { 
                    text: progressText, 
                    edit: messageKey 
                });
            } catch (e) {}
        }, 1000);
        
        return { interval, progress };
    }

    async execute(m, sock, args) {
        try {
            let prompt = args.join(' ');
            let mediaBuffer = null;
            let mediaType = null;
            let quotedMedia = null;

            // Check quoted message
            if (m.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                const quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
                
                // Get quoted media
                if (quotedMsg.imageMessage) {
                    try {
                        const quotedM = {
                            message: { imageMessage: quotedMsg.imageMessage },
                            key: m.key
                        };
                        quotedMedia = await downloadMediaMessage(quotedM, 'buffer', {});
                        mediaType = 'image';
                    } catch (err) {
                        console.error('Error downloading quoted image:', err);
                    }
                } else if (quotedMsg.videoMessage) {
                    try {
                        const quotedM = {
                            message: { videoMessage: quotedMsg.videoMessage },
                            key: m.key
                        };
                        quotedMedia = await downloadMediaMessage(quotedM, 'buffer', {});
                        mediaType = 'video';
                    } catch (err) {
                        console.error('Error downloading quoted video:', err);
                    }
                } else if (quotedMsg.stickerMessage) {
                    try {
                        const quotedM = {
                            message: { stickerMessage: quotedMsg.stickerMessage },
                            key: m.key
                        };
                        quotedMedia = await downloadMediaMessage(quotedM, 'buffer', {});
                        mediaType = 'sticker';
                    } catch (err) {
                        console.error('Error downloading quoted sticker:', err);
                    }
                }
                
                // Get quoted text for context
                const quotedText = quotedMsg.conversation ||
                                  quotedMsg.extendedTextMessage?.text ||
                                  quotedMsg.imageMessage?.caption ||
                                  quotedMsg.videoMessage?.caption ||
                                  '';
                
                if (quotedText && prompt) {
                    prompt = `Konteks: "${quotedText}"\n\n${prompt}`;
                } else if (quotedText && !prompt) {
                    prompt = quotedText;
                }
            }

            // Check direct media
            if (m.message.imageMessage) {
                mediaBuffer = await downloadMediaMessage(m, 'buffer', {});
                mediaType = 'image';
            } else if (m.message.videoMessage) {
                mediaBuffer = await downloadMediaMessage(m, 'buffer', {});
                mediaType = 'video';
            } else if (m.message.stickerMessage) {
                mediaBuffer = await downloadMediaMessage(m, 'buffer', {});
                mediaType = 'sticker';
            }

            // Use quoted media if no direct media
            if (!mediaBuffer && quotedMedia) {
                mediaBuffer = quotedMedia;
            }

            // Default prompt if no text provided
            if (!prompt && mediaBuffer) {
                prompt = 'Jelaskan ini dong';
            }

            if (!prompt && !mediaBuffer) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: 'Mau ngapain nih? Kasih perintah dong!\n\n*Contoh:*\n• `king buat gambar kucing lucu`\n• `king buat video dari gambar ini` (reply gambar)\n• `king apa ini?` (reply media)\n• `king jadikan sticker` (reply gambar/video)\n• `king halo, apa kabar?`\n\n*Atau pakai prefix:*\n• `.king buat gambar`' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            const intent = await this.detectIntent(prompt, !!mediaBuffer, mediaType);
            
            if (intent === 'STICKER' || intent === 'STICKER_GIF') {
                if (!mediaBuffer) {
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: '❌ Ga ada media yang bisa dijadiin sticker nih!' 
                    });
                    return;
                }

                try {
                    let stickerBuffer;
                    
                    if (intent === 'STICKER_GIF' && mediaType === 'video') {
                        // Convert video to GIF first, then Sharp can handle it
                        const { exec } = require('child_process');
                        const fs = require('fs');
                        const sharp = require('sharp');
                        const tmpInput = `/tmp/input_${Date.now()}.mp4`;
                        const tmpGif = `/tmp/output_${Date.now()}.gif`;
                        
                        fs.writeFileSync(tmpInput, mediaBuffer);
                        
                        await new Promise((resolve, reject) => {
                            const cmd = `ffmpeg -i "${tmpInput}" -t 3 -vf "fps=30,scale=512:512:force_original_aspect_ratio=decrease" -loop 0 "${tmpGif}"`;
                            exec(cmd, (error) => {
                                if (error) reject(error);
                                else resolve();
                            });
                        });
                        
                        const gifBuffer = fs.readFileSync(tmpGif);
                        stickerBuffer = await sharp(gifBuffer, { animated: true })
                            .webp({ quality: 50 })
                            .toBuffer();
                        
                        fs.unlinkSync(tmpInput);
                        fs.unlinkSync(tmpGif);
                    } else {
                        const sharp = require('sharp');
                        stickerBuffer = await sharp(mediaBuffer)
                            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                            .webp()
                            .toBuffer();
                    }

                    await sock.sendMessage(m.key.remoteJid, {
                        sticker: stickerBuffer
                    });

                    await sock.sendMessage(m.key.remoteJid, { 
                        text: '✅ Sticker siap!' 
                    });
                } catch (error) {
                    console.error('Sticker creation error:', error);
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: '❌ Gagal bikin sticker!' 
                    });
                }

            } else if (intent === 'VIDEO') {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: 'Oke, lagi bikin video nih... Sabar ya!' 
                });

                const result = await this.generateVideo(prompt, mediaBuffer);
                
                if (result.id) {
                    try {
                        const output = await this.waitForVideo(result.id, sock, m.key.remoteJid);
                        
                        if (output.video_url) {
                            await sock.sendMessage(m.key.remoteJid, {
                                video: { url: output.video_url },
                                caption: 'Video dari King ! Gimana hasilnya?'
                            }, { quoted: m });
                        }
                    } catch (error) {
                        await sock.sendMessage(m.key.remoteJid, { 
                            text: `❌ Waduh, gagal bikin video: ${error.message}` 
                        });
                    }
                } else {
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: '❌ Gagal mulai bikin video nih!' 
                    });
                }

            } else if (intent === 'IMAGE') {
                const progressMsg = await sock.sendMessage(m.key.remoteJid, { 
                    text: 'Lagi gambar nih... Tunggu sebentar ya!' 
                });

                // Progress bar untuk image generation
                const imageProgress = this.simulateImageProgress(sock, m.key.remoteJid, progressMsg.key);
                
                try {
                    const result = await this.generateImage(prompt);
                    
                    // Stop progress
                    clearInterval(imageProgress.interval);
                    
                    if (result.data && result.data.length > 0) {
                        await sock.sendMessage(m.key.remoteJid, {
                            text: 'Gambar siap!',
                            edit: progressMsg.key
                        });
                        
                        await sock.sendMessage(m.key.remoteJid, {
                            image: { url: result.data[0].url },
                            caption: 'Gambar dari King ! Gimana hasilnya?'
                        }, { quoted: m });
                    } else {
                        await sock.sendMessage(m.key.remoteJid, { 
                            text: '❌ Gagal bikin gambar nih!',
                            edit: progressMsg.key
                        });
                    }
                } catch (error) {
                    clearInterval(imageProgress.interval);
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: '❌ Gagal bikin gambar nih!',
                        edit: progressMsg.key
                    });
                }

            } else if (intent === 'VISION') {
                if (!mediaBuffer) {
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: '❌ Ga ada gambar yang bisa dianalisa nih!' 
                    });
                    return;
                }

                const progressMsg = await sock.sendMessage(m.key.remoteJid, { 
                    text: 'Lagi analisa gambar... Tunggu ya!' 
                });

                // Progress bar untuk vision
                const visionProgress = this.simulateVisionProgress(sock, m.key.remoteJid, progressMsg.key);
                
                try {
                    const result = await this.vision(mediaBuffer, prompt || "Jelaskan gambar ini");
                    
                    // Stop progress
                    clearInterval(visionProgress.interval);
                    
                    if (result.choices && result.choices.length > 0) {
                        await sock.sendMessage(m.key.remoteJid, { 
                            text: 'Analisa selesai!',
                            edit: progressMsg.key
                        });
                        
                        await sock.sendMessage(m.key.remoteJid, { 
                            text: result.choices[0].message.content 
                        }, { quoted: m });
                    } else {
                        await sock.sendMessage(m.key.remoteJid, { 
                            text: '❌ Gagal analisa gambar nih!',
                            edit: progressMsg.key
                        });
                    }
                } catch (error) {
                    clearInterval(visionProgress.interval);
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: '❌ Gagal analisa gambar nih!',
                        edit: progressMsg.key
                    });
                }

            } else {
                // CHAT mode
                const result = await this.chat(prompt);
                
                if (result.choices && result.choices.length > 0) {
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: result.choices[0].message.content 
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: '❌ Lagi error nih, coba lagi ya!' 
                    });
                }
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '', key: m.key } });

        } catch (error) {
            console.error('King  error:', error.message);
            await sock.sendMessage(m.key.remoteJid, { react: { text: '', key: m.key } });
            await sock.sendMessage(m.key.remoteJid, { 
                text: 'Waduh error nih! Coba lagi ya' 
            });
        }
    }
}

module.exports = KingFeature;