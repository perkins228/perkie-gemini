/**
 * Simple Pet Storage System
 * Simplified for GCS URL-only storage (no thumbnails, no originals)
 */
class PetStorage {
  static storagePrefix = 'perkie_pet_';

  /**
   * Save pet data to localStorage (GCS URLs only, no compression)
   * NEW: Simplified structure for test site - no thumbnails, no original uploads
   */
  static async save(petId, data) {
    // ✅ FIX: Declare at function scope so it's accessible in catch block
    // Simplified storage: Only artist notes and effect GCS URLs
    // Customer provides pet name, selects effect, and uploads image on product page
    const storageData = {
      petId,
      artistNote: data.artistNote || '',   // User-provided artist notes
      effects: data.effects || {},         // { style: { gcsUrl } } structure
      timestamp: Date.now()                // For cleanup/sorting
    };

    try {
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
   * SIMPLIFIED: Only artistNote and effects (customer provides name/selection on product page)
   */
  static updateGlobalPets() {
    const allPets = this.getAll();
    window.perkiePets = {
      pets: Object.values(allPets).map(pet => ({
        sessionKey: pet.petId,
        artistNote: pet.artistNote || '',
        effects: pet.effects || {},
        timestamp: pet.timestamp || Date.now()
      }))
    };
  }

  /**
   * NEW: Map-compatible iteration for pet selector
   * Replaces window.perkieEffects.forEach()
   * UPDATED: GCS URLs only (no thumbnails)
   */
  static forEachEffect(callback) {
    const pets = this.getAll();
    Object.entries(pets).forEach(function(entry) {
      const petId = entry[0];
      const pet = entry[1];

      // Generate Map-compatible key format
      const effect = pet.selectedEffect || pet.effect || 'enhancedblackwhite';
      const key = petId + '_' + effect;
      const imageUrl = pet.gcsUrl;

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
   * UPDATED: GCS URLs only (no thumbnails)
   */
  static getEffectUrl(sessionKey, effect) {
    const pet = this.get(sessionKey);
    if (!pet) return null;

    // Check if we have the specific effect
    if (pet.effects && pet.effects[effect] && pet.effects[effect].gcsUrl) {
      return pet.effects[effect].gcsUrl;
    }

    // Fallback to main gcsUrl
    return pet.gcsUrl || null;
  }

  /**
   * NEW: Get metadata for a pet (Map-compatible)
   * SIMPLIFIED: Only artistNote and effects (customer provides name/selection on product page)
   */
  static getMetadata(sessionKey) {
    const pet = this.get(sessionKey);
    if (!pet) return null;

    return {
      sessionKey: sessionKey,
      artistNote: pet.artistNote || '',
      effects: pet.effects || {},
      timestamp: pet.timestamp || Date.now()
    };
  }

  /**
   * NEW: Get all pets formatted for product page pet selector
   * Returns array of pet objects with only artistNote and effects
   * SIMPLIFIED: Customer provides name/selection on product page
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
          const effectName = effectEntry[0];
          const effectData = effectEntry[1];
          // Support both old format (string URL) and new format ({gcsUrl})
          const url = (typeof effectData === 'string') ? effectData : effectData.gcsUrl;
          effectsMap.set(effectName, url);
        });
      }

      displayPets.push({
        sessionKey: sessionKey,
        effects: effectsMap,
        artistNote: pet.artistNote || '',
        timestamp: pet.timestamp || Date.now()
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