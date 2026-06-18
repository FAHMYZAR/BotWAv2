function stripDevice(jid = '') {
    return String(jid).split(':')[0];
}

function hasJidSuffix(value = '') {
    return /@(s\.whatsapp\.net|g\.us|lid|newsletter|broadcast|c\.us)$/.test(stripDevice(value));
}

function isGroupJid(jid = '') {
    return stripDevice(jid).endsWith('@g.us');
}

function isUserJid(jid = '') {
    const value = stripDevice(jid);
    return value.endsWith('@s.whatsapp.net') || value.endsWith('@c.us');
}

function isLidJid(jid = '') {
    return stripDevice(jid).endsWith('@lid');
}

function digitsOnly(value = '') {
    return String(value).replace(/\D/g, '');
}

function normalizeUserJid(input = '') {
    const value = stripDevice(input).trim();
    if (!value) return '';
    if (value.endsWith('@s.whatsapp.net')) return value;
    if (value.endsWith('@c.us')) return `${value.split('@')[0]}@s.whatsapp.net`;
    if (value.endsWith('@lid')) return value;
    const digits = digitsOnly(value);
    return digits ? `${digits}@s.whatsapp.net` : '';
}

function normalizeRecipient(input = '') {
    const value = stripDevice(input).trim();
    if (!value) return '';
    if (value.endsWith('@g.us') || value.endsWith('@newsletter') || value.endsWith('@broadcast') || value.endsWith('@lid')) return value;
    if (value.endsWith('@s.whatsapp.net')) return value;
    if (value.endsWith('@c.us')) return `${value.split('@')[0]}@s.whatsapp.net`;
    if (hasJidSuffix(value)) return value;
    return normalizeUserJid(value);
}

function getChatJidFromMessage(m = {}) {
    return normalizeRecipient(m.key?.remoteJid || '');
}

function getSenderJidFromMessage(m = {}) {
    return normalizeUserJid(m.key?.participant || m.key?.remoteJid || '');
}

module.exports = {
    stripDevice,
    hasJidSuffix,
    isGroupJid,
    isUserJid,
    isLidJid,
    normalizeUserJid,
    normalizeRecipient,
    getChatJidFromMessage,
    getSenderJidFromMessage
};
