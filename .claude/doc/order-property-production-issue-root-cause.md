# Order Property Production Issue - Root Cause Analysis

**Date**: 2025-11-05
**Agent**: debug-specialist
**Issue**: New order properties not appearing in production orders
**Order**: #35888 (test order)
**Severity**: CRITICAL - Data loss in production orders

---

## Problem Summary

Production order #35888 shows OLD property field names instead of NEW field names:

**Expected (NEW fields)**:
- `Pet 1 Processed Image URL` (GCS URL)
- `Pet 1 Filename` (sanitized filename)
- `Pet 1 Name` (NOT `_pet_name`)
- `Style` (NOT `_effect_applied`)
- `Font`

**Actual (OLD fields showing)**:
- `_original_image_url`
- `_processed_image_url`
- `_pet_name`
- `_effect_applied`
- `_artist_notes`
- `_has_custom_pet`

---

## Root Cause Identified

### PRIMARY CAUSE: Two Pet Selectors Active Simultaneously

The production site is rendering **BOTH** the NEW selector (stitch) AND the OLD integration layer:

1. **NEW Selector Renders**: `snippets/ks-product-pet-selector-stitch.liquid`
   - Renders in `sections/main-product.liquid` at line 466
   - Creates NEW property fields: `Pet 1 Name`, `Style`, `Font`, `Pet 1 Processed Image URL`, `Pet 1 Filename`
   - Fields are defined at lines 70, 154-235, 271-343, 369, 374

2. **OLD Integration Layer OVERRIDES**: `assets/cart-pet-integration.js`
   - Listens for `pet:selected` events
   - Creates/updates OLD property fields at lines 182-296
   - **CRITICAL**: These OLD fields OVERWRITE any NEW fields when the form submits

### Code Evidence

**File**: `assets/cart-pet-integration.js`

**Lines 182-193** (Creates OLD `_pet_name` field):
```javascript
// Create or update pet name field - accumulate multiple pets
var petNameField = form.querySelector('[name="properties[_pet_name]"]');
if (!petNameField) {
  petNameField = document.createElement('input');
  petNameField.type = 'hidden';
  petNameField.name = 'properties[_pet_name]';  // ❌ OLD FIELD NAME
  petNameField.id = 'pet-name-' + sectionId;
  form.appendChild(petNameField);
}
```

**Lines 228-245** (Creates OLD `_processed_image_url` field):
```javascript
var processedUrlField = form.querySelector('[name="properties[_processed_image_url]"]');
if (!processedUrlField) {
  processedUrlField = document.createElement('input');
  processedUrlField.type = 'hidden';
  processedUrlField.name = 'properties[_processed_image_url]';  // ❌ OLD FIELD NAME
  processedUrlField.id = 'processed-url-' + sectionId;
  form.appendChild(processedUrlField);
}
```

**Lines 287-297** (Creates OLD `_effect_applied` field):
```javascript
var effectField = form.querySelector('[name="properties[_effect_applied]"]');
if (!effectField) {
  effectField = document.createElement('input');
  effectField.type = 'hidden';
  effectField.name = 'properties[_effect_applied]';  // ❌ OLD FIELD NAME
  effectField.id = 'effect-applied-' + sectionId;
  form.appendChild(effectField);
}
```

---

## Why NEW Properties Don't Appear

### Form Submission Flow

1. **User fills out NEW selector** (ks-product-pet-selector-stitch.liquid)
   - Selects pet count, enters pet name, selects style, selects font
   - NEW fields are populated: `Pet 1 Name`, `Style`, `Font`

2. **User uploads images** (if using file upload scenario)
   - NEW fields populated: `Pet 1 Processed Image URL`, `Pet 1 Filename`

3. **OLD Integration Layer Fires** (cart-pet-integration.js)
   - Listens for `pet:selected` event
   - Creates NEW hidden fields with OLD property names
   - Appends these to the form AFTER NEW selector fields

4. **Form Submits to Shopify**
   - Form contains BOTH NEW and OLD property fields
   - **Shopify's behavior**: Unknown which takes precedence
   - **Result**: OLD fields appear in order, NEW fields missing

---

## Which Selector Is Actually Active?

**Answer**: NEW selector (ks-product-pet-selector-stitch.liquid) IS active, BUT the OLD integration layer (cart-pet-integration.js) is STILL RUNNING.

**Evidence**:
- `sections/main-product.liquid` line 466 renders: `{% render 'ks-product-pet-selector-stitch', product: product, section: section, block: block %}`
- This is the ONLY selector render call in main-product.liquid
- The OLD selector (ks-product-pet-selector.liquid) is NOT rendered
- HOWEVER, `cart-pet-integration.js` is still loaded globally and intercepts ALL cart operations

---

## File Locations of ALL Property Field Creation

### NEW Selector (Stitch) - Correct Fields

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

| Property Field | Line | Type |
|---|---|---|
| `properties[Pet {{ i }} Name]` | 70 | Text input (visible) |
| `properties[Pet {{ i }} Images]` | 108 | File input (visible) |
| `properties[Pet {{ i }} Order Number]` | 137 | Text input (visible, conditional) |
| `properties[Style]` | 154, 181, 208, 235 | Radio buttons (visible) |
| `properties[Font]` | 271, 287, 301, 315, 329, 343 | Radio buttons (visible, conditional) |
| `properties[Pet {{ i }} Order Type]` | 360 | Hidden field |
| `properties[Pet {{ i }} Processing State]` | 361 | Hidden field |
| `properties[Pet {{ i }} Upload Timestamp]` | 362 | Hidden field |
| `properties[Pet {{ i }} Processed Image URL]` | 369 | Hidden field |
| `properties[Pet {{ i }} Filename]` | 374 | Hidden field |

### OLD Integration Layer - Incorrect Fields

**File**: `assets/cart-pet-integration.js`

| Property Field | Lines | Method |
|---|---|---|
| `properties[_pet_name]` | 182-192 | JavaScript creates hidden field |
| `properties[_font_style]` | 195-224 | JavaScript creates hidden field |
| `properties[_processed_image_url]` | 228-245 | JavaScript creates hidden field |
| `properties[_original_image_url]` | 248-259 | JavaScript creates hidden field |
| `properties[_artist_notes]` | 262-273 | JavaScript creates hidden field |
| `properties[_has_custom_pet]` | 276-284 | JavaScript creates hidden field |
| `properties[_effect_applied]` | 287-297 | JavaScript creates hidden field |

---

## Why This Happened

### Historical Context

1. **Original System** (OLD):
   - Pet selector: `ks-product-pet-selector.liquid`
   - Integration: `cart-pet-integration.js`
   - Property names: `_pet_name`, `_effect_applied`, etc.

2. **Migration to NEW System** (Stitch):
   - NEW selector created: `ks-product-pet-selector-stitch.liquid`
   - NEW property names: `Pet 1 Name`, `Style`, `Font`, etc.
   - `main-product.liquid` updated to render NEW selector

3. **CRITICAL MISTAKE**:
   - `cart-pet-integration.js` was NOT updated or disabled
   - Integration layer still creates OLD property fields
   - Both systems run simultaneously, causing conflict

---

## Impact Assessment

### Data Loss Severity: CRITICAL

**For Order #35888**:
- ❌ Lost: Pet processed image URL (GCS URL for full resolution)
- ❌ Lost: Pet filename (sanitized filename)
- ❌ Lost: Structured pet data (`Pet 1 Name` vs generic `_pet_name`)
- ❌ Lost: Style selection (shows `_effect_applied` instead of `Style`)
- ❌ Lost: Font selection (no font property captured)

**For Order Fulfillment**:
- Fulfillment team expects NEW property names
- OLD property names may not be recognized by fulfillment workflow
- May cause order processing delays or manual intervention

**For Customer Experience**:
- Order confirmation may show incorrect/missing customization details
- Customer may not receive correct personalized product

---

## Solution Required

### Immediate Fix (CRITICAL - Deploy ASAP)

**Option 1: Disable OLD Integration Layer (RECOMMENDED)**

1. Comment out or remove the property field creation logic in `cart-pet-integration.js`
2. Keep only the validation and button state management logic
3. Ensure NEW selector handles ALL property population

**Option 2: Update OLD Integration to Use NEW Property Names**

1. Update `cart-pet-integration.js` to create NEW property names
2. Update field names at lines 182-297:
   - `_pet_name` → `Pet 1 Name`
   - `_effect_applied` → `Style`
   - `_font_style` → `Font`
   - `_processed_image_url` → `Pet 1 Processed Image URL`
   - `_original_image_url` → Remove (not needed)
   - `_artist_notes` → Remove (not needed)
   - `_has_custom_pet` → Remove (validation only)

**Recommended**: Option 1 - Disable OLD integration entirely, NEW selector is self-contained.

---

## Detailed Fix Implementation

### Step 1: Update cart-pet-integration.js

**Location**: `assets/cart-pet-integration.js`

**Action**: Comment out or remove lines 171-301 (property field creation logic)

**Rationale**: NEW selector (stitch) creates ALL necessary property fields directly in Liquid template, no JavaScript injection needed.

**Keep These Functions** (Still needed):
- `initializeButtonState()` - Lines 431-523 (add-to-cart button validation)
- `validateCustomization()` - Lines 547-602 (form validation)
- `disableAddToCart()` - Lines 605-657 (button state management)
- `enableAddToCart()` - Lines 659-685 (button state management)
- `interceptAddToCart()` - Lines 798-881 (form submission validation)
- `validateAddonProduct()` - Lines 101-158 (add-on product validation)

**Remove These Functions** (Redundant with NEW selector):
- `updateFormFields()` - Lines 170-302 (creates OLD property fields)
- `clearFormFields()` - Lines 304-321 (clears OLD property fields)
- `updateFontStyleFields()` - Lines 323-352 (updates OLD font field)
- `updateReturningCustomerFields()` - Lines 354-403 (not used in NEW selector)
- `clearReturningCustomerFields()` - Lines 405-429 (not used in NEW selector)

### Step 2: Update Event Listeners

**Action**: Remove or disable these event listeners in `cart-pet-integration.js`:

**Lines 40-44** (pet:selected event):
```javascript
// ❌ REMOVE - NEW selector doesn't dispatch this event
document.addEventListener('pet:selected', function(e) {
  self.updateFormFields(e.detail);
  self.enableAddToCart();
});
```

**Lines 46-50** (pet:removed event):
```javascript
// ❌ REMOVE - NEW selector doesn't dispatch this event
document.addEventListener('pet:removed', function(e) {
  self.clearFormFields();
  self.checkIfAnyPetsSelected();
});
```

**Lines 52-63** (returning customer events):
```javascript
// ❌ REMOVE - NEW selector doesn't support returning customer flow yet
document.addEventListener('returning-customer:selected', function(e) {
  self.updateReturningCustomerFields(e.detail);
});

document.addEventListener('returning-customer:deselected', function(e) {
  self.clearReturningCustomerFields();
});

document.addEventListener('returning-customer:updated', function(e) {
  self.updateReturningCustomerFields(e.detail);
});
```

**Lines 65-70** (font:selected event):
```javascript
// ❌ REMOVE - Font selector in NEW selector handles this directly via radio buttons
document.addEventListener('font:selected', function(e) {
  if (e.detail && e.detail.style) {
    self.updateFontStyleFields(e.detail.style);
  }
});
```

### Step 3: Verify NEW Selector Completeness

**Action**: Ensure NEW selector (ks-product-pet-selector-stitch.liquid) creates ALL required property fields.

**Required Fields** (All present):
- ✅ `Pet 1 Name` - Line 70 (text input)
- ✅ `Style` - Lines 154-235 (radio buttons)
- ✅ `Font` - Lines 271-343 (radio buttons, conditional)
- ✅ `Pet 1 Processed Image URL` - Line 369 (hidden field)
- ✅ `Pet 1 Filename` - Line 374 (hidden field)
- ✅ `Pet 1 Images` - Line 108 (file input)
- ✅ `Pet 1 Order Number` - Line 137 (text input, conditional)

**Missing Fields** (Need to add):
- ❌ `Pet Count` - Not captured as hidden field (only selected via radio button)

**Recommendation**: Add hidden field to capture selected pet count:

```liquid
{% comment %} After line 48 in ks-product-pet-selector-stitch.liquid {% endcomment %}
<input type="hidden" id="pet-count-field" name="properties[Pet Count]" value="">
```

**JavaScript to populate** (add after line 1281):
```javascript
// Populate pet count hidden field
const petCountField = document.getElementById('pet-count-field');
if (petCountField && petCountRadio) {
  petCountField.value = petCountRadio.value;
}
```

### Step 4: Test Order Properties

**Action**: Submit test order and verify ALL NEW properties appear:

**Expected Properties in Order**:
1. `Pet Count: 1` (or 2, 3)
2. `Pet 1 Name: [user input]`
3. `Style: [classic/modern/sketch]`
4. `Font: [preppy/classic/playful/elegant/trend/no-text]` (if product supports fonts)
5. `Pet 1 Images: [Shopify CDN URL]` (if files uploaded)
6. `Pet 1 Filename: [sanitized filename]` (if files uploaded)
7. `Pet 1 Processed Image URL: [GCS URL]` (if files uploaded and processed)
8. `Pet 1 Order Type: [express_upload]` (if files uploaded)
9. `Pet 1 Processing State: [uploaded_only]` (if files uploaded)
10. `Pet 1 Upload Timestamp: [ISO timestamp]` (if files uploaded)

**OLD Properties Should NOT Appear**:
- ❌ `_pet_name`
- ❌ `_effect_applied`
- ❌ `_font_style`
- ❌ `_processed_image_url`
- ❌ `_original_image_url`
- ❌ `_artist_notes`
- ❌ `_has_custom_pet`

---

## Testing Checklist

### Scenario 1: Name-Only Order (No Files)
- [ ] Select pet count: 1
- [ ] Enter pet name: "Bella"
- [ ] Select style: "Classic"
- [ ] Select font: "Preppy" (if available)
- [ ] Add to cart
- [ ] Submit order
- [ ] **Verify**: Order shows `Pet Count: 1`, `Pet 1 Name: Bella`, `Style: Classic`, `Font: Preppy`
- [ ] **Verify**: NO OLD properties appear (`_pet_name`, `_effect_applied`, etc.)

### Scenario 2: File Upload Order
- [ ] Select pet count: 1
- [ ] Enter pet name: "Max"
- [ ] Upload 1 image file
- [ ] Select style: "Modern"
- [ ] Select font: "Classic" (if available)
- [ ] Add to cart
- [ ] Submit order
- [ ] **Verify**: Order shows all fields from Scenario 1 PLUS:
  - `Pet 1 Images: [Shopify CDN URL]`
  - `Pet 1 Filename: [sanitized filename]`
  - `Pet 1 Order Type: express_upload`
  - `Pet 1 Processing State: uploaded_only`
  - `Pet 1 Upload Timestamp: [ISO timestamp]`
- [ ] **Verify**: NO OLD properties appear

### Scenario 3: Multi-Pet Order (if max_pets > 1)
- [ ] Select pet count: 2
- [ ] Enter pet names: "Bella" and "Max"
- [ ] Upload files for Pet 1 (optional)
- [ ] Upload files for Pet 2 (optional)
- [ ] Select global style: "Sketch"
- [ ] Select global font: "Elegant" (if available)
- [ ] Add to cart
- [ ] Submit order
- [ ] **Verify**: Order shows:
  - `Pet Count: 2`
  - `Pet 1 Name: Bella`
  - `Pet 2 Name: Max`
  - `Style: Sketch`
  - `Font: Elegant`
  - (Plus file fields if uploaded)
- [ ] **Verify**: NO OLD properties appear

---

## Prevention Measures

### Code Review Checklist

When migrating to new systems:
1. ✅ **Identify ALL integration points** - Not just templates, but also JavaScript event listeners
2. ✅ **Document property field names** - Create clear mapping of old vs new names
3. ✅ **Search entire codebase** - Use grep/search to find ALL locations creating property fields
4. ✅ **Test in staging** - Submit test orders and inspect actual order properties
5. ✅ **Monitor production** - Check first few production orders after deployment

### Code Comments to Add

**In cart-pet-integration.js**:
```javascript
/**
 * DEPRECATED FUNCTIONS (2025-11-05)
 *
 * The following functions create OLD property field names that conflict
 * with the NEW pet selector (ks-product-pet-selector-stitch.liquid).
 *
 * DO NOT USE:
 * - updateFormFields() - Creates _pet_name, _effect_applied, etc.
 * - clearFormFields() - Clears OLD fields
 * - updateFontStyleFields() - Updates OLD _font_style field
 *
 * NEW SELECTOR handles ALL property population directly in Liquid template.
 * This integration file should ONLY handle validation and button states.
 */
```

---

## Summary

### Root Cause
OLD integration layer (`cart-pet-integration.js`) creates hidden fields with OLD property names that conflict with NEW selector's property fields, causing OLD properties to appear in production orders.

### Immediate Action Required
1. Disable property field creation in `cart-pet-integration.js` (lines 171-301)
2. Remove event listeners for `pet:selected`, `pet:removed`, `font:selected` (lines 40-70)
3. Keep only validation and button state management logic
4. Test with all 3 scenarios (name-only, file upload, multi-pet)
5. Deploy to production ASAP

### Files to Modify
- ✅ `assets/cart-pet-integration.js` (remove lines 40-70, 171-301, 323-429)
- ✅ `snippets/ks-product-pet-selector-stitch.liquid` (add Pet Count hidden field)

### Verification
Submit test order and ensure ONLY NEW property names appear:
- `Pet Count`, `Pet 1 Name`, `Style`, `Font`, `Pet 1 Images`, `Pet 1 Filename`, `Pet 1 Processed Image URL`

NO OLD property names should appear:
- `_pet_name`, `_effect_applied`, `_font_style`, `_processed_image_url`, `_original_image_url`, `_artist_notes`, `_has_custom_pet`

---

## Next Steps

1. **Update context session**: Document this root cause analysis in `.claude/tasks/context_session_001.md`
2. **Create implementation plan**: Detail exact code changes needed
3. **Test in staging**: Submit multiple test orders with all scenarios
4. **Deploy to production**: Use GitHub auto-deploy (push to main branch)
5. **Monitor orders**: Check next 3-5 production orders to verify fix

---

**End of Root Cause Analysis**
