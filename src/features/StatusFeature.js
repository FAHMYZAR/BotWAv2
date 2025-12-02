const BaseFeature = require('../core/BaseFeature');
const SystemHelper = require('../utils/SystemHelper');
const { prepareWAMessageMedia, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const os = require('os');

class StatusFeature extends BaseFeature {
    constructor() {
        super('status', 'Tampilkan status system', false);
    }

    async execute(m, sock, args) {
        try {
            const uptime = SystemHelper.getUptime();
            const memory = SystemHelper.getMemoryInfo();
            const cpu = SystemHelper.getCPUInfo();
            const osInfo = SystemHelper.getOSInfo();
            const hostname = SystemHelper.getHostname();
            const loadAvg = SystemHelper.getLoadAverage();
            const network = SystemHelper.getNetworkInfo();
            const disk = await SystemHelper.getDiskUsage();
            const cpuTemp = await SystemHelper.getCPUTemp();
            const projectPath = path.join(__dirname, '../../');
            const projectSize = await SystemHelper.getProjectSize(projectPath);

            const bannerPath = path.join(__dirname, '../../disk/welcome.jpg');
            const bannerBuffer = fs.readFileSync(bannerPath);

            let statusText = 
                `*BOT STATUS*\n\n` +
                `*💻 SYSTEM*\n` +
                `> Hostname: \`${hostname}\`\n` +
                `> Platform: \`${osInfo.type} ${osInfo.release}\`\n` +
                `> Arch: \`${osInfo.arch}\`\n` +
                `> Node: \`${osInfo.nodeVersion}\`\n\n` +
                `*UPTIME*\n` +
                `> Bot: \`${uptime.hours}h ${uptime.minutes}m ${uptime.seconds}s\`\n` +
                `> System: \`${(os.uptime() / 3600).toFixed(1)}h\`\n\n` +
                `*CPU*\n` +
                `> Model: \`${cpu.model.substring(0, 30)}...\`\n` +
                `> Cores: \`${cpu.cores}\`\n` +
                `> Temp: \`${cpuTemp}\`\n` +
                `> Load: \`${loadAvg['1min']} | ${loadAvg['5min']} | ${loadAvg['15min']}\`\n\n` +
                `*MEMORY*\n` +
                `> Process: \`${memory.process.heapUsed}/${memory.process.heapTotal} MB\`\n` +
                `> System: \`${memory.system.used}/${memory.system.total} GB (${((memory.system.used/memory.system.total)*100).toFixed(1)}%)\`\n` +
                `> Free: \`${memory.system.free} GB\`\n\n` +
                `*DISK*\n` +
                `> Total: \`${disk.total}\`\n` +
                `> Used: \`${disk.used} (${disk.percent})\`\n` +
                `> Free: \`${disk.free}\`\n\n` +
                `*STORAGE*\n` +
                `> Project: \`${projectSize} MB\`\n\n`;

            if (network.length > 0) {
                statusText += `*🌐 NETWORK*\n`;
                network.forEach(net => {
                    statusText += `> ${net.name}: \`${net.ip}\`\n`;
                });
                statusText += `\n`;
            }

            statusText += `_🔥 FAHMYZZX-BOT © ${new Date().getFullYear()}_`;

            await sock.sendMessage(m.key.remoteJid, {
                image: bannerBuffer,
                caption: statusText
            });

        } catch (error) {
            await this.handleError(m, sock, error);
        }
    }

    async handleError(m, sock, error) {
        console.error(`${this.name} error:`, error);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Terjadi kesalahan!' });
    }
}

module.exports = StatusFeature;
