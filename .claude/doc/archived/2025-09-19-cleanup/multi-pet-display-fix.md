# Multi-Pet Display Fix - Implementation Plan

## Problem Summary

The product page pet selector shows only 1 pet when 2 pets exist in the session. Console evidence shows "Returning 1 ordered pets from 2 session pets", indicating a data filtering issue rather than a visual display problem.

## Root Cause Analysis

**Issue Location**: `snippets/ks-product-pet-selector.liquid`, `extractPetDataFromCache()` function (lines 1085-1098)

**Root Cause**: The function filters out pets that have no effect images from the display. The second pet "Beef_1755660897795" exists in the session but has no effects data, so it gets excluded from `orderedPets` array.

**Evidence**:
- Console shows "Pet in session but not in effects: Beef_1755660897795"
- Only pets with `pets.has(sessionKey)` are included in `orderedPets`
- renderPets() and CSS grid work correctly - they display exactly what's passed to them

## Implementation Plan

### File to Modify
`snippets/ks-product-pet-selector.liquid`

### Changes Required

#### 1. Update extractPetDataFromCache() Function (Lines 1085-1098)

**Current Logic**:
```javascript
processedPetsList.forEach(sessionKey => {
  if (pets.has(sessionKey)) {
    orderedPets.push(pets.get(sessionKey));  // Only pets with effects
  } else {
    console.log('⚠️ Pet in session but not in effects:', sessionKey);
    // Pet is EXCLUDED from orderedPets
  }
});
```

**New Logic** - Replace the forEach block with:
```javascript
processedPetsList.forEach(sessionKey => {
  if (pets.has(sessionKey)) {
    orderedPets.push(pets.get(sessionKey));
    validSessionPets.push(sessionKey);
  } else {
    console.log('⚠️ Pet in session but not in effects:', sessionKey);
    
    // Create placeholder pet with fallback image
    if (petNamesMap[sessionKey]) {
      console.log('📝 Creating placeholder for:', sessionKey, 'with name:', petNamesMap[sessionKey]);
      
      const placeholderPet = {
        sessionKey,
        name: petNamesMap[sessionKey],
        effects: new Map([
          ['color', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiI+UHJvY2Vzc2luZy4uLjwvdGV4dD48L3N2Zz4=')
        ]),
        isPlaceholder: true
      };
      
      orderedPets.push(placeholderPet);
      validSessionPets.push(sessionKey);
    }
  }
});
```

**Purpose**: Include pets with missing effects using a placeholder image and "Processing..." text.

#### 2. Update renderPets() Function (Lines 1168-1208)

**Current Logic** - Pet HTML generation:
```javascript
return `
  <div class="ks-pet-selector__pet" 
       data-session-key="${escapedKey}"
       data-pet-name="${escapedName}"
       style="position: relative;">
    <img src="${defaultImage || 'fallback'}" 
         alt="${escapedName}" 
         class="ks-pet-selector__pet-image">
    <div class="ks-pet-selector__pet-info">
      <p class="ks-pet-selector__pet-name">${escapedName}</p>
      <p class="ks-pet-selector__pet-effect">${pet.effects.size} effects</p>
    </div>
  </div>
`;
```

**New Logic** - Add placeholder handling:
```javascript
return `
  <div class="ks-pet-selector__pet ${pet.isPlaceholder ? 'ks-pet-selector__pet--placeholder' : ''}" 
       data-session-key="${escapedKey}"
       data-pet-name="${escapedName}"
       style="position: relative;">
    ${pet.isPlaceholder ? `
      <div class="ks-pet-selector__placeholder-overlay">
        <div class="ks-pet-selector__placeholder-spinner"></div>
        <span>Processing...</span>
      </div>
    ` : ''}
    <img src="${defaultImage || 'fallback'}" 
         alt="${escapedName}" 
         class="ks-pet-selector__pet-image">
    <div class="ks-pet-selector__pet-info">
      <p class="ks-pet-selector__pet-name">${escapedName}</p>
      <p class="ks-pet-selector__pet-effect">
        ${pet.isPlaceholder ? 'Processing...' : `${pet.effects.size} effects`}
      </p>
    </div>
  </div>
`;
```

#### 3. Add CSS for Placeholder Styling (After line 500)

**New CSS Rules**:
```css
.ks-pet-selector__pet--placeholder {
  opacity: 0.7;
  cursor: not-allowed;
}

.ks-pet-selector__pet--placeholder .ks-pet-selector__pet-image {
  filter: grayscale(50%);
}

.ks-pet-selector__placeholder-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  gap: 8px;
}

.ks-pet-selector__placeholder-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e9ecef;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

#### 4. Update selectPet() Function (Lines 1523-1590)

**Current Logic** - Allow selection of any pet:
```javascript
const selectPet = function(sessionKey, petName) {
  // ... existing selection logic
};
```

**New Logic** - Prevent selection of placeholder pets:
```javascript
const selectPet = function(sessionKey, petName) {
  // Check if this is a placeholder pet
  const petElement = document.querySelector(`[data-session-key="${sessionKey}"]`);
  if (petElement && petElement.classList.contains('ks-pet-selector__pet--placeholder')) {
    console.log('Cannot select placeholder pet:', sessionKey);
    return;
  }
  
  // ... existing selection logic
};
```

### Expected Behavior After Fix

1. **Both pets display visually** in the grid
2. **Pet with effects**: Shows normally, clickable, selectable
3. **Pet without effects**: Shows with "Processing..." overlay, not clickable
4. **Console logs**: Should show "Returning 2 ordered pets from 2 session pets"

### Testing Plan

1. **Verify pet count**: Check that both pets appear in the grid
2. **Test placeholder behavior**: Ensure placeholder pets show "Processing..." state
3. **Test selection**: Confirm placeholder pets cannot be selected
4. **Test responsive**: Verify layout works on mobile (grid should show both pets)

### Critical Notes

- **This is a data filtering fix, not a CSS issue**
- **renderPets() and CSS grid are working correctly**
- **The fix includes placeholder pets to maintain user experience**
- **Placeholder pets are non-interactive to prevent confusion**

### Fallback Considerations

If placeholder approach causes issues:
- **Alternative**: Simply include pets with empty effects Map
- **Remove placeholder-specific CSS and overlays**
- **Show "0 effects" instead of "Processing..."**

### Dependencies

- No external dependencies required
- Uses existing CSS animation (`spin` keyframes already defined)
- Leverages existing pet selection and rendering infrastructure