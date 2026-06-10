const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Setup store untuk save contacts (manual)
const store = {
    contacts: {},
    chats: {},
    messages: {}
};

// Load store dari file
if (fs.existsSync('./baileys_store.json')) {
    try {
        const data = JSON.parse(fs.readFileSync('./baileys_store.json', 'utf-8'));
        store.contacts = data.contacts || {};
        console.log('[STORE] Loaded', Object.keys(store.contacts).length, 'contacts');
    } catch (e) {
        console.log('Failed to load store');
    }
}

// Save store setiap 10 detik
setInterval(() => {
    fs.writeFileSync('./baileys_store.json', JSON.stringify(store, null, 2));
}, 10_000);

const config = require('./config/config');
const featureRegistry = require('./core/FeatureRegistry');
const commandHandler = require('./core/CommandHandler');
const KeynoteFeature = require('./features/KeynoteFeature');
const SholatScheduler = require('./utils/SholatScheduler');
const GreetingsHandler = require('./utils/GreetingsHandler');
const Database = require('./utils/Database');
const ProtectionSystem = require('./utils/ProtectionSystem');
const MessageTracker = require('./utils/MessageTracker');

async function initializeBot() {
    console.log('🚀 EL-RUWET [BOT + AI] Starting...');
    
    await Database.connect();
    
    // Auto-load all features AFTER database is connected
    const featuresDir = path.join(__dirname, 'features');
    featureRegistry.autoLoadFeatures(featuresDir);
    
    console.log(`📦 Loaded ${featureRegistry.features.size} features`);
}

// Initialize bot
initializeBot().catch(console.error);

const keynoteFeature = new KeynoteFeature();


async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        browser: ['EL-RUWET [BOT + AI]', 'Chrome', '3.0'],
        markOnlineOnConnect: true
    });

    // Store sock globally for features
    global.sock = sock;
    global.store = store;

    // Helper function to get name
    sock.getName = async (jid) => {
        const id = jid;
        let v;
        
        if (id.endsWith('@g.us')) {
            v = store.contacts[id] || {};
            if (!(v.name || v.subject)) {
                v = await sock.groupMetadata(id).catch(() => ({}));
            }
            return v.name || v.subject || '+' + id.replace('@g.us', '').split('@')[0];
        } else {
            v = store.contacts[id] || {};
            return v.name || v.subject || v.verifiedName || '+' + id.replace('@s.whatsapp.net', '').split('@')[0];
        }
    };

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('📱 Scan QR code di atas!');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('🚀 Bot sudah siap!');
            console.log(`👑 Owner: ${config.ownerNumber}`);
            console.log(`⚙️ Owner Prefix: ${config.ownerPrefix}`);
            console.log(`👤 User Prefix: ${config.userPrefix}`);
            
            // Save nama kita sendiri ke store
            const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const myName = sock.user.name || sock.user.verifiedName || 'Me';
            store.contacts[myJid] = { id: myJid, name: myName };
            console.log('💾 Saved my contact:', myJid, '→', myName);
            
            // Start sholat scheduler
            const scheduler = new SholatScheduler(sock);
            scheduler.isConnected = true; // Set true karena connection sudah open
            scheduler.start();
            
            // Initialize greetings handler
            global.greetingsHandler = new GreetingsHandler(sock);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('groups.update', async (updates) => {
        try {
            for (const update of updates) {
                const GroupSystem = require('./utils/GroupSystem');
                const registeredGroup = await GroupSystem.get(update.id);
                
                if (registeredGroup) {
                    // Auto-sync admin saat ada update grup
                    try {
                        const metadata = await sock.groupMetadata(update.id);
                        const allAdmins = metadata.participants
                            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                            .map(p => p.id);
                        
                        // Update group admins in MongoDB
                        for (const adminJid of allAdmins) {
                            await GroupSystem.addGroupAdmin(update.id, adminJid);
                        }
                    } catch (err) {
                        console.error('Auto-sync on group update error:', err.message);
                    }
                }
            }
        } catch (error) {
            console.error('Groups update error:', error.message);
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        try {
            const { id, participants, action } = update;
            const GroupSystem = require('./utils/GroupSystem');
            const registeredGroup = await GroupSystem.get(id);
            
            // Auto-sync admin jika ada promote/demote di grup terdaftar
            if (registeredGroup && (action === 'promote' || action === 'demote')) {
                try {
                    const metadata = await sock.groupMetadata(id);
                    const allAdmins = metadata.participants
                        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                        .map(p => p.id);
                    
                    // Update group admins in MongoDB
                    for (const adminJid of allAdmins) {
                        await GroupSystem.addGroupAdmin(id, adminJid);
                    }
                } catch (err) {
                    console.error('Auto-sync admin error:', err.message);
                }
            }
            
            // Greeting untuk semua grup (tidak perlu terdaftar)
            if (action === 'add') {
                await global.greetingsHandler.handleJoin(id, participants);
            } else if (action === 'remove') {
                await global.greetingsHandler.handleLeave(id, participants);
            }
        } catch (error) {
            console.error('Group participants update error:', error.message);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;

            const m = messages[0];
            if (!m.message) return;

            const messageText = m.message.conversation || 
                               m.message.extendedTextMessage?.text || 
                               m.message.imageMessage?.caption || 
                               m.message.videoMessage?.caption || '';

            const body = messageText.trim();
            const isFromMe = m.key.fromMe;
            const remoteJid = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;

            // Store message for undelete feature (only non-bot messages)
            if (!isFromMe && messageText) {
                const senderName = m.pushName || store.contacts[sender]?.name || sender.split('@')[0];
                let mediaType = null;
                
                if (m.message.imageMessage) mediaType = 'Image';
                else if (m.message.videoMessage) mediaType = 'Video';
                else if (m.message.audioMessage) mediaType = 'Audio';
                else if (m.message.documentMessage) mediaType = 'Document';
                else if (m.message.stickerMessage) mediaType = 'Sticker';
                
                // Store in background without blocking
                setImmediate(() => {
                    MessageTracker.addDeletedMessage(remoteJid, {
                        messageId: m.key.id,
                        sender: sender,
                        senderName: senderName,
                        text: messageText,
                        caption: m.message.imageMessage?.caption || m.message.videoMessage?.caption,
                        mediaType: mediaType,
                        timestamp: m.messageTimestamp
                    });
                });
            }

            // Save contact HANYA dari message yang BUKAN dari kita
            // Karena pushName di message kita adalah nama kita, bukan nama lawan
            if (!isFromMe && sender && m.pushName) {
                // Update jika belum ada atau nama berbeda
                if (!store.contacts[sender] || store.contacts[sender].name !== m.pushName) {
                    store.contacts[sender] = { id: sender, name: m.pushName };
                    console.log('[STORE] ✅ Saved/Updated contact:', sender, '→', m.pushName);
                }
                
                // BONUS: Save juga dengan format nomor asli jika sender pakai @lid
                if (sender.includes('@lid')) {
                    // Coba ambil nomor asli dari verifiedName atau contact
                    try {
                        const contact = await sock.onWhatsApp(sender);
                        if (contact && contact[0] && contact[0].jid) {
                            const realJid = contact[0].jid;
                            if (realJid !== sender) {
                                store.contacts[realJid] = { id: realJid, name: m.pushName };
                                console.log('[STORE] ✅ Also saved real JID:', realJid, '→', m.pushName);
                            }
                        }
                    } catch (e) {
                        // Ignore error
                    }
                }
            }

            // Check if owner
            const isRealOwner = isFromMe || sender.replace('@s.whatsapp.net', '') === config.ownerNumber;
            let isOwner = isRealOwner;
            const isGroup = remoteJid.endsWith('@g.us');
            
            // Jika di grup terdaftar, cek apakah admin grup
            if (isGroup && !isRealOwner) {
                const GroupSystem = require('./utils/GroupSystem');
                const registeredGroup = await GroupSystem.get(remoteJid);
                if (registeredGroup) {
                    if (await GroupSystem.isGroupAdmin(remoteJid, sender)) {
                        isOwner = true;
                    }
                }
            }

            // Check ytplay navigation
            if (body === '>next' || body === '<prev') {
                const ytPlayFeature = featureRegistry.get('ytplay');
                if (ytPlayFeature) {
                    if (body === '>next') {
                        await ytPlayFeature.handleNext(m, sock);
                    } else {
                        await ytPlayFeature.handlePrev(m, sock);
                    }
                    return;
                }
            }
            
            // Check help navigation
            if (body === '!next' || body === '!prev' || body === '!back') {
                const helpFeature = featureRegistry.get('help');
                if (helpFeature) {
                    if (body === '!next') {
                        await helpFeature.handleNext(m, sock);
                    } else if (body === '!prev') {
                        await helpFeature.handlePrev(m, sock);
                    } else if (body === '!back') {
                        await helpFeature.handleBack(m, sock);
                    }
                    return;
                }
            }
            
            // Check help category navigation
            if (body.startsWith('!') && body.length > 1) {
                const category = body.substring(1).toLowerCase();
                const helpFeature = featureRegistry.get('help');
                const validCategories = ['admin', 'ai', 'download', 'fun', 'group', 'info', 'media', 'owner', 'tools', 'akademik'];
                
                if (helpFeature && validCategories.includes(category)) {
                    await helpFeature.handleCategory(m, sock, category);
                    return;
                }
            }
            
            // Check if message is ytplay selection: +number
            const ytPlayFeature = featureRegistry.get('ytplay');
            if (ytPlayFeature && /^\+\d+$/.test(body)) {
                const selection = body.substring(1);
                await ytPlayFeature.handleSelection(m, sock, selection);
                return;
            }

            // AFK System
            const AfkSystem = require('./utils/AfkSystem');
            const AdminHelper = require('./utils/AdminHelper');
            
            // Cek apakah user yang kirim pesan sedang AFK
            if (await AfkSystem.isAfk(sender)) {
                const removed = await AfkSystem.removeAfk(sender);
                if (removed) {
                    const name = m.pushName || 'User';
                    await sock.sendMessage(remoteJid, {
                        text: `*${name}* sudah tidak AFK lagi`,
                        mentions: [sender]
                    });
                }
            }
            
            // Cek apakah ada yang mention/reply user yang AFK
            const mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
            
            // Gabungkan mention dan quoted
            const targetUsers = [...mentionedJid];
            if (quotedParticipant && !targetUsers.includes(quotedParticipant)) {
                targetUsers.push(quotedParticipant);
            }
            
            // Cek setiap target apakah AFK
            for (const targetUser of targetUsers) {
                if (await AfkSystem.isAfk(targetUser)) {
                    const afkData = await AfkSystem.getAfk(targetUser);
                    const duration = await AfkSystem.getAfkDuration(targetUser);
                    
                    // Cek apakah target adalah admin grup
                    let role = 'Member';
                    if (isGroup) {
                        const isAdmin = await AdminHelper.isGroupAdmin(sock, remoteJid, targetUser);
                        if (isAdmin) role = 'Admin';
                    }
                    
                    let message = `*${role}* @${targetUser.split('@')[0]} sedang AFK\n`;
                    message += `Alasan: ${afkData.reason}\n`;
                    message += `Sejak: ${duration} yang lalu`;
                    
                    await sock.sendMessage(remoteJid, {
                        text: message,
                        mentions: [targetUser]
                    });
                    
                    break; // Hanya reply 1x per pesan
                }
            }

            // Check AI commands without prefix
            if (body.toLowerCase().startsWith('el ')) {
                const elFeature = featureRegistry.get('el');
                if (elFeature) {
                    const prompt = body.substring(3).trim();
                    if (prompt) {
                        await elFeature.execute(m, sock, prompt.split(' '));
                        return;
                    }
                }
            }

            if (body.toLowerCase().startsWith('king ')) {
                const kingFeature = featureRegistry.get('king');
                if (kingFeature) {
                    const prompt = body.substring(5).trim();
                    if (prompt) {
                        await kingFeature.execute(m, sock, prompt.split(' '));
                        return;
                    }
                }
            }

            if (isOwner && body.startsWith(config.ownerPrefix)) {
                await commandHandler.handleOwnerCommands(m, sock);
            } else if (body.startsWith(config.userPrefix)) {
                await commandHandler.handleUserCommands(m, sock);
            } else {
                await keynoteFeature.handleKeynote(m, sock);
            }
        } catch (error) {
            console.error('❌ Message Handler Error:', error.message);
        }
    });

    // Listen for deleted messages
    sock.ev.on('messages.update', async (updates) => {
        try {
            for (const update of updates) {
                // Check if message was deleted
                if (update.update.message === null) {
                    console.log('[UNDELETE] Message deleted:', update.key.id);
                }
            }
        } catch (error) {
            console.error('Messages update error:', error.message);
        }
    });
}

connectToWhatsApp();

process.on('unhandledRejection', (err) => {
    const isCancelled = err?.message === 'Cancelled' || (err?.isBoom && err?.output?.statusCode === 500 && err?.message === 'Cancelled');
    if (isCancelled) return;
    console.error('❌ Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
});
