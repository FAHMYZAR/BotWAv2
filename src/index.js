require('dotenv').config();
const { Client } = require('zaileys');
const path = require('path');
const fs = require('fs');

const store = {
    contacts: {},
    chats: {},
    messages: {}
};

if (fs.existsSync('./baileys_store.json')) {
    try {
        const data = JSON.parse(fs.readFileSync('./baileys_store.json', 'utf-8'));
        store.contacts = data.contacts || {};
        console.log('[STORE] Loaded', Object.keys(store.contacts).length, 'contacts');
    } catch (e) {
        console.log('Failed to load store');
    }
}

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
const MessageTracker = require('./utils/MessageTracker');
const { normalizeUserJid, normalizeRecipient } = require('./utils/JidHelper');

const messageDedupe = new Map();
const DEDUPE_TTL_MS = 60_000;
const keynoteFeature = new KeynoteFeature();

async function initializeBot() {
    console.log('🚀 EL-RUWET [BOT + AI] Starting...');
    await Database.connect();
    const featuresDir = path.join(__dirname, 'features');
    featureRegistry.autoLoadFeatures(featuresDir);
    console.log(`📦 Loaded ${featureRegistry.features.size} features`);
}

function getChatId(ctx) {
    return normalizeRecipient(ctx.roomId || ctx.chatId || ctx.sender?.jid || ctx.senderId);
}

function getSenderId(ctx) {
    return normalizeUserJid(ctx.sender?.jid || ctx.senderId);
}

function getText(ctx) {
    return (ctx.text || ctx.body || '').trim();
}

function isDuplicate(ctx) {
    const now = Date.now();
    for (const [key, timestamp] of messageDedupe) {
        if (now - timestamp > DEDUPE_TTL_MS) messageDedupe.delete(key);
    }

    const dedupeKey = `${ctx.uniqueId || ctx.chatId || ''}|${ctx.senderId || ctx.sender?.jid || ''}`;
    if (messageDedupe.has(dedupeKey)) return true;
    messageDedupe.set(dedupeKey, now);
    return false;
}

async function connectToWhatsApp() {
    await initializeBot();

    const client = new Client({
        sessionId: 'el-ruwet',
        authType: 'pairing',
        phoneNumber: process.env.WA_PHONE || config.ownerNumber,
        commandPrefix: ['.', '/'],
        ignoreMe: true,
        qrTerminal: false,
        statusLog: true,
        logger: new (require('pino'))({ level: 'silent' }),
        baileys: { markOnlineOnConnect: true },
        autoConnect: false
    });

    global.client = client;
    global.store = store;

    client.on('pairing-code', ({ code }) => {
        console.log('🔑 Pairing code:', code);
        console.log('📱 Buka WA → Linked Devices → Link with phone number instead');
    });

    client.on('connect', async ({ me }) => {
        console.log('🚀 Bot sudah siap!');
        console.log(`👑 Owner: ${config.ownerNumber}`);
        console.log(`⚙️ Owner Prefix: ${config.ownerPrefix}`);
        console.log(`👤 User Prefix: ${config.userPrefix}`);

        const myJid = normalizeUserJid(me?.id || config.ownerNumber);
        const myName = me?.name || 'Me';
        store.contacts[myJid] = { id: myJid, name: myName };
        console.log('💾 Saved my contact:', myJid, '→', myName);

        if (global.sholatScheduler) global.sholatScheduler.stop();
        global.sholatScheduler = new SholatScheduler(client);
        global.sholatScheduler.start();

        global.greetingsHandler = new GreetingsHandler(client);
    });

    client.on('disconnect', ({ reason, willReconnect }) => {
        console.log('⚠️ Connection closed. Reconnecting:', Boolean(willReconnect), reason || '');
    });

    client.on('group-update', async ({ groupId }) => {
        try {
            const GroupSystem = require('./utils/GroupSystem');
            const registeredGroup = await GroupSystem.get(groupId);
            if (!registeredGroup) return;

            const metadata = await client.group.metadata(groupId);
            const allAdmins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
            for (const adminJid of allAdmins) await GroupSystem.addGroupAdmin(groupId, adminJid);
        } catch (error) {
            console.error('Groups update error:', error.message);
        }
    });

    client.on('group-join', async ({ groupId, participants }) => {
        try {
            if (global.greetingsHandler) await global.greetingsHandler.handleJoin(groupId, participants);
        } catch (error) {
            console.error('Group join error:', error.message);
        }
    });

    client.on('group-leave', async ({ groupId, participants }) => {
        try {
            if (global.greetingsHandler) await global.greetingsHandler.handleLeave(groupId, participants);
        } catch (error) {
            console.error('Group leave error:', error.message);
        }
    });

    client.on('text', async (ctx) => {
        try {
            if (isDuplicate(ctx)) return;
            if (ctx.isFromMe) return;

            const body = getText(ctx);
            const remoteJid = getChatId(ctx);
            const sender = getSenderId(ctx);
            if (!body || !remoteJid || !sender) return;

            ctx.body = body;
            ctx.remoteJid = remoteJid;
            ctx.senderJid = sender;

            if (ctx.senderName || ctx.sender?.pushName) {
                const name = ctx.senderName || ctx.sender.pushName;
                if (!store.contacts[sender] || store.contacts[sender].name !== name) {
                    store.contacts[sender] = { id: sender, name };
                    console.log('[STORE] ✅ Saved/Updated contact:', sender, '→', name);
                }
            }

            setImmediate(() => {
                MessageTracker.addDeletedMessage(remoteJid, {
                    messageId: ctx.uniqueId || ctx.chatId,
                    sender,
                    senderName: ctx.senderName || ctx.sender?.pushName || sender.split('@')[0],
                    text: body,
                    caption: null,
                    mediaType: null,
                    timestamp: Math.floor((ctx.timestamp || Date.now()) / 1000)
                });
            });

            const senderNumber = sender.split('@')[0].replace(/\D/g, '');
            const ownerNumber = String(config.ownerNumber).replace(/\D/g, '');
            const isRealOwner = senderNumber === ownerNumber;
            let isOwner = isRealOwner;
            const isGroup = remoteJid.endsWith('@g.us');

            if (isGroup && !isRealOwner) {
                const GroupSystem = require('./utils/GroupSystem');
                const registeredGroup = await GroupSystem.get(remoteJid);
                if (registeredGroup && await GroupSystem.isGroupAdmin(remoteJid, sender)) isOwner = true;
            }

            if (body === '>next' || body === '<prev') {
                const ytPlayFeature = featureRegistry.get('ytplay');
                if (ytPlayFeature) {
                    if (body === '>next') await ytPlayFeature.handleNext(ctx, client);
                    else await ytPlayFeature.handlePrev(ctx, client);
                    return;
                }
            }

            if (body === '!next' || body === '!prev' || body === '!back') {
                const helpFeature = featureRegistry.get('help');
                if (helpFeature) {
                    if (body === '!next') await helpFeature.handleNext(ctx, client);
                    else if (body === '!prev') await helpFeature.handlePrev(ctx, client);
                    else await helpFeature.handleBack(ctx, client);
                    return;
                }
            }

            if (body.startsWith('!') && body.length > 1) {
                const category = body.substring(1).toLowerCase();
                const helpFeature = featureRegistry.get('help');
                const validCategories = ['admin', 'ai', 'download', 'fun', 'group', 'info', 'media', 'owner', 'tools', 'akademik'];
                if (helpFeature && validCategories.includes(category)) {
                    await helpFeature.handleCategory(ctx, client, category);
                    return;
                }
            }

            const ytPlayFeature = featureRegistry.get('ytplay');
            if (ytPlayFeature && /^\+\d+$/.test(body)) {
                await ytPlayFeature.handleSelection(ctx, client, body.substring(1));
                return;
            }

            const AfkSystem = require('./utils/AfkSystem');
            if (await AfkSystem.isAfk(sender)) {
                const removed = await AfkSystem.removeAfk(sender);
                if (removed) await client.send(remoteJid).text(`*${ctx.senderName || 'User'}* sudah tidak AFK lagi`).mentions([sender]);
            }

            if (body.toLowerCase().startsWith('el ')) {
                const elFeature = featureRegistry.get('el');
                const prompt = body.substring(3).trim();
                if (elFeature && prompt) {
                    await elFeature.execute(ctx, client, prompt.split(' '));
                    return;
                }
            }

            if (body.toLowerCase().startsWith('king ')) {
                const kingFeature = featureRegistry.get('king');
                const prompt = body.substring(5).trim();
                if (kingFeature && prompt) {
                    await kingFeature.execute(ctx, client, prompt.split(' '));
                    return;
                }
            }

            if (isOwner && body.startsWith(config.ownerPrefix)) {
                await commandHandler.handleOwnerCommands(ctx, client);
            } else if (body.startsWith(config.userPrefix)) {
                await commandHandler.handleUserCommands(ctx, client);
            } else {
                await keynoteFeature.handleKeynote(ctx, client);
            }
        } catch (error) {
            console.error('❌ Message Handler Error:', error.message);
        }
    });

    client.on('delete', ({ key }) => {
        console.log('[UNDELETE] Message deleted:', key?.id || key);
    });

    console.log('📞 Pairing phone:', process.env.WA_PHONE || config.ownerNumber);
    await client.connect();
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
