require('dotenv').config();
const express = require('express');
const cors = require('cors');
const botHandler = require('./src/bot/botHandler');
const botRoutes = require('./src/routes/botRoutes');
const logger = require('./src/helper/logger');

class ChatbotServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // CORS
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
            credentials: true
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                body: req.method === 'POST' ? req.body : undefined
            });
            next();
        });
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/', (req, res) => {
            res.json({
                success: true,
                message: 'WhatsApp RAG Chatbot Server',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                status: 'running'
            });
        });

        // Bot API routes
        this.app.use('/api/bot', botRoutes);

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Endpoint not found',
                path: req.originalUrl
            });
        });
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // Global error handler
        this.app.use((error, req, res, next) => {
            logger.logError(error, `Express Error Handler - ${req.method} ${req.path}`);
            
            res.status(error.status || 500).json({
                success: false,
                message: process.env.NODE_ENV === 'production' ? 
                    'Internal server error' : 
                    error.message,
                ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
            });
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at Promise', { reason, promise });
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.logError(error, 'Uncaught Exception');
            process.exit(1);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    }

    /**
     * Start the server
     */
    async start() {
        try {
            // Validate environment variables
            this.validateEnvironment();

            // Start Express server
            this.server = this.app.listen(this.port, () => {
                logger.success(`Server started on port ${this.port}`, {
                    port: this.port,
                    environment: process.env.NODE_ENV || 'development',
                    pid: process.pid
                });
            });

            // Auto-initialize bot if configured
            if (process.env.AUTO_START_BOT === 'true') {
                logger.info('Auto-starting WhatsApp bot...');
                setTimeout(async () => {
                    try {
                        await botHandler.initialize();
                        logger.success('WhatsApp bot auto-started successfully');
                    } catch (error) {
                        logger.logError(error, 'Auto-start bot failed');
                    }
                }, 2000);
            } else {
                logger.info('WhatsApp bot not auto-started. Use POST /api/bot/initialize to start manually.');
            }

        } catch (error) {
            logger.logError(error, 'Server startup failed');
            process.exit(1);
        }
    }

    /**
     * Validate required environment variables
     */
    validateEnvironment() {
        const requiredEnvVars = [
            'OPENROUTER_API_TOKEN'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            logger.error('Missing required environment variables', { missingVars });
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        // Warn about optional but recommended variables
        const optionalVars = {
            'BOT_NAME': 'Bot name for responses',
            'STORE_NAME': 'Store name for branding',
            'PDF_RULES_PATH': 'Path to PDF rules file'
        };

        Object.entries(optionalVars).forEach(([varName, description]) => {
            if (!process.env[varName]) {
                logger.warn(`Optional environment variable not set: ${varName} (${description})`);
            }
        });
    }

    /**
     * Graceful shutdown
     * @param {string} signal - Shutdown signal
     */
    async gracefulShutdown(signal) {
        logger.info(`Received ${signal}, starting graceful shutdown...`);

        try {
            // Stop accepting new connections
            if (this.server) {
                this.server.close(() => {
                    logger.info('HTTP server closed');
                });
            }

            // Shutdown WhatsApp bot
            await botHandler.shutdown();

            logger.success('Graceful shutdown completed');
            process.exit(0);

        } catch (error) {
            logger.logError(error, 'Error during graceful shutdown');
            process.exit(1);
        }
    }

    /**
     * Get server status
     */
    getStatus() {
        return {
            server: {
                running: !!this.server,
                port: this.port,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                pid: process.pid
            },
            bot: botHandler.getStatus(),
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                nodeEnv: process.env.NODE_ENV || 'development'
            }
        };
    }
}

// Create and start server
const server = new ChatbotServer();

// Start server if this file is run directly
if (require.main === module) {
    server.start().catch(error => {
        logger.logError(error, 'Failed to start server');
        process.exit(1);
    });
}

module.exports = server;
