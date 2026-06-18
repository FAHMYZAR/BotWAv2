const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
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

    async detectIntent(userInput, hasMedia, mediaType) {
        const text = userInput.toLowerCase().trim();
        if (hasMedia && /sticker|stiker/i.test(text)) return mediaType === 'video' ? 'STICKER_GIF' : 'STICKER';
        const isQuestion = /^(apakah|kenapa|mengapa|bagaimana|what|why|how|is|are|can|does|do)\b/i.test(text) || text.endsWith('?');
        if (isQuestion && !/(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/i.test(text)) return 'CHAT';
        if (/buat|buatin|create|generate|make/i.test(text) && /video|animasi|animation|gerak|bergerak/i.test(text)) return 'VIDEO';
        if (/buat|buatin|create|generate|draw|design|make/i.test(text) && /gambar|image|foto|photo/i.test(text)) return 'IMAGE';
        if (hasMedia || /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/i.test(text)) return 'VISION';
        return 'CHAT';
    }

    getCurrentDateTime() {
        return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    }

    async chat(message) {
        const currentDateTime = this.getCurrentDateTime();
        const systemInstruction = `Kamu adalah *King *, asisten yang terintegrasi dalam bot WhatsApp.\n*ATURAN PENTING:*\n1. JANGAN awali jawaban dengan "Saya King" atau "Sebagai asisten" kecuali ditanya spesifik\n2. Langsung jawab to the point\n3. Gunakan: *tebal*, _miring_, \`code\`, > quote\n4. Waktu sekarang: ${currentDateTime} WIB`;
        const response = await axios.post(this.CHAT_URL, { model: this.CHAT_MODEL, max_completion_tokens: 65535, messages: [{ role: "system", content: systemInstruction }, { role: "user", content: message }], reasoning_effort: "medium" }, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.ARK_API_KEY}` } });
        return response.data;
    }

    async generateImage(prompt) {
        const response = await axios.post(this.IMAGE_URL, { model: this.IMAGE_MODEL, prompt, sequential_image_generation: "disabled", response_format: "url", size: "2K", stream: false, watermark: false }, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.ARK_API_KEY}` } });
        return response.data;
    }

    async vision(imageUrl, questionText) {
        let url;
        if (Buffer.isBuffer(imageUrl)) url = `data:image/jpeg;base64,${imageUrl.toString('base64')}`;
        else if (fs.existsSync(imageUrl)) {
            const imageData = fs.readFileSync(imageUrl, { encoding: 'base64' });
            const ext = imageUrl.toLowerCase().split('.').pop();
            url = `data:${['jpg','jpeg'].includes(ext) ? 'image/jpeg' : 'image/png'};base64,${imageData}`;
        } else url = imageUrl;
        const response = await axios.post(this.CHAT_URL, { model: this.VISION_MODEL, messages: [{ role: "user", content: [{ type: "image_url", image_url: { url } }, { type: "text", text: `${questionText}\n\nKamu adalah King, asisten untuk analisa visual. Jawab natural to the point. Waktu: ${this.getCurrentDateTime()} WIB` }] }] }, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.ARK_API_KEY}` } });
        return response.data;
    }

    async generateVideo(prompt, imageUrl) {
        const content = [{ type: "text", text: `${prompt} --rs 480p --rt 1:1 --dur 4 --cf false` }];
        if (imageUrl) {
            let url;
            if (Buffer.isBuffer(imageUrl)) url = `data:image/jpeg;base64,${imageUrl.toString('base64')}`;
            else url = imageUrl;
            content.push({ type: "image_url", image_url: { url } });
        }
        const response = await axios.post(this.VIDEO_URL, { model: this.VIDEO_MODEL, content }, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.ARK_API_KEY}` } });
        return response.data;
    }

    async checkVideoStatus(taskId) {
        const response = await axios.get(`${this.VIDEO_URL}/${taskId}`, { headers: { "Authorization": `Bearer ${this.ARK_API_KEY}` } });
        return response.data;
    }

    async waitForVideo(taskId, client, chatId, maxWait) {
        const startTime = Date.now();
        let progressMsg = null;
        while (true) {
            const result = await this.checkVideoStatus(taskId);
            if (result.status === 'succeeded' && result.content) return result.content;
            if (result.status === 'failed') throw new Error(result.error || 'Video generation failed');
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            if (elapsed > maxWait) throw new Error(`Timeout setelah ${Math.floor(elapsed/60)} menit`);
            if (elapsed % 15 === 0 && elapsed > 0) {
                const percent = Math.min(Math.floor((elapsed / maxWait) * 100), 95);
                const progressBar = '█'.repeat(Math.floor(percent/5)) + '░'.repeat(20 - Math.floor(percent/5));
                const newProgress = `🎬 Lagi bikin video nih...\n[${progressBar}] ${percent}%\n⏱️ ${Math.floor(elapsed/60)}:${(elapsed%60).toString().padStart(2,'0')}`;
                if (!progressMsg) progressMsg = await client.send(chatId).text(newProgress);
                else await client.edit(progressMsg.key).text(newProgress);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    simulateImageProgress(client, chatId, messageKey) {
        let progress = 0;
        const interval = setInterval(async () => {
            progress += Math.random() * 15 + 5;
            if (progress > 95) progress = 95;
            const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
            try { await client.edit(messageKey).text(`Generating image...\n[${progressBar}] ${Math.floor(progress)}%\nProcessing request...`); } catch (e) {}
        }, 1500);
        return { interval, progress };
    }

    simulateVisionProgress(client, chatId, messageKey) {
        let progress = 0;
        const interval = setInterval(async () => {
            progress += Math.random() * 20 + 10;
            if (progress > 95) progress = 95;
            const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
            try { await client.edit(messageKey).text(`Analyzing image...\n[${progressBar}] ${Math.floor(progress)}%\nProcessing visual data...`); } catch (e) {}
        }, 1000);
        return { interval, progress };
    }

    async execute(ctx, client, args) {
        try {
            let prompt = args.join(' ');
            let mediaBuffer = null;
            let mediaType = null;
            let quotedMedia = null;
            const jid = ctx.remoteJid;

            const replied = await ctx.replied?.().catch(() => null);
            if (replied?.message) {
                const quotedMsg = replied.message;
                if (quotedMsg.imageMessage) { quotedMedia = await replied.media?.buffer(); mediaType = 'image'; }
                else if (quotedMsg.videoMessage) { quotedMedia = await replied.media?.buffer(); mediaType = 'video'; }
                else if (quotedMsg.stickerMessage) { quotedMedia = await replied.media?.buffer(); mediaType = 'sticker'; }
                const quotedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || quotedMsg.imageMessage?.caption || quotedMsg.videoMessage?.caption || '';
                if (quotedText && prompt) prompt = `Konteks: "${quotedText}"\n\n${prompt}`;
                else if (quotedText && !prompt) prompt = quotedText;
            }

            if (ctx.message?.imageMessage) { mediaBuffer = await ctx.media?.buffer(); mediaType = 'image'; }
            else if (ctx.message?.videoMessage) { mediaBuffer = await ctx.media?.buffer(); mediaType = 'video'; }
            else if (ctx.message?.stickerMessage) { mediaBuffer = await ctx.media?.buffer(); mediaType = 'sticker'; }
            if (!mediaBuffer && quotedMedia) mediaBuffer = quotedMedia;
            if (!prompt && mediaBuffer) prompt = 'Jelaskan ini dong';
            if (!prompt && !mediaBuffer) {
                await client.send(jid).text('Mau ngapain nih? Kasih perintah dong!\n\n*Contoh:*\n• `king buat gambar kucing lucu`\n• `king buat video` (reply gambar)\n• `king apa ini?` (reply media)\n• `king jadikan sticker`\n• `king halo`');
                return;
            }

            await ctx.react('⏳');
            const intent = await this.detectIntent(prompt, !!mediaBuffer, mediaType);

            if (intent === 'STICKER' || intent === 'STICKER_GIF') {
                if (!mediaBuffer) { await client.send(jid).text('❌ Ga ada media yang bisa dijadiin sticker nih!'); return; }
                try {
                    let stickerBuffer;
                    if (intent === 'STICKER_GIF' && mediaType === 'video') {
                        const { exec } = require('child_process');
                        const tmpInput = `/tmp/input_${Date.now()}.mp4`;
                        const tmpGif = `/tmp/output_${Date.now()}.gif`;
                        fs.writeFileSync(tmpInput, mediaBuffer);
                        await new Promise((resolve, reject) => exec(`ffmpeg -i "${tmpInput}" -t 3 -vf "fps=30,scale=512:512:force_original_aspect_ratio=decrease" -loop 0 "${tmpGif}"`, (e) => e ? reject(e) : resolve()));
                        const gifBuffer = fs.readFileSync(tmpGif);
                        stickerBuffer = await require('sharp')(gifBuffer, { animated: true }).webp({ quality: 50 }).toBuffer();
                        fs.unlinkSync(tmpInput); fs.unlinkSync(tmpGif);
                    } else {
                        stickerBuffer = await require('sharp')(mediaBuffer).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
                    }
                    await client.send(jid).sticker(stickerBuffer);
                    await client.send(jid).text('✅ Sticker siap!');
                } catch (error) { console.error('Sticker error:', error); await client.send(jid).text('❌ Gagal bikin sticker!'); }
            } else if (intent === 'VIDEO') {
                await client.send(jid).text('Oke, lagi bikin video nih... Sabar ya!');
                const result = await this.generateVideo(prompt, mediaBuffer);
                if (result.id) {
                    try {
                        const output = await this.waitForVideo(result.id, client, jid, 300);
                        if (output.video_url) await client.send(jid).video({ url: output.video_url }, { caption: 'Video dari King ! Gimana hasilnya?' });
                    } catch (error) { await client.send(jid).text(`❌ Waduh, gagal bikin video: ${error.message}`); }
                } else { await client.send(jid).text('❌ Gagal mulai bikin video nih!'); }
            } else if (intent === 'IMAGE') {
                const progressMsg = await client.send(jid).text('Lagi gambar nih... Tunggu sebentar ya!');
                const imageProgress = this.simulateImageProgress(client, jid, progressMsg.key);
                try {
                    const result = await this.generateImage(prompt);
                    clearInterval(imageProgress.interval);
                    if (result.data?.[0]) {
                        await client.edit(progressMsg.key).text('Gambar siap!');
                        await client.send(jid).image({ url: result.data[0].url }, { caption: 'Gambar dari King ! Gimana hasilnya?' });
                    } else { await client.edit(progressMsg.key).text('❌ Gagal bikin gambar nih!'); }
                } catch (error) { clearInterval(imageProgress.interval); await client.edit(progressMsg.key).text('❌ Gagal bikin gambar nih!'); }
            } else if (intent === 'VISION') {
                if (!mediaBuffer) { await client.send(jid).text('❌ Ga ada gambar yang bisa dianalisa nih!'); return; }
                const progressMsg = await client.send(jid).text('Lagi analisa gambar... Tunggu ya!');
                const visionProgress = this.simulateVisionProgress(client, jid, progressMsg.key);
                try {
                    const result = await this.vision(mediaBuffer, prompt || "Jelaskan gambar ini");
                    clearInterval(visionProgress.interval);
                    if (result.choices?.[0]) {
                        await client.edit(progressMsg.key).text('Analisa selesai!');
                        await client.send(jid).text(result.choices[0].message.content);
                    } else { await client.edit(progressMsg.key).text('❌ Gagal analisa gambar nih!'); }
                } catch (error) { clearInterval(visionProgress.interval); await client.edit(progressMsg.key).text('❌ Gagal analisa gambar nih!'); }
            } else {
                const result = await this.chat(prompt);
                if (result.choices?.[0]) await client.send(jid).text(result.choices[0].message.content);
                else await client.send(jid).text('❌ Lagi error nih, coba lagi ya!');
            }

            await ctx.react('');
        } catch (error) {
            console.error('King error:', error.message);
            await ctx.react('');
            await client.send(ctx.remoteJid).text('Waduh error nih! Coba lagi ya');
        }
    }
}

module.exports = KingFeature;
