/**
 * Gemini API Client - AI Artistic Effects
 * Handles communication with Gemini Artistic API
 * Integrates with existing Pet Processor architecture
 *
 * Features:
 * - Batch generation (Ink Wash + Marker together)
 * - Rate limit tracking (10/day with 4-level warnings)
 * - Feature flag support for gradual rollout
 * - Retry logic with exponential backoff
 * - Session-based customer ID for quota tracking
 */

class GeminiAPIClient {
  constructor() {
    this.baseUrl = 'https://gemini-artistic-api-753651513695.us-central1.run.app';
    this.cache = new Map();
    this.pending = new Map();
    this.maxRetries = 3;
    // Timeout calculation (2025-11-04):
    // - Cold start (Cloud Run + Gemini SDK): ~38s
    // - Generation (batch 2 styles): ~37s
    // - Buffer (20%): ~15s
    // Total: 90s → 120s for P95 safety margin
    this.timeout = 120000; // 120 seconds (handles cold start + generation)

    // Feature flag - check if Gemini effects are enabled
    this.enabled = this.checkFeatureFlag();

    // Customer ID for rate limiting (session-based with localStorage persistence)
    this.customerId = this.getOrCreateCustomerId();

    // Quota state (cached from last API response)
    // FIX: Include 'allowed: true' so timeout fallback doesn't trigger false exhaustion
    this.quotaState = {
      allowed: true,      // Essential for quota check fallback
      remaining: 10,
      limit: 10,
      warningLevel: 1,
      lastChecked: null
    };
  }

  /**
   * Check if Gemini effects are enabled via feature flag
   * Simple enable/disable flag - effects available to 100% of traffic by default
   *
   * Only disabled if explicitly set to 'false' in localStorage
   */
  checkFeatureFlag() {
    try {
      // Check explicit disable flag
      const globalFlag = localStorage.getItem('gemini_effects_enabled');
      if (globalFlag === 'false') {
        console.log('🎨 Gemini effects explicitly disabled via feature flag');
        return false;
      }

      // Enabled for all traffic by default
      console.log('🎨 Gemini effects enabled (available to all users)');
      return true;
    } catch (error) {
      console.error('🎨 Feature flag check failed:', error);
      return false; // Fail closed
    }
  }

  /**
   * Get or create persistent customer ID for rate limiting
   */
  getOrCreateCustomerId() {
    try {
      // Try localStorage first (persists across sessions)
      let customerId = localStorage.getItem('gemini_customer_id');

      if (!customerId) {
        // Generate new ID: timestamp + random
        customerId = 'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('gemini_customer_id', customerId);
      }

      return customerId;
    } catch (error) {
      // Fallback to session-only ID if localStorage fails
      if (!this._sessionCustomerId) {
        this._sessionCustomerId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
      return this._sessionCustomerId;
    }
  }

  /**
   * Check rate limit quota without consuming it
   */
  async checkQuota() {
    if (!this.enabled) {
      return { allowed: true, remaining: 10, limit: 10, warningLevel: 1 };
    }

    try {
      const response = await this.request(`/api/v1/quota?customer_id=${this.customerId}`, {
        method: 'GET',
        timeout: 15000 // 15 seconds (handles cold start Firestore connection)
      });

      // Update cached quota state with 'allowed' property
      this.quotaState = {
        allowed: response.allowed !== false,  // Default true if missing
        remaining: response.remaining,
        limit: response.limit,
        warningLevel: response.warning_level,
        lastChecked: Date.now()
      };

      return response;
    } catch (error) {
      console.error('Quota check failed:', error);
      // Return cached state on error
      return this.quotaState;
    }
  }

  /**
   * Generate both artistic styles at once (Ink Wash + Marker)
   * This is more efficient than calling generate() twice
   */
  async batchGenerate(imageDataUrl, options = {}) {
    if (!this.enabled) {
      throw new Error('Gemini effects are not enabled');
    }

    // Check quota before making expensive API call
    const quota = await this.checkQuota();
    if (!quota.allowed || quota.remaining < 1) {
      const error = new Error('Daily quota exhausted');
      error.quotaExhausted = true;
      error.remaining = quota.remaining;
      throw error;
    }

    // Extract base64 from data URL
    const base64Image = imageDataUrl.includes(',')
      ? imageDataUrl.split(',')[1]
      : imageDataUrl;

    const requestBody = {
      image_data: base64Image,
      customer_id: this.customerId,
      session_id: options.sessionId || ('session_' + Date.now())
    };

    try {
      const response = await this.request('/api/v1/batch-generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });

      // Update quota state from response
      this.quotaState = {
        remaining: response.quota_remaining,
        limit: response.quota_limit,
        warningLevel: response.warning_level,
        lastChecked: Date.now()
      };

      // Transform response to our format
      return {
        success: true,
        ink_wash: {
          url: response.results.ink_wash.image_url,
          cacheHit: response.results.ink_wash.cache_hit,
          processingTime: response.results.ink_wash.processing_time_ms
        },
        sketch: {
          url: response.results.pen_and_marker.image_url,
          cacheHit: response.results.pen_and_marker.cache_hit,
          processingTime: response.results.pen_and_marker.processing_time_ms
        },
        quota: {
          remaining: response.quota_remaining,
          limit: response.quota_limit,
          warningLevel: response.warning_level
        },
        totalProcessingTime: response.total_processing_time_ms
      };
    } catch (error) {
      // Enhance error with quota information
      if (error.response && error.response.status === 429) {
        error.quotaExhausted = true;
        error.remaining = 0;
      }
      throw error;
    }
  }

  /**
   * Generate single artistic style
   * Use batchGenerate() if you need both styles - it's more efficient
   */
  async generate(imageDataUrl, style, options = {}) {
    if (!this.enabled) {
      throw new Error('Gemini effects are not enabled');
    }

    // Check quota before making expensive API call
    const quota = await this.checkQuota();
    if (!quota.allowed || quota.remaining < 1) {
      const error = new Error('Daily quota exhausted');
      error.quotaExhausted = true;
      error.remaining = quota.remaining;
      throw error;
    }

    // Extract base64 from data URL
    const base64Image = imageDataUrl.includes(',')
      ? imageDataUrl.split(',')[1]
      : imageDataUrl;

    // Map our style names to API enum
    const styleMap = {
      'ink_wash': 'ink_wash',
      'sketch': 'pen_and_marker'
    };

    const requestBody = {
      image_data: base64Image,
      style: styleMap[style] || style,
      customer_id: this.customerId,
      session_id: options.sessionId || ('session_' + Date.now())
    };

    try {
      const response = await this.request('/api/v1/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });

      // Update quota state from response
      this.quotaState = {
        remaining: response.quota_remaining,
        limit: response.quota_limit,
        warningLevel: response.warning_level,
        lastChecked: Date.now()
      };

      return {
        success: true,
        url: response.image_url,
        originalUrl: response.original_url,
        style: response.style,
        cacheHit: response.cache_hit,
        quota: {
          remaining: response.quota_remaining,
          limit: response.quota_limit,
          warningLevel: response.warning_level
        },
        processingTime: response.processing_time_ms
      };
    } catch (error) {
      // Enhance error with quota information
      if (error.response && error.response.status === 429) {
        error.quotaExhausted = true;
        error.remaining = 0;
      }
      throw error;
    }
  }

  /**
   * Core request method with retry logic and timeout
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = this.getCacheKey(url, options);

    // Check cache for GET requests
    if (options.method === 'GET' && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (!this.isStale(cached)) {
        return cached.data;
      }
    }

    // Deduplicate identical pending requests
    if (this.pending.has(cacheKey)) {
      return this.pending.get(cacheKey);
    }

    // Create request promise with retry logic
    const requestPromise = this.executeWithRetry(url, options);
    this.pending.set(cacheKey, requestPromise);

    try {
      const data = await requestPromise;

      // Cache GET responses
      if (options.method === 'GET') {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }

      return data;
    } finally {
      this.pending.delete(cacheKey);
    }
  }

  /**
   * Execute request with exponential backoff retry
   */
  async executeWithRetry(url, options, attempt = 0) {
    try {
      const response = await this.fetchWithTimeout(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.detail || `HTTP ${response.status}`);
        error.response = response;
        error.data = errorData;

        // Don't retry 4xx errors (except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw error;
        }

        // Retry 5xx and 429 errors
        if (attempt < this.maxRetries) {
          const delay = this.getRetryDelay(attempt);
          console.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.maxRetries})`);
          await this.sleep(delay);
          return this.executeWithRetry(url, options, attempt + 1);
        }

        throw error;
      }

      return response.json();
    } catch (error) {
      // Don't retry timeout errors (they won't succeed on retry)
      // Don't retry user-cancelled AbortErrors
      // Do retry transient network errors
      if (attempt < this.maxRetries && !error.isTimeout && error.name !== 'AbortError') {
        const delay = this.getRetryDelay(attempt);
        console.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.maxRetries})`);
        await this.sleep(delay);
        return this.executeWithRetry(url, options, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Fetch with timeout support
   * Marks timeout errors to prevent retry loops
   */
  async fetchWithTimeout(url, options) {
    const timeout = options.timeout || this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      // Mark signal as timeout for retry logic
      controller.signal.reason = 'timeout';
    }, timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      // Mark timeout AbortErrors to prevent retry
      if (error.name === 'AbortError' && controller.signal.reason === 'timeout') {
        error.isTimeout = true;
        error.message = `Request timed out after ${timeout}ms`;
      }
      throw error;
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  getRetryDelay(attempt) {
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate cache key from URL and options
   */
  getCacheKey(url, options) {
    const key = url + JSON.stringify({
      method: options.method,
      body: options.body
    });
    return key;
  }

  /**
   * Check if cached data is stale
   */
  isStale(cached) {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return (Date.now() - cached.timestamp) > maxAge;
  }

  /**
   * Get current warning level based on quota state
   * 1 = silent, 2 = reminder, 3 = warning, 4 = exhausted
   */
  getWarningLevel() {
    return this.quotaState.warningLevel;
  }

  /**
   * Check if quota is exhausted
   */
  isQuotaExhausted() {
    return this.quotaState.remaining === 0;
  }

  /**
   * Get remaining quota
   */
  getRemainingQuota() {
    return this.quotaState.remaining;
  }

  /**
   * Enable Gemini effects (for admin/testing)
   */
  static enableGlobalFlag() {
    localStorage.setItem('gemini_effects_enabled', 'true');
    localStorage.setItem('gemini_rollout_percent', '100');
  }

  /**
   * Disable Gemini effects (for admin/testing)
   */
  static disableGlobalFlag() {
    localStorage.setItem('gemini_effects_enabled', 'false');
  }

  /**
   * Set rollout percentage (for gradual rollout)
   */
  static setRolloutPercent(percent) {
    localStorage.setItem('gemini_rollout_percent', String(percent));
  }
}

// Export to global scope for Shopify
window.GeminiAPIClient = GeminiAPIClient;
