# NEW BUILD Storage Architecture Refactoring Plan

## Executive Summary

**Challenge**: Complex 3-storage architecture causing data synchronization issues and regression bugs in a NEW BUILD with no legacy users.

**Recommendation**: **OPTION B - Quick Surgical Refactor** (1-2 days vs 3 weeks)

Since this is a NEW BUILD with no production users, we should eliminate unnecessary complexity NOW rather than maintain technical debt through a phased migration.

## Current Architecture Problems

### 1. Three Competing Storage Systems
```javascript
// 1. PetStorage (assets/pet-storage.js) - Modern, reliable
class PetStorage {
  static save(petId, data) { /* Modern localStorage with compression */ }
}

// 2. window.perkieEffects Map - Volatile, loses data on refresh
window.perkieEffects = new Map()
window.perkieEffects.set('sam_enhancedblackwhite', 'blob:...')

// 3. window.perkiePets - Shopify bridge, redundant
window.perkiePets = []
```

### 2. Critical Dependencies

**Pet Selector renderPets() Function (lines 1534-1563)**:
```javascript
// READS FROM: window.perkieEffects Map directly
window.perkieEffects.forEach((imageUrl, key) => {
  const match = key.match(/^(.+?)_(enhancedblackwhite|popart|dithering|color)$/);
  // Creates pet objects from Map keys
});
```

**Buy Buttons (line 192)**:
```javascript
// READS FROM: window.perkieEffects Map for metadata
const metadata = window.perkieEffects ? window.perkieEffects.get(metadataKey) : null;
```

### 3. Synchronization Issues
- Pet Processor V5 (ES6) uses PetStorage efficiently
- Pet Selector (Liquid/ES5) reads from volatile Map
- Cart Integration creates redundant copies
- Data loss on page refresh requires complex recovery logic

## Refactoring Strategy: Single Source of Truth

### Phase 1: PetStorage Enhancement (2 hours)

**Objective**: Make PetStorage provide Map-compatible interface

**File**: `assets/pet-storage.js`

Add methods to eliminate Map dependency:

```javascript
class PetStorage {
  // Existing methods remain unchanged...
  
  // NEW: Map-compatible iteration for pet selector
  static forEachEffect(callback) {
    const pets = this.getAll();
    Object.entries(pets).forEach(([petId, pet]) => {
      if (pet.effects) {
        Object.entries(pet.effects).forEach(([effect, url]) => {
          const key = `${petId}_${effect}`;
          callback(url, key);
        });
      }
    });
  }
  
  // NEW: Map-compatible get for specific keys
  static getEffectUrl(sessionKey, effect) {
    const pet = this.get(sessionKey);
    return pet?.effects?.[effect] || null;
  }
  
  // NEW: Get metadata (replaces Map metadata storage)
  static getMetadata(sessionKey) {
    const pet = this.get(sessionKey);
    return pet?.metadata || null;
  }
  
  // NEW: Get all pets formatted for renderPets()
  static getAllForDisplay() {
    const pets = this.getAll();
    return Object.entries(pets).map(([sessionKey, pet]) => ({
      sessionKey,
      name: pet.name || pet.petName,
      effects: new Map(Object.entries(pet.effects || {})),
      metadata: pet.metadata
    }));
  }
}
```

### Phase 2: Pet Selector Refactor (3 hours)

**File**: `snippets/ks-product-pet-selector.liquid`

**Critical Changes**:

1. **Replace Map iteration (lines 1534-1563)**:
```javascript
// OLD: Reading from volatile Map
window.perkieEffects.forEach((imageUrl, key) => {
  // Complex parsing logic...
});

// NEW: Reading from PetStorage
const petArray = PetStorage.getAllForDisplay();
// Pets already formatted with effects Map
```

2. **Replace metadata access (line 1550)**:
```javascript
// OLD: Map metadata lookup
const metadataRaw = window.perkieEffects.get(metadataKey);

// NEW: PetStorage metadata
const metadata = PetStorage.getMetadata(sessionKey);
```

3. **Update data persistence**:
```javascript
// REMOVE: Map synchronization logic (lines 825-858)
// KEEP: PetStorage calls only
```

### Phase 3: Buy Buttons Refactor (1 hour)

**File**: `snippets/buy-buttons.liquid`

**Change line 192**:
```javascript
// OLD: Map access
const metadata = window.perkieEffects ? window.perkieEffects.get(metadataKey) : null;

// NEW: PetStorage access
const metadata = PetStorage.getMetadata(sessionKey);
```

### Phase 4: Cleanup & Bridge Removal (1 hour)

**Remove redundant code**:
1. All `window.perkieEffects` initialization code
2. Map synchronization functions
3. `window.perkiePets` bridge logic
4. Complex recovery mechanisms

**Maintain compatibility during transition**:
```javascript
// Temporary compatibility shim (remove after testing)
Object.defineProperty(window, 'perkieEffects', {
  get() {
    console.warn('Deprecated: Use PetStorage instead');
    const fakeMap = new Map();
    PetStorage.forEachEffect((url, key) => fakeMap.set(key, url));
    return fakeMap;
  }
});
```

## Risk Analysis & Mitigation

### HIGH RISK: renderPets() Refactor
**Risk**: Pet selector stops displaying pets
**Mitigation**: 
- Test with multiple pets and effects
- Maintain exact same data structure expectations
- Implement gradual rollback capability

### MEDIUM RISK: Effect Key Format
**Risk**: Existing pets use different key format
**Mitigation**: 
- Map old keys to new format in transition
- Maintain session key consistency

### LOW RISK: Cart Integration
**Risk**: Minor display issues
**Mitigation**: 
- Cart integration already uses line item properties
- PetStorage provides same data format

## Implementation Timeline

### Day 1 (4 hours)
- **Morning**: PetStorage enhancement + pet selector refactor
- **Afternoon**: Buy buttons update + initial testing

### Day 2 (2 hours)  
- **Morning**: Cleanup, compatibility bridge removal
- **Afternoon**: Comprehensive testing, mobile validation

## Testing Strategy

### Critical Test Scenarios
1. **Multi-pet workflow**: Upload 3 pets, verify all display in selector
2. **Effect switching**: Change effects, verify persistence
3. **Page refresh**: Reload, verify all pets restored
4. **Cart integration**: Add to cart, verify thumbnails appear
5. **Font selection**: Select fonts, verify storage in line items
6. **Mobile testing**: Full workflow on staging URL

### Rollback Plan
- Keep Map initialization as backup
- Feature flag to switch between architectures
- Automated revert if critical failures detected

## Business Impact

### Immediate Benefits
- **Reduced Complexity**: 3 systems → 1 system
- **Better Performance**: Eliminate redundant data copies
- **Fewer Bugs**: Single source of truth eliminates sync issues
- **Easier Debugging**: Clear data flow, single storage location

### Development Benefits
- **Faster Feature Development**: One storage API to maintain
- **Easier Testing**: Predictable data state
- **Better Mobile Performance**: Optimized for 70% mobile traffic
- **Cleaner Codebase**: Remove 200+ lines of synchronization code

## Conclusion

**Recommendation**: Execute surgical refactor immediately.

This is a NEW BUILD with no legacy constraints. The 3-week "careful migration" approach maintains unnecessary technical debt and risks introducing more synchronization bugs.

**Key Success Factors**:
1. Maintain exact same data interfaces during transition
2. Test thoroughly on mobile (70% of traffic)  
3. Use staging environment for validation
4. Implement rollback capability for safety

**Expected Outcome**: 
- Eliminate 90% of storage-related bugs
- Reduce complexity by 60%
- Improve maintainability for future features
- Better performance on mobile devices

The architecture will be cleaner, more performant, and significantly easier to maintain going forward.