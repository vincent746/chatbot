const express = require('express');
const botController = require('../controllers/botController');

const router = express.Router();

/**
 * @route POST /api/bot/initialize
 * @desc Initialize WhatsApp bot
 * @access Public
 */
router.post('/initialize', botController.initializeBot);

/**
 * @route GET /api/bot/status
 * @desc Get bot status and system information
 * @access Public
 */
router.get('/status', botController.getBotStatus);

/**
 * @route POST /api/bot/send
 * @desc Send message to specific WhatsApp number
 * @body { to: string, message: string }
 * @access Public
 */
router.post('/send', botController.sendMessage);

/**
 * @route POST /api/bot/query
 * @desc Process query with RAG system (for testing)
 * @body { query: string }
 * @access Public
 */
router.post('/query', botController.processQuery);

/**
 * @route POST /api/bot/broadcast
 * @desc Broadcast message to multiple users
 * @body { users: string[], message: string }
 * @access Public
 */
router.post('/broadcast', botController.broadcastMessage);

/**
 * @route POST /api/bot/cache/clear
 * @desc Clear bot response cache
 * @access Public
 */
router.post('/cache/clear', botController.clearCache);

/**
 * @route POST /api/bot/shutdown
 * @desc Shutdown WhatsApp bot
 * @access Public
 */
router.post('/shutdown', botController.shutdownBot);

/**
 * @route GET /api/bot/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/health', botController.healthCheck);

module.exports = router;
