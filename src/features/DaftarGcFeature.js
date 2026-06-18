const BaseFeature = require('../core/BaseFeature');
const GroupSystem = require('../utils/GroupSystem');
const AdminHelper = require('../utils/AdminHelper');
const config = require('../config/config');
const axios = require('axios');

class DaftarGcFeature extends BaseFeature {
    constructor() {
        super('daftargc', 'Daftarkan grup (admin grup bisa daftar)', false, 'group');
    }

    async execute(ctx, client, args) {
        try {
            const groupId = ctx.remoteJid;
            const senderId = ctx.senderJid || ctx.remoteJid;
            const isOwner = ctx.isFromMe || senderId.replace('@s.whatsapp.net', '') === config.ownerNumber;

            if (!groupId.endsWith('@g.us')) {
                await client.send(groupId).text('❌ Perintah ini hanya bisa digunakan di grup!');
                return;
            }

            // Cek apakah user adalah owner bot atau admin grup
            const isGroupAdmin = await AdminHelper.isGroupAdmin(client, groupId, senderId);
            
            if (!isOwner && !isGroupAdmin) {
                await client.send(groupId).text('❌ Hanya owner bot atau admin grup yang bisa daftarkan grup!');
                return;
            }

            const kota = args.join(' ');
            if (!kota) {
                await client.send(groupId).text('❌ Masukkan nama kota!\n\nContoh:\n> `/daftargc Bantul`\n> `.daftargc Yogyakarta`');
                return;
            }

            // Ambil data peta (latitude, longitude, maps_url) dari Google AI base URL
            let lat = null, lng = null, mapsUrl = null;
            try {
                const mapsBaseUrl = String(config.googleAi?.baseUrl || 'http://localhost:9876').replace(/\/$/, '');
                const authHeader = config.googleAi?.apiKey ? `Bearer ${config.googleAi.apiKey}` : 'Bearer sk-fahmyzzx-ganteng-banget-cihuyyyy';
                
                const placeRes = await axios.get(`${mapsBaseUrl}/maps/place?q=${encodeURIComponent(kota)}`, {
                    headers: { 'Authorization': authHeader },
                    timeout: 15000
                });

                if (placeRes.data && placeRes.data.success) {
                    lat = placeRes.data.latitude;
                    lng = placeRes.data.longitude;
                    mapsUrl = placeRes.data.url;
                }
            } catch (err) {
                console.error('[DAFTARGC] Gagal fetch Google Maps place API:', err.message);
            }

            // Daftar grup dan ambil SEMUA admin grup
            const metadata = await client.group.metadata(groupId);
            const allAdmins = metadata.participants
                .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                .map(p => p.id);
            
            await GroupSystem.register(groupId, kota, senderId, lat, lng, mapsUrl);
            
            // Rebuild scheduler timers
            if (global.sholatScheduler) {
                global.sholatScheduler.rebuild();
            }
            
            // Simpan SEMUA admin grup, bukan hanya yang daftar
            for (const adminJid of allAdmins) {
                await GroupSystem.addGroupAdmin(groupId, adminJid);
            }
            
            let message = `✅ *GRUP BERHASIL DIDAFTARKAN!*\n\n`;
            message += `*Grup:* ${metadata.subject}\n`;
            message += `*Lokasi:* ${kota}\n`;
            if (lat && lng) message += `*Maps:* ${lat}, ${lng}\n`;
            message += `*Didaftarkan oleh:* @${senderId.split('@')[0]}\n\n`;
            message += `🕌 *FITUR AKTIF:*\n`;
            message += `> Auto reminder sholat\n`;
            message += `> Admin grup bisa pakai prefix \`/\`\n`;
            message += `> Welcome/leave message\n\n`;
            message += `👑 *ADMIN TERDAFTAR (${allAdmins.length}):*\n`;
            allAdmins.forEach((admin, i) => {
                message += `${i + 1}. @${admin.split('@')[0]}\n`;
            });
            message += `\n_Semua admin sekarang punya akses owner!_`;

            await client.send(groupId).text(message).mentions([senderId, ...allAdmins]
            );

        } catch (error) {
            console.error('DaftarGc error:', error.message);
            await client.send(ctx.remoteJid).text('❌ Terjadi kesalahan!');
        }
    }
}

module.exports = DaftarGcFeature;
