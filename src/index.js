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

// Auto-load all features
const featuresDir = path.join(__dirname, 'features');
featureRegistry.autoLoadFeatures(featuresDir);

console.log('🚀 FAHMYZZX-BotWa Starting...');
console.log(`📦 Loaded ${featureRegistry.features.size} features`);

const keynoteFeature = new KeynoteFeature();

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        browser: ['FAHMYZZX-Bot', 'Chrome', '3.0'],
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

    sock.ev.on('group-participants.update', async (update) => {
        try {
            const { id, participants, action } = update;
            
            // Cek apakah grup terdaftar
            const GroupRegistry = require('./utils/GroupRegistry');
            const registeredGroup = GroupRegistry.get(id);
            if (!registeredGroup) {
                return; // Ignore grup yang tidak terdaftar
            }
            
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
            const isOwner = isFromMe || sender.replace('@s.whatsapp.net', '') === config.ownerNumber;
            const isGroup = remoteJid.endsWith('@g.us');

            // Mode check: private mode
            if (!config.isPublicMode() && isGroup) {
                // Private mode: cek apakah grup terdaftar (kecuali owner)
                if (!isOwner) {
                    const GroupRegistry = require('./utils/GroupRegistry');
                    const registeredGroup = GroupRegistry.get(remoteJid);
                    if (!registeredGroup) {
                        return; // Ignore pesan di grup yang tidak terdaftar
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
            if (body === '!next' || body === '!prev') {
                const helpFeature = featureRegistry.get('help');
                if (helpFeature) {
                    if (body === '!next') {
                        await helpFeature.handleNext(m, sock);
                    } else {
                        await helpFeature.handlePrev(m, sock);
                    }
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
}

connectToWhatsApp();

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
});
