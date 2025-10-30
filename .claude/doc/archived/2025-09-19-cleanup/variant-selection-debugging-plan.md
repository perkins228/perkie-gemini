# Variant Selection Auto-Update Debugging Implementation Plan

## Problem Analysis

### Current Issue
The pet selector's automatic variant selection is not working when pets are selected, despite having the proper function call chain:
1. `selectPet()` → `updatePetPricing()` → `updateVariantForPetCount()`
2. The `updateVariantForPetCount()` function exists and should trigger
3. Testing shows pets can be selected but variants don't auto-update

### Root Cause Analysis

#### Issue 1: Incorrect Variant Selector Query
**File**: `snippets/ks-product-pet-selector.liquid`, Line 2101

**Current Code**:
```javascript
var variantSelector = document.querySelector('select[name="id"], input[name="id"][type="radio"], .product-form__input select');
```

**Problem**: 
- Shopify's variant picker doesn't use `name="id"` for option inputs
- Option radio buttons use `name="{{ option.name }}-{{ option.position }}"` format
- This query selector fails to find the actual variant selection elements

#### Issue 2: Variant Text Matching Logic Flaws
**File**: `snippets/ks-product-pet-selector.liquid`, Lines 2105-2112

**Current Code**:
```javascript
var targetVariantText = '';
if (petCount === 0 || petCount === 1) {
  targetVariantText = '1 pet';
} else if (petCount === 2) {
  targetVariantText = '2 pets';
} else if (petCount >= 3) {
  targetVariantText = '3 pets';
}
```

**Problems**:
- Case sensitivity issues with text matching
- Assumes specific text format that may not match actual product variant names
- No error handling if variants don't match expected naming pattern

#### Issue 3: Shopify Theme Integration Issues
**Context**: Based on file analysis, this is a Dawn-based theme with:
- `variant-selects` custom element for variant selection
- Option-based selection (not direct variant selection)
- Modern Shopify variant system with JavaScript event handling

**Problem**: The current approach tries to directly manipulate variant selectors instead of using Shopify's variant selection API.

## Implementation Plan

### Phase 1: Debug Information Collection (30 minutes)

#### 1.1: Add Enhanced Logging
**File**: `snippets/ks-product-pet-selector.liquid`
**Location**: Beginning of `updateVariantForPetCount()` function

```javascript
function updateVariantForPetCount(petCount) {
  console.group('🔍 Variant Update Debug - Pet Count:', petCount);
  
  // Prevent infinite loop when variant sync triggers pet selection
  if (window.variantSyncDisabled) {
    console.log('⏸️ Variant update skipped (sync in progress)');
    console.groupEnd();
    return;
  }
  
  // Enhanced selector debugging
  console.log('📋 Checking variant selectors...');
  var selectElement = document.querySelector('select[name="id"]');
  var radioElements = document.querySelectorAll('input[name="id"][type="radio"]');
  var productFormSelects = document.querySelectorAll('.product-form__input select');
  var variantSelects = document.querySelector('variant-selects');
  var optionRadios = document.querySelectorAll('input[type="radio"][form*="product-form"]');
  
  console.log('Select[name="id"]:', selectElement);
  console.log('Radio[name="id"]:', radioElements.length, 'found');
  console.log('Product form selects:', productFormSelects.length, 'found');
  console.log('Variant-selects element:', variantSelects);
  console.log('Option radios:', optionRadios.length, 'found');
  
  // Log all form inputs for debugging
  var allFormInputs = document.querySelectorAll('input[form*="product-form"], select[form*="product-form"]');
  console.log('All product form inputs:', allFormInputs.length);
  allFormInputs.forEach((input, index) => {
    console.log(`Input ${index + 1}:`, {
      tag: input.tagName,
      type: input.type,
      name: input.name,
      id: input.id,
      form: input.form?.id || 'no form'
    });
  });
  
  console.groupEnd();
  // ... rest of function
}
```

#### 1.2: Add Variant Detection Debug Function
**File**: `snippets/ks-product-pet-selector.liquid`
**Location**: After the `updateVariantForPetCount()` function

```javascript
// Debug function to understand current variant structure
function debugVariantStructure() {
  console.group('🔍 Variant Structure Analysis');
  
  // Check if we're on a product with variants
  var variantScript = document.querySelector('script[data-selected-variant]');
  if (variantScript) {
    try {
      var selectedVariant = JSON.parse(variantScript.textContent);
      console.log('Current selected variant:', selectedVariant);
    } catch (e) {
      console.error('Failed to parse variant JSON:', e);
    }
  }
  
  // Check for Shopify's variant selection system
  var variantSelects = document.querySelector('variant-selects');
  if (variantSelects) {
    console.log('Variant-selects element found:', variantSelects);
    
    // Look for all option inputs
    var optionInputs = variantSelects.querySelectorAll('input[type="radio"], select');
    console.log('Option inputs found:', optionInputs.length);
    
    optionInputs.forEach((input, index) => {
      var label = input.type === 'radio' ? 
        document.querySelector(`label[for="${input.id}"]`) : null;
      console.log(`Option ${index + 1}:`, {
        type: input.type,
        name: input.name,
        value: input.value,
        checked: input.checked,
        selected: input.selected,
        label: label?.textContent?.trim() || 'No label'
      });
    });
  }
  
  console.groupEnd();
}

// Call debug function on page load for initial analysis
document.addEventListener('DOMContentLoaded', debugVariantStructure);
```

### Phase 2: Fix Variant Selector Query (45 minutes)

#### 2.1: Modern Shopify Variant Selection Approach
**File**: `snippets/ks-product-pet-selector.liquid`
**Location**: Replace the `updateVariantForPetCount()` function

```javascript
// Automatically select the correct product variant based on pet count
function updateVariantForPetCount(petCount) {
  console.log('🎯 Updating variant for pet count:', petCount);
  
  // Prevent infinite loop when variant sync triggers pet selection
  if (window.variantSyncDisabled) {
    console.log('⏸️ Variant update skipped (sync in progress)');
    return;
  }
  
  // Approach 1: Work with Shopify's variant-selects element
  var variantSelects = document.querySelector('variant-selects');
  if (variantSelects) {
    return updateVariantViaOptionSelects(petCount, variantSelects);
  }
  
  // Approach 2: Look for direct variant selector (older themes)
  var directVariantSelector = document.querySelector('select[name="id"]');
  if (directVariantSelector) {
    return updateVariantViaDirectSelector(petCount, directVariantSelector);
  }
  
  // Approach 3: Look for product form selects
  var productFormSelects = document.querySelectorAll('.product-form__input select');
  if (productFormSelects.length > 0) {
    return updateVariantViaProductFormSelects(petCount, productFormSelects);
  }
  
  console.warn('❌ No variant selection method found');
}

// Method 1: Update via option selects (modern Shopify themes)
function updateVariantViaOptionSelects(petCount, variantSelects) {
  console.log('📋 Using option selects method');
  
  var targetVariantText = getVariantTextForPetCount(petCount);
  console.log('🎯 Looking for variant text:', targetVariantText);
  
  // Find all option inputs (radio buttons and selects)
  var optionInputs = variantSelects.querySelectorAll('input[type="radio"], select');
  
  for (var i = 0; i < optionInputs.length; i++) {
    var input = optionInputs[i];
    
    if (input.type === 'radio') {
      // Handle radio buttons
      var label = document.querySelector('label[for="' + input.id + '"]');
      if (label && label.textContent.toLowerCase().includes(targetVariantText)) {
        console.log('✅ Found matching radio button:', label.textContent.trim());
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    } else if (input.tagName === 'SELECT') {
      // Handle select dropdowns
      var options = input.querySelectorAll('option');
      for (var j = 0; j < options.length; j++) {
        var option = options[j];
        if (option.textContent.toLowerCase().includes(targetVariantText)) {
          console.log('✅ Found matching select option:', option.textContent.trim());
          input.value = option.value;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
    }
  }
  
  console.warn('❌ No matching option found for:', targetVariantText);
  return false;
}

// Method 2: Update via direct variant selector (older themes)
function updateVariantViaDirectSelector(petCount, selector) {
  console.log('🔗 Using direct selector method');
  
  var targetVariantText = getVariantTextForPetCount(petCount);
  var options = selector.querySelectorAll('option');
  
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    if (option.textContent.toLowerCase().includes(targetVariantText)) {
      console.log('✅ Found matching direct variant:', option.textContent.trim());
      selector.value = option.value;
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  
  console.warn('❌ No matching direct variant found for:', targetVariantText);
  return false;
}

// Method 3: Update via product form selects
function updateVariantViaProductFormSelects(petCount, selects) {
  console.log('📝 Using product form selects method');
  
  var targetVariantText = getVariantTextForPetCount(petCount);
  
  for (var i = 0; i < selects.length; i++) {
    var select = selects[i];
    var options = select.querySelectorAll('option');
    
    for (var j = 0; j < options.length; j++) {
      var option = options[j];
      if (option.textContent.toLowerCase().includes(targetVariantText)) {
        console.log('✅ Found matching product form variant:', option.textContent.trim());
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
  }
  
  console.warn('❌ No matching product form variant found for:', targetVariantText);
  return false;
}

// Helper: Get variant text for pet count
function getVariantTextForPetCount(petCount) {
  if (petCount === 0 || petCount === 1) {
    return '1 pet';
  } else if (petCount === 2) {
    return '2 pet';  // Support both "2 pet" and "2 pets"
  } else if (petCount >= 3) {
    return '3 pet';  // Support both "3 pet" and "3 pets"
  }
  return '1 pet';  // Default fallback
}
```

### Phase 3: Enhanced Event Handling (30 minutes)

#### 3.1: Add Variant Change Listener
**File**: `snippets/ks-product-pet-selector.liquid`
**Location**: After the existing event listeners, around line 2200

```javascript
// Listen for variant changes to sync pet selection back
function setupVariantChangeListener() {
  console.log('🔄 Setting up variant change listener');
  
  // Listen for changes on all variant-related inputs
  document.addEventListener('change', function(event) {
    var target = event.target;
    
    // Check if this is a variant-related change
    var isVariantChange = false;
    
    // Check for option selects in variant-selects
    if (target.closest('variant-selects')) {
      isVariantChange = true;
    }
    
    // Check for direct variant selector
    if (target.name === 'id' && (target.tagName === 'SELECT' || target.type === 'radio')) {
      isVariantChange = true;
    }
    
    // Check for product form inputs
    if (target.form && target.form.id && target.form.id.includes('product-form')) {
      isVariantChange = true;
    }
    
    if (isVariantChange) {
      console.log('🔄 Variant change detected:', target);
      
      // Get current variant text to determine pet count
      var variantText = '';
      if (target.type === 'radio') {
        var label = document.querySelector('label[for="' + target.id + '"]');
        variantText = label ? label.textContent : '';
      } else if (target.tagName === 'SELECT') {
        var selectedOption = target.options[target.selectedIndex];
        variantText = selectedOption ? selectedOption.textContent : '';
      }
      
      console.log('🏷️ Variant text:', variantText);
      
      // Determine expected pet count from variant
      var expectedPetCount = 1;  // Default
      if (variantText.toLowerCase().includes('2 pet')) {
        expectedPetCount = 2;
      } else if (variantText.toLowerCase().includes('3 pet')) {
        expectedPetCount = 3;
      }
      
      console.log('🎯 Expected pet count from variant:', expectedPetCount);
      
      // Check if current pet selection matches
      var currentPetCount = selectedPetsData.length;
      console.log('📊 Current pet count:', currentPetCount);
      
      // If mismatch, show a helpful message
      if (currentPetCount !== expectedPetCount) {
        console.log('⚠️ Pet count mismatch - variant expects', expectedPetCount, 'but', currentPetCount, 'selected');
        
        var message = '';
        if (expectedPetCount > currentPetCount) {
          var needed = expectedPetCount - currentPetCount;
          message = 'Please select ' + needed + ' more pet' + (needed > 1 ? 's' : '') + ' to match this variant.';
        } else {
          var excess = currentPetCount - expectedPetCount;
          message = 'You have ' + excess + ' extra pet' + (excess > 1 ? 's' : '') + ' selected. This variant is for ' + expectedPetCount + ' pet' + (expectedPetCount > 1 ? 's' : '') + '.';
        }
        
        showMessage(message, 'warning');
      }
    }
  });
}

// Initialize variant change listener
document.addEventListener('DOMContentLoaded', setupVariantChangeListener);
```

### Phase 4: Testing and Validation (45 minutes)

#### 4.1: Create Debug Console Commands
**File**: `snippets/ks-product-pet-selector.liquid`
**Location**: End of the script section

```javascript
// Debug commands for testing (remove in production)
window.petSelectorDebug = {
  // Test variant selection for different pet counts
  testVariantSelection: function(petCount) {
    console.log('🧪 Testing variant selection for', petCount, 'pets');
    updateVariantForPetCount(petCount);
  },
  
  // Show current variant structure
  showVariantStructure: function() {
    debugVariantStructure();
  },
  
  // Show current pet selection state
  showPetState: function() {
    console.log('📊 Current pet selection state:');
    console.log('Selected pets:', selectedPetsData);
    console.log('Pet count:', selectedPetsData.length);
  },
  
  // Simulate pet selection
  simulatePetSelection: function(sessionKey, petName) {
    console.log('🎭 Simulating pet selection:', sessionKey, petName);
    selectPet(sessionKey, petName || 'Test Pet');
  },
  
  // Reset all pet selections
  resetPetSelections: function() {
    console.log('🗑️ Resetting all pet selections');
    selectedPetsData = [];
    updateSelectedDisplay();
    updatePetPricing();
  }
};

console.log('🔧 Pet selector debug commands available:');
console.log('- petSelectorDebug.testVariantSelection(1|2|3)');
console.log('- petSelectorDebug.showVariantStructure()');
console.log('- petSelectorDebug.showPetState()');
console.log('- petSelectorDebug.simulatePetSelection("key", "name")');
console.log('- petSelectorDebug.resetPetSelections()');
```

## Testing Strategy

### Manual Testing Steps

1. **Initial State Verification**:
   - Load product page with variants
   - Open browser console
   - Run `petSelectorDebug.showVariantStructure()`
   - Verify variant structure is detected correctly

2. **Pet Selection Testing**:
   - Select 1 pet manually
   - Verify variant updates to "1 Pet" option
   - Select 2nd pet
   - Verify variant updates to "2 Pets" option
   - Select 3rd pet
   - Verify variant updates to "3 Pets" option

3. **Reverse Testing**:
   - Start with pets selected
   - Change variant manually
   - Verify warning message appears if mismatch

4. **Console Debugging**:
   - Use debug commands to test each scenario
   - Verify all console logs show expected behavior
   - Check for any JavaScript errors

### Expected Results

- **Before Fix**: Console shows "No variant selection method found"
- **After Fix**: Console shows successful variant updates with specific method used
- **User Experience**: Variants update automatically when pets are selected
- **Edge Cases**: Proper handling when variant names don't match expected patterns

## Risk Assessment

### Low Risk Changes
- Adding enhanced logging (no functional impact)
- Adding debug commands (development only)

### Medium Risk Changes  
- Modifying variant selection logic (core functionality)
- Adding event listeners (potential performance impact)

### Mitigation Strategies
- Extensive console logging for debugging
- Multiple fallback methods for different theme configurations
- Easy rollback capability by commenting out new code
- No removal of existing functionality, only enhancement

## Implementation Timeline

- **Phase 1**: 30 minutes (debugging setup)
- **Phase 2**: 45 minutes (core fix implementation)  
- **Phase 3**: 30 minutes (event handling)
- **Phase 4**: 45 minutes (testing and validation)

**Total**: 2.5 hours

## Success Metrics

1. **Functional**: Variants auto-update when pets are selected
2. **Debugging**: Clear console logs show exactly what's happening
3. **Compatibility**: Works across different Shopify theme configurations
4. **User Experience**: Seamless integration with existing pet selection flow
5. **Robustness**: Graceful handling of edge cases and errors

## Files to Modify

1. **Primary**: `snippets/ks-product-pet-selector.liquid`
   - Lines 2093-2140: Replace `updateVariantForPetCount()` function
   - Line ~2200: Add variant change listener
   - End of script: Add debug commands

## Post-Implementation Steps

1. Deploy to staging environment
2. Test with actual product variants
3. Verify console logs provide useful debugging information
4. Remove debug commands before production deployment
5. Update session context with results
6. Document any theme-specific customizations needed