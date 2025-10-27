/**
 * Gemini Artistic API Client
 * Handles communication with Gemini Pro 2.5 Flash Image API
 * Provides Modern (ink_wash) and Classic (van_gogh) artistic styles
 */

export class GeminiArtisticClient {
  constructor() {
    this.baseUrl = 'https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app';
    this.cache = new Map();
    this.pending = new Map();
    this.maxRetries = 2;
    this.timeout = 60000; // 60 seconds for Gemini API (slower than InSPyReNet)

    // Rate limiting: 5 requests per day per user (stored in localStorage)
    this.rateLimitKey = 'gemini_artistic_rate_limit';
    this.maxRequestsPerDay = 5;
  }

  /**
   * Check if user has exceeded rate limit
   * @returns {Object} { allowed: boolean, remaining: number, resetTime: Date }
   */
  checkRateLimit() {
    const stored = localStorage.getItem(this.rateLimitKey);
    const now = new Date();

    if (!stored) {
      // First request ever
      return { allowed: true, remaining: this.maxRequestsPerDay - 1, resetTime: this.getNextResetTime(now) };
    }

    const data = JSON.parse(stored);
    const resetTime = new Date(data.resetTime);

    // Check if we need to reset (past midnight)
    if (now >= resetTime) {
      return { allowed: true, remaining: this.maxRequestsPerDay - 1, resetTime: this.getNextResetTime(now) };
    }

    // Check if user has requests remaining
    if (data.count >= this.maxRequestsPerDay) {
      return { allowed: false, remaining: 0, resetTime };
    }

    return { allowed: true, remaining: this.maxRequestsPerDay - data.count - 1, resetTime };
  }

  /**
   * Get next rate limit reset time (midnight)
   */
  getNextResetTime(now) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Increment rate limit counter
   */
  incrementRateLimit() {
    const stored = localStorage.getItem(this.rateLimitKey);
    const now = new Date();

    if (!stored) {
      localStorage.setItem(this.rateLimitKey, JSON.stringify({
        count: 1,
        resetTime: this.getNextResetTime(now).toISOString()
      }));
      return;
    }

    const data = JSON.parse(stored);
    const resetTime = new Date(data.resetTime);

    // Reset if past midnight
    if (now >= resetTime) {
      localStorage.setItem(this.rateLimitKey, JSON.stringify({
        count: 1,
        resetTime: this.getNextResetTime(now).toISOString()
      }));
      return;
    }

    // Increment counter
    data.count++;
    localStorage.setItem(this.rateLimitKey, JSON.stringify(data));
  }

  /**
   * Apply artistic style to background-removed image
   * @param {Blob} imageBlob - Background-removed image blob
   * @param {string} style - 'modern' (ink_wash) or 'classic' (van_gogh)
   * @returns {Promise<Blob>} - Styled image blob
   */
  async applyStyle(imageBlob, style) {
    // Check rate limit first
    const rateLimit = this.checkRateLimit();
    if (!rateLimit.allowed) {
      const hoursUntilReset = Math.ceil((rateLimit.resetTime - new Date()) / (1000 * 60 * 60));
      throw new Error(`Rate limit exceeded. You have used all ${this.maxRequestsPerDay} Modern/Classic style requests today. Please try again in ${hoursUntilReset} hours.`);
    }

    // Map frontend style names to Gemini API style names
    const styleMapping = {
      'modern': 'ink_wash',
      'classic': 'van_gogh_post_impressionism'
    };

    const geminiStyle = styleMapping[style];
    if (!geminiStyle) {
      throw new Error(`Invalid style: ${style}. Must be 'modern' or 'classic'.`);
    }

    const formData = new FormData();
    formData.append('image', imageBlob, 'pet.png');
    formData.append('style', geminiStyle);

    try {
      const result = await this.request('/generate-artistic', {
        method: 'POST',
        body: formData,
        timeout: 60000 // 60 seconds for Gemini processing
      });

      // Increment rate limit on success
      this.incrementRateLimit();

      return result;
    } catch (error) {
      console.error('Gemini artistic style failed:', error);
      throw error;
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = this.getCacheKey(url, options);

    // Check cache first (only for GET requests)
    if (options.method === 'GET' && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (!this.isStale(cached)) {
        return cached.data;
      }
    }

    // Deduplicate identical requests
    if (this.pending.has(cacheKey)) {
      return this.pending.get(cacheKey);
    }

    // Execute with retry logic
    const promise = this.executeWithRetry(url, options);
    this.pending.set(cacheKey, promise);

    try {
      const result = await promise;
      this.pending.delete(cacheKey);

      // Cache successful GET requests
      if (options.method === 'GET') {
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;
    } catch (error) {
      this.pending.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Execute request with retry logic
   */
  async executeWithRetry(url, options, attempt = 1) {
    try {
      const controller = new AbortController();
      const timeout = options.timeout || this.timeout;

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        mode: 'cors',
        headers: {
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
      }

      // Handle different response types
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else if (contentType && contentType.startsWith('image/')) {
        return await response.blob();
      } else {
        return await response.text();
      }

    } catch (error) {
      // Retry on network errors or timeouts (not on 4xx errors)
      if (attempt < this.maxRetries && this.isRetryableError(error)) {
        console.warn(`Gemini API request failed (attempt ${attempt}/${this.maxRetries}), retrying...`, error.message);
        await this.delay(1000 * attempt); // Exponential backoff
        return this.executeWithRetry(url, options, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    // Network errors, timeouts, and 5xx errors are retryable
    return error.name === 'AbortError' ||
           error.message.includes('NetworkError') ||
           error.message.includes('500') ||
           error.message.includes('502') ||
           error.message.includes('503') ||
           error.message.includes('504');
  }

  /**
   * Generate cache key
   */
  getCacheKey(url, options) {
    const method = options.method || 'GET';
    return `${method}:${url}`;
  }

  /**
   * Check if cached data is stale (1 hour TTL)
   */
  isStale(cached) {
    const ttl = 60 * 60 * 1000; // 1 hour
    return Date.now() - cached.timestamp > ttl;
  }

  /**
   * Delay utility for retry backoff
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await this.request('/health', { method: 'GET', timeout: 5000 });
      return response;
    } catch (error) {
      console.error('Gemini API health check failed:', error);
      throw error;
    }
  }

  /**
   * Get available styles
   */
  getAvailableStyles() {
    return [
      {
        id: 'modern',
        name: 'Modern',
        description: 'Ink wash artistic style with soft, flowing brushstrokes',
        geminiStyle: 'ink_wash'
      },
      {
        id: 'classic',
        name: 'Classic',
        description: 'Van Gogh post-impressionism with bold colors and expressive strokes',
        geminiStyle: 'van_gogh_post_impressionism'
      }
    ];
  }

  /**
   * Clear rate limit (for testing/admin only)
   */
  clearRateLimit() {
    localStorage.removeItem(this.rateLimitKey);
    console.log('Rate limit cleared');
  }
}

// Create singleton instance
export const geminiClient = new GeminiArtisticClient();
