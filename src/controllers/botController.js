const botHandler = require('../bot/botHandler');
const ragEngine = require('../rag/ragEngine');
const logger = require('../helper/logger');

class BotController {
    /**
     * Initialize the bot
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async initializeBot(req, res) {
        try {
            logger.info('Bot initialization requested via API');
            
            if (botHandler.isReady) {
                return res.json({
                    success: true,
                    message: 'Bot is already running',
                    status: botHandler.getStatus()
                });
            }

            // Guard: tolak request concurrent selama bot sedang dalam proses initialize
            if (botHandler.isInitializing) {
                logger.warn('[DIAG] Duplicate /initialize request blocked — bot is already initializing');
                return res.status(409).json({
                    success: false,
                    message: 'Bot is already being initialized. Please wait and scan the QR code that was already generated.',
                    status: botHandler.getStatus()
                });
            }

            await botHandler.initialize();
            
            res.json({
                success: true,
                message: 'Bot initialization started. Please scan QR code.',
                status: botHandler.getStatus()
            });

        } catch (error) {
            logger.logError(error, 'BotController.initializeBot');
            res.status(500).json({
                success: false,
                message: 'Failed to initialize bot',
                error: error.message
            });
        }
    }

    /**
     * Get bot status
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getBotStatus(req, res) {
        try {
            const status = botHandler.getStatus();
            const systemStatus = await ragEngine.getSystemStatus();

            res.json({
                success: true,
                bot: status,
                system: systemStatus,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.logError(error, 'BotController.getBotStatus');
            res.status(500).json({
                success: false,
                message: 'Failed to get bot status',
                error: error.message
            });
        }
    }

    /**
     * Send message via API
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async sendMessage(req, res) {
        try {
            const { to, message } = req.body;

            if (!to || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: to, message'
                });
            }

            if (!botHandler.isReady) {
                return res.status(503).json({
                    success: false,
                    message: 'Bot is not ready. Please initialize first.'
                });
            }

            await botHandler.sendMessage(to, message);
            
            logger.info('Message sent via API', { to, messageLength: message.length });

            res.json({
                success: true,
                message: 'Message sent successfully',
                data: { to, messageLength: message.length }
            });

        } catch (error) {
            logger.logError(error, 'BotController.sendMessage');
            res.status(500).json({
                success: false,
                message: 'Failed to send message',
                error: error.message
            });
        }
    }

    /**
     * Process query with RAG (for testing)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async processQuery(req, res) {
        try {
            const { query } = req.body;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required field: query'
                });
            }

            const startTime = Date.now();
            const ragResponse = await ragEngine.processQuery(query);
            const processingTime = Date.now() - startTime;

            logger.info('Query processed via API', { 
                query: query.substring(0, 100),
                processingTime: `${processingTime}ms`,
                hasContext: ragResponse.hasContext
            });

            res.json({
                success: true,
                data: {
                    ...ragResponse,
                    processingTime: `${processingTime}ms`
                }
            });

        } catch (error) {
            logger.logError(error, 'BotController.processQuery');
            res.status(500).json({
                success: false,
                message: 'Failed to process query',
                error: error.message
            });
        }
    }

    /**
     * Broadcast message to multiple users
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async broadcastMessage(req, res) {
        try {
            const { users, message } = req.body;

            if (!users || !Array.isArray(users) || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: users (array), message'
                });
            }

            if (!botHandler.isReady) {
                return res.status(503).json({
                    success: false,
                    message: 'Bot is not ready. Please initialize first.'
                });
            }

            const results = await botHandler.broadcast(users, message);
            
            const successCount = results.filter(r => r.success).length;
            const failureCount = results.length - successCount;

            logger.info('Broadcast completed', { 
                totalUsers: users.length,
                successCount,
                failureCount,
                messageLength: message.length
            });

            res.json({
                success: true,
                message: 'Broadcast completed',
                data: {
                    totalUsers: users.length,
                    successCount,
                    failureCount,
                    results
                }
            });

        } catch (error) {
            logger.logError(error, 'BotController.broadcastMessage');
            res.status(500).json({
                success: false,
                message: 'Failed to broadcast message',
                error: error.message
            });
        }
    }

    /**
     * Clear bot cache
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async clearCache(req, res) {
        try {
            botHandler.clearCache();
            
            logger.info('Cache cleared via API');

            res.json({
                success: true,
                message: 'Cache cleared successfully'
            });

        } catch (error) {
            logger.logError(error, 'BotController.clearCache');
            res.status(500).json({
                success: false,
                message: 'Failed to clear cache',
                error: error.message
            });
        }
    }

    /**
     * Shutdown bot
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async shutdownBot(req, res) {
        try {
            await botHandler.shutdown();
            
            logger.info('Bot shutdown requested via API');

            res.json({
                success: true,
                message: 'Bot shutdown successfully'
            });

        } catch (error) {
            logger.logError(error, 'BotController.shutdownBot');
            res.status(500).json({
                success: false,
                message: 'Failed to shutdown bot',
                error: error.message
            });
        }
    }

    /**
     * Get system health check
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async healthCheck(req, res) {
        try {
            const botStatus = botHandler.getStatus();
            const systemStatus = await ragEngine.getSystemStatus();
            
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                bot: {
                    ready: botStatus.isReady,
                    connected: !!botStatus.isConnected
                },
                services: {
                    pdf: systemStatus.pdfService?.available || false,
                    ai: systemStatus.aiService?.available || false
                }
            };

            // Determine overall health
            if (!health.bot.ready || !health.services.pdf || !health.services.ai) {
                health.status = 'degraded';
            }

            const statusCode = health.status === 'ok' ? 200 : 503;

            res.status(statusCode).json({
                success: health.status === 'ok',
                data: health
            });

        } catch (error) {
            logger.logError(error, 'BotController.healthCheck');
            res.status(500).json({
                success: false,
                status: 'error',
                message: 'Health check failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = new BotController();
