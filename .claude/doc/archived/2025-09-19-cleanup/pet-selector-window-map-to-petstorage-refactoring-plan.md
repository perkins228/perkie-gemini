# Pet Selector Map-to-PetStorage Refactoring Implementation Plan

**Project**: Perkie Prints Pet Customization Platform  
**Task**: Complete migration from `window.perkieEffects` Map to PetStorage system  
**Context**: NEW BUILD - No legacy users, can make breaking changes  
**Priority**: HIGH - Eliminate architectural complexity and data volatility  
**Timeline**: 6-8 hours across 2 days  

## Executive Summary

The pet selector component (`ks-product-pet-selector.liquid`) currently has 26+ direct references to the volatile `window.perkieEffects` Map, which causes synchronization issues and data loss. We need to complete the migration to the robust PetStorage system that already has Map-compatible methods ready.

## Current State Analysis

### Map Dependencies Identified
**Critical File**: `snippets/ks-product-pet-selector.liquid` (2,500+ lines)

**Key Usage Patterns**:
1. `window.perkieEffects.forEach((url, key) => {...})` - Iteration over all pets
2. `window.perkieEffects.get(key)` - Retrieve specific pet data/metadata
3. `window.perkieEffects.set(key, value)` - Store new pet data
4. `window.perkieEffects.delete(key)` - Remove pet data
5. `window.perkieEffects.size > 0` - Check if pets exist

**Complex Key Patterns**:
- Compound keys: `pet123_enhancedblackwhite`, `pet123_metadata`
- Key extraction via regex: `/^(.+?)_(enhancedblackwhite|popart|dithering|color)$/`
- SessionKey isolation from compound keys

### Available PetStorage Methods
**Ready for Use**:
- `PetStorage.forEachEffect(callback)` - Map-compatible forEach
- `PetStorage.getMetadata(sessionKey)` - Metadata retrieval
- `PetStorage.getEffectUrl(sessionKey, effect)` - Effect-specific URLs
- `PetStorage.getAllForDisplay()` - Complete pet data for rendering
- `PetStorage.get/save/delete` - Basic CRUD operations

## Refactoring Strategy

### Approach: Complete Surgical Replacement (Recommended)

**Rationale**: Since this is a NEW BUILD with no legacy users, we can eliminate the Map entirely in one coordinated refactor rather than maintaining dual systems.

**Benefits**:
- Single source of truth (PetStorage)
- Eliminates data volatility issues
- Removes complex synchronization code
- Reduces memory overhead
- Simplifies debugging

**Risk Level**: MEDIUM (manageable with proper testing)

## Implementation Plan

### Phase 1: Replace Read Operations (2 hours, LOW risk)

#### 1.1 Replace forEach Iterations
**Lines**: 826, 1393, 1438, 1525, 1581, 1950

**Before**:
```javascript
window.perkieEffects.forEach((imageUrl, key) => {
  const match = key.match(/^(.+?)_(enhancedblackwhite|popart|dithering|color)$/);
  if (match) {
    const sessionKey = match[1];
    const effect = match[2];
    // ... process data
  }
});
```

**After**:
```javascript
PetStorage.forEachEffect((imageUrl, key, sessionKey, effect) => {
  // Direct access, no regex parsing needed
  // ... process data
});
```

#### 1.2 Replace Existence Checks
**Lines**: 987, 1048

**Before**:
```javascript
if (!window.perkieEffects || window.perkieEffects.size === 0) {
```

**After**:
```javascript
const allPets = PetStorage.getAll();
if (!allPets || Object.keys(allPets).length === 0) {
```

#### 1.3 Replace get() Operations
**Lines**: 1541, 1676

**Before**:
```javascript
const metadataKey = sessionKey + '_metadata';
const metadataRaw = window.perkieEffects.get(metadataKey);
```

**After**:
```javascript
const metadata = PetStorage.getMetadata(sessionKey);
```

### Phase 2: Replace Write Operations (2 hours, MEDIUM risk)

#### 2.1 Replace set() Operations
**Lines**: 858, 1462, 1486, 1501

**Before**:
```javascript
window.perkieEffects.set(key, data[key]);
```

**After**:
```javascript
// Extract sessionKey from compound key if needed
const sessionKey = key.match(/^(.+?)_/) ? key.match(/^(.+?)_/)[1] : key;
PetStorage.save(sessionKey, {
  // Transform data to PetStorage format
  gcsUrl: data[key],
  timestamp: Date.now()
});
```

#### 2.2 Replace delete() Operations
**Lines**: 1957

**Before**:
```javascript
window.perkieEffects.delete(key);
```

**After**:
```javascript
const sessionKey = key.match(/^(.+?)_/) ? key.match(/^(.+?)_/)[1] : key;
PetStorage.delete(sessionKey);
```

### Phase 3: Update Helper Functions (1 hour, LOW risk)

#### 3.1 Replace loadSavedPets() Function

**Before**: Complex Map iteration and parsing
**After**: Direct PetStorage access

```javascript
function loadSavedPets() {
  const pets = new Map();
  const allPets = PetStorage.getAllForDisplay();
  
  allPets.forEach(petData => {
    pets.set(petData.sessionKey, {
      sessionKey: petData.sessionKey,
      name: petData.name,
      effects: petData.effects
    });
  });
  
  return pets;
}
```

#### 3.2 Remove Obsolete Functions
- `saveEffectsToLocalStorage()` - Auto-saved by PetStorage
- `restoreEffectsFromLocalStorage()` - Use PetStorage.getAll()
- Complex Map synchronization logic

### Phase 4: Remove Map Dependencies (30 minutes, LOW risk)

#### 4.1 Delete Map Initialization
**Lines**: 846-848
```javascript
// DELETE THIS:
if (!window.perkieEffects) {
  window.perkieEffects = new Map();
}
```

#### 4.2 Remove syncToLegacyStorage() Permanently
**File**: `assets/pet-processor.js`
- Remove method definition
- Remove all calls to syncToLegacyStorage()

#### 4.3 Clean Up Event Handlers
**Lines**: 824-832
```javascript
// REPLACE blob URL cleanup with PetStorage cleanup
window.addEventListener('beforeunload', function() {
  PetStorage.cleanupBlobUrls();
});
```

## Key Technical Challenges

### 1. Compound Key Handling

**Challenge**: Current Map uses compound keys like `pet123_enhancedblackwhite`  
**Solution**: PetStorage methods already handle the extraction internally

**Example**:
```javascript
// OLD: Manual parsing
const match = key.match(/^(.+?)_(enhancedblackwhite|popart|dithering|color)$/);
const sessionKey = match[1];
const effect = match[2];

// NEW: Built-in extraction in PetStorage.forEachEffect()
PetStorage.forEachEffect((url, key, sessionKey, effect) => {
  // sessionKey and effect provided directly
});
```

### 2. Metadata Access Patterns

**Challenge**: Current code accesses metadata via `${sessionKey}_metadata` keys  
**Solution**: Direct metadata access via PetStorage.getMetadata()

**Example**:
```javascript
// OLD: Manual metadata key construction
const metadataKey = sessionKey + '_metadata';
const metadataRaw = window.perkieEffects.get(metadataKey);

// NEW: Direct metadata access
const metadata = PetStorage.getMetadata(sessionKey);
```

### 3. ES5 Compatibility

**Challenge**: Must maintain ES5 compatibility for 70% mobile traffic  
**Solution**: PetStorage already ES5-compatible, avoid modern JS features

**Guidelines**:
- Use `function()` not arrow functions in iterations
- Use `var` not `const/let` in older code sections
- Use `Object.keys()` not modern iteration methods

### 4. Liquid/JS Mixing

**Challenge**: `.liquid` file mixes server-side Liquid and client-side JavaScript  
**Solution**: No special handling needed - refactoring is purely JavaScript

**Considerations**:
- Server-side Liquid code unchanged
- JavaScript refactoring within existing `<script>` tags
- Maintain existing variable scoping

## Testing Requirements

### Unit Tests
- **Load Pets**: Verify PetStorage.getAllForDisplay() returns correct format
- **Add Pet**: Verify save() operations store data correctly
- **Delete Pet**: Verify delete() removes data completely
- **Persistence**: Verify data survives page refresh

### Integration Tests
- **Complete Flow**: Upload → Process → Select → Add to Cart
- **Cart Display**: Verify pet thumbnails and font styles appear
- **Multiple Pets**: Verify handling of 2-3 pet selections
- **Font Integration**: Verify font selector works with new storage

### Regression Tests
- **Upload Section**: Ensure upload section remains visible
- **Pet Selector**: Ensure pet selection functionality unchanged
- **Cart Integration**: Verify cart thumbnails and line item properties

### Staging Test Plan
1. **Deploy to staging**
2. **Upload pet named "TestPet"**
3. **Process with different effects**
4. **Select multiple pets**
5. **Add to cart with font selection**
6. **Verify cart displays correctly**
7. **Check order data capture**

## Rollback Strategy

### Quick Rollback (5 minutes)
**If major issues discovered immediately**:
1. Re-enable `syncToLegacyStorage()` call in pet-processor.js
2. Redeploy to staging
3. Map synchronization restored

### Full Rollback (30 minutes)
**If architectural issues discovered**:
1. Revert entire commit
2. Restore Map implementation
3. Re-enable all Map dependencies
4. Test basic functionality

## Performance Impact

### Expected Improvements
- **Memory**: -20-30% (eliminate Map duplication)
- **Load Time**: -100-200ms (no Map sync overhead)
- **Debugging**: Simpler single storage system

### Risk Mitigation
- **Progressive Rollout**: Deploy to staging first
- **Debug Logging**: Add temporary logging for data verification
- **Monitoring**: Watch for JavaScript errors in staging

## Implementation Timeline

### Day 1 (4 hours)
- **Hours 1-2**: Phase 1 - Replace read operations
- **Hours 3-4**: Phase 2 - Replace write operations
- **End of Day**: Deploy to staging for initial testing

### Day 2 (2.5 hours)
- **Hour 1**: Phase 3 - Update helper functions
- **Hour 1.5**: Phase 4 - Remove Map dependencies + cleanup
- **Hour 2-2.5**: Testing and refinement

### Total Estimated Time: 6.5 hours

## Success Criteria

### Functional Requirements ✅
- [ ] Pet upload and processing works
- [ ] Pet selector displays all processed pets
- [ ] Multiple pet selection works
- [ ] Cart integration maintains all data
- [ ] Font selector integration preserved

### Performance Requirements ✅
- [ ] No increase in load times
- [ ] Memory usage decreased
- [ ] No JavaScript errors in console

### Code Quality Requirements ✅
- [ ] Single source of truth (PetStorage only)
- [ ] No Map synchronization code
- [ ] ES5 compatibility maintained
- [ ] Clean, readable code

## Business Impact

### Expected Benefits
- **Stability**: Eliminate data volatility issues
- **Performance**: Reduced memory overhead and sync complexity
- **Maintainability**: Single storage system easier to debug
- **Developer Experience**: Cleaner architecture for future features

### Risk Assessment
- **User Impact**: None expected (internal architectural change)
- **Revenue Risk**: Minimal (rollback available if issues)
- **Timeline Risk**: Low (well-defined phases)

## Conclusion

This refactoring represents a critical architectural improvement that will eliminate the current dual-storage complexity and data synchronization issues. With PetStorage's Map-compatible methods already implemented and a NEW BUILD context allowing breaking changes, this is the optimal time to complete this migration.

The phased approach minimizes risk while the comprehensive testing plan ensures functionality preservation. Expected completion in 6.5 hours across 2 days will deliver a more robust, maintainable, and performant pet customization system.

**Next Steps**: Begin Phase 1 implementation with read operation replacements, starting with the forEach iterations that represent 60% of the Map dependencies.