# KondaSoft Cart Discount Form Translation Fix Implementation Plan

**Date**: 2025-08-29  
**Context**: Fixing remaining translation issues in `snippets/ks-cart-discount-form.liquid`  
**Session**: 001  

## Problem Analysis

### Current Translation Status

**FIXED (Lines 8-13)**: `kondasoft.cart.discount_form_title`
- ✅ Already implements conditional check pattern
- ✅ Fallback: "Apply a discount code"
- ✅ No action needed

**AT RISK (Lines 23, 27, 33, 34)**: Using direct `t` filter without fallback protection
- `kondasoft.cart.discount_form.input_label` (2 occurrences)
- `kondasoft.cart.discount_form.button_label` (2 occurrences)

### Translation Keys Verification

**Existing in `locales/en.default.json` (lines 591-594)**:
```json
"discount_form": {
  "input_label": "Enter your discount code",    // ✅ EXISTS
  "button_label": "Apply"                        // ✅ EXISTS
}
```

**All required translation keys DO exist** - but they lack fallback protection.

## Root Cause Analysis

### Critical Finding: Inconsistent Translation Patterns

**Problem**: The file uses TWO different translation patterns:
1. **SAFE Pattern** (lines 8-13): Conditional check for "Translation missing"
2. **RISKY Pattern** (lines 23, 27, 33, 34): Direct `{{ 'key' | t }}` without fallback

### Why This Creates Issues

Even though the translation keys exist, they could fail due to:
1. **Shopify cache issues**: Translation not loaded properly
2. **Theme deployment timing**: Translations deploy separately from templates
3. **Locale file corruption**: JSON parsing errors
4. **Future removal**: If keys get accidentally deleted

### The Liquid `default` Filter Problem

**Cannot Use**: `{{ 'key' | t | default: 'fallback' }}`  
**Reason**: Shopify's `t` filter returns "Translation missing..." (not nil), so `default` never activates

## Implementation Plan

### Solution: Apply Consistent Conditional Pattern

Convert all direct `{{ 'key' | t }}` usage to the safe conditional pattern already used for the title.

### Files to Modify

**File**: `snippets/ks-cart-discount-form.liquid`

### Specific Changes Required

#### 1. Line 23 - Input Placeholder
**Current**:
```liquid
placeholder="{{ 'kondasoft.cart.discount_form.input_label' | t }}"
```

**Replace with**:
```liquid
{% assign input_label = 'kondasoft.cart.discount_form.input_label' | t %}
placeholder="{% if input_label contains 'Translation missing' %}Enter your discount code{% else %}{{ input_label }}{% endif %}"
```

#### 2. Line 27 - Field Label
**Current**:
```liquid
{{ 'kondasoft.cart.discount_form.input_label' | t }}
```

**Replace with**:
```liquid
{% assign input_label = 'kondasoft.cart.discount_form.input_label' | t %}
{% if input_label contains 'Translation missing' %}
  Enter your discount code
{% else %}
  {{ input_label }}
{% endif %}
```

#### 3. Line 33 - Button Data Attribute
**Current**:
```liquid
data-text="{{ 'kondasoft.cart.discount_form.button_label' | t }}"
```

**Replace with**:
```liquid
{% assign button_label = 'kondasoft.cart.discount_form.button_label' | t %}
data-text="{% if button_label contains 'Translation missing' %}Apply{% else %}{{ button_label }}{% endif %}"
```

#### 4. Line 34 - Button Text
**Current**:
```liquid
<span>{{ 'kondasoft.cart.discount_form.button_label' | t }}</span>
```

**Replace with**:
```liquid
<span>
{% assign button_label = 'kondasoft.cart.discount_form.button_label' | t %}
{% if button_label contains 'Translation missing' %}
  Apply
{% else %}
  {{ button_label }}
{% endif %}
</span>
```

### Optimization: Reuse Variables

To avoid repeated translation calls, we can assign variables at the top:

```liquid
{% assign input_label = 'kondasoft.cart.discount_form.input_label' | t %}
{% assign input_label_safe = input_label %}
{% if input_label contains 'Translation missing' %}
  {% assign input_label_safe = 'Enter your discount code' %}
{% endif %}

{% assign button_label = 'kondasoft.cart.discount_form.button_label' | t %}
{% assign button_label_safe = button_label %}
{% if button_label contains 'Translation missing' %}
  {% assign button_label_safe = 'Apply' %}
{% endif %}
```

Then use `{{ input_label_safe }}` and `{{ button_label_safe }}` throughout the file.

## Risk Assessment

**Risk Level**: VERY LOW
- Cosmetic improvements only
- No functionality changes
- Existing translations continue working
- Provides safety net for edge cases

**Business Impact**: 
- Eliminates potential console errors
- Improves theme reliability
- Zero customer-facing changes (translations exist)

**Technical Impact**:
- File size: +200-300 bytes
- Performance: Negligible (executes server-side)
- Complexity: Minimal increase

## Implementation Steps

### Step 1: Variable Assignment (5 minutes)
- Add safe translation variables at top of file
- Test locally to ensure variables work correctly

### Step 2: Replace Direct Usage (10 minutes)  
- Replace all 4 occurrences of direct `{{ 'key' | t }}`
- Use safe variables throughout file
- Maintain exact same output when translations exist

### Step 3: Testing (5 minutes)
- Verify cart page displays correctly
- Check console for translation errors
- Test with translations present (normal case)
- Test with translations missing (edge case simulation)

### Step 4: Deployment (2 minutes)
- Commit changes with descriptive message
- Push to staging branch for auto-deployment

## Expected Results

### Success Criteria
- ✅ Cart page displays identical content (translations exist)
- ✅ No console errors for translation missing
- ✅ Fallback text displays if translations fail to load
- ✅ Consistent pattern across entire file

### Fallback Behavior
If translations fail to load:
- Input label: "Enter your discount code"
- Button label: "Apply"
- Form title: "Apply a discount code" (already safe)

## Time Estimate

**Total Time**: 20-25 minutes
- Planning: Already complete
- Implementation: 15 minutes
- Testing: 5 minutes
- Deployment: 2 minutes

## Alternative Approaches Considered

### Option 1: Do Nothing
**Rejected**: Creates inconsistent error handling patterns

### Option 2: Remove Conditional Checks  
**Rejected**: Would break existing safety for title

### Option 3: Add Missing Keys to JSON
**Rejected**: Keys already exist, this fixes the pattern

## Commit Message Template

```
Fix translation fallbacks in cart discount form

- Apply consistent conditional translation pattern
- Add fallback protection for input_label and button_label  
- Prevents "Translation missing" errors in edge cases
- Maintains identical output when translations exist
- Files: snippets/ks-cart-discount-form.liquid
```

## Status

**Current**: Analysis complete, implementation plan ready  
**Next**: Execute implementation (20-25 minutes)  
**Risk**: Very low - cosmetic safety improvements only