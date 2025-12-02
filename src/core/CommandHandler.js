const config = require('../config/config');
const featureRegistry = require('./FeatureRegistry');
const KeynoteFeature = require('../features/KeynoteFeature');

class CommandHandler {
    constructor() {
        this.keynoteFeature = new KeynoteFeature();
    }

    async handleOwnerCommands(m, sock) {
        try {
            const body = this.getMessageText(m);
            const command = body.slice(config.ownerPrefix.length).trim().split(' ')[0];
            const args = body.split(' ').slice(1);

            // Check keynote first
            if (await this.keynoteFeature.handleKeynote(m, sock)) return;

            // Handle special owner commands
            if (command === 'setprefix') {
                await this.handleSetPrefix(m, sock, args);
                return;
            }

            if (command === 'setkeyprefix') {
                await this.keynoteFeature.setKeynotePrefix(m, sock, args);
                return;
            }

            if (command === 'useprefixnote') {
                await this.keynoteFeature.setUseKeynotePrefix(m, sock, args);
                return;
            }

            // Execute registered feature
            const feature = featureRegistry.get(command);
            if (feature) {
                await feature.execute(m, sock, args);
            } else {
                console.log(`[UNKNOWN CMD] Owner: /${command}`);
            }

        } catch (error) {
            console.error('Owner Command Error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Terjadi kesalahan!' });
        }
    }

    async handleUserCommands(m, sock) {
        try {
            const body = this.getMessageText(m);
            const command = body.slice(config.userPrefix.length).trim().split(' ')[0];
            const args = body.split(' ').slice(1);

            // Check keynote first
            if (await this.keynoteFeature.handleKeynote(m, sock)) return;

            // Execute registered feature
            const feature = featureRegistry.get(command);
            if (feature && !feature.ownerOnly) {
                await feature.execute(m, sock, args);
            } else {
                console.log(`[UNKNOWN CMD] User: .${command}`);
            }

        } catch (error) {
            console.error('User Command Error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Terjadi kesalahan!' });
        }
    }

    async handleSetPrefix(m, sock, args) {
        try {
            if (args[0] === 'owner') {
                config.setOwnerPrefix(args[1]);
                await sock.sendMessage(m.key.remoteJid, { text: '✅ Owner prefix updated!' });
            } else if (args[0] === 'user') {
                config.setUserPrefix(args[1]);
                await sock.sendMessage(m.key.remoteJid, { text: '✅ User prefix updated!' });
            } else if (args[0] === 'reset') {
                config.reset();
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '✅ Prefixes reset to default!\n' +
                          `*Owner Prefix:* ${config.ownerPrefix}\n` +
                          `*User Prefix:* ${config.userPrefix}`
                });
            } else {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Format: !setprefix [owner/user/reset] [newPrefix]\n' +
                          'Contoh: !setprefix owner /'
                });
            }
        } catch (error) {
            console.error('SetPrefix Error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Gagal mengubah prefix!' });
        }
    }

    getMessageText(m) {
        return m.message.conversation || 
               m.message.extendedTextMessage?.text || 
               m.message.imageMessage?.caption || 
               m.message.videoMessage?.caption || '';
    }
}

module.exports = new CommandHandler();
