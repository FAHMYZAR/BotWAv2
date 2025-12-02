const BaseFeature = require('../core/BaseFeature');
const { QuoteGenerator } = require('qc-generator-whatsapp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');

class QuoteStickerFeature extends BaseFeature {
    constructor() {
        super('q', 'Ubah quoted message jadi stiker (Gaya Quotly)', false);
    }

    async execute(m, sock, args) {
        try {
            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (!quoted) {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Reply pesan yang ingin dijadikan stiker!' 
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            const contextInfo = m.message.extendedTextMessage?.contextInfo;
            const isGroup = m.key.remoteJid.endsWith('@g.us');
            
            // Get quoted sender JID - FIXED LOGIC
            let quotedSender;
            if (isGroup) {
                // Di grup: participant adalah pengirim quoted message
                quotedSender = contextInfo?.participant;
            } else {
                // Di private chat:
                // participant di contextInfo adalah pengirim ASLI quoted message
                quotedSender = contextInfo?.participant || m.key.remoteJid;
            }
            
            console.log('[Q] ===== DEBUG INFO =====');
            console.log('[Q] Remote JID:', m.key.remoteJid);
            console.log('[Q] Is group:', isGroup);
            console.log('[Q] Context participant:', contextInfo?.participant);
            console.log('[Q] Context remoteJid:', contextInfo?.remoteJid);
            console.log('[Q] Quoted sender JID:', quotedSender);
            console.log('[Q] My JID:', sock.user.id.split(':')[0] + '@s.whatsapp.net');
            
            // Get name - PRIORITAS: store > pushName > WA API
            let name;
            
            // Helper: cari di store dengan berbagai format JID
            const findInStore = (jid) => {
                if (!global.store?.contacts) return null;
                
                // Coba exact match dulu
                if (global.store.contacts[jid]?.name) {
                    return global.store.contacts[jid].name;
                }
                
                // Extract nomor dari JID
                const number = jid.split('@')[0];
                
                // Cari dengan nomor yang sama tapi format berbeda
                for (const [key, contact] of Object.entries(global.store.contacts)) {
                    const keyNumber = key.split('@')[0];
                    if (keyNumber === number && contact.name) {
                        return contact.name;
                    }
                }
                
                return null;
            };
            
            // 1. Cek store dulu (paling akurat karena dari pushName)
            name = findInStore(quotedSender);
            if (name) {
                console.log('[Q] Name from store:', name);
            } 
            // 2. Cek pushName dari contextInfo
            else if (contextInfo?.pushName) {
                name = contextInfo.pushName;
                console.log('[Q] Name from pushName:', name);
            }
            // 3. Fallback ke sock.getName
            else {
                name = await sock.getName(quotedSender);
                console.log('[Q] Name from getName:', name);
            }
            
            console.log('[Q] Final name:', name);
            
            // Get profile picture - FORCE FRESH
            let ppBuffer = null;
            try {
                const ppUrl = await sock.profilePictureUrl(quotedSender, 'image');
                console.log('[Q] PP URL:', ppUrl);
                
                const axios = require('axios');
                const response = await axios.get(ppUrl, { 
                    responseType: 'arraybuffer',
                    timeout: 5000
                });
                ppBuffer = Buffer.from(response.data);
                console.log('[Q] PP downloaded, size:', ppBuffer.length);
            } catch (e) {
                console.log('[Q] No profile picture for:', quotedSender, e.message);
                ppBuffer = null;
            }
            
            // Get text
            const text = quoted.conversation || 
                        quoted.extendedTextMessage?.text || 
                        quoted.imageMessage?.caption || 
                        quoted.stickerMessage?.caption ||
                        '';
            
            // Get media if exists (support image & sticker)
            let mediaBuffer = null;
            if (quoted.imageMessage) {
                try {
                    mediaBuffer = await downloadMediaMessage(
                        { message: { imageMessage: quoted.imageMessage } },
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                } catch (e) {
                    console.error('Failed to download image:', e);
                }
            } else if (quoted.stickerMessage) {
                try {
                    const stickerBuffer = await downloadMediaMessage(
                        { message: { stickerMessage: quoted.stickerMessage } },
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                    // Convert WebP sticker to PNG for QuoteGenerator
                    mediaBuffer = await sharp(stickerBuffer).png().toBuffer();
                    console.log('[Q] Sticker converted to PNG');
                } catch (e) {
                    console.error('Failed to download sticker:', e);
                }
            }

            // Get timestamp from quoted message
            const timestamp = contextInfo?.quotedMessage?.messageTimestamp || 
                            Math.floor(Date.now() / 1000);
            const date = new Date(timestamp * 1000);
            const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            // Generate unique ID dari JID untuk avoid caching
            const uniqueId = parseInt(quotedSender.replace(/\D/g, '').slice(-8)) || Math.floor(Math.random() * 999999);
            
            console.log('[Q] Unique ID for cache:', uniqueId);
            
            // Generate quote image dengan ukuran lebih besar
            const params = {
                type: 'quote',
                backgroundColor: '#1b2226',
                width: 768,  // Lebih besar dari 512
                scale: 2,
                messages: [
                    {
                        avatar: true,
                        from: {
                            id: uniqueId,  // ID unik per user untuk avoid cache collision
                            name: name,
                            photo: ppBuffer ? { buffer: ppBuffer } : {},
                            time: time
                        },
                        text: text,
                        media: mediaBuffer ? { buffer: mediaBuffer } : undefined
                    }
                ]
            };

            const result = await QuoteGenerator(params);
            
            // Convert to proper WebP sticker format
            const stickerBuffer = await sharp(result.image)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 95 })
                .toBuffer();
            
            await sock.sendMessage(m.key.remoteJid, { sticker: stickerBuffer });

        } catch (error) {
            console.error('QuoteSticker error:', error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Gagal membuat stiker!' 
            });
        }
    }
}

module.exports = QuoteStickerFeature;
