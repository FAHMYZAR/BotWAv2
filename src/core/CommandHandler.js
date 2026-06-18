const config = require('../config/config');
const featureRegistry = require('./FeatureRegistry');
const KeynoteFeature = require('../features/KeynoteFeature');

class CommandHandler {
    constructor() {
        this.keynoteFeature = new KeynoteFeature();
    }

    async handleOwnerCommands(ctx, client) {
        try {
            const body = this.getMessageText(ctx);
            const command = body.slice(config.ownerPrefix.length).trim().split(' ')[0];
            const args = body.split(' ').slice(1);

            if (await this.keynoteFeature.handleKeynote(ctx, client)) return;

            if (command === 'setprefix') {
                await this.handleSetPrefix(ctx, client, args);
                return;
            }

            if (command === 'setkeyprefix') {
                await this.keynoteFeature.setKeynotePrefix(ctx, client, args);
                return;
            }

            if (command === 'useprefixnote') {
                await this.keynoteFeature.setUseKeynotePrefix(ctx, client, args);
                return;
            }

            const feature = featureRegistry.get(command);
            if (feature) {
                await feature.execute(ctx, client, args);
            } else {
                console.log(`[UNKNOWN CMD] Owner: /${command}`);
            }
        } catch (error) {
            console.error('Owner Command Error:', error);
            await this.reply(client, ctx, '❌ Terjadi kesalahan!');
        }
    }

    async handleUserCommands(ctx, client) {
        try {
            const body = this.getMessageText(ctx);
            const command = body.slice(config.userPrefix.length).trim().split(' ')[0];
            const args = body.split(' ').slice(1);

            if (await this.keynoteFeature.handleKeynote(ctx, client)) return;

            const feature = featureRegistry.get(command);
            if (feature && !feature.ownerOnly) {
                if (feature.category === 'admin') {
                    await this.reply(client, ctx, `❌ Fitur admin harus menggunakan prefix ${config.ownerPrefix}\n\nContoh: ${config.ownerPrefix}${command}`);
                    return;
                }
                await feature.execute(ctx, client, args);
            } else {
                console.log(`[UNKNOWN CMD] User: .${command}`);
            }
        } catch (error) {
            console.error('User Command Error:', error);
            await this.reply(client, ctx, '❌ Terjadi kesalahan!');
        }
    }

    async handleSetPrefix(ctx, client, args) {
        try {
            if (args[0] === 'owner') {
                config.setOwnerPrefix(args[1]);
                await this.reply(client, ctx, '✅ Owner prefix updated!');
            } else if (args[0] === 'user') {
                config.setUserPrefix(args[1]);
                await this.reply(client, ctx, '✅ User prefix updated!');
            } else if (args[0] === 'reset') {
                config.reset();
                await this.reply(client, ctx, '✅ Prefixes reset to default!\n' +
                    `*Owner Prefix:* ${config.ownerPrefix}\n` +
                    `*User Prefix:* ${config.userPrefix}`);
            } else {
                await this.reply(client, ctx, '❌ Format: !setprefix [owner/user/reset] [newPrefix]\n' +
                    'Contoh: !setprefix owner /');
            }
        } catch (error) {
            console.error('SetPrefix Error:', error);
            await this.reply(client, ctx, '❌ Gagal mengubah prefix!');
        }
    }

    getMessageText(ctx) {
        return ctx.body || ctx.text || '';
    }

    async reply(client, ctx, text) {
        if (typeof ctx.reply === 'function') return ctx.reply(text);
        return client.send(ctx.remoteJid || ctx.roomId || ctx.chatId).text(text);
    }
}

module.exports = new CommandHandler();
