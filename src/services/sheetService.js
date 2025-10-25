/**
 * Google Sheets Service
 * This service will be implemented later for real-time stock data integration
 * For now, it provides a basic structure and mock data
 */

class SheetService {
    constructor() {
        this.sheetId = process.env.GOOGLE_SHEET_ID || null;
        this.apiKey = process.env.GOOGLE_SHEETS_API_KEY || null;
        this.serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || null;
        
        // Mock data for testing
        this.mockStockData = [
            { id: 1, name: 'Sepatu Sneakers Nike', stock: 15, price: 850000, category: 'sneakers' },
            { id: 2, name: 'Sepatu Formal Pantofel', stock: 8, price: 450000, category: 'formal' },
            { id: 3, name: 'Sepatu Casual Adidas', stock: 12, price: 720000, category: 'casual' },
            { id: 4, name: 'Sepatu Running Puma', stock: 6, price: 680000, category: 'running' },
            { id: 5, name: 'Sepatu Boots Kulit', stock: 4, price: 950000, category: 'boots' },
            { id: 6, name: 'Sandal Jepit Havaianas', stock: 25, price: 180000, category: 'sandal' },
            { id: 7, name: 'Sepatu Basket Jordan', stock: 3, price: 1200000, category: 'basket' },
            { id: 8, name: 'Sepatu Hiking Merrell', stock: 7, price: 890000, category: 'hiking' }
        ];
    }

    /**
     * Get all products from Google Sheets
     * @returns {Promise<Array>} Array of products
     */
    async getAllProducts() {
        try {
            // TODO: Implement actual Google Sheets API integration
            // For now, return mock data
            console.log('Getting products from Google Sheets (mock data)');
            
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 500));
            
            return this.mockStockData;

        } catch (error) {
            console.error('Error getting products from Google Sheets:', error);
            return [];
        }
    }

    /**
     * Search products by name or category
     * @param {string} query - Search query
     * @returns {Promise<Array>} Array of matching products
     */
    async searchProducts(query) {
        try {
            const products = await this.getAllProducts();
            const lowerQuery = query.toLowerCase();
            
            return products.filter(product => 
                product.name.toLowerCase().includes(lowerQuery) ||
                product.category.toLowerCase().includes(lowerQuery)
            );

        } catch (error) {
            console.error('Error searching products:', error);
            return [];
        }
    }

    /**
     * Get product by ID
     * @param {number} productId - Product ID
     * @returns {Promise<Object|null>} Product object or null
     */
    async getProductById(productId) {
        try {
            const products = await this.getAllProducts();
            return products.find(product => product.id === productId) || null;

        } catch (error) {
            console.error('Error getting product by ID:', error);
            return null;
        }
    }

    /**
     * Check stock availability for a product
     * @param {string} productName - Product name
     * @returns {Promise<Object>} Stock information
     */
    async checkStock(productName) {
        try {
            const products = await this.searchProducts(productName);
            
            if (products.length === 0) {
                return {
                    found: false,
                    message: `Produk "${productName}" tidak ditemukan.`
                };
            }

            // If multiple products found, return the first match
            const product = products[0];
            
            return {
                found: true,
                product: product,
                stock: product.stock,
                available: product.stock > 0,
                message: product.stock > 0 ? 
                    `${product.name} tersedia ${product.stock} unit dengan harga Rp ${this.formatPrice(product.price)}` :
                    `${product.name} sedang habis stok`
            };

        } catch (error) {
            console.error('Error checking stock:', error);
            return {
                found: false,
                message: 'Terjadi kesalahan saat mengecek stok. Silakan coba lagi.'
            };
        }
    }

    /**
     * Get products by category
     * @param {string} category - Product category
     * @returns {Promise<Array>} Array of products in category
     */
    async getProductsByCategory(category) {
        try {
            const products = await this.getAllProducts();
            const lowerCategory = category.toLowerCase();
            
            return products.filter(product => 
                product.category.toLowerCase() === lowerCategory
            );

        } catch (error) {
            console.error('Error getting products by category:', error);
            return [];
        }
    }

    /**
     * Get low stock products
     * @param {number} threshold - Stock threshold (default: 5)
     * @returns {Promise<Array>} Array of low stock products
     */
    async getLowStockProducts(threshold = 5) {
        try {
            const products = await this.getAllProducts();
            return products.filter(product => product.stock <= threshold && product.stock > 0);

        } catch (error) {
            console.error('Error getting low stock products:', error);
            return [];
        }
    }

    /**
     * Get out of stock products
     * @returns {Promise<Array>} Array of out of stock products
     */
    async getOutOfStockProducts() {
        try {
            const products = await this.getAllProducts();
            return products.filter(product => product.stock === 0);

        } catch (error) {
            console.error('Error getting out of stock products:', error);
            return [];
        }
    }

    /**
     * Update product stock (mock implementation)
     * @param {number} productId - Product ID
     * @param {number} newStock - New stock quantity
     * @returns {Promise<boolean>} Success status
     */
    async updateProductStock(productId, newStock) {
        try {
            // TODO: Implement actual Google Sheets update
            console.log(`Updating stock for product ${productId} to ${newStock} (mock)`);
            
            // Update mock data
            const productIndex = this.mockStockData.findIndex(p => p.id === productId);
            if (productIndex !== -1) {
                this.mockStockData[productIndex].stock = newStock;
                return true;
            }
            
            return false;

        } catch (error) {
            console.error('Error updating product stock:', error);
            return false;
        }
    }

    /**
     * Format price to Indonesian Rupiah format
     * @param {number} price - Price in number
     * @returns {string} Formatted price string
     */
    formatPrice(price) {
        return new Intl.NumberFormat('id-ID').format(price);
    }

    /**
     * Generate stock report
     * @returns {Promise<Object>} Stock report
     */
    async generateStockReport() {
        try {
            const products = await this.getAllProducts();
            const lowStock = await this.getLowStockProducts();
            const outOfStock = await this.getOutOfStockProducts();
            
            const totalValue = products.reduce((sum, product) => 
                sum + (product.stock * product.price), 0
            );

            return {
                totalProducts: products.length,
                totalStock: products.reduce((sum, product) => sum + product.stock, 0),
                totalValue: totalValue,
                lowStockCount: lowStock.length,
                outOfStockCount: outOfStock.length,
                categories: [...new Set(products.map(p => p.category))],
                lowStockProducts: lowStock,
                outOfStockProducts: outOfStock,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error generating stock report:', error);
            return {};
        }
    }

    /**
     * Test Google Sheets connection
     * @returns {Promise<boolean>} Connection status
     */
    async testConnection() {
        try {
            // TODO: Implement actual connection test
            console.log('Testing Google Sheets connection (mock)');
            
            // For now, just check if we have mock data
            return this.mockStockData.length > 0;

        } catch (error) {
            console.error('Error testing Google Sheets connection:', error);
            return false;
        }
    }

    /**
     * Initialize Google Sheets API (for future implementation)
     */
    async initialize() {
        try {
            console.log('Initializing Google Sheets service...');
            
            if (!this.sheetId) {
                console.warn('Google Sheet ID not configured, using mock data');
            }

            // TODO: Initialize Google Sheets API client
            // const auth = new google.auth.GoogleAuth({
            //     keyFile: this.serviceAccountPath,
            //     scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
            // });
            
            console.log('Google Sheets service initialized (mock mode)');
            return true;

        } catch (error) {
            console.error('Error initializing Google Sheets service:', error);
            return false;
        }
    }

    /**
     * Get service status
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            configured: !!this.sheetId,
            mockMode: !this.sheetId,
            apiKey: !!this.apiKey,
            serviceAccount: !!this.serviceAccountPath,
            mockDataCount: this.mockStockData.length
        };
    }
}

module.exports = new SheetService();
