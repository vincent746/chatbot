const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const qrImage = require('qr-image');
const fs = require('fs-extra');
const path = require('path');
const ragEngine = require('../rag/ragEngine');
const logger = require('../helper/logger');

class BotHandler {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.isInitializing = false; // Guard against concurrent initialize() calls
        this.qrStoragePath = process.env.QR_STORAGE_PATH || './storage/qrcode';
        this.sessionPath = './storage/session';

        // Diagnostic counters
        this._initCallCount = 0;
        this._listenerSetupCount = 0;
        this._clientInstanceCount = 0;
        
        // Rate limiting
        this.messageQueue = new Map(); // userId -> last message timestamp
        this.rateLimitWindow = 2000; // 2 seconds between messages per user
        
        // Response cache for common queries
        this.responseCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Initialize WhatsApp client
     */
    async initialize() {
        this._initCallCount++;
        logger.waDiag(`initialize() called`, {
            callCount: this._initCallCount,
            isInitializing: this.isInitializing,
            isReady: this.isReady,
            hasExistingClient: !!this.client
        });

        if (this.isInitializing) {
            logger.warn('[DIAG] initialize() called while already initializing — BLOCKED (race condition detected)', {
                callCount: this._initCallCount
            });
            return;
        }

        if (this.isReady) {
            logger.warn('[DIAG] initialize() called while already ready — BLOCKED', {
                callCount: this._initCallCount
            });
            return;
        }

        this.isInitializing = true;

        try {
            logger.info('Initializing WhatsApp bot...');

            // Ensure storage directories exist
            await this.ensureDirectories();

            this._clientInstanceCount++;
            logger.waDiag(`Creating WhatsApp Client instance`, {
                instanceNumber: this._clientInstanceCount,
                previousClientExists: !!this.client
            });

            // Initialize WhatsApp Web client with local authentication
            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: 'chatbot-rag',
                    dataPath: this.sessionPath
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                        // REMOVED: '--single-process' — flag ini menyebabkan Chromium
                        // tidak stabil dan bisa memicu re-auth loop di wwebjs
                    ]
                }
            });

            // Set up event listeners
            this.setupEventListeners();

            // Start the client
            await this.client.initialize();
            
            logger.success('WhatsApp bot initialization started');

        } catch (error) {
            this.isInitializing = false;
            logger.logError(error, 'BotHandler.initialize');
            throw error;
        }
    }

    /**
     * Setup event listeners for WhatsApp client
     */
    setupEventListeners() {
        this._listenerSetupCount++;
        const listenerSetupId = this._listenerSetupCount;
        const clientInstanceId = this._clientInstanceCount;

        logger.waDiag(`setupEventListeners() called`, {
            listenerSetupId,
            clientInstanceId,
            totalSetupsSoFar: this._listenerSetupCount
        });

        if (this._listenerSetupCount > 1) {
            logger.error('[DIAG] ⚠️ setupEventListeners() called MORE THAN ONCE — multiple listener registration detected!', {
                listenerSetupId,
                clientInstanceId
            });
        }

        // QR Code generation
        this.client.on('qr', async (qr) => {
            try {
                logger.waDiag(`[qr] event fired`, {
                    listenerSetupId,
                    clientInstanceId,
                    isReady: this.isReady,
                    isInitializing: this.isInitializing
                });

                // QR muncul padahal bot sudah ready = WhatsApp server force-invalidate session
                // (biasanya karena versi wwebjs/WhatsApp Web tidak kompatibel)
                if (this.isReady) {
                    logger.error('[DIAG] 🚨 QR received while bot was already READY — WhatsApp server force-invalidated the session!', {
                        listenerSetupId,
                        clientInstanceId,
                        possibleCause: 'wwebjs version mismatch with WhatsApp Web server'
                    });
                    // Reset state agar status bot akurat
                    this.isReady = false;
                    this.isInitializing = true;
                }

                logger.info('QR Code received, generating...');
                
                // Display QR in terminal
                qrcode.generate(qr, { small: true });
                
                // Save QR code as image file
                await this.saveQRCode(qr);
                
                logger.info('QR Code generated. Please scan with WhatsApp mobile app.');
            } catch (error) {
                // Prevent unhandled promise rejection
                logger.logError(error, 'BotHandler.qr event handler');
            }
        });

        // Client ready
        this.client.on('ready', () => {
            this.isReady = true;
            this.isInitializing = false;
            logger.success('WhatsApp bot is ready and connected!');
            
            // Log info tentang koneksi yang aktif
            try {
                if (this.client && this.client.info) {
                    logger.waDiag('WhatsApp client.info at ready', {
                        wid: this.client.info.wid,
                        platform: this.client.info.platform,
                        pushname: this.client.info.pushname
                    });
                }
            } catch (infoErr) {
                logger.waDiag('Could not read client.info at ready', { error: infoErr.message });
            }
            
            // Clean old logs on startup
            logger.cleanOldLogs();
        });

        // Authentication success
        this.client.on('authenticated', () => {
            logger.waDiag(`[authenticated] event fired`, {
                listenerSetupId,
                clientInstanceId
            });
            logger.success('WhatsApp authentication successful');
        });

        // Authentication failure
        this.client.on('auth_failure', (msg) => {
            logger.waDiag(`[auth_failure] event fired`, {
                listenerSetupId,
                clientInstanceId,
                message: msg
            });
            this.isInitializing = false;
            logger.error('WhatsApp authentication failed', { message: msg });
        });

        // Client disconnected
        this.client.on('disconnected', (reason) => {
            logger.waDiag(`[disconnected] event fired`, {
                listenerSetupId,
                clientInstanceId,
                reason,
                wasReady: this.isReady
            });
            this.isReady = false;
            this.isInitializing = false;
            logger.warn('WhatsApp client disconnected', { reason });
        });

        // State change (tambahan untuk track semua perubahan state WA)
        this.client.on('change_state', (state) => {
            logger.waDiag(`[change_state] event fired`, {
                listenerSetupId,
                clientInstanceId,
                state
            });
        });

        // Incoming messages
        this.client.on('message', async (message) => {
            try {
                console.log('🔔 Message received event fired:', {
                    from: message.from,
                    body: message.body,
                    fromMe: message.fromMe,
                    hasMedia: !!message.hasMedia
                });
                await this.handleIncomingMessage(message);
            } catch (error) {
                // Prevent unhandled promise rejection that causes WhatsApp logout
                logger.logError(error, 'BotHandler.message event handler');
            }
        });

        // Message creation (for logging outgoing messages)
        this.client.on('message_create', async (message) => {
            try {
                if (message.fromMe) {
                    logger.logMessage(message.to, message.body, 'outgoing');
                }
            } catch (error) {
                // Prevent unhandled promise rejection
                logger.logError(error, 'BotHandler.message_create event handler');
            }
        });
    }

    /**
     * Handle incoming WhatsApp messages
     * @param {Object} message - WhatsApp message object
     */
    async handleIncomingMessage(message) {
        try {
            logger.info('📥 Processing incoming message:', {
                from: message.from,
                body: message.body,
                fromMe: message.fromMe,
                isGroup: message.from.includes('@g.us')
            });
            
            // Skip messages from groups, status updates, or from bot itself
            if (message.from.includes('@g.us') || message.from.includes('status') || message.fromMe) {
                logger.info('⏭️ Skipping message (group/status/self)');
                return;
            }

            const userId = message.from;
            // User ketik di WhatsApp: "Jam buka berapa?"
            const messageBody = message.body.trim();

            // Log incoming message
            logger.logMessage(userId, messageBody, 'incoming');

            // Rate limit check untuk menghindari spam chat dalam 2 detik
            if (this.isRateLimited(userId)) {
                logger.warn('Rate limit exceeded', { userId, message: messageBody });
                return;
            }

            // Update rate limit cek spam di pesan berikutnya
            this.messageQueue.set(userId, Date.now());

            // Skip empty messages
            if (!messageBody) {
                return;
            }

            //  Cek cache untuk query yang sama
            const cachedResponse = this.getCachedResponse(messageBody);
            if (cachedResponse) {
                // Gunakan response dari cache (tidak perlu AI API)
                await this.sendMessage(userId, cachedResponse);
                logger.info('Sent cached response', { userId, query: messageBody });
                return;
            }

            // durasi typing untuk memberi tahu user bahwa bot sedang mengetik
            await this.client.sendSeen(userId);
            await this.simulateTyping(userId);

            // Process message with RAG
            const startTime = Date.now();
            const ragResponse = await ragEngine.processQuery(messageBody);
            const processingTime = Date.now() - startTime;

            // Log bot response
            logger.logBotResponse(messageBody, ragResponse.answer, ragResponse.hasContext, processingTime);

            // Cache response for common queries
            this.cacheResponse(messageBody, ragResponse.answer);

            // Send response
            await this.sendMessage(userId, ragResponse.answer);

        } catch (error) {
            logger.logError(error, 'BotHandler.handleIncomingMessage');
            
            // Send error message to user
            try {
                const errorMessage = 'Maaf, terjadi kesalahan sistem. Mohon coba lagi dalam beberapa saat. 🙏';
                await this.sendMessage(message.from, errorMessage);
            } catch (sendError) {
                logger.logError(sendError, 'BotHandler.sendErrorMessage');
            }
        }
    }

    /**
     * Send message to WhatsApp user
     * @param {string} userId - User's WhatsApp ID
     * @param {string} message - Message to send
     */
    async sendMessage(userId, message) {
        try {
            if (!this.isReady) {
                throw new Error('WhatsApp client is not ready');
            }

            await this.client.sendMessage(userId, message);
            logger.info('Message sent successfully', { userId, messageLength: message.length });

        } catch (error) {
            logger.logError(error, 'BotHandler.sendMessage');
            throw error;
        }
    }

    /**
     * Simulate typing indicator
     * @param {string} userId - User's WhatsApp ID
     * @param {number} duration - Typing duration in milliseconds
     */
    async simulateTyping(userId, duration = 1000) {
        try {
            // Calculate typing duration based on message length (simulate realistic typing)
            const typingDuration = Math.min(Math.max(duration, 500), 3000);
            
            await new Promise(resolve => setTimeout(resolve, typingDuration));
        } catch (error) {
            logger.logError(error, 'BotHandler.simulateTyping');
        }
    }

    /**
     * Check if user is rate limited
     * @param {string} userId - User's WhatsApp ID
     * @returns {boolean} True if rate limited
     */
    isRateLimited(userId) {
        const lastMessage = this.messageQueue.get(userId);
        if (!lastMessage) {
            return false;
        }

        return (Date.now() - lastMessage) < this.rateLimitWindow;
    }

    /**
     * Get cached response for a query
     * @param {string} query - User query
     * @returns {string|null} Cached response or null
     */
    getCachedResponse(query) {
        const normalizedQuery = query.toLowerCase().trim();
        const cached = this.responseCache.get(normalizedQuery);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.response;
        }
        
        // Remove expired cache entry
        if (cached) {
            this.responseCache.delete(normalizedQuery);
        }
        
        return null;
    }

    /**
     * Cache response for a query
     * @param {string} query - User query
     * @param {string} response - Bot response
     */
    cacheResponse(query, response) {
        const normalizedQuery = query.toLowerCase().trim();
        
        // Hanya cache query pendek dan response pendek (pertanyaan umum)
        // Contoh: "Hallo", "Jam buka berapa?", dll
        if (normalizedQuery.length < 50 && response.length < 500) {
            this.responseCache.set(normalizedQuery, {
                response: response,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Save QR code as image file with date-based folder structure
     * @param {string} qrData - QR code data
     */
    async saveQRCode(qrData) {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
            
            const qrDir = path.join(this.qrStoragePath, String(year), month, day);
            const qrFileName = `qr-${timestamp}.png`;
            const qrFilePath = path.join(qrDir, qrFileName);

            // Ensure directory exists
            await fs.ensureDir(qrDir);

            // Generate QR code as PNG image
            const qrImageBuffer = qrImage.image(qrData, { type: 'png', size: 10 });
            
            // Write to file
            const writeStream = fs.createWriteStream(qrFilePath);
            qrImageBuffer.pipe(writeStream);

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            logger.success('QR code saved as PNG image', { 
                path: qrFilePath,
                directory: qrDir,
                format: 'PNG'
            });

        } catch (error) {
            logger.logError(error, 'BotHandler.saveQRCode');
        }
    }

    /**
     * Ensure required directories exist
     */
    async ensureDirectories() {
        try {
            // 1. Buat folder untuk QR codes
            await fs.ensureDir(this.qrStoragePath);

            // 2. Buat folder untuk WhatsApp session
            await fs.ensureDir(this.sessionPath);

            // 3. Buat folder untuk logs
            await fs.ensureDir('./logs');
            
            logger.info('Storage directories ensured');
        } catch (error) {
            logger.logError(error, 'BotHandler.ensureDirectories');
            throw error;
        }
    }

    /**
     * Get bot status
     * @returns {Object} Bot status information
     */
    getStatus() {
        return {
            isReady: this.isReady,
            isInitializing: this.isInitializing,
            isConnected: this.client ? this.client.info : null,
            activeUsers: this.messageQueue.size,
            cachedResponses: this.responseCache.size,
            uptime: process.uptime(),
            diag: {
                initCallCount: this._initCallCount,
                listenerSetupCount: this._listenerSetupCount,
                clientInstanceCount: this._clientInstanceCount
            }
        };
    }

    /**
     * Gracefully shutdown the bot
     */
    async shutdown() {
        try {
            logger.info('Shutting down WhatsApp bot...');
            logger.waDiag('shutdown() called', {
                isReady: this.isReady,
                isInitializing: this.isInitializing,
                initCallCount: this._initCallCount,
                listenerSetupCount: this._listenerSetupCount,
                clientInstanceCount: this._clientInstanceCount
            });
            
            if (this.client) {
                await this.client.destroy();
            }
            
            this.isReady = false;
            this.isInitializing = false;
            logger.success('WhatsApp bot shutdown complete');
            
        } catch (error) {
            logger.logError(error, 'BotHandler.shutdown');
        }
    }

    /**
     * Clear response cache
     */
    clearCache() {
        this.responseCache.clear();
        logger.info('Response cache cleared');
    }

    /**
     * Send broadcast message to multiple users
     * @param {Array} userIds - Array of user WhatsApp IDs
     * @param {string} message - Message to broadcast
     */
    async broadcast(userIds, message) {
        const results = [];
        
        for (const userId of userIds) {
            try {
                await this.sendMessage(userId, message);
                results.push({ userId, success: true });
                
                // Add delay between messages to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                logger.logError(error, `BotHandler.broadcast to ${userId}`);
                results.push({ userId, success: false, error: error.message });
            }
        }
        
        return results;
    }
}

module.exports = new BotHandler();
