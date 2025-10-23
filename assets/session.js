/**
 * Session Manager - State Persistence Module
 * Elegant localStorage management with automatic cleanup
 * Handles session recovery and data validation
 */

export class SessionManager {
  constructor() {
    this.storageKey = 'perkie_session';
    this.ttl = 24 * 60 * 60 * 1000; // 24 hours
    this.maxSize = 5 * 1024 * 1024; // 5MB limit
    this.session = null;
    
    this.init();
  }

  init() {
    // Clean up expired sessions on init
    this.cleanupExpired();
    
    // Listen for storage events (cross-tab sync)
    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey) {
        this.handleStorageChange(e);
      }
    });
  }

  async save(data) {
    try {
      const session = {
        id: this.generateId(),
        data: data,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.ttl
      };

      // Compress data if needed
      const compressed = await this.compress(session);
      
      // Check size before saving
      if (compressed.length > this.maxSize) {
        throw new Error('Session data too large');
      }

      localStorage.setItem(this.storageKey, compressed);
      this.session = session;
      
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        this.handleQuotaExceeded();
        // Retry once after cleanup
        try {
          localStorage.setItem(this.storageKey, compressed);
          return true;
        } catch (retryError) {
          console.error('Failed to save session after cleanup:', retryError);
          return false;
        }
      }
      
      console.error('Session save error:', error);
      return false;
    }
  }

  async restore() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return null;

      const session = await this.decompress(stored);
      
      // Validate session
      if (!this.isValid(session)) {
        this.clear();
        return null;
      }

      this.session = session;
      return session.data;
    } catch (error) {
      console.error('Session restore error:', error);
      this.clear();
      return null;
    }
  }

  isValid(session) {
    if (!session || !session.data) return false;
    if (!session.expiresAt) return false;
    if (Date.now() > session.expiresAt) return false;
    
    return true;
  }

  async compress(data) {
    // Simple JSON compression for now
    // Could be enhanced with LZ-string or similar
    return JSON.stringify(data);
  }

  async decompress(data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      throw new Error('Invalid session data');
    }
  }

  generateId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  clear() {
    localStorage.removeItem(this.storageKey);
    this.session = null;
  }

  cleanupExpired() {
    // Clean up all expired perkie sessions
    const keys = Object.keys(localStorage);
    const now = Date.now();
    
    keys.forEach(key => {
      if (key.startsWith('perkie_')) {
        try {
          const data = localStorage.getItem(key);
          const session = JSON.parse(data);
          
          if (session.expiresAt && now > session.expiresAt) {
            localStorage.removeItem(key);
          }
        } catch (e) {
          // Invalid data, remove it
          localStorage.removeItem(key);
        }
      }
    });
  }

  handleQuotaExceeded() {
    // Smart cleanup when storage is full
    const items = [];
    const keys = Object.keys(localStorage);
    
    // Collect all perkie items with timestamps
    keys.forEach(key => {
      if (key.startsWith('perkie_')) {
        try {
          const data = localStorage.getItem(key);
          const parsed = JSON.parse(data);
          items.push({
            key: key,
            timestamp: parsed.timestamp || 0,
            size: data.length
          });
        } catch (e) {
          // Remove invalid items
          localStorage.removeItem(key);
        }
      }
    });
    
    // Sort by timestamp (oldest first)
    items.sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest items until we have enough space
    const targetSize = this.maxSize / 2; // Free up 50% space
    let freedSpace = 0;
    
    for (const item of items) {
      if (freedSpace >= targetSize) break;
      localStorage.removeItem(item.key);
      freedSpace += item.size;
    }
  }

  handleStorageChange(event) {
    // Handle cross-tab session updates
    if (event.newValue) {
      try {
        this.session = JSON.parse(event.newValue);
        // Notify listeners of session change
        window.dispatchEvent(new CustomEvent('sessionUpdated', {
          detail: this.session
        }));
      } catch (e) {
        console.error('Invalid session update:', e);
      }
    } else {
      // Session was cleared
      this.session = null;
      window.dispatchEvent(new CustomEvent('sessionCleared'));
    }
  }

  // Get current session without restoring from storage
  getCurrent() {
    return this.session?.data || null;
  }

  // Update specific session data
  async update(key, value) {
    if (!this.session) {
      await this.restore();
    }
    
    if (!this.session) {
      this.session = {
        id: this.generateId(),
        data: {},
        timestamp: Date.now(),
        expiresAt: Date.now() + this.ttl
      };
    }
    
    this.session.data[key] = value;
    return this.save(this.session.data);
  }

  // Emergency cleanup for users
  static emergencyCleanup() {
    const keys = Object.keys(localStorage);
    let removed = 0;
    
    keys.forEach(key => {
      if (key.startsWith('perkie_')) {
        localStorage.removeItem(key);
        removed++;
      }
    });
    
    console.log(`Emergency cleanup: Removed ${removed} perkie sessions`);
    return removed;
  }
}

// Export for global access if needed
if (typeof window !== 'undefined') {
  window.PerkieSessionManager = SessionManager;
  window.emergencyCleanupPerkieSessions = SessionManager.emergencyCleanup;
}