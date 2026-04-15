const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');
const logger = require('../helper/logger');

class PdfService {
    constructor() {
        this.pdfPath = process.env.PDF_RULES_PATH || './storage/rules/toko_conveyor_belt_dan_safety.pdf';
        this.cachedContent = null;
        this.lastModified = null;
    }

    /**
     * Extract text content from PDF file
     * @returns {Promise<string>} Extracted text content
     */
    async extractTextFromPdf() {
        try {
            // Check if file exists
            if (!fs.existsSync(this.pdfPath)) {
                throw new Error(`PDF file not found at: ${this.pdfPath}`);
            }

            // Get file stats to check if file has been modified
            const stats = fs.statSync(this.pdfPath);
            const currentModified = stats.mtime.getTime();

            // Return cached content if file hasn't been modified
            if (this.cachedContent && this.lastModified === currentModified) {
                return this.cachedContent;
            }

            // Read and parse PDF
            const dataBuffer = fs.readFileSync(this.pdfPath);
            const pdfData = await pdf(dataBuffer);

            // Cache the content and modification time
            this.cachedContent = pdfData.text;
            this.lastModified = currentModified;

            logger.info(`PDF content extracted successfully. Length: ${this.cachedContent.length} characters`);
            return this.cachedContent;

        } catch (error) {
            console.error('Error extracting PDF content:', error.message);
            throw new Error(`Failed to extract PDF content: ${error.message}`);
        }
    }

    /**
     * Search for specific keywords in PDF content
     * @param {string} query - Search query
     * @returns {Promise<Array>} Array of relevant text chunks
     */
    async searchInPdf(query) {
        try {
            const content = await this.extractTextFromPdf();
            
            if (!content) {
                return [];
            }

            // Convert query to lowercase for case-insensitive search
            const lowerQuery = query.toLowerCase();
            const lowerContent = content.toLowerCase();

            // Split content into sentences/paragraphs
            const chunks = content.split(/[.!?]\s+/).filter(chunk => chunk.trim().length > 0);
            
            // Find relevant chunks
            const relevantChunks = chunks.filter(chunk => {
                const lowerChunk = chunk.toLowerCase();
                return lowerChunk.includes(lowerQuery) || 
                       this.calculateSimilarity(lowerQuery, lowerChunk) > 0.3;
            });

            // Sort by relevance (simple keyword matching for now)
            relevantChunks.sort((a, b) => {
                const aMatches = (a.toLowerCase().match(new RegExp(lowerQuery, 'g')) || []).length;
                const bMatches = (b.toLowerCase().match(new RegExp(lowerQuery, 'g')) || []).length;
                return bMatches - aMatches;
            });

            logger.info('Relevant chunks found:', relevantChunks.slice(0, 5));
            return relevantChunks.slice(0, 5); // Return top 5 relevant chunks

        } catch (error) {
            console.error('Error searching in PDF:', error.message);
            return [];
        }
    }

    /**
     * Simple similarity calculation between two strings
     * @param {string} str1 
     * @param {string} str2 
     * @returns {number} Similarity score between 0 and 1
     */
    calculateSimilarity(str1, str2) {
        const words1 = str1.split(/\s+/);
        const words2 = str2.split(/\s+/);
        
        let matches = 0;
        words1.forEach(word => {
            if (words2.includes(word) && word.length > 2) {
                matches++;
            }
        });

        logger.info('Similarity score:', matches / Math.max(words1.length, words2.length));
        return matches / Math.max(words1.length, words2.length);
    }

    /**
     * Get full PDF content
     * @returns {Promise<string>} Full PDF text content
     */
    async getFullContent() {
        return await this.extractTextFromPdf();
    }

    /**
     * Clear cached content (useful for testing or manual refresh)
     */
    clearCache() {
        this.cachedContent = null;
        this.lastModified = null;
        console.log('PDF cache cleared');
    }
}

module.exports = new PdfService();
