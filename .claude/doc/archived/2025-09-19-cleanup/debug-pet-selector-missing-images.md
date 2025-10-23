# Debug Plan: Pet Selector Missing Processed Images

**Created**: 2025-01-16  
**Status**: Root Cause Identified  
**Risk Level**: LOW (Event name fix)  
**Impact**: HIGH (Affects 70% mobile users on product pages)

## Problem Summary

Pet processed images show correctly on the dedicated processing page but do NOT appear in the pet selector on product detail pages, despite all 4 effects processing successfully.

## Root Cause Analysis

### PRIMARY ROOT CAUSE: Event Name Mismatch

**Technical Details**:
- **Pet Processor V5** (pet-processor-v5-es5.js:378): Dispatches `petProcessorPrimaryComplete` event
- **Pet Selector** (ks-product-pet-selector.liquid:364): Listens for `petProcessorComplete` event  
- **Result**: Pet selector never receives notification to refresh after new processing

**Evidence**:
```javascript
// Pet Processor V5 - Line 378
var event = new CustomEvent('petProcessorPrimaryComplete', {
  detail: { sessionKey: self.currentSessionKey, effect: primaryEffect, fileName: self.currentFile.name }
});

// Pet Selector - Line 364  
document.addEventListener('petProcessorComplete', function(event) {
  console.log('New pet processed, refreshing selector...', event.detail);
  setTimeout(loadSavedPets, 500);
});
```

### SECONDARY ANALYSIS: Architecture Integration Points

**✅ WORKING CORRECTLY**:
1. **Data Storage**: Pet processor stores all 4 effects in `window.perkieEffects` Map
2. **Data Retrieval**: Pet selector reads from `window.perkieEffects` correctly
3. **Session Keys**: Compatible format between systems (`sessionKey_effectName`)
4. **UI Rendering**: Pet selector grid rendering logic is sound
5. **Image Display**: Base64 → Blob → URL conversion working properly

**❌ BROKEN INTEGRATION**:
1. **Event Communication**: Mismatched event names prevent refresh notifications
2. **Manual Refresh**: Pet selector only refreshes on page load, not after new processing

## Debugging Steps Performed

### Step 1: Console Log Analysis ✅
- **CSP Warnings**: Not related to pet selector functionality
- **JSON-LD Errors**: Not related to pet selector functionality  
- **No JavaScript Errors**: Pet selector initialization appears successful

### Step 2: Data Flow Investigation ✅
- **API Response**: All 4 effects returned successfully from InSPyReNet API
- **Frontend Processing**: All effects converted to blobs and stored in `window.perkieEffects`
- **Cache Access**: Pet selector successfully accesses `window.perkieEffects` Map
- **Event Dispatch**: Pet processor dispatches completion event with wrong name

### Step 3: Integration Point Analysis ✅
- **Storage Pattern**: `window.perkieEffects.set('sessionKey_effectName', blobUrl)`
- **Retrieval Pattern**: `window.perkieEffects.forEach()` to extract pets by session  
- **Event Pattern**: `document.addEventListener('petProcessorComplete')` vs `petProcessorPrimaryComplete`

## Solution Strategy

### Option 1: Fix Event Name (RECOMMENDED)
**Change**: Update pet processor to dispatch `petProcessorComplete` instead of `petProcessorPrimaryComplete`
- **Pros**: Simple one-line change, maintains backward compatibility with existing selectors
- **Cons**: None identified
- **Risk**: LOW - Single event name change

### Option 2: Update Event Listener  
**Change**: Update pet selector to listen for `petProcessorPrimaryComplete`  
- **Pros**: No changes to main processor logic
- **Cons**: Must update multiple pet selectors if they exist, breaks naming convention
- **Risk**: MEDIUM - May affect other integrations

### Option 3: Dual Event Support
**Change**: Dispatch both event names for compatibility
- **Pros**: Maximum compatibility
- **Cons**: Code bloat, confusing for future development
- **Risk**: LOW but unnecessary complexity

## Recommended Implementation

### File Changes Required
**Primary**: `assets/pet-processor-v5-es5.js`
- **Line 378**: Change `petProcessorPrimaryComplete` to `petProcessorComplete`
- **Expected Impact**: Pet selector will immediately start refreshing after new processing

**No Other Files Required**:
- Pet selector event listener already correct
- Data storage/retrieval patterns already compatible
- UI rendering logic already working

### Implementation Details

**Current Code (Line 378)**:
```javascript
var event = new CustomEvent('petProcessorPrimaryComplete', {
  detail: {
    sessionKey: self.currentSessionKey,
    effect: primaryEffect,
    fileName: self.currentFile.name
  }
});
```

**Fixed Code**:
```javascript
var event = new CustomEvent('petProcessorComplete', {
  detail: {
    sessionKey: self.currentSessionKey,
    effect: primaryEffect,
    fileName: self.currentFile.name
  }
});
```

## Expected Resolution

**After Fix**:
1. User processes pet image on dedicated page ✅ (already working)
2. Pet processor dispatches `petProcessorComplete` event ✅ (fixed)
3. Pet selector receives event and calls `loadSavedPets()` ✅ (already working)
4. Pet selector refreshes and shows new processed images ✅ (expected result)

**Success Criteria**:
- Processed images appear in product page pet selector without page refresh
- Console shows "New pet processed, refreshing selector..." message
- Pet selector grid displays newly processed pets immediately

## Risk Assessment

**VERY LOW RISK**:
- Single line change in established codebase
- Event name change has no side effects
- Easy rollback (change event name back)
- No API, database, or styling changes required

**Deployment Timing**: Can be deployed during business hours

## Common Shopify/E-commerce Patterns

This issue represents a classic **event-driven integration failure** common in e-commerce platforms:

1. **Cross-Component Communication**: Different UI components need to stay synchronized
2. **Client-Side Caching**: Multiple components sharing cached data but missing synchronization events
3. **Progressive Enhancement**: Features working in isolation but failing when integrated
4. **Mobile Commerce**: Critical for mobile users who navigate between processing and product pages

## Additional Debugging Commands

If the fix doesn't work, run these browser console commands on a product page:

```javascript
// Check if perkieEffects cache has data
console.log('Effects cache size:', window.perkieEffects?.size || 0);
console.log('Effects cache contents:', window.perkieEffects);

// Manually trigger pet selector refresh
if (window.petSelectorInstances) {
  Object.values(window.petSelectorInstances).forEach(instance => instance.refresh());
}

// Check event listeners
getEventListeners(document); // DevTools only
```

## Related Files Reference

- **Pet Processor**: `assets/pet-processor-v5-es5.js` - Main processing logic
- **Pet Selector**: `snippets/ks-product-pet-selector.liquid` - Product page integration  
- **Session Management**: `window.perkieEffects` Map - Global cache
- **Product Pages**: Include pet selector snippet when product has 'custom' tag

## Future Prevention

To prevent similar integration issues:

1. **Standardize Event Names**: Use consistent naming convention across components
2. **Event Documentation**: Document all inter-component events in a central location
3. **Integration Testing**: Test cross-component communication during development
4. **Error Monitoring**: Add console warnings when expected events aren't received

---

This analysis demonstrates that the core architecture is sound - it's simply a naming mismatch preventing proper event communication between well-designed components.