const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const HtmlParser = require('./HtmlParser');
const sessionCache = require('./SessionCache');
const config = require('../config/config');

async function fetchJadwalKuliah() {
    try {
        const sess = axios.create({ 
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': config.raising.baseUrl
            },
            withCredentials: true
        });

        let token, cookieString;

        // Check cache first
        const cached = sessionCache.get();
        if (cached) {
            token = cached.token;
            cookieString = cached.cookies;
        } else {
            // Get CSRF token
            const r = await sess.get(`${config.raising.baseUrl}/welcome`);
            const $ = cheerio.load(r.data);
            const csrf = $('input[name="csrf_test_name"]').val();

            if (!csrf) {
                throw new Error('CSRF token tidak ditemukan');
            }

            console.log('[LOGIN] CSRF Token:', csrf);

            // Login
            const payload = new URLSearchParams({
                csrf_test_name: csrf,
                f1: crypto.createHash('md5').update(config.raising.nim).digest('hex'),
                f2: crypto.createHash('md5').update(config.raising.password).digest('hex'),
                slogin: 'LOGIN'
            });

            const resp = await sess.post(`${config.raising.baseUrl}/auth/login`, payload.toString(), {
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': r.headers['set-cookie'] ? r.headers['set-cookie'].join('; ') : ''
                },
                maxRedirects: 5,
                validateStatus: status => status >= 200 && status < 400
            });

            // Extract cookies from login response
            const cookies = [];
            if (r.headers['set-cookie']) cookies.push(...r.headers['set-cookie']);
            if (resp.headers['set-cookie']) cookies.push(...resp.headers['set-cookie']);
            
            cookieString = cookies.map(c => c.split(';')[0]).join('; ');
            console.log('[LOGIN] Cookies:', cookieString);

            // Extract token from redirect URL
            const redirectUrl = resp.request.res.responseUrl || resp.config.url;
            console.log('[LOGIN] Redirect URL:', redirectUrl);

            const match = redirectUrl.match(new RegExp(`${config.raising.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\/([a-f0-9]+)\/dashboard`));
            if (!match) {
                throw new Error('Login gagal / token tidak ditemukan');
            }

            token = match[1];
            console.log('[LOGIN] Token:', token);

            // Cache session
            sessionCache.set(token, cookieString);
        }

        const baseApi = `${config.raising.baseUrl}/${token}/api/perkuliahan`;

        // Fetch jadwal with better error handling
        const fetchWithValidation = async (url, name, retryCount = 0) => {
            try {
                const response = await sess.get(url, {
                    headers: {
                        'Cookie': cookieString,
                        'Referer': `${config.raising.baseUrl}/${token}/dashboard`
                    }
                });
                
                // Check if response is HTML (login page = session expired)
                if (HtmlParser.isHtml(response.data)) {
                    console.log(`[ERROR] ${name} returned HTML - session expired`);
                    
                    // Clear cache and retry once
                    if (retryCount === 0) {
                        console.log('[RETRY] Clearing cache and retrying...');
                        sessionCache.clear();
                        return await fetchJadwalKuliah(); // Recursive retry
                    }
                    
                    const parsed = HtmlParser.parse(response.data);
                    return { 
                        status: 'error', 
                        message: HtmlParser.toMessage(parsed),
                        isHtml: true,
                        parsed: parsed,
                        data: [] 
                    };
                }
                
                // Valid JSON response
                return response.data;
            } catch (error) {
                console.log(`[ERROR] ${name}:`, error.message);
                return { 
                    status: 'error', 
                    message: error.message,
                    data: [] 
                };
            }
        };

        const [kuliah, ujian] = await Promise.all([
            fetchWithValidation(`${baseApi}/get_jadwal_mingguan_mahasiswa/${config.raising.nim}`, 'Jadwal Kuliah'),
            fetchWithValidation(`${baseApi}/get_jadwal_ujian_mahasiswa/${config.raising.nim}`, 'Jadwal Ujian')
        ]);

        return { kuliah, ujian };
    } catch (error) {
        console.error('[FETCH ERROR]:', error);
        throw new Error(`Gagal fetch jadwal: ${error.message}`);
    }
}

module.exports = fetchJadwalKuliah;
