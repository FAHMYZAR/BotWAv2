const axios = require('axios');
const config = require('../config/config');

class PhoneLookup {
    
    // Method 1: NumVerify API (Free tier: 250 req/month)
    static async numVerify(phoneNumber) {
        try {
            const apiKey = config.numverifyApiKey;
            if (!apiKey) return null;

            const response = await axios.get(`http://apilayer.net/api/validate`, {
                params: {
                    access_key: apiKey,
                    number: phoneNumber,
                    format: 1
                },
                timeout: 5000
            });

            if (response.data.valid) {
                return {
                    source: 'NumVerify',
                    valid: true,
                    country: response.data.country_name,
                    location: response.data.location,
                    carrier: response.data.carrier,
                    lineType: response.data.line_type
                };
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    // Method 2: WhatsApp Profile (Always available)
    static async whatsappProfile(sock, phoneNumber) {
        try {
            const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
            
            const [exists] = await sock.onWhatsApp(jid);
            if (!exists) {
                return {
                    source: 'WhatsApp',
                    exists: false
                };
            }

            let profileName = 'Unknown';
            let about = null;
            let profilePic = null;

            try {
                const contact = await sock.store?.contacts?.[jid];
                if (contact?.name) profileName = contact.name;
            } catch {}

            try {
                about = await sock.fetchStatus(jid);
            } catch {}

            try {
                profilePic = await sock.profilePictureUrl(jid, 'image');
            } catch {}

            return {
                source: 'WhatsApp',
                exists: true,
                name: profileName,
                about: about?.status || null,
                profilePicUrl: profilePic || null,
                jid: jid
            };
        } catch (error) {
            return null;
        }
    }

    // Main lookup dengan fallback
    static async lookup(sock, phoneNumber) {
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        const results = {
            number: cleanNumber,
            timestamp: new Date().toISOString(),
            sources: []
        };

        // Try NumVerify
        const numVerifyResult = await this.numVerify(cleanNumber);
        if (numVerifyResult) results.sources.push(numVerifyResult);

        // Always try WhatsApp
        const waResult = await this.whatsappProfile(sock, cleanNumber);
        if (waResult) results.sources.push(waResult);

        return results;
    }
}

module.exports = PhoneLookup;
