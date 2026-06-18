class BaseFeature {
    constructor(name, description, ownerOnly = false, category = 'tools') {
        this.name = name;
        this.description = description;
        this.ownerOnly = ownerOnly;
        this.category = category;
    }

    async execute(ctx, client, args) {
        throw new Error('Execute method must be implemented');
    }

    async handleError(client, ctx, error) {
        console.error(`[${this.name}] Error:`, error);
        if (typeof ctx.reply === 'function') {
            await ctx.reply(`❌ Terjadi kesalahan pada fitur ${this.name}!`);
        } else {
            const jid = ctx.remoteJid || ctx.roomId || ctx.chatId;
            if (jid) await client.send(jid).text(`❌ Terjadi kesalahan pada fitur ${this.name}!`);
        }
    }
}

module.exports = BaseFeature;
