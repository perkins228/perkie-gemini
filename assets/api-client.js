/**
 * API Client - Backend Communication Module
 * Handles all API interactions with background removal service
 * Smart retry logic, caching, and progress tracking
 *
 * STAGING: Using BiRefNet service (60-100x faster than InSPyReNet)
 * PRODUCTION: 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app'
 */

// Toggle between services (set to true for BiRefNet staging)
const USE_BIREFNET = true;

const API_URLS = {
  inspirenet: 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app',
  birefnet: 'https://birefnet-bg-removal-api-753651513695.us-central1.run.app'
};

export class APIClient {
  constructor() {
    this.baseUrl = USE_BIREFNET ? API_URLS.birefnet : API_URLS.inspirenet;
    this.cache = new Map();
    this.pending = new Map();
    this.maxRetries = 2;
    this.timeout = 30000; // 30 seconds

    console.log(`🔧 API Client initialized with ${USE_BIREFNET ? 'BiRefNet' : 'InSPyReNet'} service`);
  }

  async removeBackground(file) {
    const formData = new FormData();
    formData.append('file', file);

    // Request effects based on which service is active
    // BiRefNet: color, enhancedblackwhite (alias for blackwhite)
    // InSPyReNet: color, enhancedblackwhite, optimized_popart, dithering
    const effects = USE_BIREFNET
      ? 'color,enhancedblackwhite'
      : 'color,enhancedblackwhite,optimized_popart,dithering';

    formData.append('effects', effects);
    formData.append('session_id', 'perkie_' + Date.now());
    // Note: return_all_effects must be URL query parameter, not form data

    return this.request('/api/v2/process-with-effects?return_all_effects=true', {
      method: 'POST',
      body: formData,
      timeout: USE_BIREFNET ? 30000 : 45000 // BiRefNet is faster
    });
  }

  // Remove applyEffect method - not needed with server-side processing
  // The old working code got all effects from single API call

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = this.getCacheKey(url, options);

    // Check cache first
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
          'Accept': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Handle different response types
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        
        // Handle v2 API JSON response with multiple effects
        if (data.effects) {
          // Store all effects for instant switching, convert to blob URLs for proper orientation
          // Use separate variable to avoid conflict with pet selector's Map
          if (!window.perkieApiEffects) {
            window.perkieApiEffects = {};
          }
          
          // Store blobs AND URLs separately for proper memory management
          const effectBlobs = new Map();
          
          // Convert all base64 effects to blob URLs (preserves orientation like old code)
          for (const [effectName, base64Data] of Object.entries(data.effects)) {
            try {
              const blob = await this.base64ToBlob(base64Data, 'image/png');
              const blobUrl = URL.createObjectURL(blob);
              
              // Store both blob and URL for proper cleanup like working code
              effectBlobs.set(effectName, blob);
              window.perkieApiEffects[effectName] = blobUrl;
            } catch (error) {
              console.error(`Failed to convert ${effectName} effect:`, error);
            }
          }
          
          // Store blobs for potential future use (matches working code pattern)
          window.perkieEffectBlobs = effectBlobs;
          
          console.log('🎯 Processed effects from API:', Object.keys(window.perkieApiEffects));
          
          // Return the color effect (background removed, no filters) or first available
          // This matches the working code approach
          if (window.perkieApiEffects.color) {
            return window.perkieApiEffects.color;
          } else {
            const firstEffect = Object.values(window.perkieApiEffects)[0];
            return firstEffect;
          }
        }
        
        return data;
      } else if (contentType?.includes('image')) {
        // Legacy single blob response
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        console.log('🎯 Received blob response from correct endpoint');
        return imageUrl;
      }

      // Fallback for any other response type
      const blob = await response.blob();
      return URL.createObjectURL(blob);

    } catch (error) {
      // Retry logic with exponential backoff
      if (attempt < this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await this.sleep(delay);
        return this.executeWithRetry(url, options, attempt + 1);
      }

      throw error;
    }
  }

  getCacheKey(url, options) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  isStale(cached) {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return Date.now() - cached.timestamp > maxAge;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // CRITICAL: Convert base64 to blob using fetch() - this preserves EXIF orientation
  // This is the same method from the old working code
  async base64ToBlob(base64Data, mimeType) {
    // Remove data:image/... prefix if present
    const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    
    try {
      // This fetch() call triggers browser's native EXIF orientation processing
      const response = await fetch(`data:${mimeType};base64,${base64String}`);
      return await response.blob();
    } catch (error) {
      console.error('Error converting base64 to blob:', error);
      throw error;
    }
  }

  // Progress tracking for uploads - simplified for blob responses
  async uploadWithProgress(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob'; // Expect blob response like old working code

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Handle blob response directly
          const blob = xhr.response;
          const imageUrl = URL.createObjectURL(blob);
          resolve(imageUrl);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      xhr.open('POST', url);
      xhr.send(formData);
    });
  }

  // Warmup call to load ML model
  async warmup() {
    try {
      const response = await this.request('/warmup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {},
        timeout: 90000 // 90 seconds for model loading
      });
      
      if (response && response.model_ready) {
        console.log(`API client warmup successful: ${response.total_time?.toFixed(1)}s`);
        return true;
      }
      return false;
    } catch (e) {
      console.debug('API client warmup failed (non-critical):', e);
      return false;
    }
  }

  // Clean up blob URLs to prevent memory leaks
  cleanup() {
    this.cache.forEach((value) => {
      if (typeof value.data === 'string' && value.data.startsWith('blob:')) {
        URL.revokeObjectURL(value.data);
      }
    });
    this.cache.clear();
    this.pending.clear();
    
    // Clean up effect blob URLs (enhanced like working code)
    if (window.perkieApiEffects) {
      Object.values(window.perkieApiEffects).forEach(url => {
        if (typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      window.perkieApiEffects = {};
    }
    
    // Clean up stored blobs
    if (window.perkieEffectBlobs) {
      window.perkieEffectBlobs.clear();
      window.perkieEffectBlobs = null;
    }
  }
}