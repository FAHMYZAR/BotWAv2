const BaseFeature = require('../core/BaseFeature');
const SystemHelper = require('../utils/SystemHelper');
const config = require('../config/config');
const featureRegistry = require('../core/FeatureRegistry');
const fs = require('fs');
const path = require('path');

class HelpFeature extends BaseFeature {
    constructor() {
        super('help', 'Tampilkan menu bantuan', false);
        this.pageCache = new Map();
        this.commandCache = new Map();
        this.messageCache = new Map();
    }

    async execute(m, sock, args) {
        try {
            const sender = m.key.participant || m.key.remoteJid;
            const isOwner = m.key.fromMe || sender.replace('@s.whatsapp.net', '') === config.ownerNumber;
            const prefix = isOwner ? config.ownerPrefix : config.userPrefix;
            
            const commandList = isOwner 
                ? featureRegistry.getAll()
                : featureRegistry.getUserCommands();

            // Sort alphabetically
            const sortedCommands = commandList.sort((a, b) => a.cmd.localeCompare(b.cmd));

            const userId = m.key.participant || m.key.remoteJid;
            this.commandCache.set(userId, { commands: sortedCommands, prefix, isOwner });
            this.pageCache.set(userId, 0);

            await this.showPage(m, sock, userId, 0, true);

        } catch (error) {
            await this.handleError(m, sock, error);
        }
    }

    async showPage(m, sock, userId, page, isNew = false) {
        const cache = this.commandCache.get(userId);
        if (!cache) return;

        const { commands, prefix, isOwner } = cache;
        const itemsPerPage = 10;
        const totalPages = Math.ceil(commands.length / itemsPerPage);
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageCommands = commands.slice(start, end);

        const memory = SystemHelper.getMemoryInfo();
        const cpu = SystemHelper.getCPUInfo();

        let caption = `*Halo!* 👋\n`;
        caption += `*Status:* Active ✅\n`;
        caption += `*Memory:* ${memory.process.heapUsed} / ${memory.process.heapTotal} MB | *CPU:* ${cpu.usage}% (${cpu.cores} cores)\n\n`;
        caption += `*Fitur Tersedia:* (Page ${page + 1}/${totalPages})\n\n`;

        const entries = pageCommands
            .map(c => `• \`${prefix}${c.cmd}\` - ${c.desc}`)
            .join('\n');
        
        caption += entries || '• Tidak ada fitur terdaftar.';

        if (totalPages > 1) {
            caption += '\n\n*Navigation:*\n';
            if (page < totalPages - 1) caption += '> `!next` - Next page\n';
            if (page > 0) caption += '> `!prev` - Previous page';
        }
        
        const messagePayload = {
            text: caption,
            contextInfo: {
                externalAdReply: {
                    title: 'FAHMYZZX-BOT',
                    body: 'Gunakan Dengan Bijak Yaa..!',
                    thumbnailUrl: 'https://files.catbox.moe/3gwrle.jpg',
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        };

        if (!isNew) {
            const messageKey = this.messageCache.get(userId);
            if (messageKey) {
                try {
                    await sock.sendMessage(m.key.remoteJid, {
                        delete: messageKey
                    });
                } catch (e) {
                    // Ignore delete error
                }
            }
        }

        const sent = await sock.sendMessage(m.key.remoteJid, messagePayload);
        this.messageCache.set(userId, sent.key);

        this.pageCache.set(userId, page);
    }

    async handleNext(m, sock) {
        const userId = m.key.participant || m.key.remoteJid;
        const currentPage = this.pageCache.get(userId) || 0;
        const cache = this.commandCache.get(userId);

        if (!cache) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Help menu sudah expired. Ketik /help atau .help lagi' 
            });
            return;
        }

        const totalPages = Math.ceil(cache.commands.length / 10);
        if (currentPage >= totalPages - 1) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Sudah di halaman terakhir!' 
            });
            return;
        }

        await this.showPage(m, sock, userId, currentPage + 1, false);
    }

    async handlePrev(m, sock) {
        const userId = m.key.participant || m.key.remoteJid;
        const currentPage = this.pageCache.get(userId) || 0;
        const cache = this.commandCache.get(userId);

        if (!cache) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Help menu sudah expired. Ketik /help atau .help lagi' 
            });
            return;
        }

        if (currentPage <= 0) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Sudah di halaman pertama!' 
            });
            return;
        }

        await this.showPage(m, sock, userId, currentPage - 1, false);
    }

    async handleError(m, sock, error) {
        console.error(`${this.name} error:`, error);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Terjadi kesalahan!' });
    }
}

module.exports = HelpFeature;
