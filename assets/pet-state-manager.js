/**
 * Unified Pet State Manager
 * Single source of truth for all pet data
 *
 * Problem Solved:
 * - Eliminates data duplication across localStorage/sessionStorage
 * - Provides consistent API for reading/writing pet data
 * - Handles session expiry and multi-tab synchronization
 * - Supports event subscriptions for reactive updates
 *
 * Features:
 * - Single unified data structure
 * - Automatic storage quota management
 * - Session bridge for processor → product page flow
 * - Event-driven architecture for UI updates
 * - Backward compatibility with existing code
 *
 * Usage:
 * const petState = PetStateManager.getInstance();
 *
 * // Get pet data
 * const pet = petState.getPet(1);
 *
 * // Update pet data
 * petState.updatePet(1, { name: 'Fluffy', style: 'Modern' });
 *
 * // Subscribe to changes
 * petState.subscribe('petUpdated', (data) => {
 *   console.log('Pet updated:', data);
 * });
 */

class PetStateManager {
  // Singleton instance
  static instance = null;

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!PetStateManager.instance) {
      PetStateManager.instance = new PetStateManager();
    }
    return PetStateManager.instance;
  }

  constructor() {
    // Prevent direct instantiation
    if (PetStateManager.instance) {
      return PetStateManager.instance;
    }

    // Storage configuration
    this.storageKey = 'perkie_pet_data_v2'; // Versioned for migration
    this.sessionBridgeKey = 'perkie_session_bridge';
    this.maxStorageSize = 4 * 1024 * 1024; // 4MB quota (conservative)

    // Detect optimal storage strategy
    this.useSessionStorage = this.detectStorageStrategy();

    // Event subscribers
    this.subscribers = {};

    // Initialize
    this.init();
  }

  /**
   * Initialize state manager
   */
  init() {
    // Migrate from old storage format if needed
    this.migrateOldData();

    // Listen for storage events (cross-tab synchronization)
    window.addEventListener('storage', this.handleStorageChange.bind(this));

    // Clean up expired session bridges
    this.cleanupSessionBridge();
  }

  /**
   * Detect optimal storage strategy
   */
  detectStorageStrategy() {
    try {
      // Test sessionStorage availability
      const testKey = '_storage_test_';
      sessionStorage.setItem(testKey, '1');
      sessionStorage.removeItem(testKey);

      // Use sessionStorage for session-specific data
      // Use localStorage for persistent data
      return {
        session: sessionStorage,
        persistent: localStorage
      };
    } catch (e) {
      console.warn('Storage not available, using in-memory fallback');
      return {
        session: new Map(),
        persistent: new Map()
      };
    }
  }

  /**
   * Get unified pet data structure
   */
  loadFromStorage() {
    try {
      const stored = this.useSessionStorage.persistent.getItem(this.storageKey);

      if (!stored) {
        return this.createDefaultState();
      }

      const data = JSON.parse(stored);

      // Validate data structure
      if (!data.version || !data.pets) {
        console.warn('Invalid data structure, resetting');
        return this.createDefaultState();
      }

      return data;
    } catch (e) {
      console.error('Error loading pet data:', e);
      return this.createDefaultState();
    }
  }

  /**
   * Create default state structure
   */
  createDefaultState() {
    return {
      version: 2, // Data structure version
      pets: {}, // Indexed by pet number (1, 2, 3)
      lastModified: Date.now(),
      sessionId: this.generateSessionId()
    };
  }

  /**
   * Save data to storage
   */
  saveToStorage(data) {
    try {
      data.lastModified = Date.now();

      const serialized = JSON.stringify(data);

      // Check storage quota
      if (serialized.length > this.maxStorageSize) {
        console.warn('Storage quota exceeded, running cleanup');
        this.emergencyCleanup(data);
        return;
      }

      this.useSessionStorage.persistent.setItem(this.storageKey, serialized);

      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded');
        this.emergencyCleanup(data);
      } else {
        console.error('Error saving pet data:', e);
      }
      return false;
    }
  }

  /**
   * Get single pet data
   */
  getPet(petIndex) {
    const data = this.loadFromStorage();

    return data.pets[petIndex] || {
      petId: petIndex,
      name: '',
      image: {
        original: null, // Original upload (data URL or GCS URL)
        processed: null, // Background-removed image
        gcsUrl: null // Canonical GCS URL
      },
      style: null, // Selected style (modern, sketch, etc.)
      font: null, // Selected font for name
      previews: {
        // All generated style previews
        modern: null,
        sketch: null,
        watercolor: null,
        vintage: null,
        enhancedblackwhite: null,
        color: null
      },
      artistNote: '', // Artist notes from customer
      metadata: {
        uploadedAt: null,
        processedAt: null,
        sessionKey: null
      }
    };
  }

  /**
   * Get all pets
   */
  getAllPets() {
    const data = this.loadFromStorage();
    return data.pets || {};
  }

  /**
   * Update pet data (partial update)
   */
  updatePet(petIndex, updates) {
    const data = this.loadFromStorage();

    // Get existing pet or create new
    const existingPet = data.pets[petIndex] || this.getPet(petIndex);

    // Deep merge updates
    data.pets[petIndex] = this.deepMerge(existingPet, updates);

    // Save to storage
    const saved = this.saveToStorage(data);

    if (saved) {
      // Notify subscribers
      this.notifySubscribers('petUpdated', {
        petIndex,
        pet: data.pets[petIndex]
      });
    }

    return saved;
  }

  /**
   * Delete single pet
   */
  deletePet(petIndex) {
    const data = this.loadFromStorage();

    if (data.pets[petIndex]) {
      delete data.pets[petIndex];
      this.saveToStorage(data);

      this.notifySubscribers('petDeleted', { petIndex });
    }
  }

  /**
   * Clear all pet data
   */
  clearAllPets() {
    const data = this.createDefaultState();
    this.saveToStorage(data);

    this.notifySubscribers('allPetsCleared', {});
  }

  /**
   * Deep merge two objects
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Session Bridge: Save data for processor → product page flow
   */
  createSessionBridge(petData) {
    try {
      const bridgeData = {
        pets: petData,
        timestamp: Date.now(),
        expiresAt: Date.now() + (30 * 60 * 1000) // 30 minute expiry
      };

      this.useSessionStorage.session.setItem(
        this.sessionBridgeKey,
        JSON.stringify(bridgeData)
      );

      return true;
    } catch (e) {
      console.error('Error creating session bridge:', e);
      return false;
    }
  }

  /**
   * Session Bridge: Load data from processor page
   */
  loadFromSessionBridge() {
    try {
      const stored = this.useSessionStorage.session.getItem(this.sessionBridgeKey);

      if (!stored) {
        return null;
      }

      const bridgeData = JSON.parse(stored);

      // Check expiry
      if (Date.now() > bridgeData.expiresAt) {
        this.clearSessionBridge();
        return null;
      }

      return bridgeData.pets;
    } catch (e) {
      console.error('Error loading session bridge:', e);
      return null;
    }
  }

  /**
   * Session Bridge: Clear after successful transfer
   */
  clearSessionBridge() {
    try {
      this.useSessionStorage.session.removeItem(this.sessionBridgeKey);
    } catch (e) {
      console.error('Error clearing session bridge:', e);
    }
  }

  /**
   * Session Bridge: Cleanup expired bridges
   */
  cleanupSessionBridge() {
    this.loadFromSessionBridge(); // This will auto-clear if expired
  }

  /**
   * Migrate from old storage format
   */
  migrateOldData() {
    try {
      // Check for old pet-storage.js format (perkie_pet_*)
      const oldKeys = Object.keys(localStorage).filter(k => k.startsWith('perkie_pet_'));

      if (oldKeys.length === 0) {
        return; // No old data to migrate
      }

      console.log('Migrating old pet data format...');

      const data = this.loadFromStorage();

      oldKeys.forEach(key => {
        try {
          const oldPet = JSON.parse(localStorage.getItem(key));
          const petId = key.replace('perkie_pet_', '');

          // Extract pet number from session key
          const match = petId.match(/^pet_(\d+)/);
          if (!match) return;

          const petIndex = parseInt(match[1]);

          // Convert old format to new format
          data.pets[petIndex] = {
            petId: petIndex,
            name: oldPet.name || oldPet.petName || '',
            image: {
              original: oldPet.originalImage || null,
              processed: oldPet.processedImage || null,
              gcsUrl: oldPet.gcsUrl || null
            },
            style: oldPet.effect || oldPet.selectedEffect || null,
            font: null,
            previews: oldPet.effects || {},
            artistNote: oldPet.artistNote || '',
            metadata: {
              uploadedAt: oldPet.timestamp || null,
              processedAt: null,
              sessionKey: petId
            }
          };

          // Remove old key
          localStorage.removeItem(key);
        } catch (e) {
          console.error(`Error migrating ${key}:`, e);
        }
      });

      // Save migrated data
      this.saveToStorage(data);

      console.log('Migration complete:', Object.keys(data.pets).length, 'pets migrated');
    } catch (e) {
      console.error('Error during migration:', e);
    }
  }

  /**
   * Emergency cleanup when storage quota exceeded
   */
  emergencyCleanup(data) {
    console.log('Running emergency cleanup...');

    // Strategy: Remove preview images (largest data), keep core pet info
    const pets = data.pets;

    for (const petId in pets) {
      const pet = pets[petId];

      // Clear all preview data URLs (keep GCS URLs only)
      if (pet.previews) {
        for (const style in pet.previews) {
          const url = pet.previews[style];
          // Remove data URLs, keep GCS URLs
          if (url && url.startsWith('data:')) {
            pet.previews[style] = null;
          }
        }
      }

      // Clear original image if it's a data URL
      if (pet.image && pet.image.original && pet.image.original.startsWith('data:')) {
        pet.image.original = null; // Keep only GCS URL
      }
    }

    // Try saving again
    try {
      const serialized = JSON.stringify(data);
      this.useSessionStorage.persistent.setItem(this.storageKey, serialized);
      console.log('Emergency cleanup successful');
    } catch (e) {
      console.error('Emergency cleanup failed, clearing all pet data');
      this.clearAllPets();
    }
  }

  /**
   * Get storage usage statistics
   */
  getStorageUsage() {
    try {
      const stored = this.useSessionStorage.persistent.getItem(this.storageKey);
      const size = stored ? stored.length : 0;

      return {
        usedBytes: size,
        usedKB: (size / 1024).toFixed(2),
        usedMB: (size / (1024 * 1024)).toFixed(2),
        maxMB: (this.maxStorageSize / (1024 * 1024)).toFixed(2),
        percentage: ((size / this.maxStorageSize) * 100).toFixed(1)
      };
    } catch (e) {
      return {
        usedBytes: 0,
        usedKB: '0',
        usedMB: '0',
        maxMB: '4',
        percentage: '0'
      };
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(event, callback) {
    if (!this.subscribers[event]) {
      this.subscribers[event] = [];
    }

    this.subscribers[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
    };
  }

  /**
   * Notify subscribers of state changes
   */
  notifySubscribers(event, data) {
    if (this.subscribers[event]) {
      this.subscribers[event].forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error('Error in subscriber callback:', e);
        }
      });
    }
  }

  /**
   * Handle cross-tab storage changes
   */
  handleStorageChange(e) {
    if (e.key === this.storageKey) {
      this.notifySubscribers('externalChange', {
        newValue: e.newValue,
        oldValue: e.oldValue
      });
    }
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Debug: Log current state
   */
  debugState() {
    const data = this.loadFromStorage();
    const usage = this.getStorageUsage();

    console.log('=== Pet State Manager Debug ===');
    console.log('Version:', data.version);
    console.log('Session ID:', data.sessionId);
    console.log('Last Modified:', new Date(data.lastModified).toLocaleString());
    console.log('Pets:', Object.keys(data.pets).length);
    console.log('Storage Usage:', usage.usedKB, 'KB /', usage.maxMB, 'MB (', usage.percentage, '%)');
    console.log('Pets Data:', data.pets);
    console.log('==============================');

    return data;
  }
}

// Backward compatibility: Expose as window.PetStorage
class PetStorageCompatibilityLayer {
  static save(sessionKey, petData) {
    const manager = PetStateManager.getInstance();

    // Extract pet number from session key (pet_1_timestamp → 1)
    const match = sessionKey.match(/^pet_(\d+)/);
    const petIndex = match ? parseInt(match[1]) : 1;

    return manager.updatePet(petIndex, {
      name: petData.name || '',
      artistNote: petData.artistNote || '',
      previews: petData.effects || {},
      metadata: {
        sessionKey: sessionKey,
        uploadedAt: petData.timestamp || Date.now()
      }
    });
  }

  static get(sessionKey) {
    const manager = PetStateManager.getInstance();

    const match = sessionKey.match(/^pet_(\d+)/);
    const petIndex = match ? parseInt(match[1]) : 1;

    return manager.getPet(petIndex);
  }

  static getAll() {
    const manager = PetStateManager.getInstance();
    return manager.getAllPets();
  }

  static delete(sessionKey) {
    const manager = PetStateManager.getInstance();

    const match = sessionKey.match(/^pet_(\d+)/);
    const petIndex = match ? parseInt(match[1]) : 1;

    manager.deletePet(petIndex);
    return true;
  }

  static clear() {
    const manager = PetStateManager.getInstance();
    manager.clearAllPets();
  }

  static updateGlobalPets() {
    // Compatibility method - now handled by event system
    const manager = PetStateManager.getInstance();
    const pets = manager.getAllPets();

    window.perkiePets = {
      pets: Object.values(pets).map(pet => ({
        sessionKey: pet.metadata?.sessionKey || `pet_${pet.petId}`,
        artistNote: pet.artistNote || '',
        effects: pet.previews || {},
        timestamp: pet.metadata?.uploadedAt || Date.now()
      }))
    };
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.PetStateManager = PetStateManager;
  window.PetStorage = PetStorageCompatibilityLayer; // Backward compatibility
}
