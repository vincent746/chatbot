const pdfService = require('../services/pdfService');
const aiService = require('../services/aiService');
const sheetService = require('../services/sheetService');
const logger = require('../helper/logger');

class RagEngine {
    constructor() {
        this.contextWindow = 2000; // Maximum characters for context
        this.relevanceThreshold = 0.2; // Minimum relevance score for including context
    }

    /**
     * Process user query using RAG (Retrieval-Augmented Generation)
     * @param {string} userQuery - The user's question/message
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response object with answer and metadata
     */
    async processQuery(userQuery, options = {}) {
        try {
            console.log(`Processing RAG query: "${userQuery}"`);
            
            // Step 1: Get full PDF content as system message
            const fullPdfContent = await pdfService.getFullContent();
            
            // Step 1.5: Get Google Sheets data (dynamic headers)
            let sheetDataText = '';
            try {
                sheetDataText = await sheetService.getFormattedDataForAI();
                if (sheetDataText) {
                    logger.info('Sheet data retrieved for AI context', {
                        dataLength: sheetDataText.length
                    });
                }
            } catch (sheetError) {
                // Log error but don't throw - continue without sheet data
                logger.warn('Failed to get sheet data, continuing without it', {
                    error: sheetError.message,
                    stack: sheetError.stack
                });
                // Ensure sheetDataText is empty string on error
                sheetDataText = '';
            }
            
            // Step 2: Retrieve relevant context from PDF for emphasis
            let relevantContext = [];
            try {
                relevantContext = await this.retrieveRelevantContext(userQuery);
            } catch (contextError) {
                // Log error but don't throw - continue without relevant context
                logger.warn('Failed to retrieve relevant context, continuing without it', {
                    error: contextError.message
                });
                relevantContext = [];
            }
            
            // Step 3: Prepare system message (PDF + Sheet Data + relevant context emphasis)
            let systemMessage = fullPdfContent;
            
            // If we found specific relevant context, emphasize it at the beginning
            if (relevantContext.length > 0) {
                systemMessage = `INFORMASI PENTING UNTUK PERTANYAAN INI:\n${relevantContext}\n\n---\n\n${systemMessage}`;
            }

            // Add sheet data if available
            if (sheetDataText) {
                systemMessage = `${systemMessage}\n\n---\n\nDATA PRODUK DARI GOOGLE SHEETS:\n${sheetDataText}`;
            }
            
            // Log system message yang akan dikirim ke AI
            logger.info('System message prepared for AI', {
                query: userQuery,
                relevantContextLength: relevantContext.length,
                relevantContext: relevantContext.join('\n---\n'),
                systemMessage: systemMessage,
                systemMessageLength: systemMessage.length
            });
            
            // Step 4: Generate AI response with full PDF as system message
            let aiResponse;
            try {
                aiResponse = await aiService.generateResponse(userQuery, systemMessage);
            } catch (aiError) {
                // Log error and throw to be caught by outer try-catch
                logger.error('Failed to generate AI response', {
                    error: aiError.message,
                    stack: aiError.stack
                });
                throw aiError;
            }
            
            // Step 5: Post-process and return response
            const response = {
                answer: aiResponse,
                hasContext: relevantContext.length > 0,
                contextUsed: relevantContext,
                systemMessage: systemMessage.substring(0, 200) + '...', // Truncate for logging
                query: userQuery,
                timestamp: new Date().toISOString()
            };

            console.log(`RAG response generated. Context chunks used: ${relevantContext.length}`);
            return response;

        } catch (error) {
            console.error('Error in RAG processing:', error.message);
            
            // Fallback to AI without context
            try {
                const fallbackResponse = await aiService.generateResponse(userQuery, '');
                return {
                    answer: fallbackResponse,
                    hasContext: false,
                    contextUsed: [],
                    query: userQuery,
                    timestamp: new Date().toISOString(),
                    error: 'Context retrieval failed, using fallback response'
                };
            } catch (fallbackError) {
                console.error('Fallback response also failed:', fallbackError.message);
                return {
                    answer: this.getEmergencyFallback(userQuery),
                    hasContext: false,
                    contextUsed: [],
                    query: userQuery,
                    timestamp: new Date().toISOString(),
                    error: 'Both RAG and fallback failed'
                };
            }
        }
    }

    /**
     * Retrieve relevant context from PDF based on user query
     * @param {string} query - User query
     * @returns {Promise<Array>} Array of relevant text chunks
     */
    async retrieveRelevantContext(query) {
        try {
            // Search for relevant chunks in PDF
            const relevantChunks = await pdfService.searchInPdf(query);
            logger.info('Relevant chunks found in PDF:', relevantChunks);

            if (relevantChunks.length === 0) {
                // If no specific matches, try with broader keywords
                const broadKeywords = this.extractKeywords(query);
                logger.info('Broad keywords extracted:', broadKeywords);

                if (broadKeywords.length > 0) {
                    for (const keyword of broadKeywords) {
                        const chunks = await pdfService.searchInPdf(keyword);
                        logger.info('Chunks found with keyword:', keyword, chunks);
                        
                        if (chunks.length > 0) {
                            relevantChunks.push(...chunks);
                            break; // Use first successful keyword search
                        }
                    }
                }
            }

            // Remove duplicates and limit context size
            const uniqueChunks = [...new Set(relevantChunks)];
            return this.limitContextSize(uniqueChunks);

        } catch (error) {
            console.error('Error retrieving context:', error.message);
            return [];
        }
    }

    /**
     * Extract keywords from user query for broader search
     * @param {string} query - User query
     * @returns {Array<string>} Array of keywords
     */
    extractKeywords(query) {
        // kalimat stop words untuk filter kata yang tidak relevan
        const stopWords = [
            'dan', 'atau', 'yang', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada', 'dalam',
            'adalah', 'ini', 'itu', 'ada', 'tidak', 'bisa', 'akan', 'sudah', 'masih',
            'apa', 'siapa', 'dimana', 'kapan', 'bagaimana', 'kenapa', 'berapa',
            'saya', 'anda', 'kita', 'mereka', 'dia'
        ];

        const words = query.toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.includes(word));

        // Return unique keywords
        return [...new Set(words)];
    }


    /**
     * Limit context size to fit within token limits
     * @param {Array} chunks - Text chunks
     * @returns {Array} Limited chunks
     */
    limitContextSize(chunks) {
        let totalLength = 0;
        const limitedChunks = [];

        for (const chunk of chunks) {
            if (totalLength + chunk.length > this.contextWindow) {
                break;
            }
            limitedChunks.push(chunk);
            totalLength += chunk.length;
        }

        return limitedChunks;
    }

    /**
     * Get emergency fallback response when everything fails
     * @param {string} query - User query
     * @returns {string} Emergency response
     */
    getEmergencyFallback(query) {
        const storeName = process.env.STORE_NAME || 'Toko Conveyor Belt dan Safety';
        
        return `Maaf, saat ini sistem sedang mengalami gangguan teknis. ` +
               `Untuk mendapatkan informasi yang Anda butuhkan, mohon hubungi langsung ` +
               `staff ${storeName} atau kunjungi toko kami. Terima kasih atas pengertiannya! 🙏`;
    }


    /**
     * Get system status for debugging
     * @returns {Promise<Object>} System status
     */
    async getSystemStatus() {
        try {
            const pdfContent = await pdfService.getFullContent();
            const aiConnection = await aiService.testConnection();

            return {
                pdfService: {
                    available: pdfContent && pdfContent.length > 0,
                    contentLength: pdfContent ? pdfContent.length : 0
                },
                aiService: {
                    available: aiConnection,
                    apiToken: !!process.env.OPENROUTER_API_TOKEN
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = new RagEngine();
