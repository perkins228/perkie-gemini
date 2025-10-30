# Multi-Pet Deletion Bug: Root Cause Analysis & Implementation Plan

**Date:** 2025-08-17  
**Issue:** Previous pet images disappear from pet selector when user uploads a new pet image  
**Impact:** CRITICAL - Defeats the entire purpose of multi-pet support (50% of orders have 2+ pets)

## Root Cause Analysis

### 1. Core Problem: Session Storage Overwrite in `handleFile()`

**Location:** `assets/pet-processor-v5-es5.js` lines 322-381

The critical bug occurs in the `handleFile()` function when a new pet image is uploaded:

```javascript
// Line 337-338: This OVERWRITES the currentSessionKey
var sessionKey = file.name.replace(/\.[^/.]+$/, "") + '_' + Date.now();
self.currentSessionKey = sessionKey;
```

**What happens:**
1. User processes first pet → `currentSessionKey = "dog1_1234567890"`
2. User clicks "Process Another Pet" → Session data saved to `processedPets` array
3. User uploads second pet → `currentSessionKey = "dog2_1234567891"` (**overwrites completely**)
4. Pet selector tries to load from session → only finds latest pet

### 2. Session Data Storage Inconsistency

**Problem:** Two different storage mechanisms not properly synchronized:

1. **Pet Processor Session Storage** (lines 1411-1425):
   - Stores: `processedPets`, `currentPetIndex`, `petNames`
   - Saved to: `localStorage['pet_session_' + sectionId]`

2. **Window.perkieEffects Storage** (lines 346-361):
   - Stores: Individual pet images with session keys
   - Stored in: `window.perkieEffects Map`

**The Gap:** When `processAnotherPet()` is called, it correctly adds to `processedPets` array, but `handleFile()` doesn't check for existing multi-pet context.

### 3. Pet Selector Loading Logic Issue

**Location:** `snippets/ks-product-pet-selector.liquid` lines 688-746

The pet selector loads pets in this order:
1. Checks `localStorage` for `processedPets` list
2. Iterates through `window.perkieEffects` to find matching session keys
3. Orders pets according to `processedPets` array

**Problem:** If session data is corrupted or overwritten, the selector falls back to only showing pets found in `window.perkieEffects`, but without the multi-pet ordering context.

## Specific Code Path Analysis

### Bug Trigger Sequence:
1. User uploads first pet → `currentSessionKey = "pet1_123"`
2. Processing completes → Effects stored in `window.perkieEffects`
3. User clicks "Process Another Pet" → `processedPets = ["pet1_123"]`, `currentSessionKey = null`
4. User uploads second pet → `handleFile()` creates `currentSessionKey = "pet2_456"`
5. **CRITICAL:** No mechanism to maintain multi-pet context during new upload
6. Pet selector loads → only finds `pet2_456` in effective session context

### Storage Verification:
- ✅ `processAnotherPet()` correctly saves multi-pet data
- ✅ Pet selector correctly reads multi-pet data
- ❌ `handleFile()` doesn't integrate with existing multi-pet session
- ❌ No validation that previous pets are preserved during new upload

## Implementation Strategy

### Phase 1: Fix Session Context Preservation (HIGH PRIORITY)

**File:** `assets/pet-processor-v5-es5.js`
**Lines to modify:** 322-381 (handleFile function)

**Changes needed:**
1. **Before generating new session key**, check if we're in multi-pet mode:
   ```javascript
   // Check if we're adding to existing multi-pet session
   if (this.processedPets.length > 0 && this.currentPetIndex < this.maxPets) {
     // We're in multi-pet mode - preserve context
     console.log('Adding pet ' + (this.currentPetIndex + 1) + ' to existing session');
   }
   ```

2. **Preserve processed pets context** during new upload:
   ```javascript
   // Ensure processedPets array is maintained
   if (!this.processedPets) {
     this.processedPets = [];
   }
   ```

3. **Add validation** that previous pets still exist in storage:
   ```javascript
   // Verify previous pets are still accessible
   var lostPets = this.processedPets.filter(petKey => {
     return !this.hasPetInStorage(petKey);
   });
   
   if (lostPets.length > 0) {
     console.error('Lost pets detected:', lostPets);
     // Trigger recovery mechanism
   }
   ```

### Phase 2: Add Storage Integrity Checks (MEDIUM PRIORITY)

**File:** `assets/pet-processor-v5-es5.js`
**New function needed:** `validateMultiPetSession()`

**Implementation:**
```javascript
PetProcessorV5.prototype.validateMultiPetSession = function() {
  if (this.processedPets.length === 0) return true;
  
  var missingPets = [];
  for (var i = 0; i < this.processedPets.length; i++) {
    var petKey = this.processedPets[i];
    var hasEffects = false;
    
    // Check if pet has any effects in storage
    window.perkieEffects.forEach(function(url, key) {
      if (key.startsWith(petKey + '_')) {
        hasEffects = true;
      }
    });
    
    if (!hasEffects) {
      missingPets.push(petKey);
    }
  }
  
  if (missingPets.length > 0) {
    console.error('Multi-pet session corruption detected:', missingPets);
    // Remove corrupted entries
    this.processedPets = this.processedPets.filter(function(key) {
      return missingPets.indexOf(key) === -1;
    });
    this.saveSession();
    return false;
  }
  
  return true;
};
```

### Phase 3: Enhanced Error Recovery (LOW PRIORITY)

**File:** `snippets/ks-product-pet-selector.liquid`
**Lines to modify:** 618-746 (loadSavedPets function)

**Changes needed:**
1. Add cross-validation between session data and effects storage
2. Implement automatic recovery when discrepancies are found
3. Add user notification for recovered sessions

## Testing Strategy

### Test Case 1: Basic Multi-Pet Flow
1. Upload first pet image
2. Process and verify it appears in selector
3. Click "Process Another Pet"
4. Upload second pet image
5. **VERIFY:** First pet still visible in selector
6. **VERIFY:** Both pets can be selected

### Test Case 2: Storage Persistence
1. Complete Test Case 1
2. Navigate to different page
3. Return to pet selector page
4. **VERIFY:** Both pets still visible and selectable

### Test Case 3: Edge Cases
1. Upload pet, don't process, upload different pet
2. Upload 3 pets (max limit)
3. Try to upload 4th pet
4. Delete middle pet from selector
5. **VERIFY:** Remaining pets maintain proper order

## Files to Modify

### Critical Changes (Phase 1)
- `assets/pet-processor-v5-es5.js`
  - Lines 322-381: `handleFile()` function
  - Lines 1652-1700: `processAnotherPet()` function validation
  - Add new: `validateMultiPetSession()` function

### Secondary Changes (Phase 2-3)
- `snippets/ks-product-pet-selector.liquid`
  - Lines 618-746: Enhanced error recovery in `loadSavedPets()`
  - Lines 874-908: Improved deletion handling

## Risk Assessment

**Risk Level:** LOW
- Changes are surgical and focused on session management
- Existing multi-pet infrastructure is solid
- Backward compatibility maintained
- Only affects edge case where bug currently occurs

**Rollback Strategy:**
- Changes are isolated to specific functions
- Can revert individual functions without affecting core processing
- Session data format unchanged

## Success Criteria

1. **Functional:** User can upload multiple pets without losing previous ones
2. **Persistent:** Multi-pet selections survive page navigation
3. **Reliable:** Storage corruption auto-recovers gracefully
4. **Performance:** No degradation in processing speed
5. **Compatible:** Works with existing single-pet workflows

## Next Steps

1. Implement Phase 1 changes in `handleFile()` function
2. Add session validation before new pet upload
3. Test multi-pet flow thoroughly
4. Deploy to staging for user testing
5. Monitor for storage corruption issues
6. Implement Phases 2-3 based on user feedback

---

**Critical Success Factor:** The bug is actually quite contained - it's a session context preservation issue during new uploads, not a fundamental architectural problem. The multi-pet infrastructure works correctly; it just needs better integration during the upload phase.