const express = require('express');
const botController = require('../controllers/botController');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     BotStatus:
 *       type: object
 *       properties:
 *         isReady:
 *           type: boolean
 *           description: Bot connection status
 *         isConnected:
 *           type: boolean
 *           description: WhatsApp connection status
 *         activeUsers:
 *           type: number
 *           description: Number of active users
 *         cachedResponses:
 *           type: number
 *           description: Cached responses count
 *     MessageRequest:
 *       type: object
 *       required:
 *         - to
 *         - message
 *       properties:
 *         to:
 *           type: string
 *           description: WhatsApp user ID
 *           example: "6281234567890@c.us"
 *         message:
 *           type: string
 *           description: Message content
 *           example: "Hallo dari bot!"
 *     QueryRequest:
 *       type: object
 *       required:
 *         - query
 *       properties:
 *         query:
 *           type: string
 *           description: User query
 *           example: "Jam buka berapa?"
 */

/**
 * @swagger
 * /api/bot/initialize:
 *   post:
 *     summary: Initialize WhatsApp bot
 *     description: Start WhatsApp bot and generate QR code for scanning
 *     tags: [Bot Management]
 *     responses:
 *       200:
 *         description: Bot initialization started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Initialization failed
 */
router.post('/initialize', botController.initializeBot);

/**
 * @swagger
 * /api/bot/status:
 *   get:
 *     summary: Get bot status
 *     description: Retrieve current bot status and system information
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Bot status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bot:
 *                   $ref: '#/components/schemas/BotStatus'
 *                 system:
 *                   type: object
 *       500:
 *         description: Failed to get status
 */
router.get('/status', botController.getBotStatus);

/**
 * @swagger
 * /api/bot/send:
 *   post:
 *     summary: Send message via bot
 *     description: Send a message to a WhatsApp user
 *     tags: [Messaging]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MessageRequest'
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         description: Missing required fields
 *       503:
 *         description: Bot is not ready
 */
router.post('/send', botController.sendMessage);

/**
 * @swagger
 * /api/bot/query:
 *   post:
 *     summary: Test RAG query
 *     description: Process a query through RAG system without WhatsApp
 *     tags: [Testing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QueryRequest'
 *     responses:
 *       200:
 *         description: Query processed successfully
 *       400:
 *         description: Missing query field
 */
router.post('/query', botController.processQuery);

/**
 * @swagger
 * /api/bot/broadcast:
 *   post:
 *     summary: Broadcast message
 *     description: Send message to multiple users
 *     tags: [Messaging]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - users
 *               - message
 *             properties:
 *               users:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of WhatsApp user IDs
 *               message:
 *                 type: string
 *                 description: Message to broadcast
 *     responses:
 *       200:
 *         description: Broadcast completed
 */
router.post('/broadcast', botController.broadcastMessage);

/**
 * @swagger
 * /api/bot/cache/clear:
 *   post:
 *     summary: Clear response cache
 *     description: Clear bot response cache
 *     tags: [Bot Management]
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.post('/cache/clear', botController.clearCache);

/**
 * @swagger
 * /api/bot/shutdown:
 *   post:
 *     summary: Shutdown bot
 *     description: Gracefully shutdown WhatsApp bot
 *     tags: [Bot Management]
 *     responses:
 *       200:
 *         description: Bot shutdown successfully
 */
router.post('/shutdown', botController.shutdownBot);

/**
 * @swagger
 * /api/bot/health:
 *   get:
 *     summary: Health check
 *     description: Check system health status
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: System is healthy
 *       503:
 *         description: System is degraded
 */
router.get('/health', botController.healthCheck);

module.exports = router;