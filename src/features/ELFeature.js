const BaseFeature = require('../core/BaseFeature');
const config = require('../config/config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');

const EXPLICIT_WEB_SEARCH_KEYWORDS = [
    'cari di google',
    'cari di web',
    'search google',
    'search web',
    'googling',
    'browse',
    'browsing',
    'lihat di internet',
    'cek internet',
    'cek web',
    'telusuri',
    'riset online'
];

const WEB_SEARCH_KEYWORDS = [
    'hari ini',
    'saat ini',
    'sekarang',
    'terbaru',
    'terkini',
    'paling baru',
    'baru-baru ini',
    'minggu ini',
    'bulan ini',
    'tahun ini',
    'real time',
    'real-time',
    'realtime',
    'live',
    'latest',
    'current',
    'recent',
    'today',
    'now',
    'berita',
    'news',
    'kabar',
    'viral',
    'trending',
    'harga',
    'price',
    'kurs',
    'exchange rate',
    'saham',
    'ihsg',
    'crypto',
    'bitcoin',
    'emas',
    'cuaca',
    'weather',
    'jadwal',
    'score',
    'skor',
    'hasil pertandingan',
    'klasemen',
    'ranking',
    'rilis',
    'release',
    'update',
    'cve',
    'vulnerability',
    'cek apakah',
    'benarkah',
    'sumbernya',
    'referensi',
    'source'
];

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
- Tebal pakai *1 bintang*.
- Miring pakai _underscore_.
- Code pakai \`code\`.
- Quote pakai > di awal baris.
- Jangan pakai LaTeX/MathJax.
- Matematika pakai plain text dan unicode: x², 1/2, ×, ÷, √, π.

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
            content: buildSystemInstruction() + '\n\nJawab berdasarkan SEARCH_RESULT_FINAL. Jangan mengarang data realtime di luar hasil search. Prioritaskan hasil terbaru. Kalau data realtime belum cukup jelas, katakan hasil search belum cukup akurat.'
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

    async sendStatus(sock, remoteJid, m, startMs, text) {
        const msg = await sock.sendMessage(remoteJid, { text: this.formatStatus(startMs, text) }, { quoted: m });
        const interval = setInterval(() => {
            sock.sendMessage(remoteJid, {
                text: this.formatStatus(startMs, this.statusTrackers.get(msg.key.id) || text),
                edit: msg.key
            }).catch(() => {});
        }, 1000);

        this.statusTrackers.set(`${msg.key.id}_interval`, interval);
        this.statusTrackers.set(msg.key.id, text);
        return msg;
    }

    async editStatus(sock, remoteJid, statusMessage, startMs, text) {
        if (!statusMessage?.key) {
            return sock.sendMessage(remoteJid, { text: this.formatStatus(startMs, text) });
        }

        this.statusTrackers.set(statusMessage.key.id, text);
        return sock.sendMessage(remoteJid, {
            text: this.formatStatus(startMs, text),
            edit: statusMessage.key
        });
    }

    async finishStatus(sock, remoteJid, statusMessage, output) {
        if (statusMessage?.key) {
            const interval = this.statusTrackers.get(`${statusMessage.key.id}_interval`);
            if (interval) clearInterval(interval);
            this.statusTrackers.delete(`${statusMessage.key.id}_interval`);
            this.statusTrackers.delete(statusMessage.key.id);
        }

        if (!statusMessage?.key) {
            return sock.sendMessage(remoteJid, { text: output });
        }

        return sock.sendMessage(remoteJid, {
            text: output,
            edit: statusMessage.key
        });
    }

    getQuotedContextInfo(m) {
        return m.message.extendedTextMessage?.contextInfo?.quotedMessage ? {
            stanzaId: m.message.extendedTextMessage.contextInfo.stanzaId,
            participant: m.message.extendedTextMessage.contextInfo.participant,
            quotedMessage: m.message.extendedTextMessage.contextInfo.quotedMessage
        } : undefined;
    }

    getQuotedText(m) {
        const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) return '';
        return quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || quotedMsg.imageMessage?.caption || '';
    }

    async getImageInput(m) {
        if (m.message.imageMessage) {
            return {
                buffer: await downloadMediaMessage(m, 'buffer', {}),
                mimeType: m.message.imageMessage.mimetype || 'image/jpeg'
            };
        }

        const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg?.imageMessage) {
            const quotedM = {
                message: { imageMessage: quotedMsg.imageMessage },
                key: m.key
            };
            return {
                buffer: await downloadMediaMessage(quotedM, 'buffer', {}),
                mimeType: quotedMsg.imageMessage.mimetype || 'image/jpeg'
            };
        }

        return null;
    }

    async needsWebSearch(prompt, client) {
        const normalizedPrompt = String(prompt || '').toLowerCase();

        if (EXPLICIT_WEB_SEARCH_KEYWORDS.some((keyword) => normalizedPrompt.includes(keyword))) {
            return true;
        }

        const decision = await client.chat([
            {
                role: 'system',
                content: 'Tentukan apakah prompt user butuh web search sebelum dijawab. Balas hanya WEB_SEARCH atau DIRECT_ANSWER. Pilih WEB_SEARCH jika pertanyaan butuh data terbaru, kondisi saat ini, verifikasi fakta yang bisa berubah, atau user meminta search/google/web.'
            },
            {
                role: 'user',
                content: prompt
            }
        ], config.router?.queryModel);

        const normalizedDecision = String(decision || '').trim().toUpperCase();
        if (normalizedDecision === 'WEB_SEARCH') return true;
        if (normalizedDecision === 'DIRECT_ANSWER') return false;

        return WEB_SEARCH_KEYWORDS.some((keyword) => normalizedPrompt.includes(keyword));
    }

    async detectIntent(prompt, hasMediaInput, client) {
        const text = String(prompt || '').toLowerCase();
        
        if (/(cari|carikan|info|berita|saham|kurs|harga|cuaca|dollar|ihsg|terkini|terbaru|hari ini)/.test(text)) {
            if (!/(bikin|buat|jadikan|ubah|edit)/.test(text)) {
                return { mode: 'chat', refined_prompt: prompt, size: '1024x1024' };
            }
        }

        const raw = await client.chat([
            {
                role: 'system',
                content: [
                    'Kamu bertugas mengklasifikasikan intent user untuk bot AI.',
                    'Balas hanya JSON valid tanpa markdown.',
                    'Field wajib: mode, refined_prompt, size.',
                    'mode hanya boleh salah satu: chat, analyze, generate_image, generate_sticker, edit_image, edit_sticker, tool_call.',
                    'Gunakan "chat" untuk pertanyaan umum.',
                    'Pilih "tool_call" JIKA user minta jadikan sticker (contoh: "jadikan stiker", "bikin stiker dari foto ini") atau jadikan gambar (contoh: "jadikan gambar", "ubah stiker ini jadi foto").',
                    'Jika user minta bikin gambar/ilustrasi baru dari teks, pilih generate_image.',
                    'Jika user minta bikin sticker/stiker baru dari teks, pilih generate_sticker.',
                    'Jika ada media input dan user minta mengubah isi/media, pilih edit_image atau edit_sticker.',
                    'Jika ada media input dan user hanya bertanya/menjelaskan isi media, pilih analyze.',
                    `Kalau has_media_input=${hasMediaInput ? 'true' : 'false'}.`,
                    'Untuk size, gunakan orientasi aman 1024x1024 kecuali disebut potrait/landscape.'
                ].join(' ')
            },
            { role: 'user', content: prompt }
        ], config.router?.queryModel);

        const match = String(raw || '').match(/\{[\s\S]*\}/);
        if (!match) return { mode: hasMediaInput ? 'analyze' : 'chat', refined_prompt: prompt, size: '1024x1024' };

        try {
            const parsed = JSON.parse(match[0]);
            const allowed = new Set(['chat', 'analyze', 'generate_image', 'generate_sticker', 'edit_image', 'edit_sticker', 'tool_call']);
            const mode = allowed.has(parsed.mode) ? parsed.mode : 'chat';
            const refined = String(parsed.refined_prompt || prompt).trim() || prompt;
            
            let size = String(parsed.size || '').trim().toLowerCase();
            if (!/^\d+x\d+$/.test(size)) {
                if (['portrait', 'potrait', 'vertical', 'vertikal', 'story'].includes(size)) size = '1024x1536';
                else if (['landscape', 'horizontal', 'banner', 'wide'].includes(size)) size = '1536x1024';
                else size = config.agnes?.imageSize || '1024x1024';
            }

            return { mode, refined_prompt: refined, size };
        } catch {
            return { mode: hasMediaInput ? 'analyze' : 'chat', refined_prompt: prompt, size: '1024x1024' };
        }
    }

    async generateOrEditMedia(sock, remoteJid, m, statusMessage, startMs, prompt, imagePayload, mode, size) {
        const agnesClient = new AgnesImageClient();
        const isStickerOutput = mode === 'generate_sticker' || mode === 'edit_sticker';
        const isEditMode = mode === 'edit_image' || mode === 'edit_sticker';

        await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Menyiapkan prompt gambar...');

        let result;
        if (isEditMode) {
            if (!imagePayload) throw new Error('Mode edit butuh gambar atau sticker sebagai input.');
            await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Mengedit media...');
            const imageDataUri = `data:${imagePayload.mimeType};base64,${imagePayload.buffer.toString('base64')}`;
            result = await agnesClient.edit(prompt, imageDataUri, size);
        } else {
            await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Generating gambar...');
            result = await agnesClient.generate(prompt, size);
        }

        await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Mengirim hasil...');

        if (isStickerOutput) {
            const stickerBuffer = await sharp(result.buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ lossless: true })
                .toBuffer();
            await sock.sendMessage(remoteJid, { sticker: stickerBuffer }, { quoted: m });
        } else {
            await sock.sendMessage(remoteJid, { image: result.buffer, mimetype: result.mime || 'image/png' }, { quoted: m });
        }

        await this.finishStatus(sock, remoteJid, statusMessage, 'Selesai.', m);
    }

    async handleChat(sock, remoteJid, statusMessage, startMs, finalPrompt, client) {
        await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Memahami pertanyaan...');
        const shouldSearch = await this.needsWebSearch(finalPrompt, client);
        let googleRaw = null;

        if (!shouldSearch) {
            await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Menyusun jawaban...');
            googleRaw = await client.chat(buildDirectAnswerMessages(finalPrompt));
        } else {
            await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Coba Google AI search...');
            googleRaw = await getGoogleAiSearchData(finalPrompt);

            if (!googleRaw) {
                await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Google AI gagal, fallback search...');
                const firstSearch = await client.search(finalPrompt, 5);
                const refinedQuery = String(await client.chat(buildRefineMessages(finalPrompt, firstSearch), config.router?.queryModel)).trim().replace(/^"|"$/g, '');
                const finalSearch = await client.search(refinedQuery || finalPrompt, 8);
                googleRaw = await client.chat(buildAnswerMessages(finalPrompt, finalSearch));
            }
        }

        await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Merapikan jawaban...');
        let output = normalizeOutput(await client.chat([
            {
                role: 'system',
                content: buildSystemInstruction() + '\n\nFormat ulang data berikut agar rapi sesuai gaya bahasa EL-RUWET AI, to the point, dan langsung menjawab pertanyaan.'
            },
            {
                role: 'user',
                content: `Pertanyaan: ${finalPrompt}\n\nData mentah:\n${googleRaw}`
            }
        ], config.router?.chatModel || 'vpscombo'));

        if (!output) {
            const retryAnswer = await client.chat([
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

    async handleToolCall(sock, remoteJid, m, statusMessage, startMs, refinedPrompt) {
        await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Mengalihkan ke fitur terkait...');
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
            await this.finishStatus(sock, remoteJid, statusMessage, '❌ Maaf, EL-RUWET AI tidak mengerti fitur apa yang dimaksud.');
            return;
        }

        await this.finishStatus(sock, remoteJid, statusMessage, `Memproses via fitur ${targetFeature.name}...`);
        await targetFeature.execute(m, sock, []);
    }

    async execute(m, sock, args) {
        let statusMessage;
        const startMs = Date.now();

        try {
            let prompt = args.join(' ');

            if (m.message.imageMessage?.caption && !prompt) {
                prompt = m.message.imageMessage.caption.replace(/^\.el\s*/i, '').trim();
            }

            const quotedText = this.getQuotedText(m);
            if (quotedText) {
                prompt = prompt
                    ? `Konteks pesan yang di-reply: "${quotedText}"\n\nPertanyaan maupun Pernyataan: ${prompt}`
                    : quotedText;
            }

            const imageInput = await this.getImageInput(m).catch((error) => {
                console.error('Error downloading image:', error.message);
                return null;
            });

            if (!prompt && !imageInput) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Masukkan pertanyaan atau kirim/reply gambar!\n\n*Contoh:*\n• `.el halo`\n• `.el siapa presiden indonesia?`\n• Kirim gambar + caption `.el apa ini?`\n• Reply gambar + `.el bikin gambar kucing lucuu`'
                });
                return;
            }

            const client = new RouterClient();
            const remoteJid = m.key.remoteJid;
            await sock.sendMessage(remoteJid, { react: { text: '💎', key: m.key } });
            statusMessage = await this.sendStatus(sock, remoteJid, m, startMs, 'Memahami permintaan...');

            const userPrompt = prompt || 'Jelaskan isi media ini secara ringkas dan jelas.';
            const intent = await this.detectIntent(userPrompt, Boolean(imageInput), client);

            if (intent.mode === 'analyze') {
                await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Media terdeteksi, membaca gambar...');
                const output = normalizeOutput(await client.chat(buildVisionMessages(intent.refined_prompt, imageInput.buffer.toString('base64'), imageInput.mimeType)));
                await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
                await this.finishStatus(sock, remoteJid, statusMessage, output, this.getQuotedContextInfo(m));
            } 
            else if (['generate_image', 'generate_sticker', 'edit_image', 'edit_sticker'].includes(intent.mode)) {
                await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
                await this.generateOrEditMedia(
                    sock,
                    remoteJid,
                    m,
                    statusMessage,
                    startMs,
                    intent.refined_prompt,
                    imageInput,
                    intent.mode,
                    intent.size
                );
            } 
            else if (intent.mode === 'tool_call') {
                await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
                await this.handleToolCall(sock, remoteJid, m, statusMessage, startMs, intent.refined_prompt);
            }
            else {
                const output = await this.handleChat(sock, remoteJid, statusMessage, startMs, buildFinalPrompt(intent.refined_prompt), client);
                await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
                await this.finishStatus(sock, remoteJid, statusMessage, output, this.getQuotedContextInfo(m));
            }
        } catch (error) {
            if (statusMessage?.key) {
                const interval = this.statusTrackers.get(`${statusMessage.key.id}_interval`);
                if (interval) clearInterval(interval);
                this.statusTrackers.delete(`${statusMessage.key.id}_interval`);
                this.statusTrackers.delete(statusMessage.key.id);
            }

            console.error('ELFeature error:', error.message);
            await sock.sendMessage(m.key.remoteJid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(m.key.remoteJid, {
                text: `❌ Maaf, terjadi kesalahan: ${error.message}`
            });
        }
    }
}

module.exports = ELFeature;
