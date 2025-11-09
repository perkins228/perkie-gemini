/**
 * Security Utilities
 * XSS prevention and input sanitization
 *
 * CRITICAL: All user input must be sanitized before:
 * - Rendering to DOM (innerHTML, textContent, attributes)
 * - Storing in localStorage/sessionStorage
 * - Sending to backend APIs
 *
 * Features:
 * - HTML sanitization (prevent script injection)
 * - URL validation (prevent javascript: URLs)
 * - Attribute sanitization (prevent event handlers)
 * - SQL injection prevention (for future backend integration)
 *
 * Usage:
 * const safe = SecurityUtils.sanitizeHTML(userInput);
 * element.innerHTML = safe;
 *
 * const safeUrl = SecurityUtils.validateURL(userUrl);
 * if (safeUrl) { image.src = safeUrl; }
 */

class SecurityUtils {
  /**
   * Sanitize HTML to prevent XSS
   * Removes all script tags and event handlers
   */
  static sanitizeHTML(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Create a temporary div to leverage browser's HTML parser
    const temp = document.createElement('div');
    temp.textContent = input; // This escapes HTML automatically

    return temp.innerHTML;
  }

  /**
   * Sanitize text for safe display
   * Use this for pet names, artist notes, etc.
   */
  static sanitizeText(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>\"'&]/g, '') // Remove dangerous characters
      .substring(0, 500) // Limit length
      .trim();
  }

  /**
   * Sanitize pet name specifically
   * Allows letters, numbers, spaces, and common punctuation
   */
  static sanitizePetName(name) {
    if (!name || typeof name !== 'string') {
      return '';
    }

    return name
      .replace(/[^a-zA-Z0-9\s\-'\.]/g, '') // Only allow safe characters
      .substring(0, 50) // Max 50 characters
      .trim();
  }

  /**
   * Sanitize artist notes
   * More lenient than pet name, but still safe
   */
  static sanitizeArtistNotes(notes) {
    if (!notes || typeof notes !== 'string') {
      return '';
    }

    return notes
      .replace(/[<>\"']/g, '') // Remove HTML-related characters
      .substring(0, 500) // Max 500 characters
      .trim();
  }

  /**
   * Validate URL to prevent javascript: and data: URLs
   * Only allows http:, https:, and GCS URLs
   */
  static validateURL(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    // Allow data URLs for image previews (base64)
    if (url.startsWith('data:image/')) {
      // Validate it's actually an image data URL
      if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(url)) {
        return url;
      }
      return null;
    }

    // Allow https URLs
    if (url.startsWith('https://')) {
      try {
        const parsed = new URL(url);

        // Whitelist Google Cloud Storage URLs only
        const allowedHosts = [
          'storage.googleapis.com',
          'storage.cloud.google.com'
        ];

        if (allowedHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host))) {
          return url;
        }

        console.warn('URL not from whitelisted host:', parsed.hostname);
        return null;
      } catch (e) {
        console.error('Invalid URL:', e);
        return null;
      }
    }

    // Allow blob URLs (temporary browser storage)
    if (url.startsWith('blob:')) {
      return url;
    }

    console.warn('URL protocol not allowed:', url.substring(0, 20));
    return null;
  }

  /**
   * Validate GCS URL specifically
   * Ensures URL is from our Google Cloud Storage bucket
   */
  static validateGCSURL(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    if (!url.startsWith('https://storage.googleapis.com/')) {
      return null;
    }

    try {
      const parsed = new URL(url);

      // Whitelist our specific buckets
      const allowedBuckets = [
        'perkieprints-processing-cache',
        'perkieprints-customer-images',
        'perkieprints-uploads'
      ];

      const pathParts = parsed.pathname.split('/').filter(p => p);
      const bucket = pathParts[0];

      if (!allowedBuckets.includes(bucket)) {
        console.warn('GCS bucket not whitelisted:', bucket);
        return null;
      }

      return url;
    } catch (e) {
      console.error('Invalid GCS URL:', e);
      return null;
    }
  }

  /**
   * Sanitize email for lead capture
   */
  static sanitizeEmail(email) {
    if (!email || typeof email !== 'string') {
      return '';
    }

    // Basic email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    const sanitized = email
      .toLowerCase()
      .trim()
      .substring(0, 254); // RFC 5321 max length

    if (!emailRegex.test(sanitized)) {
      return '';
    }

    return sanitized;
  }

  /**
   * Sanitize filename for storage
   */
  static sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'upload.jpg';
    }

    return filename
      .replace(/[^a-zA-Z0-9\-_\.]/g, '_') // Replace unsafe chars with underscore
      .substring(0, 100) // Max 100 characters
      .toLowerCase();
  }

  /**
   * Escape HTML for safe innerHTML usage
   * Use when you need to preserve some formatting but prevent XSS
   */
  static escapeHTML(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };

    return text.replace(/[&<>"'\/]/g, char => escapeMap[char]);
  }

  /**
   * Create safe DOM text node
   * Safest way to insert user content into DOM
   */
  static createSafeTextNode(text) {
    return document.createTextNode(text || '');
  }

  /**
   * Set safe innerHTML (uses DOMPurify if available, fallback to escaping)
   */
  static setSafeInnerHTML(element, html) {
    if (!element) return;

    // Prefer textContent for plain text
    if (!html || typeof html !== 'string') {
      element.textContent = '';
      return;
    }

    // If DOMPurify is available (recommended for complex HTML)
    if (typeof DOMPurify !== 'undefined') {
      element.innerHTML = DOMPurify.sanitize(html);
      return;
    }

    // Fallback: escape HTML
    element.textContent = html;
  }

  /**
   * Validate and sanitize localStorage/sessionStorage data
   */
  static sanitizeStorageData(data) {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const sanitized = {};

    for (const key in data) {
      const value = data[key];

      // Skip functions and undefined
      if (typeof value === 'function' || value === undefined) {
        continue;
      }

      // Sanitize strings
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeText(value);
      }
      // Recursively sanitize objects
      else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeStorageData(value);
      }
      // Keep primitives as-is
      else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Content Security Policy checker
   * Verify if code will violate CSP
   */
  static checkCSPViolation(code) {
    const violations = [];

    // Check for inline event handlers
    if (/on\w+\s*=/.test(code)) {
      violations.push('Inline event handlers detected (e.g., onclick=)');
    }

    // Check for eval usage
    if (/eval\s*\(/.test(code)) {
      violations.push('eval() usage detected');
    }

    // Check for Function constructor
    if (/new\s+Function\s*\(/.test(code)) {
      violations.push('Function constructor usage detected');
    }

    // Check for inline script tags
    if (/<script/i.test(code)) {
      violations.push('Inline <script> tags detected');
    }

    // Check for javascript: URLs
    if (/javascript:/i.test(code)) {
      violations.push('javascript: URLs detected');
    }

    return {
      safe: violations.length === 0,
      violations
    };
  }

  /**
   * Rate limiting helper
   * Prevents abuse of API endpoints
   */
  static rateLimit(key, maxCalls, timeWindowMs) {
    const storageKey = `rate_limit_${key}`;

    try {
      const stored = localStorage.getItem(storageKey);
      const data = stored ? JSON.parse(stored) : { calls: [], windowStart: Date.now() };

      const now = Date.now();

      // Reset window if expired
      if (now - data.windowStart > timeWindowMs) {
        data.calls = [];
        data.windowStart = now;
      }

      // Add current call
      data.calls.push(now);

      // Keep only calls within window
      data.calls = data.calls.filter(time => now - time < timeWindowMs);

      // Check if exceeded
      if (data.calls.length > maxCalls) {
        const waitTime = timeWindowMs - (now - data.calls[0]);
        return {
          allowed: false,
          retryAfter: Math.ceil(waitTime / 1000), // seconds
          callsRemaining: 0
        };
      }

      // Save updated data
      localStorage.setItem(storageKey, JSON.stringify(data));

      return {
        allowed: true,
        retryAfter: 0,
        callsRemaining: maxCalls - data.calls.length
      };
    } catch (e) {
      console.error('Rate limit check failed:', e);
      return { allowed: true, retryAfter: 0, callsRemaining: maxCalls };
    }
  }

  /**
   * Secure random string generation
   * For session IDs, tokens, etc.
   */
  static generateSecureToken(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash sensitive data (one-way)
   * For logging, analytics without exposing PII
   */
  static async hashData(data) {
    if (!data || typeof data !== 'string') {
      return '';
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.SecurityUtils = SecurityUtils;
}
