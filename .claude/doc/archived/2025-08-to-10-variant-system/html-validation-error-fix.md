# HTML Validation Error Fix - Implementation Plan

## Executive Summary
**Problem**: Shopify theme validation error reporting "Broken HTML has been detected in your theme's sections/main-page.liquid file"

**Root Cause**: The error is NOT in main-page.liquid structure itself, but likely in page content rendered through `{{ page.content }}` that contains malformed HTML.

**Impact**: Theme validation fails, potentially affecting theme updates and functionality.

**Timeline**: 1-2 hours for diagnosis and fix

---

## Root Cause Analysis

### Initial Investigation Results
1. **main-page.liquid Structure**: ✅ VALID
   - All HTML tags properly opened and closed
   - Valid Liquid syntax throughout
   - Schema section properly formatted

2. **Recent Changes Analysis**:
   - Recent commits modified `snippets/ks-product-pet-selector.liquid`
   - Changes involved metafield implementation and visual counter
   - **FINDING**: Multi-line HTML tags (lines 52, 65, 72, 76) could trigger false positives in validation

3. **Pet Selector File Review**:
   - HTML structure is actually valid (tags properly closed on subsequent lines)
   - Grep search revealed multi-line tags, not unclosed tags
   - Modern HTML parsers handle multi-line attributes correctly

### True Root Cause Hypothesis
The error is most likely caused by **content within `{{ page.content }}`** that contains:
- Unclosed HTML tags entered through Shopify admin
- Malformed HTML in page content
- Invalid nesting of HTML elements
- Missing closing tags in rich text content

---

## Implementation Plan

### Phase 1: Diagnostic Steps (30 minutes)

#### Step 1.1: Identify Affected Pages
**Objective**: Find which page(s) contain the malformed HTML

**Actions**:
1. Access Shopify Admin → Online Store → Pages
2. Review all pages that use the `main-page.liquid` template
3. Check pages with rich text content, especially:
   - Custom image processing page
   - Pet background remover page
   - Any pages with embedded HTML/scripts

**Files to examine**: None (admin-side investigation)

#### Step 1.2: Content Validation
**Objective**: Validate HTML content in page bodies

**Actions**:
1. For each page, inspect the HTML source in page content editor
2. Look for common issues:
   - `<div>` without closing `</div>`
   - `<p>` tags within other `<p>` tags (invalid nesting)
   - `<img>` tags without proper closing (though self-closing)
   - Script tags with missing closing tags
   - Embedded iframe content with malformed attributes

**Tools**: Browser developer tools, HTML validator

#### Step 1.3: Template Usage Verification
**Objective**: Confirm which template is causing the validation error

**Actions**:
1. Check if error persists when pages use different templates
2. Verify the error is specifically tied to main-page.liquid usage
3. Test with minimal page content to isolate the issue

### Phase 2: Content Sanitization (45 minutes)

#### Step 2.1: HTML Content Cleanup
**Objective**: Fix malformed HTML in page content

**Primary Actions**:
1. **Access each problematic page** in Shopify Admin
2. **Switch to HTML view** in content editor
3. **Validate and fix HTML**:
   - Ensure all opening tags have corresponding closing tags
   - Fix nested paragraph tags (move content outside)
   - Validate script and style tag closures
   - Ensure proper attribute quoting

**Example fixes**:
```html
<!-- BEFORE (broken) -->
<div class="custom-content"
<p>Content here
<script>
// code without closing tag

<!-- AFTER (fixed) -->
<div class="custom-content">
<p>Content here</p>
<script>
// code
</script>
```

#### Step 2.2: Template Protection Enhancement (Optional)
**Objective**: Add HTML validation to prevent future issues

**File**: `sections/main-page.liquid`
**Changes**:
- Add HTML validation wrapper around `{{ page.content }}`
- Consider content sanitization filters

**Implementation**:
```liquid
<!-- Enhanced content rendering with validation -->
<div class="rte{% if settings.animations_reveal_on_scroll %} scroll-trigger animate--slide-in{% endif %}">
  {% comment %} Sanitize page content for HTML validation {% endcomment %}
  {{ page.content | strip_html | truncate: 5000 | default: page.content }}
</div>
```

**Note**: This is aggressive sanitization - only implement if content fixes don't resolve the issue.

### Phase 3: Validation and Prevention (15 minutes)

#### Step 3.1: Theme Validation Test
**Objective**: Verify fix resolves validation error

**Actions**:
1. **Save all content changes** in Shopify Admin
2. **Re-run theme validation** in Shopify theme editor
3. **Verify error clearance** in validation report
4. **Test page rendering** to ensure no display issues

#### Step 3.2: Content Guidelines Implementation
**Objective**: Prevent future HTML validation issues

**Actions**:
1. **Document HTML guidelines** for content editors
2. **Create content templates** with pre-validated HTML structures
3. **Implement content review process** for pages using main-page template

---

## Expected Outcomes

### Immediate Results
- ✅ Shopify theme validation passes without HTML errors
- ✅ All pages render correctly with proper HTML structure
- ✅ No impact on existing functionality

### Long-term Benefits
- 🔒 Prevention of similar HTML validation issues
- 📈 Improved theme maintenance and updates
- ✨ Better SEO through valid HTML structure

---

## Risk Assessment

### Low Risk
- **Content fixes**: Unlikely to break functionality
- **HTML validation**: Improves rather than degrades quality

### Medium Risk
- **Template modifications**: Could affect page rendering if implemented incorrectly
- **Content sanitization**: Might remove intended formatting

### Mitigation Strategies
1. **Backup content** before making changes
2. **Test in staging** before applying to production
3. **Incremental fixes** rather than bulk changes
4. **Fallback plan**: Revert to original content if issues arise

---

## Implementation Notes

### Critical Assumptions
1. Error is content-related rather than template structural
2. Shopify validation is detecting actual HTML issues, not false positives
3. Recent metafield changes are coincidental, not causal

### Dependencies
- Access to Shopify Admin for content editing
- Theme validation tool in Shopify admin
- Browser developer tools for HTML inspection

### Success Criteria
1. ✅ Shopify theme validation reports no HTML errors
2. ✅ All pages load without HTML rendering issues
3. ✅ No functionality regression in pet selector or other features
4. ✅ Clean browser console without HTML parsing errors

---

## Next Steps After Implementation

1. **Monitor theme validation** for any recurring issues
2. **Document content best practices** for future content creation
3. **Review other templates** for similar potential issues
4. **Consider implementing** HTML validation tools in content workflow

---

**Estimated Total Time**: 1.5-2 hours
**Priority**: High (blocks theme maintenance)
**Complexity**: Low-Medium (content investigation and cleanup)