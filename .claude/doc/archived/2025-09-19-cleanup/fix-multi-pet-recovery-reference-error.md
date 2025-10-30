# Fix Multi-Pet Recovery JavaScript ReferenceError

## Problem Summary
Critical JavaScript `ReferenceError: storageKey is not defined` breaking the multi-pet session data recovery logic in the pet selector component.

## Root Cause Analysis
**Variable Scoping Issue**: The `storageKey` variable is declared inside a `for` loop but referenced outside its scope in the fallback recovery logic.

### Exact Location
- **File**: `snippets/ks-product-pet-selector.liquid`
- **Function**: `extractPetDataFromCache` within recovery logic
- **Lines**: 996 (declaration) and 1014 (invalid reference)

### Technical Details
```javascript
// Current broken code structure:
for (let j = 0; j < localStorage.length; j++) {
  const storageKey = localStorage.key(j);  // storageKey scoped to loop
  // ... direct storage recovery logic
}

// Check for new backup format (pet_effect_backup_*)
if (storageKey && storageKey.startsWith('pet_effect_backup_' + sessionKey + '_')) {  // ERROR: storageKey undefined
  // ... backup recovery logic
}
```

## Implementation Plan

### Step 1: Fix Variable Scoping
**File to modify**: `snippets/ks-product-pet-selector.liquid`

**Change Required**: Move the backup format check (lines 1013-1026) inside the existing `for` loop where `storageKey` is properly scoped.

**Exact modification**:
1. Remove lines 1013-1026 (the misplaced backup check)
2. Insert the backup format check logic inside the existing `for` loop (after line 1011, before the closing brace)

### Step 2: Code Structure After Fix
```javascript
for (let j = 0; j < localStorage.length; j++) {
  const storageKey = localStorage.key(j);
  
  // Check for direct storage
  if (storageKey && storageKey.startsWith(sessionKey + '_')) {
    // ... existing direct storage logic
  }
  
  // Check for new backup format (pet_effect_backup_*)  
  if (storageKey && storageKey.startsWith('pet_effect_backup_' + sessionKey + '_')) {
    try {
      const backupData = JSON.parse(localStorage.getItem(storageKey));
      if (backupData && backupData.dataUrl) {
        const effectKey = storageKey.replace('pet_effect_backup_', '');
        window.perkieEffects.set(effectKey, backupData.dataUrl);
        console.log('✅ Recovered from backup:', effectKey);
        hasEffects = true;
      }
    } catch (e) {
      console.log('Failed to recover from backup:', storageKey, e);
    }
  }
}
```

### Step 3: Testing Strategy
1. **Verify Fix**: Check browser console for ReferenceError elimination
2. **Test Recovery**: Ensure backup pet effects are properly restored
3. **Test Fallback Logic**: Verify both direct storage and backup format recovery work
4. **Cross-browser Testing**: Test in mobile Safari, Chrome, and Firefox

### Step 4: Validation Checklist
- [ ] ReferenceError no longer appears in console
- [ ] Multi-pet session data recovers correctly from localStorage
- [ ] Backup recovery logic functions properly
- [ ] No regression in existing pet selection functionality
- [ ] Pet selector displays correctly after page reload

## Critical Notes

### Business Impact
- **High Priority**: This error completely breaks multi-pet recovery for returning users
- **User Experience**: Users lose their processed pets when navigating between pages
- **Conversion Impact**: Broken functionality may force users to reprocess pets, increasing abandonment

### Technical Considerations
- **ES5 Compatibility**: Maintain current ES5-compatible structure
- **Error Handling**: Preserve existing try-catch blocks for robust error recovery
- **Performance**: No performance impact - just moving code to correct scope
- **Backwards Compatibility**: Fix maintains all existing backup formats

### Implementation Assumptions
1. The backup format logic was accidentally moved outside the loop during recent recovery enhancements
2. Both direct storage (`sessionKey_effect`) and backup format (`pet_effect_backup_sessionKey_effect`) should be checked in the same loop iteration
3. Current error handling and logging structure should be preserved

## Risk Assessment
- **Risk Level**: Low (simple scoping fix)
- **Regression Risk**: Minimal (moving existing logic to proper scope)
- **Testing Required**: Browser console verification and multi-pet session testing

## Estimated Timeline
- **Implementation**: 5 minutes (single line move)
- **Testing**: 15 minutes (console + functionality verification)
- **Total**: 20 minutes

## Success Criteria
1. JavaScript ReferenceError eliminated from browser console
2. Multi-pet recovery functions correctly after page navigation
3. No breaking changes to existing pet selection workflow
4. All backup recovery formats continue to work

## Next Steps
After implementing this fix:
1. Monitor browser console for any remaining JavaScript errors
2. Test complete pet selection workflow on mobile and desktop
3. Verify localStorage backup mechanisms are functioning properly