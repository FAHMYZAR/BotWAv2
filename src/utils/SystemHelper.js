const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class SystemHelper {
    static getUptime() {
        const uptime = process.uptime();
        return {
            hours: Math.floor(uptime / 3600),
            minutes: Math.floor((uptime % 3600) / 60),
            seconds: Math.floor(uptime % 60)
        };
    }

    static getMemoryInfo() {
        const processMemory = process.memoryUsage();
        return {
            process: {
                heapUsed: (processMemory.heapUsed / 1024 / 1024).toFixed(2),
                heapTotal: (processMemory.heapTotal / 1024 / 1024).toFixed(2)
            },
            system: {
                total: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
                free: (os.freemem() / 1024 / 1024 / 1024).toFixed(2),
                used: ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2)
            }
        };
    }

    static getCPUInfo() {
        const cpus = os.cpus();
        const cpuUsage = process.cpuUsage();
        return {
            model: cpus[0]?.model || 'Unknown',
            cores: cpus.length,
            usage: ((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(2)
        };
    }

    static getOSInfo() {
        return {
            platform: process.platform,
            release: os.release(),
            arch: os.arch(),
            type: os.type(),
            nodeVersion: process.version
        };
    }

    static async getProjectSize(projectPath) {
        try {
            const getAllFiles = (dirPath) => {
                let size = 0;
                const files = fs.readdirSync(dirPath);
                
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const stat = fs.statSync(filePath);
                    
                    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                        size += getAllFiles(filePath);
                    } else if (stat.isFile()) {
                        size += stat.size;
                    }
                }
                return size;
            };

            return (getAllFiles(projectPath) / (1024 * 1024)).toFixed(2);
        } catch (error) {
            console.error('Error calculating project size:', error);
            return '0';
        }
    }

    static formatBytes(bytes) {
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    static getHostname() {
        return os.hostname();
    }

    static getLoadAverage() {
        const load = os.loadavg();
        return {
            '1min': load[0].toFixed(2),
            '5min': load[1].toFixed(2),
            '15min': load[2].toFixed(2)
        };
    }

    static getNetworkInfo() {
        const interfaces = os.networkInterfaces();
        const active = [];
        for (const [name, nets] of Object.entries(interfaces)) {
            for (const net of nets) {
                if (!net.internal && net.family === 'IPv4') {
                    active.push({ name, ip: net.address });
                }
            }
        }
        return active;
    }

    static async getDiskUsage() {
        return new Promise((resolve) => {
            if (process.platform === 'win32') {
                resolve({ total: 'N/A', used: 'N/A', free: 'N/A', percent: 'N/A' });
                return;
            }
            exec('df -h / | tail -1', (error, stdout) => {
                if (error) {
                    resolve({ total: 'N/A', used: 'N/A', free: 'N/A', percent: 'N/A' });
                    return;
                }
                const parts = stdout.trim().split(/\s+/);
                resolve({
                    total: parts[1],
                    used: parts[2],
                    free: parts[3],
                    percent: parts[4]
                });
            });
        });
    }

    static async getCPUTemp() {
        return new Promise((resolve) => {
            if (process.platform === 'win32') {
                resolve('N/A');
                return;
            }
            exec('cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || sensors 2>/dev/null | grep "Core 0" | awk \'{print $3}\' | head -1', (error, stdout) => {
                if (error || !stdout) {
                    resolve('N/A');
                    return;
                }
                const temp = stdout.trim();
                if (temp.length < 10 && !isNaN(temp)) {
                    resolve((parseInt(temp) / 1000).toFixed(1) + '°C');
                } else {
                    resolve(temp.replace('+', ''));
                }
            });
        });
    }
}

module.exports = SystemHelper;
