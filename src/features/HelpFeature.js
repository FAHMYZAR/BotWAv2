const BaseFeature = require('../core/BaseFeature');
const SystemHelper = require('../utils/SystemHelper');
const config = require('../config/config');
const featureRegistry = require('../core/FeatureRegistry');
const { normalizeUserJid } = require('../utils/JidHelper');
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

    async execute(ctx, client, args) {
        try {
            const userId = ctx.senderId;
            const groupId = ctx.roomId;
            
            const cooldownKey = `${userId}_${groupId}`;
            const now = Date.now();
            const cooldownTime = 3000;
            
            if (this.cooldowns.has(cooldownKey)) {
                const lastUsed = this.cooldowns.get(cooldownKey);
                const timeLeft = cooldownTime - (now - lastUsed);
                
                if (timeLeft > 0) {
                    await ctx.reply(`⏳ Tunggu ${Math.ceil(timeLeft/1000)} detik lagi...`);
                    return;
                }
            }
            
            this.cooldowns.set(cooldownKey, now);
            
            if (!groupId.endsWith('@g.us')) {
                this.deleteMessage(client, groupId, ctx.key).catch(() => {});
            }
            
            this.sessionCache.set(userId, {
                view: 'main',
                category: null,
                page: 0,
                messageKey: null
            });
            
            await this.showMainMenu(ctx, client, userId);

        } catch (error) {
            console.error('[HELP] Execute error:', error);
            await this.handleError(client, ctx, error);
        }
    }

    async showMainMenu(ctx, client, userId) {
        const session = this.sessionCache.get(userId);
        if (!session) return;
        
        this.deleteOldMessage(client, ctx.roomId, session.messageKey).catch(() => {});
        
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
        
        try {
            let sent;
            if (this.thumbnail) {
                sent = await client.send(ctx.roomId).image(this.thumbnail, { caption: caption });
            } else {
                sent = await client.send(ctx.roomId).text(caption);
            }
            session.messageKey = sent.key;
            session.view = 'main';
        } catch (error) {
            try {
                if (userId !== ctx.roomId) {
                    const sent = await client.send(userId).text(`⚠️ Gagal kirim menu di grup, ini menu via DM:\n\n${caption}`);
                    session.messageKey = sent.key;
                }
            } catch (dmError) {
                throw error;
            }
        }
    }
    
    async showCategoryMenu(ctx, client, userId, category) {
        const session = this.sessionCache.get(userId);
        if (!session) return;
        
        await this.deleteOldMessage(client, ctx.roomId, session.messageKey);
        
        const commands = this.getCommandsByCategory(category);
        if (!commands.length) return;
        
        const itemsPerPage = 10;
        const totalPages = Math.ceil(commands.length / itemsPerPage);
        const page = session.page;
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageCommands = commands.slice(start, end);
        
        const sender = normalizeUserJid(ctx.senderId);
        const ownerJid = normalizeUserJid(config.ownerNumber);
        const isOwner = ctx.isFromMe || sender === ownerJid;
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
        
        const sent = await client.send(ctx.roomId).text(caption);
        
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
    
    async deleteOldMessage(client, chatId, messageKey) {
        if (messageKey) {
            try {
                await client.send(chatId).delete(messageKey);
            } catch (e) {}
        }
    }
    
    async deleteMessage(client, chatId, messageKey) {
        try {
            await client.send(chatId).delete(messageKey);
        } catch (e) {}
    }

    async handleNext(ctx, client) {
        const userId = ctx.senderId;
        const session = this.sessionCache.get(userId);
        
        if (!session || session.view !== 'category') return;
        
        await this.deleteMessage(client, ctx.roomId, ctx.key);
        
        const commands = this.getCommandsByCategory(session.category);
        const totalPages = Math.ceil(commands.length / 10);
        
        if (session.page >= totalPages - 1) return;
        
        session.page++;
        await this.showCategoryMenu(ctx, client, userId, session.category);
    }
    
    async handlePrev(ctx, client) {
        const userId = ctx.senderId;
        const session = this.sessionCache.get(userId);
        
        if (!session || session.view !== 'category') return;
        
        await this.deleteMessage(client, ctx.roomId, ctx.key);
        
        if (session.page <= 0) return;
        
        session.page--;
        await this.showCategoryMenu(ctx, client, userId, session.category);
    }
    
    async handleBack(ctx, client) {
        const userId = ctx.senderId;
        const session = this.sessionCache.get(userId);
        
        if (!session) return;
        
        await this.deleteMessage(client, ctx.roomId, ctx.key);
        
        session.page = 0;
        session.category = null;
        await this.showMainMenu(ctx, client, userId);
    }
    
    async handleCategory(ctx, client, category) {
        const userId = ctx.senderId;
        let session = this.sessionCache.get(userId);
        
        if (!session) {
            session = {
                view: 'main',
                category: null,
                page: 0,
                messageKey: null
            };
            this.sessionCache.set(userId, session);
        }
        
        await this.deleteMessage(client, ctx.roomId, ctx.key);
        
        const categories = this.getCategories();
        if (!categories[category]) return;
        
        session.page = 0;
        await this.showCategoryMenu(ctx, client, userId, category);
    }
}

module.exports = HelpFeature;
