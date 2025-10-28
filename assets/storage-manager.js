/**
 * Storage Manager - ES6 Module Version
 * Ported from pet-storage.js for Effects V2 Migration
 *
 * Handles:
 * - localStorage persistence with compression
 * - GCS upload coordination
 * - Effect tracking (which effects applied)
 * - Session management
 * - Pet metadata (name, filename, artistNote)
 * - Shopify cart integration (window.perkiePets)
 */

export class StorageManager {
  constructor() {
    this.storagePrefix = 'perkie_pet_';
    this.apiUrl = null; // Will be set by parent processor
  }

  /**
   * Set API URL for GCS uploads
   * @param {string} url - API base URL
   */
  setApiUrl(url) {
    this.apiUrl = url;
  }

  /**
   * Compress image to thumbnail size
   * @param {string} dataUrl - Base64 data URL
   * @param {number} maxWidth - Maximum width in pixels (default 200)
   * @param {number} quality - JPEG quality 0-1 (default 0.6)
   * @returns {Promise<string>} Compressed data URL
   */
  async compressThumbnail(dataUrl, maxWidth = 200, quality = 0.6) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate dimensions maintaining aspect ratio
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        // Fill with white background for JPEG compression
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw with high quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to compressed JPEG
        const compressed = canvas.toDataURL('image/jpeg', quality);
        const sizeKB = (compressed.length * 0.75 / 1024).toFixed(1);
        console.log(`📸 Compressed: ${img.width}x${img.height} → ${canvas.width}x${canvas.height} (${sizeKB}KB)`);

        resolve(compressed);
      };
      img.onerror = () => {
        console.warn('Failed to compress image, using original');
        resolve(dataUrl);
      };
      img.src = dataUrl;
    });
  }

  /**
   * Save pet data to localStorage with compression
   * @param {string} petId - Unique pet identifier
   * @param {Object} data - Pet data (name, thumbnail, gcsUrl, effect, etc.)
   * @returns {Promise<boolean>} Success status
   */
  async save(petId, data) {
    try {
      // Compress thumbnail before storage (200px max, 60% quality)
      const compressedThumbnail = data.thumbnail ?
        await this.compressThumbnail(data.thumbnail, 200, 0.6) : '';

      const storageData = {
        petId,
        name: data.name || 'Pet',
        filename: data.filename || '',
        thumbnail: compressedThumbnail,
        gcsUrl: data.gcsUrl || '',
        originalUrl: data.originalUrl || '',
        artistNote: data.artistNote || '',
        effect: data.effect || 'original',
        effects: data.effects || {}, // Store all effect URLs
        timestamp: Date.now()
      };

      // Check storage quota before saving
      const usage = this.getStorageUsage();
      if (usage.percentage > 80) {
        console.warn(`⚠️ Storage at ${usage.percentage}% capacity, running cleanup`);
        this.emergencyCleanup();
      }

      localStorage.setItem(this.storagePrefix + petId, JSON.stringify(storageData));
      this.updateGlobalPets();
      return true;

    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('🚨 Storage quota exceeded, triggering emergency cleanup');
        this.emergencyCleanup();
        // Retry once after cleanup
        try {
          localStorage.setItem(this.storagePrefix + petId, JSON.stringify(storageData));
          this.updateGlobalPets();
          return true;
        } catch (retryError) {
          console.error('❌ Storage still full after cleanup:', retryError);
          throw retryError;
        }
      }
      throw error;
    }
  }

  /**
   * Get single pet data
   * @param {string} petId - Pet identifier
   * @returns {Object|null} Pet data or null
   */
  get(petId) {
    const data = localStorage.getItem(this.storagePrefix + petId);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get all pets
   * @returns {Object} All pets keyed by ID
   */
  getAll() {
    const pets = {};
    for (const key in localStorage) {
      if (key.startsWith(this.storagePrefix)) {
        const petId = key.replace(this.storagePrefix, '');
        pets[petId] = JSON.parse(localStorage.getItem(key));
      }
    }
    return pets;
  }

  /**
   * Delete single pet
   * @param {string} petId - Pet identifier
   * @returns {boolean} Success status
   */
  delete(petId) {
    localStorage.removeItem(this.storagePrefix + petId);
    this.updateGlobalPets();
    return true;
  }

  /**
   * Clear all pets
   */
  clear() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.storagePrefix));
    keys.forEach(key => localStorage.removeItem(key));
    this.updateGlobalPets();
  }

  /**
   * Get storage usage statistics
   * @returns {Object} Usage statistics
   */
  getStorageUsage() {
    let totalSize = 0;
    for (const key in localStorage) {
      if (key.startsWith(this.storagePrefix)) {
        totalSize += localStorage.getItem(key).length;
      }
    }
    return {
      used: totalSize,
      usedKB: (totalSize / 1024).toFixed(1),
      percentage: ((totalSize / (5 * 1024 * 1024)) * 100).toFixed(1)
    };
  }

  /**
   * Emergency cleanup - removes oldest pets to free space
   */
  emergencyCleanup() {
    console.log('🧹 Starting emergency storage cleanup');
    const usage = this.getStorageUsage();
    console.log(`📊 Before cleanup: ${usage.usedKB}KB (${usage.percentage}%)`);

    const allPets = this.getAll();
    const sortedPets = Object.entries(allPets).sort((a, b) => a[1].timestamp - b[1].timestamp);

    let removed = 0;
    while (this.getStorageUsage().percentage > 50 && sortedPets.length > removed) {
      const [petId] = sortedPets[removed];
      this.delete(petId);
      removed++;
      console.log(`🗑️ Removed old pet: ${petId}`);
    }

    const finalUsage = this.getStorageUsage();
    console.log(`✅ Cleanup complete: ${finalUsage.usedKB}KB (${finalUsage.percentage}%) - Removed ${removed} pets`);
  }

  /**
   * Update global window.perkiePets for Shopify cart integration
   * CRITICAL: This is what Shopify reads when adding to cart
   */
  updateGlobalPets() {
    const allPets = this.getAll();
    window.perkiePets = {
      pets: Object.values(allPets).map(pet => ({
        sessionKey: pet.petId,
        gcsUrl: pet.gcsUrl,
        effect: pet.effect,
        thumbnail: pet.thumbnail,
        name: pet.name
      }))
    };
  }

  /**
   * Upload image to GCS via API
   * @param {string} dataUrl - Base64 data URL
   * @param {string} sessionKey - Pet session ID
   * @param {string} imageType - 'processed' or 'original'
   * @param {string} effect - Effect name
   * @returns {Promise<string|null>} GCS public URL or null
   */
  async uploadToGCS(dataUrl, sessionKey, imageType, effect = 'none') {
    if (!this.apiUrl) {
      console.error('❌ API URL not set in StorageManager');
      return null;
    }

    try {
      console.log(`📤 Uploading ${imageType} image to GCS...`);

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Create form data
      const formData = new FormData();
      formData.append('file', blob, `${sessionKey}.jpg`);

      // Add metadata
      if (sessionKey) {
        formData.append('session_key', sessionKey);
      }
      if (effect && effect !== 'none') {
        formData.append('effect_applied', effect);
      }

      // Upload to API
      const uploadUrl = `${this.apiUrl}/store-image`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error(`❌ Upload failed (${uploadResponse.status}):`, errorText);
        return null;
      }

      const result = await uploadResponse.json();

      if (result.success && result.url) {
        console.log(`✅ ${imageType} uploaded:`, result.url);
        return result.url;
      } else {
        console.error('❌ Upload succeeded but no URL returned:', result);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error uploading ${imageType} image:`, error);
      return null;
    }
  }

  /**
   * Sanitize pet name to prevent XSS
   * @param {string} name - Pet name
   * @returns {string} Sanitized name
   */
  sanitizeName(name) {
    if (!name) return 'Pet';
    return name.replace(/[<>"'&]/g, '').substring(0, 50);
  }
}

// Create singleton instance for global access
export const storageManager = new StorageManager();

// Also attach to window for backward compatibility
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
  window.storageManager = storageManager;
}
