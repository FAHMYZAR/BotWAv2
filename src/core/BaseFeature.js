class BaseFeature {
    constructor(name, description, ownerOnly = false, category = 'tools') {
        this.name = name;
        this.description = description;
        this.ownerOnly = ownerOnly;
        this.category = category;
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
