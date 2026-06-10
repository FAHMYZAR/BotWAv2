const BaseFeature = require('../core/BaseFeature');
const { generateWAMessageFromContent, generateWAMessage, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const crypto = require('crypto');

class SwgcFeature extends BaseFeature {
    constructor() {
        super('swgc', 'Kirim status ke WhatsApp Group Chat', false, 'group');
    }

    async execute(m, sock, args) {
        try {
            const chatId = m.key.remoteJid;
            const isGroup = chatId.endsWith('@g.us');
            
            if (!isGroup) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Fitur ini cuma bisa dipake di grup aja ya!' 
                });
                return;
            }

            const isAdmin = await this.checkAdmin(m, sock);
            if (!isAdmin.isUserAdmin) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Cuma admin grup yang bisa pake fitur ini!' 
                });
                return;
            }

            if (!isAdmin.isBotAdmin) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Jadiin bot admin dulu dong biar bisa kirim status grup!' 
                });
                return;
            }

            // React loading
            await sock.sendMessage(chatId, { 
                react: { text: '⏳', key: m.key } 
            });

            const isQuoted = !!m.quoted;
            const mimeType = isQuoted ? (m.quoted.mimetype || m.quoted.mtype) : null;
            const caption = args.join(' ').trim();
            let media = null;

            // Download media jika ada
            if (isQuoted && (m.quoted.message?.imageMessage || m.quoted.message?.videoMessage || m.quoted.message?.audioMessage)) {
                try {
                    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                    media = await downloadMediaMessage(m.quoted, 'buffer', {});
                } catch (err) {
                    console.error('Error downloading media:', err);
                    await sock.sendMessage(chatId, { 
                        react: { text: '', key: m.key } 
                    });
                    await sock.sendMessage(chatId, { 
                        text: '❌ Gagal download media! Coba lagi ya' 
                    });
                    return;
                }
            }

            let options = {};

            // Tentukan jenis konten
            if (isQuoted && media) {
                if (/image/.test(mimeType)) {
                    options = { 
                        image: media, 
                        caption: caption || '📸 Status dari grup!' 
                    };
                } else if (/video/.test(mimeType)) {
                    options = { 
                        video: media, 
                        caption: caption || '🎬 Video status dari grup!' 
                    };
                } else if (/audio/.test(mimeType)) {
                    options = { 
                        audio: media, 
                        mimetype: 'audio/mpeg', 
                        ptt: false 
                    };
                } else {
                    await sock.sendMessage(chatId, { 
                        react: { text: '', key: m.key } 
                    });
                    await sock.sendMessage(chatId, { 
                        text: '❌ Cuma bisa kirim gambar, video, atau audio ke status grup!' 
                    });
                    return;
                }
            } else if (caption) {
                options = { text: caption };
            } else {
                await sock.sendMessage(chatId, { 
                    react: { text: '', key: m.key } 
                });
                await sock.sendMessage(chatId, { 
                    text: '🤔 Mau kirim apa nih ke status grup?\n\n*Cara pakai:*\n• Reply gambar/video + `.swgc caption`\n• `.swgc teks aja` untuk status teks\n\n*Contoh:*\n• Reply foto + `.swgc Lagi meeting nih!`\n• `.swgc Halo semua! 👋`' 
                });
                return;
            }

            // Progress message
            const progressMsg = await sock.sendMessage(chatId, { 
                text: '📤 Lagi kirim ke status grup... Tunggu sebentar ya!' 
            });

            // Kirim ke status grup
            await this.sendGroupStatus(chatId, options, sock);

            // Success message
            await sock.sendMessage(chatId, { 
                text: '✅ Status grup berhasil dikirim! 🎉\n\nSekarang semua member bisa liat status ini di grup!' 
            });

            // Clear loading reaction
            await sock.sendMessage(chatId, { 
                react: { text: '', key: m.key } 
            });

        } catch (error) {
            console.error('SWGC error:', error.message);
            
            const chatId = m.key.remoteJid;
            
            // Clear loading reaction
            try {
                await sock.sendMessage(chatId, { 
                    react: { text: '', key: m.key } 
                });
            } catch (e) {}
            
            await sock.sendMessage(chatId, { 
                text: '❌ Waduh ada error nih! Coba lagi ya 😅\n\n*Kemungkinan penyebab:*\n• Bot belum jadi admin\n• Media terlalu besar\n• Koneksi bermasalah' 
            });
        }
    }

    async checkAdmin(m, sock) {
        try {
            const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
            const participants = groupMetadata.participants;
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const sender = m.key.participant || m.key.remoteJid;
            
            const userParticipant = participants.find(p => p.id === sender);
            const botParticipant = participants.find(p => p.id === botNumber);
            
            const isUserAdmin = userParticipant && (userParticipant.admin === 'admin' || userParticipant.admin === 'superadmin');
            const isBotAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');
            
            return { isUserAdmin, isBotAdmin };
        } catch (error) {
            console.error('Error checking admin status:', error);
            return { isUserAdmin: false, isBotAdmin: false };
        }
    }

    async sendGroupStatus(jid, content, sock) {
        try {
            const { generateWAMessageContent } = require('@whiskeysockets/baileys');
            
            // Generate content untuk status grup
            const inside = await generateWAMessageContent(content, {
                upload: sock.waUploadToServer
            });
            
            const messageSecret = crypto.randomBytes(32);
            
            const statusMessage = generateWAMessageFromContent(jid, {
                messageContextInfo: {
                    messageSecret 
                },
                groupStatusMessageV2: {
                    message: {
                        ...inside,
                        messageContextInfo: {
                            messageSecret
                        }
                    }
                }
            }, {});
            
            await sock.relayMessage(jid, statusMessage.message, {
                messageId: statusMessage.key.id
            });
            
            return statusMessage;
        } catch (error) {
            console.error('Error sending group status:', error);
            throw error;
        }
    }
}

module.exports = SwgcFeature;