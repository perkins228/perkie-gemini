# Debug Implementation Plan: Pet Selector Persistence Issue

**Created**: 2025-08-16  
**Priority**: CRITICAL  
**Issue**: Processed pet images from pet-processor-v5-es5.js not appearing in product page pet selector

## Root Cause Analysis Summary

Based on comprehensive investigation of the pet processing → cart integration flow, the issue is **NOT** with event communication or data conversion (both working correctly), but appears to be a **session/storage persistence problem** during page navigation.

### Technical Architecture Analysis

**Current Data Flow** (✅ Working Components):
1. ✅ **Pet Processor**: Correctly processes images and stores as data URLs in `window.perkieEffects`
2. ✅ **Event Communication**: Properly dispatches `petProcessorComplete` event after all data URLs ready  
3. ✅ **Pet Selector**: Correctly listens for `petProcessorComplete` and calls `loadSavedPets()`
4. ✅ **Data Access**: Pet selector properly reads from `window.perkieEffects` cache
5. ✅ **URL Conversion**: Both systems handle data URLs correctly to avoid analytics issues

**Suspected Break Point** (❌ Issue Area):
- **Page Navigation**: `window.perkieEffects` cache may not persist during navigation from `/pages/pet-background-remover` to product pages
- **Browser Storage**: No permanent storage mechanism for `window.perkieEffects` across page loads
- **Session Management**: Pet data only stored in memory, lost during page transitions

## Primary Root Cause Hypothesis

**Issue**: `window.perkieEffects` is an in-memory Map that gets cleared when navigating between pages.

**Evidence Supporting This**:
- Pet processor on `/pages/pet-background-remover` stores data correctly
- User navigates to product page (new page load)
- `window.perkieEffects` is reinitialized as empty Map
- Pet selector finds no data and shows empty state
- **Console Evidence**: Pet selector shows "No effects in cache" when checking `window.perkieEffects.size`

**Previous Session Context Evidence**:
- Event name mismatch was already fixed (`petProcessorComplete` now used consistently)
- Data URL conversion was implemented to avoid Shopify analytics errors
- All technical components work independently - the integration failure is at page boundary

## Implementation Strategy

### Phase 1: Investigate Storage Persistence (CRITICAL)

**A. Browser Storage Detection**
```javascript
// Add to pet selector debugging
console.log('=== Pet Selector Debug ===');
console.log('window.perkieEffects exists:', !!window.perkieEffects);
console.log('window.perkieEffects size:', window.perkieEffects ? window.perkieEffects.size : 'N/A');
console.log('localStorage pet data keys:', Object.keys(localStorage).filter(k => k.includes('pet')));
console.log('sessionStorage pet data keys:', Object.keys(sessionStorage).filter(k => k.includes('pet')));
```

**B. Cross-Page Persistence Check**
```javascript
// Verify if data survives page navigation
window.addEventListener('beforeunload', function() {
  console.log('Page unloading - perkieEffects size:', window.perkieEffects.size);
  if (window.perkieEffects.size > 0) {
    console.log('Pet data exists before navigation:', Array.from(window.perkieEffects.keys()));
  }
});
```

### Phase 2: Implement Permanent Storage (if Phase 1 confirms hypothesis)

**A. Enhanced localStorage Persistence**
- Modify pet processor to save data URLs to localStorage with structured keys
- Add pet selector auto-restore from localStorage on page load
- Implement cache sync between `window.perkieEffects` and localStorage

**B. Session Key Management**
- Ensure session keys persist across pages via localStorage
- Add timestamp-based cleanup for old pet sessions
- Maintain backward compatibility with existing session format

### Phase 3: Cart Integration Verification

**A. Product Form Integration**
- Verify selected pet data gets injected into product form as cart properties
- Ensure cart properties survive add-to-cart process
- Test complete flow: process → select → add to cart → verify in cart

**B. Event Coordination**
- Verify `petSelected` event triggers proper cart property injection
- Test with actual cart API calls in staging environment

## Files Requiring Changes

### Primary Implementation Files
1. **`assets/pet-processor-v5-es5.js`** - Add localStorage persistence after processing
2. **`snippets/ks-product-pet-selector.liquid`** - Add localStorage restore and debug logging
3. **Product form integration** - Ensure cart properties injection (TBD based on Phase 1 findings)

### Debug/Testing Files
1. **Browser console debug commands** - Immediate investigation tools
2. **Test page navigation flow** - Manual verification of persistence

## Debug Investigation Steps

### Step 1: Immediate Console Investigation
Run these commands on product page with pet selector:

```javascript
// Check current state
console.log('Current perkieEffects state:');
console.log('  Size:', window.perkieEffects ? window.perkieEffects.size : 'undefined');
console.log('  Keys:', window.perkieEffects ? Array.from(window.perkieEffects.keys()) : 'undefined');

// Check localStorage for pet data
console.log('localStorage pet data:');
Object.keys(localStorage).filter(k => k.includes('pet')).forEach(key => {
  console.log(`  ${key}:`, localStorage.getItem(key));
});

// Force trigger pet selector refresh
console.log('Attempting manual pet selector refresh...');
if (typeof loadSavedPets === 'function') {
  loadSavedPets();
} else {
  console.log('loadSavedPets function not available');
}
```

### Step 2: Cross-Page Navigation Test
1. Process pet image on `/pages/pet-background-remover`
2. Before navigating, run: `console.log('Pre-nav data:', Array.from(window.perkieEffects.keys()))`
3. Navigate to product page
4. Immediately run: `console.log('Post-nav data:', window.perkieEffects ? window.perkieEffects.size : 'undefined')`

### Step 3: Storage Mechanism Investigation
```javascript
// Check if pet-processor-v5-es5.js saves to localStorage
console.log('Checking pet processor localStorage usage:');
console.log('pet_session keys:', Object.keys(localStorage).filter(k => k.startsWith('pet_session')));
console.log('petProcessor keys:', Object.keys(localStorage).filter(k => k.includes('petProcessor')));

// Look for any automatic persistence mechanisms
console.log('All storage keys with pet/effect data:', 
  [...Object.keys(localStorage), ...Object.keys(sessionStorage)]
  .filter(k => k.toLowerCase().includes('pet') || k.toLowerCase().includes('effect'))
);
```

## Expected Outcomes

### If Storage Persistence Issue Confirmed:
- Implement enhanced localStorage sync in pet processor
- Add pet selector auto-restore functionality  
- Zero "Failed to construct 'URL'" errors from Shopify analytics
- Product page pet selector shows previously processed images

### If Different Root Cause:
- Investigate cart property injection mechanism
- Check Shopify theme's product form integration patterns
- Verify pet selector → cart workflow with actual add-to-cart operations

## Risk Assessment

**LOW RISK** - Investigation only, no code changes until root cause confirmed
- Debug commands are read-only and safe to run
- Storage investigation won't modify existing functionality  
- Can identify exact issue before implementing fixes

**MEDIUM RISK** - Storage persistence implementation
- localStorage changes affect cross-page behavior
- Must maintain backward compatibility with existing sessions
- Requires thorough testing of navigation patterns

## Success Criteria

1. **Root Cause Identified**: Clear understanding of where pet data is lost
2. **Storage Mechanism**: Pet images persist across page navigation  
3. **Pet Selector Functional**: Processed images appear on product pages
4. **Cart Integration**: Selected pets successfully added to cart with proper metadata
5. **Zero Regressions**: Existing pet processor functionality unchanged

## Next Steps

1. **Immediate**: Run browser console investigation on product page
2. **Phase 1**: Implement debug logging and storage detection
3. **Phase 2**: Based on findings, implement appropriate persistence solution
4. **Testing**: Verify complete user flow from processing to cart
5. **Documentation**: Update session context with final solution

The investigation will definitively identify whether this is a storage persistence issue or a deeper integration problem, enabling targeted resolution without over-engineering.