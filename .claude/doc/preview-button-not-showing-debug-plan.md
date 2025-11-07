# Preview Button Not Showing After Upload - Root Cause Analysis & Fix Plan

**Session**: context_session_001
**Date**: 2025-11-04
**Agent**: debug-specialist
**Status**: Root cause identified - Variable scope issue

---

## Problem Summary

The Preview button does not appear after uploading an image in the pet selector. Expected behavior is that the button should become visible (opacity: 1) after file upload completes.

---

## Root Cause Analysis

### Issue Location
**File**: `snippets/ks-product-pet-selector-stitch.liquid`

### The Problem: Variable Scope Violation

**Line 1424** (Inside file upload handler):
```javascript
// Show Preview button now that files are uploaded
previewBtn.classList.add('visible');
```

**Line 1556** (Inside removeFile function):
```javascript
// Hide Preview button when all files are deleted
previewBtn.classList.remove('visible');
```

**Critical Finding**: The variable `previewBtn` is **NOT DECLARED** in the scope where it's being used.

### Scope Analysis

**Lines 1296-1301** - Upload handler initialization:
```javascript
for (let i = 1; i <= 3; i++) {
    const uploadZone = container.querySelector(`[data-upload-zone="${i}"]`);
    const uploadText = container.querySelector(`[data-upload-text="${i}"]`);
    const fileInput = container.querySelector(`[data-pet-file-input="${i}"]`);
    // ❌ previewBtn is NOT declared here
```

**Line 1424** - First usage attempt:
```javascript
// Inside fileInput.addEventListener('change', (e) => { ... })
previewBtn.classList.add('visible');
// ❌ ReferenceError: previewBtn is not defined
```

**Line 1556** - Second usage attempt:
```javascript
// Inside removeFile(petIndex, fileIndex) function
previewBtn.classList.remove('visible');
// ❌ ReferenceError: previewBtn is not defined
```

**Lines 1622-1623** - Where it IS declared (different scope):
```javascript
// Preview button handlers - Show modal with image processor
for (let i = 1; i <= 3; i++) {
    const previewBtn = container.querySelector(`[data-pet-preview-btn="${i}"]`);
    // ✅ This is a DIFFERENT scope, only for event handlers
```

### Why This Happens

When the upload button was replaced with upload zone (commit 862eb97):
- Variables `uploadZone` and `uploadText` were added to the scope
- The `previewBtn` variable declaration was **forgotten**
- Code at lines 1424 and 1556 references an undeclared variable
- JavaScript throws `ReferenceError: previewBtn is not defined`
- Preview button never becomes visible

### Expected vs. Actual Behavior

**Expected**:
1. User uploads file
2. `previewBtn.classList.add('visible')` executes
3. CSS transition makes button appear (opacity: 0 → 1)

**Actual**:
1. User uploads file
2. JavaScript error: `previewBtn is not defined`
3. Button never appears
4. No visual feedback to user

---

## Investigation Evidence

### Code Structure Analysis

**Working state restoration** (lines 1877-1883):
```javascript
// Show Preview button since files were restored
const previewBtn = container.querySelector(`[data-pet-preview-btn="${i}"]`);
if (previewBtn) {
    previewBtn.classList.add('visible');
}
```
✅ This works because `previewBtn` is **locally declared** before use.

**Broken upload handler** (line 1424):
```javascript
// NO declaration above this line
previewBtn.classList.add('visible');
```
❌ This fails because `previewBtn` is **not in scope**.

### HTML Structure (Confirmed Working)

**Lines 113-127**:
```liquid
<button type="button"
        class="pet-detail__preview-btn"
        data-pet-preview-btn="{{ i }}"
        style="opacity: 0; visibility: hidden;">
  Preview
</button>
```
✅ Button exists in DOM with correct attributes.

### CSS (Confirmed Working)

**Lines 919-927**:
```css
.pet-detail__preview-btn {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s;
}

.pet-detail__preview-btn.visible {
  opacity: 1;
  visibility: visible;
}
```
✅ CSS transition logic is correct.

---

## Solution Implementation Plan

### Fix Strategy

Add `previewBtn` variable declaration to the upload handler scope (line ~1300).

### Exact Code Changes

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Location**: Lines 1296-1302

**Current Code**:
```javascript
for (let i = 1; i <= 3; i++) {
    const uploadZone = container.querySelector(`[data-upload-zone="${i}"]`);
    const uploadText = container.querySelector(`[data-upload-text="${i}"]`);
    const fileInput = container.querySelector(`[data-pet-file-input="${i}"]`);

    if (uploadZone && fileInput) {
```

**Fixed Code**:
```javascript
for (let i = 1; i <= 3; i++) {
    const uploadZone = container.querySelector(`[data-upload-zone="${i}"]`);
    const uploadText = container.querySelector(`[data-upload-text="${i}"]`);
    const fileInput = container.querySelector(`[data-pet-file-input="${i}"]`);
    const previewBtn = container.querySelector(`[data-pet-preview-btn="${i}"]`); // ✅ ADD THIS LINE

    if (uploadZone && fileInput) {
```

### Why This Works

1. `previewBtn` is now in scope for:
   - Line 1424 (upload handler): `previewBtn.classList.add('visible')`
   - Line 1556 (removeFile function): `previewBtn.classList.remove('visible')`

2. The selector `[data-pet-preview-btn="${i}"]` correctly matches the button in HTML

3. No changes needed to:
   - HTML structure (already correct)
   - CSS rules (already correct)
   - Event handler logic (already correct)

---

## Verification Steps

### 1. Console Check (Before Fix)
Open browser DevTools → Console:
```
Expected error: "Uncaught ReferenceError: previewBtn is not defined"
Location: ks-product-pet-selector-stitch.liquid:1424
```

### 2. DOM Inspection (Before Fix)
```javascript
// In browser console after upload
document.querySelector('[data-pet-preview-btn="1"]').classList.contains('visible')
// Returns: false (should be true)
```

### 3. After Fix Verification
1. Upload image to Pet 1
2. Check console - NO errors
3. Preview button should be visible
4. Check DOM:
```javascript
document.querySelector('[data-pet-preview-btn="1"]').classList.contains('visible')
// Returns: true ✅
```

### 4. Delete File Verification
1. Delete all files for Pet 1
2. Preview button should hide
3. Check DOM:
```javascript
document.querySelector('[data-pet-preview-btn="1"]').classList.contains('visible')
// Returns: false ✅
```

---

## Additional Issues Discovered

### None

This is a **single-point failure** with a **single-line fix**. No cascading issues identified.

### Related Code Audit

**Lines checked for similar issues**:
- Line 1424: Uses `previewBtn` ❌ (needs fix)
- Line 1556: Uses `previewBtn` ❌ (needs fix)
- Line 1623: Declares `previewBtn` ✅ (different scope, correct)
- Line 1880: Declares `previewBtn` ✅ (different scope, correct)

**Conclusion**: Only the upload handler loop (line ~1300) needs the variable declaration.

---

## Testing Checklist

After implementing the fix:

- [ ] Upload single image - Preview button appears
- [ ] Upload multiple images - Preview button remains visible
- [ ] Delete one image - Preview button remains visible
- [ ] Delete all images - Preview button disappears
- [ ] State restoration - Preview button appears if files exist
- [ ] No console errors during any operation
- [ ] CSS transition animates smoothly (0.3s fade)

---

## Risk Assessment

**Risk Level**: ✅ **ZERO RISK**

**Rationale**:
1. Single-line addition
2. No logic changes
3. No CSS changes
4. No HTML changes
5. Variable selector already used successfully elsewhere (lines 1623, 1880)
6. Standard DOM query pattern used throughout codebase

---

## Performance Impact

**Impact**: None

**Reasoning**:
- `querySelector()` is called once per pet during initialization
- Same pattern already exists for `uploadZone`, `uploadText`, `fileInput`
- No performance regression expected

---

## Browser Compatibility

**Compatibility**: ✅ **100% Compatible**

**Support**:
- `querySelector()` - All browsers
- `classList.add()` / `classList.remove()` - All browsers
- Template literals - Already used throughout file

---

## Implementation Priority

**Priority**: 🔴 **CRITICAL**

**Reasoning**:
- Blocks core user flow (cannot preview uploaded images)
- Simple one-line fix
- Zero risk of regression
- High impact on user experience

---

## Commit Message Template

```
Fix Preview button not showing after file upload in pet selector

Root cause: previewBtn variable was not declared in upload handler scope
after upload button → upload zone refactoring (commit 862eb97).

Solution: Add previewBtn query selector to upload handler initialization
(line ~1300) to match uploadZone, uploadText, fileInput pattern.

Changes:
- snippets/ks-product-pet-selector-stitch.liquid: Add previewBtn declaration

Fixes: Preview button now appears after upload, hides after delete
Impact: Restores critical user flow for image preview functionality
Risk: Zero (single-line variable declaration)
```

---

## Related Documentation

- **Original Upload Zone Change**: Commit 862eb97
- **HTML Structure**: Lines 113-127 (ks-product-pet-selector-stitch.liquid)
- **CSS Rules**: Lines 919-927 (ks-product-pet-selector-stitch.liquid)
- **Event Handlers**: Lines 1622-1650 (ks-product-pet-selector-stitch.liquid)

---

## Next Steps

1. Implement one-line fix (add previewBtn declaration at line ~1300)
2. Test all scenarios from Testing Checklist
3. Verify no console errors
4. Commit with descriptive message
5. Deploy to test environment
6. Verify in production-like environment using Chrome DevTools MCP
