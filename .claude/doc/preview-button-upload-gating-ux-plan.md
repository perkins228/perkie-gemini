# Preview Button Upload Gating - UX Implementation Plan

**Created**: 2025-11-07
**Type**: UX Design + Implementation Specification
**Context**: `.claude/tasks/context_session_001.md`
**Problem**: Preview button may be clickable before image upload completes (2-10s GCS upload)
**Business Impact**: Customer frustration from premature clicks, conversion loss
**Mobile Priority**: 70% of orders come from mobile devices

---

## 1. RECOMMENDED UX APPROACH

**Selected Strategy: Option D+ (Multi-Layer Gating with Progressive Disclosure)**

Combination of:
- **Gate on upload state** (disabled until complete)
- **Gate on pet name** (name + upload both required)
- **Progressive visual feedback** (clear loading states)
- **Inline status indicators** (upload progress near button)
- **Graceful error handling** (upload failures with retry)

### Why This Approach

**User Psychology:**
1. **Prevents false starts** - Disabled button stops premature clicks
2. **Sets expectations** - Loading state communicates "wait time is normal"
3. **Reduces anxiety** - Progress indicator shows "it's working"
4. **Maintains momentum** - Clear unlock signal when ready to proceed

**Technical Fit:**
- Already have upload state tracking (`uploading` class, line 1727)
- Already have GCS URL storage (line 1748)
- Already have fallback base64 path (line 1754-1772)
- Preview button already checks for image existence (line 1968-1971)

**Mobile Optimization:**
- Large, unambiguous disabled state (no tiny spinners)
- High-contrast visual feedback for outdoor viewing
- Touch-friendly button sizes maintained
- Prevents accidental double-taps during upload

---

## 2. VISUAL STATE SPECIFICATIONS

### State 1: No Image Uploaded (Initial)
**Appearance:**
- Preview button: **HIDDEN** (not just disabled)
- Upload zone: Default "Add Image" state
- Status text: None visible

**Rationale:** Don't show preview button until there's something to preview. Reduces visual clutter, focuses user on upload action.

### State 2: Uploading (2-10 seconds)
**Appearance:**
- Preview button: **VISIBLE + DISABLED**
- Button text: "Uploading..." with animated dots (...)
- Button style:
  - Background: Light gray (#E5E5E5)
  - Text: Dark gray (#666666)
  - Border: 1px solid #CCCCCC
  - Cursor: `not-allowed`
  - Opacity: 0.6
- Upload zone: Shows "Uploading..." (already implemented, line 1726)
- Status indicator: Small spinner icon next to button text (optional)

**Mobile-Specific:**
- Button remains same size (44x44px minimum tap target)
- Animated dots instead of spinner (works better on slower connections)
- High contrast (E5E5E5 vs 666666 = 4.6:1 ratio, WCAG AA compliant)

**Implementation:**
```css
.pet-detail__preview-btn[disabled] {
  background-color: #E5E5E5;
  color: #666666;
  border: 1px solid #CCCCCC;
  cursor: not-allowed;
  opacity: 0.6;
  pointer-events: none; /* Prevents all click events */
}

.pet-detail__preview-btn[disabled]::after {
  content: '...';
  animation: ellipsis 1.5s infinite;
}

@keyframes ellipsis {
  0% { content: ''; }
  33% { content: '.'; }
  66% { content: '..'; }
  100% { content: '...'; }
}
```

### State 3: Upload Complete, No Pet Name
**Appearance:**
- Preview button: **VISIBLE + DISABLED**
- Button text: "Enter Pet Name First"
- Button style: Same disabled style as State 2
- Upload zone: Shows "CHANGE IMAGE?" (line 1749)

**Rationale:** Dual gating prevents users from proceeding without required data. Preview needs both image AND name.

### State 4: Upload Complete + Pet Name Entered
**Appearance:**
- Preview button: **VISIBLE + ENABLED + EMPHASIZED**
- Button text: "Preview" (original)
- Button style:
  - Background: Brand primary color (likely green/blue - check theme)
  - Text: White
  - Border: None or subtle shadow
  - Cursor: `pointer`
  - Slight hover effect (scale 1.02 or brightness)
  - **Pulse animation** on first unlock (1-2 pulses to draw attention)

**Mobile-Specific:**
- Subtle haptic feedback on unlock (if browser supports)
- Larger touch target (48x48px minimum)
- High contrast for outdoor visibility

**Implementation:**
```css
.pet-detail__preview-btn:not([disabled]) {
  background-color: var(--brand-primary, #2E7D32);
  color: white;
  border: none;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.2s ease;
}

.pet-detail__preview-btn:not([disabled]):hover {
  transform: scale(1.02);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.pet-detail__preview-btn.just-unlocked {
  animation: pulse 0.6s ease-in-out 2;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

### State 5: Upload Failed (Error State)
**Appearance:**
- Preview button: **VISIBLE + DISABLED**
- Button text: "Upload Failed - Retry"
- Button style: Disabled with warning color
  - Background: Light red (#FFEBEE)
  - Text: Dark red (#C62828)
  - Border: 1px solid #EF5350
- Upload zone: Shows error message (see Error Handling section)
- Inline error text: "Image upload failed. Please try again."

**Rationale:** Clear error communication prevents user confusion. Suggests action (retry) without blaming user.

---

## 3. USER FEEDBACK MESSAGING

### Upload Progress Messages

**On File Selection:**
```
"Uploading..." (line 1726 - already implemented)
```

**During Upload (2-5 seconds in):**
```
"Uploading... (This may take a few seconds)"
```
*(Only show if upload exceeds 3 seconds - prevents message for fast uploads)*

**On Upload Success:**
```
uploadText: "CHANGE IMAGE?" (line 1749 - already implemented)
Button unlocks (if name entered) or shows "Enter Pet Name First"
```

**On Upload Failure:**
```
uploadText: "Upload Failed - Tap to Retry"
Button text: "Upload Failed - Retry"
Inline error below button: "⚠️ Image upload failed. Check your connection and try again."
```

### Name Validation Messages

**If User Clicks Disabled Button (No Name):**
*(Triggered by click attempt, not automatic)*
```
Brief tooltip/toast: "Enter your pet's name first"
Focus shifts to name input field
Name field gains subtle red border for 1 second
```

**Mobile Implementation:**
- Toast appears at bottom of screen (thumb zone)
- Auto-dismisses after 3 seconds
- Non-blocking (doesn't require user action)

---

## 4. MOBILE-SPECIFIC CONSIDERATIONS

### Touch Target Optimization
- **Minimum size**: 48x48px (Apple HIG), current is likely 44x44px
- **Spacing**: 8px clearance from other interactive elements
- **Hit area**: Extend beyond visual button by 4px on all sides

### Thumb Zone Placement
- Preview button already positioned below upload zone (lines 119-129)
- Good placement: Within natural thumb reach on mobile
- No changes needed to position

### Visual Feedback Enhancements
- **Disabled state**: Very obvious (opacity 0.6 + gray color)
- **Loading animation**: Animated dots instead of spinner (works better on slow networks)
- **Success pulse**: Brief animation when button unlocks (draws attention)

### Performance Considerations
- **Optimistic UI**: Show "Uploading..." immediately on file select (line 1726 - already implemented)
- **Progressive enhancement**: Button state updates without full page reload
- **Offline handling**: Fallback to base64 if GCS upload fails (lines 1754-1772 - already implemented)

### Network Awareness
**Fast Connection (< 2 seconds):**
- Upload completes quickly
- Brief "Uploading..." flash
- Button unlocks smoothly

**Slow Connection (2-10 seconds):**
- Show extended message: "Uploading... (This may take a few seconds)"
- Keep user informed
- Prevent abandonment

**No Connection:**
- Detect failure quickly (current retry logic: lines 1632-1639)
- Fall back to base64 storage (lines 1754-1772)
- Show "Offline Mode" in upload text (line 1767)
- Preview button still works (uses base64)

---

## 5. ERROR HANDLING APPROACH

### Upload Failure Scenarios

#### Scenario A: Network Timeout (GCS Upload Fails)
**Current Behavior:**
- 3 retry attempts with exponential backoff (lines 1632-1639)
- Falls back to base64 localStorage storage (lines 1754-1772)
- Shows "CHANGE IMAGE? (Offline)" text (line 1767)

**Proposed Enhancement:**
- Keep retry logic
- Add visual error state to button during retries
- Button text: "Retrying Upload..." (on retry 2 and 3)
- If all retries fail, show clear offline mode indicator
- Preview button remains functional (uses base64 fallback)

**Implementation:**
```javascript
// After line 1744, during upload
previewBtn.disabled = true;
previewBtn.textContent = 'Uploading...';
previewBtn.classList.add('uploading');

// On retry (line 1635)
if (retryCount > 0) {
  previewBtn.textContent = `Retrying Upload... (${retryCount}/3)`;
}

// On fallback success (line 1767)
previewBtn.disabled = false; // Enable since base64 available
previewBtn.textContent = 'Preview (Offline Mode)';
previewBtn.classList.remove('uploading');
previewBtn.classList.add('offline-mode');
uploadZone.classList.remove('uploading');
```

#### Scenario B: File Too Large (> 50MB)
**Current Behavior:**
- Alert shown (line 1707)
- File input cleared
- Upload zone resets

**Proposed Enhancement:**
- Keep alert (immediate feedback is good)
- Add inline error message below upload zone
- Suggest compression or alternative image
- Preview button remains hidden (no image to preview)

**Error Message:**
```
"⚠️ Image too large (max 50MB). Try a smaller photo or compress it first."
```

#### Scenario C: Invalid File Type
**Current Behavior:**
- Alert shown (line 1714)
- File input cleared

**Proposed Enhancement:**
- Keep alert
- Add inline message suggesting valid formats
- Show examples: "Try JPG, PNG, or HEIC files"

#### Scenario D: User Clicks Preview Before Upload Completes
**Current Behavior:**
- Not prevented (button likely visible/enabled)

**Proposed Behavior:**
- **PREVENTED** by disabled button state
- If user somehow bypasses (accessibility tool, console), show alert:
  ```
  "Please wait for image upload to complete..."
  ```
- Check upload state in click handler (lines 1951-1971)

**Implementation:**
```javascript
// Line 1951, add upload state check
previewBtn.addEventListener('click', (e) => {
  e.preventDefault();

  // CHECK 1: Is upload still in progress?
  if (uploadZone.classList.contains('uploading')) {
    alert('Please wait for image upload to complete...');
    return;
  }

  // CHECK 2: Does image exist? (existing logic - lines 1954-1971)
  const gcsUrl = localStorage.getItem(`pet_${i}_image_url`);
  const storedImages = localStorage.getItem(`pet_${i}_images`);

  if (!gcsUrl && (!storedImages || JSON.parse(storedImages).length === 0)) {
    alert('Please upload an image first');
    return;
  }

  // CHECK 3: Is pet name entered?
  const petName = getPetName(i);
  if (!petName || petName === `Pet ${i}`) {
    alert('Please enter your pet\'s name first');
    const nameInput = document.querySelector(`[data-pet-name-input="${i}"]`);
    if (nameInput) {
      nameInput.focus();
      nameInput.classList.add('validation-error');
      setTimeout(() => nameInput.classList.remove('validation-error'), 1000);
    }
    return;
  }

  // All checks passed - proceed with original logic
  // ... (existing code)
});
```

### Error Recovery Actions

**User Actions After Error:**
1. **Retry Upload**: Click upload zone again (currently triggers file input - line 1653)
2. **Use Different Image**: Select new file from device
3. **Proceed Offline**: If base64 fallback succeeded, preview button works
4. **Get Help**: Link to support/FAQ (optional, not critical)

**Automatic Recovery:**
- Retry attempts handled automatically (lines 1632-1639)
- No user action needed for transient network issues
- Offline mode fallback is seamless

---

## 6. TECHNICAL IMPLEMENTATION DETAILS

### File to Modify
`snippets/ks-product-pet-selector-stitch.liquid` (current line count: ~2800)

### Implementation Phases

#### Phase 1: Button State Management (Core Gating)
**Lines to modify:** Around 1646-1647, 1694-1781

**Changes:**
1. Add disabled attribute to preview button on page load:
   ```liquid
   <!-- Line 124 -->
   <button type="button"
           class="pet-detail__preview-btn"
           data-pet-preview-btn="{{ i }}"
           disabled>  <!-- ADD THIS -->
     Preview
   </button>
   ```

2. Add state management function:
   ```javascript
   // Add after line 1647
   function updatePreviewButtonState(petIndex) {
     const previewBtn = container.querySelector(`[data-pet-preview-btn="${petIndex}"]`);
     const uploadZone = container.querySelector(`[data-upload-zone="${petIndex}"]`);
     const nameInput = container.querySelector(`[data-pet-name-input="${petIndex}"]`);

     if (!previewBtn) return;

     // Check conditions
     const isUploading = uploadZone?.classList.contains('uploading');
     const hasImage = localStorage.getItem(`pet_${petIndex}_image_url`) ||
                      (localStorage.getItem(`pet_${petIndex}_images`) &&
                       JSON.parse(localStorage.getItem(`pet_${petIndex}_images`)).length > 0);
     const hasName = nameInput?.value.trim().length > 0;

     // State logic
     if (isUploading) {
       previewBtn.disabled = true;
       previewBtn.textContent = 'Uploading...';
       previewBtn.classList.add('uploading');
     } else if (!hasImage) {
       previewBtn.disabled = true;
       previewBtn.textContent = 'Upload Image First';
       previewBtn.classList.remove('uploading');
     } else if (!hasName) {
       previewBtn.disabled = true;
       previewBtn.textContent = 'Enter Pet Name First';
       previewBtn.classList.remove('uploading');
     } else {
       // All conditions met - enable button
       previewBtn.disabled = false;
       previewBtn.textContent = 'Preview';
       previewBtn.classList.remove('uploading');

       // Add unlock animation (once)
       if (!previewBtn.classList.contains('unlocked-once')) {
         previewBtn.classList.add('just-unlocked', 'unlocked-once');
         setTimeout(() => previewBtn.classList.remove('just-unlocked'), 1200);
       }
     }
   }
   ```

3. Call state update function at key moments:
   - On file selection (line 1694, in fileInput change handler)
   - During upload (line 1726, when adding 'uploading' class)
   - On upload success (line 1749, after GCS URL stored)
   - On upload failure fallback (line 1767, after offline mode set)
   - On name input change (need to add name input listener)

4. Add name input listener:
   ```javascript
   // Add after line 1647
   const nameInput = container.querySelector(`[data-pet-name-input="${i}"]`);
   if (nameInput) {
     nameInput.addEventListener('input', () => {
       updatePreviewButtonState(i);
     });
   }
   ```

#### Phase 2: Visual Styling (CSS)
**Lines to modify:** Around 955-1100 (styles section)

**Add CSS:**
```css
/* Preview Button States */
.pet-detail__preview-btn {
  /* Base styles (keep existing) */
  min-width: 120px;
  min-height: 44px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;

  /* Enabled state */
  background-color: var(--brand-primary, #2E7D32);
  color: white;
  border: none;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.pet-detail__preview-btn:not([disabled]):hover {
  transform: scale(1.02);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.pet-detail__preview-btn:not([disabled]):active {
  transform: scale(0.98);
}

/* Disabled state (uploading or incomplete data) */
.pet-detail__preview-btn[disabled] {
  background-color: #E5E5E5;
  color: #666666;
  border: 1px solid #CCCCCC;
  cursor: not-allowed;
  opacity: 0.6;
  pointer-events: none;
  box-shadow: none;
}

/* Uploading animation */
.pet-detail__preview-btn.uploading::after {
  content: '';
  animation: ellipsis 1.5s infinite;
}

@keyframes ellipsis {
  0% { content: ''; }
  33% { content: '.'; }
  66% { content: '..'; }
  100% { content: '...'; }
}

/* Unlock pulse animation */
.pet-detail__preview-btn.just-unlocked {
  animation: pulse 0.6s ease-in-out 2;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
  }
}

/* Offline mode indicator */
.pet-detail__preview-btn.offline-mode {
  background-color: #FF9800;
  color: white;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .pet-detail__preview-btn {
    min-height: 48px; /* Larger tap target */
    font-size: 18px;
    padding: 14px 28px;
  }
}
```

#### Phase 3: Error Handling Enhancement
**Lines to modify:** 1632-1639 (retry logic), 1951-1971 (preview click handler)

**Changes:**
1. Update retry logic to show retry count:
   ```javascript
   // Line 1632, modify retry section
   if (retryCount < maxRetries - 1) {
     // Update UI with retry count
     const previewBtn = container.querySelector(`[data-pet-preview-btn="${petIndex}"]`);
     if (previewBtn) {
       previewBtn.textContent = `Retrying Upload... (${retryCount + 1}/${maxRetries})`;
     }

     await new Promise(resolve => setTimeout(resolve, retryDelays[retryCount + 1]));
     return uploadToServer(file, petIndex, retryCount + 1);
   }
   ```

2. Add upload state check to preview click handler (shown in Scenario D above)

3. Add name validation with visual feedback (shown in Scenario D above)

#### Phase 4: Accessibility & Polish
**Additional enhancements:**

1. Add ARIA attributes to button:
   ```liquid
   <!-- Line 124 -->
   <button type="button"
           class="pet-detail__preview-btn"
           data-pet-preview-btn="{{ i }}"
           disabled
           aria-label="Preview pet image with effects"
           aria-describedby="preview-status-{{ i }}">
     Preview
   </button>

   <!-- Add status message for screen readers -->
   <span id="preview-status-{{ i }}" class="sr-only" aria-live="polite"></span>
   ```

2. Update status message for screen readers:
   ```javascript
   // In updatePreviewButtonState function
   const statusText = document.getElementById(`preview-status-${petIndex}`);
   if (statusText) {
     if (isUploading) {
       statusText.textContent = 'Image is uploading, please wait...';
     } else if (!hasImage) {
       statusText.textContent = 'Please upload an image first';
     } else if (!hasName) {
       statusText.textContent = 'Please enter pet name to continue';
     } else {
       statusText.textContent = 'Ready to preview';
     }
   }
   ```

3. Add focus management for better keyboard navigation:
   ```javascript
   // When name is missing and user tries to click
   if (!hasName) {
     const nameInput = document.querySelector(`[data-pet-name-input="${petIndex}"]`);
     if (nameInput) {
       nameInput.focus();
       nameInput.setAttribute('aria-invalid', 'true');
       setTimeout(() => nameInput.removeAttribute('aria-invalid'), 3000);
     }
   }
   ```

---

## 7. TESTING CHECKLIST

### Desktop Testing
- [ ] Upload image - button disabled during upload
- [ ] Upload completes - button still disabled (no name)
- [ ] Enter name - button enables with pulse animation
- [ ] Clear name - button disables again
- [ ] Upload fails - button shows retry message
- [ ] Offline mode - button works with "(Offline)" indicator
- [ ] Click disabled button - no action occurs
- [ ] Keyboard navigation - can tab to button, see focus state
- [ ] Screen reader - announces button state changes

### Mobile Testing (Critical - 70% of traffic)
- [ ] Upload on 4G - smooth transition to enabled state
- [ ] Upload on slow 3G - "This may take a few seconds" message appears
- [ ] Upload on no connection - falls back to offline mode
- [ ] Tap disabled button - no action, no frustration
- [ ] Large images (10MB+) - upload time accurately reflected
- [ ] Portrait orientation - button placement comfortable for thumb
- [ ] Landscape orientation - button still accessible
- [ ] iOS Safari - animations work, no glitches
- [ ] Android Chrome - animations work, no glitches
- [ ] Name input on mobile keyboard - button state updates live

### Edge Cases
- [ ] Multiple pets - each button state independent
- [ ] Switch between pets - state preserved correctly
- [ ] Page refresh during upload - state recovers gracefully
- [ ] Browser back/forward - button state correct
- [ ] localStorage full - fallback behavior works
- [ ] GCS bucket unreachable - offline mode activates
- [ ] Very fast upload (< 1 second) - no flashing disabled state
- [ ] Very slow upload (> 20 seconds) - user not confused/abandoned

### Conversion Impact Testing (A/B Test Recommendation)
**Hypothesis:** Gating preview button until upload completes will reduce customer frustration and improve conversion.

**Metrics to Track:**
- Preview button click rate (should stay same or increase slightly)
- Time from upload to preview click (should decrease - less confusion)
- Cart abandonment after preview (should decrease)
- Support tickets about "preview not working" (should decrease)
- Overall conversion rate (should increase 1-3%)

**Test Setup:**
- **Control (A):** Current behavior (button always enabled if image exists)
- **Treatment (B):** New gated behavior (button disabled until upload + name)
- **Split:** 50/50
- **Duration:** 2 weeks or 1000 conversions per variant
- **Success Criteria:** Treatment shows 1%+ conversion lift with statistical significance

---

## 8. ESTIMATED IMPLEMENTATION TIME

**Phase 1 (Core Gating):** 3 hours
- State management function: 1.5 hours
- Event listeners and integration: 1 hour
- Initial testing: 0.5 hours

**Phase 2 (Visual Styling):** 2 hours
- CSS for all button states: 1 hour
- Animation refinement: 0.5 hours
- Mobile responsive testing: 0.5 hours

**Phase 3 (Error Handling):** 2 hours
- Retry UI updates: 0.5 hours
- Click handler validation: 1 hour
- Error message refinement: 0.5 hours

**Phase 4 (Accessibility):** 1.5 hours
- ARIA attributes: 0.5 hours
- Screen reader testing: 0.5 hours
- Focus management: 0.5 hours

**Testing & QA:** 2.5 hours
- Desktop browser testing: 0.5 hours
- Mobile device testing: 1 hour
- Edge case testing: 1 hour

**TOTAL:** 11 hours (1.5 developer days)

---

## 9. SUCCESS METRICS

### User Experience Metrics
- **Time to Preview:** Average time from upload start to preview click (target: < 15 seconds)
- **Button Click Errors:** Failed clicks on disabled button (target: < 1% of sessions)
- **Upload Abandonment:** Users who upload but never click preview (target: < 5%)
- **Name Entry Rate:** Users who enter name after uploading (target: > 95%)

### Business Metrics
- **Conversion Rate:** Overall product page → cart (target: +1-3% lift)
- **Cart Abandonment:** After preview interaction (target: -2% reduction)
- **Support Tickets:** "Preview not working" issues (target: -50% reduction)
- **Revenue Impact:** Estimated +$1,500-$4,500/month at current volume

### Technical Metrics
- **Upload Success Rate:** GCS uploads that complete (target: > 95%)
- **Fallback Rate:** Offline mode usage (target: < 5%)
- **State Consistency:** Button state matches upload state (target: 100%)
- **Performance:** No additional page load impact (target: 0ms added)

---

## 10. ROLLBACK PLAN

**If implementation causes issues:**

1. **Immediate Rollback (< 5 minutes):**
   - Revert commit via git
   - Push to main branch
   - GitHub auto-deploys within 1-2 minutes

2. **Partial Rollback (Keep some features):**
   - Disable button state gating
   - Keep visual styling improvements
   - Keep error handling enhancements

3. **A/B Test Continuation:**
   - If metrics show neutral/negative impact
   - Roll back to 100% control
   - Analyze data to identify issues
   - Iterate on design

**Rollback Triggers:**
- Conversion rate drops > 2%
- Support tickets increase > 20%
- Critical bugs reported by > 5 users
- Mobile functionality breaks

---

## 11. FUTURE ENHANCEMENTS (Post-Launch)

**Not included in initial implementation but worth considering:**

1. **Upload Progress Bar:**
   - Show % complete during upload
   - More accurate feedback than "Uploading..."
   - Requires server-side progress updates (complex)

2. **Haptic Feedback (Mobile):**
   - Vibrate on button unlock
   - Requires Vibration API (limited support)
   - Nice-to-have, not critical

3. **Smart Retry Suggestions:**
   - "Try a smaller image" if upload fails
   - "Switch to Wi-Fi" if on cellular
   - Requires network detection

4. **Preview Thumbnail:**
   - Show small thumbnail on button when ready
   - Visual confirmation of uploaded image
   - Adds complexity to button design

5. **Multi-Pet Upload Indicator:**
   - "2 of 3 pets ready to preview"
   - Encourages completing all pets
   - More relevant after multi-pet optimization

---

## 12. IMPLEMENTATION DEPENDENCIES

**Required Files:**
- `snippets/ks-product-pet-selector-stitch.liquid` (modify)

**Dependencies (already present):**
- Upload zone with `data-upload-zone` attribute (line 1644)
- Upload text with `data-upload-text` attribute (line 1645)
- File input with `data-pet-file-input` attribute (line 1646)
- Preview button with `data-pet-preview-btn` attribute (line 1647)
- Name input with `data-pet-name-input` attribute (need to verify)
- localStorage for state persistence (already used extensively)
- GCS upload function `uploadToServer()` (lines 1592-1641)

**No External Dependencies:**
- No new libraries needed
- No API changes required
- No Shopify app installations
- Pure HTML/CSS/JS implementation

---

## 13. DOCUMENTATION UPDATES NEEDED

**After Implementation:**

1. Update `.claude/tasks/context_session_001.md`:
   - Log preview button gating implementation
   - Include commit reference
   - Note conversion impact (once measured)

2. Create test documentation:
   - Add new test case to testing strategy
   - Document button state transitions
   - Include mobile testing checklist

3. Update CLAUDE.md (if relevant):
   - Add note about preview button gating logic
   - Document state management function
   - Include rollback instructions

---

## FINAL RECOMMENDATION

**Implement Option D+ (Multi-Layer Gating with Progressive Disclosure)**

**Rationale:**
1. **Prevents user frustration** - Can't click unready button
2. **Clear visual feedback** - User always knows why button is disabled
3. **Mobile-optimized** - Works well on 70% of traffic
4. **Technically feasible** - Uses existing infrastructure
5. **Low risk** - Easy to test and rollback
6. **High impact** - Estimated 1-3% conversion lift = $1,500-$4,500/month

**Next Steps:**
1. User approves this plan
2. Begin Phase 1 implementation (3 hours)
3. Deploy to test environment via Playwright MCP
4. Test on mobile devices (iOS/Android)
5. Deploy to production (auto-deploy on commit)
6. Monitor metrics for 2 weeks
7. Iterate based on data

---

**Questions/Clarifications Needed:**
- Current brand primary color for enabled button? (Check theme settings)
- Existing name input selector? (Need to find `data-pet-name-input` usage)
- A/B testing capability? (Can we split traffic for testing?)
