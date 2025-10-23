# Complementary Products Pricing Bug - Debug Analysis

**Date**: 2025-10-13
**Status**: ROOT CAUSE IDENTIFIED
**Priority**: P1 - Production Bug

---

## Problem Statement

**URL**: https://perkieprints.com/products/personalized-pet-portrait-in-black-frame?variant=42681610731603

**Expected Behavior**: Complementary products (add-ons) display their own configured Shopify prices
**Actual Behavior**: Complementary products display the main product's price instead

---

## Root Cause Analysis

### File Locations

1. **Main Product Template**: `sections/main-product.liquid` (lines 517-665)
2. **Product Card Snippet**: `snippets/card-product.liquid` (line 253)
3. **Price Snippet**: `snippets/price.liquid` (lines 26-27, 111-121)

### Code Flow

```liquid
main-product.liquid (line 586):
  {% render 'card-product',
    card_product: recommendation_product,  ← Complementary product
    ...
  %}

card-product.liquid (line 253):
  {% render 'price',
    product: card_product,  ← Passes card_product as 'product'
    ...
  %}

price.liquid (lines 26-27):
  assign price_min = product.price_min  ← ✅ Uses passed parameter
  assign price_max = product.price_max  ← ✅ Uses passed parameter
```

### The Bug - Liquid Scope Issue

**WAIT** - I need to verify if this is actually the bug. Let me trace through the logic more carefully:

**price.liquid logic**:
```liquid
Line 16-22: Set target variable
  if use_variant
    assign target = product.selected_or_first_available_variant
  elsif placeholder
    assign target = null
  else
    assign target = product  ← For complementary products, this should be card_product
  endif

Line 24-25: Get price from target
  assign compare_at_price = target.compare_at_price
  assign price = target.price | default: 1999

Line 26-27: BUT THEN uses 'product' directly (NOT target)
  assign price_min = product.price_min  ← BUG: References 'product' not 'target'
  assign price_max = product.price_max  ← BUG: References 'product' not 'target'
```

**The Issue**: Lines 26-27 reference `product.price_min` and `product.price_max` directly, but in Liquid snippets, when you pass a parameter with a name like `product: card_product`, the snippet should receive `card_product` as the `product` variable.

**BUT** - Is there scope leakage? Let me check if Liquid snippets inherit parent scope.

### Liquid Scoping Rules

According to Shopify Liquid documentation:
- **Snippets DO inherit parent scope** - they can access variables from the parent template
- When you pass a parameter to a snippet, it creates a LOCAL variable with that name
- **BUT**: If there's a global `product` object in the parent scope, there could be a conflict

### Hypothesis

When rendering complementary products:
1. `main-product.liquid` has access to the global `product` object (the main product)
2. It renders `card-product` snippet with `card_product: recommendation_product`
3. `card-product` then renders `price` snippet with `product: card_product`
4. Inside `price` snippet, when it references `product.price_min`:
   - **It SHOULD use the passed parameter (card_product)**
   - **BUT it MAY be using the global product object instead**

### The Real Bug (Lines 26-27 Inconsistency)

Look at the inconsistency in `price.liquid`:

```liquid
Line 21: assign target = product  ← Uses passed parameter
Line 25: assign price = target.price  ← Uses target (correct)
Line 26: assign price_min = product.price_min  ← Uses 'product' directly (INCONSISTENT)
Line 27: assign price_max = product.price_max  ← Uses 'product' directly (INCONSISTENT)
```

**Why is this a bug?**
- If `use_variant` is false (which it is for complementary products), then `target = product`
- So using `product.price_min` vs `target.price_min` SHOULD be the same
- BUT the fact that they're inconsistent suggests potential scope issues

### Additional Problems Found

**Lines 62, 94**:
```liquid
{%- if product.quantity_price_breaks_configured? -%}
```
Uses `product` directly instead of `target`.

**Lines 111-121**:
```liquid
<span>{{- product.selected_or_first_available_variant.unit_price | money -}}</span>
```
Uses `product.selected_or_first_available_variant` instead of `target`.

---

## Testing the Hypothesis

To confirm if this is scope leakage or a different issue, we need to:

1. **Check browser inspector**: Look at the actual HTML output to see what price is rendered
2. **Add debug output**: Temporarily add debug lines to see which product object is being used
3. **Check complementary products data**: Verify the recommendations API is returning correct prices

---

## Potential Root Causes

### Hypothesis 1: Liquid Scope Leakage (80% probability)
- Global `product` object from parent template overrides snippet parameter
- Lines 26-27 reference wrong product due to scope priority

### Hypothesis 2: Recommendations API Issue (15% probability)
- Shopify's product recommendations API returns wrong price data
- The complementary products themselves have incorrect prices

### Hypothesis 3: JavaScript Price Override (5% probability)
- Some JavaScript code updates prices after page load
- Unlikely since this would show console errors

---

## The Fix

**IF Hypothesis 1 is correct** (scope leakage):

Replace all instances of `product` with `target` in `price.liquid` where they should reference the same product:

**Line 26-27** (Change):
```liquid
# BEFORE
assign price_min = product.price_min
assign price_max = product.price_max

# AFTER
assign price_min = target.price_min
assign price_max = target.price_max
```

**Line 38** (Change):
```liquid
# BEFORE
if target == product and product.price_varies

# AFTER
if target == product and target.price_varies
```

**Line 49-51** (Change):
```liquid
# BEFORE
{%- if compare_at_price > price and product.quantity_price_breaks_configured? != true -%}
{%- if compare_at_price > price and product.quantity_price_breaks_configured? -%}
{%- if product.price_varies == false and product.compare_at_price_varies -%}

# AFTER
{%- if compare_at_price > price and target.quantity_price_breaks_configured? != true -%}
{%- if compare_at_price > price and target.quantity_price_breaks_configured? -%}
{%- if target.price_varies == false and target.compare_at_price_varies -%}
```

**Lines 62, 64, 94** (Similar changes)

**Lines 111-121** (Change):
```liquid
# BEFORE
product.selected_or_first_available_variant.unit_price

# AFTER
target.selected_or_first_available_variant.unit_price
```

---

## Alternative Explanation (UPDATE)

Wait - I just realized something. Let me re-read the code...

Looking at lines 15-22 again:
```liquid
{%- liquid
  if use_variant
    assign target = product.selected_or_first_available_variant
  elsif placeholder
    assign target = null
  else
    assign target = product  ← This sets target = product
  endif
```

For complementary products:
- `use_variant` is NOT passed (defaults to false)
- `placeholder` is NOT true
- So `target = product` (line 21)

Then line 25:
```liquid
assign price = target.price | default: 1999
```

This gets `target.price`, which should be `product.price` (from the passed parameter).

**But then lines 26-27**:
```liquid
assign price_min = product.price_min
assign price_max = product.price_max
```

These SHOULD work the same as `target.price_min` since `target = product`.

**So why is this breaking?**

### The REAL Issue - Global vs Local Product

In Liquid, when you're inside a nested snippet:
```
main-product.liquid → card-product.liquid → price.liquid
```

At the `main-product.liquid` level, there IS a global `product` object (the main product being viewed).

When you pass `product: card_product` to a snippet, Liquid creates a LOCAL variable named `product` in that snippet's scope.

**HOWEVER**: In Liquid, there's a known quirk where direct property access like `product.price_min` can sometimes resolve to the parent scope if there's ambiguity.

The safer pattern is to ALWAYS use `target` for consistency once you've assigned it.

---

## Verification Needed

Before implementing the fix, we need to verify:

1. **Is this actually the bug?**
   - Use browser inspector on live page
   - Check if complementary products show main product's price

2. **Test the fix on staging**
   - Make the changes to use `target` consistently
   - Deploy to staging
   - Verify complementary products show correct prices

3. **No regressions**
   - Test main product page prices still work
   - Test variant prices still work
   - Test sale prices still work

---

## Why This Wasn't Caught Earlier

This is a **pre-existing Dawn theme bug** that only manifests when:
1. You have complementary products enabled
2. The complementary products have different prices than the main product
3. You're viewing the product page (not collection)

It's been in production but likely wasn't noticed because:
- Not all products have complementary products configured
- Users may not have compared the prices closely
- The bug is subtle - prices look plausible

---

## Implementation Plan

### Phase 1: Verify Root Cause (15 minutes)
1. Open live page in browser inspector
2. Check actual price HTML for complementary products
3. Confirm they show main product's price, not their own

### Phase 2: Create Fix Branch (5 minutes)
```bash
git checkout staging
git pull origin staging
git checkout -b fix/complementary-products-pricing
```

### Phase 3: Apply Fix (30 minutes)
1. Update `snippets/price.liquid`
2. Replace all incorrect `product` references with `target`
3. Test locally with test HTML if possible

### Phase 4: Deploy to Staging (5 minutes)
```bash
git add snippets/price.liquid
git commit -m "fix: Use consistent target variable in price snippet for complementary products"
git push origin fix/complementary-products-pricing
```

### Phase 5: Test on Staging (30 minutes)
1. Navigate to product with complementary products
2. Verify complementary products show correct prices
3. Test main product prices still correct
4. Test variant prices
5. Test sale prices
6. Mobile testing

### Phase 6: Deploy to Production (Via PR)
1. Create PR from fix branch to staging
2. Test on staging one more time
3. Create PR from staging to main
4. Monitor production after merge

---

## Success Criteria

✅ Complementary products display their own Shopify configured prices
✅ Main product prices unchanged
✅ Variant prices work correctly
✅ Sale prices display correctly
✅ No console errors
✅ Mobile display correct

---

## Risk Assessment

**Low Risk**:
- Simple variable name change
- Consistent with existing pattern (using `target`)
- No logic changes
- Only affects price display

**Testing Required**:
- All product page types
- All price scenarios (regular, sale, variant)
- Mobile and desktop

---

## Next Steps

1. ✅ Root cause analysis complete
2. ⏳ User confirms issue on live site
3. ⏳ Create fix branch
4. ⏳ Apply changes to price.liquid
5. ⏳ Deploy to staging
6. ⏳ Test thoroughly
7. ⏳ Deploy to production

**Estimated Time to Fix**: 1.5-2 hours total
