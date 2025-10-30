/**
 * Production-Safe Logger
 *
 * Prevents console statement pollution in production while maintaining
 * full logging in development/staging environments.
 *
 * Usage:
 *   const logger = new Logger('PetProcessor');
 *   logger.log('Processing started');  // Only in dev/staging
 *   logger.error('Upload failed', error);  // Always logged (sanitized in prod)
 *   logger.warn('Cache full');  // Only in dev/staging
 *
 * Detection:
 *   - Development: localhost
 *   - Staging: shopifypreview.com
 *   - Production: perkieprints.com
 */

class Logger {
  constructor(namespace) {
    this.namespace = namespace;

    // Detect environment based on hostname
    const hostname = window.location.hostname;
    this.isDev = hostname.includes('localhost') ||
                 hostname.includes('127.0.0.1') ||
                 hostname.includes('shopifypreview');
    this.isProduction = hostname.includes('perkieprints.com') &&
                       !hostname.includes('shopifypreview');

    // Environment label for logs
    this.env = this.isProduction ? '[PROD]' :
               this.isDev ? '[DEV]' :
               '[STAGING]';
  }

  /**
   * Log informational messages (dev/staging only)
   * @param {...any} args - Arguments to log
   */
  log(...args) {
    if (this.isDev) {
      console.log(`${this.env} [${this.namespace}]`, ...args);
    }
  }

  /**
   * Log warnings (dev/staging only)
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    if (this.isDev) {
      console.warn(`${this.env} [${this.namespace}]`, ...args);
    }
  }

  /**
   * Log errors (always logged, sanitized in production)
   * @param {string} message - Error message
   * @param {Error|any} error - Error object or additional context
   */
  error(message, error) {
    if (this.isDev) {
      // Full error details in dev/staging
      console.error(`${this.env} [${this.namespace}] ${message}`, error);
      if (error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
    } else {
      // Sanitized error in production (no sensitive data)
      console.error(`${this.env} [${this.namespace}] Error occurred: ${message}`);

      // TODO: Send to monitoring service (e.g., Sentry, LogRocket)
      // this.sendToMonitoring(message, error);
    }
  }

  /**
   * Log debug information (dev only)
   * @param {...any} args - Arguments to log
   */
  debug(...args) {
    if (this.isDev) {
      console.debug(`${this.env} [${this.namespace}] DEBUG:`, ...args);
    }
  }

  /**
   * Log performance timing (always logged but simplified in production)
   * @param {string} operation - Operation name
   * @param {number} durationMs - Duration in milliseconds
   */
  perf(operation, durationMs) {
    const formattedTime = durationMs < 1000
      ? `${durationMs.toFixed(0)}ms`
      : `${(durationMs / 1000).toFixed(2)}s`;

    if (this.isDev) {
      console.log(`${this.env} [${this.namespace}] ⏱️ ${operation}: ${formattedTime}`);
    } else if (durationMs > 5000) {
      // Only log slow operations in production (> 5s)
      console.log(`${this.env} [${this.namespace}] Slow operation: ${operation}`);
    }
  }

  /**
   * Group logs together (dev/staging only)
   * @param {string} label - Group label
   * @param {Function} fn - Function to execute within the group
   */
  group(label, fn) {
    if (this.isDev) {
      console.group(`${this.env} [${this.namespace}] ${label}`);
      try {
        fn();
      } finally {
        console.groupEnd();
      }
    } else {
      // Just execute the function without grouping in production
      fn();
    }
  }

  /**
   * Log table data (dev/staging only)
   * @param {any} data - Data to display as table
   * @param {string} [label] - Optional label
   */
  table(data, label) {
    if (this.isDev) {
      if (label) {
        console.log(`${this.env} [${this.namespace}] ${label}:`);
      }
      console.table(data);
    }
  }

  /**
   * Send error to monitoring service (placeholder for future implementation)
   * @private
   */
  sendToMonitoring(message, error) {
    // TODO: Implement when monitoring service is added
    // Example with Sentry:
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     tags: { namespace: this.namespace },
    //     extra: { message }
    //   });
    // }
  }

  /**
   * Check if we're in development mode
   * @returns {boolean}
   */
  isDevelopment() {
    return this.isDev;
  }

  /**
   * Check if we're in production mode
   * @returns {boolean}
   */
  isProductionMode() {
    return this.isProduction;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
}

// Make available globally for Shopify theme integration
window.Logger = Logger;
