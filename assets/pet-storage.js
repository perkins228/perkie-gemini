/**
 * Pet Storage System v3 - Unified Single-Key Architecture
 *
 * Single source of truth for all pet data.
 * Replaces: pet-storage.js (v1), pet-state-manager.js (v2)
 *
 * Storage Keys:
 * - perkie_pets_v3 (localStorage): All persistent pet data
 * - perkie_bridge (sessionStorage): Lightweight processor → product handoff
 *
 * Schema:
 * {
 *   version: 3,
 *   timestamp: number,
 *   pets: {
 *     1: { sessionKey, name, artistNote, originalGcsUrl, effects, selectedEffect, processedAt, previousOrderNumber },
 *     2: { ... },
 *     3: { ... }
 *   }
 * }
 */

var PetStorage = (function() {
  'use strict';

  // Configuration
  var STORAGE_KEY = 'perkie_pets_v3';
  var BRIDGE_KEY = 'perkie_bridge';
  var VERSION = 3;
  var TTL_DAYS = 7; // Pet data expires after 7 days
  var MAX_PETS = 3; // Maximum pets per session

  // ====================
  // Core Storage Methods
  // ====================

  /**
   * Load all pet data from storage
   * @returns {Object} Pet data structure with version, timestamp, and pets object
   */
  function load() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return createEmptyState();
      }

      var data = JSON.parse(stored);

      // Validate structure
      if (!data.version || data.version !== VERSION || !data.pets) {
        console.log('[PetStorage] Invalid or outdated data, creating fresh state');
        return createEmptyState();
      }

      return data;
    } catch (e) {
      console.error('[PetStorage] Error loading:', e);
      return createEmptyState();
    }
  }

  /**
   * Save all pet data to storage
   * @param {Object} data - Complete pet data structure
   * @returns {boolean} Success status
   */
  function save(data) {
    try {
      data.timestamp = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      updateGlobalPets(data);
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('[PetStorage] Quota exceeded, running cleanup');
        emergencyCleanup();
        // Retry once
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          updateGlobalPets(data);
          return true;
        } catch (retryError) {
          console.error('[PetStorage] Still full after cleanup:', retryError);
        }
      }
      console.error('[PetStorage] Save error:', e);
      return false;
    }
  }

  /**
   * Create empty state structure
   */
  function createEmptyState() {
    return {
      version: VERSION,
      timestamp: Date.now(),
      pets: {}
    };
  }

  // ====================
  // Pet CRUD Operations
  // ====================

  /**
   * Get a single pet by number (1, 2, or 3)
   * @param {number} petNumber - Pet index (1-3)
   * @returns {Object|null} Pet data or null if not found
   */
  function getPet(petNumber) {
    var data = load();
    var pet = data.pets[petNumber] || null;
    if (pet) {
      console.log('📖 PetStorage.getPet(' + petNumber + '):', {
        sessionKey: pet.sessionKey,
        name: pet.name || '(no name)',
        originalGcsUrl: pet.originalGcsUrl ? '✅ present' : '❌ missing',
        selectedEffect: pet.selectedEffect,
        effectsAvailable: pet.effects ? Object.keys(pet.effects).join(', ') : 'none'
      });
    } else {
      console.log('📖 PetStorage.getPet(' + petNumber + '): not found');
    }
    return pet;
  }

  /**
   * Get all pets
   * @returns {Object} Pets object keyed by pet number
   */
  function getAllPets() {
    var data = load();
    return data.pets;
  }

  /**
   * Save or update a single pet
   * MERGES with existing data to preserve fields not in petData
   * @param {number} petNumber - Pet index (1-3)
   * @param {Object} petData - Pet data object
   * @returns {boolean} Success status
   */
  function savePet(petNumber, petData) {
    console.log('💾 === PetStorage.savePet() called ===');
    console.log('📥 Input:', {
      petNumber: petNumber,
      sessionKey: petData.sessionKey,
      name: petData.name,
      originalGcsUrl: petData.originalGcsUrl || petData.originalUrl ? '✅ present' : '❌ missing',
      selectedEffect: petData.selectedEffect,
      effectsProvided: petData.effects ? Object.keys(petData.effects).join(', ') : 'none'
    });

    if (petNumber < 1 || petNumber > MAX_PETS) {
      console.error('[PetStorage] Invalid pet number:', petNumber);
      return false;
    }

    var data = load();
    var existing = data.pets[petNumber] || {};

    if (Object.keys(existing).length > 0) {
      console.log('📦 Existing pet data found, will merge:', {
        sessionKey: existing.sessionKey,
        originalGcsUrl: existing.originalGcsUrl ? '✅ present' : '❌ missing',
        effectsExisting: existing.effects ? Object.keys(existing.effects).join(', ') : 'none'
      });
    }

    // Merge effects from existing data with new effects
    var mergedEffects = {};
    if (existing.effects) {
      Object.keys(existing.effects).forEach(function(key) {
        mergedEffects[key] = existing.effects[key];
      });
    }
    var newEffects = sanitizeEffects(petData.effects || {});
    Object.keys(newEffects).forEach(function(key) {
      mergedEffects[key] = newEffects[key];
    });

    // Build pet object, merging with existing data
    // New values take precedence, but existing values are preserved if not provided
    var pet = {
      sessionKey: petData.sessionKey || existing.sessionKey || generateSessionKey(petNumber),
      name: sanitizeName(petData.name || existing.name || ''),
      artistNote: petData.artistNote || existing.artistNote || '',
      originalGcsUrl: petData.originalGcsUrl || petData.originalUrl || existing.originalGcsUrl || '',
      effects: mergedEffects,
      selectedEffect: petData.selectedEffect || existing.selectedEffect || 'enhancedblackwhite',
      processedAt: petData.processedAt || existing.processedAt || Date.now(),
      previousOrderNumber: petData.previousOrderNumber || existing.previousOrderNumber || null
    };

    console.log('💾 Saving merged pet data:', {
      sessionKey: pet.sessionKey,
      name: pet.name || '(no name)',
      originalGcsUrl: pet.originalGcsUrl ? '✅ ' + pet.originalGcsUrl.substring(0, 60) + '...' : '❌ missing',
      selectedEffect: pet.selectedEffect,
      effectsMerged: Object.keys(pet.effects).join(', ') || 'none',
      previousOrderNumber: pet.previousOrderNumber || '(none)'
    });

    data.pets[petNumber] = pet;
    var result = save(data);
    console.log('💾 === PetStorage.savePet() ' + (result ? 'SUCCESS' : 'FAILED') + ' ===');
    return result;
  }

  /**
   * Delete a single pet
   * @param {number} petNumber - Pet index (1-3)
   * @returns {boolean} Success status
   */
  function deletePet(petNumber) {
    var data = load();
    if (data.pets[petNumber]) {
      delete data.pets[petNumber];
      return save(data);
    }
    return true;
  }

  /**
   * Clear all pets
   * @returns {boolean} Success status
   */
  function clearAll() {
    var data = createEmptyState();
    localStorage.removeItem(STORAGE_KEY);
    updateGlobalPets(data);
    return true;
  }

  // ====================
  // Session Bridge
  // ====================

  /**
   * Create session bridge for processor → product page handoff
   * Stores only pointer data, not full pet copy
   * @param {number} petNumber - Which pet to load on product page
   * @param {string} selectedEffect - Which effect was selected
   * @param {string} productHandle - Target product handle (optional)
   */
  function createBridge(petNumber, selectedEffect, productHandle) {
    console.log('🌉 === PetStorage.createBridge() ===');
    try {
      var bridge = {
        petNumber: petNumber,
        selectedEffect: selectedEffect || 'enhancedblackwhite',
        productHandle: productHandle || null,
        timestamp: Date.now()
      };
      sessionStorage.setItem(BRIDGE_KEY, JSON.stringify(bridge));
      console.log('🌉 Bridge CREATED:', {
        petNumber: bridge.petNumber,
        selectedEffect: bridge.selectedEffect,
        productHandle: bridge.productHandle || '(none)'
      });
      return true;
    } catch (e) {
      console.error('[PetStorage] Bridge create error:', e);
      return false;
    }
  }

  /**
   * Read and consume session bridge (one-time use)
   * @returns {Object|null} Bridge data or null
   */
  function consumeBridge() {
    console.log('🌉 === PetStorage.consumeBridge() ===');
    try {
      var stored = sessionStorage.getItem(BRIDGE_KEY);
      if (!stored) {
        console.log('🌉 No bridge found in sessionStorage');
        return null;
      }

      var bridge = JSON.parse(stored);

      // Clear bridge after reading (one-time use)
      sessionStorage.removeItem(BRIDGE_KEY);

      // Validate age (max 30 minutes)
      var age = Date.now() - bridge.timestamp;
      var ageMinutes = Math.round(age / 60000);
      if (age > 30 * 60 * 1000) {
        console.log('🌉 Bridge EXPIRED (age:', ageMinutes, 'min)');
        return null;
      }

      console.log('🌉 Bridge CONSUMED:', {
        petNumber: bridge.petNumber,
        selectedEffect: bridge.selectedEffect,
        ageMinutes: ageMinutes
      });
      return bridge;
    } catch (e) {
      console.error('[PetStorage] Bridge consume error:', e);
      return null;
    }
  }

  /**
   * Peek at bridge without consuming it
   * @returns {Object|null} Bridge data or null
   */
  function peekBridge() {
    try {
      var stored = sessionStorage.getItem(BRIDGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (e) {
      return null;
    }
  }

  /**
   * Clear session bridge
   */
  function clearBridge() {
    sessionStorage.removeItem(BRIDGE_KEY);
  }

  // ====================
  // Cleanup & Maintenance
  // ====================

  /**
   * Run cleanup - removes expired pets
   * Called automatically on init
   */
  function cleanup() {
    var data = load();
    var maxAge = TTL_DAYS * 24 * 60 * 60 * 1000;
    var now = Date.now();
    var removed = 0;

    Object.keys(data.pets).forEach(function(petNum) {
      var pet = data.pets[petNum];
      if (pet.processedAt && (now - pet.processedAt > maxAge)) {
        delete data.pets[petNum];
        removed++;
      }
    });

    if (removed > 0) {
      save(data);
      console.log('[PetStorage] Cleanup removed', removed, 'expired pets');
    }
  }

  /**
   * Emergency cleanup when storage quota exceeded
   * Removes oldest pets until under 50% capacity
   */
  function emergencyCleanup() {
    console.log('[PetStorage] Emergency cleanup starting');
    var data = load();

    // Sort pets by processedAt (oldest first)
    var sortedPets = Object.entries(data.pets).sort(function(a, b) {
      return (a[1].processedAt || 0) - (b[1].processedAt || 0);
    });

    // Remove oldest pets until we have at most 1 pet
    while (sortedPets.length > 1) {
      var oldest = sortedPets.shift();
      delete data.pets[oldest[0]];
      console.log('[PetStorage] Removed pet:', oldest[0]);
    }

    // Clear any stale legacy keys
    clearLegacyKeys();

    save(data);
    console.log('[PetStorage] Emergency cleanup complete');
  }

  /**
   * Clear legacy storage keys from old systems
   */
  function clearLegacyKeys() {
    var legacyPrefixes = [
      'perkie_pet_',           // Old v1 format
      'perkie_pet_selector_',  // Old selector state
      'perkie_pet_data_v2',    // Old v2 format
      'petCustomization_',     // Old form bridge
      'processor_to_product_bridge', // Old bridge
      'processor_mockup_state' // Old mockup state
    ];

    Object.keys(localStorage).forEach(function(key) {
      legacyPrefixes.forEach(function(prefix) {
        if (key.startsWith(prefix) && key !== STORAGE_KEY) {
          localStorage.removeItem(key);
          console.log('[PetStorage] Removed legacy key:', key);
        }
      });
    });

    // Clear session storage legacy
    ['processor_to_product_bridge', 'processor_mockup_state', 'session_gallery_pet_'].forEach(function(prefix) {
      Object.keys(sessionStorage).forEach(function(key) {
        if (key.startsWith(prefix)) {
          sessionStorage.removeItem(key);
        }
      });
    });
  }

  /**
   * Get storage usage statistics
   */
  function getStorageUsage() {
    var stored = localStorage.getItem(STORAGE_KEY);
    var size = stored ? stored.length : 0;
    return {
      usedBytes: size,
      usedKB: (size / 1024).toFixed(1),
      percentage: ((size / (5 * 1024 * 1024)) * 100).toFixed(1)
    };
  }

  // ====================
  // Global Sync
  // ====================

  /**
   * Update window.perkiePets for Shopify cart integration
   */
  function updateGlobalPets(data) {
    if (!data) data = load();

    window.perkiePets = {
      pets: Object.entries(data.pets).map(function(entry) {
        var petNum = entry[0];
        var pet = entry[1];
        return {
          petNumber: parseInt(petNum),
          sessionKey: pet.sessionKey,
          name: pet.name,
          artistNote: pet.artistNote,
          originalGcsUrl: pet.originalGcsUrl,
          effects: pet.effects,
          selectedEffect: pet.selectedEffect,
          previousOrderNumber: pet.previousOrderNumber
        };
      })
    };
  }

  // ====================
  // Utility Functions
  // ====================

  /**
   * Generate unique session key
   */
  function generateSessionKey(petNumber) {
    var timestamp = Date.now();
    var random = Math.random().toString(36).substring(2, 8);
    return 'pet_' + petNumber + '_' + timestamp + '_' + random;
  }

  /**
   * Sanitize pet name (XSS prevention)
   */
  function sanitizeName(name) {
    if (!name) return '';
    return String(name).replace(/[<>"'&]/g, '').substring(0, 50);
  }

  /**
   * Sanitize effects object - prefer GCS URLs, fall back to data URLs
   * This allows immediate display with data URLs while GCS uploads complete in background.
   * When GCS URLs become available (via re-save), they replace data URLs.
   */
  function sanitizeEffects(effects) {
    var sanitized = {};
    var validEffects = ['enhancedblackwhite', 'color', 'ink_wash', 'sketch'];

    validEffects.forEach(function(effectName) {
      if (effects[effectName]) {
        var gcsUrl = null;
        var dataUrl = null;

        // Handle various formats
        if (typeof effects[effectName] === 'string') {
          // Direct string - check type
          if (effects[effectName].startsWith('https://')) {
            gcsUrl = effects[effectName];
          } else if (effects[effectName].startsWith('data:')) {
            dataUrl = effects[effectName];
          }
        } else {
          // Object format - extract both URLs
          if (effects[effectName].gcsUrl && effects[effectName].gcsUrl.startsWith('https://')) {
            gcsUrl = effects[effectName].gcsUrl;
          }
          if (effects[effectName].dataUrl && effects[effectName].dataUrl.startsWith('data:')) {
            dataUrl = effects[effectName].dataUrl;
          }
          // Also check 'url' property (legacy format)
          if (!gcsUrl && effects[effectName].url && effects[effectName].url.startsWith('https://')) {
            gcsUrl = effects[effectName].url;
          }
        }

        // PREFER GCS URL (permanent storage), fall back to data URL (temporary display)
        // Data URLs will be replaced when background GCS uploads complete
        if (gcsUrl) {
          sanitized[effectName] = gcsUrl;
        } else if (dataUrl) {
          sanitized[effectName] = dataUrl;
          console.log('[PetStorage] Using temporary data URL for', effectName, '(GCS upload pending)');
        }
      }
    });

    return sanitized;
  }

  /**
   * Get human-readable age text
   */
  function getAgeText(timestamp) {
    if (!timestamp) return '';
    var now = Date.now();
    var diffMs = now - timestamp;
    var diffMins = Math.floor(diffMs / 60000);
    var diffHours = Math.floor(diffMs / 3600000);
    var diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 5) return 'Just now';
    if (diffMins < 60) return diffMins + ' min ago';
    if (diffHours < 24) return diffHours + (diffHours === 1 ? ' hour ago' : ' hours ago');
    if (diffDays < 7) return diffDays + (diffDays === 1 ? ' day ago' : ' days ago');
    return 'Over a week ago';
  }

  /**
   * Get effect display name for UI
   */
  function getEffectDisplayName(effectKey) {
    var names = {
      'enhancedblackwhite': 'B&W',
      'color': 'Color',
      'ink_wash': 'Ink Wash',
      'sketch': 'Marker'
    };
    return names[effectKey] || effectKey;
  }

  // ====================
  // Display Helpers
  // ====================

  /**
   * Get recent pets for gallery display
   * @param {number} limit - Max pets to return
   * @returns {Array} Pets sorted by processedAt (newest first)
   */
  function getRecentPets(limit) {
    if (limit === undefined) limit = 5;
    var data = load();
    var pets = [];

    Object.entries(data.pets).forEach(function(entry) {
      var petNum = entry[0];
      var pet = entry[1];

      // Get thumbnail URL (prefer selected effect, fall back to first available)
      var thumbnailUrl = null;
      var selectedEffect = pet.selectedEffect || 'enhancedblackwhite';

      if (pet.effects[selectedEffect]) {
        thumbnailUrl = pet.effects[selectedEffect];
      } else {
        // Fall back to first available
        var effectKeys = Object.keys(pet.effects);
        if (effectKeys.length > 0) {
          thumbnailUrl = pet.effects[effectKeys[0]];
          selectedEffect = effectKeys[0];
        }
      }

      if (thumbnailUrl) {
        pets.push({
          petNumber: parseInt(petNum),
          sessionKey: pet.sessionKey,
          name: pet.name,
          thumbnailUrl: thumbnailUrl,
          selectedEffect: selectedEffect,
          effects: pet.effects,
          artistNote: pet.artistNote,
          originalGcsUrl: pet.originalGcsUrl,
          processedAt: pet.processedAt,
          previousOrderNumber: pet.previousOrderNumber,
          ageText: getAgeText(pet.processedAt)
        });
      }
    });

    // Sort by processedAt (newest first)
    pets.sort(function(a, b) {
      return (b.processedAt || 0) - (a.processedAt || 0);
    });

    return pets.slice(0, limit);
  }

  /**
   * Check if any recent pets are available
   */
  function hasRecentPets() {
    return getRecentPets(1).length > 0;
  }

  /**
   * Get specific effect URL for a pet
   */
  function getEffectUrl(petNumber, effectName) {
    var pet = getPet(petNumber);
    if (!pet || !pet.effects) return null;
    return pet.effects[effectName] || null;
  }

  // ====================
  // Backward Compatibility
  // ====================

  /**
   * Legacy save method for old code
   * Maps old sessionKey-based calls to new petNumber-based system
   * Returns a Promise for backward compatibility with old async code
   */
  function legacySave(sessionKey, petData) {
    // Extract pet number from session key
    // V3 uses slot numbers 1-3, not UUID-style IDs
    // Session key formats: "pet_1_timestamp" (slot) or "pet_960031dd-..." (UUID)
    var petNumber = 1;
    var slotMatch = sessionKey.match(/^pet_(\d)_/);
    if (slotMatch) {
      petNumber = parseInt(slotMatch[1], 10);
    }
    // If no slot pattern found, default to 1 (single-pet processing)

    var result = savePet(petNumber, {
      sessionKey: sessionKey,
      name: petData.name || petData.petName || '',
      artistNote: petData.artistNote || '',
      originalGcsUrl: petData.originalUrl || petData.originalGcsUrl || '',
      effects: petData.effects || {},
      selectedEffect: petData.selectedEffect || petData.effect || 'enhancedblackwhite',
      processedAt: petData.timestamp || Date.now(),
      previousOrderNumber: petData.previousOrderNumber || null
    });

    // Return Promise for backward compatibility (old code uses .then())
    return Promise.resolve(result);
  }

  /**
   * Legacy get method for old code
   */
  function legacyGet(sessionKey) {
    // Extract pet number from session key
    // V3 uses slot numbers 1-3, not UUID-style IDs
    var petNumber = 1;
    var slotMatch = sessionKey.match(/^pet_(\d)_/);
    if (slotMatch) {
      petNumber = parseInt(slotMatch[1], 10);
    }
    var pet = getPet(petNumber);

    if (!pet) return null;

    // Return in old format for compatibility
    return {
      petId: sessionKey,
      name: pet.name,
      artistNote: pet.artistNote,
      effects: pet.effects,
      originalUrl: pet.originalGcsUrl,
      selectedEffect: pet.selectedEffect,
      timestamp: pet.processedAt
    };
  }

  /**
   * Legacy getAll for old code
   */
  function legacyGetAll() {
    var data = load();
    var result = {};

    Object.entries(data.pets).forEach(function(entry) {
      var petNum = entry[0];
      var pet = entry[1];
      var key = pet.sessionKey || ('pet_' + petNum);
      result[key] = {
        petId: key,
        petNumber: parseInt(petNum, 10),  // Include slot number for correct assignment
        name: pet.name,
        artistNote: pet.artistNote,
        effects: pet.effects,
        originalUrl: pet.originalGcsUrl,
        selectedEffect: pet.selectedEffect,
        timestamp: pet.processedAt
      };
    });

    return result;
  }

  // ====================
  // Debug
  // ====================

  function debugState() {
    var data = load();
    var usage = getStorageUsage();
    console.log('=== PetStorage v3 Debug ===');
    console.log('Version:', data.version);
    console.log('Timestamp:', new Date(data.timestamp).toLocaleString());
    console.log('Pets:', Object.keys(data.pets).length);
    console.log('Storage:', usage.usedKB + 'KB (' + usage.percentage + '%)');
    console.log('Pet Data:', data.pets);
    console.log('Bridge:', peekBridge());
    console.log('===========================');
    return data;
  }

  // ====================
  // Initialize
  // ====================

  function init() {
    // Run cleanup on init
    cleanup();

    // Update global pets
    updateGlobalPets();

    console.log('[PetStorage] v3 initialized');
  }

  // Auto-init when script loads
  if (typeof window !== 'undefined') {
    init();
  }

  // ====================
  // Public API
  // ====================

  return {
    // Version
    VERSION: VERSION,

    // Core CRUD
    getPet: getPet,
    getAllPets: getAllPets,
    savePet: savePet,
    deletePet: deletePet,
    clearAll: clearAll,
    load: load,

    // Session Bridge
    createBridge: createBridge,
    consumeBridge: consumeBridge,
    peekBridge: peekBridge,
    clearBridge: clearBridge,

    // Maintenance
    cleanup: cleanup,
    emergencyCleanup: emergencyCleanup,
    clearLegacyKeys: clearLegacyKeys,
    getStorageUsage: getStorageUsage,

    // Display Helpers
    getRecentPets: getRecentPets,
    hasRecentPets: hasRecentPets,
    getEffectUrl: getEffectUrl,
    getAgeText: getAgeText,
    getEffectDisplayName: getEffectDisplayName,

    // Utilities
    sanitizeName: sanitizeName,
    updateGlobalPets: updateGlobalPets,

    // Legacy Compatibility (for old code)
    save: legacySave,
    get: legacyGet,
    getAll: legacyGetAll,
    delete: function(sessionKey) {
      // V3 uses slot numbers 1-3, not UUID-style IDs
      var petNumber = 1;
      var slotMatch = sessionKey.match(/^pet_(\d)_/);
      if (slotMatch) {
        petNumber = parseInt(slotMatch[1], 10);
      }
      return deletePet(petNumber);
    },
    clear: clearAll,

    // Debug
    debugState: debugState
  };
})();

// Export to window
if (typeof window !== 'undefined') {
  window.PetStorage = PetStorage;
}
