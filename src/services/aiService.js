const axios = require('axios');

class AiService {
    constructor() {
        this.apiToken = process.env.OPENROUTER_API_TOKEN;
        this.baseUrl = 'https://openrouter.ai/api/v1';
        this.defaultModel = process.env.OPENROUTER_DEFAULT_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
        
        if (!this.apiToken) {
            console.warn('Warning: OPENROUTER_API_TOKEN not found in environment variables');
        }
    }

    /**
     * Generate AI response using OpenRouter API
     * @param {string} prompt - The user's message/prompt
     * @param {string} context - Additional context from PDF or other sources
     * @param {string} model - AI model to use (optional)
     * @returns {Promise<string>} AI generated response
     */
    async generateResponse(prompt, context = '', model = null) {
        try {
            if (!this.apiToken) {
                throw new Error('OpenRouter API token is not configured');
            }

            const messages = [
                {
                    role: 'system',
                    content: context || ''
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const requestData = {
                model: model || this.defaultModel,
                messages: messages,
                max_tokens: 500,
                temperature: 0.7,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            };

            console.log(`Sending request to OpenRouter API with model: ${requestData.model}`);

            const response = await axios.post(`${this.baseUrl}/chat/completions`, requestData, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/your-repo', // Optional: for analytics
                    'X-Title': 'WhatsApp RAG Chatbot' // Optional: for analytics
                },
                timeout: 30000 // 30 seconds timeout
            });

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const aiResponse = response.data.choices[0].message.content.trim();
                console.log('AI response generated successfully');
                return aiResponse;
            } else {
                throw new Error('Invalid response format from OpenRouter API');
            }

        } catch (error) {
            console.error('Error generating AI response:', error.message);
            
            if (error.response) {
                console.error('API Error Status:', error.response.status);
                console.error('API Error Data:', error.response.data);
            }

            // Return fallback response
            return this.getFallbackResponse(prompt);
        }
    }

    /**
     * Get fallback response when AI service fails
     * @param {string} prompt - Original user prompt
     * @returns {string} Fallback response
     */
    getFallbackResponse(prompt) {
        const storeName = process.env.STORE_NAME || 'Toko Sepatu Berkualitas';
        
        // Simple keyword-based responses
        const lowerPrompt = prompt.toLowerCase();
        
        if (lowerPrompt.includes('halo') || lowerPrompt.includes('hai') || lowerPrompt.includes('hello')) {
            return `Halo! Selamat datang di ${storeName} 👋\nAda yang bisa saya bantu hari ini?`;
        }
        
        if (lowerPrompt.includes('jam') && lowerPrompt.includes('buka')) {
            return `Untuk informasi jam buka toko, mohon tunggu sebentar ya. Saya akan menghubungkan Anda dengan staff kami.`;
        }
        
        if (lowerPrompt.includes('stok') || lowerPrompt.includes('tersedia')) {
            return `Untuk informasi stok produk, mohon tunggu sebentar ya. Saya akan cek ketersediaan untuk Anda.`;
        }
        
        if (lowerPrompt.includes('harga') || lowerPrompt.includes('berapa')) {
            return `Untuk informasi harga, mohon tunggu sebentar ya. Saya akan menghubungkan Anda dengan staff kami.`;
        }
        
        // Default fallback
        return `Terima kasih atas pertanyaan Anda. Saat ini sistem sedang mengalami gangguan, ` +
               `tapi saya akan segera menghubungkan Anda dengan staff ${storeName} untuk membantu Anda. ` +
               `Mohon tunggu sebentar ya! 🙏`;
    }

    /**
     * Test API connection
     * @returns {Promise<boolean>} True if connection successful
     */
    async testConnection() {
        try {
            const testResponse = await this.generateResponse('Test connection', '', this.defaultModel);
            return testResponse && testResponse.length > 0;
        } catch (error) {
            console.error('API connection test failed:', error.message);
            return false;
        }
    }

    /**
     * Get available models (if needed for dynamic model selection)
     * @returns {Promise<Array>} Array of available models
     */
    async getAvailableModels() {
        try {
            const response = await axios.get(`${this.baseUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.data || [];
        } catch (error) {
            console.error('Error fetching available models:', error.message);
            return [];
        }
    }
}

module.exports = new AiService();
