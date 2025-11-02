/**
 * Simple Pet Storage System
 * Replaces 6 storage mechanisms with 1 clean solution
 * Total: 75 lines
 */
class PetStorage {
  static storagePrefix = 'perkie_pet_';
  
  /**
   * Compress image to thumbnail size
   * @param {string} dataUrl - Base64 data URL
   * @param {number} maxWidth - Maximum width in pixels (default 200)
   * @param {number} quality - JPEG quality 0-1 (default 0.6)
   * @returns {Promise<string>} Compressed data URL
   */
  static async compressThumbnail(dataUrl, maxWidth = 200, quality = 0.6) {
    return new Promise((resolve) => {
      const img = new Image();

      // FIX: Set crossOrigin for GCS URLs to prevent canvas taint
      // Gemini effects store images on Google Cloud Storage
      // Without this, canvas.toDataURL() throws SecurityError
      if (dataUrl.startsWith('https://storage.googleapis.com')) {
        img.crossOrigin = 'anonymous';
      }

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
   * ONLY saves the selected effect as compressed thumbnail
   */
  static async save(petId, data) {
    try {
      // Compress thumbnail before storage (200px max, 60% quality)
      const compressedThumbnail = data.thumbnail ? 
        await this.compressThumbnail(data.thumbnail, 200, 0.6) : '';
      
      const storageData = {
        petId,
        name: data.name || 'Pet',
        filename: data.filename || '',
        thumbnail: compressedThumbnail, // COMPRESSED thumbnail only
        gcsUrl: data.gcsUrl || '',       // Cloud Storage URL for processed image
        originalUrl: data.originalUrl || '', // Cloud Storage URL for original image
        artistNote: data.artistNote || '', // User-provided artist notes
        effect: data.effect || 'original',
        timestamp: Date.now()
      };
      
      // Check storage quota before saving
      const usage = this.getStorageUsage();
      if (usage.percentage > 80) {
        console.warn(`⚠️ Storage at ${usage.percentage}% capacity, running cleanup`);
        this.emergencyCleanup();
      }
      
      localStorage.setItem(this.storagePrefix + petId, JSON.stringify(storageData));
      this.updateGlobalPets(); // Keep window.perkiePets in sync for Shopify
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
   */
  static get(petId) {
    const data = localStorage.getItem(this.storagePrefix + petId);
    return data ? JSON.parse(data) : null;
  }
  
  /**
   * Get all pets
   */
  static getAll() {
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
   */
  static delete(petId) {
    localStorage.removeItem(this.storagePrefix + petId);
    this.updateGlobalPets();
    return true;
  }
  
  /**
   * Clear all pets
   */
  static clear() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(this.storagePrefix));
    keys.forEach(key => localStorage.removeItem(key));
    this.updateGlobalPets();
  }
  
  /**
   * Get storage usage statistics
   */
  static getStorageUsage() {
    let totalSize = 0;
    for (const key in localStorage) {
      if (key.startsWith(this.storagePrefix)) {
        totalSize += localStorage.getItem(key).length;
      }
    }
    return {
      used: totalSize,
      usedKB: (totalSize / 1024).toFixed(1),
      percentage: ((totalSize / (5 * 1024 * 1024)) * 100).toFixed(1) // Assume 5MB quota
    };
  }
  
  /**
   * Emergency cleanup - removes oldest pets to free space
   */
  static emergencyCleanup() {
    console.log('🧹 Starting emergency storage cleanup');
    const usage = this.getStorageUsage();
    console.log(`📊 Before cleanup: ${usage.usedKB}KB (${usage.percentage}%)`);
    
    // Get all pets sorted by timestamp (oldest first)
    const allPets = this.getAll();
    const sortedPets = Object.entries(allPets).sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest pets until under 50% quota usage
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
   * Sanitize pet name to prevent XSS
   */
  static sanitizeName(name) {
    if (!name) return 'Pet';
    return name.replace(/[<>"'&]/g, '').substring(0, 50);
  }

  /**
   * Update global window.perkiePets for Shopify cart integration
   * CRITICAL: This is what Shopify reads when adding to cart
   */
  static updateGlobalPets() {
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
   * NEW: Map-compatible iteration for pet selector
   * Replaces window.perkieEffects.forEach()
   */
  static forEachEffect(callback) {
    const pets = this.getAll();
    Object.entries(pets).forEach(function(entry) {
      const petId = entry[0];
      const pet = entry[1];
      
      // Generate Map-compatible key format
      const effect = pet.effect || 'enhancedblackwhite';
      const key = petId + '_' + effect;
      const imageUrl = pet.thumbnail || pet.gcsUrl;
      
      if (imageUrl) {
        callback(imageUrl, key);
      }
      
      // Also provide metadata key
      const metadataKey = petId + '_metadata';
      const metadata = {
        sessionKey: petId,
        name: pet.name || pet.petName,
        effect: effect,
        artistNote: pet.artistNote || '',
        filename: pet.filename || 'pet.jpg',
        timestamp: pet.timestamp || Date.now()
      };
      callback(metadata, metadataKey);
    });
  }

  /**
   * NEW: Get specific effect URL (Map-compatible)
   */
  static getEffectUrl(sessionKey, effect) {
    const pet = this.get(sessionKey);
    if (!pet) return null;
    
    // Check if we have the specific effect
    if (pet.effects && pet.effects[effect]) {
      return pet.effects[effect];
    }
    
    // Fallback to thumbnail or gcsUrl
    return pet.thumbnail || pet.gcsUrl || null;
  }

  /**
   * NEW: Get metadata for a pet (Map-compatible)
   */
  static getMetadata(sessionKey) {
    const pet = this.get(sessionKey);
    if (!pet) return null;

    return {
      sessionKey: sessionKey,
      name: pet.name || pet.petName || 'Pet',
      effect: pet.effect || 'enhancedblackwhite',
      artistNote: pet.artistNote || '',
      filename: pet.filename || 'pet.jpg',
      timestamp: pet.timestamp || Date.now(),
      gcsUrl: pet.gcsUrl || '',
      originalUrl: pet.originalUrl || ''
    };
  }

  /**
   * NEW: Get all pets formatted for renderPets()
   * Returns array of pet objects with Map-like structure
   */
  static getAllForDisplay() {
    const pets = this.getAll();
    const displayPets = [];
    
    Object.entries(pets).forEach(function(entry) {
      const sessionKey = entry[0];
      const pet = entry[1];
      
      // Create effects Map for compatibility
      const effectsMap = new Map();
      if (pet.effects) {
        Object.entries(pet.effects).forEach(function(effectEntry) {
          effectsMap.set(effectEntry[0], effectEntry[1]);
        });
      } else if (pet.thumbnail || pet.gcsUrl) {
        // Single effect case
        const effect = pet.effect || 'enhancedblackwhite';
        effectsMap.set(effect, pet.thumbnail || pet.gcsUrl);
      }
      
      displayPets.push({
        sessionKey: sessionKey,
        name: pet.name || pet.petName || 'Pet',
        thumbnail: pet.thumbnail || pet.gcsUrl,
        effect: pet.effect || 'enhancedblackwhite',
        effects: effectsMap,
        metadata: {
          artistNote: pet.artistNote || '',
          filename: pet.filename || 'pet.jpg',
          timestamp: pet.timestamp || Date.now()
        }
      });
    });
    
    return displayPets;
  }

  /**
   * NEW: Check if Map key exists (compatibility)
   */
  static has(key) {
    // Support both pet ID and Map-style keys
    if (key.includes('_')) {
      const parts = key.split('_');
      const petId = parts[0];
      return this.get(petId) !== null;
    }
    return this.get(key) !== null;
  }

  /**
   * NEW: Get value by Map-style key
   */
  static getByMapKey(key) {
    if (key.includes('_metadata')) {
      const petId = key.replace('_metadata', '');
      return this.getMetadata(petId);
    }
    
    if (key.includes('_')) {
      const parts = key.split('_');
      const petId = parts[0];
      const effect = parts[1];
      return this.getEffectUrl(petId, effect);
    }
    
    return null;
  }
}

// Initialize global pets object on load
PetStorage.updateGlobalPets();

// Export for use
window.PetStorage = PetStorage;