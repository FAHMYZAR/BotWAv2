const axios = require('axios');
const dns = require('dns');
const crypto = require('crypto');
const cheerio = require('cheerio');

const BASE_URL = 'https://raising.almaata.ac.id';

// Custom DNS resolver for raising.almaata.ac.id
const customLookup = (hostname, options, callback) => {
    if (hostname === 'raising.almaata.ac.id') {
        callback(null, '103.189.245.24', 4);
    } else {
        dns.lookup(hostname, options, callback);
    }
};

/**
 * Login dan dapatkan session + token
 */
async function login(nim, password) {
    try {
        let cookies = '';
        
        const session = axios.create({
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            lookup: customLookup,
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
        });

        // Get CSRF token dari welcome page
        const welcomeResp = await session.get(`${BASE_URL}/welcome`);
        
        // Extract cookies from welcome response
        if (welcomeResp.headers['set-cookie']) {
            cookies = welcomeResp.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
        }
        
        const $ = cheerio.load(welcomeResp.data);
        const csrfToken = $('input[name="csrf_test_name"]').val();

        if (!csrfToken) {
            throw new Error('CSRF token tidak ditemukan');
        }

        // Hash credentials dengan MD5
        const nimHash = crypto.createHash('md5').update(nim).digest('hex');
        const passHash = crypto.createHash('md5').update(password).digest('hex');

        // Login dengan URLSearchParams dan cookies
        const loginData = new URLSearchParams({
            csrf_test_name: csrfToken,
            f1: nimHash,
            f2: passHash,
            slogin: 'LOGIN'
        });

        const loginResp = await session.post(`${BASE_URL}/auth/login`, loginData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookies
            },
            maxRedirects: 5
        });

        // Extract token dari redirect URL
        const tokenMatch = loginResp.request?.responseURL?.match(/\/([a-f0-9]{40})\/dashboard/) || 
                          loginResp.request?.path?.match(/\/([a-f0-9]{40})\//);
        if (!tokenMatch) {
            throw new Error('Login gagal! Periksa NIM dan password');
        }

        const token = tokenMatch[1];

        // Update cookies from login response
        if (loginResp.headers['set-cookie']) {
            const newCookies = loginResp.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
            // Merge with existing cookies
            const allCookies = cookies + '; ' + newCookies;
            cookies = allCookies.split('; ').filter(c => c.trim()).join('; ');
        }
        
        // Parse cookies for individual values
        let csrfCookieName = '';
        let ciSessionCookie = '';
        
        cookies.split('; ').forEach(cookie => {
            const [name, value] = cookie.split('=');
            if (name === 'csrf_cookie_name') {
                csrfCookieName = value;
            } else if (name === 'ci_session') {
                ciSessionCookie = value;
            }
        });
        
        // Update session defaults to include all cookies
        session.defaults.headers.Cookie = cookies;
        


        return {
            session,
            token,
            csrfCookieName,
            ciSessionCookie,
            cookies
        };
    } catch (error) {
        console.error('[LOGIN ERROR]:', error.message);
        throw new Error(`Login gagal: ${error.message}`);
    }
}

/**
 * Ambil ID mahasiswa dari halaman dashboard - Simple method
 */
async function getIdMahasiswa(session, token) {
    try {
        const dashboardUrl = `${BASE_URL}/${token}/dashboard`;
        const dashboardResp = await session.get(dashboardUrl, {
            maxRedirects: 5
        });
        
        // Simple regex search like curl | grep
        const htmlContent = dashboardResp.data;
        const match = htmlContent.match(/var\s+idmahasiswa\s*=\s*(\d+);?/i);
        
        if (match && match[1]) {

            return match[1];
        }
        
        console.log('[DEBUG] ID mahasiswa not found');
        return null;
    } catch (error) {
        console.error('[GET ID ERROR]:', error.message);
        return null;
    }
}

/**
 * Cek presensi yang sedang berlangsung (ongoing) dari jadwal
 */
async function getPresensiTersedia(session, token, nim) {
    try {
        const url = `${BASE_URL}/${token}/api/perkuliahan/get_jadwal_kuliah_mahasiswa/${nim}`;
        const response = await session.get(url, {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (response.data && response.data.status === 'success') {
            // Filter: belum presensi (!id_absensi_mahasiswa) DAN status ongoing
            const presensiOngoing = response.data.data.filter(item => {
                const statusSplit = item.status_pertemuan ? item.status_pertemuan.split(':') : [];
                const kondisi = statusSplit[1]; // waiting, ongoing, atau done
                
                return !item.id_absensi_mahasiswa && kondisi === 'ongoing';
            });
            
            return presensiOngoing;
        }

        return [];
    } catch (error) {
        console.error('[GET PRESENSI ERROR]:', error.message);
        throw new Error(`Gagal mendapatkan daftar presensi: ${error.message}`);
    }
}

/**
 * Submit presensi dengan kode
 */
async function submitPresensi(dataLogin, kodePresensi, idPertemuanPresensi) {
    try {
        const FormData = require('form-data');
        const absenPayload = new FormData();
        absenPayload.append("id_mahasiswa", dataLogin.idMahasiswa);
        absenPayload.append("kode_presensi", kodePresensi);

        const presensi = await dataLogin.session.post(
            `${BASE_URL}/${dataLogin.token}/api/perkuliahan/create_presensi_mahasiswa_by_kode/${idPertemuanPresensi}`,
            absenPayload,
            {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Connection': 'keep-alive',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': `csrf_cookie_name=${dataLogin.csrfCookieName}; ci_session=${dataLogin.ciSessionCookie}`,
                    'Host': 'raising.almaata.ac.id',
                    'Origin': 'https://raising.almaata.ac.id',
                    'Referer': 'https://raising.almaata.ac.id/',
                    'Sec-Ch-Ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
                    'Sec-Ch-Ua-Mobile': '?1',
                    'Sec-Ch-Ua-Platform': '"Android"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
                }
            }
        );

        if (presensi.data.status === 'success') {
            return {
                status: presensi.data.status,
                message: presensi.data.message,
                data: presensi.data.data
            };
        } else {
            return {
                status: presensi.data.status,
                message: presensi.data.message.charAt(0).toUpperCase() + presensi.data.message.slice(1),
                data: presensi.data.data
            };
        }
    } catch (error) {
        console.error('[SUBMIT PRESENSI ERROR]:', error.message);
        throw new Error(`Gagal submit presensi: ${error.message}`);
    }
}

/**
 * Main function untuk presensi dengan auto-detect password
 */
async function doPresensi(nim, kodePresensi) {
    try {
        let dataLogin;
        
        // Try dengan "Pass" prefix dulu
        try {
            dataLogin = await login(nim, `Pass${nim}`);
        } catch (error) {
            // Fallback: coba tanpa prefix
            dataLogin = await login(nim, nim);
        }

        // Get ID Mahasiswa
        const idMahasiswa = await getIdMahasiswa(dataLogin.session, dataLogin.token);
        if (!idMahasiswa) {
            throw new Error('ID mahasiswa tidak ditemukan');
        }
        dataLogin.idMahasiswa = idMahasiswa;

        // Get presensi yang belum dari jadwal mingguan
        const presensiBelum = await getPresensiTersedia(dataLogin.session, dataLogin.token, nim);

        if (presensiBelum.length === 0) {
            return {
                status: 'info',
                message: '✅ Tidak ada presensi yang perlu diisi saat ini'
            };
        }

        // Submit presensi untuk yang pertama ditemukan
        const result = await submitPresensi(dataLogin, kodePresensi, presensiBelum[0].id_pertemuan_presensi);

        return {
            status: result.status,
            message: result.message,
            data: result.data,
            matakuliah: presensiBelum[0].nama_matakuliah || 'N/A',
            pertemuan: presensiBelum[0].pertemuan_ke || 'N/A'
        };
    } catch (error) {
        console.error('[DO PRESENSI ERROR]:', error.message);
        throw error;
    }
}

/**
 * Ambil semua jadwal kuliah hari ini dengan status presensinya
 */
async function getJadwalPresensiHariIni(session, token, nim) {
    try {
        const url = `${BASE_URL}/${token}/api/perkuliahan/get_jadwal_kuliah_mahasiswa/${nim}`;
        const response = await session.get(url, {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (response.data && response.data.status === 'success') {
            const today = new Date().getDay();
            const listHariIni = response.data.data.filter(item => item.day_of_week_number == today);
            
            // Deduplicate
            const uniqueList = listHariIni.filter((j, index, self) => 
                index === self.findIndex(k => 
                    k.nama_matakuliah === j.nama_matakuliah &&
                    k.jam_awal === j.jam_awal &&
                    k.nama_kelas === j.nama_kelas
                )
            );

            let sudahCount = 0;
            let belumCount = 0;
            const detailList = uniqueList.map(item => {
                const sudahAbsen = !!item.id_absensi_mahasiswa || item.status_presensi == '1';
                if (sudahAbsen) sudahCount++;
                else belumCount++;

                return {
                    matakuliah: item.nama_matakuliah || 'N/A',
                    kelas: item.nama_kelas || '',
                    jam: `${item.jam_awal || 'N/A'} - ${item.jam_akhir || 'N/A'}`,
                    status: sudahAbsen ? 'sudah' : 'belum',
                    ruang: item.nama_ruang || 'N/A'
                };
            });

            return {
                total: uniqueList.length,
                sudah: sudahCount,
                belum: belumCount,
                list: detailList
            };
        }
        throw new Error('Gagal memproses respons server');
    } catch (error) {
        console.error('[GET JADWAL PRESENSI ERROR]:', error.message);
        throw error;
    }
}

/**
 * Cek presensi untuk user (dengan auto-detect password)
 */
async function cekPresensi(nim, customPassword = null) {
    let dataLogin;
    
    // Gunakan customPassword jika diberikan, jika tidak lakukan auto-detect
    if (customPassword) {
        dataLogin = await login(nim, customPassword);
    } else {
        try {
            dataLogin = await login(nim, `Pass${nim}`);
        } catch (error) {
            dataLogin = await login(nim, nim);
        }
    }

    const idMahasiswa = await getIdMahasiswa(dataLogin.session, dataLogin.token);
    if (!idMahasiswa) {
        throw new Error('ID mahasiswa tidak ditemukan');
    }
    
    return await getJadwalPresensiHariIni(dataLogin.session, dataLogin.token, nim);
}

module.exports = {
    doPresensi,
    cekPresensi
};