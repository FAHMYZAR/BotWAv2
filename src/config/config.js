class Config {
    constructor() {
        this.ownerPrefix = '/';
        this.userPrefix = '.';
        this.ownerNumber = '621';
        this.ownerNumberFormatted = '621@c.us';
        this.mode = 'private'; // 'public' or 'private'
        
        // API Keys
        this.numverifyApiKey = 'xx';
        this.lolhumanApiKey = 'xx';
        this.resitaApiKey = 'xx';
        this.geminiApiKey = 'xxxx';

        
        // RAISING Credentials
        this.raising = {
            nim: 'xx',
            password: 'xxxx',
            baseUrl: 'xxxxx'
        };
        
        // External APIs
        this.apis = {
            catbox: 'https://catbox.moe/user/api.php',
            lolhuman: 'https://api.lolhuman.xyz/api',
            resita: 'https://api.ferdev.my.id',
            youtube: 'https://api.my.id/api/v1',
            youtubev2: 'https://ytv2.my.id',
            instagram: 'https://ig.my.id',
            candaan: 'https://candaan-api.vercel.app/api',
            gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',

        };
    }

    setOwnerPrefix(prefix) {
        this.ownerPrefix = prefix;
    }

    setUserPrefix(prefix) {
        this.userPrefix = prefix;
    }

    setMode(mode) {
        if (mode === 'public' || mode === 'private') {
            this.mode = mode;
            return true;
        }
        return false;
    }

    isPublicMode() {
        return this.mode === 'public';
    }

    reset() {
        this.ownerPrefix = '/';
        this.userPrefix = '.';
        this.mode = 'private';
    }

    getPrefix(isOwner) {
        return isOwner ? this.ownerPrefix : this.userPrefix;
    }
}

module.exports = new Config();
