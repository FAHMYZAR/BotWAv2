class Config {
    constructor() {
        this.ownerPrefix = '/';
        this.userPrefix = '.';
        this.ownerNumber = '6285226166485';
        this.ownerNumberFormatted = '6285226166485@c.us';
        this.mode = 'private'; // 'public' or 'private'
        
        // API Keys
        this.numverifyApiKey = '017ef96ffa4304daf559d83cfd94a166';
        this.lolhumanApiKey = 'cbb3c99f55a4887898a53b6c';
        this.resitaApiKey = 'keysita_17dY17dY';
        
        // RAISING Credentials
        this.raising = {
            nim: '243200330',
            password: 'Pass243200330',
            baseUrl: 'https://raising.almaata.ac.id'
        };
        
        // External APIs
        this.apis = {
            catbox: 'https://catbox.moe/user/api.php',
            lolhuman: 'https://api.lolhuman.xyz/api',
            resita: 'https://api.ferdev.my.id',
            youtube: 'https://api.apakah.my.id/api/v1',
            youtubev2: 'https://ytv2.apakah.my.id',
            instagram: 'https://ig.apakah.my.id',
            candaan: 'https://candaan-api.vercel.app/api'
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
