# Cart Pet Thumbnails Critical Fixes - Implementation Plan

## Root Cause Analysis Summary

### Issue 1: Only One Pet Thumbnail Shows
**Root Cause**: Pet data overwrites in localStorage due to name-based keys and single-pet event handling
**Impact**: Multiple pet selections show only the last selected pet
**Priority**: HIGH - Affects core functionality

### Issue 2: Thumbnails Don't Show Until Refresh
**Root Cause**: Race condition between cart AJAX update and DOM rendering
**Impact**: Thumbnails invisible until page refresh, breaking user experience
**Priority**: CRITICAL - Breaks basic functionality

## Technical Analysis

### Current Data Flow Problems

1. **Pet Storage Collision**:
   ```javascript
   // Current problematic code in cart-pet-integration.js:132
   pets[petData.name] = { ... }; // Overwrites previous pet with same name
   ```

2. **Event Timing Race**:
   ```javascript
   // Current problematic timing in cart-pet-integration.js:213-216
   setTimeout(function() {
     self.dispatchCartUpdateEvent(); // DOM may not be ready yet
   }, 500);
   ```

3. **Missing Event Handlers**: Only listens for `cart:updated`, missing Shopify native events

### Expected vs Actual Behavior

**Expected Multiple Pet Flow**:
1. User selects Pet 1 ("Sam") → stored in localStorage
2. User selects Pet 2 ("Buddy") → stored alongside Sam
3. Add to cart → both pets passed as "Sam,Buddy"
4. Cart drawer shows both thumbnails immediately

**Current Broken Flow**:
1. User selects Pet 1 ("Sam") → `pets["Sam"] = {...}`
2. User selects Pet 2 ("Buddy") → `pets["Buddy"] = {...}` (Sam data lost)
3. Add to cart → only "Buddy" passed to cart
4. Cart drawer shows nothing until refresh

## Implementation Plan

### Phase 1: Critical Event Timing Fix (30 minutes)

**Objective**: Fix thumbnails not appearing until refresh

**Files to Modify**:
- `assets/cart-pet-integration.js`

**Changes Required**:

1. **Add Multiple Event Listeners**:
   ```javascript
   // Replace single cart:updated listener with comprehensive coverage
   document.addEventListener('cart:updated', function() { self.updateThumbnailsWithRetry(); });
   document.addEventListener('cart:change', function() { self.updateThumbnailsWithRetry(); });
   document.addEventListener('cart/change', function() { self.updateThumbnailsWithRetry(); });
   document.addEventListener('cart/update', function() { self.updateThumbnailsWithRetry(); });
   ```

2. **Implement Retry Mechanism**:
   ```javascript
   updateThumbnailsWithRetry: function() {
     var attempts = 0, maxAttempts = 10;
     function tryUpdate() {
       attempts++;
       var petContainers = document.querySelectorAll('.cart-item__pets');
       if (petContainers.length > 0 || attempts >= maxAttempts) {
         // Success or max attempts reached
         if (window.CartPetThumbnails) {
           window.CartPetThumbnails.refresh();
         }
       } else {
         setTimeout(tryUpdate, 150); // Retry every 150ms
       }
     }
     setTimeout(tryUpdate, 100); // Start after 100ms
   }
   ```

3. **Extend Cart Drawer Observer**:
   ```javascript
   // Enhanced MutationObserver to catch more DOM changes
   var observer = new MutationObserver(function(mutations) {
     var shouldUpdate = false;
     mutations.forEach(function(mutation) {
       if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
         // New cart items added to DOM
         shouldUpdate = true;
       }
       if (mutation.type === 'attributes' && mutation.attributeName === 'data-pet-names') {
         // Pet names attribute updated
         shouldUpdate = true;
       }
     });
     if (shouldUpdate) {
       self.updateThumbnailsWithRetry();
     }
   });
   ```

### Phase 2: Multiple Pet Storage Fix (45 minutes)

**Objective**: Support multiple pet thumbnails per product

**Files to Modify**:
- `assets/cart-pet-integration.js`
- `assets/cart-pet-thumbnails.js`

**Changes Required**:

1. **Session-Based Pet Storage**:
   ```javascript
   // Modified storePetDataForCart method
   storePetDataForCart: function(petData) {
     var cartPets = JSON.parse(localStorage.getItem('cartPetData') || '{}');
     var sessionKey = this.getOrCreateSessionKey();
     
     // Store pets in session-based arrays
     if (!cartPets[sessionKey]) {
       cartPets[sessionKey] = [];
     }
     
     // Check if pet already exists in session
     var existingIndex = -1;
     for (var i = 0; i < cartPets[sessionKey].length; i++) {
       if (cartPets[sessionKey][i].name === petData.name) {
         existingIndex = i;
         break;
       }
     }
     
     var petEntry = {
       name: petData.name,
       thumbnail: this.compressImageUrl(petData.processedImage),
       effect: petData.effect,
       timestamp: Date.now()
     };
     
     if (existingIndex >= 0) {
       cartPets[sessionKey][existingIndex] = petEntry; // Update existing
     } else {
       cartPets[sessionKey].push(petEntry); // Add new
     }
     
     localStorage.setItem('cartPetData', JSON.stringify(cartPets));
   }
   ```

2. **Session Key Management**:
   ```javascript
   getOrCreateSessionKey: function() {
     var sessionKey = sessionStorage.getItem('petCartSession');
     if (!sessionKey) {
       sessionKey = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
       sessionStorage.setItem('petCartSession', sessionKey);
     }
     return sessionKey;
   }
   ```

3. **Form Field Array Handling**:
   ```javascript
   updateFormFields: function(petData) {
     var forms = document.querySelectorAll('form[action*="/cart/add"]');
     
     for (var i = 0; i < forms.length; i++) {
       var form = forms[i];
       var sessionKey = this.getOrCreateSessionKey();
       
       // Get current pets for this session
       var cartPets = JSON.parse(localStorage.getItem('cartPetData') || '{}');
       var sessionPets = cartPets[sessionKey] || [];
       
       // Build comma-separated pet names
       var petNames = sessionPets.map(function(pet) { return pet.name; }).join(',');
       
       // Update form fields
       var petNameField = form.querySelector('[name="properties[_pet_name]"]');
       if (!petNameField) {
         petNameField = document.createElement('input');
         petNameField.type = 'hidden';
         petNameField.name = 'properties[_pet_name]';
         form.appendChild(petNameField);
       }
       petNameField.value = petNames;
       
       // Store session key for cart lookup
       var sessionKeyField = form.querySelector('[name="properties[_pet_session]"]');
       if (!sessionKeyField) {
         sessionKeyField = document.createElement('input');
         sessionKeyField.type = 'hidden';
         sessionKeyField.name = 'properties[_pet_session]';
         form.appendChild(sessionKeyField);
       }
       sessionKeyField.value = sessionKey;
     }
   }
   ```

### Phase 3: Enhanced Pet Retrieval (30 minutes)

**Objective**: Update cart thumbnail display to handle session-based storage

**Files to Modify**:
- `assets/cart-pet-thumbnails.js`

**Changes Required**:

1. **Enhanced Pet Data Retrieval**:
   ```javascript
   getPetDataFromStorage: function(petName, sessionKey) {
     try {
       var cartPets = JSON.parse(localStorage.getItem('cartPetData') || '{}');
       
       // Try session-based lookup first
       if (sessionKey && cartPets[sessionKey]) {
         for (var i = 0; i < cartPets[sessionKey].length; i++) {
           if (cartPets[sessionKey][i].name === petName) {
             return cartPets[sessionKey][i];
           }
         }
       }
       
       // Fallback to legacy name-based lookup
       if (cartPets[petName]) {
         return cartPets[petName];
       }
       
       // Fallback to individual pet storage
       var keys = Object.keys(localStorage);
       for (var i = 0; i < keys.length; i++) {
         var key = keys[i];
         if (key.indexOf('perkie_pet_') === 0) {
           try {
             var petData = JSON.parse(localStorage.getItem(key));
             if (petData && petData.name === petName) {
               return {
                 name: petData.name,
                 thumbnail: petData.processedImage || petData.thumbnail,
                 effect: petData.effect || 'original'
               };
             }
           } catch (e) {
             // Skip invalid entries
           }
         }
       }
     } catch (e) {
       console.warn('Error reading pet data:', e);
     }
     
     return null;
   }
   ```

2. **Session-Aware Container Update**:
   ```javascript
   updatePetContainer: function(container) {
     var petNames = container.getAttribute('data-pet-names');
     var sessionKey = container.getAttribute('data-pet-session');
     
     if (!petNames) return;
     
     var petNameArray = petNames.split(',').map(function(name) {
       return name.trim();
     }).filter(function(name) {
       return name.length > 0;
     });
     
     if (petNameArray.length === 0) return;
     
     var thumbnailContainer = container.querySelector('.pet-thumbnails-container');
     if (!thumbnailContainer) return;
     
     thumbnailContainer.innerHTML = '';
     
     var self = this;
     var petsAdded = 0;
     
     for (var i = 0; i < petNameArray.length && i < 3; i++) {
       var petData = self.getPetDataFromStorage(petNameArray[i], sessionKey);
       if (petData && petData.thumbnail) {
         self.addPetThumbnail(thumbnailContainer, petData, i);
         petsAdded++;
       }
     }
     
     if (petsAdded > 0) {
       container.style.display = 'block';
     }
   }
   ```

### Phase 4: Template Update (15 minutes)

**Objective**: Add session key to cart drawer template

**Files to Modify**:
- `snippets/cart-drawer.liquid`

**Changes Required**:

1. **Add Session Key Attribute**:
   ```liquid
   <!-- Line ~208-212 in cart-drawer.liquid -->
   <div class="cart-item__pets" 
        data-line-item="{{ forloop.index }}"
        data-variant-id="{{ item.variant_id }}"
        data-pet-names="{{ item.properties._pet_name | escape }}"
        data-pet-session="{{ item.properties._pet_session | escape }}"
        data-has-custom-pet="{{ item.properties._has_custom_pet }}">
   ```

## Testing Strategy

### Phase 1 Testing (Event Timing)
1. Select one pet, add to cart
2. Verify thumbnail appears immediately without refresh
3. Test on mobile and desktop
4. Test with different browsers

### Phase 2 Testing (Multiple Pets)
1. Select 2 pets, add to cart
2. Verify both thumbnails appear
3. Select 3 pets, add to cart
4. Verify all 3 thumbnails appear
5. Test pet name collisions (same name, different images)

### Phase 3 Testing (Edge Cases)
1. Test localStorage quota limits
2. Test browser storage disabled
3. Test network connectivity issues
4. Test rapid add-to-cart actions

## Risk Assessment

**Low Risk**:
- Backward compatibility maintained with fallback lookups
- No breaking changes to existing API
- Graceful degradation if features fail

**Mitigation**:
- Comprehensive fallback mechanisms
- Error handling and logging
- Emergency reset function available

## Timeline

- **Phase 1 (Critical)**: 30 minutes - Fix event timing
- **Phase 2 (High Priority)**: 45 minutes - Fix multiple pet storage  
- **Phase 3 (Enhancement)**: 30 minutes - Update retrieval logic
- **Phase 4 (Template)**: 15 minutes - Update Liquid template
- **Testing & QA**: 30 minutes - Comprehensive testing

**Total**: 2 hours 30 minutes

## Success Metrics

1. **Immediate Thumbnail Display**: 100% success rate for thumbnails appearing without refresh
2. **Multiple Pet Support**: 100% success rate for 2-3 pet thumbnails displaying
3. **Cross-Browser Compatibility**: Works on Chrome, Safari, Firefox, Edge
4. **Mobile Performance**: <200ms thumbnail load time on mobile
5. **Storage Efficiency**: <500KB localStorage usage for 10 pet sessions

## Rollback Plan

If issues occur, simple rollback available:
1. Revert `assets/cart-pet-integration.js` to previous version
2. Clear localStorage: `localStorage.removeItem('cartPetData')`
3. Use emergency reset: `window.emergencyResetCartPets()`

The implementation maintains backward compatibility, so rollback risk is minimal.