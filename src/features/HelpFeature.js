const BaseFeature = require('../core/BaseFeature');
const SystemHelper = require('../utils/SystemHelper');
const config = require('../config/config');
const featureRegistry = require('../core/FeatureRegistry');
const fs = require('fs');
const path = require('path');

class HelpFeature extends BaseFeature {
    constructor() {
        super('help', 'Tampilkan menu bantuan', false, 'info');
        this.sessionCache = new Map();
        this.cooldowns = new Map();
        this.thumbnail = null;
        this.loadThumbnail().then(thumb => this.thumbnail = thumb);
    }

    async loadThumbnail() {
        try {
            const imgPath = path.join(__dirname, '../../disk/welcome.png');
            if (fs.existsSync(imgPath)) {
                return fs.readFileSync(imgPath);
            }
        } catch (e) {
            console.log('Thumbnail error:', e.message);
        }
        return null;
    }

    async execute(m, sock, args) {
        try {
            const userId = m.key.participant || m.key.remoteJid;
            const groupId = m.key.remoteJid;
            
            console.log(`[HELP] Command from ${userId} in ${groupId}`);
            
            // Check cooldown (3 seconds per user)
            const cooldownKey = `${userId}_${groupId}`;
            const now = Date.now();
            const cooldownTime = 3000; // 3 detik
            
            if (this.cooldowns.has(cooldownKey)) {
                const lastUsed = this.cooldowns.get(cooldownKey);
                const timeLeft = cooldownTime - (now - lastUsed);
                
                if (timeLeft > 0) {
                    console.log(`[HELP] Cooldown active for ${userId}, ${Math.ceil(timeLeft/1000)}s left`);
                    await sock.sendMessage(groupId, {
                        text: `⏳ Tunggu ${Math.ceil(timeLeft/1000)} detik lagi...`
                    });
                    return;
                }
            }
            
            this.cooldowns.set(cooldownKey, now);
            
            // Jangan delete command message di group (prevent rate limit)
            if (!groupId.endsWith('@g.us')) {
                this.deleteMessage(sock, groupId, m.key).catch(e => 
                    console.log('[HELP] Delete failed:', e.message)
                );
            }
            
            // Initialize session
            this.sessionCache.set(userId, {
                view: 'main',
                category: null,
                page: 0,
                messageKey: null,
                commandMessageKey: null
            });
            
            await this.showMainMenu(m, sock, userId);

        } catch (error) {
            console.error('[HELP] Execute error:', error);
            await this.handleError(m, sock, error);
        }
    }

    async showMainMenu(m, sock, userId) {
        const session = this.sessionCache.get(userId);
        if (!session) {
            console.log('[HELP] No session found for', userId);
            return;
        }
        
        // Delete old message (non-blocking)
        this.deleteOldMessage(sock, m.key.remoteJid, session.messageKey).catch(e => 
            console.log('[HELP] Delete old message failed:', e.message)
        );
        
        const memory = SystemHelper.getMemoryInfo();
        const cpu = SystemHelper.getCPUInfo();
        const categories = this.getCategories();
        
        let caption = `*MENU UTAMA*\n\n`;
        caption += `*Status:* Active\n`;
        caption += `*Memory:* ${memory.process.heapUsed}/${memory.process.heapTotal} MB\n`;
        caption += `*CPU:* ${cpu.usage}% (${cpu.cores} cores)\n\n`;
        caption += `*KATEGORI FITUR:*\n\n`;

        
        for (const [key, data] of Object.entries(categories)) {
            caption += `▸ \`!${key}\` - ${data.name} (${data.count})\n`;
        }
        
        caption += `\n_💡 Ketik Misal : \`!tools\` untuk masuk salah satu menu_`;
        
        let sent;
        try {
            if (this.thumbnail) {
                sent = await sock.sendMessage(m.key.remoteJid, {
                    image: this.thumbnail,
                    caption: caption
                });
            } else {
                sent = await sock.sendMessage(m.key.remoteJid, {
                    text: caption
                });
            }
            
            session.messageKey = sent.key;
            session.view = 'main';
            console.log('[HELP] Menu sent to', userId);
        } catch (error) {
            console.error('[HELP] Send to group failed:', error.message);
            
            // Fallback: kirim ke DM user
            try {
                const userJid = userId.includes('@g.us') ? userId : userId;
                if (userJid !== m.key.remoteJid) {
                    console.log('[HELP] Trying to send to user DM:', userJid);
                    sent = await sock.sendMessage(userJid, {
                        text: `⚠️ Gagal kirim menu di grup, ini menu via DM:\n\n${caption}`
                    });
                    console.log('[HELP] Menu sent to user DM');
                } else {
                    throw error;
                }
            } catch (dmError) {
                console.error('[HELP] DM fallback also failed:', dmError.message);
                throw error;
            }
        }
    }
    
    async showCategoryMenu(m, sock, userId, category) {
        const session = this.sessionCache.get(userId);
        if (!session) return;
        
        await this.deleteOldMessage(sock, m.key.remoteJid, session.messageKey);
        
        const commands = this.getCommandsByCategory(category);
        if (!commands.length) return;
        
        const itemsPerPage = 10;
        const totalPages = Math.ceil(commands.length / itemsPerPage);
        const page = session.page;
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageCommands = commands.slice(start, end);
        
        const sender = m.key.participant || m.key.remoteJid;
        const isOwner = m.key.fromMe || sender.replace('@s.whatsapp.net', '') === config.ownerNumber;
        const prefix = isOwner ? config.ownerPrefix : config.userPrefix;
        
        const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
        
        let caption = `*${categoryName.toUpperCase()}*\n\n`;
        caption += `*Halaman ${page + 1}/${totalPages}* | *Total: ${commands.length}*\n\n`;

        
        pageCommands.forEach((cmd, i) => {
            caption += `*${start + i + 1}.* \`${prefix}${cmd.cmd}\`\n   ${cmd.desc}\n\n`;
        });
        
        caption += `*🔄 Navigasi:*\n`;
        if (page > 0) caption += `▸ \`!prev\` - Halaman sebelumnya\n`;
        if (page < totalPages - 1) caption += `▸ \`!next\` - Halaman selanjutnya\n`;
        caption += `▸ \`!back\` - Kembali ke menu utama`;
        
        const sent = await sock.sendMessage(m.key.remoteJid, {
            text: caption
        });
        
        session.messageKey = sent.key;
        session.view = 'category';
        session.category = category;
    }
    
    getCategories() {
        const allCommands = featureRegistry.getAll();
        const categories = {};
        
        allCommands.forEach(cmd => {
            const cat = cmd.category || 'tools';
            if (!categories[cat]) {
                categories[cat] = {
                    name: cat.charAt(0).toUpperCase() + cat.slice(1),
                    count: 0
                };
            }
            categories[cat].count++;
        });
        
        // Sort alphabetically, admin first
        const sorted = Object.entries(categories)
            .sort(([a], [b]) => {
                if (a === 'admin') return -1;
                if (b === 'admin') return 1;
                return a.localeCompare(b);
            });
        
        return Object.fromEntries(sorted);
    }
    
    getCommandsByCategory(category) {
        const allCommands = featureRegistry.getAll();
        return allCommands
            .filter(c => (c.category || 'tools') === category)
            .sort((a, b) => a.cmd.localeCompare(b.cmd));
    }
    
    async deleteOldMessage(sock, chatId, messageKey) {
        if (messageKey) {
            try {
                await sock.sendMessage(chatId, { delete: messageKey });
            } catch (e) {
                // Ignore
            }
        }
    }
    
    async deleteMessage(sock, chatId, messageKey) {
        try {
            await sock.sendMessage(chatId, { delete: messageKey });
        } catch (e) {
            // Ignore
        }
    }

    async handleNext(m, sock) {
        const userId = m.key.participant || m.key.remoteJid;
        const session = this.sessionCache.get(userId);
        
        if (!session || session.view !== 'category') return;
        
        await this.deleteMessage(sock, m.key.remoteJid, m.key);
        
        const commands = this.getCommandsByCategory(session.category);
        const totalPages = Math.ceil(commands.length / 10);
        
        if (session.page >= totalPages - 1) return;
        
        session.page++;
        await this.showCategoryMenu(m, sock, userId, session.category);
    }
    
    async handlePrev(m, sock) {
        const userId = m.key.participant || m.key.remoteJid;
        const session = this.sessionCache.get(userId);
        
        if (!session || session.view !== 'category') return;
        
        await this.deleteMessage(sock, m.key.remoteJid, m.key);
        
        if (session.page <= 0) return;
        
        session.page--;
        await this.showCategoryMenu(m, sock, userId, session.category);
    }
    
    async handleBack(m, sock) {
        const userId = m.key.participant || m.key.remoteJid;
        const session = this.sessionCache.get(userId);
        
        if (!session) return;
        
        await this.deleteMessage(sock, m.key.remoteJid, m.key);
        
        session.page = 0;
        session.category = null;
        await this.showMainMenu(m, sock, userId);
    }
    
    async handleCategory(m, sock, category) {
        const userId = m.key.participant || m.key.remoteJid;
        let session = this.sessionCache.get(userId);
        
        if (!session) {
            session = {
                view: 'main',
                category: null,
                page: 0,
                messageKey: null,
                commandMessageKey: null
            };
            this.sessionCache.set(userId, session);
        }
        
        await this.deleteMessage(sock, m.key.remoteJid, m.key);
        
        const categories = this.getCategories();
        if (!categories[category]) return;
        
        session.page = 0;
        await this.showCategoryMenu(m, sock, userId, category);
    }

    async handleError(m, sock, error) {
        console.error(`${this.name} error:`, error);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Terjadi kesalahan!' });
    }
}

module.exports = HelpFeature;
