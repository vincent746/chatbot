const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = './logs';
        this.ensureLogDirectory();
    }

    /**
     * Ensure log directory exists
     */
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Get current date string for log filename
     * @returns {string} Date string in YYYY-MM-DD format
     */
    getCurrentDateString() {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }

    /**
     * Get current timestamp for log entries
     * @returns {string} Timestamp string
     */
    getCurrentTimestamp() {
        return new Date().toISOString();
    }

    /**
     * Write log entry to file
     * @param {string} level - Log level (INFO, ERROR, WARN, DEBUG)
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    writeLog(level, message, data = null) {
        const timestamp = this.getCurrentTimestamp();
        const dateString = this.getCurrentDateString();
        const logFile = path.join(this.logDir, `${dateString}.log`);

        let logEntry = `[${timestamp}] [${level}] ${message}`;
        
        if (data) {
            logEntry += ` | Data: ${JSON.stringify(data)}`;
        }
        
        logEntry += '\n';

        // Write to file
        fs.appendFileSync(logFile, logEntry);

        // Also log to console with colors
        this.logToConsole(level, message, data, timestamp);
    }

    /**
     * Log to console with colors
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     * @param {string} timestamp - Timestamp
     */
    logToConsole(level, message, data, timestamp) {
        const colors = {
            INFO: '\x1b[36m',    // Cyan
            ERROR: '\x1b[31m',   // Red
            WARN: '\x1b[33m',    // Yellow
            DEBUG: '\x1b[35m',   // Magenta
            SUCCESS: '\x1b[32m', // Green
            RESET: '\x1b[0m'     // Reset
        };

        const color = colors[level] || colors.RESET;
        const resetColor = colors.RESET;
        
        let consoleMessage = `${color}[${timestamp}] [${level}] ${message}${resetColor}`;
        
        if (data) {
            consoleMessage += `\n${color}Data: ${JSON.stringify(data, null, 2)}${resetColor}`;
        }

        console.log(consoleMessage);
    }

    /**
     * Log info message
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     */
    info(message, data = null) {
        this.writeLog('INFO', message, data);
    }

    /**
     * Log error message
     * @param {string} message - Log message
     * @param {Object} data - Additional data (can include error object)
     */
    error(message, data = null) {
        this.writeLog('ERROR', message, data);
    }

    /**
     * Log warning message
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     */
    warn(message, data = null) {
        this.writeLog('WARN', message, data);
    }

    /**
     * Log debug message
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     */
    debug(message, data = null) {
        if (process.env.NODE_ENV === 'development') {
            this.writeLog('DEBUG', message, data);
        }
    }

    /**
     * Log success message
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     */
    success(message, data = null) {
        this.writeLog('SUCCESS', message, data);
    }

    /**
     * Log WhatsApp message activity
     * @param {string} from - Sender phone number
     * @param {string} message - Message content
     * @param {string} direction - 'incoming' or 'outgoing'
     */
    logMessage(from, message, direction = 'incoming') {
        const logData = {
            from: from,
            message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
            direction: direction,
            messageLength: message.length
        };

        this.info(`WhatsApp ${direction} message`, logData);
    }

    /**
     * Log bot response with context information
     * @param {string} userQuery - Original user query
     * @param {string} botResponse - Bot's response
     * @param {boolean} hasContext - Whether context was used
     * @param {number} processingTime - Processing time in milliseconds
     */
    logBotResponse(userQuery, botResponse, hasContext = false, processingTime = 0) {
        const logData = {
            userQuery: userQuery.substring(0, 100) + (userQuery.length > 100 ? '...' : ''),
            responseLength: botResponse.length,
            hasContext: hasContext,
            processingTime: `${processingTime}ms`
        };

        this.info('Bot response generated', logData);
    }

    /**
     * Log system errors with stack trace
     * @param {Error} error - Error object
     * @param {string} context - Context where error occurred
     */
    logError(error, context = 'Unknown') {
        const errorData = {
            context: context,
            message: error.message,
            stack: error.stack,
            name: error.name
        };

        this.error(`System error in ${context}`, errorData);
    }

    /**
     * Clean old log files (keep only last 30 days)
     */
    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logDir);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            files.forEach(file => {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime < thirtyDaysAgo) {
                        fs.unlinkSync(filePath);
                        this.info(`Deleted old log file: ${file}`);
                    }
                }
            });
        } catch (error) {
            this.error('Error cleaning old logs', { error: error.message });
        }
    }
}

module.exports = new Logger();
