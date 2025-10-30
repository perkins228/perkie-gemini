# Pet Processor Session Debugging Implementation Plan

## Root Cause Analysis

### Issue 1: Session Persistence - Only 1 Pet Shows Despite 2 Being Processed

**Root Cause**: The `processAnotherPet()` method in `assets/pet-processor-v5-es5.js` has a logic flaw where it only adds the current pet to `processedPets` array if it's not already there, but the session is saved BEFORE the pet name is properly captured and stored.

**Specific Problems**:
1. Line 1787: `if (this.currentSessionKey && this.processedPets.indexOf(this.currentSessionKey) === -1)` - This check prevents duplicate entries but the timing is wrong
2. Line 1791-1794: Pet name capture happens AFTER the session key check, but if the pet is already in the array, the name won't be updated
3. Line 1806: `saveSession()` is called before all pet data is properly consolidated

**Evidence**: Console shows "1 pets" loaded despite 2 pets (Buddy and Sam) being processed, indicating the `processedPets` array is not properly maintained.

### Issue 2: Delete Function Not Working - Confirmation Shows But Pet Remains

**Root Cause**: The `deletePet` function in `snippets/ks-product-pet-selector.liquid` successfully removes data from storage but fails to refresh the UI properly due to scope and timing issues.

**Specific Problems**:
1. Line 1134: `loadSavedPets()` is called to re-render, but this function might not have access to the updated data immediately
2. The function modifies localStorage and perkieEffects but doesn't ensure the pet selector component refreshes with the new data
3. Potential race condition between data deletion and UI refresh

## Implementation Plan

### Fix 1: Session Persistence Enhancement

**File**: `assets/pet-processor-v5-es5.js`

**Changes to `processAnotherPet()` method (starting at line 1785)**:

1. **Reorganize pet data collection logic**:
   - Move pet name capture to happen BEFORE the processedPets array check
   - Ensure proper order of operations for data consolidation

2. **Add validation for pet data completeness**:
   - Verify that all required pet data (sessionKey, name, effects) are properly stored
   - Add fallback mechanisms for missing data

3. **Improve saveSession timing**:
   - Ensure session is saved only after all pet data is properly consolidated
   - Add debug logging to track pet array state

**Code Changes**:
```javascript
PetProcessorV5.prototype.processAnotherPet = function() {
  // CRITICAL FIX: Get pet name FIRST before any array operations
  var petName = this.getPetName();
  
  // Store current pet in the array if not already stored
  if (this.currentSessionKey) {
    var existingIndex = this.processedPets.indexOf(this.currentSessionKey);
    
    if (existingIndex === -1) {
      // New pet - add to array
      this.processedPets.push(this.currentSessionKey);
    }
    
    // ALWAYS update pet name (in case it was changed)
    if (petName) {
      this.petNames[this.currentSessionKey] = petName;
    }
    
    // Validate effect storage for current pet
    this.validateAndFixEffectStorage(this.currentSessionKey);
  }
  
  // Debug logging to track state
  console.log('processAnotherPet: processedPets count:', this.processedPets.length);
  console.log('processAnotherPet: petNames:', Object.keys(this.petNames).length);
  
  // Increment pet index for next pet
  this.currentPetIndex = this.processedPets.length;
  
  // Save multi-pet session data AFTER all data is consolidated
  this.saveSession();
  
  // Reset for new pet while keeping multi-pet data
  this.currentFile = null;
  this.currentSessionKey = null;
  this.currentEffect = 'enhancedblackwhite';
  this.artistNotes = '';
  this.isProcessing = false;
  this.effectLoadingState = null;
  
  // Show upload area again
  this.container.querySelector('.upload-area').classList.remove('hidden');
  this.container.querySelector('.processing-area').classList.add('hidden');
  this.container.querySelector('.preview-area').classList.add('hidden');
  
  // Re-render to update "Process Another Pet" button visibility
  this.render();
  this.bindEvents();
};
```

4. **Enhance saveSession method**:
   - Add validation to ensure data integrity before saving
   - Include debug information for troubleshooting

**Code Changes to `saveSession()` method (starting at line 1443)**:
```javascript
PetProcessorV5.prototype.saveSession = function() {
  // Validate data before saving
  var validatedPetNames = {};
  this.processedPets.forEach(function(sessionKey) {
    if (this.petNames[sessionKey]) {
      validatedPetNames[sessionKey] = this.petNames[sessionKey];
    }
  }.bind(this));
  
  var sessionData = {
    sessionId: this.sessionId,
    currentEffect: this.currentEffect,
    currentSessionKey: this.currentSessionKey,
    artistNotes: this.artistNotes,
    timestamp: Date.now(),
    // Multi-pet data with validation
    processedPets: this.processedPets.slice(), // Create copy to avoid reference issues
    currentPetIndex: this.currentPetIndex,
    petNames: validatedPetNames
  };
  
  // Debug logging
  console.log('saveSession: Saving', sessionData.processedPets.length, 'pets');
  console.log('saveSession: Pet names count:', Object.keys(sessionData.petNames).length);
  
  localStorage.setItem('pet_session_' + this.sectionId, JSON.stringify(sessionData));
};
```

### Fix 2: Delete Function Enhancement

**File**: `snippets/ks-product-pet-selector.liquid`

**Changes to `deletePet()` function (starting at line 1020)**:

1. **Add immediate UI feedback**:
   - Show loading state during deletion
   - Provide user feedback for the operation

2. **Improve data cleanup and UI refresh**:
   - Ensure proper cleanup order
   - Add forced refresh mechanism
   - Include error handling and recovery

**Code Changes**:
```javascript
// Delete a pet from the collection
window.deletePet = function(sessionKey) {
  if (confirm('Remove this pet from your collection?')) {
    console.log('Deleting pet with sessionKey:', sessionKey);
    
    // Show loading state
    var deleteButton = document.querySelector(`[data-delete-key="${sessionKey}"]`);
    if (deleteButton) {
      deleteButton.disabled = true;
      deleteButton.innerHTML = '⏳';
    }
    
    try {
      // 1. Remove from perkieEffects Map
      const keysToDelete = [];
      window.perkieEffects.forEach((value, key) => {
        if (key.startsWith(sessionKey + '_') || key === sessionKey) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => {
        window.perkieEffects.delete(key);
        console.log('Removed from perkieEffects:', key);
      });
      
      // 2. Remove from localStorage - delete all keys related to this pet
      const localStorageKeysToDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(sessionKey + '_') || key === sessionKey)) {
          localStorageKeysToDelete.push(key);
        }
      }
      
      localStorageKeysToDelete.forEach(key => {
        localStorage.removeItem(key);
        console.log('Removed from localStorage:', key);
      });
      
      // 3. Update ALL session data in localStorage
      let sessionsUpdated = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('pet_session_')) {
          try {
            const sessionData = localStorage.getItem(key);
            if (sessionData) {
              const parsed = JSON.parse(sessionData);
              let updated = false;
              
              // Remove from processedPets array
              if (parsed.processedPets) {
                const index = parsed.processedPets.indexOf(sessionKey);
                if (index > -1) {
                  parsed.processedPets.splice(index, 1);
                  updated = true;
                  console.log('Removed from processedPets in:', key);
                }
              }
              
              // Remove from petNames object
              if (parsed.petNames && parsed.petNames[sessionKey]) {
                delete parsed.petNames[sessionKey];
                updated = true;
                console.log('Removed from petNames in:', key);
              }
              
              if (updated) {
                localStorage.setItem(key, JSON.stringify(parsed));
                sessionsUpdated++;
              }
            }
          } catch (e) {
            console.error('Error updating session:', key, e);
          }
        }
      }
      
      console.log('Updated', sessionsUpdated, 'session files');
      
      // 4. Clean up backup data
      ['perkieEffects_backup', 'perkieThumbnails_backup'].forEach(backupKey => {
        try {
          const backup = localStorage.getItem(backupKey);
          if (backup) {
            const backupData = JSON.parse(backup);
            const updated = {};
            
            Object.keys(backupData).forEach(key => {
              if (!key.startsWith(sessionKey + '_') && key !== sessionKey) {
                updated[key] = backupData[key];
              }
            });
            
            if (Object.keys(updated).length > 0) {
              localStorage.setItem(backupKey, JSON.stringify(updated));
            } else {
              localStorage.removeItem(backupKey);
            }
            console.log('Updated backup:', backupKey);
          }
        } catch (e) {
          console.error('Error updating backup:', backupKey, e);
        }
      });
      
      console.log('Pet deletion completed successfully');
      
      // 5. Force UI refresh with delay to ensure data is settled
      setTimeout(() => {
        console.log('Refreshing pet selector UI...');
        
        // Clear the current display
        const petSelectorElement = document.getElementById(`ks-pet-selector-${sectionId}`);
        if (petSelectorElement) {
          petSelectorElement.innerHTML = '<div style="text-align: center; padding: 20px;">Refreshing...</div>';
        }
        
        // Force reload of saved pets
        setTimeout(() => {
          loadSavedPets();
          console.log('Pet selector UI refreshed');
        }, 100);
      }, 200);
      
    } catch (error) {
      console.error('Error during pet deletion:', error);
      alert('There was an error removing the pet. Please try again.');
      
      // Restore delete button on error
      if (deleteButton) {
        deleteButton.disabled = false;
        deleteButton.innerHTML = '×';
      }
    }
  }
};
```

3. **Enhance loadSavedPets function**:
   - Add data validation before rendering
   - Include fallback for empty states
   - Add debug logging for troubleshooting

**Additional changes to `loadSavedPets()` function**:
```javascript
// Add at the beginning of loadSavedPets function
console.log('loadSavedPets: Starting to load pets...');
console.log('loadSavedPets: perkieEffects size:', window.perkieEffects.size);

// Add data validation check before processing
if (!window.perkieEffects || window.perkieEffects.size === 0) {
  console.log('loadSavedPets: No pet effects data available');
  document.getElementById(`ks-pet-selector-${sectionId}`).innerHTML = 
    '<div style="text-align: center; padding: 20px; color: #666;">No pets available. Please process some pets first.</div>';
  return;
}
```

### Fix 3: Additional Debugging Enhancements

**File**: Both files

1. **Add comprehensive logging**:
   - Track pet count at key operations
   - Log data state changes
   - Include error recovery mechanisms

2. **Add emergency cleanup function**:
   - Provide manual reset capability
   - Clear all pet data and restart

**Emergency cleanup function to add to `assets/pet-processor-v5-es5.js`**:
```javascript
// Emergency cleanup function for debugging
window.emergencyResetPetProcessor = function() {
  if (confirm('This will clear ALL pet data and reset the processor. Continue?')) {
    // Clear all pet-related localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('pet_') || key.includes('perkie') || key.includes('Perkie'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear perkieEffects
    if (window.perkieEffects) {
      window.perkieEffects.clear();
    }
    
    console.log('Emergency reset completed. Reload the page to restart.');
    alert('Pet processor reset. Please reload the page.');
  }
};
```

## Testing Verification

### Test Case 1: Session Persistence
1. Process first pet (e.g., "Buddy")
2. Click "Process Another Pet"
3. Process second pet (e.g., "Sam")
4. Navigate to product page
5. Verify both pets appear in selector
6. Check console logs for pet count validation

### Test Case 2: Delete Functionality
1. Navigate to product page with multiple pets
2. Click delete (X) button on one pet
3. Confirm deletion in dialog
4. Verify pet is immediately removed from UI
5. Verify data is cleaned from localStorage
6. Check console logs for deletion confirmation

### Expected Outcomes
- Session persistence: `processedPets` array maintains all pets with correct count
- Delete functionality: Immediate UI update with proper data cleanup
- Console logs provide clear debugging information
- Emergency reset function available for troubleshooting

## Files to Modify

1. **`assets/pet-processor-v5-es5.js`**:
   - Modify `processAnotherPet()` method (lines 1785-1820)
   - Enhance `saveSession()` method (lines 1443-1457)
   - Add emergency reset function

2. **`snippets/ks-product-pet-selector.liquid`**:
   - Enhance `deletePet()` function (lines 1020-1136)
   - Add validation to `loadSavedPets()` function
   - Improve error handling and user feedback

## Risk Assessment

**Low Risk**: These changes fix specific logic issues without altering core functionality
**Testing Required**: Thorough testing of multi-pet workflow and delete operations
**Rollback Plan**: Git revert capability available if issues arise

## Success Criteria

1. Multiple pets properly persist in session data
2. Pet deletion works immediately with UI feedback
3. Console logs provide clear debugging information
4. No data corruption or loss during operations
5. Emergency reset function available for edge cases