# Pet Removal Functionality Refactoring Plan - Perkie Prints

**Session ID**: 002  
**Date**: 2025-01-24  
**Context**: Refactoring pet removal functionality to fix critical storage cleanup issues  

## Executive Summary

The current `deletePet` function in `snippets/ks-product-pet-selector.liquid` (lines 1555-1749) has critical gaps that lead to memory leaks, orphaned data, and race conditions. This plan addresses these issues with a comprehensive refactored implementation that ensures atomic deletion across all storage systems.

## Critical Issues Identified

### 1. Memory Leak: Missing Blob URL Revocation
**Current Problem**: Blob URLs are never revoked before deletion from `window.perkieEffects`, causing memory buildup.
**Impact**: Progressive memory consumption over multiple pet processing sessions.

### 2. Incomplete perkieEffects_selected Cleanup  
**Current Problem**: Only individual effect keys are removed, but the main `perkieEffects_selected` object structure remains.
**Impact**: Orphaned entries accumulate in localStorage unified storage.

### 3. sessionStorage Never Cleaned
**Current Problem**: PetStorage class data with `perkie_pet_` prefix is never removed.
**Impact**: sessionStorage accumulates indefinitely, potential quota issues.

### 4. Race Conditions with Recovery System
**Current Problem**: Pet recovery can interfere with deletion process due to timing issues.
**Impact**: Pets can reappear after deletion or cause inconsistent state.

## Refactoring Approach

### Phase 1: Enhanced Blob URL Management
- Add blob URL revocation before Map deletion
- Implement proper resource cleanup verification
- Add fallback cleanup for missed blob URLs

### Phase 2: Complete Storage Synchronization
- Fix `perkieEffects_selected` object cleanup
- Add sessionStorage cleanup for `perkie_pet_` entries
- Implement atomic deletion with rollback capability

### Phase 3: Race Condition Prevention
- Strengthen deletion tracking with timestamps
- Add recovery system locks during active deletion
- Implement cleanup verification with retries

### Phase 4: Error Handling & Validation
- Add comprehensive error handling for each cleanup step
- Implement storage validation after deletion
- Add debugging utilities for troubleshooting

## Implementation Plan

### File Changes Required

#### 1. snippets/ks-product-pet-selector.liquid
**Lines to refactor**: 1555-1749 (complete `deletePet` function)
**Changes**:
- Replace entire function with refactored implementation
- Add blob URL revocation before Map deletion
- Fix perkieEffects_selected cleanup logic
- Add sessionStorage cleanup methods
- Strengthen race condition prevention
- Add comprehensive error handling and validation

#### 2. Supporting Methods (if needed)
**New utility functions** to be added within the same liquid file:
- `revokeAllBlobUrls(sessionKey)` - Clean blob URL memory
- `cleanSessionStorage(sessionKey)` - Remove PetStorage entries
- `validateDeletionComplete(sessionKey)` - Verify all storage cleaned
- `emergencyCleanup(sessionKey)` - Fallback cleanup method

### Key Refactoring Principles

#### 1. Atomic Deletion Pattern
Implement deletion as atomic operation that either completely succeeds or fails safely:
```
1. Lock deletion process (prevent recovery interference)
2. Collect all data to be deleted
3. Revoke blob URLs 
4. Delete from all storage systems
5. Validate deletion success
6. Update UI
7. Unlock deletion process
```

#### 2. Comprehensive Storage Coverage
Address all 6 storage systems in proper sequence:
1. Blob URL revocation (memory cleanup)
2. window.perkieEffects Map (in-memory cache) 
3. localStorage individual keys (pet_123_effect format)
4. localStorage perkieEffects_selected (unified storage)
5. localStorage session lists (pet_session_* arrays)
6. sessionStorage PetStorage entries (perkie_pet_ prefix)

#### 3. Error Recovery & Validation
Each deletion step includes:
- Error handling with specific recovery actions
- Validation to ensure step completed successfully  
- Fallback methods for failed cleanup attempts
- Comprehensive logging for debugging

#### 4. Race Condition Prevention
Strengthen deletion tracking:
- Use timestamps to detect stale deletion processes
- Add recovery system locks during active deletion
- Implement cleanup verification with retry logic
- Clear deletion locks only after complete success

## Refactored Implementation Structure

### Core Function Signature
```javascript
window.deletePet = function(sessionKey) {
  // 1. Pre-deletion validation and locking
  // 2. Blob URL revocation 
  // 3. Map deletion with verification
  // 4. localStorage cleanup (all formats)
  // 5. sessionStorage cleanup
  // 6. Session list updates
  // 7. Deletion tracking updates
  // 8. UI updates with animation
  // 9. Final validation and unlock
}
```

### Supporting Utility Functions
```javascript
function revokeAllBlobUrls(sessionKey) { /* Memory cleanup */ }
function cleanSessionStorage(sessionKey) { /* PetStorage cleanup */ }  
function cleanPerkieEffectsSelected(sessionKey) { /* Unified storage cleanup */ }
function validateDeletionComplete(sessionKey) { /* Verification */ }
function emergencyCleanup(sessionKey) { /* Fallback cleanup */ }
```

## Testing Strategy

### Validation Commands
Storage verification commands for console testing:
```javascript
// Memory check
console.log('Blob URLs remaining:', 
  Array.from(window.perkieEffects.values()).filter(v => 
    typeof v === 'string' && v.startsWith('blob:')).length);

// Storage completeness check  
console.log('localStorage pet keys:', 
  Object.keys(localStorage).filter(k => k.includes(sessionKey)).length);

console.log('sessionStorage perkie keys:', 
  Object.keys(sessionStorage).filter(k => k.startsWith('perkie_pet_')).length);

// Unified storage check
const selected = JSON.parse(localStorage.getItem('perkieEffects_selected') || '{}');
console.log('Selected storage pet entries:', Object.keys(selected).length);
```

### Test Scenarios  
1. **Single Pet Deletion**: Basic deletion with storage validation
2. **Multi-Pet Stress Test**: Multiple deletions with timing variations
3. **Memory Leak Detection**: 10+ deletions with memory monitoring
4. **Race Condition Testing**: Deletion during recovery system activity

## Risk Assessment & Mitigation

### LOW RISK - Backward Compatibility
- Maintains exact same function interface
- All existing calling code works unchanged
- Same UI/UX experience for users

### MEDIUM RISK - Storage Complexity
- More comprehensive cleanup requires careful coordination
- Mitigation: Extensive validation and fallback methods

### LOW RISK - Performance Impact  
- Additional cleanup steps add ~50-100ms to deletion
- Mitigation: User sees same loading animation, performance difference imperceptible

## Implementation Timeline

### Phase 1 (2-3 hours): Core Refactoring
- Implement refactored deletePet function
- Add blob URL revocation
- Fix storage cleanup gaps
- Add basic validation

### Phase 2 (1-2 hours): Testing & Validation  
- Implement comprehensive test scenarios
- Add debugging utilities
- Verify memory leak fixes

### Phase 3 (1 hour): Documentation & Polish
- Add code comments for maintainability
- Document new debugging methods
- Update testing procedures

**Total Estimated Time**: 4-6 hours

## Success Criteria

1. **✅ Zero Memory Leaks**: No blob URLs remain after deletion
2. **✅ Complete Storage Cleanup**: All 6 storage systems properly cleaned  
3. **✅ No Race Conditions**: Deletion completes atomically without interference
4. **✅ Backward Compatible**: No changes to existing calling code required
5. **✅ Robust Error Handling**: Graceful handling of edge cases and failures

## Files to Modify

### Primary File
- `snippets/ks-product-pet-selector.liquid` (lines 1555-1749)
  - Complete refactor of deletePet function
  - Add supporting utility functions
  - Enhance error handling and validation

### Supporting Documentation
- Update `.claude/tasks/context_session_002.md` with implementation results
- Add debugging guide for troubleshooting deletion issues

This refactoring maintains full backward compatibility while addressing all identified critical issues, ensuring robust, leak-free pet removal functionality that properly cleans all storage systems and prevents race conditions.