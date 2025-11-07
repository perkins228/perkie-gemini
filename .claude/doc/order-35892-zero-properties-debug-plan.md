# Order #35892 Zero Properties Debug Plan

**Created**: 2025-11-05
**Issue**: Order #35892 shows ZERO properties after fix deployment (commit bf98328)
**Status**: Root cause investigation in progress

---

## Problem Statement

**Timeline**:
- **Order #35891** (Nov 5 2:52 PM): Showed OLD properties with EMPTY values (`_pet_name: ""`, `_has_custom_pet: "false"`)
- **Fix deployed** (Nov 5 3:16 PM, commit bf98328): Removed OLD property inputs + JavaScript from buy-buttons.liquid
- **Order #35892** (Nov 5 3:20 PM): Shows NO properties section at all (completely empty)

**Expected Properties** (should appear in Order #35892):
```
✅ Pet 1 Name: "Luna" (example)
✅ Pet 1 Images: Shopify CDN URL
✅ Style: "enhancedblackwhite" (example)
✅ Font: "preppy" (example)
✅ Pet 1 Processed Image URL: GCS URL
✅ Pet 1 Filename: "luna.jpg" (example)
✅ Artist Notes: "Please emphasize eyes" (example, optional)
```

**Actual Result**: NOTHING (no properties section visible in Shopify admin)

---

## Root Cause Hypothesis Tree

### Hypothesis 1: Form Submission Issue (MOST LIKELY)
**Theory**: NEW selector form is NOT submitting to `/cart/add` OR properties are not being sent in POST request

**Evidence to check**:
- Is NEW selector (`ks-product-pet-selector-stitch`) actually rendered on the product page?
- Are hidden fields (lines 358-384 in stitch.liquid) present in DOM?
- Is the form's `action` attribute pointing to `/cart/add`?
- Does form have correct `enctype="multipart/form-data"`?
- Are form inputs inside the `<form>` tag (not outside)?

**How to verify**:
1. Inspect product page HTML in browser DevTools
2. Check if `.pet-selector-stitch` div exists
3. Check if hidden fields exist with correct `name="properties[...]"` attributes
4. Check form structure: `<form action="/cart/add" enctype="multipart/form-data">`
5. Use Network tab to inspect `/cart/add` POST request body

**If TRUE**: Form structure issue → Fix form rendering or input placement

---

### Hypothesis 2: JavaScript Execution Timing Issue (HIGH LIKELIHOOD)
**Theory**: `populateSelectedStyleUrls()` function is NOT running OR runs AFTER form submit

**Evidence to check**:
- Does `setupFormSubmitHandler()` function (line 2216) successfully attach event listener?
- Does form submit event trigger BEFORE `populateSelectedStyleUrls()` runs?
- Is there a race condition between form submit and JavaScript execution?
- Are there JavaScript errors in console preventing execution?

**Code flow analysis** (from stitch.liquid):
```javascript
// Line 2216: Setup form submit handler
function setupFormSubmitHandler() {
  const form = container.closest('form[action*="/cart/add"]');

  if (!form) {
    console.warn('Pet Selector: Could not find cart form');
    return; // ❌ FAILURE POINT: Form not found
  }

  form.addEventListener('submit', function(e) {
    populateSelectedStyleUrls(); // Line 2226
    // Move file inputs into form (lines 2228-2244)
  });
}
```

**Failure points**:
1. `container.closest('form[action*="/cart/add"]')` returns NULL → No form found
2. Event listener never attached → `populateSelectedStyleUrls()` never runs
3. Hidden fields remain EMPTY (`value=""`) → Shopify receives empty properties
4. Shopify strips empty properties → Order shows NO properties at all

**How to verify**:
1. Check browser console for "Pet Selector: Could not find cart form" warning
2. Add `console.log` before/after `populateSelectedStyleUrls()` call
3. Check if hidden fields get populated (use DevTools to inspect values BEFORE submit)
4. Use Network tab to see if properties are in POST body

**If TRUE**: Form selector issue → Update selector or move pet selector inside form

---

### Hypothesis 3: Hidden Field Population Issue (MEDIUM LIKELIHOOD)
**Theory**: `populateSelectedStyleUrls()` RUNS but doesn't populate hidden fields correctly

**Evidence to check**:
- Does `populateSelectedStyleUrls()` find pet data in localStorage?
- Does it find the correct localStorage key (`perkie_pet_{petName}`)?
- Does it extract GCS URLs correctly from pet data?
- Do querySelector calls find the hidden field elements?

**Code flow analysis** (lines 2098-2204):
```javascript
function populateSelectedStyleUrls() {
  // Step 1: Get selected style
  const selectedStyleRadio = container.querySelector('[data-style-radio]:checked');
  if (!selectedStyleRadio) {
    return false; // ❌ FAILURE POINT: No style selected
  }

  // Step 2: Get pet count
  const selectedCountRadio = container.querySelector('[data-pet-count-radio]:checked');
  if (!selectedCountRadio) {
    return false; // ❌ FAILURE POINT: No pet count selected
  }

  // Step 3: For each pet, get data from localStorage
  for (let i = 1; i <= petCount; i++) {
    const petNameInput = container.querySelector(`[data-pet-name-input="${i}"]`);
    const petName = petNameInput ? petNameInput.value.trim() : '';

    if (!petName) {
      continue; // ❌ FAILURE POINT: No pet name entered
    }

    // Step 4: Construct localStorage key
    const storageKey = `perkie_pet_${petName.toLowerCase().replace(/\s+/g, '_')}`;
    const storedData = localStorage.getItem(storageKey);

    if (!storedData) {
      continue; // ❌ FAILURE POINT: No pet data in localStorage
    }

    // Step 5: Parse pet data
    const petData = JSON.parse(storedData);

    // Step 6: Get style URL
    if (petData.effects && petData.effects[selectedStyle]) {
      const styleUrl = petData.effects[selectedStyle].gcsUrl || '';

      // Step 7: Populate hidden field
      const urlField = document.querySelector(`[data-pet-processed-url="${i}"]`);
      if (urlField) {
        urlField.value = styleUrl; // ✅ SUCCESS: Field populated
      }
    }
  }
}
```

**Failure points**:
1. No style selected → Returns false early
2. No pet count selected → Returns false early
3. Pet name field empty → Skips that pet
4. localStorage key mismatch → No pet data found
5. Pet data structure incorrect → Missing `effects` or style data
6. querySelector fails → Field not found in DOM

**How to verify**:
1. Add `console.log` at each step in `populateSelectedStyleUrls()`
2. Check localStorage keys (use DevTools Application tab)
3. Verify pet data structure matches expected format
4. Check if hidden fields exist with correct `data-pet-processed-url` attributes

**If TRUE**: Data retrieval issue → Fix localStorage key or data structure

---

### Hypothesis 4: Form Field Name Issue (LOW LIKELIHOOD)
**Theory**: Property field names are incorrect or malformed

**Evidence to check**:
- Are field names correctly formatted as `properties[Pet 1 Name]`?
- Are field names being URL-encoded incorrectly?
- Is Shopify rejecting the property format?

**Current field names** (from stitch.liquid):
```liquid
Line 70:  name="properties[Pet {{ i }} Name]"
Line 108: name="properties[Pet {{ i }} Images]"
Line 137: name="properties[Pet {{ i }} Order Number]"
Line 154: name="properties[Style]"
Line 271: name="properties[Font]"
Line 360: name="properties[Pet {{ i }} Order Type]"
Line 361: name="properties[Pet {{ i }} Processing State]"
Line 362: name="properties[Pet {{ i }} Upload Timestamp]"
Line 369: name="properties[Pet {{ i }} Processed Image URL]"
Line 374: name="properties[Pet {{ i }} Filename]"
Line 382: name="properties[Artist Notes]"
```

**Format validation**:
- ✅ Correct syntax: `properties[Key Name]`
- ✅ No special characters that need escaping
- ✅ Matches Shopify documentation examples

**How to verify**:
1. Inspect form HTML to confirm field names are rendered correctly
2. Check Network tab to see exact property names in POST body
3. Test with simpler property name (e.g., `properties[test]`) to rule out format issue

**If TRUE**: Property name format issue → Simplify or escape property names

---

### Hypothesis 5: Product Configuration Issue (LOW LIKELIHOOD)
**Theory**: NEW selector is not actually rendered on the product page

**Evidence to check**:
- Does product have `custom` tag? (required for selector to render, line 27 in stitch.liquid)
- Is `ks-product-pet-selector-stitch` block present in product theme settings?
- Did user access a different product page without customization?
- Is there a conditional rendering bug?

**Rendering conditions** (from stitch.liquid):
```liquid
Line 18-27: Check for 'custom' tag
{% assign has_custom_tag = false %}
{% for tag in product.tags %}
  {% if tag contains 'custom' or tag contains 'Custom' or tag contains 'CUSTOM' %}
    {% assign has_custom_tag = true %}
  {% endif %}
{% endfor %}

{% if has_custom_tag %}
  <div class="pet-selector-stitch" ...>
  <!-- Selector content -->
{% endif %}
```

**How to verify**:
1. Check if product has `custom` tag in Shopify admin
2. Inspect product page HTML for `.pet-selector-stitch` div
3. Check main-product.liquid renders `ks-product-pet-selector-stitch` snippet (line 466)
4. Verify block appears in theme customizer

**If TRUE**: Selector not rendered → Add `custom` tag to product or fix rendering logic

---

## Investigation Steps (Priority Order)

### Stage 1: Verify Selector Presence (5 minutes)
**Goal**: Confirm NEW selector is rendered on product page

**Actions**:
1. Open product page in Chrome DevTools (use Chrome DevTools MCP if available)
2. Inspect HTML for `.pet-selector-stitch` div
3. Check if hidden fields exist: `#pet-1-processed-url`, `#artist-notes-field`, etc.
4. Verify form structure: `<form action="/cart/add" enctype="multipart/form-data">`

**Expected results**:
- ✅ `.pet-selector-stitch` div exists
- ✅ Hidden fields present with `name="properties[...]"` attributes
- ✅ Form action points to `/cart/add`

**If selector missing**: Check product tags and block rendering (Hypothesis 5)

---

### Stage 2: Verify Form Submission Flow (10 minutes)
**Goal**: Confirm form submit handler is attached and running

**Actions**:
1. Open browser console on product page
2. Check for "Pet Selector: Could not find cart form" warning
3. Add test order with console open:
   - Fill pet name, upload image, select style/font
   - Watch for "🔍 Populating selected style URLs for order..." log (line 2099)
   - Check if "✅ Pet X processed URL set" logs appear (line 2160)
4. Inspect hidden fields BEFORE clicking "Add to Cart" (values should be populated)
5. Use Network tab to inspect `/cart/add` POST request body

**Expected results**:
- ✅ No "Could not find cart form" warning
- ✅ Console logs show `populateSelectedStyleUrls()` running
- ✅ Hidden fields populated with values BEFORE submit
- ✅ POST body contains `properties[Pet 1 Name]`, `properties[Style]`, etc.

**If form handler not attached**: Fix form selector logic (Hypothesis 2)
**If handler runs but fields empty**: Check localStorage data (Stage 3)

---

### Stage 3: Verify localStorage Data (10 minutes)
**Goal**: Confirm pet processor stored data correctly

**Actions**:
1. Open DevTools → Application tab → Local Storage
2. Check for keys matching pattern: `perkie_pet_{petName}`
3. Inspect data structure:
   ```javascript
   {
     "effects": {
       "enhancedblackwhite": { "gcsUrl": "https://...", "dataUrl": "..." },
       "color": { ... },
       "modern": { ... },
       "sketch": { ... }
     },
     "artistNote": "Optional notes...",
     "originalImage": { ... }
   }
   ```
4. Verify selected style exists in `effects` object
5. Verify `gcsUrl` is valid HTTPS URL

**Expected results**:
- ✅ localStorage keys exist for each pet
- ✅ Data structure matches expected format
- ✅ Selected style has `gcsUrl` populated
- ✅ `artistNote` exists (if user entered notes)

**If localStorage empty**: Pet processor not storing data → Check pet processor flow
**If data structure wrong**: Pet processor storing incorrectly → Update pet-storage.js

---

### Stage 4: Verify Hidden Field Population (10 minutes)
**Goal**: Confirm querySelector finds hidden fields and sets values

**Actions**:
1. Add temporary debugging to `populateSelectedStyleUrls()`:
   ```javascript
   // Add after line 2157
   console.log('🔍 Looking for field:', `[data-pet-processed-url="${i}"]`);
   const urlField = document.querySelector(`[data-pet-processed-url="${i}"]`);
   console.log('🔍 Field found:', urlField);
   console.log('🔍 Setting value:', styleUrl);
   ```
2. Reload product page and test order flow
3. Check console logs to see if querySelector finds elements
4. Inspect hidden field values in DevTools Elements tab

**Expected results**:
- ✅ querySelector finds hidden field element
- ✅ Field value is set to GCS URL
- ✅ Field retains value until form submit

**If querySelector returns null**: Hidden fields not in DOM → Check stitch.liquid rendering
**If value not set**: JavaScript error → Check for exceptions in console

---

### Stage 5: Network Request Analysis (10 minutes)
**Goal**: Verify properties are sent in POST request to `/cart/add`

**Actions**:
1. Open DevTools → Network tab
2. Clear network log
3. Complete order flow and click "Add to Cart"
4. Find `/cart/add` POST request
5. Inspect Request Payload / Form Data
6. Look for `properties[Pet 1 Name]`, `properties[Style]`, etc.

**Expected POST body** (example):
```
id: 12345678901234
quantity: 1
properties[Pet 1 Name]: Luna
properties[Style]: enhancedblackwhite
properties[Font]: preppy
properties[Pet 1 Processed Image URL]: https://storage.googleapis.com/...
properties[Pet 1 Filename]: luna.jpg
properties[Artist Notes]: Please emphasize eyes
properties[Pet 1 Order Type]: express_upload
properties[Pet 1 Processing State]: uploaded_only
properties[Pet 1 Upload Timestamp]: 2025-11-05T20:15:30.000Z
```

**If properties missing from POST**:
- Check if form inputs are inside `<form>` tag (not outside)
- Check if inputs are disabled (disabled inputs don't submit)
- Check if form has correct `enctype="multipart/form-data"`

**If properties present in POST but not in order**:
- Shopify may be stripping empty values → Check if values are actually populated
- Shopify may reject malformed property names → Test with simpler names

---

## Critical Questions to Answer

### Question 1: Is the NEW selector rendered?
**How to check**: Inspect product page HTML for `.pet-selector-stitch` div
**If NO**: Check product tags and block configuration (Stage 1)

### Question 2: Is the form submit handler attached?
**How to check**: Look for "Could not find cart form" in console
**If NO**: Form selector logic issue (Stage 2)

### Question 3: Does `populateSelectedStyleUrls()` run?
**How to check**: Look for "🔍 Populating selected style URLs for order..." in console
**If NO**: Form handler not attached (Stage 2)

### Question 4: Are hidden fields populated BEFORE submit?
**How to check**: Inspect hidden field values in DevTools before clicking "Add to Cart"
**If NO**: Check localStorage data (Stage 3) or querySelector logic (Stage 4)

### Question 5: Are properties in the POST request?
**How to check**: Inspect Network tab `/cart/add` request payload
**If NO**: Form structure issue (inputs outside form, disabled inputs, etc.)

---

## Definitive Root Cause Scenarios

### Scenario A: Form Not Found (MOST LIKELY)
**Evidence**:
- Console shows "Pet Selector: Could not find cart form"
- No "🔍 Populating..." logs in console
- Hidden fields remain empty (`value=""`)

**Root cause**:
```javascript
// Line 2218 in stitch.liquid
const form = container.closest('form[action*="/cart/add"]');
if (!form) {
  console.warn('Pet Selector: Could not find cart form');
  return; // ❌ Handler never attached
}
```

**Why it fails**:
- Pet selector div (`.pet-selector-stitch`) is rendered OUTSIDE the `<form>` tag
- `container.closest('form')` searches UP the DOM tree (ancestors only)
- If pet selector is sibling to form (not child), `closest()` returns null

**DOM structure issue** (hypothetical):
```html
<!-- BROKEN STRUCTURE -->
<div class="product">
  <div class="pet-selector-stitch"><!-- NEW selector here --></div>
  <form action="/cart/add"><!-- Buy buttons form --></form>
</div>

<!-- CORRECT STRUCTURE -->
<form action="/cart/add">
  <div class="pet-selector-stitch"><!-- NEW selector here --></div>
  <!-- Buy buttons -->
</form>
```

**Fix**:
1. Move pet selector snippet inside `<form>` tag in main-product.liquid
2. OR: Change form selector to `document.querySelector('form[action*="/cart/add"]')`

---

### Scenario B: localStorage Data Missing
**Evidence**:
- Console shows "🔍 Populating..." log
- Console shows "⚠️ No localStorage data found for pet X"
- Hidden fields remain empty

**Root cause**:
- Pet processor didn't store data in localStorage
- localStorage key mismatch (e.g., `perkie_pet_luna` vs `perkie_pet_Luna`)
- User didn't go through pet processor flow (uploaded directly without processing)

**Fix**:
1. Verify pet processor stores data correctly in localStorage
2. Check key construction logic matches between processor and selector
3. Add fallback: If localStorage empty, use file input data (original image)

---

### Scenario C: querySelector Fails
**Evidence**:
- Console shows "🔍 Populating..." log
- Console shows localStorage data exists
- Console shows "🔍 Looking for field: [data-pet-processed-url='1']"
- Console shows "🔍 Field found: null"

**Root cause**:
- Hidden fields not rendered in DOM
- Hidden fields have incorrect `data-*` attributes
- Hidden fields are disabled or hidden with `display: none` AND `disabled` attribute

**Fix**:
1. Verify hidden fields exist in stitch.liquid (lines 358-384)
2. Check if conditional rendering hides fields (e.g., only shown for certain pet counts)
3. Remove `disabled` attribute if present

---

### Scenario D: Properties Stripped by Shopify
**Evidence**:
- Console shows hidden fields populated correctly
- Network tab shows properties in POST body
- Order shows NO properties in Shopify admin

**Root cause**:
- Shopify strips properties with empty string values (`""`)
- Properties with only whitespace are stripped
- Malformed property names rejected by Shopify

**Fix**:
1. Ensure hidden fields have non-empty values BEFORE submit
2. Remove unused hidden fields (Order Type, Processing State, etc. have `value=""`)
3. Test with minimal property set to isolate issue

---

## Next Actions (Awaiting Investigation Results)

**USER ACTION REQUIRED**: Run investigation steps (Stages 1-5) using Chrome DevTools MCP

**After investigation, provide**:
1. Screenshot of product page with DevTools Elements tab showing form structure
2. Screenshot of browser console showing logs during "Add to Cart" flow
3. Screenshot of Network tab showing `/cart/add` POST request body
4. Screenshot of localStorage showing `perkie_pet_*` keys and data

**Agent will then**:
1. Analyze evidence to determine definitive root cause
2. Propose specific fix with exact file changes
3. Create implementation plan with testing steps
4. Update session context with findings

---

## Files to Review

### Primary Files (Order of Investigation):
1. **sections/main-product.liquid** (lines 460-491)
   - Check if pet selector is rendered INSIDE or OUTSIDE form tag
   - Verify block order: pet selector → buy buttons

2. **snippets/ks-product-pet-selector-stitch.liquid** (lines 2216-2246)
   - Check form selector logic: `container.closest('form[action*="/cart/add"]')`
   - Verify submit handler attachment

3. **snippets/ks-product-pet-selector-stitch.liquid** (lines 2098-2204)
   - Check `populateSelectedStyleUrls()` logic
   - Verify localStorage key construction

4. **snippets/ks-product-pet-selector-stitch.liquid** (lines 358-384)
   - Check hidden field rendering
   - Verify `data-*` attributes match querySelector calls

5. **assets/pet-storage.js** (if exists)
   - Check localStorage key format
   - Verify data structure matches expected format

### Secondary Files (If Primary Investigation Inconclusive):
6. **snippets/buy-buttons.liquid** (entire file)
   - Verify form structure and enctype
   - Check if form action is correct

7. **assets/cart-pet-integration.js**
   - Check if validation logic blocks form submission
   - Verify no JavaScript errors prevent submission

---

## Success Metrics

**Fix is successful when**:
1. ✅ Order properties visible in Shopify admin (Properties section shows data)
2. ✅ All expected properties present:
   - Pet 1 Name
   - Pet 1 Images (Shopify CDN URL)
   - Style
   - Font
   - Pet 1 Processed Image URL (GCS URL)
   - Pet 1 Filename
   - Artist Notes (if provided)
3. ✅ No console errors during order flow
4. ✅ Network tab shows properties in POST body
5. ✅ Staff can see pet data in fulfillment view (order-custom-images.liquid)

---

## Prevention Strategies

**To prevent future data loss issues**:

1. **End-to-End Testing**:
   - ALWAYS test complete order flow after property changes
   - Verify order data in Shopify admin before declaring success
   - Test with Chrome DevTools open to catch JavaScript errors

2. **Monitoring**:
   - Check first 5 orders after deployment for complete property data
   - Alert if properties missing or empty

3. **Code Review Checklist**:
   - Verify form structure (pet selector inside form tag)
   - Verify event handlers attached successfully
   - Verify localStorage keys match between storage and retrieval
   - Verify querySelector selectors match actual HTML attributes

4. **Documentation**:
   - Document localStorage key format in code comments
   - Document property names in centralized location
   - Document form submission flow in sequence diagram

---

## Status: AWAITING INVESTIGATION

**Next step**: User must run Stages 1-5 investigation steps and provide evidence (console logs, screenshots, network requests).

**Estimated time to root cause**: 30-45 minutes (with Chrome DevTools MCP)

**Estimated time to fix**: 1-2 hours (depending on root cause)
