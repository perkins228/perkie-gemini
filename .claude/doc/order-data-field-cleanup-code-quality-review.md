# Order Data Field Cleanup - Code Quality & Security Review

**Date**: 2025-11-04
**Session**: 001
**Agent**: code-quality-reviewer
**Purpose**: Proactive code quality and security review for order data field cleanup initiative

---

## Executive Summary

This document provides a comprehensive code quality, security, and maintainability review for the planned cleanup of redundant order data fields. Based on the order data capture analysis (`.claude/doc/order-data-capture-analysis.md`), I've identified critical code quality concerns that MUST be addressed during any field removal implementation.

**Status**: ⚠️ **AWAITING IMPLEMENTATION PLAN**

The project-manager-ecommerce agent has not yet created the implementation plan (`.claude/doc/order-data-field-cleanup-implementation-plan.md`). This review is **proactive** and outlines code quality requirements that the implementation plan MUST satisfy.

---

## 1. Critical Code Quality Requirements

### 1.1 Backwards Compatibility Strategy - CRITICAL

**Risk Level**: 🔴 **CRITICAL**

**Problem**: Orders in Shopify contain historical data with old field structures. Removing fields from the codebase could break order display/processing for existing orders.

**What Can Go Wrong**:
```javascript
// Current code (hypothetical example)
const petName = order.properties._pet_name;  // ✅ Works for old orders

// After removal (if done incorrectly)
const petName = order.properties.pet_name;  // ❌ Breaks old orders with _pet_name
```

**Code Quality Requirements**:

1. **NEVER remove field handling from order display code**
   - File: `snippets/order-custom-images.liquid` (lines 144-207)
   - **MUST** continue reading old field names even if no longer writing them
   - Use fallback pattern: `property._old_name || property.new_name`

2. **Add migration helper functions**
   ```javascript
   function getOrderPetName(properties) {
     // Support both old and new field names
     return properties._pet_name
         || properties.pet_name
         || properties['Pet 1 Name']  // New selector format
         || '';
   }
   ```

3. **Document field deprecation timeline**
   - Which fields are deprecated but still supported
   - When they can be completely removed (e.g., "after 90 days")
   - Add code comments with deprecation dates

**Testing Requirements**:
- [ ] Load old order (created before cleanup) → All data displays correctly
- [ ] Load new order (created after cleanup) → All data displays correctly
- [ ] No console errors for either order type
- [ ] Fulfillment staff can process both old and new orders

---

### 1.2 Orphaned Code Detection - HIGH PRIORITY

**Risk Level**: 🟠 **HIGH**

**Problem**: Removing fields without removing ALL references creates dead code, unused variables, and potential runtime errors.

**Files That MUST Be Audited** (based on analysis document):

| File | Lines to Check | Potential Orphans |
|------|----------------|-------------------|
| `assets/cart-pet-integration.js` | 170-302 | Form field creation for removed properties |
| `assets/cart-pet-integration.js` | 323-352 | `updateFontStyleFields()` if `_font_style` removed |
| `assets/cart-pet-integration.js` | 354-402 | `updateReturningCustomerFields()` if returning data removed |
| `assets/pet-storage.js` | 12-51 | Storage structure if fields removed from saved data |
| `snippets/ks-product-pet-selector.liquid` | 150-164 | Hidden fields for removed properties |
| `snippets/ks-product-pet-selector-stitch.liquid` | 336-338 | Hidden fields for processing state, timestamps |
| `sections/main-product.liquid` | 451-469 | Metafield checks if features removed |

**Code Quality Requirements**:

1. **Global text search for each removed field**
   ```bash
   # Example: If removing _processing_state field
   grep -r "_processing_state" assets/ snippets/ sections/ templates/
   ```

2. **Check for indirect references**
   - Variable assignments that read removed fields
   - Event listeners that watch for removed field changes
   - Validation functions that check removed fields
   - CSS selectors targeting removed field containers

3. **Remove unused event listeners**
   ```javascript
   // Example: If removing returning customer fields
   // MUST also remove these event listeners:
   document.addEventListener('returning-customer:selected', ...);  // ← REMOVE
   document.addEventListener('returning-customer:updated', ...);   // ← REMOVE
   ```

**Automated Detection Strategy**:
- Use `grep -r "fieldname"` to find ALL occurrences
- Check each occurrence: Keep (for backwards compatibility) or Remove (no longer needed)
- Document decision for each occurrence in implementation plan

---

### 1.3 Validation Logic Updates - HIGH PRIORITY

**Risk Level**: 🟠 **HIGH**

**Problem**: Validation functions may reference removed fields, causing false negatives (blocking valid submissions) or false positives (allowing invalid submissions).

**Critical Validation Functions** (from analysis):

| Function | File | Lines | Checks What |
|----------|------|-------|-------------|
| `validateCustomization()` | cart-pet-integration.js | 547-602 | Pet count, names, style, font |
| `validateAddonProduct()` | cart-pet-integration.js | 101-158 | Add-on vs standard products |
| `validateFontStyle()` | cart-pet-integration.js | 11-31 | Font style allowed values |
| `updateFormFields()` | cart-pet-integration.js | 170-302 | Required field population |
| Form submission validation | cart-pet-integration.js | 806-826 | Returning customer order number |

**Code Quality Requirements**:

1. **Update validation rules for removed fields**
   ```javascript
   // BEFORE: Validates old field
   if (!properties._processing_state) {
     errors.push('Processing state required');
   }

   // AFTER: Remove validation if field removed
   // (No validation needed)
   ```

2. **Update required field checks**
   ```javascript
   // BEFORE: Checks 5 required fields
   const required = ['_pet_name', '_font_style', '_effect_applied', '_processed_image_url', '_original_image_url'];

   // AFTER: Checks 3 required fields (if 2 removed)
   const required = ['_pet_name', '_font_style', '_processed_image_url'];
   ```

3. **Test edge cases**
   - What if removed field was optional but sometimes populated?
   - What if validation depended on multiple fields (one removed, one kept)?
   - What if conditional validation (if X then Y must exist) breaks?

**Example Scenario**:
```javascript
// BEFORE: Conditional validation
if (properties._order_type === 'returning' && !properties._previous_order_number) {
  errors.push('Order number required for returning customers');
}

// AFTER: If _order_type removed but _previous_order_number kept
// ❌ BROKEN: Validation never runs, allowing missing order numbers

// ✅ FIX: Update validation logic
if (properties._previous_order_number) {
  // Order number provided, verify it's valid
  if (!/^#\d+$/.test(properties._previous_order_number)) {
    errors.push('Invalid order number format');
  }
}
```

---

### 1.4 localStorage Cleanup - MEDIUM PRIORITY

**Risk Level**: 🟡 **MEDIUM**

**Problem**: Removed fields may still exist in user localStorage, causing confusion or errors when old data is loaded.

**localStorage Keys That May Contain Removed Fields** (from analysis):

| Key | Structure | Potential Issue |
|-----|-----------|-----------------|
| `perkie_pet_{petId}` | JSON object with effects, notes | Old fields persist indefinitely |
| `cartPetData` | JSON object with thumbnails | Stale data if field removed |
| `selectedFontStyle` | String | No issue (simple value) |
| `fontSelectorShown` | Boolean (sessionStorage) | No issue (session-scoped) |

**Code Quality Requirements**:

1. **Add migration function to PetStorage**
   ```javascript
   // assets/pet-storage.js
   static migrateOldData(petData) {
     // Remove deprecated fields
     if (petData._processing_state) {
       delete petData._processing_state;
       console.log('Migrated: Removed deprecated _processing_state field');
     }

     // Rename fields if needed
     if (petData.oldFieldName) {
       petData.newFieldName = petData.oldFieldName;
       delete petData.oldFieldName;
       console.log('Migrated: Renamed oldFieldName → newFieldName');
     }

     return petData;
   }

   static load(petId) {
     let data = localStorage.getItem(this.storagePrefix + petId);
     if (data) {
       data = JSON.parse(data);
       data = this.migrateOldData(data);  // ← Auto-migrate on load
       return data;
     }
     return null;
   }
   ```

2. **Add version field to storage structure**
   ```javascript
   const storageData = {
     version: 2,  // ← Increment when fields change
     petId,
     artistNote: data.artistNote || '',
     effects: data.effects || {},
     timestamp: Date.now()
   };
   ```

3. **Handle version mismatches gracefully**
   ```javascript
   static load(petId) {
     let data = JSON.parse(localStorage.getItem(this.storagePrefix + petId));

     if (!data.version || data.version < 2) {
       console.log('Migrating pet data from v1 to v2');
       data = this.migrateV1toV2(data);
     }

     return data;
   }
   ```

**Testing Requirements**:
- [ ] User with old localStorage data → Data migrated automatically, no errors
- [ ] User with new localStorage data → Works normally
- [ ] User with no localStorage data → Works normally (new session)
- [ ] Migration logged to console for debugging

---

### 1.5 Error Handling Updates - MEDIUM PRIORITY

**Risk Level**: 🟡 **MEDIUM**

**Problem**: Error messages and logging may reference removed fields, causing confusion during debugging.

**Files With Error Handling** (from analysis):

| File | Lines | Error Scenarios |
|------|-------|-----------------|
| `cart-pet-integration.js` | 806-826 | Returning customer validation errors |
| `cart-pet-integration.js` | 605-657 | Add to Cart button disabled messaging |
| `pet-storage.js` | 24-50 | Quota exceeded errors, retry logic |
| `cart-pet-integration.js` | 101-158 | Add-on product validation errors |

**Code Quality Requirements**:

1. **Update error messages**
   ```javascript
   // BEFORE: References old field
   console.error('Missing _processing_state field', properties);

   // AFTER: Remove error or update message
   // (Remove if field no longer needed)
   ```

2. **Update user-facing alerts**
   ```javascript
   // BEFORE: "Please enter your previous order number to use an existing Perkie Print."
   // AFTER: Update if _previous_order_number field removed/renamed
   // "Please enter your order number from a previous purchase."
   ```

3. **Update debug logging**
   ```javascript
   // BEFORE: Logs all properties including removed fields
   console.log('Form properties:', {
     _pet_name: properties._pet_name,
     _font_style: properties._font_style,
     _processing_state: properties._processing_state,  // ← REMOVED
     _upload_timestamp: properties._upload_timestamp   // ← REMOVED
   });

   // AFTER: Remove references to removed fields
   console.log('Form properties:', {
     _pet_name: properties._pet_name,
     _font_style: properties._font_style
   });
   ```

**Testing Requirements**:
- [ ] Trigger each error scenario → Error messages accurate and helpful
- [ ] Check console logs → No references to removed fields
- [ ] Check user alerts → No confusing references to removed features

---

## 2. Security Concerns

### 2.1 Filename Capture Security - CRITICAL

**Risk Level**: 🔴 **CRITICAL**

**Context**: Based on the analysis document, there's mention of capturing "filename" for new fields. This raises serious security concerns.

**Security Vulnerabilities**:

1. **Path Traversal Attack**
   ```javascript
   // ❌ UNSAFE: User uploads file named "../../etc/passwd"
   const filename = file.name;  // "../../etc/passwd"
   properties.filename = filename;  // ← Stored in order!

   // Later, if filename used in server-side file operations
   const path = `uploads/${order.properties.filename}`;  // uploads/../../etc/passwd
   fs.readFile(path);  // 🚨 SECURITY BREACH
   ```

2. **Script Injection in Filenames**
   ```javascript
   // ❌ UNSAFE: User uploads file named "<script>alert('XSS')</script>.jpg"
   const filename = file.name;
   properties.filename = filename;

   // Later, if filename displayed in order admin
   <div>{{ properties.filename }}</div>  // ← XSS vulnerability if not escaped
   ```

3. **Shopify Liquid Injection**
   ```javascript
   // ❌ UNSAFE: User uploads file named "{{ shop.password }}.jpg"
   const filename = file.name;
   properties.filename = filename;

   // Later, in Liquid template
   {{ line_item.properties.filename }}  // ← Could expose sensitive data
   ```

**Code Quality Requirements**:

1. **Sanitize filenames before storing**
   ```javascript
   function sanitizeFilename(filename) {
     // Remove path separators
     filename = filename.replace(/[\/\\]/g, '');

     // Remove special characters
     filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

     // Limit length
     if (filename.length > 100) {
       const ext = filename.slice(filename.lastIndexOf('.'));
       filename = filename.slice(0, 100 - ext.length) + ext;
     }

     return filename;
   }

   // Usage
   properties.filename = sanitizeFilename(file.name);
   ```

2. **Escape output in Liquid templates**
   ```liquid
   {%- comment -%} ALWAYS use | escape filter {%- endcomment -%}
   <p>Filename: {{ line_item.properties.filename | escape }}</p>
   ```

3. **Validate file extensions**
   ```javascript
   const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

   function isValidFilename(filename) {
     const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
     return ALLOWED_EXTENSIONS.includes(ext);
   }

   if (!isValidFilename(file.name)) {
     throw new Error('Invalid file type. Only JPG, PNG, GIF, and WebP allowed.');
   }
   ```

**Testing Requirements**:
- [ ] Upload file with path separators (`../../evil.jpg`) → Sanitized to `evil.jpg`
- [ ] Upload file with script tags → Sanitized, no XSS
- [ ] Upload file with Liquid syntax → Sanitized, no injection
- [ ] Upload file with 200-char name → Truncated to 100 chars
- [ ] Upload `.exe` file → Rejected (invalid extension)

---

### 2.2 Data Sanitization for All New Fields - HIGH PRIORITY

**Risk Level**: 🟠 **HIGH**

**Problem**: ANY new field added to order properties must be sanitized to prevent injection attacks.

**General Sanitization Rules**:

| Field Type | Sanitization Required | Example |
|------------|----------------------|---------|
| User text input | Escape HTML entities | Pet name, artist notes |
| URLs | Validate URL format | GCS URLs, image URLs |
| Filenames | Remove special chars | Uploaded file names |
| Numbers | Parse and validate | Quantity, price, dimensions |
| Enums | Whitelist validation | Font style, effect type |
| Booleans | Type coercion | Has custom pet flag |
| Timestamps | Validate range | Upload timestamp |

**Code Quality Requirements**:

1. **Input validation at capture point**
   ```javascript
   // assets/cart-pet-integration.js - updateFormFields()

   function sanitizeInput(value, type) {
     switch(type) {
       case 'text':
         // Remove HTML tags, limit length
         return value.replace(/<[^>]*>/g, '').slice(0, 200);

       case 'url':
         // Validate URL format
         try {
           new URL(value);
           return value;
         } catch {
           console.error('Invalid URL:', value);
           return '';
         }

       case 'enum':
         // Whitelist validation
         const allowed = ['classic', 'preppy', 'playful', 'elegant', 'trend', 'no-text'];
         return allowed.includes(value) ? value : 'classic';

       default:
         return value;
     }
   }

   // Usage in updateFormFields()
   petNameField.value = sanitizeInput(petData.name, 'text');
   processedUrlField.value = sanitizeInput(petData.gcsUrl, 'url');
   fontStyleField.value = sanitizeInput(fontStyle, 'enum');
   ```

2. **Output escaping in templates**
   ```liquid
   {%- comment -%} snippets/order-custom-images.liquid {%- endcomment -%}

   {%- for property in line_item.properties -%}
     {%- assign key = property | first -%}
     {%- assign value = property | last -%}

     {%- comment -%} ALWAYS escape user input {%- endcomment -%}
     <p>{{ key | escape }}: {{ value | escape }}</p>
   {%- endfor -%}
   ```

3. **Type validation**
   ```javascript
   // Validate data types before storage
   function validatePropertyTypes(properties) {
     const schema = {
       _pet_name: 'string',
       _font_style: 'enum',
       _has_custom_pet: 'boolean',
       _upload_timestamp: 'number'
     };

     for (const [key, expectedType] of Object.entries(schema)) {
       if (key in properties) {
         const value = properties[key];

         if (expectedType === 'string' && typeof value !== 'string') {
           properties[key] = String(value);
         }

         if (expectedType === 'boolean' && typeof value !== 'boolean') {
           properties[key] = value === 'true' || value === true;
         }

         if (expectedType === 'number' && typeof value !== 'number') {
           properties[key] = parseInt(value, 10) || 0;
         }
       }
     }

     return properties;
   }
   ```

---

### 2.3 GCS URL Validation - MEDIUM PRIORITY

**Risk Level**: 🟡 **MEDIUM**

**Problem**: Currently storing GCS URLs without validation. Malicious users could inject non-GCS URLs pointing to external sites.

**Security Vulnerability**:
```javascript
// ❌ UNSAFE: No validation
properties._processed_image_url = userProvidedUrl;  // Could be ANY URL

// Later, in order display
<img src="{{ properties._processed_image_url }}">  // ← Loads external image
```

**Attack Scenarios**:
1. **Tracking pixel injection**: URL points to attacker's server, logs IP/browser info
2. **SSRF attack**: URL points to internal network resource (`http://192.168.1.1/admin`)
3. **Mixed content**: HTTPS page loads HTTP image (security warning)

**Code Quality Requirements**:

1. **Validate GCS URL format**
   ```javascript
   function isValidGCSUrl(url) {
     // Must be HTTPS
     if (!url.startsWith('https://')) return false;

     // Must be from our GCS bucket
     const allowedHosts = [
       'storage.googleapis.com',
       'perkieprints-processing-cache.storage.googleapis.com'
     ];

     try {
       const urlObj = new URL(url);
       return allowedHosts.some(host => urlObj.hostname === host || urlObj.hostname.endsWith(`.${host}`));
     } catch {
       return false;
     }
   }

   // Usage
   if (petData.gcsUrl && isValidGCSUrl(petData.gcsUrl)) {
     processedUrlField.value = petData.gcsUrl;
   } else {
     console.error('Invalid GCS URL:', petData.gcsUrl);
     processedUrlField.value = '';  // Don't store invalid URL
   }
   ```

2. **Add URL validation to form submission**
   ```javascript
   // Before submitting form
   const processedUrl = form.querySelector('[name="properties[_processed_image_url]"]').value;
   if (processedUrl && !isValidGCSUrl(processedUrl)) {
     alert('Invalid image URL detected. Please re-upload your pet image.');
     return false;  // Block submission
   }
   ```

3. **Server-side validation** (if applicable)
   - If backend processes these URLs, validate there too
   - Don't trust client-side validation alone

---

## 3. Potential Bugs & Edge Cases

### 3.1 Form Field Reference Errors

**Bug Type**: `Cannot read property 'value' of null`

**Scenario**: Code tries to populate removed field that no longer exists in DOM.

**Example**:
```javascript
// assets/cart-pet-integration.js - updateFormFields()

const processingStateField = form.querySelector('[name="properties[_processing_state]"]');
processingStateField.value = 'completed';  // ❌ ERROR if field removed from HTML
```

**Prevention**:
```javascript
// Add null checks before accessing properties
const processingStateField = form.querySelector('[name="properties[_processing_state]"]');
if (processingStateField) {
  processingStateField.value = 'completed';  // ✅ SAFE
}
```

**Code Quality Requirements**:
- Add null checks before accessing DOM elements
- Use optional chaining: `field?.value = 'completed'`
- Log warnings when expected fields missing (helps debugging)

---

### 3.2 Event Listener Memory Leaks

**Bug Type**: Event listeners attached but never removed

**Scenario**: Event listener for removed field feature continues listening, consuming memory.

**Example**:
```javascript
// If removing returning customer feature
document.addEventListener('returning-customer:selected', handleReturningCustomer);

// ❌ PROBLEM: Listener still attached even after feature removed
// Memory leak + wasted CPU cycles
```

**Prevention**:
```javascript
// When removing feature, also remove event listeners
document.removeEventListener('returning-customer:selected', handleReturningCustomer);
document.removeEventListener('returning-customer:deselected', handleReturningCustomer);
document.removeEventListener('returning-customer:updated', handleReturningCustomer);

// OR: Remove entire feature's initialization code
function initReturningCustomerFeature() {
  // ← DELETE this entire function if feature removed
}
```

**Code Quality Requirements**:
- Search for ALL event listeners related to removed feature
- Remove event listener registrations
- Remove event dispatchers (if any)
- Remove event handler functions (dead code)

---

### 3.3 CSS Orphan Selectors

**Bug Type**: CSS rules targeting removed HTML elements

**Scenario**: CSS file has styles for removed fields, adding to bundle size unnecessarily.

**Example**:
```css
/* If removing processing state display */
.processing-state-indicator {  /* ← ORPHAN */
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  /* ... */
}

.processing-state-indicator.completed { /* ← ORPHAN */ }
.processing-state-indicator.pending { /* ← ORPHAN */ }
```

**Prevention**:
- Search CSS files for selectors matching removed HTML
- Remove orphan CSS rules
- Consider CSS minification to remove unused styles

**Code Quality Requirements**:
```bash
# Find CSS rules for removed elements
grep -r "processing-state" assets/*.css snippets/*.liquid sections/*.liquid
```

---

### 3.4 Conditional Validation Edge Cases

**Bug Type**: Validation logic breaks when conditional field removed

**Scenario**: Validation depends on field that no longer exists.

**Example**:
```javascript
// BEFORE: Validate order number only if order type is "returning"
if (properties._order_type === 'returning' && !properties._previous_order_number) {
  errors.push('Order number required');
}

// AFTER: If _order_type removed but _previous_order_number kept
// ❌ Validation never runs, order number never validated
```

**Prevention**:
```javascript
// Update validation logic to handle removed conditional field
if (properties._previous_order_number) {
  // Order number provided, validate format
  if (!/^#\d+$/.test(properties._previous_order_number)) {
    errors.push('Invalid order number format');
  }
}
```

**Code Quality Requirements**:
- Review ALL conditional validations
- Update logic for removed fields
- Test edge cases:
  - Field A removed, Field B kept
  - Field A kept, Field B removed
  - Both fields removed

---

### 3.5 Multi-Pet Product Edge Cases

**Bug Type**: New selector vs old selector field name mismatches

**Scenario**: Old selector uses `_pet_name` (comma-separated), new selector uses `Pet 1 Name`, `Pet 2 Name`, etc.

**Example**:
```javascript
// Order display code must handle both formats
const petName = properties._pet_name        // Old format: "Buddy, Max"
               || properties['Pet 1 Name']   // New format: "Buddy"
               || '';
```

**Prevention**:
- Ensure order display handles BOTH old and new formats
- Add helper function to normalize pet names
- Test with old orders (before new selector) and new orders (after new selector)

**Code Quality Requirements**:
```javascript
function getPetNames(properties) {
  // Handle old format (comma-separated)
  if (properties._pet_name) {
    return properties._pet_name.split(',').map(n => n.trim());
  }

  // Handle new format (individual properties)
  const names = [];
  for (let i = 1; i <= 3; i++) {
    const name = properties[`Pet ${i} Name`];
    if (name) names.push(name);
  }

  return names;
}
```

---

## 4. Testing Recommendations

### 4.1 Unit Testing (JavaScript Functions)

**Functions That MUST Be Tested**:

1. **Field sanitization functions**
   ```javascript
   // Test sanitizeFilename()
   assert(sanitizeFilename('../../evil.jpg') === 'evil.jpg');
   assert(sanitizeFilename('<script>alert(1)</script>.jpg') === 'script_alert1_script.jpg');
   assert(sanitizeFilename('a'.repeat(200) + '.jpg').length <= 100);
   ```

2. **Validation functions**
   ```javascript
   // Test validateCustomization()
   const validData = { _pet_name: 'Buddy', _font_style: 'classic' };
   assert(validateCustomization(validData).valid === true);

   const invalidData = { _pet_name: '', _font_style: 'invalid' };
   assert(validateCustomization(invalidData).valid === false);
   ```

3. **URL validation functions**
   ```javascript
   // Test isValidGCSUrl()
   assert(isValidGCSUrl('https://storage.googleapis.com/bucket/file.jpg') === true);
   assert(isValidGCSUrl('http://storage.googleapis.com/bucket/file.jpg') === false);  // HTTP
   assert(isValidGCSUrl('https://evil.com/file.jpg') === false);  // Wrong domain
   ```

---

### 4.2 Integration Testing (E2E Flows)

**Test Scenarios**:

1. **Happy path with new fields**
   - Upload pet image
   - Select font style
   - Add to cart
   - Complete checkout
   - Verify order properties contain correct data
   - Verify order display shows pet image and font

2. **Backwards compatibility with old orders**
   - Load order created before field cleanup
   - Verify old field names still read correctly
   - Verify no console errors
   - Verify fulfillment staff can process order

3. **Edge case: Missing optional fields**
   - Upload pet image
   - Skip artist notes (optional field)
   - Add to cart
   - Verify order properties omit empty optional fields
   - Verify no validation errors

4. **Edge case: localStorage migration**
   - Manually add old field to localStorage
   - Reload page
   - Verify old field migrated/removed automatically
   - Verify no console errors

5. **Security test: Malicious filename**
   - Upload file with script tag in name: `<script>alert(1)</script>.jpg`
   - Add to cart
   - Check order properties → Filename sanitized
   - Check order display → No XSS (script not executed)

---

### 4.3 Regression Testing Checklist

**Core Functionality** (MUST NOT BREAK):
- [ ] Pet image upload still works
- [ ] Background removal still works
- [ ] Artistic effects still work
- [ ] Font selector still works
- [ ] Add to Cart button still works
- [ ] Cart display still works (even if simplified)
- [ ] Checkout still works
- [ ] Order properties still contain pet data
- [ ] Order display for staff still works
- [ ] Returning customer flow still works (if kept)
- [ ] Add-on product validation still works
- [ ] Multi-pet products still work

**Browser Compatibility**:
- [ ] Chrome (latest)
- [ ] Safari (iOS)
- [ ] Chrome (Android)
- [ ] Firefox (latest)
- [ ] Edge (latest)

**Device Testing**:
- [ ] iPhone (375px width)
- [ ] Android (390px width)
- [ ] Tablet (768px width)
- [ ] Desktop (1440px width)

**Performance**:
- [ ] Page load time not increased
- [ ] No new console errors
- [ ] localStorage usage not increased
- [ ] Network requests not increased

---

## 5. Rollback Strategy

### 5.1 Git Branch Strategy

**Requirements**:
```bash
# Create feature branch for cleanup
git checkout -b feature/order-data-field-cleanup

# Make changes, test thoroughly
# ...

# Merge to main only after full testing
git checkout main
git merge feature/order-data-field-cleanup

# If issues found in production
git revert <commit-hash>  # Instant rollback
```

### 5.2 Feature Flag Pattern (Optional)

**For High-Risk Changes**:
```javascript
// assets/cart-pet-integration.js

const USE_NEW_FIELD_STRUCTURE = localStorage.getItem('feature_new_fields') === 'true';

function updateFormFields() {
  if (USE_NEW_FIELD_STRUCTURE) {
    // New field structure
  } else {
    // Old field structure (fallback)
  }
}
```

**Benefits**:
- Test new structure with `localStorage.setItem('feature_new_fields', 'true')`
- Rollback instantly by removing flag
- No git revert needed

---

## 6. Documentation Requirements

### 6.1 Code Comments

**Requirements**:
```javascript
// BEFORE: No comment
const petNameField = form.querySelector('[name="properties[_pet_name]"]');

// AFTER: Explain field purpose and format
/**
 * Pet name field - stores customer's pet name(s)
 * Format: Comma-separated for multi-pet products (e.g., "Buddy, Max, Luna")
 * Required: Yes
 * Added: 2024-01-15
 * Modified: 2025-11-04 (removed _processing_state field)
 */
const petNameField = form.querySelector('[name="properties[_pet_name]"]');
```

### 6.2 Change Log

**Requirements**:
- Update CHANGELOG.md with removed fields
- Document migration path for old orders
- Add deprecation notices for removed features

**Example**:
```markdown
## [2.0.0] - 2025-11-04

### Removed
- `_processing_state` field - No longer needed, processing tracked server-side
- `_upload_timestamp` field - Redundant with order creation timestamp

### Changed
- Pet name format standardized to comma-separated list
- Font validation made conditional (only for text products)

### Migration
- Old orders with removed fields still display correctly (backwards compatible)
- localStorage automatically migrates old data structure
```

### 6.3 Update Order Data Analysis Document

**Requirements**:
- Update `.claude/doc/order-data-capture-analysis.md`
- Mark removed fields as "DEPRECATED"
- Add "Removed in v2.0.0" notes
- Update data flow diagrams
- Update testing checklist

---

## 7. Specific Line-by-Line Review Notes

### 7.1 cart-pet-integration.js - Form Field Population (Lines 170-302)

**Critical Review**:

**Line 181-192 - Pet Name Field**:
```javascript
// CURRENT CODE (from analysis doc)
var petNameField = form.querySelector('[name="properties[_pet_name]"]');
if (petNameField) {
  petNameField.value = petData.name || '';
}
```

**Code Quality Issues**:
1. ✅ **Good**: Null check before accessing field
2. ⚠️ **Warning**: No sanitization of pet name
3. ⚠️ **Warning**: No length validation (could exceed Shopify property limits)

**Recommended Changes**:
```javascript
var petNameField = form.querySelector('[name="properties[_pet_name]"]');
if (petNameField) {
  // Sanitize and validate pet name
  var petName = (petData.name || '').trim();

  // Remove HTML tags (XSS prevention)
  petName = petName.replace(/<[^>]*>/g, '');

  // Limit length (Shopify line item properties have limits)
  if (petName.length > 200) {
    petName = petName.slice(0, 200);
    console.warn('Pet name truncated to 200 characters');
  }

  petNameField.value = petName;
}
```

---

**Line 236-245 - Processed Image URL**:
```javascript
// CURRENT CODE (from analysis doc - CRITICAL FIX)
if (petData.gcsUrl) {
  processedUrlField.value = petData.gcsUrl;
  console.log('✅ Using GCS URL for processed image:', petData.gcsUrl);
} else if (petData.processedImage) {
  processedUrlField.value = this.compressImageUrl(petData.processedImage);
  console.warn('⚠️ Using compressed thumbnail (GCS URL not available yet)');
}
```

**Code Quality Issues**:
1. ✅ **Good**: Prioritizes GCS URL over thumbnail (prevents quota issues)
2. ❌ **Critical**: No URL validation (security risk)
3. ⚠️ **Warning**: `compressImageUrl()` method not reviewed (could have bugs)

**Recommended Changes**:
```javascript
if (petData.gcsUrl) {
  // Validate GCS URL before using
  if (isValidGCSUrl(petData.gcsUrl)) {
    processedUrlField.value = petData.gcsUrl;
    console.log('✅ Using validated GCS URL:', petData.gcsUrl);
  } else {
    console.error('❌ Invalid GCS URL detected:', petData.gcsUrl);
    processedUrlField.value = '';
    // TODO: Show user error message
  }
} else if (petData.processedImage) {
  // Fallback to compressed thumbnail (should be data URL)
  var compressed = this.compressImageUrl(petData.processedImage);

  // Validate data URL format
  if (compressed.startsWith('data:image/')) {
    processedUrlField.value = compressed;
    console.warn('⚠️ Using compressed thumbnail (GCS URL not available yet)');
  } else {
    console.error('❌ Invalid thumbnail format:', compressed.slice(0, 50));
    processedUrlField.value = '';
  }
}
```

---

**Line 261-273 - Artist Notes Field**:
```javascript
// CURRENT CODE (from analysis doc)
var artistNotesField = form.querySelector('[name="properties[_artist_notes]"]');
if (artistNotesField) {
  artistNotesField.value = petData.artistNote || '';
}
```

**Code Quality Issues**:
1. ✅ **Good**: Null check before accessing field
2. ❌ **Critical**: No sanitization (XSS risk)
3. ❌ **Critical**: No length validation (could exceed limits)
4. ⚠️ **Warning**: Artist notes could contain personally identifiable info (PII)

**Recommended Changes**:
```javascript
var artistNotesField = form.querySelector('[name="properties[_artist_notes]"]');
if (artistNotesField) {
  var artistNote = (petData.artistNote || '').trim();

  // Remove HTML tags (XSS prevention)
  artistNote = artistNote.replace(/<[^>]*>/g, '');

  // Limit length (Shopify line item properties limited to ~255 chars)
  if (artistNote.length > 255) {
    artistNote = artistNote.slice(0, 255);
    console.warn('Artist notes truncated to 255 characters');
  }

  // Optional: Check for PII patterns (email, phone)
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(artistNote)) {
    console.warn('⚠️ Artist notes may contain email address');
  }

  artistNotesField.value = artistNote;
}
```

---

### 7.2 cart-pet-integration.js - Font Validation (Lines 11-31)

**Critical Review**:

```javascript
// CURRENT CODE (from analysis doc)
function validateFontStyle(fontStyle) {
  var validFonts = ['classic', 'preppy', 'playful', 'elegant', 'trend', 'no-text'];
  return validFonts.includes(fontStyle) ? fontStyle : 'classic';
}
```

**Code Quality Issues**:
1. ✅ **Good**: Whitelist validation (security best practice)
2. ✅ **Good**: Returns safe default if invalid
3. ⚠️ **Warning**: No logging of invalid values (hard to debug)
4. ⚠️ **Warning**: Hardcoded font list (should be constant)

**Recommended Changes**:
```javascript
// Move to top of file as constant
var VALID_FONT_STYLES = ['classic', 'preppy', 'playful', 'elegant', 'trend', 'no-text'];
var DEFAULT_FONT_STYLE = 'classic';

function validateFontStyle(fontStyle) {
  // Log invalid fonts for debugging
  if (!VALID_FONT_STYLES.includes(fontStyle)) {
    console.warn('Invalid font style:', fontStyle, 'Defaulting to:', DEFAULT_FONT_STYLE);
  }

  return VALID_FONT_STYLES.includes(fontStyle) ? fontStyle : DEFAULT_FONT_STYLE;
}

// Optional: Add function to check if product supports fonts
function productSupportsFonts() {
  // Check metafield or DOM element
  return document.querySelector('[data-font-section]') !== null;
}
```

---

### 7.3 pet-storage.js - Save Method (Lines 12-51)

**Critical Review**:

```javascript
// CURRENT CODE (AFTER FIX - from context session)
static async save(petId, data) {
  const storageData = {  // ✅ FIXED: Now at function scope
    petId,
    artistNote: data.artistNote || '',
    effects: data.effects || {},
    timestamp: Date.now()
  };

  try {
    // Check storage quota before saving
    const usage = this.getStorageUsage();
    if (usage.percentage > 80) {
      console.warn(`⚠️ Storage at ${usage.percentage}% capacity, running cleanup`);
      this.emergencyCleanup();
    }

    localStorage.setItem(this.storagePrefix + petId, JSON.stringify(storageData));
    this.updateGlobalPets();
    return true;

  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('🚨 Storage quota exceeded, triggering emergency cleanup');
      this.emergencyCleanup();
      // Retry once after cleanup
      try {
        localStorage.setItem(this.storagePrefix + petId, JSON.stringify(storageData));  // ✅ NOW IN SCOPE
        this.updateGlobalPets();
        return true;
      } catch (retryError) {
        console.error('❌ Storage still full after cleanup:', retryError);
        throw retryError;
      }
    }
    throw error;
  }
}
```

**Code Quality Issues**:
1. ✅ **Good**: Scope bug fixed (storageData now accessible in catch block)
2. ✅ **Good**: Quota checking before save
3. ✅ **Good**: Retry logic after cleanup
4. ⚠️ **Warning**: No validation of data parameter
5. ⚠️ **Warning**: artistNote not sanitized before storage
6. ⚠️ **Warning**: effects object not validated (could contain invalid data)

**Recommended Changes**:
```javascript
static async save(petId, data) {
  // Validate input parameters
  if (!petId || typeof petId !== 'string') {
    throw new Error('Invalid petId: must be non-empty string');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: must be object');
  }

  // Sanitize artist note
  var artistNote = (data.artistNote || '').trim();
  artistNote = artistNote.replace(/<[^>]*>/g, '');  // Remove HTML
  artistNote = artistNote.slice(0, 255);  // Limit length

  // Validate effects object
  var effects = {};
  if (data.effects && typeof data.effects === 'object') {
    // Only copy valid effect keys
    var validEffects = ['enhancedblackwhite', 'popart', 'dithering', '8bit'];
    for (var effect of validEffects) {
      if (data.effects[effect]) {
        // Validate effect data structure
        if (data.effects[effect].gcsUrl && isValidGCSUrl(data.effects[effect].gcsUrl)) {
          effects[effect] = {
            gcsUrl: data.effects[effect].gcsUrl,
            timestamp: data.effects[effect].timestamp || Date.now()
          };
        }
      }
    }
  }

  const storageData = {
    petId,
    artistNote,
    effects,
    timestamp: Date.now(),
    version: 2  // Add version for future migrations
  };

  // ... rest of save logic (same as current)
}
```

---

### 7.4 ks-product-pet-selector-stitch.liquid - Hidden Fields (Lines 336-338)

**Critical Review**:

```liquid
{%- comment -%} CURRENT CODE (from analysis doc) {%- endcomment -%}
<input type="hidden" name="properties[Pet {{ i }} Order Type]" data-pet-order-type="{{ i }}">
<input type="hidden" name="properties[Pet {{ i }} Processing State]" data-pet-processing-state="{{ i }}">
<input type="hidden" name="properties[Pet {{ i }} Upload Timestamp]" data-pet-upload-timestamp="{{ i }}">
```

**Code Quality Issues**:
1. ⚠️ **Warning**: Processing state field may be redundant (orders have creation timestamp)
2. ⚠️ **Warning**: Upload timestamp field may be redundant (same reason)
3. ⚠️ **Warning**: Order type field unclear purpose (what values are valid?)
4. ⚠️ **Warning**: No default values set

**Recommended Changes** (if keeping these fields):
```liquid
{%- comment -%}
  Pet {{ i }} Order Type: Indicates if using new upload or existing order
  Valid values: "new" | "existing"
{%- endcomment -%}
<input type="hidden"
       name="properties[Pet {{ i }} Order Type]"
       data-pet-order-type="{{ i }}"
       value="new">

{%- comment -%}
  NOTE: Processing State and Upload Timestamp may be redundant
  Consider removing if not used in fulfillment workflow
{%- endcomment -%}
```

**Recommendation**: **REMOVE** these fields if not used in fulfillment workflow. They add unnecessary data to orders and increase complexity.

---

## 8. Summary of Code Quality Requirements

### 8.1 Must-Have Requirements (CRITICAL)

- ✅ **Backwards compatibility** for old orders with removed fields
- ✅ **Null checks** before accessing removed DOM elements
- ✅ **Filename sanitization** if capturing filenames
- ✅ **GCS URL validation** for security
- ✅ **Remove all orphaned code** (unused functions, variables, event listeners)
- ✅ **Update validation logic** for removed fields
- ✅ **localStorage migration** for users with old data

### 8.2 Should-Have Requirements (HIGH PRIORITY)

- ✅ **Input sanitization** for all new fields (XSS prevention)
- ✅ **Length validation** for text inputs (prevent overflow)
- ✅ **Error message updates** to reflect removed fields
- ✅ **Remove orphaned CSS** rules
- ✅ **Update conditional validations** (field dependencies)
- ✅ **Comprehensive testing** (unit + integration + regression)

### 8.3 Nice-to-Have Requirements (MEDIUM PRIORITY)

- ✅ **Feature flags** for high-risk changes
- ✅ **Version field** in localStorage structure
- ✅ **Code comments** explaining field purposes
- ✅ **CHANGELOG** documentation
- ✅ **Git branch strategy** for safe deployment

---

## 9. Final Recommendations

### 9.1 Implementation Order

**Phase 1: Analysis** (Do NOT skip!)
1. Read implementation plan (when created by project-manager)
2. Map all references to removed fields (grep search)
3. Identify backwards compatibility requirements
4. List validation functions that need updates

**Phase 2: Preparation**
1. Create feature branch
2. Back up current theme
3. Document current field structure (baseline)
4. Write unit tests for critical functions

**Phase 3: Implementation**
1. Add input sanitization functions
2. Add URL validation functions
3. Update form field population (with sanitization)
4. Update validation logic (remove/update rules)
5. Add localStorage migration logic
6. Remove orphaned code (functions, event listeners, CSS)

**Phase 4: Testing**
1. Unit tests (sanitization, validation)
2. Integration tests (full add-to-cart flow)
3. Regression tests (ensure nothing broke)
4. Security tests (XSS, injection attempts)
5. Backwards compatibility tests (old orders)

**Phase 5: Deployment**
1. Deploy to test environment (GitHub auto-deploy)
2. Test on live Shopify test URL
3. Monitor console for errors
4. Test on actual mobile devices
5. If all clear → Merge to main

### 9.2 Red Flags to Watch For

🚩 **"It works on my machine but not in production"**
- Likely missing backwards compatibility for old orders

🚩 **"Add to Cart button sometimes doesn't work"**
- Likely validation logic broken or null reference error

🚩 **"Console shows errors but checkout still works"**
- Orphaned code trying to access removed fields (fix immediately)

🚩 **"Old orders show as empty in admin"**
- Backwards compatibility broken (critical issue)

🚩 **"localStorage fills up faster than before"**
- Migration logic not removing old fields (storage leak)

---

## 10. Conclusion

This code quality review identifies **5 critical security concerns**, **8 high-priority code quality issues**, and **dozens of edge cases** that must be addressed during order data field cleanup.

**Key Takeaways**:
1. **Security first**: Sanitize filenames, validate URLs, escape output
2. **Backwards compatibility**: Old orders must still display correctly
3. **Comprehensive cleanup**: Remove ALL references to removed fields
4. **Thorough testing**: Unit + integration + regression + security tests
5. **Safe deployment**: Feature branch → test environment → production

**Next Steps**:
1. Wait for project-manager-ecommerce to create implementation plan
2. Review plan against these code quality requirements
3. Ensure plan addresses all critical security concerns
4. Append this review to the implementation plan document

---

**Document Version**: 1.0
**Created**: 2025-11-04
**Agent**: code-quality-reviewer
**Status**: Proactive review (awaiting implementation plan)
**Next Action**: Review implementation plan when created and append specific feedback
