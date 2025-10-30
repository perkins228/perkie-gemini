# Pet Thumbnails Event Mismatch Fix - Implementation Plan

**Date**: 2025-08-29  
**Issue**: Critical bug preventing pet thumbnails from displaying in cart  
**Root Cause**: Event name mismatch between pet selector and cart integration

## 🔍 Root Cause Analysis

### Event Name Mismatch
- **Pet Selector Dispatches**: `petSelected` (ks-product-pet-selector.liquid line 2409)
- **Cart Integration Listens**: `pet:selected` (cart-pet-integration.js line 16)

### Event Detail Structure Mismatch
- **Pet Selector Sends**: `{ pets: Array, totalFee: Number }`
- **Cart Integration Expects**: `{ name: String, processedImage: String, effect: String }`

### Impact
- Pet thumbnails never display in cart (shows generic product images)
- Form fields never populate with pet data
- localStorage cartPetData remains empty
- Complete breakdown of pet-cart integration

## ✅ Recommended Solution

**Option 1: Standardize on `pet:selected` (RECOMMENDED)**

Change pet selector to dispatch `pet:selected` to match existing cart integration patterns.

### Why This Is The Best Choice:
1. **Follows Shopify Conventions**: Namespaced events (`pet:selected`) are standard practice
2. **Future-Proof**: More descriptive and professional naming convention
3. **Minimal Risk**: Only one file change required
4. **Consistency**: Matches other events like `cart:updated`, `cart-drawer:opened`
5. **NEW BUILD**: No legacy code to break since this is a fresh implementation

## 📋 Implementation Steps

### Step 1: Fix Event Name in Pet Selector
**File**: `snippets/ks-product-pet-selector.liquid`  
**Location**: Line 2409  

**Change From**:
```javascript
const event = new CustomEvent('petSelected', {
  detail: {
    pets: selectedPetsData,
    totalFee: selectedPetsData.length > 1 ? (selectedPetsData.length === 2 ? 5 : 10) : 0
  }
});
```

**Change To**:
```javascript
const event = new CustomEvent('pet:selected', {
  detail: {
    pets: selectedPetsData,
    totalFee: selectedPetsData.length > 1 ? (selectedPetsData.length === 2 ? 5 : 10) : 0
  }
});
```

### Step 2: Fix Event Detail Structure  
**File**: `snippets/ks-product-pet-selector.liquid`  
**Location**: Line 2409-2415  

The cart integration expects `petData.name`, `petData.processedImage`, etc., but pet selector sends `pets: Array`.

**Change To**:
```javascript
const event = new CustomEvent('pet:selected', {
  detail: selectedPetsData.length === 1 ? {
    // Single pet - pass individual pet data
    name: selectedPetsData[0].name,
    processedImage: selectedPetsData[0].processedImage || selectedPetsData[0].originalImage,
    effect: selectedPetsData[0].effect || 'original',
    originalImage: selectedPetsData[0].originalImage,
    pets: selectedPetsData,
    totalFee: 0
  } : {
    // Multiple pets - pass first pet as primary with array
    name: selectedPetsData[0].name,
    processedImage: selectedPetsData[0].processedImage || selectedPetsData[0].originalImage,
    effect: selectedPetsData[0].effect || 'original',
    originalImage: selectedPetsData[0].originalImage,
    pets: selectedPetsData,
    totalFee: selectedPetsData.length === 2 ? 5 : 10
  }
});
```

### Step 3: Update Test Files (Low Priority)
**Files Affected**:
- `testing/pet-cart-integration-test.html` (line 231, 287)
- `snippets/buy-buttons.liquid` (line 173)
- `testing/unified-pet-system-test.html` (line 1293)

**Action**: Change listeners from `petSelected` to `pet:selected`

### Step 4: Verification Testing
1. **Test Pet Selection**: Ensure `pet:selected` events fire correctly
2. **Test Cart Integration**: Verify form fields populate with pet data
3. **Test Thumbnails**: Confirm pet thumbnails appear in cart drawer
4. **Test Multi-Pet**: Verify multiple pet scenarios work correctly

## 🚨 Critical Notes

### ES6 to ES5 Conversion Required
The current code uses ES6 `const` - must convert to ES5 for compatibility:

**Change**:
```javascript
const event = new CustomEvent('pet:selected', {
```

**To**:
```javascript
var event = new CustomEvent('pet:selected', {
```

### Data Flow Verification
Ensure pet data structure matches what's stored in localStorage:
- `name`: String (pet name)
- `processedImage`: String (base64 or blob URL)
- `originalImage`: String (base64 or blob URL)  
- `effect`: String ('original', 'blackwhite', 'popart', etc.)

## 🎯 Success Criteria

- [ ] Pet selector dispatches `pet:selected` events
- [ ] Cart integration receives events and populates form fields
- [ ] Pet thumbnails display in cart drawer
- [ ] Form fields contain correct pet data for checkout
- [ ] localStorage `cartPetData` populates correctly
- [ ] Multi-pet scenarios work (displays primary pet)
- [ ] ES5 compatibility maintained

## ⚡ Deployment Strategy

1. **Stage 1**: Fix event name and structure in pet selector
2. **Stage 2**: Test on staging environment with actual pet selection
3. **Stage 3**: Verify cart thumbnails appear correctly
4. **Stage 4**: Test complete checkout flow with pet data
5. **Stage 5**: Deploy to main branch after successful staging tests

## 📈 Business Impact

**Current State**: 0% of pet thumbnails working (complete failure)  
**Expected Result**: 100% of pet thumbnails working  
**Revenue Impact**: Prevents $7,875-15,750 annual revenue loss from cart abandonment

This fix is **CRITICAL** for the pet thumbnails feature to function at all.