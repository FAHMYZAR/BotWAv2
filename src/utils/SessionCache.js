/**
 * Simple in-memory cache untuk session RAISING
 * Mengurangi spam login dengan reuse token & cookies
 */
class SessionCache {
    constructor() {
        this.cache = null;
        this.expiry = null;
        this.cacheDuration = 5 * 60 * 1000; // 5 menit
    }

    set(token, cookies) {
        this.cache = { token, cookies };
        this.expiry = Date.now() + this.cacheDuration;
        console.log('[CACHE] Session saved, expires in 5 minutes');
    }

    get() {
        if (!this.cache || !this.expiry) return null;
        
        if (Date.now() > this.expiry) {
            console.log('[CACHE] Session expired');
            this.clear();
            return null;
        }

        console.log('[CACHE] Using cached session');
        return this.cache;
    }

    clear() {
        this.cache = null;
        this.expiry = null;
    }

    isValid() {
        return this.get() !== null;
    }
}

// Singleton instance
module.exports = new SessionCache();
