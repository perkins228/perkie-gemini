# Pet Name Font Selection - Technical Specification

**Created**: 2025-09-20
**Project Manager**: Claude (project-manager-ecommerce)
**Status**: Implementation Plan Ready

## Business Objective

Create a robust, consistent pet name font selection system that supports 40% of customers who prefer "Blank" (no name) products, while ensuring clear order fulfillment, proper validation, and seamless multi-product cart experiences across 70% mobile traffic.

## Technical Requirements

### 1. Font Style Validation & Consistency
**Acceptance Criteria**:
- Font validation arrays must be synchronized across all components
- "no-text" option must be recognized as a valid font style
- Default to "classic" only when no valid selection exists
- Prevent mismatch between UI selection and cart data

### 2. Race Condition Prevention
**Acceptance Criteria**:
- Font selector only becomes visible after pet selection
- Font selection must validate that at least one pet exists
- Clear visual feedback when font selector is disabled/waiting
- Proper state management between pet and font selection

### 3. Product-Specific Font Support
**Acceptance Criteria**:
- Products with `product.metafields.custom.supports_font_styles == false` hide font selector completely
- Font data cleared from cart properties when product doesn't support fonts
- Visual indicator on product page showing font customization availability
- Consistent behavior across product catalog

### 4. "Blank" Option Business Logic
**Acceptance Criteria**:
- When "Blank" (no-text) selected: Pet name not rendered on product preview or final product
- Font style property still tracked as "no-text" for fulfillment records
- Order details show "Style: No Name" for clarity to production team
- Cart displays "No pet name will be printed" message for customer confirmation

### 5. Multi-Product Cart Scenarios
**Acceptance Criteria**:
- Font selection is per-product (not global)
- Each cart item maintains its own font style property
- Same pet can have different font styles on different products
- Cart clearly displays font choice per item when applicable

### 6. Order Fulfillment Requirements
**Acceptance Criteria**:
- "Blank" orders include property: `_font_style: "no-text"`
- Production dashboard shows "NO TEXT" badge for blank orders
- Font style always tracked even when no text shown (for analytics)
- Clear visual distinction in order details between blank and text products

## Implementation Plan

### Phase 1: Fix Validation Mismatch & Race Conditions (Priority: CRITICAL)
**Timeline**: 2-3 hours
**Risk**: Low - Code changes only

#### Task 1.1: Synchronize Font Validation Arrays → Code Agent
- **File**: `assets/cart-pet-integration.js`
- **Change**: Update line 13 from `['classic', 'modern', 'playful', 'elegant']` to `['classic', 'playful', 'elegant', 'no-text']`
- **Note**: Remove 'modern' (deprecated), add 'no-text' for blank option

#### Task 1.2: Add Pet Existence Validation → Code Agent
- **File**: `snippets/pet-font-selector.liquid`
- **Change**: Add JavaScript validation in font change handler (line 302-350)
  - Check if `localStorage.getItem('selectedPets')` exists and has pets
  - If no pets, show alert "Please select a pet first" and reset to default
  - Disable font selector until pet selected

#### Task 1.3: Implement Font Selector State Management → Code Agent
- **File**: `snippets/pet-font-selector.liquid`
- **Change**: Modify initial display logic (line 7)
  - Add `data-requires-pet="true"` attribute
  - Add CSS class `.font-selector--disabled` when no pet selected
  - Update opacity and pointer-events in disabled state

### Phase 2: Product-Specific Font Support (Priority: HIGH)
**Timeline**: 3-4 hours
**Risk**: Medium - Requires metafield setup

#### Task 2.1: Create Font Support Metafield → Shopify Admin
- **Metafield**: `product.metafields.custom.supports_font_styles`
- **Type**: Boolean (true/false)
- **Default**: true for existing products
- **Products to set false**: Accessories, digital products, non-customizable items

#### Task 2.2: Implement Conditional Font Selector → Code Agent
- **File**: `sections/main-product.liquid`
- **Change**: Enhance existing conditional (line ~1200)
  ```liquid
  {% if product.metafields.custom.supports_font_styles != false %}
    {% render 'pet-font-selector' %}
  {% endif %}
  ```
- **Note**: Use != false to default to showing when metafield not set

#### Task 2.3: Add Font Support Indicator → UX Agent
- **File**: `snippets/ks-product-pet-selector.liquid`
- **Change**: Add visual badge near pet selector
  - "✓ Name customization available" when true
  - Hidden when false
- **Mobile optimization**: Small icon instead of text on mobile

#### Task 2.4: Clear Font Data for Non-Supporting Products → Code Agent
- **File**: `assets/cart-pet-integration.js`
- **Change**: Add product validation in `updateFormFields` (line 55)
  - Check `window.productSupportsFonts` flag
  - If false, don't create/update font style field
  - Clear any existing font selection from localStorage

### Phase 3: Enhanced "Blank" Option Handling (Priority: HIGH)
**Timeline**: 2-3 hours
**Risk**: Low - UI/UX changes

#### Task 3.1: Update Cart Display for Blank Option → Code Agent
- **File**: `snippets/cart-item.liquid` (or equivalent cart display)
- **Change**: Add conditional display logic
  ```liquid
  {% if item.properties._font_style == 'no-text' %}
    <p class="cart-item__note">No pet name will be printed</p>
  {% elsif item.properties._font_style %}
    <p class="cart-item__note">Font: {{ item.properties._font_style | capitalize }}</p>
  {% endif %}
  ```

#### Task 3.2: Update Order Confirmation Display → Code Agent
- **File**: `templates/customers/order.liquid`
- **Change**: Similar conditional for order details
  - Show "Style: No Name" for no-text option
  - Show "Font Style: [Style]" for others

#### Task 3.3: Add Production Badge for Blank Orders → Code Agent
- **File**: Admin order display customization (if applicable)
- **Change**: Add visual badge "NO TEXT" for orders with `_font_style: "no-text"`
- **Note**: May require Shopify Flow or admin API customization

### Phase 4: Multi-Product Cart Enhancement (Priority: MEDIUM)
**Timeline**: 4-5 hours
**Risk**: Medium - Complex state management

#### Task 4.1: Implement Per-Product Font Storage → Code Agent
- **File**: `assets/cart-pet-integration.js`
- **Change**: Modify storage structure
  ```javascript
  // From: localStorage.setItem('selectedFontStyle', style)
  // To: Product-specific storage
  var fontStyles = JSON.parse(localStorage.getItem('productFontStyles') || '{}');
  fontStyles[productId] = style;
  localStorage.setItem('productFontStyles', JSON.stringify(fontStyles));
  ```

#### Task 4.2: Update Font Selector Initialization → Code Agent
- **File**: `snippets/pet-font-selector.liquid`
- **Change**: Read product-specific font on page load
  - Get current product ID from page context
  - Load font style for this specific product
  - Default to 'classic' if none stored

#### Task 4.3: Enhanced Cart Display for Multiple Products → UX Agent
- **File**: Cart drawer/page templates
- **Change**: Show font style per line item with clear visual separation
- **Mobile**: Compact display with abbreviations (C for Classic, P for Playful, etc.)

### Phase 5: Testing & Monitoring (Priority: HIGH)
**Timeline**: 2-3 hours
**Risk**: Low - Testing only

#### Task 5.1: Create Comprehensive Test Suite → QA Agent
- **Tests**:
  - Blank option selection and cart display
  - Product without font support
  - Multiple products with different fonts
  - Pet selection → font selection flow
  - Mobile touch interactions

#### Task 5.2: Add Analytics Tracking → Analytics Agent
- **Events**:
  - Font style selection (track which styles most popular)
  - Blank option selection rate (validate 40% assumption)
  - Font selector abandonment (user sees but doesn't select)
  - Conversion rate by font style

#### Task 5.3: Create Fulfillment Documentation → Documentation Agent
- **Document**: How to handle blank/no-text orders
- **Include**: Screenshots of order badges, production notes
- **Training**: Quick guide for fulfillment team

## Technical Considerations

### Performance
- Font selector CSS/JS already loaded - no additional bundle impact
- localStorage used for persistence - instant, no API calls
- Validation functions are lightweight (< 1ms execution)

### Mobile Optimization (70% traffic)
- Touch targets meet WCAG 2.5.5 (48x48px minimum)
- Font previews large enough for mobile readability (1.75rem)
- Grid layout responsive (2 columns mobile, 5 desktop)
- Disable state clearly visible on mobile

### Backwards Compatibility
- Existing orders with 'modern' font will still display correctly
- Missing metafields default to showing font selector (safe default)
- Validation functions handle legacy data gracefully

### Security
- Input sanitization prevents XSS in pet names
- Font style validation prevents injection attacks
- Length limits prevent localStorage quota issues

### Integration Points
- **Cart API**: Properties passed correctly via form fields
- **Shopify Admin**: Metafields accessible in admin
- **Order Fulfillment**: Properties visible in packing slips
- **Email Notifications**: Font style included in order confirmation

## Success Metrics

### Primary KPIs
- **Blank option usage**: Track if 40% assumption holds
- **Cart abandonment**: No increase after implementation
- **Support tickets**: Reduction in font-related confusion
- **Order accuracy**: 0% wrong font style fulfillments

### Secondary Metrics
- **Font selector engagement**: % of users who interact
- **Time to selection**: Average time from pet to font selection
- **Mobile conversion**: Maintained or improved on mobile
- **Page load performance**: No degradation in Core Web Vitals

### A/B Testing Plan
- **Control**: Current implementation (with bugs)
- **Variant A**: Fixed validation + blank option handling
- **Variant B**: A + product-specific font support
- **Duration**: 2 weeks per variant
- **Sample size**: 1000 orders minimum per variant

## Risk Mitigation

### Potential Issues & Solutions

1. **Customer Confusion About Blank Option**
   - Solution: Clear "No Name" preview in selector
   - Confirmation message in cart
   - FAQ section explaining blank option

2. **Fulfillment Errors with Blank Orders**
   - Solution: Bold "NO TEXT" badge in admin
   - Automated flag in packing slip
   - Training session for fulfillment team

3. **Performance Impact on Mobile**
   - Solution: Lazy load font selector after pet selection
   - Optimize CSS animations for mobile
   - Reduce reflows during state changes

4. **localStorage Quota Issues**
   - Solution: Implement cleanup for old font selections
   - Limit storage to last 10 products
   - Fall back to session storage if quota exceeded

## Implementation Timeline

**Week 1**:
- Day 1-2: Phase 1 - Fix validation and race conditions
- Day 3-4: Phase 2 - Product-specific font support
- Day 5: Phase 3 - Blank option enhancement

**Week 2**:
- Day 1-3: Phase 4 - Multi-product cart enhancement
- Day 4-5: Phase 5 - Testing and monitoring setup

**Week 3**:
- Day 1-2: Bug fixes from testing
- Day 3: Fulfillment team training
- Day 4-5: A/B test setup and launch

## Next Steps

1. **Immediate Actions** (Today):
   - Fix validation array mismatch (Task 1.1) - 10 minutes
   - Deploy to staging for testing
   - Create Shopify metafield for font support

2. **Tomorrow**:
   - Implement race condition prevention (Task 1.2-1.3)
   - Begin product metafield population
   - Create test cases for QA

3. **This Week**:
   - Complete Phase 1-3
   - Coordinate with fulfillment team on blank orders
   - Set up analytics tracking

## Appendix: Code Snippets

### Fixed Validation Array
```javascript
// assets/cart-pet-integration.js - Line 13
var allowedFonts = ['classic', 'playful', 'elegant', 'no-text'];
```

### Pet Existence Check
```javascript
// snippets/pet-font-selector.liquid - Add to change handler
var selectedPets = localStorage.getItem('selectedPets');
if (!selectedPets || selectedPets === '[]') {
  alert('Please select a pet before choosing a font style');
  radio.checked = false;
  document.querySelector('[value="classic"]').checked = true;
  return;
}
```

### Product-Specific Storage
```javascript
// New structure for multi-product support
{
  "productFontStyles": {
    "12345": "classic",
    "67890": "no-text",
    "54321": "playful"
  }
}
```

### Cart Display Logic
```liquid
{% comment %} Enhanced cart item display {% endcomment %}
{% if item.properties._has_custom_pet == 'true' %}
  <div class="cart-item__pet-customization">
    {% if item.properties._font_style == 'no-text' %}
      <span class="cart-item__no-text-badge">No name will be printed</span>
    {% else %}
      <span class="cart-item__font-style">Font: {{ item.properties._font_style | capitalize }}</span>
    {% endif %}
  </div>
{% endif %}
```

## Document History
- 2025-09-20: Initial technical specification created
- Addresses context from session_001.md analysis
- Incorporates findings from debug analysis document