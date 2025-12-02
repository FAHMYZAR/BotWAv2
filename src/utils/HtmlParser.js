const cheerio = require('cheerio');

/**
 * Parse HTML response dari RAISING API
 * Mengubah HTML login page menjadi object yang informatif
 */
class HtmlParser {
    /**
     * Check if string is HTML
     */
    static isHtml(data) {
        if (typeof data !== 'string') return false;
        const trimmed = data.trim();
        return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
    }

    /**
     * Parse HTML login page
     */
    static parseLoginPage(html) {
        const $ = cheerio.load(html);
        
        return {
            type: 'login_page',
            title: $('title').text(),
            hasLoginForm: $('input[name="tf1"]').length > 0,
            csrfToken: $('input[name="csrf_test_name"]').val(),
            message: $('marquee').text().trim() || 'Halaman login RAISING',
            loginUrl: $('form[name="frm"]').attr('action')
        };
    }

    /**
     * Parse any HTML response
     */
    static parse(data) {
        if (!this.isHtml(data)) {
            return { type: 'json', data };
        }

        const $ = cheerio.load(data);
        const hasLoginForm = $('input[name="tf1"]').length > 0;

        if (hasLoginForm) {
            return this.parseLoginPage(data);
        }

        return {
            type: 'html',
            title: $('title').text(),
            bodyText: $('body').text().substring(0, 200)
        };
    }

    /**
     * Convert parsed result to readable message
     */
    static toMessage(parsed) {
        if (parsed.type === 'login_page') {
            return `🔐 *Halaman Login Terdeteksi*\n\n` +
                   `Title: ${parsed.title}\n` +
                   `Message: ${parsed.message}\n\n` +
                   `⚠️ Session expired atau login gagal!`;
        }

        if (parsed.type === 'html') {
            return `📄 *HTML Response*\n\n` +
                   `Title: ${parsed.title}\n` +
                   `Content: ${parsed.bodyText}...`;
        }

        return '✅ Valid JSON response';
    }
}

module.exports = HtmlParser;
