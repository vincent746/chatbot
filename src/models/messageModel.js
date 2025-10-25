/**
 * Message Model
 * Simple in-memory storage for message history and user sessions
 * In production, you might want to use a proper database
 */

class MessageModel {
    constructor() {
        this.messages = new Map(); // userId -> messages array
        this.userSessions = new Map(); // userId -> session data
        this.maxMessagesPerUser = 100; // Limit messages per user to prevent memory issues
    }

    /**
     * Save a message to user's history
     * @param {string} userId - User's WhatsApp ID
     * @param {string} message - Message content
     * @param {string} type - 'incoming' or 'outgoing'
     * @param {Object} metadata - Additional metadata
     */
    saveMessage(userId, message, type = 'incoming', metadata = {}) {
        try {
            if (!this.messages.has(userId)) {
                this.messages.set(userId, []);
            }

            const messageData = {
                id: this.generateMessageId(),
                userId,
                message,
                type,
                timestamp: new Date().toISOString(),
                metadata
            };

            const userMessages = this.messages.get(userId);
            userMessages.push(messageData);

            // Keep only the last N messages per user
            if (userMessages.length > this.maxMessagesPerUser) {
                userMessages.splice(0, userMessages.length - this.maxMessagesPerUser);
            }

            return messageData;

        } catch (error) {
            console.error('Error saving message:', error);
            return null;
        }
    }

    /**
     * Get user's message history
     * @param {string} userId - User's WhatsApp ID
     * @param {number} limit - Number of messages to retrieve
     * @returns {Array} Array of messages
     */
    getUserMessages(userId, limit = 50) {
        try {
            const userMessages = this.messages.get(userId) || [];
            return userMessages.slice(-limit); // Get last N messages
        } catch (error) {
            console.error('Error getting user messages:', error);
            return [];
        }
    }

    /**
     * Get user's recent conversation context
     * @param {string} userId - User's WhatsApp ID
     * @param {number} contextLength - Number of recent messages for context
     * @returns {string} Formatted conversation context
     */
    getConversationContext(userId, contextLength = 5) {
        try {
            const recentMessages = this.getUserMessages(userId, contextLength);
            
            if (recentMessages.length === 0) {
                return '';
            }

            let context = 'Percakapan sebelumnya:\n';
            recentMessages.forEach(msg => {
                const sender = msg.type === 'incoming' ? 'User' : 'Bot';
                context += `${sender}: ${msg.message}\n`;
            });

            return context;

        } catch (error) {
            console.error('Error getting conversation context:', error);
            return '';
        }
    }

    /**
     * Update or create user session data
     * @param {string} userId - User's WhatsApp ID
     * @param {Object} sessionData - Session data to update
     */
    updateUserSession(userId, sessionData) {
        try {
            const existingSession = this.userSessions.get(userId) || {};
            const updatedSession = {
                ...existingSession,
                ...sessionData,
                lastActivity: new Date().toISOString()
            };

            this.userSessions.set(userId, updatedSession);
            return updatedSession;

        } catch (error) {
            console.error('Error updating user session:', error);
            return null;
        }
    }

    /**
     * Get user session data
     * @param {string} userId - User's WhatsApp ID
     * @returns {Object} User session data
     */
    getUserSession(userId) {
        try {
            return this.userSessions.get(userId) || {
                userId,
                firstContact: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                messageCount: 0,
                preferences: {}
            };
        } catch (error) {
            console.error('Error getting user session:', error);
            return {};
        }
    }

    /**
     * Increment user's message count
     * @param {string} userId - User's WhatsApp ID
     */
    incrementMessageCount(userId) {
        try {
            const session = this.getUserSession(userId);
            session.messageCount = (session.messageCount || 0) + 1;
            this.updateUserSession(userId, session);
        } catch (error) {
            console.error('Error incrementing message count:', error);
        }
    }

    /**
     * Get all active users (users who sent messages recently)
     * @param {number} hoursAgo - Hours to look back for activity
     * @returns {Array} Array of active user IDs
     */
    getActiveUsers(hoursAgo = 24) {
        try {
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - hoursAgo);

            const activeUsers = [];
            
            for (const [userId, session] of this.userSessions.entries()) {
                const lastActivity = new Date(session.lastActivity);
                if (lastActivity > cutoffTime) {
                    activeUsers.push(userId);
                }
            }

            return activeUsers;

        } catch (error) {
            console.error('Error getting active users:', error);
            return [];
        }
    }

    /**
     * Get user statistics
     * @param {string} userId - User's WhatsApp ID (optional)
     * @returns {Object} User statistics
     */
    getUserStats(userId = null) {
        try {
            if (userId) {
                // Get stats for specific user
                const messages = this.getUserMessages(userId);
                const session = this.getUserSession(userId);
                
                return {
                    userId,
                    totalMessages: messages.length,
                    firstContact: session.firstContact,
                    lastActivity: session.lastActivity,
                    messageCount: session.messageCount || 0
                };
            } else {
                // Get overall stats
                return {
                    totalUsers: this.userSessions.size,
                    totalMessages: Array.from(this.messages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
                    activeUsers24h: this.getActiveUsers(24).length,
                    activeUsers7d: this.getActiveUsers(24 * 7).length
                };
            }

        } catch (error) {
            console.error('Error getting user stats:', error);
            return {};
        }
    }

    /**
     * Search messages by content
     * @param {string} searchTerm - Term to search for
     * @param {string} userId - User ID to search within (optional)
     * @returns {Array} Array of matching messages
     */
    searchMessages(searchTerm, userId = null) {
        try {
            const results = [];
            const searchLower = searchTerm.toLowerCase();

            const messagesToSearch = userId ? 
                [this.messages.get(userId) || []] : 
                Array.from(this.messages.values());

            messagesToSearch.forEach(userMessages => {
                if (Array.isArray(userMessages)) {
                    userMessages.forEach(msg => {
                        if (msg.message.toLowerCase().includes(searchLower)) {
                            results.push(msg);
                        }
                    });
                }
            });

            return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        } catch (error) {
            console.error('Error searching messages:', error);
            return [];
        }
    }

    /**
     * Clear old messages and sessions
     * @param {number} daysAgo - Days to keep data for
     */
    cleanupOldData(daysAgo = 30) {
        try {
            const cutoffTime = new Date();
            cutoffTime.setDate(cutoffTime.getDate() - daysAgo);

            let cleanedUsers = 0;
            let cleanedMessages = 0;

            // Clean old sessions
            for (const [userId, session] of this.userSessions.entries()) {
                const lastActivity = new Date(session.lastActivity);
                if (lastActivity < cutoffTime) {
                    this.userSessions.delete(userId);
                    this.messages.delete(userId);
                    cleanedUsers++;
                }
            }

            // Clean old messages for remaining users
            for (const [userId, messages] of this.messages.entries()) {
                const filteredMessages = messages.filter(msg => {
                    return new Date(msg.timestamp) > cutoffTime;
                });
                
                cleanedMessages += messages.length - filteredMessages.length;
                this.messages.set(userId, filteredMessages);
            }

            console.log(`Cleanup completed: ${cleanedUsers} users, ${cleanedMessages} messages removed`);
            return { cleanedUsers, cleanedMessages };

        } catch (error) {
            console.error('Error cleaning up old data:', error);
            return { cleanedUsers: 0, cleanedMessages: 0 };
        }
    }

    /**
     * Generate unique message ID
     * @returns {string} Unique message ID
     */
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Export data for backup
     * @returns {Object} Exported data
     */
    exportData() {
        try {
            return {
                messages: Object.fromEntries(this.messages),
                userSessions: Object.fromEntries(this.userSessions),
                exportTimestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error exporting data:', error);
            return {};
        }
    }

    /**
     * Import data from backup
     * @param {Object} data - Data to import
     */
    importData(data) {
        try {
            if (data.messages) {
                this.messages = new Map(Object.entries(data.messages));
            }
            
            if (data.userSessions) {
                this.userSessions = new Map(Object.entries(data.userSessions));
            }

            console.log('Data import completed successfully');
            return true;

        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }
}

module.exports = new MessageModel();
