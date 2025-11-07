# Technical Architecture: Preview Redesign System
**Project**: Perkie Prints Pet Portrait Platform
**Date**: 2025-11-06
**Version**: 1.0
**Status**: Phase 0 - Foundation
**Authors**: Technical Architecture Team

---

## Executive Summary

This document defines the complete technical architecture for the preview redesign system, consisting of two major components:
1. **Inline Preview on Product Pages** - Embed AI preview directly in product pages
2. **Processor Page Redesign** - Transform processor into lead generation tool

**Key Architectural Decisions**:
- Unified state management across all pages
- Shared component library (bottom sheet, progress indicators)
- Versioned session bridge for data transfer
- Mobile-first responsive design
- Progressive enhancement with graceful degradation

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Entry Points                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Product Page              Processor Page                     │
│  ┌─────────────┐          ┌──────────────┐                  │
│  │   Upload    │          │    Upload    │                  │
│  │     ↓       │          │      ↓       │                  │
│  │ Inline      │          │  Processing  │                  │
│  │ Preview     │  ←───────│      ↓       │                  │
│  │     ↓       │ Session  │   4 Styles   │                  │
│  │  Select     │ Bridge   │      ↓       │                  │
│  │  Style      │          │  Email       │                  │
│  │     ↓       │          │  Capture     │                  │
│  │    Cart     │          │      ↓       │                  │
│  └─────────────┘          │  Products    │                  │
│                            └──────────────┘                  │
└─────────────────────────────────────────────────────────────┘
           ↓                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Shared Component Layer                     │
├─────────────────────────────────────────────────────────────┤
│  • PetStateManager      (state management)                   │
│  • SessionBridge        (data transfer)                      │
│  • BottomSheet          (UI component)                       │
│  • StyleCarousel        (swipe interaction)                  │
│  • ProgressIndicator    (processing feedback)                │
└─────────────────────────────────────────────────────────────┘
           ↓                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Storage Layer                           │
├─────────────────────────────────────────────────────────────┤
│  • sessionStorage       (temporary session data)             │
│  • localStorage         (persistent pet data)                │
│  • IndexedDB            (future: large image caching)        │
└─────────────────────────────────────────────────────────────┘
           ↓                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
├─────────────────────────────────────────────────────────────┤
│  • InSPyReNet API       (background removal)                 │
│  • Gemini 2.5 Flash     (artistic effects)                   │
│  • Google Cloud Storage (image hosting)                      │
│  • Shopify API          (customer/email management)          │
│  • Email Service        (lead nurture)                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

**Frontend**:
- **JavaScript**: ES6+ transpiled to ES5 for compatibility
- **CSS**: BEM methodology with CSS Grid/Flexbox
- **HTML**: Semantic HTML5 with ARIA attributes
- **Liquid**: Shopify templating for server-side rendering

**APIs**:
- **InSPyReNet**: FastAPI background removal (existing)
- **Gemini**: Google Gemini 2.5 Flash Image API (existing)
- **Shopify**: Customer API, Cart API (existing)
- **Email**: TBD (Klaviyo/Mailchimp/SendGrid)

**Storage**:
- **sessionStorage**: Temporary preview data (<5MB)
- **localStorage**: Persistent user data (<5MB)
- **GCS**: Image hosting (server-side)

**Testing**:
- **Vitest**: Unit tests (80% coverage target)
- **Playwright**: E2E tests (mobile + desktop)
- **Lighthouse**: Performance audits

---

## 2. Core Components

### 2.1 PetStateManager (Unified State Management)

**Purpose**: Single source of truth for all pet data across pages

**Responsibilities**:
- Manage pet data (images, styles, names, notes)
- Persist data to storage (session or local)
- Notify subscribers of state changes
- Handle storage quota limits
- Migrate data between schema versions

**Architecture**:

```javascript
/**
 * Unified state manager for pet data
 * Prevents state fragmentation identified by code reviewer
 */
class PetStateManager {
  constructor(options = {}) {
    this.version = 2; // Schema version for migrations
    this.storageKey = 'perkie_pet_data_v2';
    this.storage = this.detectStorageStrategy(); // session vs local
    this.subscribers = {}; // Observer pattern
    this.cache = null; // In-memory cache

    // Initialize
    this.init();
  }

  /**
   * Detect best storage strategy
   * Falls back to localStorage if sessionStorage unavailable (private browsing)
   */
  detectStorageStrategy() {
    try {
      sessionStorage.setItem('_test', '1');
      sessionStorage.removeItem('_test');
      return sessionStorage;
    } catch {
      console.warn('sessionStorage unavailable, using localStorage');
      return localStorage;
    }
  }

  /**
   * Initialize state from storage
   */
  init() {
    try {
      const data = this.storage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);

        // Migrate old schema if needed
        if (parsed.version < this.version) {
          this.cache = this.migrateSchema(parsed);
        } else {
          this.cache = parsed;
        }
      } else {
        // Initialize empty state
        this.cache = this.createEmptyState();
      }
    } catch (error) {
      console.error('Failed to initialize state:', error);
      this.cache = this.createEmptyState();
    }
  }

  /**
   * Create empty state structure
   */
  createEmptyState() {
    return {
      version: this.version,
      pets: [
        this.createEmptyPet(),
        this.createEmptyPet(),
        this.createEmptyPet()
      ],
      metadata: {
        createdAt: Date.now(),
        lastModified: Date.now(),
        source: 'unknown' // 'product' or 'processor'
      }
    };
  }

  /**
   * Create empty pet object
   */
  createEmptyPet() {
    return {
      name: '',
      image: {
        original: null,      // GCS URL or blob URL
        processed: null,      // Background removed
        gcsUrl: null,        // Server-stored URL
        uploadedAt: null
      },
      style: null,           // 'modern', 'sketch', 'watercolor', 'vintage'
      font: null,            // 'preppy', 'classic', 'playful', 'elegant'
      previews: {
        modern: null,        // GCS URL
        sketch: null,
        watercolor: null,
        vintage: null
      },
      artistNotes: '',       // Max 500 chars
      metadata: {
        processedAt: null,
        orderType: null,     // 'express_upload', 'preview_first'
        processingState: 'empty' // 'empty', 'uploaded', 'processing', 'complete'
      }
    };
  }

  /**
   * Get pet data by index (0-2)
   */
  getPet(index) {
    if (index < 0 || index > 2) {
      throw new Error(`Invalid pet index: ${index}`);
    }

    return this.cache.pets[index] || this.createEmptyPet();
  }

  /**
   * Update pet data
   * @param {number} index - Pet index (0-2)
   * @param {object} updates - Partial pet object
   */
  updatePet(index, updates) {
    if (index < 0 || index > 2) {
      throw new Error(`Invalid pet index: ${index}`);
    }

    // Deep merge updates
    this.cache.pets[index] = this.deepMerge(
      this.cache.pets[index] || this.createEmptyPet(),
      updates
    );

    // Update metadata
    this.cache.metadata.lastModified = Date.now();

    // Persist to storage
    this.save();

    // Notify subscribers
    this.notify('petUpdated', { index, data: this.cache.pets[index] });
  }

  /**
   * Save state to storage
   */
  save() {
    try {
      const data = JSON.stringify(this.cache);
      this.storage.setItem(this.storageKey, data);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded');
        this.handleQuotaExceeded();
      } else {
        console.error('Failed to save state:', error);
      }
    }
  }

  /**
   * Handle storage quota exceeded
   * Clear old preview images, keep essential data
   */
  handleQuotaExceeded() {
    // Clear preview URLs (can be regenerated)
    this.cache.pets.forEach(pet => {
      pet.previews = {
        modern: null,
        sketch: null,
        watercolor: null,
        vintage: null
      };
    });

    // Try saving again
    try {
      this.save();
    } catch (error) {
      console.error('Still exceeds quota after cleanup:', error);
      // Last resort: clear all data
      this.clear();
    }
  }

  /**
   * Clear all state
   */
  clear() {
    this.cache = this.createEmptyState();
    this.storage.removeItem(this.storageKey);
    this.notify('stateCleared', {});
  }

  /**
   * Subscribe to state changes
   * @param {string} event - Event name ('petUpdated', 'stateCleared')
   * @param {function} callback - Callback function
   */
  subscribe(event, callback) {
    if (!this.subscribers[event]) {
      this.subscribers[event] = [];
    }
    this.subscribers[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers[event] = this.subscribers[event].filter(
        cb => cb !== callback
      );
    };
  }

  /**
   * Notify subscribers of event
   */
  notify(event, data) {
    if (this.subscribers[event]) {
      this.subscribers[event].forEach(callback => callback(data));
    }
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };

    Object.keys(source).forEach(key => {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  }

  /**
   * Migrate old schema to new version
   */
  migrateSchema(oldData) {
    console.log(`Migrating schema from v${oldData.version} to v${this.version}`);

    // Migration logic based on version
    if (oldData.version === 1) {
      // v1 to v2: Add artistNotes field
      oldData.pets.forEach(pet => {
        if (!pet.artistNotes) {
          pet.artistNotes = '';
        }
      });
    }

    oldData.version = this.version;
    return oldData;
  }

  /**
   * Export state for debugging
   */
  export() {
    return JSON.parse(JSON.stringify(this.cache));
  }
}

// Global instance
window.petStateManager = new PetStateManager();
```

**Usage Example**:

```javascript
// Product page: Update pet 1
petStateManager.updatePet(0, {
  image: { gcsUrl: 'https://storage.googleapis.com/...' },
  style: 'modern'
});

// Subscribe to changes
const unsubscribe = petStateManager.subscribe('petUpdated', (data) => {
  console.log(`Pet ${data.index} updated:`, data.data);
  // Update UI
});

// Later: Unsubscribe
unsubscribe();
```

---

### 2.2 SessionBridge (Data Transfer Between Pages)

**Purpose**: Transfer pet data from processor page to product page without re-upload

**Responsibilities**:
- Write session data with metadata (version, expiry, source)
- Read and validate session data
- Handle schema migrations
- Clean up expired sessions

**Architecture**:

```javascript
/**
 * Session bridge for processor → product data transfer
 * Fixes tight coupling identified by code reviewer
 */
class SessionBridge {
  constructor() {
    this.version = 2; // Schema version
    this.keyPrefix = 'perkie_bridge_';
    this.ttl = 3600000; // 1 hour expiry (milliseconds)
  }

  /**
   * Write transfer data
   * @param {object} data - Pet data to transfer
   * @returns {object} Transfer metadata
   */
  writeTransfer(data) {
    // Validate data structure
    if (!this.validateData(data)) {
      throw new Error('Invalid transfer data structure');
    }

    const transfer = {
      version: this.version,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttl,
      source: 'processor',
      data: data
    };

    const key = `${this.keyPrefix}v${this.version}_transfer`;

    try {
      sessionStorage.setItem(key, JSON.stringify(transfer));
      console.log('Session bridge: Transfer written', key);
      return transfer;
    } catch (error) {
      console.error('Failed to write transfer:', error);
      throw error;
    }
  }

  /**
   * Read transfer data
   * @returns {object|null} Transfer data or null if not found/expired
   */
  readTransfer() {
    const key = `${this.keyPrefix}v${this.version}_transfer`;
    const raw = sessionStorage.getItem(key);

    if (!raw) {
      console.log('Session bridge: No transfer found');
      return null;
    }

    try {
      const transfer = JSON.parse(raw);

      // Validate schema version
      if (transfer.version !== this.version) {
        console.warn(`Schema version mismatch: ${transfer.version} vs ${this.version}`);
        return this.migrateTransfer(transfer);
      }

      // Check expiry
      if (Date.now() > transfer.expiresAt) {
        console.warn('Transfer expired, removing');
        sessionStorage.removeItem(key);
        return null;
      }

      // Validate source
      if (transfer.source !== 'processor') {
        console.warn('Invalid transfer source:', transfer.source);
        return null;
      }

      // Clean up after reading
      sessionStorage.removeItem(key);

      console.log('Session bridge: Transfer read successfully');
      return transfer.data;
    } catch (error) {
      console.error('Failed to read transfer:', error);
      return null;
    }
  }

  /**
   * Validate transfer data structure
   */
  validateData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.pets || !Array.isArray(data.pets)) return false;
    return true;
  }

  /**
   * Migrate old transfer schema
   */
  migrateTransfer(oldTransfer) {
    console.log('Migrating transfer schema...');

    // Add migration logic as schema evolves
    if (oldTransfer.version === 1) {
      // v1 to v2 migration
      oldTransfer.data.pets.forEach(pet => {
        if (!pet.artistNotes) {
          pet.artistNotes = '';
        }
      });
    }

    return oldTransfer.data;
  }

  /**
   * Clear all transfers (cleanup)
   */
  clearAll() {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(this.keyPrefix)) {
        sessionStorage.removeItem(key);
      }
    });
  }
}

// Global instance
window.sessionBridge = new SessionBridge();
```

**Usage Example**:

```javascript
// Processor page: Write transfer
const petData = petStateManager.export();
sessionBridge.writeTransfer(petData);
window.location.href = '/products/canvas-print';

// Product page: Read transfer
const transferredData = sessionBridge.readTransfer();
if (transferredData) {
  // Auto-populate from processor
  transferredData.pets.forEach((pet, index) => {
    if (pet.image.gcsUrl) {
      petStateManager.updatePet(index, pet);
      showProcessedImageThumbnail(index, pet.image.gcsUrl);
    }
  });
}
```

---

## 3. Data Flow Diagrams

### 3.1 Inline Preview Flow (Product Page)

```
User Action: Upload Image
         ↓
[Client] File selected
         ↓
[Client] Start upload to GCS (server-first)
         ↓
[Server] GCS: Store original image → Return URL
         ↓
[Client] petStateManager.updatePet(0, { image: { gcsUrl } })
         ↓
[Client] Auto-trigger background removal (don't wait for user click)
         ↓
[API] InSPyReNet: Remove background → Return processed URL
         ↓
[Client] petStateManager.updatePet(0, { image: { processed } })
         ↓
[Client] Trigger style generation (4 styles in parallel)
         ↓
[API] Gemini: Generate modern, sketch, watercolor, vintage
         ↓
[Client] Progressive loading: Show first style (8-12s)
         ↓
[Client] User taps "Preview Styles" → Bottom sheet opens
         ↓
[Client] Display style carousel (swipe left/right)
         ↓
[Client] User selects style → Updates petStateManager
         ↓
[Client] User expands "Artist Notes" → Types notes
         ↓
[Client] User taps "Select This Style" → Bottom sheet closes
         ↓
[Client] Product page shows selected style thumbnail
         ↓
[Client] User clicks "Add to Cart"
         ↓
[Client] Shopify cart with order properties populated
```

### 3.2 Processor → Product Flow (Session Bridge)

```
User Action: Upload on Processor Page
         ↓
[Client] File selected
         ↓
[Client] Upload to GCS
         ↓
[API] InSPyReNet + Gemini: Process image
         ↓
[Client] Display 4 styles on processor page
         ↓
[Client] User selects favorite style (e.g., Modern)
         ↓
User Action: Click "Shop Products"
         ↓
[Client] petStateManager exports current state
         ↓
[Client] sessionBridge.writeTransfer(state)
         ↓
[Client] Redirect to product page (or recommended product)
         ↓
[Client] Product page loads
         ↓
[Client] sessionBridge.readTransfer()
         ↓
[Client] If transfer found:
         ↓
[Client] petStateManager.updatePet(0, transferredData)
         ↓
[Client] Show "✓ Image already processed" with thumbnail
         ↓
[Client] Pre-select Modern style
         ↓
[Client] User just adds pet name → Add to cart
```

---

## 4. Browser Compatibility

### 4.1 Supported Browsers

**Minimum Versions** (98% coverage target):

| Browser | Version | Market Share | Status |
|---------|---------|--------------|--------|
| Chrome (desktop) | 80+ | 45% | ✅ Fully supported |
| Safari (desktop) | 13+ | 15% | ✅ Fully supported |
| Firefox (desktop) | 75+ | 8% | ✅ Fully supported |
| Edge (desktop) | 80+ | 10% | ✅ Fully supported |
| Safari iOS | 13+ | 45% | ✅ Fully supported |
| Chrome Android | 80+ | 25% | ✅ Fully supported |
| Samsung Internet | 11+ | 5% | ⚠️ Tested but limited |

### 4.2 Feature Detection & Polyfills

```javascript
/**
 * Feature detection with graceful degradation
 */
const browserCapabilities = {
  // Storage APIs
  sessionStorage: (() => {
    try {
      sessionStorage.setItem('_test', '1');
      sessionStorage.removeItem('_test');
      return true;
    } catch {
      return false;
    }
  })(),

  // Touch events (mobile detection)
  touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,

  // Intersection Observer (lazy loading)
  intersectionObserver: 'IntersectionObserver' in window,

  // CSS Grid (layout)
  cssGrid: CSS.supports('display', 'grid'),

  // Passive event listeners (performance)
  passiveEvents: (() => {
    let passive = false;
    try {
      const opts = Object.defineProperty({}, 'passive', {
        get: () => { passive = true; }
      });
      window.addEventListener('test', null, opts);
      window.removeEventListener('test', null, opts);
    } catch {}
    return passive;
  })()
};

// Fallbacks
if (!browserCapabilities.sessionStorage) {
  console.warn('sessionStorage unavailable, using localStorage');
  window.sessionStorage = window.localStorage;
}

if (!browserCapabilities.intersectionObserver) {
  // Load polyfill
  console.warn('IntersectionObserver not supported, lazy loading disabled');
}
```

---

## 5. Performance Budgets

### 5.1 Target Metrics

| Metric | Target | Acceptable | Critical |
|--------|--------|------------|----------|
| **Bottom Sheet Open** | <50ms | <100ms | <200ms |
| **First Style Load** | <8s | <12s | <15s |
| **All Styles Load** | <20s | <25s | <30s |
| **FPS (animations)** | 60fps | 50fps | 30fps |
| **Memory Usage** | <30MB | <50MB | <100MB |
| **JavaScript Bundle** | <150KB | <200KB | <300KB |
| **CSS Bundle** | <30KB | <50KB | <100KB |
| **Page Load (4G)** | <2s | <3s | <5s |
| **Page Load (3G)** | <5s | <8s | <12s |

### 5.2 Optimization Strategies

**Code Splitting**:
```javascript
// Lazy load bottom sheet only when needed
async function loadBottomSheet() {
  const { BottomSheet } = await import('./components/bottom-sheet.js');
  return BottomSheet;
}
```

**Image Optimization**:
- WebP with JPEG fallback
- Responsive images (srcset)
- Lazy loading with IntersectionObserver
- Progressive JPEG for previews

**Caching Strategy**:
- Service worker for offline support
- Cache-Control headers (1 year for images)
- sessionStorage for temporary data

---

## 6. Security Architecture

### 6.1 Threat Model

**Identified Threats**:
1. XSS in artist notes field
2. Session hijacking (sessionStorage)
3. Email spam/abuse
4. Malicious file uploads
5. CSRF attacks

### 6.2 Security Protocols

**Input Validation & Sanitization**:

```javascript
/**
 * Sanitize artist notes (prevent XSS)
 */
function sanitizeArtistNotes(input) {
  // HTML entity encoding
  const div = document.createElement('div');
  div.textContent = input;
  const sanitized = div.innerHTML;

  // Length limit
  const maxLength = 500;
  const truncated = sanitized.substring(0, maxLength);

  // Remove dangerous patterns
  const cleaned = truncated
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');

  return cleaned;
}
```

**Email Validation**:

```javascript
/**
 * Email validation (server-side required)
 */
async function validateEmail(email) {
  // Client-side basic validation
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Server-side validation (call backend)
  const response = await fetch('/api/validate-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  return response.json();
}
```

**Rate Limiting**:
- Email capture: 100 submissions/hour per IP
- Image upload: 50 uploads/hour per session
- API calls: 1000 requests/hour per user

**GDPR Compliance**:
- Explicit consent checkbox for email capture
- Privacy policy link visible
- Right to deletion (email support@perkieprints.com)
- Data retention: 90 days for non-customers

---

## 7. Testing Strategy

### 7.1 Unit Tests (Vitest)

**Coverage Target**: 80% minimum

**Test Files**:
```
tests/
├── pet-state-manager.test.js     (state management)
├── session-bridge.test.js        (data transfer)
├── bottom-sheet.test.js          (UI component)
├── style-carousel.test.js        (swipe interaction)
└── sanitization.test.js          (security)
```

**Example Test**:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { PetStateManager } from '../assets/pet-state-manager.js';

describe('PetStateManager', () => {
  let stateManager;

  beforeEach(() => {
    // Clear storage before each test
    sessionStorage.clear();
    localStorage.clear();
    stateManager = new PetStateManager();
  });

  it('should initialize with empty state', () => {
    const pet = stateManager.getPet(0);
    expect(pet.name).toBe('');
    expect(pet.image.gcsUrl).toBeNull();
  });

  it('should update pet data', () => {
    stateManager.updatePet(0, {
      name: 'Fluffy',
      image: { gcsUrl: 'https://example.com/image.jpg' }
    });

    const pet = stateManager.getPet(0);
    expect(pet.name).toBe('Fluffy');
    expect(pet.image.gcsUrl).toBe('https://example.com/image.jpg');
  });

  it('should notify subscribers on update', (done) => {
    stateManager.subscribe('petUpdated', (data) => {
      expect(data.index).toBe(0);
      expect(data.data.name).toBe('Fluffy');
      done();
    });

    stateManager.updatePet(0, { name: 'Fluffy' });
  });

  it('should handle quota exceeded', () => {
    // Mock storage quota error
    const originalSetItem = sessionStorage.setItem;
    sessionStorage.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };

    // Should not throw, should handle gracefully
    expect(() => {
      stateManager.updatePet(0, { name: 'Fluffy' });
    }).not.toThrow();

    // Restore
    sessionStorage.setItem = originalSetItem;
  });
});
```

### 7.2 Integration Tests (Playwright)

**Test Scenarios**:
1. Complete inline preview flow (upload → preview → cart)
2. Session bridge flow (processor → product)
3. Multi-pet workflow (3 pets)
4. Network failure recovery
5. Mobile gestures (swipe, pinch)

**Example Test**:

```javascript
import { test, expect } from '@playwright/test';

test.describe('Inline Preview Flow', () => {
  test('should complete preview and add to cart', async ({ page }) => {
    // Navigate to product page
    await page.goto('/products/canvas-print');

    // Upload image
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test-fixtures/dog.jpg');

    // Wait for upload confirmation
    await expect(page.locator('.upload-success')).toBeVisible({ timeout: 10000 });

    // Click preview button
    await page.click('[data-preview-button]');

    // Wait for bottom sheet
    await expect(page.locator('.bottom-sheet')).toBeVisible();

    // Wait for first style to load
    await expect(page.locator('.style-modern')).toBeVisible({ timeout: 15000 });

    // Select Modern style
    await page.click('.style-modern .select-button');

    // Bottom sheet should close
    await expect(page.locator('.bottom-sheet')).not.toBeVisible();

    // Add to cart
    await page.click('[data-add-to-cart]');

    // Verify cart
    await expect(page.locator('.cart-item')).toBeVisible();
    const cartData = await page.evaluate(() => window.Shopify.cart);
    expect(cartData.items).toHaveLength(1);
    expect(cartData.items[0].properties).toHaveProperty('Style', 'Modern');
  });
});
```

---

## 8. Deployment Strategy

### 8.1 Feature Flags

```javascript
/**
 * Feature flags for gradual rollout
 */
const featureFlags = {
  inlinePreview: {
    enabled: true,
    rolloutPercentage: 10, // Start with 10% traffic
    platforms: ['mobile', 'desktop']
  },
  processorRedesign: {
    enabled: false, // Launch after inline preview
    rolloutPercentage: 0
  }
};

function isFeatureEnabled(feature) {
  const flag = featureFlags[feature];
  if (!flag || !flag.enabled) return false;

  // Check rollout percentage
  const userId = getUserId(); // Hash of session ID
  const bucket = userId % 100;
  return bucket < flag.rolloutPercentage;
}
```

### 8.2 Monitoring & Alerts

**Error Tracking** (Sentry):
- JavaScript errors
- API failures
- Performance issues

**Analytics** (GA4):
- Conversion events
- Preview usage rate
- Style selection distribution

**Alerts**:
- Error rate >1% → Slack notification
- Conversion drop >10% → Email alert
- API latency >5s → PagerDuty

---

## 9. Rollback Procedures

### 9.1 Emergency Rollback

**If critical issues detected**:
1. Disable feature flag immediately
2. Revert to previous code version
3. Clear sessionStorage/localStorage for affected users
4. Monitor error rates

**Rollback Commands**:
```bash
# Disable feature flag
curl -X POST /api/feature-flags/inlinePreview/disable

# Deploy previous version
git revert HEAD
git push origin main
```

### 9.2 Data Migration

**If schema changes required**:
- Maintain backward compatibility
- Migrate data on read (lazy migration)
- Clean up old data after 30 days

---

## 10. Documentation Requirements

**Required Documentation**:
1. ✅ Technical architecture (this document)
2. ⏳ API documentation (Phase 0)
3. ⏳ Component library docs (Phase 2)
4. ⏳ Testing guide (Phase 4)
5. ⏳ Deployment procedures (Phase 4)
6. ⏳ Troubleshooting guide (Phase 5)

---

## 11. Open Questions & Decisions Needed

**Pending Decisions**:
1. Email service provider (Klaviyo vs Mailchimp vs SendGrid)?
2. Analytics platform (GA4 vs Mixpanel)?
3. Error tracking (Sentry vs Rollbar)?
4. A/B testing tool (Google Optimize vs Optimizely)?

**Risk Items**:
1. Session bridge may not work across subdomains (test needed)
2. sessionStorage 5MB limit could be hit with 3 high-res pets (test needed)
3. Email deliverability with chosen provider (test needed)

---

## Appendix A: Code Style Guide

**JavaScript**:
- ES6+ syntax, transpiled to ES5
- JSDoc comments for all public methods
- 2-space indentation
- Single quotes for strings
- Semicolons required

**CSS**:
- BEM methodology (.block__element--modifier)
- Mobile-first media queries
- CSS custom properties for theming
- 2-space indentation

**Liquid**:
- Shopify standards
- Comments for complex logic
- Consistent naming conventions

---

## Appendix B: Performance Checklist

**Before Launch**:
- [ ] Lighthouse score >85 on mobile
- [ ] All images optimized (WebP + fallback)
- [ ] JavaScript minified & compressed
- [ ] CSS minified & compressed
- [ ] Lazy loading implemented
- [ ] Service worker configured
- [ ] CDN configured for static assets

---

**Document Status**: DRAFT
**Next Review**: After Phase 0 completion (Week 2)
**Approval Required**: Technical Lead, Product Manager
**Version History**:
- v1.0 (2025-11-06): Initial draft
