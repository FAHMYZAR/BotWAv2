const config = require('../config/config');
const ProtectionSystem = require('./ProtectionSystem');
const { normalizeUserJid, stripDevice } = require('./JidHelper');

class AdminHelper {
    static async isGroupAdmin(client, groupId, userId) {
        try {
            const target = normalizeUserJid(userId);
            const metadata = await client.group.metadata(groupId);
            const participant = metadata.participants.find(p => normalizeUserJid(p.id) === target || p.id === userId);
            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        } catch (error) {
            console.error('isGroupAdmin error:', error);
            return false;
        }
    }

    static async isBotAdmin(client, groupId) {
        try {
            const metadata = await client.group.metadata(groupId);
            const botId = normalizeUserJid(client.user?.id || client.me?.id || '');
            const participant = metadata.participants.find(p => normalizeUserJid(p.id) === botId);
            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        } catch (error) {
            return false;
        }
    }

    static async isBotJid(client, userId, groupId) {
        const botJid = client.user?.id || client.me?.id;
        if (!botJid) {
            console.log('[BOT CHECK] ❌ No client.user.id');
            return false;
        }
        
        // Reload data from JSON
        const data = ProtectionSystem.data;
        
        // Check if userId is in protectedJids (for @lid format)
        if (data.jids && data.jids.includes(userId)) {
            console.log('[BOT CHECK]');
            console.log('  Target JID:', userId);
            console.log('  Matched in protectedJids (bot @lid)');
            console.log('  Is Bot: ✅ YES');
            return true;
        }
        
        const botNumber = botJid.split(':')[0];
        const targetNumber = userId
            .replace('@s.whatsapp.net', '')
            .replace('@c.us', '')
            .replace('@lid', '')
            .split(':')[0]
            .split('@')[0];
        
        // Check by number first
        let isBot = botNumber === targetNumber || targetNumber.includes(botNumber) || botNumber.includes(targetNumber);
        
        // If not bot by number and groupId provided, check all bot JIDs in group
        if (!isBot && groupId) {
            try {
                const metadata = await client.group.metadata(groupId);
                console.log('[BOT CHECK] All participants:', metadata.participants.map(p => p.id));
                
                const botJids = metadata.participants
                    .filter(p => {
                        const pNumber = p.id.replace('@lid', '').replace('@s.whatsapp.net', '').replace('@c.us', '').split(':')[0].split('@')[0];
                        console.log('[BOT CHECK] Checking participant:', p.id, '-> number:', pNumber, 'vs bot:', botNumber);
                        return pNumber === botNumber;
                    })
                    .map(p => p.id);
                
                isBot = botJids.includes(userId);
                console.log('[BOT CHECK] Bot JIDs in group:', botJids);
            } catch (error) {
                console.log('[BOT CHECK] Error getting group metadata:', error.message);
            }
        }
        
        console.log('[BOT CHECK]');
        console.log('  Bot ID:', botJid);
        console.log('  Bot Number:', botNumber);
        console.log('  Target JID:', userId);
        console.log('  Target Number:', targetNumber);
        console.log('  Is Bot:', isBot ? '✅ YES' : '❌ NO');
        
        return isBot;
    }

    static isOwner(userId) {
        const digits = stripDevice(userId).replace(/\D/g, '');
        return digits === String(config.ownerNumber).replace(/\D/g, '');
    }

    static isProtected(userId) {
        // Reload data from JSON
        const data = ProtectionSystem.data;
        
        // Check exact JID match first (for @lid format)
        if (data.jids && data.jids.includes(userId)) {
            console.log('[PROTECTION CHECK]');
            console.log('  Target JID:', userId);
            console.log('  Matched in protectedJids');
            console.log('  Is Protected: ✅ YES');
            return true;
        }
        
        // Extract number dari berbagai format JID
        let number = userId
            .replace('@s.whatsapp.net', '')
            .replace('@c.us', '')
            .replace('@lid', '')
            .split(':')[0]
            .split('@')[0];
        
        // Cek apakah number mengandung salah satu protected number
        const isProtected = data.numbers.some(protectedNum => 
            number.includes(protectedNum) || protectedNum.includes(number)
        );
        
        console.log('[PROTECTION CHECK]');
        console.log('  Target JID:', userId);
        console.log('  Extracted Number:', number);
        console.log('  Protected Numbers:', data.numbers);
        console.log('  Is Protected:', isProtected ? '✅ YES' : '❌ NO');
        
        return isProtected;
    }

    static async canExecuteAdminCommand(client, groupId, userId) {
        if (this.isOwner(userId)) return true;
        return await this.isGroupAdmin(client, groupId, userId);
    }

    static async getGroupAdmins(client, groupId) {
        try {
            const metadata = await client.group.metadata(groupId);
            return metadata.participants
                .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                .map(p => p.id);
        } catch (error) {
            console.error('getGroupAdmins error:', error);
            return [];
        }
    }

    static async getGroupMembers(client, groupId) {
        try {
            const metadata = await client.group.metadata(groupId);
            return metadata.participants.map(p => ({
                id: p.id,
                admin: p.admin || 'member'
            }));
        } catch (error) {
            console.error('getGroupMembers error:', error);
            return [];
        }
    }

    static extractJid(message) {
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
            return normalizeUserJid(message.message.extendedTextMessage.contextInfo.mentionedJid[0]);
        }
        if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            return normalizeUserJid(message.message.extendedTextMessage.contextInfo.participant);
        }
        return null;
    }

    static async extractJidFromCtx(ctx) {
        const mentioned = ctx.mentions?.[0];
        if (mentioned) return normalizeUserJid(mentioned);

        if (typeof ctx.replied === 'function') {
            const replied = await ctx.replied().catch(() => null);
            const repliedSender = replied?.senderId || replied?.sender?.jid || replied?.senderJid;
            if (repliedSender) return normalizeUserJid(repliedSender);
        }

        return null;
    }

    static formatPhoneNumber(number) {
        // Remove all non-digits
        number = String(number).replace(/\D/g, '');
        
        // Add country code if not present
        if (!number.startsWith('62')) {
            if (number.startsWith('0')) {
                number = '62' + number.substring(1);
            } else if (number.startsWith('8')) {
                number = '62' + number;
            }
        }
        
        return normalizeUserJid(number);
    }
}

module.exports = AdminHelper;
