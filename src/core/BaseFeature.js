class BaseFeature {
    constructor(name, description, ownerOnly = false) {
        this.name = name;
        this.description = description;
        this.ownerOnly = ownerOnly;
    }

    async execute(message, chat, args) {
        throw new Error('Execute method must be implemented');
    }

    async handleError(chat, error) {
        console.error(`[${this.name}] Error:`, error);
        await chat.sendMessage(`❌ Terjadi kesalahan pada fitur ${this.name}!`);
    }
}

module.exports = BaseFeature;
