# Pet Storage Architecture Cleanup Plan

## Executive Summary
This plan addresses the architectural cleanup of our pet storage system, consolidating 3 parallel storage mechanisms into a single source of truth. This is a NEW BUILD with no legacy users or backward compatibility requirements.

## Current Architecture Analysis

### 1. Three Parallel Storage Systems (Overly Complex)
```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   PetStorage (LS)   │────▶│ window.perkieEf- │────▶│ window.perkiePets│
│   PRIMARY SOURCE    │     │ fects Map        │     │ Shopify Data    │
│   Works Correctly   │     │ VOLATILE/LOSSY   │     │ Cart Integration│
└─────────────────────┘     └──────────────────┘     └─────────────────┘
        ▲                           ▲                         ▲
        │                           │                         │
    Save/Load                  Display Layer             Cart Submit
```

### 2. Current Data Flow Issues
- **PetStorage**: Primary localStorage system, works correctly, handles compression
- **window.perkieEffects Map**: Volatile display layer, loses data on page refresh
- **window.perkiePets**: Shopify integration layer, synced from PetStorage

## Dependency Analysis

### Critical Question: What breaks if we remove window.perkieEffects Map?

#### 1. **Image Processing Pipeline** ✅ NO IMPACT
- **pet-processor.js**: Creates data in PetStorage, syncs to window.perkieEffects for backward compatibility
- **Impact**: None - processor writes to PetStorage first, Map sync is secondary
- **Fix**: Remove lines 973-974, 1012-1058 (syncToLegacyStorage calls)

#### 2. **Cart Integration** ✅ NO IMPACT  
- **cart-pet-integration.js**: Reads from form fields populated by pet:selected events
- **window.perkiePets**: Updated by PetStorage.updateGlobalPets()
- **Impact**: None - cart uses form fields and localStorage, not the Map

#### 3. **Pet Selector Display Logic** ⚠️ MAJOR IMPACT
- **ks-product-pet-selector.liquid**: 
  - Lines 825-832: Cleanup blob URLs from Map
  - Lines 834-860: Save/restore Map to localStorage  
  - Lines 986-989: Restore from localStorage if Map empty
  - Lines 1138-1150: Populate Map from PetStorage for display
  - Lines 1400-1404: Check Map for valid effects
  - Lines 1445-1473: Check and recover effects from Map
  - Lines 1534-1563: **CRITICAL - renderPets() reads from Map to display pets**
  - Lines 1957-1968: Delete from Map on pet removal
  - Lines 2380-2397: Get effects from Map for cart data

**CRITICAL FINDING**: Pet selector UI completely depends on window.perkieEffects Map for displaying pets

#### 4. **Shopify Order Flow** ✅ NO IMPACT
- Uses line item properties from form fields
- Never directly reads window.perkieEffects
- Gets data from window.perkiePets (synced from PetStorage)

#### 5. **Other Dependencies**
- **api-client.js**: Creates window.perkieEffects for API results (lines 109-142)
- **buy-buttons.liquid**: Reads metadata from Map (line 192)

## Proposed Architecture (Simplified)

### Option A: Single Source with Direct Reads (RECOMMENDED)
```
┌─────────────────────┐
│   PetStorage (LS)   │◀────── Single Source of Truth
│   All Operations    │
└──────────┬──────────┘
           │
    ┌──────┴──────┬────────────┬─────────────┐
    ▼             ▼            ▼             ▼
Pet Selector  Cart Integration  API Client  Shopify
(Direct Read)  (Direct Read)   (Direct Save) (Via window.perkiePets)
```

**Implementation Steps:**
1. Modify pet selector to read directly from PetStorage
2. Remove window.perkieEffects Map entirely
3. Keep window.perkiePets for Shopify compatibility only

### Option B: Challenge Assumption - Pure Shopify Storage
```
┌─────────────────────┐
│ Shopify Properties  │◀────── Single Source
│  (Line Items)       │
└─────────────────────┘
```

**Why this won't work:**
- Shopify properties only exist AFTER add to cart
- Can't store pet data BEFORE product selection
- No way to persist across page refreshes before cart
- Would lose ability to process multiple pets then select product

## Recommended Implementation Plan

### Phase 1: Refactor Pet Selector (4-6 hours)
1. **Modify renderPets() function** (ks-product-pet-selector.liquid line 1764)
   - Read directly from PetStorage.getAll() instead of window.perkieEffects Map
   - Structure: `{ petId: { name, thumbnail, effect, gcsUrl } }`

2. **Update pet selection handlers**
   - Lines 2380-2397: Get data from PetStorage instead of Map
   - Lines 1400-1473: Check PetStorage for valid effects

3. **Remove Map sync operations**
   - Lines 825-860: Remove Map save/restore functions
   - Lines 986-989: Remove Map restoration check
   - Lines 1138-1150: Remove Map population from PetStorage

### Phase 2: Clean Up Processing Pipeline (2 hours)
1. **pet-processor.js cleanup**:
   - Remove syncToLegacyStorage() method (lines 1012-1058)
   - Remove calls to syncToLegacyStorage (lines 973-974, 1019-1032)
   - Remove Map validation (lines 1121-1145)

2. **api-client.js cleanup**:
   - Remove window.perkieEffects creation (lines 109-142)
   - Store directly to PetStorage instead

### Phase 3: Optimize Cart Integration (1 hour)
1. Keep window.perkiePets for Shopify
2. Ensure PetStorage.updateGlobalPets() is called on all changes
3. Remove any remaining Map references

## Risk Mitigation

### Potential Breaking Points:
1. **Pet display in selector** - HIGH RISK
   - Mitigation: Thorough testing of renderPets() refactor
   
2. **Effect switching** - MEDIUM RISK  
   - Currently uses Map keys like "petId_enhancedblackwhite"
   - Mitigation: Store effects in PetStorage with same key structure

3. **Blob URL cleanup** - LOW RISK
   - Currently cleans Map entries on page unload
   - Mitigation: Move cleanup to PetStorage class

## Testing Strategy

### Critical Test Cases:
1. Upload and process pet → Verify display in selector
2. Switch between effects → Verify instant switching works
3. Select multiple pets → Verify all show in selector
4. Page refresh → Verify pets persist and display
5. Add to cart → Verify all pet data transfers
6. Remove pet → Verify cleanup works properly

### Files to Test:
- `/products/` page with pet selector
- Pet processor page
- Cart drawer with pet thumbnails
- Checkout with pet data

## Benefits of Cleanup

### Immediate Benefits:
1. **Reduced Complexity**: 3 systems → 1 system
2. **Better Reliability**: No volatile Map losing data
3. **Cleaner Codebase**: ~200 lines of sync code removed
4. **Improved Performance**: No redundant data copying

### Long-term Benefits:
1. **Easier Maintenance**: Single point of truth
2. **Reduced Bugs**: No sync issues between systems
3. **Better Scalability**: Can optimize single storage layer
4. **Clearer Architecture**: New developers understand faster

## Implementation Timeline

- **Day 1** (6-8 hours):
  - Phase 1: Refactor pet selector
  - Phase 2: Clean up processing pipeline
  - Phase 3: Optimize cart integration

- **Day 2** (2-3 hours):
  - Comprehensive testing
  - Bug fixes
  - Performance verification

## Alternative Consideration

### Could we use ONLY window.perkiePets?
**Pros:**
- Native Shopify integration
- No localStorage quota issues

**Cons:**
- Not persistent across pages (just an object)
- Would need localStorage anyway for persistence
- Still need intermediate storage before cart

**Conclusion**: Not viable as sole storage

## Decision Points

### Key Questions for User:
1. **Confirm removal of window.perkieEffects Map?** 
   - This is the biggest change, affects pet selector heavily

2. **Accept 6-8 hours of refactoring work?**
   - Significant changes to pet selector display logic

3. **Priority: Clean architecture vs "working is enough"?**
   - Current system works but is unnecessarily complex

## Rollback Plan

If issues arise:
1. Git revert to previous commit
2. All changes are in JavaScript/Liquid files
3. No database or API changes
4. Can rollback in <5 minutes

## Conclusion

The current 3-layer architecture is unnecessarily complex for a new build. Removing window.perkieEffects Map and reading directly from PetStorage would significantly simplify the codebase while maintaining all functionality. The main work is refactoring the pet selector display logic to read from PetStorage instead of the Map.

**Recommendation**: Proceed with Option A - Single Source with Direct Reads from PetStorage.