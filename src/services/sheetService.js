/**
 * Google Sheets Service
 * Using opensheet.elk.sh for easy Google Sheets integration without API key
 * Supports dynamic headers - no need to hardcode column names
 */

const axios = require('axios');
const logger = require('../helper/logger');

class SheetService {
    constructor() {
        // OpenSheet URL format: https://opensheet.elk.sh/{SHEET_ID}/{SHEET_NAME}
        this.sheetId = process.env.GOOGLE_SHEET_ID || '1EL9GG2wWCM0u5AfkJ5ABGP6h-z31ylhULR5MCCM39nY';
        this.sheetName = process.env.GOOGLE_SHEET_NAME || 'list_barang';
        this.baseUrl = `https://opensheet.elk.sh/${this.sheetId}/${this.sheetName}`;
        
        // Cache untuk data dan headers
        this.cachedData = null;
        this.cachedHeaders = null;
        this.cacheExpiry = 5 * 60 * 1000; // 5 menit
        this.lastFetchTime = null;
    }

    /**
     * Convert sheet data to formatted text for AI context
     * @returns {Promise<string>} Formatted text representation of sheet data
     */
    async getFormattedDataForAI() {
        try {
            const products = await this.getAllProducts();
            const headers = await this.getHeaders();
            
            if (products.length === 0) {
                return 'Tidak ada data produk tersedia.';
            }

            // Format data untuk AI context
            let formattedText = 'Berikut daftar produk dan informasi:\n\n';
            
            products.forEach((product, index) => {
                formattedText += `${index + 1}. `;
                
                // Format semua field secara dinamis
                const fields = headers.map(header => {
                    const value = product[header];
                    return `${header}: ${value}`;
                }).join(', ');
                
                formattedText += fields + '\n';
            });
            
            return formattedText;

        } catch (error) {
            logger.error('Error formatting data for AI:', {
                error: error.message,
                stack: error.stack
            });
            // Return empty string instead of throwing to prevent unhandled rejection
            return '';
        }
    }

    /**
     * Get all products from Google Sheets (with dynamic headers)
     * @returns {Promise<Array>} Array of products
     */
    async getAllProducts() {
        try {
            return await this.fetchFromOpenSheet();
        } catch (error) {
            logger.error('Error getting products from Google Sheets:', {
                error: error.message,
                stack: error.stack
            });
            // Return empty array instead of throwing to prevent unhandled rejection
            return [];
        }
    }

    /**
     * Get available headers/columns from sheet
     * @returns {Promise<Array>} Array of header names
     */
    async getHeaders() {
        try {
            if (!this.cachedHeaders) {
                await this.fetchFromOpenSheet();
            }
            return this.cachedHeaders || [];
        } catch (error) {
            logger.error('Error getting headers:', {
                error: error.message,
                stack: error.stack
            });
            // Return empty array instead of throwing to prevent unhandled rejection
            return [];
        }
    }

    /**
     * Fetch data from OpenSheet API
     * @returns {Promise<Array>} Array of products with dynamic headers
     */
    async fetchFromOpenSheet() {
        try {
            // Check cache
            if (this.cachedData && this.lastFetchTime && 
                (Date.now() - this.lastFetchTime) < this.cacheExpiry) {
                logger.info('Using cached sheet data');
                return this.cachedData;
            }

            logger.info('Fetching data from OpenSheet', { url: this.baseUrl });
            
            const response = await axios.get(this.baseUrl, {
                timeout: 10000 // 10 seconds timeout
            });

            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                // Extract headers dynamically from first row
                this.cachedHeaders = Object.keys(response.data[0]);
                
                // Cache data
                this.cachedData = response.data;
                this.lastFetchTime = Date.now();
                
                logger.info('Data fetched successfully from OpenSheet', {
                    rowCount: response.data.length,
                    headers: this.cachedHeaders,
                    cachedData: response.data
                });
                
                return response.data;
            } else {
                logger.warn('OpenSheet returned empty data');
                return [];
            }

        } catch (error) {
            logger.error('Error fetching from OpenSheet', {
                error: error.message,
                stack: error.stack,
                url: this.baseUrl,
                code: error.code,
                response: error.response?.status ? {
                    status: error.response.status,
                    statusText: error.response.statusText
                } : undefined
            });
            
            // Return empty array instead of throwing to prevent unhandled rejection
            return [];
        }
    }

}

module.exports = new SheetService();
