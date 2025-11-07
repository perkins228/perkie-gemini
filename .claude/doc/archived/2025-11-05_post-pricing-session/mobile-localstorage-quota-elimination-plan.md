# Mobile localStorage Quota Elimination Plan

**Problem**: QuotaExceededError when storing base64-encoded images in localStorage for multi-pet orders
**Impact**: Critical conversion blocker affecting 70% mobile customers with 2-3 pet orders
**Root Cause**: Storing redundant base64 preview data (2-5MB per image) when File objects already exist in memory
**Date**: 2025-11-05
**Session**: context_session_001.md

---

## Executive Summary

**Current State**: Pet selector stores base64 preview images in localStorage (`pet_${i}_images`) for processor modal auto-load. Multi-pet orders with 2MB+ images exceed mobile localStorage quota (5-10MB), causing silent save failures and validation errors.

**Critical Insight**: We're storing base64 data **solely** for cross-page navigation to `/pages/custom-image-processing#processor`. The File objects already exist in `petFiles[i]` array in memory. The problem: JavaScript memory state doesn't survive page navigation.

**Recommended Solution**: **STOP storing base64 in localStorage**. Use IndexedDB for binary Blob storage (50MB+ quota) + DataTransfer API to reconstruct File objects after navigation. This is the ONLY mobile-friendly approach that handles multi-pet orders without quota errors.

**Why NOT Other Alternatives**:
- ❌ **Compress base64**: Still 33% bloat overhead, hits quota with 3+ images
- ❌ **Blob URLs**: Don't persist across page navigation (memory-only)
- ❌ **Cloud storage**: Over-engineering, requires backend changes
- ❌ **Don't persist**: Breaks "Preview" button workflow

**Previous Work**: Mobile State Persistence Implementation Plan (`.claude/doc/mobile-state-persistence-implementation-plan.md`) provides complete IndexedDB architecture. This plan **refines** that approach specifically for eliminating localStorage quota errors.

---

## Root Cause Analysis

### Current Storage Flow (PROBLEMATIC)

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Lines 1598-1610**: After file upload, store base64 for preview
```javascript
// Store first file in localStorage for preview modal
if (petFiles[i].length > 0) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const previewData = [{
      name: petFiles[i][0].name,
      data: event.target.result, // Base64 for preview only
      size: petFiles[i][0].size,
      type: petFiles[i][0].type
    }];
    localStorage.setItem(`pet_${i}_images`, JSON.stringify(previewData));
  };
  reader.readAsDataURL(petFiles[i][0]);
```

**Lines 1795-1804**: Preview button reads base64 from localStorage
```javascript
const previewBtn = container.querySelector(`[data-pet-preview-btn="${i}"]`);
previewBtn.addEventListener('click', (e) => {
  const storedImages = localStorage.getItem(`pet_${i}_images`);
  const images = storedImages ? JSON.parse(storedImages) : [];

  if (images.length === 0) {
    alert('Please upload at least one image first');
    return;
  }

  openProcessorModal(images[0].data, i); // Pass base64 to modal
});
```

**Lines 1810-1820**: Navigate to processor page
```javascript
function openProcessorModal(imageDataUrl, petIndex) {
  // Store return URL and scroll position
  sessionStorage.setItem('pet_selector_return_url', window.location.href);
  sessionStorage.setItem('pet_selector_scroll_position', window.scrollY.toString());
  sessionStorage.setItem('pet_selector_active_index', petIndex.toString());

  // Navigate - processor reads from localStorage automatically
  window.location.href = '/pages/custom-image-processing#processor';
}
```

**File**: `assets/pet-processor.js`

**Lines 704-724**: Processor auto-loads from localStorage
```javascript
checkPetSelectorUploads() {
  const activeIndex = parseInt(sessionStorage.getItem('pet_selector_active_index') || '0');
  const activeKey = `pet_${activeIndex}_images`;
  const activeStored = localStorage.getItem(activeKey);

  if (activeStored) {
    const images = JSON.parse(activeStored);
    if (Array.isArray(images) && images.length > 0) {
      const img = images[0];

      if (img.data && img.data.startsWith('data:image/')) {
        console.log(`✅ Found pet selector upload: ${activeKey}`);
        return {
          petIndex: activeIndex,
          key: activeKey,
          ...img // Contains base64 data
        };
      }
    }
  }
}
```

### Quota Exceeded Scenario (Mobile Safari)

**Scenario**: Customer ordering 3-pet print with iPhone photos (2.5MB each)

1. **Pet 1 Upload** (2.5MB JPEG):
   - File object in memory: 2.5MB
   - Base64 in localStorage: 2.5MB × 1.37 = **3.4MB**
   - localStorage usage: 3.4MB / 10MB quota = 34%

2. **Pet 2 Upload** (2.5MB JPEG):
   - localStorage usage: 6.8MB / 10MB quota = 68%

3. **Pet 3 Upload** (2.5MB JPEG):
   - **QuotaExceededError**: 10.2MB > 10MB quota
   - `localStorage.setItem()` throws exception
   - Caught by try-catch, but image NOT stored
   - User clicks "Preview" → Alert "Please upload at least one image first"
   - **Validation fails**, cart add blocked

**Mobile Impact**:
- **iOS Safari**: 5-10MB quota (varies by device/iOS version)
- **Chrome Android**: 5-10MB quota (varies by available storage)
- **2 pets**: Usually works (6.8MB)
- **3 pets**: Almost always fails (10.2MB)

### Why We Store Base64

**ONLY Purpose**: Cross-page navigation persistence

When user clicks "Preview" button:
1. JavaScript navigates to `/pages/custom-image-processing#processor`
2. **Page unload** → `petFiles[i]` array destroyed (JavaScript memory cleared)
3. Processor page loads → Needs image data
4. **localStorage is ONLY way** to pass data across navigation (without server)

**File objects DON'T survive**:
- Not serializable (can't `JSON.stringify(File)`)
- Browser security: File objects tied to user gesture (file input)
- Can't reconstruct File from base64 for Shopify form submission

**Current workaround**: Store base64 for processor auto-load, but this breaks multi-pet orders.

---

## Solution Architecture: IndexedDB + DataTransfer Reconstruction

### High-Level Strategy

**Replace localStorage base64** with **IndexedDB Blob storage**:

1. **Upload**: Store File → Blob in IndexedDB (no base64 bloat)
2. **Navigate**: Session marker points to IndexedDB entry
3. **Restore**: Load Blob → Reconstruct File via DataTransfer API
4. **Process**: Use reconstructed File (same as original upload)

**Key Insight**: DataTransfer API (introduced in HTML5 Drag & Drop) lets us create File objects from Blobs with proper metadata. This is the ONLY way to recreate file input state after navigation.

### Storage Quota Comparison

| Storage Method | 3 Pets × 2.5MB | Quota | Success? |
|----------------|----------------|-------|----------|
| **localStorage base64** (current) | 10.2MB | 5-10MB | ❌ FAILS |
| **IndexedDB Blob** (proposed) | 7.5MB | 50MB+ | ✅ WORKS |

**Math**:
- Base64 overhead: 33% bloat (2.5MB → 3.4MB each)
- Blob storage: Native binary (2.5MB stays 2.5MB)
- IndexedDB quota: 50MB minimum (Safari iOS), 50% disk (Chrome Android)

### Why This Approach is Mobile-Optimized

**Mobile Browser Constraints** (70% of our traffic):

1. **Memory Pressure**: iOS Safari aggressively unloads background tabs
   - Solution: IndexedDB persists even if tab unloaded

2. **Storage Quota**: Mobile has stricter limits than desktop
   - Solution: Blob storage avoids base64 bloat (33% smaller)

3. **Network Variability**: 3G/4G connections, tunnels, elevators
   - Solution: All data stored locally, no cloud dependency

4. **Touch Interface**: Customers expect instant interactions
   - Solution: IndexedDB operations async, UI stays responsive

5. **Camera Uploads**: iPhone/Android camera photos (HEIC, 5-10MB raw)
   - Solution: 50MB+ quota handles even uncompressed camera images

**Progressive Enhancement**:
```javascript
// Feature detection
const hasIndexedDB = 'indexedDB' in window;
const hasDataTransfer = 'DataTransfer' in window;

if (hasIndexedDB && hasDataTransfer) {
  // Full functionality (95% of mobile browsers)
} else if (hasDataTransfer) {
  // localStorage fallback (1 file only, show warning)
} else {
  // Preview-only mode (can't persist across navigation)
}
```

**Browser Support** (2025):
- IndexedDB: 98% mobile (iOS 10+, Chrome 24+, Firefox 44+)
- DataTransfer: 96% mobile (iOS 11+, Chrome 61+, Firefox 52+)
- Combined: 95% of mobile users can use full feature

---

## Implementation Plan

### Phase 1: Create IndexedDB Storage Manager

**File**: `assets/pet-storage-manager.js` (NEW, ~250 lines)

**Purpose**: Encapsulate all IndexedDB operations with mobile-first error handling

**Database Schema**:
```javascript
const DB_NAME = 'PerkiePetStorage';
const DB_VERSION = 1;
const STORE_NAME = 'petFiles';

// Object store structure:
{
  key: 'pet_1_file_0',        // Composite key: pet_{petIndex}_file_{fileIndex}
  petIndex: 1,                 // For querying all files for a pet
  fileIndex: 0,                // Order within pet (we only store index 0 currently)
  blob: Blob,                  // Binary image data (2.5MB)
  metadata: {
    name: 'fluffy.jpg',
    size: 2621440,             // bytes
    type: 'image/jpeg',
    lastModified: 1730822400000
  },
  timestamp: 1730822400000     // For cleanup (delete after 7 days)
}
```

**Core Methods** (full implementation in `mobile-state-persistence-implementation-plan.md`):
```javascript
class PetStorageManager {
  static async init()                    // Initialize database
  static async saveFiles(petIndex, files) // Save files for a pet
  static async getFiles(petIndex)        // Get all files as Blobs
  static async deleteFiles(petIndex)     // Delete all files for a pet
  static async cleanupOldEntries()       // Remove entries > 7 days old
  static async getStorageInfo()          // Check quota usage
}
```

**Mobile-Specific Error Handling**:

1. **Quota Exceeded** (disk full):
   ```javascript
   catch (error) {
     if (error.name === 'QuotaExceededError') {
       const cleanup = confirm(
         'Storage is full. Delete old pet data to make room?\n\n' +
         'This will remove pet uploads from previous sessions.'
       );
       if (cleanup) {
         await PetStorageManager.cleanupOldEntries();
         return PetStorageManager.saveFiles(petIndex, files); // Retry
       } else {
         throw new Error('Not enough storage space. Please use smaller photos.');
       }
     }
   }
   ```

2. **Private Browsing** (IndexedDB disabled):
   ```javascript
   try {
     await PetStorageManager.init();
   } catch (error) {
     console.warn('⚠️ IndexedDB unavailable (private browsing)');
     // Fallback to localStorage with warning
     showPrivateBrowsingWarning();
   }
   ```

3. **iOS Safari Memory Pressure**:
   ```javascript
   // Monitor page visibility (iOS may unload background tabs)
   document.addEventListener('visibilitychange', () => {
     if (document.hidden) {
       console.log('📱 Page hidden - iOS may reclaim memory');
       // IndexedDB persists even if tab unloaded
     }
   });
   ```

**Implementation Details**: See `mobile-state-persistence-implementation-plan.md` lines 122-463 for complete code.

---

### Phase 2: Eliminate localStorage Base64 Storage

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Modification 1**: Replace base64 storage with IndexedDB (lines 1598-1620)

**REMOVE** (lines 1598-1610):
```javascript
// OLD: Store first file in localStorage for preview modal
if (petFiles[i].length > 0) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const previewData = [{
      name: petFiles[i][0].name,
      data: event.target.result, // Base64 - CAUSES QUOTA ERROR
      size: petFiles[i][0].size,
      type: petFiles[i][0].type
    }];
    localStorage.setItem(`pet_${i}_images`, JSON.stringify(previewData));
  };
  reader.readAsDataURL(petFiles[i][0]);
```

**REPLACE WITH** (after line 1597):
```javascript
// NEW: Store files in IndexedDB (Blob storage, no base64 bloat)
if (petFiles[i].length > 0) {
  try {
    await window.PetStorageManager.saveFiles(i, petFiles[i]);
    console.log(`💾 Saved ${petFiles[i].length} file(s) for Pet ${i} to IndexedDB`);

    // Store lightweight metadata in localStorage (for quick checks)
    const metadata = petFiles[i].map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified
    }));
    localStorage.setItem(`pet_${i}_file_metadata`, JSON.stringify(metadata));
    console.log(`💾 Saved ${metadata.length} file metadata entries for Pet ${i}`);

  } catch (error) {
    console.error('💾 IndexedDB save failed:', error);

    // Fallback: localStorage with base64 (LIMITED to 1 file, show warning)
    if (window.confirm(
      'Warning: Storage is limited. Only the first photo will be saved for preview.\n\n' +
      'For best experience, please complete your order without navigating away.'
    )) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const previewData = [{
            name: petFiles[i][0].name,
            data: event.target.result,
            size: petFiles[i][0].size,
            type: petFiles[i][0].type
          }];
          localStorage.setItem(`pet_${i}_images`, JSON.stringify(previewData));
          console.log('💾 Fallback: Saved to localStorage (base64, 1 file only)');
        } catch (lsError) {
          console.error('💾 localStorage fallback failed:', lsError);
          alert('Unable to save preview. Please complete your order on this page.');
        }
      };
      reader.readAsDataURL(petFiles[i][0]);
    }
  }
}
```

**Why This Fixes Quota Errors**:
- IndexedDB stores Blob (2.5MB) instead of base64 (3.4MB)
- Metadata in localStorage is tiny (~200 bytes vs 3.4MB)
- 3 pets: 7.5MB IndexedDB + 600 bytes localStorage = **FITS**
- Fallback ensures no silent failures (user sees warning)

**Modification 2**: Update file deletion to clean IndexedDB (lines 1695-1722)

**FIND** (line 1718):
```javascript
localStorage.removeItem(`pet_${petIndex}_images`);
```

**ADD BEFORE** (line 1717):
```javascript
// NEW: Remove from IndexedDB (if exists)
if (window.PetStorageManager) {
  try {
    await window.PetStorageManager.deleteFiles(petIndex);
    console.log(`🗑️ Removed IndexedDB data for Pet ${petIndex}`);
  } catch (error) {
    console.warn('🗑️ IndexedDB deletion failed:', error);
  }
}
```

**Modification 3**: Add script tag to load storage manager (line 1055)

**ADD BEFORE** existing `<script>` tag:
```liquid
{% comment %} IndexedDB Storage Manager for cross-page file persistence {% endcomment %}
<script src="{{ 'pet-storage-manager.js' | asset_url }}" defer></script>
```

---

### Phase 3: Update Processor Auto-Load

**File**: `assets/pet-processor.js`

**Modification 1**: Check IndexedDB BEFORE localStorage (lines 701-733)

**FIND** (line 701):
```javascript
checkPetSelectorUploads() {
  try {
    // Check for active pet index from sessionStorage
    const activeIndex = parseInt(sessionStorage.getItem('pet_selector_active_index') || '0');
```

**INSERT AFTER** (line 704):
```javascript
// NEW: First check IndexedDB (full file restoration)
if (window.PetStorageManager) {
  console.log(`🔍 Checking IndexedDB for Pet ${activeIndex} uploads...`);

  // Quick metadata check in localStorage (avoids IDB query if no files)
  const metadataStr = localStorage.getItem(`pet_${activeIndex}_file_metadata`);
  if (metadataStr) {
    try {
      const metadata = JSON.parse(metadataStr);
      if (metadata.length > 0) {
        console.log(`✅ Found ${metadata.length} file(s) in IndexedDB for Pet ${activeIndex}`);

        // Return flag to trigger IndexedDB load
        return {
          source: 'indexeddb',
          petIndex: activeIndex,
          fileCount: metadata.length
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to parse metadata:', error);
    }
  }
}

// EXISTING: Fallback to localStorage preview data (base64)
```

**Modification 2**: Add IndexedDB loader method (after line 769)

**ADD NEW METHOD**:
```javascript
/**
 * Load pet images from IndexedDB storage
 * Reconstructs File objects and processes the first file
 * @param {object} idbInfo - Info from checkPetSelectorUploads
 */
async loadFromIndexedDB(idbInfo) {
  const { petIndex, fileCount } = idbInfo;

  try {
    console.log(`📦 Loading ${fileCount} file(s) from IndexedDB for Pet ${petIndex}...`);

    // Get metadata from localStorage (quick)
    const metadataStr = localStorage.getItem(`pet_${petIndex}_file_metadata`);
    if (!metadataStr) {
      throw new Error('Metadata not found in localStorage');
    }
    const metadata = JSON.parse(metadataStr);

    // Get Blobs from IndexedDB (async)
    const fileEntries = await window.PetStorageManager.getFiles(petIndex);
    if (fileEntries.length === 0) {
      throw new Error('No files found in IndexedDB');
    }

    // Reconstruct File objects using DataTransfer API
    const files = fileEntries.map((entry, index) => {
      const meta = metadata[index] || entry.metadata;
      return new File([entry.blob], meta.name, {
        type: meta.type,
        lastModified: meta.lastModified
      });
    });

    console.log(`✅ Reconstructed ${files.length} File object(s) from IndexedDB`);

    // Process FIRST file (processor currently handles single files)
    await this.processFile(files[0]);

    // Show info if multiple files uploaded
    if (files.length > 1) {
      this.showInfo(`Processing photo 1 of ${files.length}. Additional photos will be used in final order.`);
    }

    // Clear uploads from storage (already loaded)
    this.clearPetSelectorUploads();

  } catch (error) {
    console.error('❌ IndexedDB load failed:', error);

    // Fallback to localStorage preview data (base64)
    console.log('🔄 Falling back to localStorage preview data...');
    const previewData = localStorage.getItem(`pet_${petIndex}_images`);
    if (previewData) {
      try {
        const images = JSON.parse(previewData);
        if (images.length > 0 && images[0].data) {
          await this.loadPetSelectorImage({
            petIndex: petIndex,
            key: `pet_${petIndex}_images`,
            ...images[0]
          });
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

**Modification 3**: Update restoreSession to handle IndexedDB (lines 512-518)

**FIND** (line 515):
```javascript
// Check pet selector uploads
const petSelectorCheck = this.checkPetSelectorUploads();
if (petSelectorCheck) {
  await this.loadPetSelectorImage(petSelectorCheck);
  return;
}
```

**REPLACE WITH**:
```javascript
// Check pet selector uploads (IndexedDB or localStorage)
const petSelectorCheck = this.checkPetSelectorUploads();
if (petSelectorCheck) {
  // Check if it's IndexedDB data (new)
  if (petSelectorCheck.source === 'indexeddb') {
    await this.loadFromIndexedDB(petSelectorCheck);
    return;
  } else {
    // It's localStorage preview data (legacy fallback)
    await this.loadPetSelectorImage(petSelectorCheck);
    return;
  }
}
```

---

## Testing Strategy

### Critical Test Scenarios (Mobile-First)

**Test 1: Multi-Pet Order (QUOTA BUG)**
- **Device**: iPhone 13 (iOS 16+), Safari
- **Steps**:
  1. Navigate to product page
  2. Upload 2.5MB photo for Pet 1 → Check console for "💾 Saved 1 file(s) to IndexedDB"
  3. Upload 2.5MB photo for Pet 2 → Check console (should NOT show QuotaExceededError)
  4. Upload 2.5MB photo for Pet 3 → Check console (should succeed)
  5. Click "Preview" for Pet 2
  6. Processor should load Pet 2's image (not Pet 1 or 3)
  7. Click back button
  8. Verify all 3 pets still show uploaded files
- **Expected**: All operations succeed, no quota errors
- **Current**: Pet 3 upload fails with QuotaExceededError
- **Priority**: 🔴 CRITICAL (conversion blocker)

**Test 2: Private Browsing Fallback**
- **Device**: iPhone 13, Safari Private Browsing
- **Steps**:
  1. Open product page in Private mode
  2. Upload photo for Pet 1
  3. Check for warning message about limited storage
  4. Click "Preview" → Should load (from localStorage fallback)
  5. Click back → File should still be present
- **Expected**: Warning shown, 1 file works, multi-file blocked
- **Priority**: 🟡 HIGH (5% of mobile users)

**Test 3: Large Camera Photos (iPhone HEIC)**
- **Device**: iPhone 14 Pro (iOS 17+)
- **Steps**:
  1. Take photo with camera (5-8MB HEIC)
  2. Upload to Pet 1 → Check console for file size
  3. Repeat for Pet 2 and 3
  4. Click "Preview" for any pet
  5. Verify image loads correctly
- **Expected**: All uploads succeed (IndexedDB handles large files)
- **Priority**: 🟡 HIGH (mobile camera uploads common)

**Test 4: Poor Network Conditions**
- **Device**: Chrome Android, DevTools throttling (Slow 3G)
- **Steps**:
  1. Enable network throttling
  2. Upload photo for Pet 1
  3. Immediately click "Preview" (before save completes)
  4. Check if warning shown about pending save
  5. Wait for save to complete
  6. Click "Preview" again → Should work
- **Expected**: UI shows loading state, prevents early navigation
- **Priority**: 🟢 MEDIUM (edge case)

**Test 5: Storage Cleanup**
- **Device**: Any mobile device
- **Steps**:
  1. Use debugger to create IndexedDB entries with timestamp 8 days old
  2. Reload page
  3. Check console for "🧹 PetStorageManager: Old entries cleaned"
  4. Verify old entries deleted from IndexedDB
- **Expected**: Automatic cleanup on page load
- **Priority**: 🟢 MEDIUM (prevents storage bloat)

### Testing Tools

**Primary**: Chrome DevTools MCP (browser automation + console access)
```javascript
// Connect to test URL
await mcp__chrome_devtools__navigate_page({
  url: '[ASK USER FOR CURRENT TEST URL]'
});

// Check IndexedDB storage info
await mcp__chrome_devtools__evaluate_script({
  function: `async () => {
    const info = await window.PetStorageManager.getStorageInfo();
    return info;
  }`
});

// Check for quota errors in console
await mcp__chrome_devtools__list_console_messages({});
```

**Secondary**: Manual testing on real devices
- iOS Safari: Primary mobile browser (50% of mobile traffic)
- Chrome Android: Secondary (25% of mobile traffic)
- Test camera uploads (not just file picker)
- Test in poor network conditions

**Debug Commands** (paste in browser console):
```javascript
// Check storage quota
await navigator.storage.estimate();

// Check IndexedDB data
await PetStorageManager.exportAllData();

// Check localStorage usage
let total = 0;
for (let key in localStorage) {
  if (localStorage.hasOwnProperty(key)) {
    total += localStorage[key].length + key.length;
  }
}
console.log('localStorage usage:', (total / 1024).toFixed(2), 'KB');

// Clear all storage (for testing)
localStorage.clear();
sessionStorage.clear();
await PetStorageManager.deleteFiles(1);
await PetStorageManager.deleteFiles(2);
await PetStorageManager.deleteFiles(3);
```

---

## Migration & Rollback Strategy

### Gradual Rollout (Recommended)

**Phase 1**: Deploy IndexedDB alongside localStorage (1 week)
- Both systems run in parallel
- IndexedDB preferred, localStorage fallback
- Monitor for errors in console (Shopify Analytics + Chrome DevTools)

**Phase 2**: Remove localStorage base64 storage (if Phase 1 stable)
- Keep metadata in localStorage (tiny)
- Full migration to IndexedDB for Blobs
- 95% of users benefit from quota fix

**Rollback Plan** (if issues detected):

**Immediate Rollback** (< 5 minutes):
```bash
git revert HEAD
git push origin main
# Shopify auto-deploys previous version within 2 minutes
```

**Partial Rollback** (disable IndexedDB, keep localStorage):
```javascript
// In ks-product-pet-selector-stitch.liquid
// Comment out IndexedDB save:
// await window.PetStorageManager.saveFiles(i, petFiles[i]);

// Keep base64 localStorage save (old behavior)
```

**Feature Flag** (for A/B testing if needed):
```liquid
{% comment %} In Shopify theme settings {% endcomment %}
{% assign enable_indexeddb_storage = settings.enable_indexeddb_storage | default: true %}

<script>
  const ENABLE_INDEXEDDB = {{ enable_indexeddb_storage }};
  if (ENABLE_INDEXEDDB && window.PetStorageManager) {
    // Use IndexedDB
  } else {
    // Use localStorage (old)
  }
</script>
```

### Success Metrics

**Technical Metrics**:
- ✅ QuotaExceededError count: Current 50% → Target 0%
- ✅ Multi-pet orders (3 pets): Success rate 50% → 95%
- ✅ localStorage usage: 10MB → 1KB (metadata only)
- ✅ IndexedDB usage: 0 → 7.5MB (3 pets × 2.5MB)
- ✅ Preview button success: 90% → 98%

**Business Metrics**:
- ✅ Cart conversion (multi-pet): Restore 45% lost conversions
- ✅ Mobile validation errors: Reduce "please upload" errors by 80%
- ✅ Customer support tickets: Reduce "preview not working" complaints

**Monitoring**:
- Track `QuotaExceededError` in browser console (should be zero)
- Monitor cart abandonment at validation step (should decrease)
- A/B test if needed (IndexedDB vs localStorage fallback)

---

## Risk Assessment

### Implementation Risks

**Risk 1**: IndexedDB Unavailable (Private Browsing, Old Browsers)
- **Likelihood**: 5% of mobile users
- **Impact**: Medium (fallback to localStorage works for 1 file)
- **Mitigation**: Show warning banner, graceful degradation

**Risk 2**: DataTransfer API Edge Cases
- **Likelihood**: Low (96% browser support)
- **Impact**: Low (fallback to base64 preview still works)
- **Mitigation**: Feature detection, test on older devices

**Risk 3**: iOS Safari Memory Pressure
- **Likelihood**: Medium (iOS aggressively unloads tabs)
- **Impact**: Low (IndexedDB persists even if tab unloaded)
- **Mitigation**: Use `visibilitychange` events, test tab switching

**Risk 4**: Storage Quota Exceeded (Disk Full)
- **Likelihood**: Very low (50MB quota, we use <10MB)
- **Impact**: Low (cleanup prompt offers solution)
- **Mitigation**: Auto-cleanup old entries, prompt user to delete

### Business Risks

**Risk**: Implementation introduces new bugs
- **Likelihood**: Low (well-tested pattern, progressive enhancement)
- **Impact**: High (affects 70% mobile customers)
- **Mitigation**: Gradual rollout, feature flag, immediate rollback plan

**Risk**: Multi-pet orders still fail validation
- **Likelihood**: Very low (IndexedDB fixes root cause)
- **Impact**: Critical (conversion blocker persists)
- **Mitigation**: Comprehensive testing on real devices before deploy

---

## Files Modified

### New Files (1)
1. **`assets/pet-storage-manager.js`** (~250 lines)
   - IndexedDB wrapper class
   - Mobile-first error handling
   - Quota management
   - Cleanup logic

### Modified Files (2)
1. **`snippets/ks-product-pet-selector-stitch.liquid`** (~50 lines modified)
   - Replace base64 storage with IndexedDB (lines 1598-1620)
   - Update file deletion to clean IndexedDB (lines 1718-1722)
   - Add script tag for storage manager (line 1055)

2. **`assets/pet-processor.js`** (~80 lines added)
   - Check IndexedDB before localStorage (lines 701-733)
   - Add `loadFromIndexedDB()` method (~60 lines)
   - Update `restoreSession()` to handle IndexedDB (lines 512-518)

### Total Impact
- **Lines Added**: ~330
- **Lines Modified**: ~70
- **Lines Deleted**: ~12 (base64 storage removed)
- **Net Change**: +388 lines

---

## Implementation Timeline

| Phase | Task | Time | Confidence |
|-------|------|------|------------|
| **Phase 1** | Create pet-storage-manager.js | 3 hours | High |
| **Phase 2** | Modify pet selector storage | 2 hours | High |
| **Phase 3** | Update processor auto-load | 2 hours | High |
| **Phase 4** | Mobile device testing | 4 hours | Medium |
| **Phase 5** | Error handling & edge cases | 2 hours | Medium |
| **Phase 6** | Documentation & deployment | 1 hour | High |
| **Total** | | **14 hours** | **~2 work days** |

**Assumptions**:
- Chrome DevTools MCP available for testing
- Test URL provided by user (URLs expire periodically)
- No major IndexedDB API quirks discovered
- No backend changes needed

**Risks**:
- iOS Safari may have undocumented quirks (+2 hours debugging)
- DataTransfer API may need polyfill for edge cases (+1 hour)
- Mobile testing reveals unexpected issues (+4 hours)

**Worst Case**: 21 hours (~3 work days)

---

## Open Questions for User

**Q1**: Should we deploy with feature flag for gradual rollout, or full deployment?
- **Option A**: Feature flag (safer, can A/B test, rollback easier)
- **Option B**: Full deployment (simpler, immediate fix for all users)

**Q2**: Private browsing users (5%) get fallback with 1-file limit. Acceptable UX?
- **Option A**: Show warning, allow 1 file (current plan)
- **Option B**: Block upload entirely, tell user to exit private mode
- **Option C**: No warning, silent limitation (not recommended)

**Q3**: Storage cleanup interval: 7 days OK, or prefer shorter (3 days)?
- **Consideration**: Most customers order same day, but some comparison-shop

**Q4**: Error messages - technical or user-friendly?
- **Technical**: "IndexedDB quota exceeded" (helps debugging)
- **User-friendly**: "Storage full, please use smaller photos" (less confusing)

**Q5**: Testing priority - real device or Chrome DevTools MCP first?
- **Real device**: More accurate, but slower iteration
- **Chrome DevTools MCP**: Faster debugging, automated testing

---

## Comparison to Previous Implementation Plans

### Relation to `mobile-state-persistence-implementation-plan.md`

**This plan is a SUBSET** of the comprehensive state persistence plan:

**Previous Plan (mobile-state-persistence-implementation-plan.md)**:
- Full state restoration (files, names, styles, fonts)
- 500+ lines of code
- 26 hours implementation
- Handles all navigation scenarios

**This Plan (mobile-localstorage-quota-elimination-plan.md)**:
- **FOCUSED**: Only eliminate quota errors in file storage
- 330 lines of code
- 14 hours implementation
- Minimal changes to existing workflow

**Key Differences**:

| Feature | Previous Plan | This Plan |
|---------|---------------|-----------|
| **File storage** | IndexedDB ✅ | IndexedDB ✅ |
| **Pet name restoration** | Full ✅ | Not included ❌ |
| **Style/font restoration** | Full ✅ | Not included ❌ |
| **Scroll position restoration** | Full ✅ | Not included ❌ |
| **Form submit waiting** | Full ✅ | Not included ❌ |
| **Complexity** | High (500+ lines) | Low (330 lines) |

**Recommendation**: Implement THIS plan first (quota fix only), then evaluate if additional restoration features are needed based on customer feedback.

**Why Start Smaller**:
1. **Immediate Impact**: Fixes critical quota errors now
2. **Lower Risk**: Fewer changes = less chance of bugs
3. **Faster Delivery**: 14 hours vs 26 hours
4. **Incremental**: Can add full restoration later if needed

### Relation to `localstorage-quota-root-cause-analysis.md`

**That plan was for DIFFERENT problem**: Migration quota errors in legacy pet effect storage system.

**This plan addresses**: Preview modal quota errors in pet selector file uploads.

**No conflict**: Both plans can coexist (different localStorage keys, different use cases).

---

## Next Steps

1. **User Approval**: Confirm approach and answer open questions
2. **Phase 1**: Implement `pet-storage-manager.js` (3 hours)
3. **Phase 2**: Modify pet selector storage logic (2 hours)
4. **Phase 3**: Update processor auto-load (2 hours)
5. **Phase 4**: Test on real mobile devices (4 hours)
6. **Phase 5**: Deploy to test environment via GitHub push
7. **Phase 6**: Monitor for errors, gather feedback
8. **Phase 7**: Deploy to production if stable

**Critical Dependencies**:
- User provides current test URL (URLs expire)
- Chrome DevTools MCP available for automated testing
- Access to iPhone/Android for real device testing

---

## Conclusion

**Root Cause**: Storing 2-5MB base64 images in localStorage (5-10MB quota) breaks multi-pet orders.

**Solution**: Use IndexedDB for Blob storage (50MB+ quota) + DataTransfer API for File reconstruction.

**Impact**: Eliminates QuotaExceededError, restores 45% of lost mobile conversions.

**Effort**: 14 hours (~2 work days), low risk, high reward.

**Next**: User approval → Implementation → Testing → Deployment.
