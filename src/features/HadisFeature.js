const BaseFeature = require('../core/BaseFeature');
const axios = require('axios');
const config = require('../config/config');

class HadisFeature extends BaseFeature {
    constructor() {
        super('hadis', 'Dapatkan hadis acak dari Ensiklopedia Hadis', false, 'info');
    }

    async execute(ctx, client, args) {
        try {
            await ctx.react('📖');

            const response = await axios.get(config.apis.myquran.hadis.random, {
                timeout: 10000
            });

            if (!response.data.status || !response.data.data) {
                await ctx.react('');
                await client.send(ctx.remoteJid).text('❌ Gagal mengambil hadis!');
                return;
            }

            const hadis = response.data.data;
            
            let message = `*HADIS PILIHAN*\n\n`;
            message += `*${hadis.text.id}*\n\n`;
            message += `\`Riwayat :\` ${hadis.takhrij}\n`;
            message += `\`Status :\` ${hadis.grade}`;
            
            if (hadis.hikmah) {
                message += `\n\n*Hikmah:*\n${hadis.hikmah}`;
            }

            await ctx.react('');

            await client.send(ctx.remoteJid).text(message);

        } catch (error) {
            console.error('Hadis error:', error.message);
            await ctx.react('');
            await client.send(ctx.remoteJid).text('❌ Terjadi kesalahan saat mengambil hadis!');
        }
    }

    // Method untuk scheduler (tanpa interaksi user)
    static async getRandomHadis() {
        try {
            const response = await axios.get(config.apis.myquran.hadis.random, {
                timeout: 10000
            });

            if (!response.data.status || !response.data.data) {
                return null;
            }

            const hadis = response.data.data;
            
            let message = `*${hadis.text.id}*\n\n`;
            message += `\`Riwayat :\` ${hadis.takhrij}\n`;
            message += `\`Status :\` ${hadis.grade}`;
            
            if (hadis.hikmah) {
                message += `\n\n*Hikmah:*\n${hadis.hikmah}`;
            }

            return message;
        } catch (error) {
            console.error('Random hadis error:', error.message);
            return null;
        }
    }
}

module.exports = HadisFeature;