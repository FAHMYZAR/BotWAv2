const BaseFeature = require('../core/BaseFeature');
const config = require('../config/config');

const sharp = require('sharp');

function getCurrentJakartaDateTime() {
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date());
}

function detectUrls(text) {
    return String(text || '').match(/https?:\/\/[^\s]+/g) || [];
}

function buildFinalPrompt(prompt) {
    const urls = detectUrls(prompt);
    if (!urls.length) return prompt;
    return `URL yang perlu dianalisis: ${urls[0]}\n\nPertanyaan: ${prompt}`;
}

function buildSystemInstruction() {
    return `Kamu adalah *EL-RUWET AI*, asisten AI dalam bot WhatsApp.

*IDENTITAS (jawab hanya jika ditanya spesifik):*
- Nama: EL-RUWET AI
- Dibuat oleh: EL-RUWET Team
- Platform: WhatsApp Bot

*ATURAN:*
- Jangan awali jawaban dengan "Saya EL-RUWET AI" atau "Sebagai asisten" kecuali ditanya identitas.
- Langsung jawab inti pertanyaan.
- Singkat, padat, natural seperti chat biasa.
- Wajib pakai hasil search untuk berita terkini, kondisi saat ini, data real-time, atau pertanyaan yang faktanya bisa berubah.

*FORMAT WHATSAPP:*
Gunakan hanya format berikut:
- Miring: _teks_
- Tebal: *teks*
- Coret: ~teks~
- Monospace: \`\`\`teks\`\`\`
- Daftar berpoin: * teks ATAU - teks
- Daftar bernomor: 1. teks
- Tanda kutip (quote): > teks
- Kode berderet: \`teks\`

*SUMBER (WAJIB JIKA MENGGUNAKAN SEARCH):*
- Jika jawaban berasal dari hasil pencarian web/search, WAJIB tuliskan satu baris di paling bawah yang berisi link sumber dan waktu pencarian.
- Format sumber harus seperti ini:
> _Sumber: [Link website utama]_
> _Diperbarui: ${getCurrentJakartaDateTime()} WIB_

Jangan menggunakan heading Markdown (# atau ##) atau tebal Markdown (**teks**).
Gunakan plain text untuk matematika: x², 1/2, ×, ÷, √, π.

Waktu sekarang: ${getCurrentJakartaDateTime()} WIB`;
}

function buildDirectAnswerMessages(prompt) {
    return [
        {
            role: 'system',
            content: buildSystemInstruction() + '\n\nJawab langsung tanpa web search jika pertanyaan tidak membutuhkan data terbaru atau realtime.'
        },
        {
            role: 'user',
            content: prompt
        }
    ];
}

function buildVisionMessages(prompt, imageBase64, mimeType) {
    return [
        {
            role: 'system',
            content: buildSystemInstruction() + '\n\nAnalisis gambar sesuai pertanyaan user. Jika user tidak memberi pertanyaan jelas, jelaskan isi gambar secara ringkas.'
        },
        {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: prompt
                },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:${mimeType};base64,${imageBase64}`
                    }
                }
            ]
        }
    ];
}

function buildRefineMessages(finalPrompt, searchData) {
    return [
        {
            role: 'system',
            content: 'Kamu hanya bertugas membuat query pencarian baru yang lebih akurat. Jangan jawab pertanyaan user. Output hanya satu query pencarian tanpa penjelasan.'
        },
        {
            role: 'user',
            content: `PERTANYAAN_USER:\n${finalPrompt}\n\nSEARCH_RESULT_AWAL:\n${JSON.stringify(searchData, null, 2)}\n\nBuat query pencarian baru yang paling tepat dan terbaru.`
        }
    ];
}

function buildAnswerMessages(finalPrompt, searchData) {
    return [
        {
            role: 'system',
            content: buildSystemInstruction() + '\n\nJawab berdasarkan SEARCH_RESULT_FINAL. Jangan mengarang data realtime di luar hasil search. Prioritaskan hasil terbaru. Rapikan teks agar nyaman dibaca di WhatsApp. PASTIKAN SELALU MENAMBAHKAN SUMBER DAN TIMESTAMP DI AKHIR JAWABAN BERDASARKAN HASIL SEARCH.'
        },
        {
            role: 'user',
            content: `SEARCH_RESULT_FINAL:\n${JSON.stringify(searchData, null, 2)}\n\nPERTANYAAN_USER:\n${finalPrompt}`
        }
    ];
}

async function getGoogleAiSearchData(prompt, systemPrompt) {
    try {
        const messages = systemPrompt
            ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }]
            : [{ role: 'user', content: prompt }];

        const baseUrl = String(config.googleAi?.baseUrl || '').replace(/\/$/, '');
        const apiKey = config.googleAi?.apiKey;

        if (!baseUrl || !apiKey) return null;

        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google-ai-mode',
                messages,
                stream: false
            })
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data?.choices?.[0]?.message?.content || null;
    } catch (err) {
        return null;
    }
}

function normalizeOutput(text) {
    return String(text || '')
        .replace(/\*\*(.*?)\*\*/g, '*$1*')
        .replace(/###\s?(.*)/g, '*$1*')
        .replace(/##\s?(.*)/g, '*$1*')
        .replace(/#\s?(.*)/g, '*$1*')
        .trim();
}

class RouterClient {
    constructor() {
        this.baseUrl = String(config.router?.baseUrl || '').replace(/\/$/, '');
        this.apiKey = config.router?.apiKey;
        this.chatModel = config.router?.chatModel;
        this.queryModel = config.router?.queryModel;
    }

    get headers() {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
        };
    }

    requireConfig() {
        if (!this.baseUrl || !this.apiKey) {
            throw new Error('Router AI belum diset. Isi ROUTER_API_KEY dan ROUTER_BASE_URL/ROUTER_PRODUCTION_BASE_URL.');
        }
    }

    extractChatText(data) {
        const choice = data?.choices?.[0];
        const messageContent = choice?.message?.content;

        if (typeof messageContent === 'string') return messageContent;
        if (Array.isArray(messageContent)) {
            const joined = messageContent
                .map((item) => typeof item === 'string' ? item : item?.text || item?.content || '')
                .filter(Boolean)
                .join('\n');
            if (joined) return joined;
        }
        if (typeof choice?.text === 'string') return choice.text;
        if (typeof data?.output_text === 'string') return data.output_text;

        return '';
    }

    async chat(messages, model = this.chatModel) {
        this.requireConfig();
        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                model,
                stream: false,
                messages
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Router chat gagal.');
        }

        return this.extractChatText(await response.json());
    }

    async search(query, maxResults = 5) {
        this.requireConfig();
        const response = await fetch(`${this.baseUrl}/v1/search`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                model: 'searxng',
                query,
                search_type: 'web',
                max_results: maxResults,
                language: 'id'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Router search gagal.');
        }

        return response.json();
    }
}

class AgnesImageClient {
    constructor() {
        this.baseUrl = String(config.agnes?.baseUrl || '').replace(/\/$/, '');
        this.apiKey = config.agnes?.apiKey;
        this.imageModel = config.agnes?.imageModel;
        this.imageSize = config.agnes?.imageSize;
    }

    get headers() {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
        };
    }

    requireConfig() {
        if (!this.baseUrl || !this.apiKey) {
            throw new Error('Agnes AI belum diset. Isi AGNES_API_KEY.');
        }
    }

    async requestImage(payload) {
        this.requireConfig();
        const response = await fetch(`${this.baseUrl}/v1/images/generations`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Agnes image generation gagal.');
        }

        return response.json();
    }

    extractGeneratedImage(response) {
        const candidates = [];

        const walk = (value) => {
            if (value == null) return;
            if (typeof value === 'string') {
                if (value.startsWith('data:image/')) candidates.push({ type: 'data_url', value });
                else if (/^https?:\/\//.test(value) && /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(value)) candidates.push({ type: 'url', value });
                return;
            }
            if (Array.isArray(value)) {
                value.forEach(walk);
                return;
            }
            if (typeof value === 'object') {
                if (typeof value.b64_json === 'string') candidates.push({ type: 'base64', mime: 'image/png', value: value.b64_json });
                if (typeof value.url === 'string') walk(value.url);
                if (typeof value.image_url?.url === 'string') walk(value.image_url.url);
                if (typeof value.inlineData?.data === 'string') candidates.push({ type: 'base64', mime: value.inlineData.mimeType || 'image/png', value: value.inlineData.data });
                if (typeof value.inline_data?.data === 'string') candidates.push({ type: 'base64', mime: value.inline_data.mime_type || 'image/png', value: value.inline_data.data });
                Object.values(value).forEach(walk);
            }
        };

        walk(response);
        return candidates[0] || null;
    }

    async imageCandidateToBuffer(candidate) {
        if (!candidate) throw new Error('Response image API tidak berisi gambar.');

        if (candidate.type === 'data_url') {
            const match = candidate.value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
            if (!match) throw new Error('Format data URL gambar tidak valid.');
            return { buffer: Buffer.from(match[2], 'base64'), mime: match[1] };
        }

        if (candidate.type === 'base64') {
            return { buffer: Buffer.from(candidate.value, 'base64'), mime: candidate.mime || 'image/png' };
        }

        if (candidate.type === 'url') {
            const response = await fetch(candidate.value);
            if (!response.ok) throw new Error('Gagal mengambil gambar hasil Agnes dari URL.');
            return { buffer: Buffer.from(await response.arrayBuffer()), mime: response.headers.get('content-type') || 'image/png' };
        }

        throw new Error(`Tipe gambar tidak dikenal: ${candidate.type}`);
    }

    async generate(prompt, size = this.imageSize) {
        const response = await this.requestImage({
            model: this.imageModel,
            prompt,
            size,
            return_base64: true,
            extra_body: { response_format: 'b64_json' }
        });
        return this.imageCandidateToBuffer(this.extractGeneratedImage(response));
    }

    async edit(prompt, imageDataUri, size = this.imageSize) {
        const response = await this.requestImage({
            model: this.imageModel,
            prompt,
            size,
            image: [imageDataUri],
            return_base64: true,
            extra_body: { response_format: 'b64_json' }
        });
        return this.imageCandidateToBuffer(this.extractGeneratedImage(response));
    }
}

class ELFeature extends BaseFeature {
    constructor() {
        super('el', 'Chat dengan EL-RUWET AI', false, 'ai');
        this.statusTrackers = new Map();
    }

    formatElapsed(startMs) {
        return `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
    }

    formatStatus(startMs, text) {
        return `[thinking ${this.formatElapsed(startMs)}] ${text}`;
    }

    async sendStatus(client, remoteJid, ctx, startMs, text) {
        const msg = await client.sendMessage(remoteJid, { text: this.formatStatus(startMs, text) }, );
        const interval = setInterval(() => {
            client.sendMessage(remoteJid, {
                text: this.formatStatus(startMs, this.statusTrackers.get(msg.key.id) || text),
                edit: msg.key
            }).catch(() => {});
        }, 1000);

        this.statusTrackers.set(`${msg.key.id}_interval`, interval);
        this.statusTrackers.set(msg.key.id, text);
        return msg;
    }

    async editStatus(client, remoteJid, statusMessage, startMs, text) {
        if (!statusMessage?.key) {
            return client.sendMessage(remoteJid, { text: this.formatStatus(startMs, text) });
        }

        this.statusTrackers.set(statusMessage.key.id, text);
        return client.sendMessage(remoteJid, {
            text: this.formatStatus(startMs, text),
            edit: statusMessage.key
        });
    }

    async finishStatus(client, remoteJid, statusMessage, output, ctx) {
        if (statusMessage?.key) {
            const interval = this.statusTrackers.get(`${statusMessage.key.id}_interval`);
            if (interval) clearInterval(interval);
            this.statusTrackers.delete(`${statusMessage.key.id}_interval`);
            this.statusTrackers.delete(statusMessage.key.id);
        }

        // Cek apakah output berisi format Sumber
        const sourceMatch = output.match(/>\s*_?Sumber:\s*(https?:\/\/[^\s_]+)_?\s*\n*>\s*_?Diperbarui:\s*([^\n_]+)_?/is);
        
        if (sourceMatch) {
            const sourceUrl = sourceMatch[1];
            const timestamp = sourceMatch[2].trim();
            
            // Buang baris sumber dari teks utama
            const cleanOutput = output.replace(/>\s*_?Sumber:.*?>\s*_?Diperbarui:.*?_?/is, '').trim();
            let hostname = sourceUrl;
            try { hostname = new URL(sourceUrl).hostname; } catch {}
            
            const footerText = `Sumber: ${hostname}\nUpdate: ${timestamp}`;

            // Hapus pesan status karena kita akan kirim interactive (gabisa di-edit)
            if (statusMessage?.key) {
                try { await client.delete(statusMessage.key); } catch {}
            }

            return client.sendMessage(remoteJid, {
                interactiveMessage: {
                    title: `${cleanOutput}\n`,
                    footer: footerText,
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'cta_url',
                                buttonParamsJson: JSON.stringify({
                                    display_text: 'Kunjungi Sumber Asli',
                                    url: sourceUrl
                                })
                            }
                        ]
                    }
                }
            }, );
        }

        if (!statusMessage?.key) {
            return client.sendMessage(remoteJid, { text: output }, );
        }

        return client.edit(statusMessage.key
        ).text(output);
    }

    async getQuotedContextInfo(ctx) {
        const replied = await ctx.replied?.().catch(() => null);
        if (!replied?.message) return undefined;
        return {
            stanzaId: replied.uniqueId,
            participant: replied.senderJid,
            quotedMessage: replied.message
        };
    }

    async getQuotedText(ctx) {
        const replied = await ctx.replied?.().catch(() => null);
        if (!replied?.message) return '';
        const msg = replied.message;
        return msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || '';
    }

    async getImageInput(ctx) {
        if (ctx.message?.imageMessage) {
            return {
                buffer: await ctx.media?.buffer(),
                mimeType: ctx.message?.imageMessage.mimetype || 'image/jpeg'
            };
        }

        const quotedMsg = (await ctx.replied().catch(()=>null))?.message;
        if (quotedMsg?.imageMessage) {
            const quotedM = {
                message: { imageMessage: quotedMsg.imageMessage },
                key: ctx.key
            };
            return {
                buffer: await (await ctx.replied().catch(()=>null))?.media?.buffer(),
                mimeType: quotedMsg.imageMessage.mimetype || 'image/jpeg'
            };
        }

        return null;
    }

    async detectIntentAndSearch(prompt, hasMediaInput, client) {
        const raw = await client.chat([
            {
                role: 'system',
                content: [
                    'Kamu bertugas mengklasifikasikan intent user dan menentukan apakah butuh pencarian web.',
                    'Balas HANYA dengan JSON valid.',
                    'Format JSON:',
                    '{ "mode": "chat|analyze|generate_image|generate_sticker|edit_image|edit_sticker|tool_call", "needs_search": true|false, "refined_prompt": "query untuk di-search atau prompt untuk LLM", "size": "1024x1024|1024x1536|1536x1024" }',
                    'Aturan "mode":',
                    '- "chat" untuk pertanyaan umum.',
                    '- "analyze" jika user bertanya isi/gambar media input.',
                    '- "generate_image"/"generate_sticker" jika user minta buat baru dari teks.',
                    '- "edit_image"/"edit_sticker" jika ada media input dan user minta ubah konten visualnya.',
                    '- "tool_call" JIKA user minta konversi format biasa: "jadikan stiker", "ubah foto ke stiker", "jadikan gambar", "ubah stiker ke foto".',
                    `has_media_input=${hasMediaInput}.`,
                    'Aturan "needs_search":',
                    'Wajib true JIKA pertanyaan butuh fakta terbaru, berita, cuaca, harga saham, kurs, jadwal, waktu rilis, skor, atau referensi faktual yang bisa berubah. Selain itu false.'
                ].join('\n')
            },
            { role: 'user', content: prompt }
        ], config.router?.queryModel || 'fastcombo');

        const match = String(raw || '').match(/\{[\s\S]*\}/);
        if (!match) return { mode: hasMediaInput ? 'analyze' : 'chat', needs_search: false, refined_prompt: prompt, size: '1024x1024' };

        try {
            const parsed = JSON.parse(match[0]);
            const allowed = new Set(['chat', 'analyze', 'generate_image', 'generate_sticker', 'edit_image', 'edit_sticker', 'tool_call']);
            const mode = allowed.has(parsed.mode) ? parsed.mode : 'chat';
            const refined = String(parsed.refined_prompt || prompt).trim() || prompt;
            const needs_search = Boolean(parsed.needs_search);
            
            let size = String(parsed.size || '').trim().toLowerCase();
            if (!/^\d+x\d+$/.test(size)) {
                if (['portrait', 'potrait', 'vertical'].includes(size)) size = '1024x1536';
                else if (['landscape', 'horizontal', 'banner'].includes(size)) size = '1536x1024';
                else size = config.agnes?.imageSize || '1024x1024';
            }

            return { mode, needs_search, refined_prompt: refined, size };
        } catch {
            return { mode: hasMediaInput ? 'analyze' : 'chat', needs_search: false, refined_prompt: prompt, size: '1024x1024' };
        }
    }

    async generateOrEditMedia(client, remoteJid, ctx, statusMessage, startMs, prompt, imagePayload, mode, size) {
        const agnesClient = new AgnesImageClient();
        const isStickerOutput = mode === 'generate_sticker' || mode === 'edit_sticker';
        const isEditMode = mode === 'edit_image' || mode === 'edit_sticker';

        await this.editStatus(client, remoteJid, statusMessage, startMs, 'Menyiapkan prompt gambar...');

        let result;
        if (isEditMode) {
            if (!imagePayload) throw new Error('Mode edit butuh gambar atau sticker sebagai input.');
            await this.editStatus(client, remoteJid, statusMessage, startMs, 'Mengedit media...');
            const imageDataUri = `data:${imagePayload.mimeType};base64,${imagePayload.buffer.toString('base64')}`;
            result = await agnesClient.edit(prompt, imageDataUri, size);
        } else {
            await this.editStatus(client, remoteJid, statusMessage, startMs, 'Generating gambar...');
            result = await agnesClient.generate(prompt, size);
        }

        await this.editStatus(client, remoteJid, statusMessage, startMs, 'Mengirim hasil...');

        if (isStickerOutput) {
            const stickerBuffer = await sharp(result.buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ lossless: true })
                .toBuffer();
            await client.sendMessage(remoteJid, { sticker: stickerBuffer }, );
        } else {
            await client.sendMessage(remoteJid, { image: result.buffer, mimetype: result.mime || 'image/png' }, );
        }

        await this.finishStatus(client, remoteJid, statusMessage, 'Selesai.', m);
    }

    async handleChat(client, remoteJid, statusMessage, startMs, finalPrompt, clientRouter, intent) {
        await this.editStatus(client, remoteJid, statusMessage, startMs, 'Menyusun jawaban...');
        let rawAnswer = null;

        if (intent?.needs_search) {
            await this.editStatus(client, remoteJid, statusMessage, startMs, 'Coba Google search...');
            
            // Ambil data mentah (raw) dari Google AI
            const googleRaw = await getGoogleAiSearchData(
                intent.refined_prompt || finalPrompt,
                'Jawab hanya dengan data atau fakta relevan, tidak perlu dirapikan atau diberi salam.'
            );

            if (googleRaw) {
                // Gunakan vpscombo untuk merapikan hasil Google AI
                await this.editStatus(client, remoteJid, statusMessage, startMs, 'Merapikan jawaban search...');
                rawAnswer = await clientRouter.chat(buildAnswerMessages(finalPrompt, { source: "Google ", data: googleRaw }), config.router?.chatModel || 'vpscombo');
            } else {
                await this.editStatus(client, remoteJid, statusMessage, startMs, 'Google gagal, fallback search...');
                const searchData = await clientRouter.search(intent.refined_prompt || finalPrompt, 8);
                rawAnswer = await clientRouter.chat(buildAnswerMessages(finalPrompt, searchData), config.router?.chatModel || 'vpscombo');
            }
        } else {
            rawAnswer = await clientRouter.chat([
                {
                    role: 'system',
                    content: buildSystemInstruction() + '\n\nJawab langsung, singkat, natural, dan to the point.'
                },
                {
                    role: 'user',
                    content: finalPrompt
                }
            ], config.router?.chatModel || 'vpscombo');
        }

        await this.editStatus(client, remoteJid, statusMessage, startMs, 'Merapikan format...');
        let output = normalizeOutput(rawAnswer);

        if (!output) {
            const retryAnswer = await clientRouter.chat([
                {
                    role: 'system',
                    content: buildSystemInstruction() + '\n\nJawab ulang pertanyaan user secara langsung. Output hanya jawaban final, jangan kosong.'
                },
                {
                    role: 'user',
                    content: finalPrompt
                }
            ], config.router?.queryModel);
            output = normalizeOutput(retryAnswer);
        }

        if (!output) {
            throw new Error('Gagal menghasilkan jawaban.');
        }

        return output;
    }

    async handleToolCall(client, remoteJid, ctx, statusMessage, startMs, refinedPrompt) {
        await this.editStatus(client, remoteJid, statusMessage, startMs, 'Mengalihkan ke fitur terkait...');
        const text = String(refinedPrompt || '').toLowerCase();
        
        const isToSticker = /(stiker|sticker)/.test(text) && !/(gambar|foto|image|img)/.test(text);
        const isToImage = /(gambar|foto|image|img)/.test(text) && /(stiker|sticker)/.test(text) && /(jadikan|ubah|convert)/.test(text);
        
        let targetFeature = null;
        if (isToImage || text.includes('toimg')) {
            const ToImgFeature = require('./ToImgFeature');
            targetFeature = new ToImgFeature();
        } else if (isToSticker || text.includes('sticker')) {
            const StickerFeature = require('./StickerFeature');
            targetFeature = new StickerFeature();
        }

        if (!targetFeature) {
            await this.finishStatus(client, remoteJid, statusMessage, '❌ Maaf, EL-RUWET AI tidak mengerti fitur apa yang dimaksud.', ctx);
            return;
        }

        await this.finishStatus(client, remoteJid, statusMessage, `Memproses via fitur ${targetFeature.name}...`, ctx);
        await targetFeature.execute(ctx, client, []);
    }

    async execute(ctx, client, args) {
        let statusMessage;
        const startMs = Date.now();
        const remoteJid = ctx.remoteJid;

        try {
            let prompt = args.join(' ');

            if (ctx.message?.imageMessage?.caption && !prompt) {
                prompt = ctx.message?.imageMessage.caption.replace(/^\.el\s*/i, '').trim();
            }

            const quotedText = await this.getQuotedText(ctx);
            if (quotedText) {
                prompt = prompt
                    ? `Konteks pesan yang di-reply: "${quotedText}"\n\nPertanyaan maupun Pernyataan: ${prompt}`
                    : quotedText;
            }

            const imageInput = await this.getImageInput(ctx).catch((error) => {
                console.error('Error downloading image:', error.message);
                return null;
            });

            if (!prompt && !imageInput) {
                await client.send(remoteJid).text('❌ Masukkan pertanyaan atau kirim/reply gambar!\n\n*Contoh:*\n• `.el halo`\n• `.el siapa presiden indonesia?`\n• Kirim gambar + caption `.el apa ini?`\n• Reply gambar + `.el bikin gambar kucing lucuu`');
                return;
            }

            const clientRouter = new RouterClient();
            statusMessage = await this.sendStatus(client, remoteJid, ctx, startMs, 'Memahami permintaan...');

            const userPrompt = prompt || 'Jelaskan isi media ini secara ringkas dan jelas.';
            const intent = await this.detectIntentAndSearch(userPrompt, Boolean(imageInput), clientRouter);

            if (intent.mode === 'analyze') {
                await this.editStatus(client, remoteJid, statusMessage, startMs, 'Media terdeteksi, membaca gambar...');
                const output = normalizeOutput(await clientRouter.chat(buildVisionMessages(intent.refined_prompt, imageInput.buffer.toString('base64'), imageInput.mimeType)));
                await ctx.react('');
                await this.finishStatus(client, remoteJid, statusMessage, output, ctx);
            } 
            else if (['generate_image', 'generate_sticker', 'edit_image', 'edit_sticker'].includes(intent.mode)) {
                await ctx.react('');
                await this.generateOrEditMedia(
                    client,
                    remoteJid,
                    ctx,
                    statusMessage,
                    startMs,
                    intent.refined_prompt,
                    imageInput,
                    intent.mode,
                    intent.size
                );
            } 
            else if (intent.mode === 'tool_call') {
                await ctx.react('');
                await this.handleToolCall(client, remoteJid, ctx, statusMessage, startMs, intent.refined_prompt);
            }
            else {
                const output = await this.handleChat(client, remoteJid, statusMessage, startMs, buildFinalPrompt(intent.refined_prompt), clientRouter, intent);
                await ctx.react('');
                await this.finishStatus(client, remoteJid, statusMessage, output, ctx);
            }
        } catch (error) {
            if (statusMessage?.key) {
                const interval = this.statusTrackers.get(`${statusMessage.key.id}_interval`);
                if (interval) clearInterval(interval);
                this.statusTrackers.delete(`${statusMessage.key.id}_interval`);
                this.statusTrackers.delete(statusMessage.key.id);
            }

            console.error('ELFeature error:', error.message);
            await ctx.react('❌');
            await client.send(remoteJid).text(`❌ Maaf, terjadi kesalahan: ${error.message}`);
        }
    }
}

module.exports = ELFeature;



