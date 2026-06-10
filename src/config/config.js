const ProtectionSystem = require('../utils/ProtectionSystem');

class Config {
    constructor() {
        this.ownerPrefix = process.env.OWNER_PREFIX || '/';
        this.userPrefix = process.env.USER_PREFIX || '.';
        this.ownerNumber = process.env.OWNER_NUMBER || '6285878556744';
        this.ownerNumberFormatted = `${this.ownerNumber}@c.us`;
        
        // Load from JSON
        this.protectedNumbers = ProtectionSystem.data.numbers;
        this.protectedJids = ProtectionSystem.data.jids;
        
        this.numverifyApiKey = process.env.NUMVERIFY_API_KEY || '';
        this.lolhumanApiKey = process.env.LOLHUMAN_API_KEY || '';
        this.resitaApiKey = process.env.RESITA_API_KEY || '';
        this.pituCodeApiKey = process.env.PITUCODE_API_KEY || '';

        this.raising = {
            nim: process.env.RAISING_NIM || '',
            nim2: process.env.RAISING_NIM2 || '',
            password: process.env.RAISING_PASSWORD || '',
            password2: process.env.RAISING_PASSWORD2 || '',
            baseUrl: 'https://raising.almaata.ac.id'
        };

        this.router = {
            apiKey: process.env.ROUTER_API_KEY || '',
            baseUrl: process.env.ROUTER_PRODUCTION_BASE_URL || 'http://localhost:20128',
            chatModel: process.env.ROUTER_CHAT_MODEL || 'vpscombo',
            queryModel: process.env.ROUTER_QUERY_MODEL || 'fastcombo'
        };

        this.agnes = {
            apiKey: process.env.AGNES_API_KEY || '',
            baseUrl: process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com',
            imageModel: process.env.AGNES_IMAGE_MODEL || 'agnes-image-2.0-flash',
            imageSize: process.env.AGNES_IMAGE_SIZE || '1024x1024'
        };

        this.googleAi = {
            apiKey: process.env.GOOGLE_AI_API_KEY || '',
            baseUrl: process.env.GOOGLE_AI_BASE_URL || 'http://localhost:9876'
        };
        
        this.apis = {
            catbox: 'https://catbox.moe/user/api.php',
            lolhuman: 'https://api.lolhuman.xyz/api',
            resita: 'https://api.ferdev.my.id',
            youtube: 'https://api.apakah.my.id/api/v1',
            youtubev2: 'https://ytv2.apakah.my.id',
            instagram: 'https://ig.apakah.my.id',
            candaan: 'https://candaan-api.vercel.app/api',
            gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            myquran: {
                base: 'https://api.myquran.com/v3',
                sholat: {
                    search: 'https://api.myquran.com/v3/sholat/kabkota/cari',
                    jadwal: 'https://api.myquran.com/v3/sholat/jadwal'
                },
                hadis: {
                    random: 'https://api.myquran.com/v3/hadis/enc/random'
                }
            },
            pitucode: {
                base: 'https://api.pitucode.com/random',
                jawaquote: 'https://api.pitucode.com/random/jawaquote',
                galauquote: 'https://api.pitucode.com/random/galauquote',
                dilanquote: 'https://api.pitucode.com/random/dilanquote'
            }
        };
        
        // Sholat banners (direct image URLs)
        this.sholatBanners = [
            'https://files.catbox.moe/iu92u8.jpg',
            'https://files.catbox.moe/v7u6aw.jpg',
            'https://files.catbox.moe/i5w2ha.webp',
            'https://files.catbox.moe/ceshuw.jpeg'
        ];
    }

    setOwnerPrefix(prefix) {
        this.ownerPrefix = prefix;
    }

    setUserPrefix(prefix) {
        this.userPrefix = prefix;
    }

    reset() {
        this.ownerPrefix = '/';
        this.userPrefix = '.';
    }

    getPrefix(isOwner) {
        return isOwner ? this.ownerPrefix : this.userPrefix;
    }
}

module.exports = new Config();
