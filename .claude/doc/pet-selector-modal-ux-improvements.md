# Pet Selector Modal UX Improvements - Implementation Plan

**Created**: 2025-11-09
**Project**: Perkie-Gemini Testing Repository
**Context**: `.claude/tasks/context_session_001.md`
**Requested by**: User
**Estimated Effort**: 2-3 hours

---

## Executive Summary

This plan addresses two UX issues in the pet selector preview modal:
1. **Remove redundant modal subheader** that duplicates product title
2. **Improve progress indicators** during upload, processing, and generation phases

Both improvements enhance clarity and user confidence during the pet customization flow where 70% of orders come from mobile devices.

---

## Issue #1: Remove Redundant Modal Subheader

### Current Problem

**Location**: `assets/inline-preview-mvp.js` lines 286-291

**Current Behavior**:
```javascript
subtitleElement.textContent = `See how ${petName} looks on ${productTitle}`;
```

**What User Sees**:
```
"See how Riley looks on Pet Portrait in Black Frame Pet Portrait in Black Frame"
```

**Why This Happens**:
- Product title selector (`.product__title` or `h1`) is grabbing text that contains the product name twice
- The Shopify product title field itself may have duplicate text
- The modal is displaying exactly what it finds in the DOM

### Root Cause Analysis

The issue stems from line 287-289 in `assets/inline-preview-mvp.js`:

```javascript
const productTitle = document.querySelector('.product__title')?.textContent ||
                   document.querySelector('h1')?.textContent ||
                   'this product';
```

This selector is pulling the full text content from the product title element, which appears to contain duplicated text in the Shopify theme.

### Solution: Remove Subheader Entirely

**Why Remove vs. Fix**:
1. The subheader is redundant - user already knows:
   - Pet name (they just entered it)
   - Product name (they're on the product page)
   - Action (they clicked "Preview")
2. Simpler UX = better mobile experience (70% of orders)
3. More screen space for the actual preview content
4. Aligns with modern modal design patterns (title only, no subtitle)

**Implementation**:

**File**: `assets/inline-preview-mvp.js`

**Change 1** - Update `updateHeader()` method (lines 277-294):

```javascript
// BEFORE (lines 277-294)
updateHeader(petNumber, petName) {
  const titleElement = document.getElementById('inline-preview-title');
  const subtitleElement = document.getElementById('inline-preview-subtitle');

  if (titleElement) {
    titleElement.textContent = `Preview Pet ${petNumber}: ${petName}'s Portrait`;
  }

  if (subtitleElement) {
    // Get product title from page context
    const productTitle = document.querySelector('.product__title')?.textContent ||
                       document.querySelector('h1')?.textContent ||
                       'this product';
    subtitleElement.textContent = `See how ${petName} looks on ${productTitle}`;
  }

  console.log(`🎨 Header updated: Pet ${petNumber} - ${petName}`);
}

// AFTER (simplified)
updateHeader(petNumber, petName) {
  const titleElement = document.getElementById('inline-preview-title');
  const subtitleElement = document.getElementById('inline-preview-subtitle');

  if (titleElement) {
    titleElement.textContent = `Preview Pet ${petNumber}: ${petName}'s Portrait`;
  }

  // Hide subtitle entirely (removed redundant product title display)
  if (subtitleElement) {
    subtitleElement.style.display = 'none';
  }

  console.log(`🎨 Header updated: Pet ${petNumber} - ${petName}`);
}
```

**Change 2** - Update CSS for cleaner spacing (Optional but recommended):

**File**: `assets/inline-preview-mvp.css`

Find the `.inline-preview-subtitle` style block and add:

```css
.inline-preview-subtitle {
  /* Existing styles... */
  display: none; /* Hide by default - no longer used */
}
```

**Alternative Approach** (if subtitle element removal breaks layout):

Simply hide it with CSS only:

**File**: `assets/inline-preview-mvp.css`

```css
.inline-preview-subtitle {
  display: none !important; /* Force hide */
}
```

**Testing Checklist**:
- [ ] Open modal with pet name "Riley"
- [ ] Verify only title shows: "Preview Pet 1: Riley's Portrait"
- [ ] Verify no subheader text appears
- [ ] Check spacing looks clean (no awkward gaps)
- [ ] Test on mobile (320px, 375px, 414px widths)
- [ ] Test on desktop (1920px width)

---

## Issue #2: Improve Progress Indicators

### Current Problem

**Symptoms**:
1. Upload shows only "Uploading..." text (no visual feedback)
2. Processing shows spinner but unclear what's happening
3. No time estimates during long waits (30-60s API calls)
4. Users don't know if system is working or stuck

**Impact on Conversion**:
- Mobile users (70% of orders) have poor cellular connections
- Unclear progress = perceived failure = abandoned carts
- 30-60 second wait feels like forever without feedback

### Current Implementation Analysis

**File**: `assets/inline-preview-mvp.js`

**Current Progress System** (lines 826-833):
```javascript
updateProgress(text, timer = '') {
  if (this.processingText) {
    this.processingText.textContent = text;
  }
  if (this.progressTimer && timer) {
    this.progressTimer.textContent = timer;
  }
}
```

**Current Progress Calls**:
1. Line 469: `updateProgress('Preparing image...', '⏱️ A few seconds...')`
2. Line 475: `updateProgress('Processing with AI...', '⏱️ 30-60 seconds...')`
3. Line 579: `updateProgress('Generating AI styles...', '⏱️ ~10 seconds for both styles...')`

**HTML Structure** (from `snippets/inline-preview-mvp.liquid` lines 52-63):
```html
<div class="inline-processing-view" hidden>
  <div class="inline-processing-spinner"></div>
  <div class="inline-processing-status">
    <div class="inline-processing-text">Processing your pet photo...</div>
    <div class="inline-progress-timer">⏱️ Estimating time...</div>
  </div>
  <div class="inline-progress-stage-info"></div>
  <button class="inline-cancel-btn" data-cancel-processing>
    Cancel Upload
  </button>
</div>
```

### What the Custom Image Processing Page Does Better

**Key Insight**: The standalone pet processor page (`/pages/custom-image-processing`) has better progress patterns that we should adopt.

**Pattern Comparison**:

| Feature | Current Modal | Processor Page | Recommendation |
|---------|--------------|----------------|----------------|
| **Visual Feedback** | Spinner only | Spinner + progress bar | Add progress bar |
| **Stage Info** | Generic text | Specific stages (1/3, 2/3, 3/3) | Add stage counter |
| **Time Estimates** | Static text | Dynamic countdown | Add countdown timer |
| **Error Recovery** | Generic message | Specific error types | Improve error messages |
| **Cancel Action** | Button hidden initially | Always visible | Show cancel earlier |

### Recommended Improvements

#### Improvement 1: Add Visual Progress Bar

**Why**:
- Mobile users need strong visual feedback (not just text)
- Progress bars reduce perceived wait time by 20-30%
- Clear indication of forward movement prevents abandonment

**Implementation**:

**File**: `snippets/inline-preview-mvp.liquid`

**Change lines 52-63** from:
```html
<div class="inline-processing-view" hidden>
  <div class="inline-processing-spinner"></div>
  <div class="inline-processing-status">
    <div class="inline-processing-text">Processing your pet photo...</div>
    <div class="inline-progress-timer">⏱️ Estimating time...</div>
  </div>
  <div class="inline-progress-stage-info"></div>
  <button class="inline-cancel-btn" data-cancel-processing>
    Cancel Upload
  </button>
</div>
```

**To**:
```html
<div class="inline-processing-view" hidden>
  <div class="inline-processing-spinner"></div>

  <!-- NEW: Visual progress bar -->
  <div class="inline-progress-bar-wrapper">
    <div class="inline-progress-bar">
      <div class="inline-progress-fill" data-progress-fill></div>
    </div>
    <div class="inline-progress-percentage" data-progress-percentage>0%</div>
  </div>

  <div class="inline-processing-status">
    <div class="inline-processing-text">Processing your pet photo...</div>
    <div class="inline-progress-timer">⏱️ Estimating time...</div>
    <div class="inline-progress-stage-info"></div>
  </div>

  <button class="inline-cancel-btn" data-cancel-processing>
    Cancel Upload
  </button>
</div>
```

**CSS to add** (`assets/inline-preview-mvp.css`):

```css
/* Progress Bar Styles */
.inline-progress-bar-wrapper {
  width: 100%;
  margin: 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.inline-progress-bar {
  flex: 1;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.inline-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff5964, #ff8a8f);
  border-radius: 4px;
  transition: width 0.3s ease-out;
  width: 0%;
}

.inline-progress-percentage {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  min-width: 3rem;
  text-align: right;
}

/* Mobile: Stack percentage below bar */
@media (max-width: 640px) {
  .inline-progress-bar-wrapper {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .inline-progress-percentage {
    text-align: center;
  }
}
```

#### Improvement 2: Add Stage Counter

**Why**:
- Users understand "Step 2 of 3" better than generic "Processing..."
- Reduces anxiety by showing finite progress
- Mobile users especially benefit from clear milestones

**Implementation**:

**File**: `assets/inline-preview-mvp.js`

**Update `updateProgress()` method** (lines 826-833):

```javascript
// BEFORE
updateProgress(text, timer = '') {
  if (this.processingText) {
    this.processingText.textContent = text;
  }
  if (this.progressTimer && timer) {
    this.progressTimer.textContent = timer;
  }
}

// AFTER (enhanced with stage and progress)
updateProgress(text, timer = '', stage = null, percentage = null) {
  // Update main status text
  if (this.processingText) {
    this.processingText.textContent = text;
  }

  // Update timer
  if (this.progressTimer && timer) {
    this.progressTimer.textContent = timer;
  }

  // Update stage info (e.g., "Step 2 of 3")
  if (this.progressStageInfo && stage) {
    this.progressStageInfo.textContent = stage;
    this.progressStageInfo.style.display = 'block';
  }

  // Update progress bar
  const progressFill = this.modal.querySelector('[data-progress-fill]');
  const progressPercentage = this.modal.querySelector('[data-progress-percentage]');

  if (progressFill && percentage !== null) {
    progressFill.style.width = `${percentage}%`;
  }

  if (progressPercentage && percentage !== null) {
    progressPercentage.textContent = `${percentage}%`;
  }
}
```

**Update progress calls in `processImage()` method**:

```javascript
// Line 469 - BEFORE
this.updateProgress('Preparing image...', '⏱️ A few seconds...');

// Line 469 - AFTER
this.updateProgress(
  'Preparing image...',
  '⏱️ A few seconds...',
  'Step 1 of 3',
  10
);

// Line 475 - BEFORE
this.updateProgress('Processing with AI...', '⏱️ 30-60 seconds...');

// Line 475 - AFTER
this.updateProgress(
  'Removing background...',
  '⏱️ 30-60 seconds...',
  'Step 2 of 3',
  33
);

// After background removal completes (add new call around line 478)
this.updateProgress(
  'Creating preview effects...',
  '⏱️ A few more seconds...',
  'Step 3 of 3',
  66
);

// Line 579 - Gemini generation (BEFORE)
this.updateProgress('Generating AI styles...', '⏱️ ~10 seconds for both styles...');

// Line 579 - Gemini generation (AFTER)
this.updateProgress(
  'Generating artistic styles...',
  '⏱️ ~10 seconds per style...',
  'Bonus: AI Effects',
  75
);

// After processing complete (add around line 498)
this.updateProgress(
  'Complete!',
  '✅ Ready to preview',
  'Done',
  100
);
```

#### Improvement 3: Better Upload Feedback

**Current Problem**:
- File upload has NO progress indicator
- User sees nothing while image uploads to browser memory
- Especially problematic for large images (10MB+) on mobile

**Solution**: Add upload progress during file read

**File**: `assets/inline-preview-mvp.js`

**Add to `handleFileSelect()` method** (around line 360-380):

```javascript
async handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    this.showError('File too large. Please choose an image under 10MB.');
    return;
  }

  if (!file.type.startsWith('image/')) {
    this.showError('Please select a valid image file (JPG or PNG).');
    return;
  }

  // NEW: Show upload progress during file read
  this.showView('processing');
  this.updateProgress(
    'Loading your image...',
    '⏱️ Just a moment...',
    'Uploading',
    0
  );

  // Simulate progress during file read (psychological feedback)
  let uploadProgress = 0;
  const uploadInterval = setInterval(() => {
    uploadProgress += 5;
    if (uploadProgress <= 30) {
      this.updateProgress(
        'Loading your image...',
        '⏱️ Just a moment...',
        'Uploading',
        uploadProgress
      );
    }
  }, 100);

  // Read file
  try {
    await this.processImage(file);
    clearInterval(uploadInterval);
  } catch (error) {
    clearInterval(uploadInterval);
    throw error;
  }
}
```

#### Improvement 4: Enhanced Error Messages

**Current**: Generic "Failed to process image. Please try again."

**Better**: Specific error messages with recovery actions

**File**: `assets/inline-preview-mvp.js`

**Update error handling** (around line 500-504):

```javascript
// BEFORE
catch (error) {
  console.error('❌ Processing error:', error);
  this.showError(error.message || 'Failed to process image. Please try again.');
}

// AFTER (enhanced with specific messages)
catch (error) {
  console.error('❌ Processing error:', error);

  let userMessage = 'Something went wrong. Please try again.';

  // Provide specific messages based on error type
  if (error.message.includes('network') || error.message.includes('fetch')) {
    userMessage = 'Network connection lost. Please check your connection and try again.';
  } else if (error.message.includes('timeout')) {
    userMessage = 'Processing is taking longer than expected. Your connection might be slow - try again with a smaller image.';
  } else if (error.message.includes('size') || error.message.includes('large')) {
    userMessage = 'Image is too large to process. Try a smaller file (under 10MB).';
  } else if (error.message.includes('format')) {
    userMessage = 'Image format not supported. Please use JPG or PNG.';
  } else if (error.message.includes('Background removal failed')) {
    userMessage = 'AI processing failed. This sometimes happens with unclear images - try a different photo with better lighting.';
  }

  this.showError(userMessage);
}
```

#### Improvement 5: CSS for Stage Info Display

**File**: `assets/inline-preview-mvp.css`

Add styles for the stage counter:

```css
.inline-progress-stage-info {
  display: none; /* Hidden by default, shown when stage is set */
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  text-align: center;
  margin-top: 0.5rem;
  padding: 0.375rem 0.75rem;
  background-color: #f3f4f6;
  border-radius: 12px;
  display: inline-block;
}

.inline-processing-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}
```

---

## Implementation Checklist

### Issue #1: Remove Subheader
- [ ] Modify `updateHeader()` in `assets/inline-preview-mvp.js` (lines 277-294)
- [ ] Hide subtitle element with `style.display = 'none'`
- [ ] Add CSS rule to `assets/inline-preview-mvp.css` for `.inline-preview-subtitle`
- [ ] Test on Chrome DevTools MCP with Shopify test URL
- [ ] Verify no subheader appears
- [ ] Check spacing looks clean
- [ ] Test mobile (320px, 375px) and desktop (1920px)

### Issue #2: Progress Indicators

**Phase A: Visual Progress Bar** (30 min)
- [ ] Add HTML markup to `snippets/inline-preview-mvp.liquid` (lines 52-63)
- [ ] Add CSS styles to `assets/inline-preview-mvp.css`
- [ ] Update `updateProgress()` method in `assets/inline-preview-mvp.js`
- [ ] Test progress bar animates smoothly

**Phase B: Stage Counter** (30 min)
- [ ] Update `updateProgress()` method signature with stage parameter
- [ ] Update all `updateProgress()` calls with stage info
- [ ] Add CSS for `.inline-progress-stage-info`
- [ ] Test "Step X of Y" displays correctly

**Phase C: Upload Feedback** (30 min)
- [ ] Modify `handleFileSelect()` method
- [ ] Add upload progress simulation during file read
- [ ] Test with large images (5MB+) on mobile network throttling

**Phase D: Better Error Messages** (30 min)
- [ ] Update error handling with specific messages
- [ ] Test each error type (network, timeout, size, format)
- [ ] Verify user-friendly recovery instructions

**Phase E: Integration Testing** (30 min)
- [ ] Test complete flow: Upload → Process → Generate → Complete
- [ ] Verify progress bar goes 0% → 100% smoothly
- [ ] Check stage counter updates correctly
- [ ] Test cancel button works at all stages
- [ ] Test on mobile (Chrome DevTools device emulation)
- [ ] Test on slow 3G connection (Chrome throttling)

---

## Testing Strategy

### Prerequisites
1. Ask user for current Shopify test URL (URLs expire periodically)
2. Use Chrome DevTools MCP for testing (browser automation + console access)
3. Enable network throttling to simulate mobile conditions

### Test Scenarios

#### Scenario 1: Happy Path
1. Open product page with pet selector
2. Enter pet name "Riley"
3. Upload image (2-3MB JPEG)
4. Observe progress indicators:
   - ✅ "Step 1 of 3" - Preparing image (10%)
   - ✅ "Step 2 of 3" - Removing background (33%)
   - ✅ "Step 3 of 3" - Creating effects (66%)
   - ✅ "Bonus: AI Effects" - Generating styles (75%)
   - ✅ "Done" - Complete (100%)
5. Verify modal title shows: "Preview Pet 1: Riley's Portrait"
6. Verify NO subheader appears
7. Click through effects (B&W, Color, Modern, Sketch)
8. Add artist notes
9. Click Continue

#### Scenario 2: Large File Upload
1. Upload 8-10MB image
2. Verify upload progress shows during file read
3. Verify smooth transition to processing
4. Verify all stages complete successfully

#### Scenario 3: Network Error
1. Enable Chrome DevTools offline mode mid-processing
2. Verify error message is specific and helpful
3. Verify "Try Again" button works

#### Scenario 4: Mobile Device
1. Use Chrome DevTools device emulation (iPhone 12 Pro)
2. Enable "Slow 3G" network throttling
3. Upload image
4. Verify progress bar visible and clear
5. Verify stage info doesn't overflow
6. Verify text is readable at small sizes

#### Scenario 5: Cancel Processing
1. Start upload
2. Click "Cancel Upload" at different stages
3. Verify cancellation works cleanly
4. Verify can start over without errors

---

## Files Modified

### Core Changes
1. **`assets/inline-preview-mvp.js`**
   - Lines 277-294: `updateHeader()` method - remove subheader logic
   - Lines 360-380: `handleFileSelect()` method - add upload progress
   - Lines 460-504: `processImage()` method - add stage progress calls
   - Lines 826-833: `updateProgress()` method - enhance with stage/percentage params
   - Lines 500-504: Error handling - add specific error messages

2. **`snippets/inline-preview-mvp.liquid`**
   - Lines 52-63: Processing view HTML - add progress bar markup
   - Line 32: Subtitle element - will be hidden via JS

3. **`assets/inline-preview-mvp.css`**
   - Add: `.inline-progress-bar-wrapper` styles
   - Add: `.inline-progress-bar` styles
   - Add: `.inline-progress-fill` styles
   - Add: `.inline-progress-percentage` styles
   - Add: `.inline-progress-stage-info` styles
   - Update: `.inline-preview-subtitle` - add `display: none`

### No Changes Required
- `snippets/ks-product-pet-selector-stitch.liquid` - No changes needed
- `assets/pet-storage.js` - No changes needed
- `sections/ks-pet-processor-v5.liquid` - No changes needed

---

## Deployment

### Pre-Deployment
1. Test all changes locally using Chrome DevTools MCP
2. Verify with user on current Shopify test URL
3. Check console for any errors
4. Test on real mobile device if possible

### Deployment Process
```bash
# Add all modified files
git add assets/inline-preview-mvp.js \
        assets/inline-preview-mvp.css \
        snippets/inline-preview-mvp.liquid

# Commit with descriptive message
git commit -m "$(cat <<'EOF'
UX: Improve pet selector modal clarity and progress feedback

Issue #1: Remove redundant modal subheader
- Hides duplicate product title in modal subtitle
- Cleaner header with just pet name and number
- More screen space for preview content

Issue #2: Enhanced progress indicators
- Add visual progress bar (0-100%)
- Add stage counter ("Step 2 of 3")
- Add upload feedback during file read
- Improve error messages with specific recovery actions

Impact:
- Better mobile UX (70% of orders)
- Reduced perceived wait time during 30-60s processing
- Clearer feedback reduces abandonment
- Specific error messages improve recovery rate

Files modified:
- assets/inline-preview-mvp.js (progress logic)
- assets/inline-preview-mvp.css (progress styles)
- snippets/inline-preview-mvp.liquid (progress markup)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

# Push to main (auto-deploys to Shopify test)
git push origin main

# Changes appear on test URL within ~1-2 minutes
```

### Post-Deployment
1. Test on Shopify test URL immediately
2. Verify all progress stages work
3. Test on mobile device
4. Monitor for console errors
5. Get user approval before considering complete

---

## Risks & Mitigation

### Risk 1: Progress Bar Performance
**Risk**: Smooth animations might be janky on older mobile devices
**Mitigation**: Use CSS transitions (hardware accelerated), limit updates to 100ms intervals
**Fallback**: Progress still works, just less smooth on old devices

### Risk 2: Stage Timing Accuracy
**Risk**: Progress percentages might not match actual processing time
**Mitigation**: Use conservative estimates, focus on "forward progress" not accuracy
**Fallback**: Users see movement, even if timing isn't perfect

### Risk 3: Layout Breaking on Mobile
**Risk**: New progress elements might overflow on small screens
**Mitigation**: Test on 320px width (iPhone SE), use flexible layouts
**Fallback**: Stack elements vertically on mobile, reduce font sizes

### Risk 4: Subheader Removal Creates Layout Gap
**Risk**: Hiding subtitle might leave awkward spacing
**Mitigation**: Test thoroughly, adjust CSS margins if needed
**Fallback**: Keep subtitle element in DOM, just hide with CSS

---

## Success Metrics

### Immediate (Post-Deployment)
- [ ] Modal subheader no longer displays redundant text
- [ ] Progress bar animates from 0% to 100%
- [ ] Stage counter updates at each phase
- [ ] Upload feedback appears during file read
- [ ] Error messages are specific and helpful
- [ ] No console errors
- [ ] Mobile layout doesn't break

### Short-Term (1-2 weeks)
- [ ] User feedback on clarity improvement
- [ ] Reduced support tickets about "stuck" processing
- [ ] Preview completion rate increases (track abandonment)

### Long-Term (1-3 months)
- [ ] Overall conversion rate impact (baseline: track for 2 weeks first)
- [ ] Mobile conversion vs desktop (should narrow gap)
- [ ] Customer satisfaction (survey or reviews mentioning preview)

---

## Future Enhancements (Out of Scope)

These are NOT included in this implementation but could be considered later:

1. **Real-time countdown timer** - Show actual seconds remaining (requires server timing data)
2. **Animated spinner variants** - Different animations for different stages
3. **Sound effects** - Completion chime (accessibility concern, needs mute option)
4. **Haptic feedback** - Vibration on mobile when processing completes
5. **Preview thumbnail during processing** - Show low-res preview while high-res processes
6. **Retry logic** - Auto-retry failed requests before showing error
7. **Background processing** - Allow user to close modal while processing continues

---

## Questions for User

Before implementation, clarify:

1. **Subheader removal**: Confirm you want it completely removed (not just fixed)?
2. **Progress accuracy**: OK with estimated percentages vs real-time tracking?
3. **Error messages**: Should we log errors to analytics/monitoring service?
4. **Testing URL**: What's the current Shopify test URL? (URLs expire)
5. **Priority**: Should this be implemented before or after other pending work?

---

## References

### Related Documentation
- `.claude/tasks/context_session_001.md` - Current session context
- `CLAUDE.md` - Project overview and guidelines
- `GEMINI_ARTISTIC_API_BUILD_GUIDE.md` - API integration details

### Related Files
- `assets/inline-preview-mvp.js` - Main modal JavaScript
- `snippets/inline-preview-mvp.liquid` - Modal HTML structure
- `assets/inline-preview-mvp.css` - Modal styles
- `snippets/ks-product-pet-selector-stitch.liquid` - Pet selector integration
- `assets/pet-storage.js` - Storage utilities

### Related Issues
- Upload progress bars were removed per user request (line 118 in pet-selector-stitch.liquid)
- This plan re-introduces progress indicators but in a cleaner, modal-specific way

---

## Appendix A: Code Snippets

### Complete `updateProgress()` Method

```javascript
/**
 * Update progress display with stage and percentage
 * @param {string} text - Main status message
 * @param {string} timer - Time estimate (optional)
 * @param {string} stage - Stage label like "Step 2 of 3" (optional)
 * @param {number} percentage - Progress percentage 0-100 (optional)
 */
updateProgress(text, timer = '', stage = null, percentage = null) {
  // Update main status text
  if (this.processingText) {
    this.processingText.textContent = text;
  }

  // Update timer
  if (this.progressTimer && timer) {
    this.progressTimer.textContent = timer;
  }

  // Update stage info
  if (this.progressStageInfo) {
    if (stage) {
      this.progressStageInfo.textContent = stage;
      this.progressStageInfo.style.display = 'inline-block';
    } else {
      this.progressStageInfo.style.display = 'none';
    }
  }

  // Update progress bar
  const progressFill = this.modal.querySelector('[data-progress-fill]');
  const progressPercentage = this.modal.querySelector('[data-progress-percentage]');

  if (progressFill && percentage !== null) {
    progressFill.style.width = `${percentage}%`;
  }

  if (progressPercentage && percentage !== null) {
    progressPercentage.textContent = `${Math.round(percentage)}%`;
  }

  console.log(`📊 Progress: ${text} (${percentage}%)`);
}
```

### Complete Progress HTML

```html
<div class="inline-processing-view" hidden>
  <!-- Spinner -->
  <div class="inline-processing-spinner"></div>

  <!-- Progress Bar -->
  <div class="inline-progress-bar-wrapper">
    <div class="inline-progress-bar">
      <div class="inline-progress-fill" data-progress-fill></div>
    </div>
    <div class="inline-progress-percentage" data-progress-percentage>0%</div>
  </div>

  <!-- Status Messages -->
  <div class="inline-processing-status">
    <div class="inline-processing-text">Processing your pet photo...</div>
    <div class="inline-progress-timer">⏱️ Estimating time...</div>
    <div class="inline-progress-stage-info"></div>
  </div>

  <!-- Cancel Button -->
  <button class="inline-cancel-btn" data-cancel-processing>
    Cancel Upload
  </button>
</div>
```

---

## Approval & Sign-Off

**Prepared by**: UX Design E-commerce Expert (Sub-agent)
**Date**: 2025-11-09
**Estimated Effort**: 2-3 hours
**Risk Level**: Low (isolated changes, easy to revert)

**Ready for implementation**: YES ✅
**Requires user approval**: YES - Confirm approach before coding

---

*End of Implementation Plan*
