# Pet Style Preview Image Upload - Implementation Plan

**Created**: 2025-11-03
**Feature**: Allow merchant to upload style preview images via Shopify theme editor
**Impact**: Improves merchant experience, no code access needed for image changes
**Risk**: LOW - No conversion impact, purely merchant UX improvement
**Effort**: 1-2 hours

---

## Executive Summary

Currently, style preview images (B&W, Color, Modern, Sketch) are hardcoded as asset references (`{{ 'pet-bw-preview.jpg' | asset_url }}`). This requires merchants to have code access to upload images to the theme assets folder.

**Solution**: Add 4 `image_picker` settings to the `ks_pet_selector` block schema, allowing merchants to upload images directly in the theme editor customizer.

**Key Decision**: Use **optional with asset fallback** strategy - if merchant uploads custom image, use it; otherwise fall back to existing asset references. This provides maximum flexibility with zero breaking changes.

---

## Implementation Steps

### 1. Update Block Schema (`sections/main-product.liquid`)

**Location**: Lines 938-981 (ks_pet_selector block settings)

**Changes Required**:
- Add new header "Style Preview Images" after line 969 (preview_product_variant_id setting)
- Add 4 `image_picker` settings before the "Design Settings" header (line 970-973)

**Exact JSON Schema to Add**:

```json
{
  "type": "header",
  "content": "Style Preview Images"
},
{
  "type": "paragraph",
  "content": "Upload custom preview images for each style option. Leave empty to use default images. Recommended: 320×320px, square, optimized for web (under 50KB each)."
},
{
  "type": "image_picker",
  "id": "style_preview_bw",
  "label": "B&W Style Preview Image",
  "info": "Preview image for Black & White style option"
},
{
  "type": "image_picker",
  "id": "style_preview_color",
  "label": "Color Style Preview Image",
  "info": "Preview image for Color style option"
},
{
  "type": "image_picker",
  "id": "style_preview_modern",
  "label": "Modern Style Preview Image",
  "info": "Preview image for Modern (Ink Wash) style option"
},
{
  "type": "image_picker",
  "id": "style_preview_sketch",
  "label": "Sketch Style Preview Image",
  "info": "Preview image for Sketch (Pen & Marker) style option"
},
```

**Positioning**:
- Insert AFTER line 969 (preview_product_variant_id setting)
- Insert BEFORE line 970-973 (Design Settings header)

**Final Structure**:
```
...existing settings...
preview_product_variant_id setting (line 963-969)
[NEW] Style Preview Images header
[NEW] Info paragraph
[NEW] 4 image_picker settings
Design Settings header (line 970-973)
color_scheme setting (line 974-980)
...
```

---

### 2. Update Snippet Logic (`snippets/ks-product-pet-selector-stitch.liquid`)

**Location**: Lines 127-199 (4 style card image references)

**Current Pattern** (example from B&W):
```liquid
<img src="{{ 'pet-bw-preview.jpg' | asset_url }}"
     alt="Black & White style preview"
     class="style-card__image">
```

**New Pattern with Fallback**:
```liquid
{% if block.settings.style_preview_bw != blank %}
  <img src="{{ block.settings.style_preview_bw | image_url: width: 320 }}"
       alt="Black & White style preview"
       class="style-card__image">
{% else %}
  <img src="{{ 'pet-bw-preview.jpg' | asset_url }}"
       alt="Black & White style preview"
       class="style-card__image">
{% endif %}
```

**Changes Required**:

**Line 129-131** (B&W Image):
```liquid
{% if block.settings.style_preview_bw != blank %}
  <img src="{{ block.settings.style_preview_bw | image_url: width: 320 }}"
       alt="Black & White style preview"
       class="style-card__image">
{% else %}
  <img src="{{ 'pet-bw-preview.jpg' | asset_url }}"
       alt="Black & White style preview"
       class="style-card__image">
{% endif %}
```

**Line 150-152** (Color Image):
```liquid
{% if block.settings.style_preview_color != blank %}
  <img src="{{ block.settings.style_preview_color | image_url: width: 320 }}"
       alt="Color style preview"
       class="style-card__image">
{% else %}
  <img src="{{ 'pet-color-preview.jpg' | asset_url }}"
       alt="Color style preview"
       class="style-card__image">
{% endif %}
```

**Line 172-174** (Modern Image):
```liquid
{% if block.settings.style_preview_modern != blank %}
  <img src="{{ block.settings.style_preview_modern | image_url: width: 320 }}"
       alt="Modern style preview"
       class="style-card__image">
{% else %}
  <img src="{{ 'pet-modern-preview.jpg' | asset_url }}"
       alt="Modern style preview"
       class="style-card__image">
{% endif %}
```

**Line 193-195** (Sketch Image):
```liquid
{% if block.settings.style_preview_sketch != blank %}
  <img src="{{ block.settings.style_preview_sketch | image_url: width: 320 }}"
       alt="Sketch style preview"
       class="style-card__image">
{% else %}
  <img src="{{ 'pet-sketch-preview.jpg' | asset_url }}"
       alt="Sketch style preview"
       class="style-card__image">
{% endif %}
```

**Key Technical Details**:
- `| image_url: width: 320` - Shopify's built-in image transformation, generates 320px-wide responsive image
- `!= blank` check - Tests if merchant uploaded an image (blank = empty/null)
- Asset fallback preserves existing behavior - zero breaking changes
- No changes needed to snippet parameters (block already passed from main-product.liquid line 466)

---

## Design Decisions & Rationale

### 1. Setting ID Naming Convention

**Decision**: Use `style_preview_[style]` pattern
- `style_preview_bw`
- `style_preview_color`
- `style_preview_modern`
- `style_preview_sketch`

**Rationale**:
- Clear, self-documenting names
- Consistent with existing setting naming patterns (`preview_product_variant_id`)
- Namespace prefix `style_preview_` prevents collisions
- Lowercase with underscores (Shopify convention)

**Rejected Alternatives**:
- `image_bw` - Too generic, doesn't indicate purpose
- `pet_style_bw_image` - Redundant (already in pet selector block)
- `preview_image_bw` - Could conflict with `preview_product_variant_id`

---

### 2. Fallback Strategy

**Decision**: Optional with asset fallback

**Behavior**:
```
IF merchant uploads custom image
  → Use custom image via block.settings
ELSE
  → Use existing asset_url reference
```

**Rationale**:
- **Zero Breaking Changes**: Existing stores continue working with asset images
- **Merchant Flexibility**: Can customize some styles, leave others default
- **Gradual Migration**: No forced immediate action
- **Performance**: Asset fallback same as current (no regression)

**Rejected Alternatives**:

**Option A: Required Images**
```
Pros: Forces merchant to provide images
Cons:
- Breaking change (block errors if empty)
- Bad UX for new installations
- Requires migration work for existing stores
```
❌ Too disruptive

**Option B: Placeholder Only**
```
Pros: Obvious when images missing
Cons:
- Poor customer experience
- Breaks existing working stores
- Requires immediate merchant action
```
❌ User-facing breakage

**Option C: Hide Style If Empty**
```
Pros: Clean fallback
Cons:
- Reduces conversion options
- Confusing merchant experience
- Complex conditional logic
```
❌ Hurts conversion potential

---

### 3. Image Size & Optimization

**Decision**: Recommend 320×320px, max 50KB per image

**Display Sizes**:
- Desktop: 160×160px actual display
- Mobile: ~120×120px actual display
- Upload 2x size (320px) for retina displays

**Shopify Transformation**:
```liquid
{{ block.settings.style_preview_bw | image_url: width: 320 }}
```
- Shopify automatically generates optimized WebP versions
- CDN caching included
- Responsive srcset generated automatically

**Performance Impact**:
- Current: 4 images × ~30KB = 120KB total
- With custom: 4 images × 50KB = 200KB max
- **Delta**: +80KB worst case
- **Mobile Impact**: Acceptable (images lazy-loaded on scroll)

**Merchant Guidance** (via paragraph content):
```
"Upload custom preview images for each style option.
Leave empty to use default images.
Recommended: 320×320px, square, optimized for web (under 50KB each)."
```

---

### 4. Organization & Grouping

**Decision**: Single header "Style Preview Images" with all 4 pickers grouped together

**Layout in Theme Editor**:
```
┌─────────────────────────────────────┐
│ Pet Image Selector                  │
├─────────────────────────────────────┤
│ Custom Image Fee (USD): [5.00]     │
│ Maximum Pets per Product: [3]      │
│ Preview Image Product Variant ID:  │
│ [                                ] │
├─────────────────────────────────────┤
│ Style Preview Images                │ ← NEW HEADER
├─────────────────────────────────────┤
│ Upload custom preview images...     │ ← INFO TEXT
│                                     │
│ B&W Style Preview Image             │ ← IMAGE PICKER 1
│ [Upload Image]                      │
│                                     │
│ Color Style Preview Image           │ ← IMAGE PICKER 2
│ [Upload Image]                      │
│                                     │
│ Modern Style Preview Image          │ ← IMAGE PICKER 3
│ [Upload Image]                      │
│                                     │
│ Sketch Style Preview Image          │ ← IMAGE PICKER 4
│ [Upload Image]                      │
├─────────────────────────────────────┤
│ Design Settings                     │
│ Color scheme: [scheme-1 ▼]         │
└─────────────────────────────────────┘
```

**Rationale**:
- Logical grouping (all 4 style images together)
- Easy to scan and understand
- Matches Shopify's theme editor patterns
- Clear visual separation from other settings

**Rejected Alternative**: Separate sections for each style
- ❌ Too verbose, clutters editor
- ❌ Splits related settings
- ❌ Harder to maintain visual consistency

---

## Merchant UX Considerations

### Upload Experience

**Step 1: Merchant opens theme editor**
→ Navigates to product page with pet selector block

**Step 2: Merchant expands block settings**
→ Sees new "Style Preview Images" section

**Step 3: Merchant uploads images**
→ Clicks [Upload Image] button for each style
→ Selects image from computer or Shopify library
→ Image preview appears in theme editor

**Step 4: Merchant saves changes**
→ Images appear immediately on storefront
→ No code deployment needed

### Edge Cases

**Scenario 1: Merchant uploads only 2 of 4 images**
- Custom images display for uploaded styles
- Asset fallback displays for non-uploaded styles
- **Result**: Mixed custom + default (acceptable)

**Scenario 2: Merchant uploads wrong dimensions**
- Shopify automatically resizes to 320px width
- Aspect ratio maintained (may not be square)
- **Recommendation**: Add "square" to info text

**Scenario 3: Merchant uploads huge file (5MB)**
- Shopify accepts upload
- Automatic compression and optimization
- CDN serves WebP version
- **Impact**: Minimal (Shopify handles it)

**Scenario 4: Merchant deletes uploaded image later**
- Setting becomes blank/null
- Fallback to asset_url kicks in
- **Result**: Seamless reversion to default

---

## Conversion & Performance Analysis

### Conversion Impact

**Expected Impact**: NEUTRAL to SLIGHT POSITIVE

**Positive Scenarios**:
- Merchant uploads higher-quality preview images
- Better representation of actual product output
- Improved trust signals (professional previews)

**Negative Scenarios**:
- Merchant uploads poor-quality images
- Inconsistent style representation
- Confusing or misleading previews

**Mitigation**:
- Provide clear guidance (320×320px, square, optimized)
- Asset fallback ensures quality baseline
- Easy to revert (delete custom image)

**Recommendation**: Provide merchant with high-quality default images to download and re-upload if desired

---

### Performance Impact

**Current State**:
- 4 hardcoded asset images
- Served from Shopify CDN
- Lazy-loaded below fold
- Total: ~120KB (4 × 30KB)

**With Custom Images**:
- 4 custom uploaded images
- Served from Shopify CDN
- Lazy-loaded below fold
- Total: ~200KB max (4 × 50KB)

**Delta**: +80KB worst case

**Mobile Impact** (70% of traffic):
- Images display at ~120×120px
- 2x retina = 240×240px needed
- 320px covers retina displays
- Lazy-loading prevents initial load impact

**Core Web Vitals Impact**:
- **LCP**: No impact (images below fold)
- **FID**: No impact (no JavaScript changes)
- **CLS**: No impact (fixed dimensions)

**Conclusion**: Acceptable performance impact, well within mobile budget

---

### Image Optimization Recommendations

**For Merchant**:
1. Use square images (320×320px exactly)
2. Optimize before upload (TinyPNG, Squoosh, etc.)
3. Target <50KB per image
4. Use realistic pet photos matching actual output
5. Consistent lighting and quality across all 4 styles

**Technical Optimization**:
- Shopify's `image_url` filter automatically:
  - Generates WebP versions
  - Creates responsive srcset
  - Serves from global CDN
  - Applies browser caching

**No Additional Optimization Needed** - Shopify handles it

---

## Testing Requirements

### Functional Testing

**Test Case 1: Upload All 4 Images**
1. Open theme editor on product page
2. Upload 4 custom images (320×320px)
3. Save changes
4. Verify all 4 custom images display on storefront
5. ✅ Expected: All custom images display correctly

**Test Case 2: Upload Only 2 Images**
1. Upload B&W and Color images only
2. Leave Modern and Sketch empty
3. Save changes
4. ✅ Expected: B&W and Color show custom, Modern and Sketch show asset fallback

**Test Case 3: Delete Uploaded Image**
1. Upload custom image
2. Save changes
3. Return to editor, delete image
4. Save changes
5. ✅ Expected: Reverts to asset fallback

**Test Case 4: Upload Wrong Dimensions**
1. Upload 800×600px landscape image
2. Save changes
3. ✅ Expected: Shopify resizes to 320px width, may not be square (acceptable)

---

### Mobile Testing (70% Traffic Priority)

**Test Case 5: Mobile Display - iPhone 12**
1. Open storefront on iPhone 12 Safari
2. Navigate to pet selector
3. Verify images display correctly
4. ✅ Expected: Images crisp on retina display, ~120×120px actual size

**Test Case 6: Mobile Display - Android Chrome**
1. Open storefront on Android device
2. Navigate to pet selector
3. Verify images display correctly
4. ✅ Expected: Consistent with iOS

**Test Case 7: Mobile Performance**
1. Run Chrome DevTools Lighthouse on mobile
2. Check image lazy-loading
3. Verify no LCP regression
4. ✅ Expected: Images lazy-load, no performance degradation

---

### Theme Editor Testing

**Test Case 8: Preview Updates**
1. Upload image in theme editor
2. Check preview panel
3. ✅ Expected: Image updates instantly in preview

**Test Case 9: Multiple Blocks**
1. Try adding second ks_pet_selector block
2. ✅ Expected: Block limit prevents (limit: 1 in schema)

**Test Case 10: Settings Persistence**
1. Upload images
2. Save changes
3. Close theme editor
4. Reopen theme editor
5. ✅ Expected: Uploaded images still present

---

### Cross-Browser Testing

**Test Case 11: Desktop Browsers**
- Chrome (latest): ✅ Expected: Works perfectly
- Firefox (latest): ✅ Expected: Works perfectly
- Safari (latest): ✅ Expected: Works perfectly
- Edge (latest): ✅ Expected: Works perfectly

**Test Case 12: Mobile Browsers**
- iOS Safari: ✅ Expected: Works perfectly
- Android Chrome: ✅ Expected: Works perfectly
- Samsung Internet: ✅ Expected: Works perfectly

---

### Fallback Testing

**Test Case 13: Asset Images Still Exist**
1. Deploy code changes
2. Don't upload any custom images
3. Load storefront
4. ✅ Expected: Existing asset images display (zero breaking change)

**Test Case 14: Asset Image Missing**
1. Delete one asset image from theme assets
2. Don't upload custom image for that style
3. Load storefront
4. ✅ Expected: Broken image or 404 (merchant's responsibility to fix)

---

## Implementation Checklist

### Pre-Implementation
- [x] Review session context (context_session_001.md)
- [x] Analyze current implementation (main-product.liquid, snippet)
- [x] Design schema additions (4 image_picker settings)
- [x] Choose fallback strategy (optional with asset fallback)
- [x] Document all design decisions

### Implementation Tasks
- [ ] Backup current files (main-product.liquid, snippet)
- [ ] Update sections/main-product.liquid (lines 938-981):
  - [ ] Add "Style Preview Images" header after line 969
  - [ ] Add info paragraph with recommendations
  - [ ] Add 4 image_picker settings (style_preview_bw, color, modern, sketch)
  - [ ] Verify JSON syntax (trailing commas, brackets)
- [ ] Update snippets/ks-product-pet-selector-stitch.liquid (lines 127-199):
  - [ ] Wrap B&W image (lines 129-131) in if/else block
  - [ ] Wrap Color image (lines 150-152) in if/else block
  - [ ] Wrap Modern image (lines 172-174) in if/else block
  - [ ] Wrap Sketch image (lines 193-195) in if/else block
  - [ ] Verify Liquid syntax (endif tags, spacing)

### Testing Tasks
- [ ] Commit changes to main branch
- [ ] Wait for GitHub auto-deploy (~1-2 min)
- [ ] Ask user for current Shopify test URL
- [ ] Use Chrome DevTools MCP to test:
  - [ ] Test Case 1: Upload all 4 images
  - [ ] Test Case 2: Upload only 2 images
  - [ ] Test Case 3: Delete uploaded image
  - [ ] Test Case 5: Mobile display (iPhone)
  - [ ] Test Case 6: Mobile display (Android)
  - [ ] Test Case 13: Asset fallback (no custom images)
- [ ] Run Lighthouse mobile performance test
- [ ] Verify no console errors
- [ ] Verify no LCP regression

### Post-Implementation
- [ ] Update context_session_001.md with results
- [ ] Document any issues encountered
- [ ] Create merchant documentation (if needed)
- [ ] Archive this implementation plan

---

## Risk Assessment

### Technical Risks

**Risk 1: JSON Schema Syntax Error**
- **Likelihood**: LOW
- **Impact**: HIGH (theme editor breaks)
- **Mitigation**: Validate JSON syntax before commit, test in theme editor immediately

**Risk 2: Liquid Syntax Error**
- **Likelihood**: LOW
- **Impact**: MEDIUM (snippet rendering fails)
- **Mitigation**: Validate Liquid syntax, test on storefront immediately

**Risk 3: Block Settings Not Passed to Snippet**
- **Likelihood**: VERY LOW
- **Impact**: MEDIUM (custom images don't display)
- **Mitigation**: Block already passed (line 466), no changes needed

**Risk 4: Image Transformation Fails**
- **Likelihood**: VERY LOW
- **Impact**: LOW (asset fallback kicks in)
- **Mitigation**: Shopify's image_url filter is battle-tested, fallback strategy protects

---

### Business Risks

**Risk 5: Merchant Uploads Poor-Quality Images**
- **Likelihood**: MEDIUM
- **Impact**: LOW (conversion slightly impacted)
- **Mitigation**:
  - Clear guidance in info paragraph
  - Asset fallback provides quality baseline
  - Easy to revert (delete custom image)

**Risk 6: Increased Page Weight**
- **Likelihood**: HIGH (custom images likely larger)
- **Impact**: LOW (80KB max increase, lazy-loaded)
- **Mitigation**:
  - Clear size recommendations (50KB max)
  - Shopify automatic optimization
  - Images below fold (no LCP impact)

**Risk 7: Breaking Changes**
- **Likelihood**: VERY LOW
- **Impact**: HIGH (existing stores break)
- **Mitigation**: Asset fallback strategy ensures zero breaking changes

---

### Rollback Plan

**If Critical Issue Found**:
1. Revert commit via git
2. Push revert to main branch
3. GitHub auto-deploys previous version (~1-2 min)
4. Verify storefront returns to previous state

**Revert Commands**:
```bash
# Find commit to revert
git log --oneline -5

# Revert last commit
git revert HEAD

# Push to main
git push origin main
```

**Low Risk**: Changes are additive (new settings) with fallback strategy. Rollback easy.

---

## Success Criteria

### Must-Have (Launch Blockers)
- ✅ Schema JSON syntax valid (theme editor loads)
- ✅ Snippet Liquid syntax valid (storefront renders)
- ✅ Asset fallback works when no custom images uploaded
- ✅ Custom images display when uploaded
- ✅ No console errors
- ✅ Mobile display works (iPhone + Android)

### Should-Have (Important)
- ✅ Theme editor preview updates instantly
- ✅ All 4 styles independently configurable
- ✅ Image optimization via Shopify image_url works
- ✅ No LCP regression on mobile

### Nice-to-Have (Future Enhancements)
- ⏸ Merchant documentation with best practices
- ⏸ Default high-quality images to download
- ⏸ Image dimension validation (enforce square)
- ⏸ File size validation (warn if >50KB)

---

## Future Enhancements

### Phase 2 Considerations

**Enhancement 1: Image Dimension Validation**
- Use Shopify's `image.width` and `image.height` properties
- Display warning if not square: "⚠️ Image is not square (320×320px recommended)"
- Non-blocking warning, doesn't prevent upload

**Enhancement 2: Style Description Fields**
- Add optional text fields for custom style descriptions
- Display in tooltip or below image
- Example: "A striking black and white conversion..."

**Enhancement 3: Style Toggle (Show/Hide)**
- Add checkbox settings to show/hide specific styles
- Use cases: Merchant wants only 3 styles, hide one option
- Requires conditional logic in snippet

**Enhancement 4: Style Reordering**
- Allow merchant to reorder style options
- Complex: Requires JavaScript or custom drag-drop in theme editor
- Low priority: Current order (B&W, Color, Modern, Sketch) is logical

**Enhancement 5: Bulk Image Upload**
- Provide ZIP download of default high-quality images
- Merchant can customize and re-upload all at once
- Requires separate merchant documentation page

---

## Documentation Updates Required

### Internal Documentation
- ✅ This implementation plan (.claude/doc/)
- [ ] Update context_session_001.md after implementation
- [ ] Update CLAUDE.md if new testing procedures needed

### Merchant Documentation
- ⏸ Optional: Create merchant guide for uploading style images
- ⏸ Best practices for image optimization
- ⏸ Examples of good vs. bad preview images

### Code Comments
- [ ] Add comments in main-product.liquid schema (inline)
- [ ] Add comments in snippet (above if/else blocks)

---

## Appendix: Code Diff Preview

### A. sections/main-product.liquid

**Before** (lines 963-973):
```json
{
  "type": "text",
  "id": "preview_product_variant_id",
  "label": "Preview Image Product Variant ID",
  "info": "Variant ID of your 'Custom Pet Image Preview' product ($0.00)",
  "placeholder": "e.g. 41234567890123"
},
{
  "type": "header",
  "content": "Design Settings"
},
```

**After** (lines 963-1001):
```json
{
  "type": "text",
  "id": "preview_product_variant_id",
  "label": "Preview Image Product Variant ID",
  "info": "Variant ID of your 'Custom Pet Image Preview' product ($0.00)",
  "placeholder": "e.g. 41234567890123"
},
{
  "type": "header",
  "content": "Style Preview Images"
},
{
  "type": "paragraph",
  "content": "Upload custom preview images for each style option. Leave empty to use default images. Recommended: 320×320px, square, optimized for web (under 50KB each)."
},
{
  "type": "image_picker",
  "id": "style_preview_bw",
  "label": "B&W Style Preview Image",
  "info": "Preview image for Black & White style option"
},
{
  "type": "image_picker",
  "id": "style_preview_color",
  "label": "Color Style Preview Image",
  "info": "Preview image for Color style option"
},
{
  "type": "image_picker",
  "id": "style_preview_modern",
  "label": "Modern Style Preview Image",
  "info": "Preview image for Modern (Ink Wash) style option"
},
{
  "type": "image_picker",
  "id": "style_preview_sketch",
  "label": "Sketch Style Preview Image",
  "info": "Preview image for Sketch (Pen & Marker) style option"
},
{
  "type": "header",
  "content": "Design Settings"
},
```

---

### B. snippets/ks-product-pet-selector-stitch.liquid

**Before** (lines 127-133):
```liquid
{% comment %} B&W Style {% endcomment %}
<label class="style-card">
  <input type="radio"
         name="properties[Style]"
         value="enhancedblackwhite"
         data-style-radio="enhancedblackwhite">
  <div class="style-card__content">
    <div class="style-card__image-wrapper">
      <img src="{{ 'pet-bw-preview.jpg' | asset_url }}"
           alt="Black & White style preview"
           class="style-card__image">
    </div>
    <p class="style-card__label">B&W</p>
  </div>
</label>
```

**After** (lines 127-143):
```liquid
{% comment %} B&W Style {% endcomment %}
<label class="style-card">
  <input type="radio"
         name="properties[Style]"
         value="enhancedblackwhite"
         data-style-radio="enhancedblackwhite">
  <div class="style-card__content">
    <div class="style-card__image-wrapper">
      {% comment %} Use custom image if uploaded, otherwise fallback to asset {% endcomment %}
      {% if block.settings.style_preview_bw != blank %}
        <img src="{{ block.settings.style_preview_bw | image_url: width: 320 }}"
             alt="Black & White style preview"
             class="style-card__image">
      {% else %}
        <img src="{{ 'pet-bw-preview.jpg' | asset_url }}"
             alt="Black & White style preview"
             class="style-card__image">
      {% endif %}
    </div>
    <p class="style-card__label">B&W</p>
  </div>
</label>
```

**Similar pattern applied to**:
- Color style (lines 148-154)
- Modern style (lines 170-176)
- Sketch style (lines 191-197)

---

## Questions for User (Pre-Implementation)

### Critical Questions
1. ✅ **ANSWERED**: Use optional with asset fallback strategy
2. ✅ **ANSWERED**: Group all 4 image pickers under single header
3. ✅ **ANSWERED**: Recommend 320×320px, max 50KB per image

### Optional Questions (Can Proceed with Assumptions)
1. **Default Images**: Should we provide high-quality default images for merchants to download and re-upload?
   - **Assumption**: NOT NEEDED - Merchants can use existing assets or upload their own

2. **Image Validation**: Should we add warnings for non-square or oversized images?
   - **Assumption**: NOT NEEDED - Shopify handles optimization, merchants responsible for quality

3. **Style Descriptions**: Should we allow custom text descriptions for each style?
   - **Assumption**: NOT NEEDED - Keep scope minimal for v1

4. **Migration Guide**: Should we create merchant documentation?
   - **Assumption**: NOT NEEDED - Feature is self-explanatory via theme editor

**Proceeding with implementation using stated assumptions.**

---

## Final Implementation Notes

**Total Changes**:
- 1 file modified: `sections/main-product.liquid` (add 28 lines)
- 1 file modified: `snippets/ks-product-pet-selector-stitch.liquid` (modify 4 image references)

**Estimated Time**: 1-2 hours
- Schema updates: 15 minutes
- Snippet updates: 30 minutes
- Testing: 30-45 minutes
- Documentation: 15 minutes (context_session_001.md)

**Deployment**: Automatic via GitHub push to main

**Testing Priority**: Mobile-first (70% of traffic)

**Rollback**: Easy (git revert + push)

**Risk Level**: LOW (additive changes with fallback)

---

**End of Implementation Plan**
