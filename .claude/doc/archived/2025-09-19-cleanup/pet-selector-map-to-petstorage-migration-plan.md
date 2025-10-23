# Pet Selector Migration: window.perkieEffects Map to PetStorage

## Business Objective
Complete the migration from the volatile window.perkieEffects Map to the persistent PetStorage system, eliminating data loss issues and simplifying the architecture for this NEW BUILD with no legacy users.

## Current State Analysis

### Root Cause
We partially migrated to PetStorage but didn't complete the pet selector updates:
- Removed Map sync in pet-processor.js (`syncToLegacyStorage()` commented out)
- Pet selector still has 26+ direct references to window.perkieEffects Map
- Temporarily re-enabled Map sync as a band-aid fix
- PetStorage already has Map-compatible methods ready to use

### window.perkieEffects Usage in Pet Selector
1. **Line 826**: `forEach` to iterate all effects
2. **Line 858**: `set()` to add data during restore
3. **Line 1393, 1438, 1525, 1581**: `forEach` for various iterations
4. **Line 1541, 1677**: `get()` to retrieve metadata and effect data
5. **Line 1957**: `delete()` to remove entries
6. **Line 2373**: `forEach` to get all effects for display
7. **Multiple other references**: Initialization, checks, cleanup

### PetStorage Map-Compatible Methods (Already Implemented)
- `forEachEffect(callback)` - Replaces Map.forEach()
- `getMetadata(sessionKey)` - Replaces Map.get() for metadata
- `getEffectUrl(sessionKey, effect)` - Get specific effect URL
- `getAllForDisplay()` - Returns array for renderPets()
- Standard CRUD: save(), get(), getAll(), delete()

## Technical Requirements

### Phase 1: Replace Read Operations (Low Risk)
**Priority: HIGH | Risk: LOW | Time: 2 hours**

1. **Replace iteration patterns** (lines 826, 1393, 1438, 1525, 1581, 2373):
   ```javascript
   // OLD: window.perkieEffects.forEach((url, key) => {...})
   // NEW: PetStorage.forEachEffect((url, key) => {...})
   ```

2. **Replace get operations** (lines 1541, 1677):
   ```javascript
   // OLD: window.perkieEffects.get(metadataKey)
   // NEW: PetStorage.getMetadata(sessionKey)
   
   // OLD: window.perkieEffects.get(effectKey)
   // NEW: PetStorage.getEffectUrl(sessionKey, effectType)
   ```

3. **Replace existence checks** (lines 825, 987, 1048):
   ```javascript
   // OLD: if (window.perkieEffects && window.perkieEffects.size > 0)
   // NEW: if (Object.keys(PetStorage.getAll()).length > 0)
   ```

### Phase 2: Replace Write Operations (Medium Risk)
**Priority: HIGH | Risk: MEDIUM | Time: 2 hours**

1. **Replace set operations** (line 858, 1462, 1486, 1501):
   ```javascript
   // OLD: window.perkieEffects.set(key, data)
   // NEW: Extract sessionKey and effect, then:
   //      PetStorage.save(sessionKey, {effect: effectType, thumbnail: data})
   ```

2. **Replace delete operations** (line 1957):
   ```javascript
   // OLD: window.perkieEffects.delete(key)
   // NEW: PetStorage.delete(sessionKey)
   ```

### Phase 3: Update Helper Functions (Low Risk)
**Priority: MEDIUM | Risk: LOW | Time: 1 hour**

1. **Update saveEffectsToLocalStorage()** (line 835):
   - Remove function entirely (PetStorage auto-saves)

2. **Update restoreEffectsFromLocalStorage()** (line 844):
   - Replace with PetStorage.getAll() calls

3. **Update loadSavedPets()** (already partially done):
   - Use PetStorage.getAllForDisplay() exclusively

### Phase 4: Remove Map Dependencies (Final Cleanup)
**Priority: LOW | Risk: LOW | Time: 30 minutes**

1. **Remove Map initialization** (lines 846-847):
   ```javascript
   // DELETE: if (!window.perkieEffects) { window.perkieEffects = new Map(); }
   ```

2. **Remove syncToLegacyStorage() calls** in pet-processor.js:
   - Permanently remove the temporary band-aid

3. **Clean up obsolete functions**:
   - Remove saveEffectsToLocalStorage()
   - Remove restoreEffectsFromLocalStorage()

## Implementation Plan

### Day 1 (4 hours)
**Morning (2 hours):**
- [ ] Create feature branch from staging
- [ ] Implement Phase 1: Replace all read operations
- [ ] Test pet display functionality
- [ ] Verify pets load correctly from PetStorage

**Afternoon (2 hours):**
- [ ] Implement Phase 2: Replace write operations
- [ ] Test adding new pets
- [ ] Test deleting pets
- [ ] Verify persistence across page refreshes

### Day 2 (2 hours)
**Morning (1.5 hours):**
- [ ] Implement Phase 3: Update helper functions
- [ ] Implement Phase 4: Remove Map dependencies
- [ ] Remove syncToLegacyStorage from pet-processor.js

**Testing (30 minutes):**
- [ ] Complete end-to-end testing
- [ ] Deploy to staging
- [ ] Run Playwright tests

## Risk Assessment

### Low Risk Changes (70% of work)
- Read operations: Direct method replacement
- Helper function updates: Simplification
- Map removal: Cleanup only

### Medium Risk Changes (30% of work)
- Write operations: Need data transformation
- Key parsing: Extract sessionKey from compound keys
- Effect type handling: Ensure correct storage

### Mitigation Strategies
1. **Incremental Rollout**: Test each phase before proceeding
2. **Fallback Ready**: Keep syncToLegacyStorage commented but available
3. **Debug Logging**: Add console logs during migration
4. **Staging First**: Full testing on staging before production

## Testing Requirements

### Unit Testing (Per Phase)
1. Load existing pets
2. Add new pet
3. Select different effects
4. Delete pet
5. Page refresh persistence
6. Multiple pets handling

### Integration Testing
1. Complete pet processing flow
2. Add to cart with pet data
3. View cart with pet thumbnails
4. Font selection with pets
5. Cross-page navigation

### Regression Testing
- Upload section visibility
- Pet selector functionality
- Cart integration
- Order data capture

## Rollback Plan

### Quick Rollback (< 5 minutes)
If critical issues found:
1. Re-enable syncToLegacyStorage() in pet-processor.js
2. Deploy hotfix to staging
3. Investigate and fix issues

### Full Rollback (< 30 minutes)
If systematic failures:
1. Revert entire commit
2. Deploy previous version
3. Restore Map-based implementation

## Success Metrics

### Technical Success
- Zero Map references in pet selector
- All pets persist correctly
- No data loss during transition
- Upload section remains functional

### Business Success
- No user-facing disruptions
- Improved performance (no Map sync overhead)
- Reduced memory usage
- Simplified debugging

## Technical Considerations

### ES5 Compatibility
- All PetStorage methods are ES5 compatible
- No arrow functions or modern JS features
- Works on all mobile browsers (70% traffic)

### Performance Impact
- **Positive**: Eliminates Map synchronization overhead
- **Positive**: Direct localStorage reads (faster)
- **Positive**: Reduced memory footprint
- **Neutral**: Same number of localStorage operations

### Storage Architecture
- Single source of truth: localStorage via PetStorage
- No volatile memory structures
- Automatic persistence
- Emergency cleanup for quota management

## Estimated Timeline

### Total Time: 6.5 hours
- Phase 1: 2 hours (low risk, high impact)
- Phase 2: 2 hours (medium risk, critical)
- Phase 3: 1 hour (low risk, cleanup)
- Phase 4: 30 minutes (low risk, final cleanup)
- Testing: 1 hour (comprehensive validation)

### Recommended Schedule
- **Day 1**: Phases 1-2 (4 hours)
- **Day 2**: Phases 3-4 + Testing (2.5 hours)

## Next Steps

1. **Immediate**: Review this plan with team
2. **Today**: Begin Phase 1 implementation
3. **Tomorrow**: Complete migration and test
4. **This Week**: Deploy to production

## Notes for Collaborators

### Critical Context
- This is a NEW BUILD - no legacy users to migrate
- We can make breaking changes if needed
- PetStorage is already production-ready with Map-compatible methods
- The Map sync is a temporary band-aid that must be removed

### Key Files
- `snippets/ks-product-pet-selector.liquid` - Main migration target
- `assets/pet-storage.js` - Already has all needed methods
- `assets/pet-processor.js` - Remove syncToLegacyStorage()

### Testing URLs
- Staging: Request current URL from user
- Use Playwright MCP for automated testing
- Test mobile experience (70% of traffic)

## Conclusion

This migration completes the storage architecture cleanup started earlier. By fully transitioning to PetStorage, we eliminate:
- Data volatility issues
- Synchronization complexity
- Memory overhead
- Debugging difficulties

The implementation is straightforward since PetStorage already provides Map-compatible methods. The main work is systematic replacement of references, which can be done safely in phases with minimal risk.