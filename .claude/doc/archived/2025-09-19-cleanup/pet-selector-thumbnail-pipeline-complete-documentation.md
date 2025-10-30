# Pet Selector Thumbnail Implementation Pipeline - Complete Technical Documentation

## Overview
The pet selector system enables customers to upload pet images, process them with AI effects, and apply them to products. This pipeline spans from initial upload to final product page display, supporting multi-pet workflows.

---

## 1. Upload & Processing Flow

### 1.1 Initial Upload (`assets/pet-processor-v5-es5.js`)

**Location**: Lines 350-390
**Function**: `handleFileSelect()`

```javascript
// File selection triggers processing
handleFileSelect() {
  this.currentFile = file;
  this.currentSessionKey = this.generateSessionKey(file);
  this.uploadAndProcess();
}
```

**Data Generated**:
- `currentSessionKey`: Format `PetName_timestamp` (e.g., `Fluffy_1755660897795`)
- File validation: Max 50MB, image formats only
- EXIF orientation extracted for rotation fixes

### 1.2 API Processing (`processWithAllEffects()`)

**Location**: Lines 394-569
**Endpoint**: `/api/v2/process-with-effects`

```javascript
// Sends image to API with all effect parameters
xhr.open('POST', this.apiUrl + '/api/v2/process-with-effects?return_all_effects=true&effects=' + encodeURIComponent(effectsParam));
```

**Process Steps**:
1. Upload original image to InSPyReNet API
2. API removes background using GPU-accelerated ML model
3. Generates 4 effects: `enhancedblackwhite`, `popart`, `dithering`, `color`
4. Returns blob URLs for each effect

### 1.3 Blob to Data URL Conversion

**Location**: Lines 470-520
**Critical**: Must convert blobs before storing

```javascript
// Convert each blob URL to data URL
self.convertBlobToDataUrl(blobUrl, function(dataUrl) {
  var key = self.currentSessionKey + '_' + effect;
  window.perkieEffects.set(key, dataUrl);
});
```

**Why**: Blob URLs are temporary and expire when page unloads. Data URLs persist.

### 1.4 Effect Storage Completion

**Location**: Lines 571-620 (`handleAllEffectsProcessed()`)

```javascript
// After ALL effects converted to data URLs
self.saveSession(); // Save session metadata
self.saveEffectsToLocalStorage(); // Backup all effects

// Dispatch completion event
var event = new CustomEvent('petProcessorComplete', {
  detail: {
    sessionKey: self.currentSessionKey,
    processedPets: self.processedPets,
    petNames: self.petNames
  }
});
document.dispatchEvent(event);
```

---

## 2. Data Storage Architecture

### 2.1 Primary Storage: `window.perkieEffects` Map

**Global in-memory storage**:
```javascript
window.perkieEffects = new Map();
// Stores: sessionKey_effect -> dataURL
// Example: 'Fluffy_1755660897795_enhancedblackwhite' -> 'data:image/png;base64,...'
```

### 2.2 Session Metadata: `localStorage`

**Key**: `pet_session_[sectionId]`
```javascript
{
  sessionId: "unique-session-id",
  currentEffect: "enhancedblackwhite",
  currentSessionKey: "Fluffy_1755660897795",
  processedPets: ["Fluffy_1755660897795", "Sam_1755660897796"], // Multi-pet array
  petNames: {
    "Fluffy_1755660897795": "Fluffy",
    "Sam_1755660897796": "Sam"
  },
  timestamp: 1755660897795
}
```

### 2.3 Effects Backup: Multiple localStorage Keys

**Location**: Lines 1572-1693 (`saveEffectsToLocalStorage()`)

```javascript
// Comprehensive backup (ALL pets, ALL effects)
localStorage.setItem('perkieAllEffects_backup', JSON.stringify(allEffectsData));

// Individual backups (per effect)
localStorage.setItem('pet_effect_backup_' + sessionKey + '_' + effect, JSON.stringify({
  dataUrl: dataUrl,
  timestamp: Date.now()
}));

// Thumbnails backup
localStorage.setItem('perkieThumbnails_backup', JSON.stringify(thumbnailsData));
```

**Storage Hierarchy**:
1. Primary: `window.perkieEffects` (in-memory)
2. Session: `pet_session_*` (metadata only)
3. Backup: `perkieAllEffects_backup` (comprehensive)
4. Fallback: Individual `pet_effect_backup_*` keys

---

## 3. Navigation & Persistence

### 3.1 Page Unload Handling

**Location**: `beforeunload` event listeners
```javascript
// Automatically saves when navigating away
window.addEventListener('beforeunload', function() {
  processor.saveEffectsToLocalStorage();
});
```

### 3.2 Page Load Restoration

**Product Page Init** (`snippets/ks-product-pet-selector.liquid`):

**Location**: Lines 936-1185 (`extractPetDataFromCache()`)

```javascript
// 1. Check for session data
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && key.startsWith('pet_session_')) {
    // Load processedPets array and petNames map
  }
}

// 2. Attempt to restore effects from window.perkieEffects
processedPetsList.forEach(function(sessionKey) {
  let hasEffects = window.perkieEffects.has(sessionKey + '_enhancedblackwhite');
  
  if (!hasEffects) {
    // 3. Try comprehensive backup
    var allEffectsBackup = localStorage.getItem('perkieAllEffects_backup');
    // Restore from backup...
    
    // 4. Fallback to individual keys
    for (let j = 0; j < localStorage.length; j++) {
      if (storageKey.startsWith('pet_effect_backup_' + sessionKey)) {
        // Restore individual effect...
      }
    }
  }
});
```

**Recovery Priority**:
1. Check `window.perkieEffects` (if still on same page)
2. Load from `perkieAllEffects_backup` (comprehensive)
3. Rebuild from individual `pet_effect_backup_*` keys
4. Pattern match any `sessionKey_*` in localStorage

---

## 4. Product Page Display

### 4.1 Pet Grid Rendering

**Location**: Lines 1199-1285 (`renderPets()`)

```javascript
function renderPets(petData) {
  const petsHtml = `
    <div class="ks-pet-selector__pets">
      ${petData.map(pet => {
        const defaultImage = pet.effects.get('enhancedblackwhite') || 
                           pet.effects.get('color') || 
                           pet.effects.values().next().value;
        
        return `
          <div class="ks-pet-selector__pet" 
               data-session-key="${pet.sessionKey}">
            <img src="${defaultImage}" alt="${pet.name}">
            <span>${pet.name}</span>
            ${pet.hasNoEffects ? '<div class="processing-overlay">Processing...</div>' : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}
```

### 4.2 Pet Selection

**Location**: Lines 1576-1650 (`selectPet()`)

```javascript
const selectPet = function(sessionKey, petName) {
  // Check for effects
  if (!window.perkieEffects.has(sessionKey + '_enhancedblackwhite')) {
    alert('This pet\'s effects were lost. Please reprocess.');
    return;
  }
  
  // Add to selection (supports multi-pet)
  selectedPetsData.push({
    sessionKey,
    petName,
    effects: getAllEffectsForPet(sessionKey)
  });
  
  // Dispatch event for cart integration
  document.dispatchEvent(new CustomEvent('petSelected', {
    detail: { pets: selectedPetsData }
  }));
};
```

---

## 5. Multi-Pet Handling

### 5.1 Processing Multiple Pets

**Location**: Lines 1183-1198 (`showPreview()`)

```javascript
// When processing completes, add to processedPets array
if (this.processedPets.indexOf(this.currentSessionKey) === -1) {
  this.processedPets.push(this.currentSessionKey);
  this.petNames[this.currentSessionKey] = petName;
  this.currentPetIndex = this.processedPets.length - 1;
  this.saveSession();
}
```

**Limits**: Max 3 pets per session

### 5.2 "Process Another Pet" Flow

```javascript
// User clicks "Process Another Pet"
1. Current pet saved to processedPets array
2. saveEffectsToLocalStorage() backs up ALL pets
3. UI resets for new upload
4. New pet gets unique sessionKey
5. Both pets stored in session
```

### 5.3 Multi-Pet Display

**Product Page**:
```javascript
// Shows ALL processed pets in grid
processedPets: ["Fluffy_1755660897795", "Sam_1755660897796"]
// Each displays with thumbnail
// User can select multiple (up to 3)
```

---

## 6. Error Recovery Mechanisms

### 6.1 Missing Effects Detection

**Location**: Lines 971-1043 (Product Page)

```javascript
if (!hasEffects) {
  console.log('⚠️ Missing effects for:', sessionKey);
  
  // Recovery attempts:
  1. Check perkieAllEffects_backup
  2. Check individual pet_effect_backup_* keys  
  3. Pattern match sessionKey_* in localStorage
  4. If still missing: Show "Processing..." placeholder
}
```

### 6.2 Emergency Cleanup

**Global Function**: `window.emergencyCleanupPetData()`

```javascript
// Clears all pet data when corrupted
- Removes all pet_session_* keys
- Clears perkieEffects Map
- Removes all backup keys
- Resets UI
```

### 6.3 Session Expiry

**Auto-cleanup**: Lines 1531-1570
```javascript
// Removes sessions older than 48 hours
cleanupOldSessions() {
  if ((now - sessionData.timestamp) > twoDayMs) {
    localStorage.removeItem(key);
  }
}
```

---

## 7. Known Issues & Critical Points

### 7.1 Effects Data Loss Issue

**Root Cause**: Effects saved but not properly restored during navigation

**Evidence**: 
- Console: "Pet in session but not in effects: Beef_1755660897795"
- Effects exist in localStorage but not loaded into window.perkieEffects

**Current Workaround**: Multiple restoration fallbacks, but gaps remain

### 7.2 Timing Dependencies

**Critical**: 
- Must convert blobs to data URLs BEFORE dispatching completion event
- Must save effects BEFORE user navigates away
- Must restore effects BEFORE rendering pet grid

### 7.3 Storage Limitations

**localStorage Constraints**:
- ~5-10MB limit per domain
- Large images can exceed limits
- Thumbnail generation helps reduce size

---

## 8. Data Flow Summary

```
1. UPLOAD
   ├── Generate sessionKey (PetName_timestamp)
   ├── Send to API
   └── Receive blob URLs

2. PROCESS
   ├── Convert blobs → data URLs
   ├── Store in window.perkieEffects Map
   ├── Save session metadata
   └── Backup to localStorage

3. NAVIGATE
   ├── beforeunload: Save everything
   └── New page: Restore from backups

4. DISPLAY
   ├── Load session metadata
   ├── Restore effects from backups
   ├── Render pet grid with thumbnails
   └── Handle selection events

5. MULTI-PET
   ├── Each pet gets unique sessionKey
   ├── processedPets array tracks all
   ├── Effects saved for ALL pets
   └── Grid shows all pets
```

---

## 9. Critical File Locations

- **Upload/Processing**: `assets/pet-processor-v5-es5.js`
- **Product Display**: `snippets/ks-product-pet-selector.liquid`
- **Cart Integration**: `snippets/ks-product-form.liquid`
- **Session Persistence**: `assets/enhanced-session-persistence.js`
- **API Configuration**: `backend/inspirenet-api/src/main.py`

---

## 10. Debugging Commands

```javascript
// Check current session
JSON.parse(localStorage.getItem('pet_session_pet-bg-remover'))

// View all effects in memory
window.perkieEffects

// Check comprehensive backup
JSON.parse(localStorage.getItem('perkieAllEffects_backup'))

// Emergency reset
window.emergencyCleanupPetData()

// Manually trigger save
window.petProcessor.saveEffectsToLocalStorage()
```

---

*Documentation Date: 2025-08-21*
*Version: Pet Processor V5 with Multi-Pet Support*