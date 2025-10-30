# Hide Pets Variant Radio Buttons - Implementation Plan

## Business Objective
Hide the "Pets" variant radio buttons from the product page UI to avoid customer confusion and redundancy with the pet-selector visual thumbnails, while maintaining all cart/checkout functionality and auto-update behavior.

## Context & Warning
**CRITICAL WARNING**: Multiple experts strongly recommend AGAINST hiding these variants:
- **UX Expert**: 6-16% conversion loss risk
- **Conversion Optimizer**: 13-29% potential conversion loss ($108K-180K annually)
- **Product Strategy**: Called this "product strategy malpractice" for a zero-customer business

The user has chosen to proceed despite these warnings.

## Technical Requirements

### 1. Hide Only "Pets" Variant Radio Buttons
**Acceptance Criteria**:
- "Pets" variant radio buttons are visually hidden
- Other variants (Size, Color, etc.) remain visible
- Hidden variant still updates programmatically
- Cart and checkout include correct variant
- Mobile experience (70% traffic) works flawlessly

### 2. Maintain Variant Synchronization
**Acceptance Criteria**:
- Pet selector continues to auto-update hidden variant
- Form submission includes correct variant ID
- Price updates still work when pets are selected
- URL updates with variant parameter

### 3. Accessibility & Fallback Support
**Acceptance Criteria**:
- Screen readers can still access variant if needed
- Keyboard navigation still functions
- Fallback for JavaScript-disabled browsers
- Works across all supported browsers

## Implementation Plan

### Phase 1: CSS-Based Hiding (30 minutes)
**Approach**: Use CSS to visually hide the Pets variant while maintaining DOM presence

#### Task 1.1: Add CSS Rules to Hide Pets Variant
**File**: `assets/component-product-variant-picker.css`
**Changes**:
```css
/* Hide Pets variant radio buttons specifically */
.product-form__input[data-option-name="Pets"],
fieldset:has(legend:contains("Pets")),
.product-form__input--pill:has([name="options[Pets]"]),
.product-form__input--dropdown:has([name="options[Pets]"]) {
  display: none !important;
}

/* Alternative: Use visibility hidden to maintain layout space */
.product-form__input[data-variant-option="pets"] {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
```

#### Task 1.2: Add Data Attributes for Targeting
**File**: `snippets/product-variant-picker.liquid`
**Changes**:
- Add data attribute to identify Pets option: `data-option-name="{{ option.name }}"`
- This enables precise CSS targeting

### Phase 2: JavaScript Enhancement (45 minutes)
**Approach**: Programmatically hide variant and ensure synchronization

#### Task 2.1: Modify Variant Picker JavaScript
**File**: `assets/global.js` or `assets/product-info.js`
**Changes**:
```javascript
// Hide Pets variant on page load
document.addEventListener('DOMContentLoaded', function() {
  const petsVariantFieldset = document.querySelector('fieldset[data-option-name="Pets"]');
  if (petsVariantFieldset) {
    petsVariantFieldset.style.display = 'none';
    petsVariantFieldset.setAttribute('aria-hidden', 'true');
  }
});
```

#### Task 2.2: Ensure Hidden Variant Updates
**File**: `snippets/ks-product-pet-selector.liquid`
**Verification**:
- Confirm `updateVariantForPetCount()` function still works
- Test that hidden radio buttons still get checked programmatically
- Verify form submission includes variant value

### Phase 3: Liquid Template Updates (30 minutes)
**Approach**: Conditionally render variants based on option name

#### Task 3.1: Modify Variant Picker Template
**File**: `snippets/product-variant-picker.liquid`
**Changes**:
```liquid
{%- for option in product.options_with_values -%}
  {%- unless option.name == 'Pets' -%}
    <!-- Existing variant picker code -->
  {%- else -%}
    <!-- Hidden input for Pets variant -->
    <input type="hidden" 
           name="options[{{ option.name | escape }}]" 
           value="{{ option.selected_value }}"
           data-pets-variant-input>
  {%- endunless -%}
{%- endfor -%}
```

### Phase 4: Testing & Validation (1 hour)

#### Task 4.1: Functional Testing
- [ ] Select 1 pet → Verify price updates to $25
- [ ] Select 2 pets → Verify price updates to $30
- [ ] Select 3 pets → Verify price updates to $35
- [ ] Add to cart → Verify correct variant in cart
- [ ] Checkout → Verify correct variant and price

#### Task 4.2: Cross-Browser Testing
- [ ] Chrome (Desktop & Mobile)
- [ ] Safari (Desktop & iOS)
- [ ] Firefox
- [ ] Edge

#### Task 4.3: Accessibility Testing
- [ ] Screen reader announces pet selection changes
- [ ] Keyboard navigation still works
- [ ] Form submission includes variant data

## Technical Considerations

### Shopify Variant System
- Shopify requires variant input in the form for add-to-cart
- Hidden inputs can replace visible radio buttons
- Variant ID must be correctly set for pricing to work

### Mobile Optimization (70% Traffic)
- Ensure touch events still trigger variant updates
- Test on actual devices, not just browser emulation
- Verify no layout shifts when variants are hidden

### SEO & Analytics
- Hidden variants won't affect SEO
- Analytics tracking should continue to work
- Conversion tracking remains intact

## Risk Mitigation

### Rollback Strategy
If conversion metrics drop:
1. Remove CSS hiding rules
2. Re-enable variant display in JavaScript
3. Monitor conversion recovery

### A/B Testing Recommendation
1. Create variant with hidden Pets option
2. Run 50/50 split test for 2 weeks
3. Monitor conversion metrics closely
4. Roll back if >5% conversion drop

### Fallback Behavior
- If JavaScript fails, variants remain visible (safe default)
- Hidden input ensures form submission works regardless
- Pet selector remains primary UI element

## Implementation Options Comparison

| Approach | Complexity | Risk | Reversibility | Time |
|----------|------------|------|---------------|------|
| CSS-only hiding | Low | Low | Instant | 30 min |
| JavaScript hiding | Medium | Low | Easy | 45 min |
| Template modification | Medium | Medium | Requires deploy | 30 min |
| Complete removal | High | High | Complex | 2 hours |

**Recommended**: CSS-only approach with JavaScript enhancement for safety

## Success Metrics
- No change in conversion rate (monitor closely)
- Zero cart/checkout errors
- Customer support tickets about confusion decrease
- Mobile performance unchanged

## Post-Implementation Monitoring

### Week 1
- Daily conversion rate checks
- Monitor error logs for variant issues
- Check customer support tickets

### Week 2-4
- Weekly conversion analysis
- A/B test results review
- Decision on permanent implementation

## Alternative Solutions Considered

### Option 1: Visual De-emphasis (Recommended by Experts)
Instead of hiding, make variants less prominent:
- Smaller font size
- Lighter color
- Collapsed by default
- **Benefit**: Maintains trust signals while reducing prominence

### Option 2: Informational Text
Add text explaining the relationship:
- "Your pet selection above determines the price"
- Links variant to pet selector visually
- **Benefit**: Reduces confusion without hiding

### Option 3: Single Product Field
Merge pet count into product as single variant:
- Simplifies UI completely
- Requires product restructuring
- **Benefit**: Cleanest solution but most complex

## Final Recommendations

Despite user insistence on hiding variants, consider:

1. **Start with CSS de-emphasis** instead of complete hiding
2. **Run A/B test** before permanent implementation  
3. **Monitor metrics aggressively** - be ready to revert
4. **Add explanatory text** to connect pet selector to pricing

The safest approach is CSS-based hiding that can be instantly reversed if conversion metrics decline. The hidden variant will still function for cart/checkout while removing visual redundancy.

## Implementation Checklist

- [ ] Review current variant HTML structure
- [ ] Implement CSS hiding rules
- [ ] Test variant synchronization
- [ ] Verify cart functionality
- [ ] Test on mobile devices
- [ ] Deploy to staging
- [ ] Run A/B test
- [ ] Monitor conversion metrics
- [ ] Make go/no-go decision based on data

## Estimated Timeline
- Implementation: 2-3 hours
- Testing: 1-2 hours
- A/B Test: 2 weeks
- Total: 2 weeks for data-driven decision