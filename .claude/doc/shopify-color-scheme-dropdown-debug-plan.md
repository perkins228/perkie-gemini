# Shopify Color Scheme Dropdown Debug & Fix Plan

## Problem Summary

The pet selector snippet (`ks-product-pet-selector-stitch.liquid`) has a color scheme dropdown in the Shopify theme editor, but changing the selection doesn't update the displayed colors. The selection indicator line remains green (#ebff7a) regardless of which color scheme (scheme-1, scheme-2, or scheme-3) is selected.

## Root Cause Analysis

After analyzing the code structure, I've identified **the fundamental issue**:

### Issue: Incorrect Understanding of Shopify's `color_scheme` Block Setting Type

**What the current code assumes:**
```liquid
{% if block.settings.color_scheme %}
  {% assign scheme = block.settings.color_scheme %}
{% endif %}
```

The code assumes `block.settings.color_scheme` returns a **settings object** with keys like `background`, `text`, `button`, etc.

**What Shopify actually provides:**

When you use `type: "color_scheme"` in a block schema, Shopify stores and returns a **STRING** containing the scheme ID (e.g., `"scheme-1"`, `"scheme-2"`, `"scheme-3"`), NOT the actual color values.

**Evidence from Shopify Documentation:**
- The `color_scheme` setting type returns a **scheme ID string**
- To access the actual color values, you must:
  1. Get the scheme ID from `block.settings.color_scheme`
  2. Look up that scheme in `settings.color_schemes[scheme_id]`
  3. Access the `.settings` property of that scheme object

**Why it currently shows green (#ebff7a):**

The current fallback code correctly accesses `settings.color_schemes['scheme-1'].settings`, which has `button: "#ebff7a"`. However, the main branch (`if block.settings.color_scheme`) is broken because it tries to use a string as if it were an object.

## Available Color Schemes

From `config/settings_data.json`:

```json
{
  "scheme-1": {
    "settings": {
      "background": "#ffffff",
      "text": "#000000",
      "button": "#ebff7a",           // Yellow-lime (Perkie primary)
      "button_label": "#461312"      // Dark red
    }
  },
  "scheme-2": {
    "settings": {
      "background": "#ffa4aa",       // Pink
      "text": "#fffaf7",             // Off-white
      "button": "#ff5964",           // Red
      "button_label": "#f3f3f3"      // Light gray
    }
  },
  "scheme-3": {
    "settings": {
      "background": "#461312",       // Dark red
      "text": "#ffa4aa",             // Pink
      "button": "#ff5964",           // Red
      "button_label": "#000000"      // Black
    }
  }
}
```

## Expected Behavior

When merchant selects:
- **scheme-1**: Yellow-lime buttons (#ebff7a), dark red text (#461312)
- **scheme-2**: Red buttons (#ff5964), pink background (#ffa4aa)
- **scheme-3**: Red buttons (#ff5964), dark red background (#461312)

## Solution: Correct Liquid Code

### Current Broken Code (lines 308-323)

```liquid
{% comment %} Get color scheme from block settings {% endcomment %}
{% if block.settings.color_scheme %}
  {% assign scheme = block.settings.color_scheme %}
{% else %}
  {% comment %} Fallback to scheme-1 if not set {% endcomment %}
  {% assign scheme_id = 'scheme-1' %}
  {% for scheme_obj in settings.color_schemes %}
    {% if scheme_obj[0] == scheme_id %}
      {% assign scheme = scheme_obj[1].settings %}
    {% endif %}
  {% endfor %}
{% endif %}
{% assign scheme_background = scheme.background | default: '#ffffff' %}
{% assign scheme_text = scheme.text | default: '#000000' %}
{% assign scheme_button = scheme.button | default: '#ebff7a' %}
{% assign scheme_button_label = scheme.button_label | default: '#461312' %}
```

**Why it fails:**
1. `block.settings.color_scheme` returns `"scheme-2"` (a string)
2. Code assigns string to `scheme` variable
3. Code tries to access `scheme.background` (string has no `.background` property)
4. Defaults kick in, always using `#ebff7a` green

### Fixed Code (CORRECT APPROACH)

```liquid
{% comment %} Get color scheme from block settings {% endcomment %}
{% assign scheme_id = block.settings.color_scheme | default: 'scheme-1' %}

{% comment %} Look up the scheme object from settings.color_schemes {% endcomment %}
{% assign scheme = settings.color_schemes[scheme_id].settings %}

{% comment %} Extract color values with fallbacks {% endcomment %}
{% assign scheme_background = scheme.background | default: '#ffffff' %}
{% assign scheme_text = scheme.text | default: '#000000' %}
{% assign scheme_button = scheme.button | default: '#ebff7a' %}
{% assign scheme_button_label = scheme.button_label | default: '#461312' %}
```

**Why this works:**
1. `block.settings.color_scheme` returns `"scheme-2"` (string)
2. We use that string to **look up** the scheme in `settings.color_schemes`
3. `settings.color_schemes['scheme-2']` returns the scheme object
4. `.settings` gives us the actual color values
5. We extract each color with appropriate fallbacks

### Alternative Approach (More Verbose, Safer)

If you want to handle edge cases where the scheme doesn't exist:

```liquid
{% comment %} Get color scheme ID from block settings {% endcomment %}
{% assign scheme_id = block.settings.color_scheme | default: 'scheme-1' %}

{% comment %} Look up the scheme in settings.color_schemes {% endcomment %}
{% assign scheme = settings.color_schemes[scheme_id] %}

{% comment %} If scheme not found, fallback to scheme-1 {% endcomment %}
{% unless scheme %}
  {% assign scheme_id = 'scheme-1' %}
  {% assign scheme = settings.color_schemes['scheme-1'] %}
{% endunless %}

{% comment %} Extract color values from scheme.settings {% endcomment %}
{% if scheme.settings %}
  {% assign scheme_background = scheme.settings.background | default: '#ffffff' %}
  {% assign scheme_text = scheme.settings.text | default: '#000000' %}
  {% assign scheme_button = scheme.settings.button | default: '#ebff7a' %}
  {% assign scheme_button_label = scheme.settings.button_label | default: '#461312' %}
{% else %}
  {% comment %} Ultimate fallback if scheme structure is unexpected {% endcomment %}
  {% assign scheme_background = '#ffffff' %}
  {% assign scheme_text = '#000000' %}
  {% assign scheme_button = '#ebff7a' %}
  {% assign scheme_button_label = '#461312' %}
{% endif %}
```

## Recommended Implementation

**Use the SIMPLE approach** (first fix above) because:

1. **Shopify guarantees** `settings.color_schemes[scheme_id]` exists for valid scheme IDs
2. The theme editor only allows selecting from existing schemes
3. The default value `'scheme-1'` ensures we always have a valid scheme
4. Simpler code is easier to maintain

## Files to Modify

### File: `snippets/ks-product-pet-selector-stitch.liquid`

**Location:** Lines 308-323

**Change:** Replace entire color scheme lookup section

**Before:**
```liquid
{% comment %} Get color scheme from block settings {% endcomment %}
{% if block.settings.color_scheme %}
  {% assign scheme = block.settings.color_scheme %}
{% else %}
  {% comment %} Fallback to scheme-1 if not set {% endcomment %}
  {% assign scheme_id = 'scheme-1' %}
  {% for scheme_obj in settings.color_schemes %}
    {% if scheme_obj[0] == scheme_id %}
      {% assign scheme = scheme_obj[1].settings %}
    {% endif %}
  {% endfor %}
{% endif %}
{% assign scheme_background = scheme.background | default: '#ffffff' %}
{% assign scheme_text = scheme.text | default: '#000000' %}
{% assign scheme_button = scheme.button | default: '#ebff7a' %}
{% assign scheme_button_label = scheme.button_label | default: '#461312' %}
```

**After:**
```liquid
{% comment %} Get color scheme from block settings {% endcomment %}
{% assign scheme_id = block.settings.color_scheme | default: 'scheme-1' %}
{% assign scheme = settings.color_schemes[scheme_id].settings %}

{% comment %} Extract color values with fallbacks {% endcomment %}
{% assign scheme_background = scheme.background | default: '#ffffff' %}
{% assign scheme_text = scheme.text | default: '#000000' %}
{% assign scheme_button = scheme.button | default: '#ebff7a' %}
{% assign scheme_button_label = scheme.button_label | default: '#461312' %}
```

## Testing Plan

### 1. Local Testing (Pre-Deployment)

Since this is Liquid template code, you cannot test locally. Skip to Shopify test environment.

### 2. Shopify Test Environment Testing

**Steps:**

1. **Deploy fix to test environment**
   ```bash
   git add snippets/ks-product-pet-selector-stitch.liquid
   git commit -m "Fix: Correctly access color scheme settings in pet selector

   - Changed from incorrectly using color_scheme string as object
   - Now properly looks up scheme in settings.color_schemes
   - Uses scheme ID to access actual color values
   - Maintains fallback to scheme-1 if not set"
   git push origin main
   ```

2. **Wait for deployment** (1-2 minutes for GitHub → Shopify sync)

3. **Access Shopify admin theme editor**
   - Navigate to: Online Store → Themes → Customize
   - Go to a product page with the pet selector block
   - Find the pet selector block in the left sidebar

4. **Test color scheme dropdown**
   - **Test A: Select scheme-1** (Yellow-lime)
     - Expected: Primary color = #ebff7a (yellow-lime)
     - Expected: Text = #461312 (dark red)
     - Verify: Selection line, active buttons use yellow-lime

   - **Test B: Select scheme-2** (Pink/Red)
     - Expected: Primary color = #ff5964 (red)
     - Expected: Background = #ffa4aa (pink)
     - Verify: Selection line, active buttons use red
     - Verify: Background changes to pink

   - **Test C: Select scheme-3** (Dark/Red)
     - Expected: Primary color = #ff5964 (red)
     - Expected: Background = #461312 (dark red)
     - Expected: Text = #ffa4aa (pink)
     - Verify: Dark background with pink text

5. **Inspect with browser DevTools**
   ```javascript
   // In browser console, check CSS custom properties
   getComputedStyle(document.documentElement).getPropertyValue('--pet-selector-primary')
   // Should return the correct color based on selected scheme
   ```

6. **Test persistence**
   - Change scheme to scheme-2
   - Save theme
   - Reload page
   - Verify scheme-2 colors persist

### 3. Visual Verification Checklist

For each color scheme:

- [ ] Pet count buttons: Active button has correct border color
- [ ] Style selector cards: Selected card has correct border color
- [ ] Font selector cards: Selected card has correct ring color
- [ ] Input fields: Focus state uses correct primary color
- [ ] Button text: Uses correct `button_label` color
- [ ] Background: Uses correct `background` color
- [ ] Text color: Uses correct `text` color

## Reference Implementation

Looking at how Shopify's Dawn theme handles color schemes:

```liquid
{%- liquid
  assign scheme_id = section.settings.color_scheme | default: 'scheme-1'
  assign scheme = settings.color_schemes[scheme_id]
  assign scheme_background = scheme.settings.background
  assign scheme_text = scheme.settings.text
-%}

<div class="color-{{ scheme_id }}">
  <style>
    .color-{{ scheme_id }} {
      background-color: {{ scheme_background }};
      color: {{ scheme_text }};
    }
  </style>
</div>
```

**Key differences:**
- Dawn uses CSS classes (`.color-scheme-1`)
- We use CSS custom properties (`--pet-selector-primary`)
- Both approaches are valid
- Our approach is better for component-level styling

## Why the V5 Processor Uses a Different Pattern

From user's reference:

```liquid
<section class="color-{{ section.settings.color_scheme }}">
```

**Why this works there but not here:**

1. **Sections vs Blocks**: `section.settings.color_scheme` is used in a **section** context
2. **CSS Classes vs Custom Properties**: That approach relies on Shopify's built-in CSS classes
3. **Global vs Component**: Section color schemes are global, our pet selector is a component

**Our approach is better for blocks because:**
- Blocks don't have the same CSS class structure as sections
- Custom properties allow fine-grained control
- We can override specific colors without affecting the entire section

## Common Pitfalls to Avoid

### ❌ Pitfall 1: Using color_scheme Setting as an Object
```liquid
{% assign scheme = block.settings.color_scheme %}
{% assign color = scheme.button %}  <!-- WRONG: scheme is a string, not object -->
```

### ❌ Pitfall 2: Iterating Over color_schemes Unnecessarily
```liquid
{% for scheme in settings.color_schemes %}
  {% if scheme[0] == scheme_id %}  <!-- INEFFICIENT: Direct lookup is faster -->
```

### ❌ Pitfall 3: Not Providing Fallbacks
```liquid
{% assign scheme = settings.color_schemes[scheme_id].settings %}
{% assign color = scheme.button %}  <!-- RISKY: No fallback if key missing -->
```

### ✅ Correct Pattern
```liquid
{% assign scheme_id = block.settings.color_scheme | default: 'scheme-1' %}
{% assign scheme = settings.color_schemes[scheme_id].settings %}
{% assign color = scheme.button | default: '#ebff7a' %}
```

## Success Criteria

- [ ] Merchant can select scheme-1 and see yellow-lime (#ebff7a) primary color
- [ ] Merchant can select scheme-2 and see red (#ff5964) primary color
- [ ] Merchant can select scheme-3 and see red (#ff5964) primary color with dark background
- [ ] Color changes apply immediately in theme editor preview
- [ ] Color selection persists after save and reload
- [ ] No console errors related to color scheme
- [ ] All UI elements (buttons, borders, focus states) reflect selected scheme

## Rollback Plan

If the fix causes issues:

```bash
# Revert the commit
git revert HEAD
git push origin main

# Or restore from backup
git checkout HEAD~1 snippets/ks-product-pet-selector-stitch.liquid
git commit -m "Rollback: Restore previous color scheme implementation"
git push origin main
```

## Additional Considerations

### Future Enhancement: Add More Color Schemes

If you want to add custom color schemes for the pet selector:

1. Add new scheme in `config/settings_data.json`:
   ```json
   "scheme-pet-selector-1": {
     "settings": {
       "background": "#f0f8ff",
       "text": "#1a1a1a",
       "button": "#4a90e2",
       "button_label": "#ffffff"
     }
   }
   ```

2. The fix will automatically support it (no code changes needed)

### Performance Note

**Direct lookup is O(1):**
```liquid
{% assign scheme = settings.color_schemes[scheme_id].settings %}
```

**Iteration is O(n):**
```liquid
{% for scheme in settings.color_schemes %}
  {% if scheme[0] == scheme_id %}
    {% assign scheme = scheme[1].settings %}
  {% endif %}
{% endfor %}
```

Our fix uses the faster direct lookup approach.

## Documentation Updates

After implementing the fix, update these files:

1. **Session context** (`.claude/tasks/context_session_001.md`):
   - Add entry documenting the fix
   - Reference this plan document
   - Note the commit hash

2. **Code comments** (in the Liquid file):
   - Already well-commented
   - No additional comments needed

## Related Issues

This same pattern should be checked in other files:

```bash
# Search for similar color_scheme usage
grep -r "block.settings.color_scheme" snippets/
grep -r "section.settings.color_scheme" sections/
```

**Files to audit:**
- `snippets/ks-product-pet-selector.liquid` (old version, if still in use)
- Any other custom blocks using color_scheme setting type

## Conclusion

**Root Cause:** Misunderstanding of Shopify's `color_scheme` setting type (returns string ID, not object)

**Fix:** Use the scheme ID to look up the actual scheme object in `settings.color_schemes`

**Impact:** Low risk, high benefit - simple fix with immediate visual feedback

**Estimated Time:** 5 minutes to implement, 10 minutes to test

**Risk Level:** 1/10 (very safe, easily reversible)

---

**Next Steps:**
1. Implement the fix (replace lines 308-323)
2. Commit and push to main
3. Test in Shopify theme editor
4. Verify all three color schemes work correctly
5. Update session context with results
