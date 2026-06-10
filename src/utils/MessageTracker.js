const Database = require('./Database');

class MessageTracker {
    constructor() {
        this.maxMessages = 50;
    }

    async addDeletedMessage(chatId, messageData) {
        try {
            const timestamp = Database.toTimestamp();
            Database.run(
                `INSERT INTO deleted_messages (chat_id, message_id, sender, sender_name, text, caption, media_type, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                chatId,
                messageData.messageId,
                messageData.sender,
                messageData.senderName,
                messageData.text,
                messageData.caption,
                messageData.mediaType,
                messageData.timestamp,
                timestamp
            );

            const row = Database.get(`SELECT COUNT(*) as count FROM deleted_messages WHERE chat_id = ?`, chatId);
            const totalMessages = row ? row.count : 0;
            if (totalMessages > this.maxMessages) {
                const limit = totalMessages - this.maxMessages;
                Database.run(
                    `DELETE FROM deleted_messages WHERE id IN (SELECT id FROM deleted_messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT ?)`,
                    chatId,
                    limit
                );
            }
        } catch (error) {
            console.error('Add deleted message error:', error.message);
        }
    }

    async getDeletedMessages(chatId, count = 5) {
        try {
            const messages = Database.all(
                `SELECT * FROM deleted_messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?`,
                chatId,
                Math.min(count, this.maxMessages)
            );

            return messages.map(msg => ({
                messageId: msg.message_id,
                sender: msg.sender,
                senderName: msg.sender_name,
                text: msg.text,
                caption: msg.caption,
                mediaType: msg.media_type,
                timestamp: msg.timestamp,
                deletedAt: Database.fromTimestamp(msg.created_at).toISOString()
            }));
        } catch (error) {
            console.error('Get deleted messages error:', error.message);
            return [];
        }
    }

    async clearDeletedMessages(chatId) {
        try {
            Database.run(`DELETE FROM deleted_messages WHERE chat_id = ?`, chatId);
        } catch (error) {
            console.error('Clear deleted messages error:', error.message);
        }
    }

    async getStats() {
        try {
            const rowTotal = Database.get(`SELECT COUNT(*) as count FROM deleted_messages`);
            const rowChats = Database.get(`SELECT COUNT(DISTINCT chat_id) as count FROM deleted_messages`);
            return {
                totalMessages: rowTotal ? rowTotal.count : 0,
                totalChats: rowChats ? rowChats.count : 0
            };
        } catch (error) {
            console.error('Get stats error:', error.message);
            return { totalMessages: 0, totalChats: 0 };
        }
    }
}

module.exports = new MessageTracker();
