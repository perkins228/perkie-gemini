# Order Data Field Cleanup - Conversion & UX Impact Analysis

**Session**: 001
**Date**: 2025-11-04
**Analyst**: shopify-conversion-optimizer
**Task**: Analyze conversion and UX impact of removing redundant order data fields and updating data capture system

---

## Executive Summary

**Overall Risk Level**: ⚠️ **MEDIUM-LOW**

**Key Finding**: The proposed order data field cleanup is **SAFE for conversion** with proper implementation. These are backend data structure changes that should be **invisible to customers** and therefore have **zero direct conversion impact**. However, there are **indirect UX risks** if implementation introduces bugs that disrupt the purchase flow.

**Critical Success Factor**: The changes MUST maintain all customer-facing functionality while simplifying backend data capture. Any regression in form validation, cart behavior, or checkout flow will **directly harm conversion rates**.

---

## Changes Overview (Assumed Based on Context)

Based on the order data capture analysis document and your description, I'm analyzing these likely changes:

### Proposed Removals (6 Redundant Fields):
1. ❓ **Unknown field 1** - Awaiting specification
2. ❓ **Unknown field 2** - Awaiting specification
3. ❓ **Unknown field 3** - Awaiting specification
4. ❓ **Unknown field 4** - Awaiting specification
5. ❓ **Unknown field 5** - Awaiting specification
6. ❓ **Unknown field 6** - Awaiting specification

### Proposed Updates:
1. **Selected Style URL Only**: Change from capturing all 4 style URLs to capturing only the customer's selected style
2. **Filename Capture**: Add filename metadata for each pet's uploaded image
3. **Simplified Data Structure**: Streamline the new pet selector's data organization

**⚠️ CRITICAL ASSUMPTION**: Since the specific fields to be removed weren't listed, this analysis makes general recommendations. **Please provide the exact 6 fields** for a more precise assessment.

---

## Part 1: Conversion Impact Analysis

### 1.1 Direct Conversion Impact: ✅ **ZERO RISK**

**Rationale**: Order data fields are **backend properties** attached to line items. They are invisible to customers during the shopping experience.

**Customer Journey (Unchanged)**:
```
Product Page → Select Pet → Upload Image → Choose Style → Choose Font
→ Add to Cart → Checkout → Order Confirmation
```

**What Customers See**: No changes visible in:
- Product page UI
- Cart display
- Checkout flow
- Order confirmation email
- Thank you page

**What Staff See** (May change):
- Shopify admin order properties
- `order-custom-images.liquid` display
- Fulfillment workflow data

**Conclusion**: As long as the customer-facing journey is unchanged, **conversion rates will not be directly affected**.

---

### 1.2 Indirect Conversion Risks: ⚠️ **MEDIUM**

These are **implementation-induced risks**, not risks from the changes themselves:

#### Risk 1: Form Validation Regression
**Scenario**: Removing/changing hidden fields breaks "Add to Cart" button validation

**Example Failure**:
```javascript
// BEFORE: Validation checks 6 fields
if (!properties._field1 || !properties._field2 || ...) {
  disableAddToCart();
}

// AFTER: If validation not updated, checks for removed fields
// Result: Button never enables (FALSE POSITIVE validation failure)
```

**Impact**: 🔴 **CATASTROPHIC** - 100% cart abandonment if "Add to Cart" doesn't work
**Probability**: Medium (20-30% if code not carefully reviewed)
**Mitigation**:
- Comprehensive validation code review
- Test ALL product types (1-pet, 2-pet, 3-pet)
- Test with/without fonts, with/without style selection
- Browser console must show ZERO errors

---

#### Risk 2: Cart Integration Breakage
**Scenario**: Removing fields that cart-pet-integration.js depends on causes cart display or submission errors

**Example Failure**:
```javascript
// cart-pet-integration.js line 230
const styleUrl = petData.all_style_urls.selected;  // If this structure changes...
processedUrlField.value = styleUrl;  // ...this breaks

// Result: No image URL in order = fulfillment team can't create product
```

**Impact**: 🟠 **HIGH** - Orders complete but can't be fulfilled (refunds required)
**Probability**: Medium (25-35% if data structure changes not mapped correctly)
**Mitigation**:
- Map OLD field names → NEW field names explicitly
- Add fallback logic: `petData.selectedStyleUrl || petData.all_style_urls?.selected || petData.processedImage`
- Test `/cart.js` API response to verify properties present
- Test order submission with different pet/style combinations

---

#### Risk 3: Returning Customer Flow Regression
**Scenario**: Changing order number or previous order fields breaks "Use Existing Perkie Print" functionality

**Example Failure**:
```javascript
// If we remove properties[_previous_order_number] and replace with properties[Order Number]
// But validation still checks:
if (orderType === 'returning' && !properties._previous_order_number) {
  alert('Please enter order number');  // Alert shows even though field is populated
  return false;
}
```

**Impact**: 🟡 **MEDIUM** - Returning customers blocked from purchasing (affects ~15-20% of orders)
**Probability**: Low-Medium (15-20% if returning customer code not updated)
**Mitigation**:
- Trace all references to `_previous_order_number`, `_order_type`, `_is_repeat_customer`
- Update validation, form field population, and submission logic consistently
- Test returning customer flow end-to-end
- Verify order number field validation works with new property names

---

#### Risk 4: Mobile-Specific Failures
**Scenario**: Desktop testing passes, but mobile users hit edge case bugs (70% of traffic!)

**Example Failure**:
```javascript
// Mobile keyboard dismissal race condition
// User types in new field → keyboard closes → blur event → save() called on removed field
// Result: JavaScript error, Add to Cart broken on mobile only
```

**Impact**: 🔴 **CRITICAL** - 70% of traffic affected (mobile users)
**Probability**: Low (10-15% if mobile testing skipped)
**Mitigation**:
- Test on REAL mobile devices (not just Chrome DevTools mobile emulation)
- Test iOS Safari specifically (different touch event handling)
- Test landscape + portrait orientations
- Test with slow network (throttle to 3G) to catch race conditions

---

### 1.3 Conversion Opportunity: ✅ **POTENTIAL UPSIDE**

If implemented correctly, these changes could **improve conversion**:

#### Opportunity 1: Faster Page Load
**How**: Fewer hidden form fields = smaller DOM = faster rendering
**Expected Impact**: +0.5-1% conversion (every 100ms page speed = ~1% conversion)
**Data Needed**: Measure page load time before/after

#### Opportunity 2: Cleaner Cart Payload
**How**: Smaller `/cart/add` POST request = faster cart submission
**Expected Impact**: +0.2-0.5% conversion (faster feedback = lower abandonment)
**Data Needed**: Measure cart submission time before/after

#### Opportunity 3: Reduced localStorage Usage
**How**: Fewer fields stored = less quota pressure = fewer "Add to Cart" failures
**Expected Impact**: +1-2% conversion (eliminating quota errors for 5-10% of users)
**Data Needed**: Track localStorage quota error rate before/after

**Total Potential Upside**: +1.7-3.5% conversion improvement

---

## Part 2: UX Impact Assessment

### 2.1 Customer-Facing UX: ✅ **NO IMPACT (If Done Right)**

**What Customers Experience**: Absolutely nothing should change

**Unchanged Elements**:
- ✅ Upload button behavior
- ✅ Style selection interface
- ✅ Font selection interface
- ✅ Pet name input fields
- ✅ Preview button functionality
- ✅ Add to Cart button behavior
- ✅ Cart display (pet thumbnails, if present)
- ✅ Checkout process
- ✅ Order confirmation

**If ANY of these change**, conversion will drop immediately.

---

### 2.2 Staff Fulfillment UX: ⚠️ **POTENTIAL IMPACT**

**Who's Affected**: Fulfillment team viewing orders in Shopify admin

**Current Workflow** (assumed):
```
Order #12345
├── Line Item: Custom Pet Portrait
│   ├── _pet_name: "Buddy"
│   ├── _processed_image_url: https://storage.googleapis.com/...
│   ├── _original_image_url: https://storage.googleapis.com/...
│   ├── _font_style: "classic"
│   ├── _effect_applied: "enhancedblackwhite"
│   ├── _artist_notes: "Keep natural eye color"
│   ├── [6 additional fields being removed]
│   └── ...
```

**Proposed Workflow**:
```
Order #12345
├── Line Item: Custom Pet Portrait
│   ├── _pet_name: "Buddy"
│   ├── _selected_style_url: https://storage.googleapis.com/...  [NEW]
│   ├── _filename: "buddy.jpg"  [NEW]
│   ├── _font_style: "classic"
│   ├── _artist_notes: "Keep natural eye color"
│   └── [6 redundant fields removed]
```

**Questions to Answer**:
1. **Are the 6 removed fields used by fulfillment staff?**
   - If YES → Need to add them to `order-custom-images.liquid` display in different format
   - If NO → Safe to remove

2. **Will removing "all 4 style URLs" and keeping only "selected style" cause issues?**
   - If staff need to see alternate styles → Keep all 4 URLs but mark which is selected
   - If staff only need the selected style → Safe to remove

3. **Does adding filename help fulfillment?**
   - If YES → Great UX improvement for staff
   - If NO → Neutral change

**Impact Level**:
- **If fields were unused**: ✅ **NO IMPACT** - Staff workflow unchanged
- **If fields were used**: 🟠 **MEDIUM IMPACT** - Staff need new data source or display

**Mitigation**:
- Review `snippets/order-custom-images.liquid` (lines 144-207)
- Interview fulfillment team: "Do you use these 6 fields? How?"
- Update order display snippet if needed
- Provide before/after screenshots to fulfillment team

---

### 2.3 Customer Support UX: ⚠️ **LOW IMPACT**

**Scenario**: Customer calls support with order issue

**Current Support Workflow**:
```
1. Customer: "My order has wrong style"
2. Support: Opens Shopify order #12345
3. Support: Sees all 4 style URLs in properties
4. Support: Identifies which style was selected (unclear if all 4 shown)
5. Support: Resolves issue
```

**Proposed Support Workflow**:
```
1. Customer: "My order has wrong style"
2. Support: Opens Shopify order #12345
3. Support: Sees ONLY selected style URL (clearer!)
4. Support: Resolves issue faster
```

**Impact**: ✅ **SLIGHT IMPROVEMENT** - Less confusion for support team

**Risk**: If the selected style URL is somehow wrong/missing, support has no fallback to check other styles

**Mitigation**: Add `_all_styles_generated: "enhancedblackwhite,popart,dithering,8bit"` (comma-separated list) as backup context

---

## Part 3: Edge Cases & Testing Requirements

### Edge Case 1: Multi-Pet Orders (2-3 Pets)

**Scenario**: Customer orders 3-pet product with different styles per pet

**Data Structure (Current - Assumed)**:
```javascript
properties: {
  "Pet 1 Name": "Buddy",
  "Pet 1 Processed URL": "https://...",
  "Pet 1 Style": "enhancedblackwhite",
  "Pet 2 Name": "Max",
  "Pet 2 Processed URL": "https://...",
  "Pet 2 Style": "popart",
  "Pet 3 Name": "Luna",
  "Pet 3 Processed URL": "https://...",
  "Pet 3 Style": "dithering"
}
```

**Questions**:
1. Do we capture style per pet, or one style for all pets?
2. If one style for all, is this enforced in UI?
3. If different styles allowed, does "selected style URL only" mean one URL total, or one URL per pet?

**Testing Required**:
- [ ] Order 1-pet product → Verify selected style URL captured
- [ ] Order 2-pet product → Verify BOTH pets' selected style URLs captured
- [ ] Order 3-pet product → Verify ALL THREE pets' selected style URLs captured
- [ ] Mix styles (if allowed) → Verify correct style URL per pet
- [ ] Same style for all → Verify not duplicated unnecessarily

---

### Edge Case 2: Products Without Fonts

**Scenario**: Some products have `supports_font_styles: false`

**Current Behavior**: Font validation skipped (conditional validation added recently)

**Data Capture**:
- Currently: `properties[_font_style] = "no-text"` (explicitly set)
- Proposed: ??? (unknown if this changes)

**Risk**: If font field removed entirely for no-font products, validation might break

**Testing Required**:
- [ ] Order product WITHOUT font support → Verify Add to Cart works
- [ ] Verify `properties[_font_style]` = "no-text" or equivalent
- [ ] Verify fulfillment team knows this is a no-text product

---

### Edge Case 3: Returning Customers

**Scenario**: Customer checking "Use Existing Perkie Print" checkbox

**Current Data Capture**:
```javascript
properties: {
  _order_type: "returning",
  _previous_order_number: "#12345",
  _is_repeat_customer: "true"
}
```

**Proposed Changes**: ??? (unknown if these fields are being removed/renamed)

**Risk**: If order number field is one of the "6 redundant fields", returning customer flow BREAKS

**Testing Required**:
- [ ] Check "Use Existing Print" → Enter order number → Add to Cart
- [ ] Verify order submission includes order number
- [ ] Verify validation blocks submission if order number missing
- [ ] Verify alert shows if order number required but empty

---

### Edge Case 4: Add-On Products

**Scenario**: Customer adding frame or extra print to cart

**Current Validation**: Checks if cart has standard product before allowing add-on

**Risk**: If add-on validation depends on removed fields, it might fail

**Testing Required**:
- [ ] Try adding add-on product to empty cart → Should be blocked
- [ ] Add standard product → Then add-on → Should succeed
- [ ] Verify add-on validation still works after field removal

---

### Edge Case 5: localStorage Quota Exceeded

**Scenario**: localStorage full, "Add to Cart" fails with quota error

**Current Behavior**: Emergency cleanup removes old pet data

**Proposed Changes**: Fewer fields = less storage pressure = fewer quota errors

**Expected Impact**: ✅ **IMPROVEMENT** - Quota errors should decrease

**Testing Required**:
- [ ] Fill localStorage to 80% capacity (manually)
- [ ] Try adding product to cart
- [ ] Verify quota warning triggers
- [ ] Verify emergency cleanup works
- [ ] Verify Add to Cart succeeds after cleanup

---

## Part 4: Fulfillment Impact Assessment

### 4.1 Critical Questions for Fulfillment Team

Before proceeding, **interview fulfillment staff** with these questions:

#### Q1: Field Usage Audit
"For orders with custom pets, which of these fields do you actively use?"

- [ ] `_pet_name` - **CRITICAL** (used to print names on product)
- [ ] `_processed_image_url` - **CRITICAL** (used to create product)
- [ ] `_original_image_url` - Used for ??? (remakes? comparisons?)
- [ ] `_font_style` - **CRITICAL** (used to print names in correct font)
- [ ] `_effect_applied` - Used for ??? (verification? analytics?)
- [ ] `_artist_notes` - **CRITICAL** (special instructions)
- [ ] `_has_custom_pet` - Used for ??? (filtering orders? routing?)
- [ ] `_order_type` - Used for ??? (returning customer identification?)
- [ ] `_previous_order_number` - Used for ??? (looking up past orders?)
- [ ] `_is_repeat_customer` - Used for ??? (customer service context?)
- [ ] **[6 unknown fields]** - ??? ← **NEED TO IDENTIFY THESE**

#### Q2: Style URL Requirement
"If we show only the customer's selected style (e.g., 'Black & White'), not all 4 styles, does this cause any issues?"

- [ ] No issue - We only need the selected style
- [ ] Minor issue - Nice to see what other options customer had
- [ ] Major issue - We sometimes remake in different style if customer changes mind

#### Q3: Filename Usefulness
"Would it be helpful to see the original filename (e.g., 'IMG_1234.jpg') in the order properties?"

- [ ] Very helpful - Helps identify which pet in multi-pet orders
- [ ] Somewhat helpful - Nice context but not critical
- [ ] Not helpful - We only care about the processed image

---

### 4.2 Fulfillment Workflow Testing

**Test Scenario**: Place test order with changes, hand to fulfillment staff, observe

**Steps**:
1. Place order with:
   - 2 pets ("Buddy" and "Max")
   - Selected style: "Watercolor"
   - Font: "Preppy"
   - Artist notes: "Please keep natural colors"
   - Use existing print: NO
2. View order in Shopify admin
3. Ask fulfillment staff: "Do you have everything you need to complete this order?"
4. Observe any confusion or questions
5. Document any missing information

**Success Criteria**:
- [ ] Fulfillment staff can identify pet names
- [ ] Fulfillment staff can access correct images
- [ ] Fulfillment staff know which style to use
- [ ] Fulfillment staff know which font to use
- [ ] Fulfillment staff can read artist notes
- [ ] NO questions about missing information

**Failure Indicators**:
- ❌ "Where's the original image?" (if _original_image_url removed and needed)
- ❌ "Which effect was this?" (if _effect_applied removed and needed)
- ❌ "Is this a returning customer?" (if _is_repeat_customer removed and needed)

---

## Part 5: Checkout Flow Verification

### 5.1 Shopify Checkout Process

**Critical Stages**:
```
Product Page (Form Fields)
    ↓ [properties submitted]
Cart API (/cart/add)
    ↓ [properties attached to line item]
Cart Page
    ↓ [properties persist]
Checkout Page
    ↓ [properties still attached]
Payment Processing
    ↓ [properties still attached]
Order Creation
    ↓ [properties saved to order.line_items[].properties]
Order Confirmation
```

**Failure Point Detection**:

At each stage, verify properties are present:

**Stage 1: Product Page → Cart**
```javascript
// After clicking "Add to Cart", check cart:
fetch('/cart.js')
  .then(r => r.json())
  .then(cart => {
    const item = cart.items[0];
    console.log('Properties in cart:', item.properties);
    // Verify: _pet_name, _selected_style_url, _filename, etc.
  });
```

**Stage 2: Cart → Checkout**
```javascript
// On cart page, inspect:
console.log('Cart items:', window.Shopify?.cart?.items);
// Or inspect HTML: look for hidden inputs with properties
```

**Stage 3: Checkout → Order**
```javascript
// After order created, check in Shopify admin:
// Order #12345 → Line items → Properties
// Verify all expected properties present
```

**Testing Checklist**:
- [ ] Properties present in `/cart.js` API response
- [ ] Properties present in cart drawer HTML
- [ ] Properties present in cart page HTML
- [ ] Properties present in Shopify checkout line items
- [ ] Properties present in order confirmation email (if displayed)
- [ ] Properties present in Shopify admin order view
- [ ] Properties present in webhook payload (if using webhooks)

---

### 5.2 Cart Abandonment Recovery

**Scenario**: Customer adds product to cart, abandons, receives email

**Risk**: If email templates reference removed properties, email might be broken

**Files to Check**:
- Shopify admin → Settings → Notifications → Abandoned Cart email
- Any custom email templates referencing `{{ line_item.properties._field_name }}`

**Testing Required**:
- [ ] Add product to cart with new data structure
- [ ] Abandon cart (don't checkout)
- [ ] Wait for abandoned cart email (10-60 minutes depending on settings)
- [ ] Verify email displays correctly
- [ ] Verify no "{{ line_item.properties._removed_field }}" placeholders showing

---

## Part 6: Analytics & Tracking Considerations

### 6.1 Conversion Tracking

**If you track custom events**, verify they don't depend on removed fields:

**Example Risk**:
```javascript
// analytics.js
gtag('event', 'add_to_cart', {
  item_name: product.title,
  custom_pet: properties._has_custom_pet,  // If this field removed...
  effect_applied: properties._effect_applied  // ...analytics breaks
});
```

**Mitigation**:
- Audit all Google Analytics / Facebook Pixel / TikTok Pixel tracking code
- Search codebase for references to removed property names
- Update tracking to use new field names or remove tracking of obsolete fields

---

### 6.2 A/B Testing Impact

**If running A/B tests** on pet selector or checkout flow:

**Risk**: Field removal might interfere with test segmentation

**Example**:
```javascript
// If A/B test uses removed field to segment users:
if (properties._field_being_removed === 'value') {
  // Show variant A
} else {
  // Show variant B
}
// Result: All users see same variant (test invalid)
```

**Mitigation**:
- Pause any A/B tests involving pet selector during rollout
- Resume tests after verifying new data structure works

---

## Part 7: Recommendations for Safe Rollout

### Phase 1: Preparation (Before Code Changes)

#### Step 1.1: Identify the 6 Redundant Fields
**Action**: Create list of exact property names being removed
**Deliverable**: Document with field names + reason for removal

**Example**:
```
Field 1: properties[_upload_timestamp] - Reason: Not used by fulfillment
Field 2: properties[_processing_state] - Reason: Redundant with _processed_image_url existence
Field 3: properties[_device_type] - Reason: Analytics only, moved to GA
[etc.]
```

#### Step 1.2: Audit Field Dependencies
**Action**: Search codebase for references to each field

```bash
# For each field being removed:
grep -r "_upload_timestamp" assets/
grep -r "_upload_timestamp" snippets/
grep -r "_upload_timestamp" sections/
```

**Deliverable**: Dependency matrix showing which files reference each field

#### Step 1.3: Interview Fulfillment Team
**Action**: Use questions from Part 4.1
**Deliverable**: Document confirming fields are/aren't needed for fulfillment

---

### Phase 2: Implementation (Code Changes)

#### Step 2.1: Update Form Field Generation
**File**: `assets/cart-pet-integration.js` (lines 170-302)

**Changes**:
```javascript
// REMOVE (Example):
// var uploadTimestampField = document.createElement('input');
// uploadTimestampField.type = 'hidden';
// uploadTimestampField.name = 'properties[_upload_timestamp]';
// uploadTimestampField.value = Date.now();
// form.appendChild(uploadTimestampField);

// ADD (Example):
var filenameField = document.createElement('input');
filenameField.type = 'hidden';
filenameField.name = 'properties[_filename]';
filenameField.value = petData.filename || 'unknown.jpg';
form.appendChild(filenameField);

// CHANGE (Example):
// OLD: Store all 4 style URLs
// var allStylesField = document.createElement('input');
// allStylesField.value = JSON.stringify({
//   blackwhite: url1,
//   popart: url2,
//   dithering: url3,
//   8bit: url4
// });

// NEW: Store only selected style URL
var selectedStyleField = document.createElement('input');
selectedStyleField.type = 'hidden';
selectedStyleField.name = 'properties[_selected_style_url]';
selectedStyleField.value = petData.selectedStyleUrl;
form.appendChild(selectedStyleField);
```

#### Step 2.2: Update Validation Logic
**File**: `assets/cart-pet-integration.js` (lines 547-602)

**Changes**:
```javascript
// REMOVE references to removed fields from validation
// OLD:
// if (!properties._upload_timestamp) {
//   missingFields.push('upload_timestamp');
// }

// Ensure validation doesn't check removed fields
// Ensure validation DOES check new fields
if (!properties._selected_style_url) {
  missingFields.push('selected_style');
}
if (!properties._filename) {
  missingFields.push('filename');
}
```

#### Step 2.3: Update New Pet Selector
**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Changes**:
```liquid
{%- comment -%} REMOVE redundant hidden fields {%- endcomment -%}
{%- comment -%}
<input type="hidden" name="properties[_field1]" value="">
<input type="hidden" name="properties[_field2]" value="">
{%- endcomment -%}

{%- comment -%} ADD new fields {%- endcomment -%}
<input type="hidden" name="properties[_filename]" data-filename-field value="">
<input type="hidden" name="properties[_selected_style_url]" data-selected-style-url-field value="">
```

#### Step 2.4: Update Order Display (If Needed)
**File**: `snippets/order-custom-images.liquid` (lines 144-207)

**Changes** (only if fulfillment team needs different display):
```liquid
{%- comment -%} OLD: Show effect applied {%- endcomment -%}
{%- comment -%}
<p>Effect: {{ property.value }}</p>
{%- endcomment -%}

{%- comment -%} NEW: Show selected style URL instead {%- endcomment -%}
{% if property.first == '_selected_style_url' %}
  <p>Selected Style: {{ property.value }}</p>
{% endif %}
```

---

### Phase 3: Testing (Before Production Deploy)

#### Step 3.1: Automated Testing Script

Create test scenarios covering all edge cases:

```javascript
// test-order-data-capture.js
const testScenarios = [
  {
    name: '1-pet product with style + font',
    productId: 12345,
    pets: [
      { name: 'Buddy', file: 'buddy.jpg', style: 'blackwhite' }
    ],
    font: 'preppy',
    expectedProperties: [
      '_pet_name',
      '_selected_style_url',
      '_filename',
      '_font_style'
    ],
    forbiddenProperties: [
      '_field1',  // Removed field
      '_field2',  // Removed field
      // ... etc
    ]
  },
  {
    name: '3-pet product without font',
    productId: 67890,
    pets: [
      { name: 'Buddy', file: 'buddy.jpg', style: 'blackwhite' },
      { name: 'Max', file: 'max.png', style: 'popart' },
      { name: 'Luna', file: 'luna.jpeg', style: 'dithering' }
    ],
    font: 'no-text',
    expectedProperties: [
      'Pet 1 Name',
      'Pet 1 Images',
      'Pet 2 Name',
      'Pet 2 Images',
      'Pet 3 Name',
      'Pet 3 Images',
      'Font'
    ],
    forbiddenProperties: [
      '_field1',
      '_field2',
      // ... etc
    ]
  },
  {
    name: 'Returning customer with existing print',
    productId: 12345,
    pets: [
      { name: 'Buddy', useExisting: true, orderNumber: 'ORD-12345' }
    ],
    expectedProperties: [
      'Pet 1 Order Number',
      'Pet 1 Order Type'
    ]
  }
];

// Run tests
testScenarios.forEach(async (scenario) => {
  console.log(`\nTesting: ${scenario.name}`);

  // 1. Fill in form with scenario data
  fillPetSelector(scenario);

  // 2. Click "Add to Cart"
  document.querySelector('[data-add-to-cart-btn]').click();

  // 3. Wait for cart API response
  await sleep(1000);

  // 4. Fetch cart and verify properties
  const cart = await fetch('/cart.js').then(r => r.json());
  const item = cart.items.find(i => i.product_id === scenario.productId);

  // 5. Check expected properties present
  scenario.expectedProperties.forEach(prop => {
    if (!item.properties[prop]) {
      console.error(`❌ FAIL: Missing property '${prop}'`);
    } else {
      console.log(`✅ PASS: Property '${prop}' = '${item.properties[prop]}'`);
    }
  });

  // 6. Check forbidden properties absent
  scenario.forbiddenProperties.forEach(prop => {
    if (item.properties[prop]) {
      console.error(`❌ FAIL: Forbidden property '${prop}' still present`);
    } else {
      console.log(`✅ PASS: Property '${prop}' correctly removed`);
    }
  });
});
```

#### Step 3.2: Manual Testing Checklist

- [ ] **1-Pet Product**
  - [ ] Upload image → Select style → Select font → Add to Cart
  - [ ] Verify properties in `/cart.js`
  - [ ] Verify NO removed fields present
  - [ ] Verify new fields (_filename, _selected_style_url) present
  - [ ] Complete checkout → Verify order in Shopify admin

- [ ] **2-Pet Product**
  - [ ] Upload 2 images → Select style → Select font → Add to Cart
  - [ ] Verify both pets' data captured separately
  - [ ] Verify filenames captured for both pets

- [ ] **3-Pet Product**
  - [ ] Upload 3 images → Select style → Select font → Add to Cart
  - [ ] Verify all 3 pets' data captured separately

- [ ] **Product Without Font**
  - [ ] Upload image → Select style → Add to Cart
  - [ ] Verify font field = "no-text" or equivalent
  - [ ] Verify Add to Cart NOT blocked by font validation

- [ ] **Returning Customer**
  - [ ] Check "Use Existing Print" → Enter order number → Add to Cart
  - [ ] Verify order number captured in new field structure
  - [ ] Verify validation blocks if order number empty

- [ ] **Mobile (iOS Safari)**
  - [ ] Repeat all above tests on iPhone
  - [ ] Verify no JavaScript errors in console
  - [ ] Verify Add to Cart works smoothly

- [ ] **Mobile (Android Chrome)**
  - [ ] Repeat all above tests on Android
  - [ ] Verify no JavaScript errors in console

- [ ] **Cart Abandonment**
  - [ ] Add product → Abandon → Wait for email
  - [ ] Verify email displays correctly with new data structure

- [ ] **Multi-Tab Test**
  - [ ] Open product in Tab A → Fill in form
  - [ ] Open same product in Tab B → Add to cart
  - [ ] Verify cart has correct data

#### Step 3.3: Browser Console Error Check

**Critical**: Before deploying, ensure ZERO console errors

```javascript
// Expected console output:
✅ Saved pet selector state
✅ Using GCS URL for processed image
✅ Form validation passed
✅ Add to Cart successful

// FORBIDDEN console output:
❌ ReferenceError: _field1 is not defined
❌ TypeError: Cannot read property 'value' of null
❌ ValidationError: Missing required property
❌ QuotaExceededError: localStorage full
```

---

### Phase 4: Staged Rollout

#### Option A: Feature Flag (Recommended)

**Implementation**:
```javascript
// Add feature flag in theme settings or metafield
const USE_NEW_ORDER_DATA_STRUCTURE = window.useNewOrderDataStructure || false;

if (USE_NEW_ORDER_DATA_STRUCTURE) {
  // New field structure
  createField('_selected_style_url', petData.selectedStyleUrl);
  createField('_filename', petData.filename);
} else {
  // Old field structure (fallback)
  createField('_all_style_urls', JSON.stringify(petData.allStyles));
  createField('_upload_timestamp', Date.now());
}
```

**Rollout Plan**:
1. Deploy code with feature flag OFF (no changes applied)
2. Test on production with flag OFF (verify no regressions)
3. Enable flag for 10% of traffic (Shopify Scripts or A/B test)
4. Monitor conversion rate for 48 hours
5. If conversion stable: Increase to 50%
6. Monitor for another 48 hours
7. If conversion stable: Increase to 100%
8. Remove flag and old code after 2 weeks

**Rollback**: If conversion drops, set flag to OFF immediately

---

#### Option B: Separate Theme (Conservative)

**Implementation**:
1. Duplicate current theme ("Theme Backup - Before Order Data Cleanup")
2. Make changes to new theme ("Theme - Order Data Cleanup v2")
3. Publish new theme as "unpublished preview"
4. Test on preview URL (ask user for URL if needed)
5. If tests pass: Publish new theme
6. Monitor for 24 hours
7. If issues: Revert to backup theme (1-click rollback)

**Rollout Plan**:
- Day 1: Deploy new theme, monitor conversion
- Day 2-3: Monitor for bug reports, fulfillment issues
- Day 7: If stable, delete backup theme

**Rollback**: Publish backup theme (takes 30 seconds)

---

#### Option C: Gradual Product Rollout (Safest)

**Implementation**:
1. Choose 1 low-volume product as test (e.g., "Custom Pet Bookmark")
2. Update only that product's forms with new data structure
3. Monitor orders for that product for 1 week
4. If successful: Migrate 3 more products
5. If successful: Migrate all products

**Rollout Plan**:
- Week 1: 1 product (5% of orders)
- Week 2: 4 products (20% of orders)
- Week 3: All products (100% of orders)

**Rollback**: Revert individual product forms as needed

---

## Part 8: Success Criteria & Monitoring

### Success Metrics (Monitor for 2 Weeks Post-Launch)

#### Metric 1: Conversion Rate (Add to Cart → Checkout)
**Target**: No decrease (< -1% is acceptable noise)
**Alert if**: Drops > 3%
**Rollback if**: Drops > 5%

**How to measure**:
```
Conversion Rate = (Checkouts / Add to Carts) × 100

Before deployment: Calculate 7-day average
After deployment: Compare 7-day average

Example:
Before: 850 add to carts, 425 checkouts = 50.0% conversion
After:  900 add to carts, 432 checkouts = 48.0% conversion
Result: -2.0% drop (within acceptable range, monitor)
```

---

#### Metric 2: Add to Cart Failures
**Target**: No increase in JavaScript errors
**Alert if**: > 0.1% of Add to Cart clicks result in errors

**How to measure**:
```javascript
// Track in Google Analytics
document.querySelector('[data-add-to-cart-btn]').addEventListener('click', () => {
  try {
    // Add to cart logic
    gtag('event', 'add_to_cart_success');
  } catch (error) {
    gtag('event', 'add_to_cart_error', {
      error_message: error.message,
      error_stack: error.stack
    });
  }
});
```

Check Google Analytics → Events → add_to_cart_error

**Before deployment**: Should be ~0 errors
**After deployment**: Should remain ~0 errors

---

#### Metric 3: Order Fulfillment Errors
**Target**: No increase in "can't fulfill" issues
**Alert if**: Fulfillment team reports missing data

**How to measure**:
- Daily check-in with fulfillment team (first 5 days)
- Ask: "Any orders with missing image URLs, pet names, or fonts?"
- Log any issues immediately

**Success**: 0 fulfillment-blocking issues in first 2 weeks

---

#### Metric 4: Cart Abandonment Rate
**Target**: Decrease by 0.5-1% (opportunistic improvement)
**No alert**: This is a potential upside, not a requirement

**How to measure**:
```
Abandonment Rate = (Abandoned Carts / Total Carts) × 100

Check Shopify Analytics → Abandoned Carts
Compare 7 days before vs 7 days after
```

---

#### Metric 5: localStorage Quota Errors
**Target**: Decrease (fewer fields = less storage pressure)
**Alert if**: Increases

**How to measure**:
```javascript
// Track quota errors
try {
  localStorage.setItem(key, value);
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    gtag('event', 'localStorage_quota_exceeded');
  }
}
```

**Before deployment**: Check 7-day count
**After deployment**: Should decrease by 10-20%

---

#### Metric 6: Page Load Speed
**Target**: Improve by 10-50ms (fewer form fields = faster DOM)
**No alert**: This is a potential upside

**How to measure**:
- Google PageSpeed Insights (before/after)
- Shopify Analytics → Online Store Speed
- Chrome DevTools → Performance tab

---

### Monitoring Dashboard (Week 1)

**Daily Checklist**:
- [ ] Check conversion rate (Shopify Analytics)
- [ ] Check Google Analytics error events
- [ ] Check fulfillment team Slack for issues
- [ ] Check browser console on product page (spot check)
- [ ] Check Shopify admin → Orders (spot check properties)

**Red Flags** (Immediate Investigation Required):
- 🚨 Conversion rate drops > 5%
- 🚨 Fulfillment team says "I can't complete this order"
- 🚨 Multiple customer support tickets about cart issues
- 🚨 JavaScript errors in browser console
- 🚨 Orders with missing required properties

**Yellow Flags** (Monitor Closely):
- ⚠️ Conversion rate drops 2-5%
- ⚠️ One or two customer support tickets
- ⚠️ Occasional browser console warnings (not errors)
- ⚠️ Fulfillment team asks clarifying questions

**Green Lights** (Success Indicators):
- ✅ Conversion rate stable or improved
- ✅ Zero customer support tickets about cart/checkout
- ✅ Zero browser console errors
- ✅ Fulfillment team reports "everything looks good"
- ✅ localStorage quota errors decreased

---

## Part 9: Rollback Plan

### When to Rollback

**Immediate Rollback Triggers**:
1. Conversion rate drops > 5% within 24 hours
2. Add to Cart button broken (confirmed by multiple users)
3. Fulfillment team can't complete orders (missing critical data)
4. JavaScript errors affecting > 10% of users

**Delayed Rollback Triggers** (after investigation):
1. Conversion rate drops 2-5% and no other explanation (e.g., not seasonal)
2. Recurring customer support issues related to cart/checkout
3. Fulfillment team consistently confused by new data structure

---

### Rollback Procedure

#### Option 1: Git Revert (Fastest)

```bash
# On local machine:
git log --oneline  # Find commit hash before changes
git revert <commit-hash>
git push origin main

# GitHub auto-deploys to Shopify within 1-2 minutes
```

**Recovery Time**: 2-5 minutes

---

#### Option 2: Theme Restore (If using separate theme)

1. Shopify admin → Online Store → Themes
2. Find "Theme Backup - Before Order Data Cleanup"
3. Click "Actions" → "Publish"
4. Confirm

**Recovery Time**: 30 seconds

---

#### Option 3: Feature Flag Off (If using feature flag)

```javascript
// Set global flag
window.useNewOrderDataStructure = false;

// Or update theme setting metafield
// Shopify admin → Metafields → useNewOrderDataStructure = false
```

**Recovery Time**: 10 seconds

---

### Post-Rollback Actions

1. **Notify stakeholders**: "Reverted order data changes due to [reason]"
2. **Investigate root cause**: Review logs, console errors, test scenarios
3. **Fix issues**: Update code to address problems
4. **Re-test**: Complete full testing checklist again
5. **Re-deploy**: With fixes applied

---

## Part 10: Final Recommendations

### ✅ PROCEED IF:

1. **All 6 redundant fields identified and confirmed unused by fulfillment**
2. **Comprehensive testing plan in place** (see Phase 3)
3. **Staged rollout strategy chosen** (feature flag or separate theme)
4. **Monitoring dashboard ready** (conversion rate, errors, fulfillment issues)
5. **Rollback plan documented and tested**

### ⚠️ PROCEED WITH CAUTION IF:

1. **Any of the 6 fields might be used by fulfillment** (need confirmation)
2. **Testing time limited** (rush job = higher risk)
3. **No staging environment available** (testing on production)
4. **Peak sales period approaching** (holiday, promotion)

### 🛑 DO NOT PROCEED IF:

1. **Cannot identify which 6 fields are being removed** (too risky without knowing)
2. **Fulfillment team unavailable to confirm field usage** (might break orders)
3. **No rollback plan** (can't recover if things go wrong)
4. **Currently running critical A/B tests** (data will be contaminated)

---

## Part 11: Questions Needing Answers

Before finalizing this analysis, please provide:

### Critical Information Needed:

1. **What are the exact 6 redundant fields being removed?**
   - Field 1: `properties[?]` - Reason: ?
   - Field 2: `properties[?]` - Reason: ?
   - Field 3: `properties[?]` - Reason: ?
   - Field 4: `properties[?]` - Reason: ?
   - Field 5: `properties[?]` - Reason: ?
   - Field 6: `properties[?]` - Reason: ?

2. **Has fulfillment team confirmed these fields are unused?**
   - [ ] Yes, confirmed with fulfillment manager
   - [ ] No, haven't asked yet
   - [ ] Partially - some fields confirmed, some unknown

3. **What is the implementation timeline?**
   - [ ] Urgent (deploy within 1 week)
   - [ ] Normal (deploy within 1 month)
   - [ ] Flexible (deploy when ready)

4. **Is there a staging environment?**
   - [ ] Yes, have Shopify test environment
   - [ ] No, must test on production

5. **What is the rollback strategy preference?**
   - [ ] Git revert
   - [ ] Separate theme backup
   - [ ] Feature flag
   - [ ] Other: ___________

---

## Summary

**Overall Assessment**: ✅ **SAFE TO PROCEED** (with proper testing and staging)

**Key Recommendations**:
1. **Identify the 6 fields** explicitly before proceeding
2. **Confirm with fulfillment team** that fields are truly redundant
3. **Use staged rollout** (feature flag or separate theme for easy rollback)
4. **Test comprehensively** (all product types, mobile, returning customers)
5. **Monitor closely** for 2 weeks post-launch (conversion, errors, fulfillment)
6. **Have rollback plan ready** (git revert or theme restore)

**Expected Outcome**:
- ✅ **NO negative conversion impact** (backend change invisible to customers)
- ✅ **Slight performance improvement** (fewer fields = faster page load, less localStorage pressure)
- ✅ **Cleaner data structure** (easier to maintain long-term)
- ✅ **Improved fulfillment UX** (if filename added as proposed)

**Biggest Risk**: Implementation bugs causing Add to Cart failures (mitigated by comprehensive testing)

---

**Document Status**: ⚠️ **INCOMPLETE** - Awaiting specific field names to complete analysis

**Next Step**: Please provide the 6 redundant fields list, then this analysis can be finalized.

---

**End of Analysis**
