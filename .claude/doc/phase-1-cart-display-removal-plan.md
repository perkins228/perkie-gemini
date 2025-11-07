# Phase 1: Cart Display Removal Plan

**Created**: 2025-11-04
**Task**: Remove ALL pet image and font displays from cart (drawer + page)
**User Decision**: "We should remove all pet image and font displays from the cart"

## Executive Summary

- **Total files to remove**: 1 complete file
- **Total files to modify**: 4 files
- **Total lines to remove**: ~520 lines (254 JS + ~250 Liquid/CSS + ~16 theme.liquid)
- **Risk level**: LOW
- **Estimated time**: 2-3 hours
- **Testing required**: Cart drawer + cart page verification

### What We're Removing
- Visual display of pet thumbnails in cart UI (both drawer and page)
- Visual display of font selections in cart UI
- JavaScript that populates these displays
- CSS styling for cart display elements
- Script includes in theme layout

### What We're KEEPING (Critical)
- `cart-pet-integration.js` - Core integration logic for Add to Cart
- PetStorage and all pet data storage
- Cart line item properties (`_pet_name`, `_font_style`, etc.)
- Order submission with pet/font data
- "Add to Cart" functionality

---

## Files to REMOVE Completely

### 1. assets/cart-pet-thumbnails.js

**Lines**: 254
**Purpose**: Displays customer pet thumbnails below product images in cart drawer
**Dependencies**:
- Loaded by `layout/theme.liquid` (line 468)
- Called by `cart-pet-integration.js` for manual refresh (line 951)
- Listens for cart events to update displays

**Safe to remove**: YES

**Reasoning**:
- Only handles DISPLAY logic, no cart functionality
- No other files depend on its core functionality
- `cart-pet-integration.js` has fallback when this doesn't exist

---

## Files to MODIFY

### 1. layout/theme.liquid

**Lines to remove**: 468 (and possibly 466-467)

**BEFORE** (lines 464-469):
```liquid
{%- if settings.cart_type == 'drawer' -%}
  <script src="{{ 'cart-drawer.js' | asset_url }}" defer="defer"></script>
  <script src="{{ 'pet-name-formatter.js' | asset_url }}" defer="defer"></script>
  <script src="{{ 'cart-pet-integration.js' | asset_url }}" defer="defer"></script>
  <script src="{{ 'cart-pet-thumbnails.js' | asset_url }}" defer="defer"></script>
{%- endif -%}
```

**AFTER**:
```liquid
{%- if settings.cart_type == 'drawer' -%}
  <script src="{{ 'cart-drawer.js' | asset_url }}" defer="defer"></script>
  <script src="{{ 'cart-pet-integration.js' | asset_url }}" defer="defer"></script>
{%- endif -%}
```

**Decision point**: Should we also remove `pet-name-formatter.js`?
- **YES** - This file is ONLY used for display formatting (ampersand vs comma)
- It has no cart functionality - only transforms text for display
- Remove lines 466-467 as well

---

### 2. snippets/cart-drawer.liquid

**Section 1: Pet thumbnail HTML (lines 168-217)**

**BEFORE**:
```liquid
{% if item.image %}
  {% comment %} Pet thumbnail container with mobile-first design {% endcomment %}
  <div class="cart-item__image-container"
       data-line-item="{{ forloop.index }}"
       data-variant-id="{{ item.variant_id }}"
       data-pet-name="{{ item.properties._pet_name | escape }}"
       data-has-custom-pet="{{ item.properties._has_custom_pet }}">

    {% comment %} Mobile-optimized loading skeleton {% endcomment %}
    <div class="pet-thumbnail-placeholder" style="display: none;">
      <div class="pet-loading-skeleton"></div>
    </div>

    {% comment %} Original product image link and fallback {% endcomment %}
    <a href="{{ item.url }}" class="cart-item__link" tabindex="-1" aria-hidden="true"> </a>
    <img
      class="cart-item__image cart-item__image--product"
      src="{{ item.image | image_url: width: 300 }}"
      alt="{{ item.image.alt | escape }}"
      loading="lazy"
      width="150"
      height="{{ 150 | divided_by: item.image.aspect_ratio | ceil }}"
    >

    {% comment %} Pet thumbnail overlay (hidden initially, JS will populate) {% endcomment %}
    <img
      class="cart-item__image cart-item__image--pet"
      style="display: none;"
      alt="Your pet: {{ item.properties._pet_name | escape | default: 'Custom Pet' }}"
      width="150"
      height="150"
    >

    {% comment %} Multiple pets indicator badge {% endcomment %}
    <div class="pet-count-badge" style="display: none;">
      <span class="pet-count-number"></span>
    </div>
  </div>

  {% comment %} Pet thumbnails displayed below product image {% endcomment %}
  {% if item.properties._has_custom_pet == 'true' %}
    <div class="cart-item__pets"
         data-line-item="{{ forloop.index }}"
         data-variant-id="{{ item.variant_id }}"
         data-pet-names="{{ item.properties._pet_name | escape }}"
         data-has-custom-pet="{{ item.properties._has_custom_pet }}">
      <div class="pet-thumbnails-container">
        {% comment %} Will be populated by JavaScript {% endcomment %}
      </div>
    </div>
  {% endif %}

  {% comment %} Font style display for items with custom pets AND font support {% endcomment %}
  {% if item.properties._has_custom_pet == 'true'
     and item.properties._font_style
     and item.product.metafields.custom.supports_font_styles == true %}
    <div class="cart-item__font-style">
      <small class="font-style-indicator">
        <span class="font-style-label">Font Style:</span>
        <span class="font-style-value">{{ item.properties._font_style | capitalize | escape }}</span>
      </small>
    </div>
  {% endif %}
{% endif %}
```

**AFTER**:
```liquid
{% if item.image %}
  {% comment %} Leave empty space due to a:empty CSS display: none rule {% endcomment %}
  <a href="{{ item.url }}" class="cart-item__link" tabindex="-1" aria-hidden="true"> </a>
  <img
    class="cart-item__image"
    src="{{ item.image | image_url: width: 300 }}"
    alt="{{ item.image.alt | escape }}"
    loading="lazy"
    width="150"
    height="{{ 150 | divided_by: item.image.aspect_ratio | ceil }}"
  >
{% endif %}
```

**Lines removed**: ~50 lines of pet/font display HTML

---

### 3. sections/main-cart-items.liquid

**Status**: NO CHANGES NEEDED

**Analysis**: This file (cart page, not drawer) does NOT have pet thumbnail or font display code
- Lines 92-105: Only shows standard product image
- No `cart-item__pets` containers
- No font style display sections
- Already clean - no pet/font display implementation

---

### 4. assets/component-cart-drawer.css

**Lines to remove**: 407-635 (228 lines total)

**Section 1: Pet Thumbnail Styles (lines 407-573)**

**REMOVE**:
```css
/* Pet Thumbnail Cart Styles - Mobile First Implementation */
.cart-item__image-container {
  position: relative;
  display: inline-block;
  width: 100%;
  max-width: 150px;
}

/* Pet thumbnails below product image */
.cart-item__pets {
  margin-top: 8px;
  padding: 0 4px;
  width: 100%;
  max-width: 150px;
}

.pet-thumbnails-container {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-start;
  flex-wrap: wrap;
}

/* Individual pet thumbnail */
.pet-thumbnail {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(var(--color-foreground), 0.1);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  cursor: pointer;
  /* Hardware acceleration for smooth transitions */
  transform: translateZ(0);
  will-change: transform;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* Touch feedback */
.pet-thumbnail:active {
  transform: scale(0.95) translateZ(0);
}

/* Legacy overlay styles - keeping for backwards compatibility */
.cart-item__image--pet {
  display: none; /* Hide overlay version */
}

/* Loading skeleton for mobile */
.pet-thumbnail-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading-skeleton 1.5s infinite;
  border-radius: 8px;
  z-index: 1;
}

@keyframes loading-skeleton {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Pet count badge for multiple pets */
.pet-count-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border-radius: 12px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(4px);
  /* Ensure it's above the image */
  z-index: 2;
  /* Mobile touch target size */
  min-width: 24px;
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pet-count-number::before {
  content: "🐾 ";
  margin-right: 2px;
}

/* Touch interaction feedback */
.cart-item__image-container.touch-active .cart-item__image--pet {
  transform: scale(0.98) translateZ(0);
}

.cart-item__image-container.pet-clicked .cart-item__image--pet {
  animation: pet-click-feedback 0.3s ease;
}

@keyframes pet-click-feedback {
  0% { transform: scale(1) translateZ(0); }
  50% { transform: scale(0.95) translateZ(0); }
  100% { transform: scale(1) translateZ(0); }
}

/* Loaded state */
.cart-item__image-container.pet-thumbnail-loaded .pet-thumbnail-placeholder {
  display: none;
}

/* Mobile optimizations */
@media screen and (max-width: 768px) {
  .cart-item__image-container {
    max-width: 120px;
  }

  .cart-item__pets {
    max-width: 120px;
    margin-top: 6px;
  }

  .pet-thumbnails-container {
    gap: 4px;
  }

  .pet-thumbnail {
    width: 28px;
    height: 28px;
    border-width: 1.5px;
  }

  .pet-count-badge {
    font-size: 10px;
    padding: 3px 6px;
    bottom: 4px;
    right: 4px;
  }

  /* Remove min-height that was causing elongation */
  .cart-item__image--pet {
    /* Removed min-height: 80px; - was causing elongation */
    display: none;
  }
}

/* Tablet and up */
@media screen and (min-width: 769px) {
  .pet-thumbnail:hover {
    transform: scale(1.08) translateZ(0);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
  }

  .pet-count-badge {
    transition: all 0.2s ease;
  }

  .cart-item__image-container:hover .pet-count-badge {
    transform: scale(1.1);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .cart-item__image--pet {
    border-width: 3px;
  }

  .pet-count-badge {
    border: 1px solid white;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .cart-item__image--pet,
  .pet-count-badge {
    transition: none;
    animation: none;
  }
}
```

**Section 2: Font Style Display (lines 594-635)**

**REMOVE**:
```css
/* Font style display in cart */
.cart-item__font-style {
  margin-top: 0.5rem;
  padding-left: 0.25rem;
}

.font-style-indicator {
  color: #666;
  font-size: 0.75rem;
  line-height: 1.2;
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.font-style-label {
  font-weight: 500;
}

.font-style-value {
  color: #333;
  font-weight: 600;
}

/* Mobile optimization (70% traffic) */
@media screen and (max-width: 749px) {
  .cart-item__font-style {
    margin-top: 0.375rem;
  }

  .font-style-indicator {
    font-size: 0.7rem;
  }
}

/* Desktop enhancement */
@media screen and (min-width: 750px) {
  .font-style-indicator {
    font-size: 0.8rem;
  }
}
```

**Total CSS lines removed**: 228 lines

---

### 5. assets/cart-pet-integration.js

**Status**: KEEP FILE - Only remove display-related method call

**Lines to modify**: 951 (one line change)

**BEFORE** (line 951):
```javascript
if (window.CartPetThumbnails && window.CartPetThumbnails.refresh) {
  window.CartPetThumbnails.refresh();
}
```

**AFTER**:
```javascript
// CartPetThumbnails removed - no longer displaying pet images in cart
// Pet data still stored in localStorage and cart properties for order processing
```

**Reasoning**:
- This is the ONLY reference to `CartPetThumbnails` outside of the file itself
- File contains critical cart integration logic (form fields, validation, etc.)
- We only need to remove this display refresh call
- All other functionality must remain intact

---

## What to KEEP (Critical)

### Data Storage & Processing
✅ **PetStorage** - All pet data storage in localStorage
✅ **Cart line item properties**:
- `properties[_pet_name]` - Pet names for order
- `properties[_font_style]` - Font selection for order
- `properties[_has_custom_pet]` - Flag for custom orders
- `properties[_processed_image_url]` - GCS URL for processed image
- `properties[_original_image_url]` - GCS URL for original image
- `properties[_artist_notes]` - Custom notes for artists
- `properties[_effect_applied]` - Effect selection

### JavaScript Files to KEEP
✅ **cart-pet-integration.js** - Critical cart functionality:
- Form field population
- Add to Cart button state management
- Pet data validation
- Order type handling (returning customers)
- Add-on product validation
- Storage quota management

✅ **pet-storage.js** - Core data persistence

### Why We're Keeping cart-pet-integration.js

This file handles:
1. **Form field creation** - Creates hidden `<input>` fields with pet data
2. **Button validation** - Enables/disables "Add to Cart" button
3. **Returning customer logic** - Handles repeat orders
4. **Add-on validation** - Ensures add-ons are purchased with standard products
5. **Data sanitization** - XSS prevention for pet names
6. **localStorage management** - Quota handling and cleanup

**Only removing**: Lines 951-952 that call `CartPetThumbnails.refresh()`

---

## Risk Assessment

### What Could Break

1. **Low Risk - Visual only**:
   - Cart drawer opens but shows no pet thumbnails (expected)
   - Cart page shows no pet thumbnails (expected)
   - Font selections not visible in cart (expected)

2. **Medium Risk - If not careful**:
   - If we accidentally remove cart-pet-integration.js, Add to Cart breaks
   - If we remove form field population, orders won't include pet data

3. **High Risk - Critical dependencies**:
   - Removing `properties[_pet_name]` breaks order processing
   - Removing PetStorage breaks entire pet system

### What Will Still Work

✅ **Pet selection on product pages** - Unchanged
✅ **Pet image upload and processing** - Unchanged
✅ **Add to Cart functionality** - Unchanged
✅ **Cart data properties** - Still stored with line items
✅ **Order submission** - Pet/font data still sent to Shopify
✅ **Order confirmation emails** - Still receive pet data
✅ **Artist fulfillment** - Still get all pet information

### Testing Required

**Critical Tests**:
1. Add product with custom pet to cart
2. Open cart drawer - verify NO pet thumbnails display
3. Open cart page - verify NO pet thumbnails display
4. Verify NO font display in cart
5. Proceed to checkout - verify pet data properties are still present
6. Complete test order - verify order includes pet name and URLs

**Data Verification**:
- Check cart JSON (`/cart.js`) - pet properties should exist
- Check order admin - pet data should be in line item properties
- Verify localStorage still contains pet data

---

## Implementation Order

### Step 1: Remove JavaScript (Lowest Risk First)

1. **Delete**: `assets/cart-pet-thumbnails.js` (254 lines)
2. **Modify**: `assets/cart-pet-integration.js` (line 951)
   - Comment out `CartPetThumbnails.refresh()` call

### Step 2: Remove Script Includes

3. **Modify**: `layout/theme.liquid` (lines 466-468)
   - Remove `pet-name-formatter.js` include
   - Remove `cart-pet-thumbnails.js` include

### Step 3: Remove HTML Display Code

4. **Modify**: `snippets/cart-drawer.liquid` (lines 168-229)
   - Remove pet thumbnail container HTML
   - Remove pet thumbnails display section
   - Remove font style display section
   - Restore to simple product image only

### Step 4: Remove CSS Styling

5. **Modify**: `assets/component-cart-drawer.css` (lines 407-635)
   - Remove all pet thumbnail styles
   - Remove all font style display CSS

### Step 5: Testing

6. **Test cart drawer** - Add product, verify no pet/font display
7. **Test cart page** - Navigate to `/cart`, verify clean display
8. **Test checkout** - Verify pet data still in order properties
9. **Test mobile** - Verify mobile cart drawer (70% of traffic)

---

## Rollback Strategy

### If Issues Occur

1. **Immediate rollback via git**:
   ```bash
   git status  # See what changed
   git checkout main -- <file>  # Restore individual file
   git reset --hard HEAD  # Nuclear option - restore all
   ```

2. **File-by-file restoration**:
   - Restore `cart-pet-thumbnails.js` from git history
   - Restore script includes in `theme.liquid`
   - Restore HTML sections in `cart-drawer.liquid`
   - Restore CSS in `component-cart-drawer.css`

3. **Emergency fix if cart breaks**:
   - Check browser console for JavaScript errors
   - Verify `cart-pet-integration.js` is still loaded
   - Ensure hidden form fields are still being created

### Backup Before Starting

```bash
# Create backup branch
git checkout -b backup/cart-display-removal
git push origin backup/cart-display-removal

# Return to main
git checkout main
```

---

## Files Summary

### Files to DELETE (1)
1. `assets/cart-pet-thumbnails.js` - 254 lines

### Files to MODIFY (4)
1. `layout/theme.liquid` - Remove 2-3 lines (script includes)
2. `snippets/cart-drawer.liquid` - Remove ~60 lines (pet/font HTML)
3. `assets/component-cart-drawer.css` - Remove 228 lines (styles)
4. `assets/cart-pet-integration.js` - Comment 1 line (display call)

### Files to KEEP UNCHANGED
- `assets/cart-pet-integration.js` - Keep all cart logic
- `assets/pet-storage.js` - Keep all storage logic
- `sections/main-cart-items.liquid` - Already clean
- All product page pet selection files

---

## Post-Removal Verification Checklist

### Visual Verification
- [ ] Cart drawer shows NO pet thumbnails
- [ ] Cart drawer shows NO font selections
- [ ] Cart page shows NO pet thumbnails
- [ ] Cart page shows NO font selections
- [ ] Product images display correctly
- [ ] Cart layout not broken

### Functional Verification
- [ ] Add to Cart button works
- [ ] Cart drawer opens/closes normally
- [ ] Cart page loads without errors
- [ ] Quantity updates work
- [ ] Remove from cart works
- [ ] Checkout button works

### Data Verification
- [ ] Check `/cart.js` - pet properties exist
- [ ] localStorage contains pet data
- [ ] Hidden form fields populated on product page
- [ ] Test order contains pet properties
- [ ] Order admin shows pet data

### Browser Console
- [ ] No JavaScript errors in cart drawer
- [ ] No JavaScript errors on cart page
- [ ] No missing file 404 errors
- [ ] No CSS rendering issues

---

## Timeline Estimate

**Total time**: 2-3 hours

1. **Preparation** (30 min)
   - Create backup branch
   - Read through this plan
   - Open all files in editor

2. **Implementation** (60 min)
   - Delete `cart-pet-thumbnails.js`
   - Modify `theme.liquid`
   - Modify `cart-drawer.liquid`
   - Modify `component-cart-drawer.css`
   - Modify `cart-pet-integration.js`

3. **Testing** (45 min)
   - Test cart drawer functionality
   - Test cart page functionality
   - Test checkout process
   - Verify mobile experience
   - Check browser console

4. **Deployment** (15 min)
   - Commit changes
   - Push to main
   - Monitor test environment
   - Verify live deployment

---

## Questions for User

Before proceeding with implementation:

1. **Confirmation**: Remove pet-name-formatter.js too?
   - **Recommendation**: YES - only used for display formatting

2. **Testing**: Should we test on Shopify test URL first?
   - **Recommendation**: YES - always test before production

3. **Commit strategy**: One commit or multiple?
   - **Recommendation**: Single atomic commit for easy rollback

4. **Documentation**: Update any customer-facing docs?
   - **Recommendation**: Check if any help docs mention cart display

---

## Success Criteria

### Definition of Done

✅ Cart drawer shows NO pet images
✅ Cart drawer shows NO font selections
✅ Cart page shows NO pet images
✅ Cart page shows NO font selections
✅ Add to Cart functionality works
✅ Pet data still stored in order properties
✅ Checkout includes pet information
✅ No JavaScript errors in console
✅ No broken layouts or styling
✅ Mobile cart works correctly (70% traffic)

---

## Notes

- This is a **display-only removal** - all data flow remains intact
- Pet thumbnails removed from UI but data still processed for orders
- Font selections removed from UI but data still sent to fulfillment
- Simplifies cart UI while preserving all order processing logic
- Reduces cart drawer JavaScript by ~254 lines
- Reduces CSS by ~228 lines
- Improves cart drawer performance (less DOM manipulation)

---

**Ready to proceed?** Confirm with user before implementation.
