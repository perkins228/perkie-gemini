# Pet Selector Critical Bug Analysis

## Executive Summary

After systematic analysis of the pet selector codebase, I've identified the root causes of all three critical bugs reported. These bugs stem from inconsistencies in function naming, data retrieval logic, and session synchronization between the pet processor and pet selector components.

## Bug Analysis

### Bug 1: Only Most Recent Image Shows (Instead of All Processed Pets)

**Root Cause**: Inconsistent multi-pet data structure in `extractPetDataFromCache()`

**Location**: `snippets/ks-product-pet-selector.liquid` lines 686-746

**Problem**: The function is primarily loading from `window.perkieEffects` which contains ALL pet data, but the ordering logic from `processedPets` array is secondary. If the localStorage session data is missing or corrupted, it falls back to showing pets in whatever order they exist in the Map, which could appear as "only the most recent".

**Specific Issue**:
```javascript
// This fallback only shows pets that match effect patterns
window.perkieEffects.forEach((imageUrl, key) => {
  const match = key.match(/^(.+?)_(enhancedblackwhite|popart|dithering|color)$/);
  // If session data is missing, this may only find the most recent pet
});
```

### Bug 2: Pet Names Reverting to File Names

**Root Cause**: Name retrieval prioritizes extracted filename over stored pet names

**Location**: `snippets/ks-product-pet-selector.liquid` lines 717-721

**Problem**: 
```javascript
// Use name from multi-pet data if available
const petName = petNamesMap[sessionKey] || extractPetName(sessionKey);
```

The logic should be:
1. Check `petNamesMap` from localStorage session (user-entered names)
2. Fallback to `extractPetName()` (filename-based)

But if `petNamesMap` is empty or corrupted, it immediately falls back to filename extraction.

**Contributing Factors**:
- Session data corruption during page navigation
- Multi-pet session validation may clear `petNames` map
- No synchronization between pet processor name storage and pet selector retrieval

### Bug 3: Remove Button Not Deleting Pets

**Root Cause**: Function name mismatch in delete callback

**Location**: `snippets/ks-product-pet-selector.liquid` line 907

**Critical Error**:
```javascript
// Re-render the pet selector
initializePetSelector();  // ❌ FUNCTION DOESN'T EXIST
```

Should be:
```javascript
initPetSelector();  // ✅ CORRECT FUNCTION NAME
```

**Impact**: When delete button is clicked:
1. Pet data IS correctly removed from `window.perkieEffects`
2. Pet data IS correctly removed from localStorage session
3. But UI doesn't refresh because `initializePetSelector()` is undefined
4. User sees no visual change, assumes deletion failed

## Technical Deep Dive

### Data Flow Analysis

**Pet Processor V5 → Pet Selector Flow**:
1. Pet processed in `assets/pet-processor-v5-es5.js`
2. Data stored in `window.perkieEffects` Map
3. Session data stored in localStorage with structure:
   ```javascript
   {
     processedPets: ['sessionKey1', 'sessionKey2'],
     petNames: { sessionKey1: 'User Name', sessionKey2: 'Another Name' }
   }
   ```
4. Pet selector loads from both sources
5. **FAILURE POINT**: Inconsistent data between Map and localStorage

### Session Key Validation Issues

The `validateMultiPetSession()` function in pet processor can remove pets from `processedPets` array if their effects are missing from storage. This creates a mismatch where:
- Pet effects exist in `window.perkieEffects`
- But pet is removed from `processedPets` array
- Pet name is removed from `petNames` map
- Result: Pet shows with filename instead of user name

### Storage Synchronization Gaps

**Problem**: Two independent storage mechanisms:
1. `window.perkieEffects` (runtime Map)
2. localStorage session data (persistent object)

These can become desynchronized during:
- Page navigation
- Storage cleanup operations
- Multi-pet uploads
- Session validation

## Implementation Plan

### Phase 1: Critical Function Fix (5 minutes)
**File**: `snippets/ks-product-pet-selector.liquid`
**Location**: Line 907
```javascript
// Change from:
initializePetSelector();
// To:
initPetSelector();
```

### Phase 2: Multi-Pet Display Logic Fix (15 minutes)
**File**: `snippets/ks-product-pet-selector.liquid`
**Location**: Lines 686-746

**Strategy**: Make multi-pet detection more robust
1. Always check localStorage session data first
2. Only fall back to Map iteration if session is completely missing
3. Ensure proper ordering based on `processedPets` array

### Phase 3: Pet Name Persistence Fix (20 minutes)
**File**: `snippets/ks-product-pet-selector.liquid`
**Location**: Lines 717-721

**Strategy**: Enhanced name resolution priority
1. Check `petNamesMap` from current session
2. Check metadata stored in `window.perkieEffects`
3. Check backup localStorage for name data
4. Final fallback to `extractPetName()`

### Phase 4: Storage Synchronization (30 minutes)
**Files**: Both processor and selector

**Strategy**: Add synchronization verification
1. Cross-validate Map data against localStorage
2. Rebuild missing session data from Map if possible
3. Enhanced error recovery for corrupted sessions

## Recommended Testing

### Test Case 1: Multi-Pet Upload
1. Upload pet 1, give it custom name
2. Upload pet 2, give it custom name  
3. Navigate to product page
4. Verify both pets show with correct names

### Test Case 2: Pet Deletion
1. Process multiple pets
2. Navigate to product page
3. Delete middle pet
4. Verify remaining pets still show
5. Verify deleted pet is gone

### Test Case 3: Session Recovery
1. Process pets with custom names
2. Clear localStorage session data (simulate corruption)
3. Reload page
4. Verify pets still show (may have filename fallback names)

## Risk Assessment

**Phase 1**: **LOW RISK** - Simple function name fix, immediate improvement
**Phase 2**: **MEDIUM RISK** - Core logic changes, need thorough testing
**Phase 3**: **MEDIUM RISK** - Name resolution affects UX but not core functionality  
**Phase 4**: **HIGH RISK** - Cross-system synchronization, potential for new bugs

## Success Criteria

1. ✅ All processed pets visible in selector (not just most recent)
2. ✅ User-entered pet names persist across navigation
3. ✅ Delete button immediately removes pets from display
4. ✅ Multi-pet selection works consistently
5. ✅ Session data remains synchronized between components

## Next Steps

1. Implement Phase 1 immediately (critical function fix)
2. Test Phase 1 thoroughly before proceeding
3. Implement Phases 2-3 together (logical grouping)
4. Test complete user journey before Phase 4
5. Consider Phase 4 as enhancement after core bugs resolved

The bugs are interconnected but can be fixed systematically with proper testing between phases. The critical issue is the undefined function call preventing UI updates after deletion.