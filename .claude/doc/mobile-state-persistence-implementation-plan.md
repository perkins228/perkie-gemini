# Mobile State Persistence Implementation Plan

**Problem**: Cross-page navigation on mobile browsers loses all customer pet customization data
**Impact**: Critical UX failure - customers lose pet names, file uploads, and selections when clicking Preview
**Platform**: Shopify theme environment, 70% mobile traffic, e-commerce conversion tool
**Date**: 2025-11-04
**Session**: context_session_001.md

---

## Executive Summary

**Current State**: Pet selector uses in-memory JavaScript variables (`petFiles = {1:[], 2:[], 3:[]}`) that vanish on page navigation. localStorage only stores base64 preview for first image (line 1273), not actual File objects or pet names.

**Root Cause**: Page unload destroys JavaScript memory state. Mobile browsers aggressively unload pages. File inputs require native File objects, not base64 strings.

**Recommendation**: **Hybrid IndexedDB + localStorage architecture** with DataTransfer API reconstruction

**Why This Approach**:
- IndexedDB stores binary Blob data (no 33% base64 bloat, 50MB+ quota)
- localStorage stores lightweight metadata (names, counts, selections - survives even if IDB cleared)
- DataTransfer API reconstructs File objects from Blobs for Shopify form submission
- Progressive enhancement - falls back gracefully if IDB unavailable
- Mobile-first: handles memory constraints, camera uploads, poor network

---

## Technical Architecture

### Storage Strategy Matrix

| Data Type | Storage | Format | Size | Why |
|-----------|---------|--------|------|-----|
| **Pet names** | localStorage | JSON | ~100 bytes | Small, needs cross-tab sync |
| **Style/font selections** | localStorage | String | ~50 bytes | Small, session-critical |
| **File metadata** | localStorage | JSON | ~1KB | File names, sizes, types - lightweight |
| **Image files** | IndexedDB | Blob | 1-50MB each | Binary data, large quota needed |
| **Navigation state** | sessionStorage | String | ~200 bytes | Return URL, scroll position - session only |

### Storage Quota Management

**Mobile Browser Limits** (from MDN Web Docs 2024):
- **localStorage**: 5-10MB total (shared across all keys)
- **sessionStorage**: 5-10MB total (per tab)
- **IndexedDB**: 50MB minimum (Safari iOS), 50% available disk (Chrome Android)

**Our Use Case**:
- 3 pets max × 3 files each = 9 files max
- Average pet photo: 2-5MB (iPhone camera)
- Worst case: 9 × 5MB = 45MB (fits in IDB, exceeds localStorage)
- **localStorage with base64**: 45MB × 1.37 = 62MB ❌ EXCEEDS QUOTA
- **IndexedDB with Blobs**: 45MB ✅ FITS

### File Object Reconstruction Flow

```javascript
// 1. UPLOAD (ks-product-pet-selector-stitch.liquid:1189-1276)
fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);

  // Store metadata in localStorage (lightweight)
  const metadata = files.map(f => ({
    name: f.name,
    size: f.size,
    type: f.type,
    lastModified: f.lastModified
  }));
  localStorage.setItem(`pet_${i}_metadata`, JSON.stringify(metadata));

  // Store Blobs in IndexedDB (binary, no bloat)
  await PetStorageManager.saveFiles(i, files);

  // Update in-memory petFiles (for current session)
  petFiles[i] = files;
});

// 2. NAVIGATION (line 1453-1464)
function openProcessorModal(imageDataUrl, petIndex) {
  // Already stores return URL/scroll
  sessionStorage.setItem('pet_selector_return_url', window.location.href);
  sessionStorage.setItem('pet_selector_scroll_position', window.scrollY);
  sessionStorage.setItem('pet_selector_active_index', petIndex);

  // NEW: Flag that we're in cross-page navigation
  sessionStorage.setItem('pet_selector_navigation_mode', 'preview');

  window.location.href = '/pages/custom-image-processing#processor';
}

// 3. RESTORATION (on page load)
async function restoreFromStorage() {
  // Get metadata from localStorage
  const metadata = JSON.parse(localStorage.getItem(`pet_${i}_metadata`) || '[]');

  // Get Blobs from IndexedDB
  const blobs = await PetStorageManager.getFiles(i);

  // Reconstruct File objects using DataTransfer API
  const dataTransfer = new DataTransfer();
  blobs.forEach((blob, index) => {
    const meta = metadata[index];
    const file = new File([blob], meta.name, {
      type: meta.type,
      lastModified: meta.lastModified
    });
    dataTransfer.items.add(file);
  });

  // Inject into file input
  fileInput.files = dataTransfer.files;

  // Update in-memory state
  petFiles[i] = Array.from(dataTransfer.files);
}
```

---

## Implementation Plan

### Phase 1: IndexedDB Storage Manager (NEW FILE)

**File**: `assets/pet-storage-manager.js` (new file, ~300 lines)

**Purpose**: Encapsulates all IndexedDB operations with mobile-first error handling

**Key Features**:
1. **Database Schema**:
   ```javascript
   const DB_NAME = 'PerkiePetStorage';
   const DB_VERSION = 1;
   const STORE_NAME = 'petFiles';

   // Object store schema:
   {
     key: 'pet_1_file_0',      // Composite key: pet_{index}_file_{fileIndex}
     petIndex: 1,               // For querying all files for a pet
     fileIndex: 0,              // Order within pet
     blob: Blob,                // Binary image data
     metadata: {                // Redundant metadata (also in localStorage)
       name: 'fluffy.jpg',
       size: 2457600,
       type: 'image/jpeg',
       lastModified: 1699084800000
     },
     timestamp: 1699084800000   // For cleanup (delete after 7 days)
   }
   ```

2. **Core Methods**:
   ```javascript
   class PetStorageManager {
     // Initialize database (call on page load)
     static async init()

     // Save files for a pet (replaces existing)
     static async saveFiles(petIndex, files)

     // Get all files for a pet as Blobs
     static async getFiles(petIndex)

     // Delete all files for a pet
     static async deleteFiles(petIndex)

     // Delete single file
     static async deleteFile(petIndex, fileIndex)

     // Cleanup old entries (7+ days old)
     static async cleanupOldEntries()

     // Check quota and usage
     static async getStorageInfo()

     // Export for debugging
     static async exportAllData()
   }
   ```

3. **Mobile-Specific Error Handling**:
   - Quota exceeded → Alert user, offer to clear old data
   - IDB unavailable (private browsing) → Fallback to localStorage with base64 (limited to 1 file)
   - Transaction timeout → Retry with exponential backoff
   - Corrupted database → Delete and recreate
   - iOS Safari issues → Special handling for concurrent transactions

4. **Progressive Enhancement**:
   ```javascript
   // Feature detection
   const hasIndexedDB = 'indexedDB' in window;
   const hasDataTransfer = 'DataTransfer' in window;
   const hasFileConstructor = typeof File === 'function';

   // Fallback chain:
   if (hasIndexedDB && hasDataTransfer && hasFileConstructor) {
     // Full functionality
   } else if (hasDataTransfer && hasFileConstructor) {
     // Use localStorage (limited to 1 small file)
   } else {
     // Preview-only mode (can't restore File objects)
     // Show warning: "Please don't navigate away"
   }
   ```

**Code Outline**:
```javascript
/**
 * Pet Storage Manager - IndexedDB wrapper for mobile file persistence
 * Stores pet image files across page navigation
 * Version: 1.0.0
 */

class PetStorageManager {
  static DB_NAME = 'PerkiePetStorage';
  static DB_VERSION = 1;
  static STORE_NAME = 'petFiles';
  static MAX_AGE_DAYS = 7;

  // Initialize database
  static async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store
        const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });

        // Create indexes for querying
        store.createIndex('petIndex', 'petIndex', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      };
    });
  }

  // Save files for a pet (async batch operation)
  static async saveFiles(petIndex, files) {
    const db = await this.init();
    const tx = db.transaction([this.STORE_NAME], 'readwrite');
    const store = tx.objectStore(this.STORE_NAME);

    // Delete existing files for this pet first
    await this._deleteFilesForPet(store, petIndex);

    // Add new files
    const promises = files.map((file, fileIndex) => {
      return new Promise((resolve, reject) => {
        // Convert File to Blob (IDB can store Blobs)
        const blob = new Blob([file], { type: file.type });

        const entry = {
          key: `pet_${petIndex}_file_${fileIndex}`,
          petIndex: petIndex,
          fileIndex: fileIndex,
          blob: blob,
          metadata: {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          },
          timestamp: Date.now()
        };

        const request = store.add(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Get all files for a pet as Blobs (ordered by fileIndex)
  static async getFiles(petIndex) {
    const db = await this.init();
    const tx = db.transaction([this.STORE_NAME], 'readonly');
    const store = tx.objectStore(this.STORE_NAME);
    const index = store.index('petIndex');

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(petIndex));

      request.onsuccess = () => {
        const entries = request.result;

        // Sort by fileIndex (IDB doesn't guarantee order)
        entries.sort((a, b) => a.fileIndex - b.fileIndex);

        // Return array of {blob, metadata}
        resolve(entries.map(e => ({
          blob: e.blob,
          metadata: e.metadata
        })));
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Delete all files for a pet
  static async deleteFiles(petIndex) {
    const db = await this.init();
    const tx = db.transaction([this.STORE_NAME], 'readwrite');
    const store = tx.objectStore(this.STORE_NAME);

    await this._deleteFilesForPet(store, petIndex);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Helper: Delete files for a pet within a transaction
  static async _deleteFilesForPet(store, petIndex) {
    const index = store.index('petIndex');
    const request = index.getAllKeys(IDBKeyRange.only(petIndex));

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const keys = request.result;
        const deletePromises = keys.map(key => {
          return new Promise((res, rej) => {
            const delReq = store.delete(key);
            delReq.onsuccess = () => res();
            delReq.onerror = () => rej(delReq.error);
          });
        });

        Promise.all(deletePromises).then(resolve).catch(reject);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Delete single file
  static async deleteFile(petIndex, fileIndex) {
    const db = await this.init();
    const tx = db.transaction([this.STORE_NAME], 'readwrite');
    const store = tx.objectStore(this.STORE_NAME);
    const key = `pet_${petIndex}_file_${fileIndex}`;

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Cleanup entries older than MAX_AGE_DAYS
  static async cleanupOldEntries() {
    const db = await this.init();
    const tx = db.transaction([this.STORE_NAME], 'readwrite');
    const store = tx.objectStore(this.STORE_NAME);
    const index = store.index('timestamp');

    const maxAge = Date.now() - (this.MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    const range = IDBKeyRange.upperBound(maxAge);

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Get storage info for debugging
  static async getStorageInfo() {
    if (!navigator.storage || !navigator.storage.estimate) {
      return { available: false };
    }

    const estimate = await navigator.storage.estimate();

    return {
      available: true,
      usage: estimate.usage,
      quota: estimate.quota,
      usagePercent: ((estimate.usage / estimate.quota) * 100).toFixed(2),
      usageMB: (estimate.usage / (1024 * 1024)).toFixed(2),
      quotaMB: (estimate.quota / (1024 * 1024)).toFixed(2)
    };
  }

  // Export all data for debugging
  static async exportAllData() {
    const db = await this.init();
    const tx = db.transaction([this.STORE_NAME], 'readonly');
    const store = tx.objectStore(this.STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result;

        // Convert Blobs to base64 for export
        const exportPromises = entries.map(async (entry) => {
          const base64 = await this._blobToBase64(entry.blob);
          return {
            ...entry,
            blob: `[Blob ${entry.metadata.size} bytes]`,
            blobPreview: base64.substring(0, 100) + '...'
          };
        });

        Promise.all(exportPromises).then(resolve).catch(reject);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Helper: Convert Blob to base64
  static async _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// Initialize on page load
if (typeof window !== 'undefined') {
  window.PetStorageManager = PetStorageManager;

  // Run cleanup on first load (once per session)
  if (!sessionStorage.getItem('pet_storage_cleaned')) {
    PetStorageManager.cleanupOldEntries()
      .then(() => {
        sessionStorage.setItem('pet_storage_cleaned', '1');
        console.log('🧹 PetStorageManager: Old entries cleaned');
      })
      .catch(err => {
        console.warn('🧹 PetStorageManager: Cleanup failed:', err);
      });
  }
}
```

---

### Phase 2: Pet Selector Storage Integration

**File**: `snippets/ks-product-pet-selector-stitch.liquid` (modify existing)

**Modifications**:

**1. Load PetStorageManager script** (add to top):
```liquid
{% comment %} Add before existing <script> tag (line 1055) {% endcomment %}
<script src="{{ 'pet-storage-manager.js' | asset_url }}" defer></script>
```

**2. Modify file upload handler** (lines 1189-1276):
```javascript
// EXISTING: Validation and duplicate checking (lines 1189-1246) - KEEP AS-IS

// NEW: After line 1246 (after files added to petFiles array)
// Save to IndexedDB for persistence across navigation
try {
  await window.PetStorageManager.saveFiles(i, petFiles[i]);
  console.log(`💾 Saved ${petFiles[i].length} file(s) for Pet ${i} to IndexedDB`);
} catch (error) {
  console.error('💾 IndexedDB save failed:', error);

  // Fallback: Try localStorage with base64 (limited to first file only)
  if (petFiles[i].length > 0) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        localStorage.setItem(`pet_${i}_fallback`, event.target.result);
        console.log('💾 Fallback: Saved to localStorage (base64)');
      } catch (lsError) {
        console.error('💾 localStorage fallback failed:', lsError);
        alert('Warning: Your uploads may not persist if you navigate away. Please complete your order on this page.');
      }
    };
    reader.readAsDataURL(petFiles[i][0]);
  }
}

// EXISTING: Store first file metadata for preview (line 1264-1276) - KEEP AS-IS
// This is separate from persistence - used only for processor auto-load

// NEW: Store lightweight metadata in localStorage
const metadata = petFiles[i].map(f => ({
  name: f.name,
  size: f.size,
  type: f.type,
  lastModified: f.lastModified
}));
localStorage.setItem(`pet_${i}_metadata`, JSON.stringify(metadata));

// NEW: Store pet name (if entered)
const petNameInput = container.querySelector(`[data-pet-name-input="${i}"]`);
if (petNameInput && petNameInput.value.trim()) {
  localStorage.setItem(`pet_${i}_name`, petNameInput.value.trim());
}
```

**3. Add restoration logic on page load** (after line 1466, before "Initialize" comment):
```javascript
// NEW: Restore uploads from storage on page load
async function restoreUploadsFromStorage() {
  console.log('🔄 Checking for saved uploads...');

  // Check if we have IndexedDB support
  const hasIDB = 'indexedDB' in window && window.PetStorageManager;
  const hasDataTransfer = 'DataTransfer' in window;

  if (!hasIDB || !hasDataTransfer) {
    console.log('🔄 IndexedDB or DataTransfer not available, skipping restoration');
    return;
  }

  // Restore each pet's uploads
  for (let i = 1; i <= 3; i++) {
    try {
      // Get metadata from localStorage
      const metadataStr = localStorage.getItem(`pet_${i}_metadata`);
      if (!metadataStr) continue; // No uploads for this pet

      const metadata = JSON.parse(metadataStr);
      if (metadata.length === 0) continue;

      // Get Blobs from IndexedDB
      const fileEntries = await window.PetStorageManager.getFiles(i);
      if (fileEntries.length === 0) continue;

      // Reconstruct File objects
      const dataTransfer = new DataTransfer();
      fileEntries.forEach((entry, index) => {
        const meta = metadata[index] || entry.metadata;
        const file = new File([entry.blob], meta.name, {
          type: meta.type,
          lastModified: meta.lastModified
        });
        dataTransfer.items.add(file);
      });

      // Inject into file input
      const fileInput = container.querySelector(`[data-pet-file-input="${i}"]`);
      if (fileInput) {
        fileInput.files = dataTransfer.files;

        // Update in-memory state
        petFiles[i] = Array.from(dataTransfer.files);

        // Update UI
        const uploadBtn = container.querySelector(`[data-pet-upload-btn="${i}"]`);
        const maxFiles = parseInt(fileInput.dataset.maxFiles) || 3;
        if (uploadBtn) {
          uploadBtn.textContent = `Upload (${petFiles[i].length}/${maxFiles})`;
          uploadBtn.classList.add('has-uploads');
        }

        // Display file list
        displayUploadedFiles(i, petFiles[i]);

        console.log(`✅ Restored ${petFiles[i].length} file(s) for Pet ${i}`);
      }

      // Restore pet name
      const petName = localStorage.getItem(`pet_${i}_name`);
      if (petName) {
        const petNameInput = container.querySelector(`[data-pet-name-input="${i}"]`);
        if (petNameInput) {
          petNameInput.value = petName;
        }
      }

    } catch (error) {
      console.error(`❌ Failed to restore Pet ${i} uploads:`, error);

      // Try fallback
      const fallbackData = localStorage.getItem(`pet_${i}_fallback`);
      if (fallbackData) {
        console.log(`🔄 Using localStorage fallback for Pet ${i}`);
        // Show warning: Only first file restored
        alert(`Note: Only the first uploaded photo for Pet ${i} could be restored.`);
      }
    }
  }

  // Restore style and font selections
  const savedStyle = localStorage.getItem('pet_selector_style');
  if (savedStyle) {
    const styleRadio = container.querySelector(`[data-style-radio="${savedStyle}"]`);
    if (styleRadio) {
      styleRadio.checked = true;
      styleRadio.closest('.style-card').classList.add('style-card--active');
    }
  }

  const savedFont = localStorage.getItem('pet_selector_font');
  if (savedFont) {
    const fontRadio = container.querySelector(`[data-font-radio="${savedFont}"]`);
    if (fontRadio) {
      fontRadio.checked = true;
      fontRadio.closest('.font-card').classList.add('font-card--active');
    }
  }
}

// Run restoration on page load (after DOM ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreUploadsFromStorage);
} else {
  restoreUploadsFromStorage();
}
```

**4. Persist style and font selections** (add listeners after line 1156):
```javascript
// NEW: Persist style selection
const styleRadios = container.querySelectorAll('[data-style-radio]');
styleRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      localStorage.setItem('pet_selector_style', radio.value);
    }
  });
});

// NEW: Persist font selection
const fontRadios = container.querySelectorAll('[data-font-radio]');
fontRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      localStorage.setItem('pet_selector_font', radio.value);
    }
  });
});
```

**5. Debounce pet name input** (modify line 1132-1135):
```javascript
// EXISTING: Pet name input listeners
const nameInputs = container.querySelectorAll('[data-pet-name-input]');
nameInputs.forEach(input => {
  // Existing: Update font previews immediately
  input.addEventListener('input', updateFontPreviews);

  // NEW: Persist to localStorage (debounced to avoid thrashing)
  let debounceTimer;
  input.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const petIndex = input.dataset.petNameInput;
      if (e.target.value.trim()) {
        localStorage.setItem(`pet_${petIndex}_name`, e.target.value.trim());
      } else {
        localStorage.removeItem(`pet_${petIndex}_name`);
      }
    }, 500); // Wait 500ms after typing stops
  });
});
```

**6. Clear storage on form submission** (modify line 1482-1500):
```javascript
form.addEventListener('submit', function(e) {
  // EXISTING: Move file inputs into form (lines 1485-1499) - KEEP AS-IS

  // NEW: Clear storage after successful submission
  // (Prevents stale data from appearing on next visit)
  setTimeout(async () => {
    try {
      // Clear IndexedDB
      for (let i = 1; i <= 3; i++) {
        await window.PetStorageManager.deleteFiles(i);
      }

      // Clear localStorage
      for (let i = 1; i <= 3; i++) {
        localStorage.removeItem(`pet_${i}_metadata`);
        localStorage.removeItem(`pet_${i}_name`);
        localStorage.removeItem(`pet_${i}_images`); // Preview data
        localStorage.removeItem(`pet_${i}_fallback`);
      }
      localStorage.removeItem('pet_selector_style');
      localStorage.removeItem('pet_selector_font');

      console.log('🧹 Storage cleared after form submission');
    } catch (error) {
      console.warn('🧹 Storage cleanup failed:', error);
    }
  }, 100); // Delay to ensure form submits first
});
```

---

### Phase 3: Pet Processor Integration

**File**: `assets/pet-processor.js` (modify existing)

**Purpose**: Ensure processor auto-load works with new storage system

**Modifications**:

**Location**: Method `checkPetSelectorUploads()` (around line 695-768)

**Change**: Add IndexedDB check BEFORE localStorage check

```javascript
// EXISTING: Method signature (line 695)
checkPetSelectorUploads() {
  // NEW: First try IndexedDB (full file restoration)
  const activeIndex = sessionStorage.getItem('pet_selector_active_index');

  if (activeIndex && window.PetStorageManager) {
    console.log(`🔍 Checking IndexedDB for Pet ${activeIndex} uploads...`);

    // Check if metadata exists in localStorage (quick check)
    const metadataStr = localStorage.getItem(`pet_${activeIndex}_metadata`);
    if (metadataStr) {
      try {
        const metadata = JSON.parse(metadataStr);
        if (metadata.length > 0) {
          console.log(`✅ Found ${metadata.length} file(s) in IndexedDB for Pet ${activeIndex}`);

          // Return special flag to trigger IndexedDB load
          return {
            source: 'indexeddb',
            petIndex: parseInt(activeIndex),
            fileCount: metadata.length
          };
        }
      } catch (error) {
        console.warn('⚠️ Failed to parse metadata:', error);
      }
    }
  }

  // EXISTING: Fallback to localStorage preview data (lines 700-768) - KEEP AS-IS
  // This handles the single base64 image for preview
  // ... existing code ...
}
```

**Add new method** (after `checkPetSelectorUploads()`, around line 770):
```javascript
/**
 * Load pet images from IndexedDB storage
 * Reconstructs File objects and processes them
 * @param {object} idbInfo - Info from checkPetSelectorUploads
 */
async loadFromIndexedDB(idbInfo) {
  const { petIndex, fileCount } = idbInfo;

  try {
    console.log(`📦 Loading ${fileCount} file(s) from IndexedDB for Pet ${petIndex}...`);

    // Get metadata from localStorage
    const metadataStr = localStorage.getItem(`pet_${petIndex}_metadata`);
    if (!metadataStr) {
      throw new Error('Metadata not found in localStorage');
    }

    const metadata = JSON.parse(metadataStr);

    // Get Blobs from IndexedDB
    const fileEntries = await window.PetStorageManager.getFiles(petIndex);
    if (fileEntries.length === 0) {
      throw new Error('No files found in IndexedDB');
    }

    // Reconstruct File objects
    const files = fileEntries.map((entry, index) => {
      const meta = metadata[index] || entry.metadata;
      return new File([entry.blob], meta.name, {
        type: meta.type,
        lastModified: meta.lastModified
      });
    });

    console.log(`✅ Reconstructed ${files.length} File object(s) from IndexedDB`);

    // Process the FIRST file through standard flow
    // (Processor currently handles single files, multi-file support is future enhancement)
    await this.processFile(files[0]);

    // If multiple files, show info message
    if (files.length > 1) {
      this.showInfo(`Processing photo 1 of ${files.length}. Additional photos will be used in final order.`);
    }

    // Clear uploads from storage (already loaded)
    this.clearPetSelectorUploads();

  } catch (error) {
    console.error('❌ IndexedDB load failed:', error);

    // Fallback to localStorage preview data
    console.log('🔄 Falling back to localStorage preview data...');
    const previewData = localStorage.getItem(`pet_${petIndex}_images`);
    if (previewData) {
      try {
        const images = JSON.parse(previewData);
        if (images.length > 0) {
          await this.loadPetSelectorImage(images[0].data);
        }
      } catch (fallbackError) {
        console.error('❌ Fallback load failed:', fallbackError);
        this.showError('Failed to load your uploaded image. Please try uploading again.');
      }
    } else {
      this.showError('Failed to load your uploaded image. Please try uploading again.');
    }
  }
}
```

**Modify `restoreSession()` method** (around line 512-518):
```javascript
async restoreSession() {
  console.log('🔄 Checking for session to restore...');

  // NEW: Check pet selector uploads FIRST (including IndexedDB)
  const petSelectorCheck = this.checkPetSelectorUploads();
  if (petSelectorCheck) {
    // Check if it's IndexedDB data
    if (petSelectorCheck.source === 'indexeddb') {
      await this.loadFromIndexedDB(petSelectorCheck);
      return; // Early return - don't check PetStorage
    } else {
      // It's localStorage preview data
      await this.loadPetSelectorImage(petSelectorCheck);
      return;
    }
  }

  // EXISTING: Check PetStorage for processed pets (line 520+) - KEEP AS-IS
  // ... existing code ...
}
```

---

### Phase 4: Mobile Browser Testing

**Devices to Test**:

1. **iOS Safari** (70% of mobile e-commerce traffic)
   - iPhone 13+ (iOS 16+)
   - iPad (iPadOS 16+)
   - Test both camera upload and photo library
   - Test private browsing mode (IDB disabled)

2. **Chrome Android** (25% of mobile e-commerce traffic)
   - Samsung Galaxy S21+
   - Google Pixel 6+
   - Test camera upload and Google Photos

3. **Firefox Mobile** (5% of mobile e-commerce traffic)
   - Test on Android only (iOS Firefox uses WebKit)

**Test Scenarios**:

| Scenario | Steps | Expected Result | Blocker? |
|----------|-------|-----------------|----------|
| **Happy Path** | Upload 2 photos for Pet 1 → Enter name "Fluffy" → Select B&W style → Click Preview → Process → Back button → Check state | All data restored: 2 files, name, style | 🔴 CRITICAL |
| **Multiple Pets** | Upload 1 photo each for Pet 1, 2, 3 → Enter names → Click Preview on Pet 2 → Check which pet loads | Pet 2's photo loads in processor | 🟡 HIGH |
| **File Deletion** | Upload 3 photos → Delete middle photo → Click Preview → Back → Check file list | Only 2 photos remain (correct ones) | 🟢 MEDIUM |
| **Large Files** | Upload 3 photos (5MB each, 15MB total) → Click Preview → Back → Check | All files restored without quota errors | 🔴 CRITICAL |
| **Poor Network** | Enable Chrome DevTools throttling (Slow 3G) → Upload photo → Click Preview → Wait for processor load | Processor loads, file available | 🟡 HIGH |
| **Tab Switch** | Upload photos → Switch to another tab → Return → Click Preview | Files still present (not cleared) | 🟢 MEDIUM |
| **Form Submit** | Upload photos → Add to cart → Check storage | Storage cleared after submit | 🟢 LOW |
| **Private Browsing** | Repeat Happy Path in Safari Private mode | Shows warning, falls back to localStorage (1 file only) | 🟡 HIGH |
| **Storage Full** | Fill localStorage with dummy data (4MB) → Try upload | Shows quota error, offers cleanup | 🟢 MEDIUM |
| **Old Data** | Create entries with timestamp 8 days old → Reload page → Check IDB | Old entries cleaned automatically | 🟢 LOW |
| **Back Button** | Process photo → Apply effects → Browser back → Check pet selector | Returns to product page at correct scroll position | 🟢 MEDIUM |
| **Orientation Change** | Upload photo in portrait → Rotate to landscape → Upload another | Both files persist correctly | 🟢 LOW |

**Testing Tools**:

1. **Chrome DevTools MCP** (Primary):
   ```javascript
   // Connect to test URL
   await mcp__chrome_devtools__navigate_page({ url: 'https://[TEST-URL]/products/[PRODUCT]' });

   // Take snapshot to find upload button
   await mcp__chrome_devtools__take_snapshot({});

   // Upload test file
   await mcp__chrome_devtools__upload_file({ uid: '[UID]', filePath: 'test-pet-image.jpg' });

   // Check console for storage messages
   await mcp__chrome_devtools__list_console_messages({});

   // Check IndexedDB
   await mcp__chrome_devtools__evaluate_script({
     function: `async () => {
       const info = await window.PetStorageManager.getStorageInfo();
       const data = await window.PetStorageManager.exportAllData();
       return { info, data };
     }`
   });
   ```

2. **BrowserStack** (Secondary, for device matrix):
   - Real device testing on iOS/Android
   - Network throttling simulation
   - Private browsing mode testing

3. **Manual Testing Checklist**:
   - [ ] Camera upload works (not just file picker)
   - [ ] HEIC images convert properly (iOS camera default)
   - [ ] Multiple uploads in quick succession don't race
   - [ ] Scroll position restores correctly on back navigation
   - [ ] No console errors or warnings
   - [ ] No memory leaks (check DevTools Memory profiler)
   - [ ] Storage quota respected (no silent failures)

**Debugging Commands**:

```javascript
// Check storage info
await PetStorageManager.getStorageInfo();

// Export all data
await PetStorageManager.exportAllData();

// Check quota
navigator.storage.estimate().then(console.log);

// Check file input contents
const fileInput = document.querySelector('[data-pet-file-input="1"]');
console.log('Files:', Array.from(fileInput.files));

// Check IndexedDB directly
const db = await indexedDB.open('PerkiePetStorage');
// ... manually query

// Clear all storage (for testing)
localStorage.clear();
sessionStorage.clear();
await PetStorageManager.deleteFiles(1);
await PetStorageManager.deleteFiles(2);
await PetStorageManager.deleteFiles(3);
```

---

### Phase 5: Error Handling & Edge Cases

**Error Scenarios**:

1. **Quota Exceeded (IndexedDB)**:
   ```javascript
   // In pet-storage-manager.js saveFiles() method
   catch (error) {
     if (error.name === 'QuotaExceededError') {
       // Offer cleanup
       const cleanup = confirm(
         'Storage is full. Delete old pet data to make room?\n\n' +
         'This will remove pet uploads from previous sessions.'
       );

       if (cleanup) {
         await this.cleanupOldEntries();
         // Retry save
         return this.saveFiles(petIndex, files);
       } else {
         throw new Error('Not enough storage space. Please use smaller photos or fewer photos.');
       }
     }
   }
   ```

2. **IndexedDB Unavailable (Private Browsing)**:
   ```javascript
   // In ks-product-pet-selector-stitch.liquid restoration logic
   if (!hasIDB) {
     console.warn('⚠️ IndexedDB unavailable (private browsing or unsupported browser)');

     // Show user-friendly warning banner
     const banner = document.createElement('div');
     banner.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; padding: 1rem; margin: 1rem; border-radius: 0.5rem; text-align: center;';
     banner.innerHTML = `
       <strong>⚠️ Limited Storage Available</strong><br>
       You're in Private Browsing mode. Your uploads may not persist if you navigate away.<br>
       For best experience, use normal browsing mode.
     `;
     container.insertBefore(banner, container.firstChild);
   }
   ```

3. **DataTransfer API Unavailable (Old Browsers)**:
   ```javascript
   // In restoration logic
   if (!hasDataTransfer) {
     console.warn('⚠️ DataTransfer API unavailable - cannot reconstruct File objects');

     // Fallback: Show manual re-upload prompt
     alert(
       'Your browser doesn\'t support automatic file restoration.\n\n' +
       'Please keep this page open while customizing your pet photos, ' +
       'or you\'ll need to re-upload them.'
     );
   }
   ```

4. **Corrupted Storage**:
   ```javascript
   // In pet-storage-manager.js init() method
   request.onerror = (event) => {
     if (event.target.error.name === 'VersionError' ||
         event.target.error.name === 'ConstraintError') {
       console.error('💥 IndexedDB corrupted, deleting and recreating...');

       // Delete corrupted database
       indexedDB.deleteDatabase(this.DB_NAME);

       // Retry init
       return this.init();
     }
   }
   ```

5. **Network Timeout During Blob Retrieval**:
   ```javascript
   // In pet-processor.js loadFromIndexedDB() method
   try {
     // Wrap IDB call with timeout
     const fileEntries = await Promise.race([
       window.PetStorageManager.getFiles(petIndex),
       new Promise((_, reject) =>
         setTimeout(() => reject(new Error('IndexedDB read timeout')), 5000)
       )
     ]);
   } catch (error) {
     if (error.message.includes('timeout')) {
       this.showError('Loading took too long. Please try again.');
     }
   }
   ```

6. **Race Condition: Form Submit Before IDB Save Complete**:
   ```javascript
   // In ks-product-pet-selector-stitch.liquid file upload handler
   let pendingSaves = [];

   // After line 1246 (adding files to petFiles)
   const savePromise = window.PetStorageManager.saveFiles(i, petFiles[i]);
   pendingSaves.push(savePromise);

   // In form submit handler (line 1482)
   form.addEventListener('submit', async function(e) {
     // Wait for pending saves BEFORE submitting
     if (pendingSaves.length > 0) {
       e.preventDefault();

       console.log('⏳ Waiting for file uploads to complete...');
       const submitBtn = form.querySelector('[type="submit"]');
       const originalText = submitBtn.textContent;
       submitBtn.textContent = 'Saving files...';
       submitBtn.disabled = true;

       try {
         await Promise.all(pendingSaves);
         console.log('✅ All files saved');
       } catch (error) {
         console.error('❌ Save failed:', error);
         alert('Failed to save files. Please try again.');
         submitBtn.textContent = originalText;
         submitBtn.disabled = false;
         return;
       }

       // Clear pending saves
       pendingSaves = [];

       // Re-submit form
       submitBtn.textContent = originalText;
       submitBtn.disabled = false;
       form.submit();
     }
   });
   ```

7. **Mobile Safari Memory Pressure**:
   ```javascript
   // Monitor page visibility to detect memory pressure
   document.addEventListener('visibilitychange', () => {
     if (document.hidden) {
       console.log('📱 Page hidden - iOS may be reclaiming memory');

       // Proactively save any unsaved state
       // (iOS aggressively unloads background tabs)
     }
   });

   // Listen for page unload (iOS doesn't always fire this)
   window.addEventListener('pagehide', () => {
     console.log('📱 Page unload detected');
     // Last chance to save state (synchronous only)
   });
   ```

---

## Implementation Checklist

### Phase 1: IndexedDB Storage Manager
- [ ] Create `assets/pet-storage-manager.js` (~300 lines)
- [ ] Implement `PetStorageManager` class with 8 core methods
- [ ] Add quota checking and error handling
- [ ] Add cleanup logic (7-day expiration)
- [ ] Add debugging methods (getStorageInfo, exportAllData)
- [ ] Test on Chrome desktop (verify basic IDB operations)
- [ ] Test quota exceeded scenario
- [ ] Test corrupted database recovery

### Phase 2: Pet Selector Integration
- [ ] Add `<script>` tag to load pet-storage-manager.js
- [ ] Modify file upload handler (line 1246):
  - [ ] Add IndexedDB save call
  - [ ] Add fallback to localStorage
  - [ ] Add quota check before save
- [ ] Add `restoreUploadsFromStorage()` function (~100 lines):
  - [ ] IndexedDB retrieval
  - [ ] File object reconstruction via DataTransfer
  - [ ] UI update (upload button, file list)
  - [ ] Style/font restoration
- [ ] Add style/font persistence listeners
- [ ] Add debounced pet name persistence
- [ ] Modify form submit handler:
  - [ ] Wait for pending IDB saves
  - [ ] Clear storage after submit
- [ ] Test restoration on page reload
- [ ] Test with multiple pets
- [ ] Test file deletion flow

### Phase 3: Pet Processor Integration
- [ ] Modify `checkPetSelectorUploads()` to check IndexedDB
- [ ] Add `loadFromIndexedDB()` method (~50 lines)
- [ ] Modify `restoreSession()` to handle IDB data
- [ ] Test auto-load from pet selector
- [ ] Test fallback to localStorage preview
- [ ] Test with multiple files (processor handles first)

### Phase 4: Mobile Testing
- [ ] iOS Safari (iPhone 13+):
  - [ ] Camera upload → Preview → Back
  - [ ] Photo library → Preview → Back
  - [ ] Private browsing fallback
  - [ ] Memory pressure handling
- [ ] Chrome Android:
  - [ ] Camera upload → Preview → Back
  - [ ] Google Photos → Preview → Back
  - [ ] Storage quota check
- [ ] Firefox Android:
  - [ ] Basic flow (upload → Preview → Back)
- [ ] Network throttling (Slow 3G):
  - [ ] Upload with poor network
  - [ ] IDB retrieval with poor network
- [ ] Performance profiling:
  - [ ] File save time (IDB)
  - [ ] File load time (IDB → File object)
  - [ ] Memory usage (DevTools)

### Phase 5: Error Handling
- [ ] Quota exceeded handler
- [ ] Private browsing fallback + warning banner
- [ ] DataTransfer unavailable fallback
- [ ] Corrupted database recovery
- [ ] Network timeout handling
- [ ] Race condition prevention (form submit)
- [ ] iOS memory pressure handling

### Phase 6: Documentation & Deployment
- [ ] Update session context (context_session_001.md)
- [ ] Add inline code comments
- [ ] Create testing documentation
- [ ] Add debugging commands to CLAUDE.md
- [ ] Deploy to Shopify test environment (push to main)
- [ ] Test on live test URL with Chrome DevTools MCP
- [ ] Monitor console for errors
- [ ] Get user feedback on mobile devices

---

## Success Criteria

### Functional Requirements
✅ **Files Persist**: Uploaded files survive page navigation (IDB or localStorage fallback)
✅ **Pet Names Persist**: Customer-entered names restored correctly
✅ **Selections Persist**: Style and font choices maintained
✅ **Multi-Pet Support**: Handles 1-3 pets with 1-3 files each
✅ **File Deletion**: Removing files updates both IDB and UI
✅ **Form Submit**: Files properly attached to Shopify form
✅ **Back Button**: Returns to product page with state intact

### Mobile-Specific Requirements
✅ **Quota Management**: Handles 45MB total files without errors
✅ **Camera Upload**: Works with mobile camera (not just file picker)
✅ **HEIC Handling**: iOS photos convert and store correctly
✅ **Private Browsing**: Shows warning, falls back gracefully
✅ **Memory Pressure**: iOS tab switching doesn't lose state
✅ **Touch Interface**: All interactions feel instant (< 100ms)

### Performance Requirements
✅ **Save Time**: File upload → IDB save < 500ms per file
✅ **Load Time**: Page load → IDB restore < 1 second
✅ **No Jank**: UI remains responsive during IDB operations
✅ **Memory**: No leaks detected in 5-minute session

### Error Handling Requirements
✅ **Quota Exceeded**: Clear error message + cleanup option
✅ **IDB Unavailable**: Warning banner + localStorage fallback
✅ **Network Failure**: Timeout handling + retry option
✅ **Corruption**: Auto-recovery without data loss

---

## Rollback Plan

If implementation causes issues:

1. **Immediate Rollback** (< 5 minutes):
   ```bash
   git revert HEAD
   git push origin main
   # Shopify auto-deploys previous version
   ```

2. **Partial Rollback** (keep IDB, disable restoration):
   ```javascript
   // In ks-product-pet-selector-stitch.liquid
   // Comment out restoration call:
   // restoreUploadsFromStorage();
   ```

3. **Feature Flag** (if needed for gradual rollout):
   ```javascript
   // Add to snippet
   const ENABLE_PERSISTENCE = {{ settings.enable_pet_persistence | default: false }};
   if (ENABLE_PERSISTENCE) {
     // Run new code
   } else {
     // Run old code
   }
   ```

---

## Open Questions

**Q1**: Should we restore state on EVERY page load, or only when coming from Preview?
**A**: Every page load. User might refresh accidentally, or navigate via browser history.

**Q2**: What if user adds product to cart, then goes back and changes uploads?
**A**: Current design clears storage on form submit. If they go back, they start fresh. This is expected UX.

**Q3**: How long should we keep files in IDB? 7 days enough?
**A**: 7 days is conservative. Most customers complete orders same day. Could reduce to 3 days in future.

**Q4**: Should we compress images before storing in IDB?
**A**: No. Browser-native Blob storage is already efficient. Compression adds CPU time and code complexity. Only consider if hitting quota issues in production.

**Q5**: What about cross-device sync (start on phone, finish on desktop)?
**A**: Out of scope. Would require backend storage. Current solution is device-local only.

---

## Future Enhancements

1. **Multi-File Processor** (Phase 2):
   - Currently processor handles 1 file
   - Could enhance to show gallery of all uploaded files
   - Let user pick which file to process

2. **Image Compression** (if quota issues arise):
   - Use Canvas API to resize large images before IDB storage
   - Target: 1920px max dimension, 85% JPEG quality
   - Would reduce 5MB iPhone photo to ~500KB

3. **Background Sync API** (PWA future):
   - If network fails during navigation, queue IDB save
   - Retry when network returns
   - Requires service worker setup

4. **Cloud Backup** (premium feature):
   - Optionally sync IDB data to backend
   - Enables cross-device workflow
   - Requires backend endpoint + authentication

5. **Performance Monitoring**:
   - Track IDB save/load times in analytics
   - Monitor quota exceeded errors
   - Alert if restoration success rate < 95%

---

## Questions for User

1. **Testing Priority**: Do you want to test on your personal iPhone first, or should I proceed with BrowserStack/emulator testing?

2. **Private Browsing UX**: For users in private browsing (IDB disabled), should we:
   - Block upload entirely and show error?
   - Allow upload but show warning "State won't persist"?
   - Silently fallback to localStorage (1 file only)?

3. **Storage Cleanup**: 7-day expiration OK, or prefer shorter (3 days)?

4. **Error Messages**: Should errors be technical ("IndexedDB quota exceeded") or user-friendly ("Storage full, please use smaller photos")?

5. **Analytics**: Do you want to track:
   - How often users navigate away and return?
   - Storage quota exceeded frequency?
   - Restoration success rate?

---

## Files Modified

### New Files (1)
1. `assets/pet-storage-manager.js` (~300 lines, pure JavaScript)

### Modified Files (2)
1. `snippets/ks-product-pet-selector-stitch.liquid` (~150 lines added)
   - Load storage manager script
   - Modify upload handler (IDB save)
   - Add restoration logic
   - Add persistence listeners
   - Modify form submit handler

2. `assets/pet-processor.js` (~50 lines added)
   - Modify `checkPetSelectorUploads()`
   - Add `loadFromIndexedDB()` method
   - Modify `restoreSession()`

### Total Code Impact
- **Lines Added**: ~500
- **Lines Modified**: ~20
- **Lines Deleted**: ~0 (backward compatible)
- **Net Change**: +520 lines

---

## Implementation Time Estimate

| Phase | Time | Confidence |
|-------|------|------------|
| Phase 1: IndexedDB Manager | 4 hours | High |
| Phase 2: Pet Selector Integration | 6 hours | Medium |
| Phase 3: Pet Processor Integration | 2 hours | High |
| Phase 4: Mobile Testing | 8 hours | Low (device/network variability) |
| Phase 5: Error Handling | 4 hours | Medium |
| Phase 6: Documentation | 2 hours | High |
| **Total** | **26 hours** | **~3-4 work days** |

**Assumptions**:
- No major IndexedDB API issues
- Chrome DevTools MCP available for testing
- Test URL provided by user
- No backend changes needed

**Risks**:
- iOS Safari quirks may require additional debugging
- DataTransfer API may have edge cases
- Quota management may need tuning

---

## Conclusion

**Recommended Approach**: Hybrid IndexedDB + localStorage with DataTransfer API reconstruction

**Why This Wins**:
1. ✅ **Quota-Friendly**: Handles 45MB files without base64 bloat
2. ✅ **Mobile-First**: Designed for iOS Safari, Chrome Android constraints
3. ✅ **Progressive**: Falls back gracefully (IDB → localStorage → warning)
4. ✅ **File-Compatible**: Reconstructs native File objects for Shopify form
5. ✅ **Shopify-Safe**: No backend changes, pure frontend solution

**Key Innovation**: Using DataTransfer API to reconstruct File objects from IndexedDB Blobs. Most implementations fail here because they try to fake file inputs with base64, which doesn't work for form submission.

**Next Step**: User approval + clarifications on open questions, then proceed with Phase 1 implementation.
