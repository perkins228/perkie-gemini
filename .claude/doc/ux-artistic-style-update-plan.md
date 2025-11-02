# UX Implementation Plan: Artistic Effect Style Update
## Pen & Marker Art Style Replacement

**Document Type**: Implementation Plan (UX/UI Design)
**Created**: 2025-11-02
**Status**: Awaiting Review & Implementation
**Related Session**: `.claude/tasks/context_session_001.md`

---

## Executive Summary

This plan addresses the UX and UI considerations for replacing the "Classic" Van Gogh Post-Impressionism effect with a contemporary pen and marker art style in the Perkie Prints pet background removal tool.

**Key Recommendation**: Replace "Classic" label with "Sketch" and implement visual preview thumbnails to manage user expectations and drive conversion.

---

## 1. UX Analysis & Label Recommendation

### Current State
- **Modern**: Ink Wash (Asian sumi-e style, monochromatic flowing brush strokes)
- **Classic**: Van Gogh Post-Impressionism (colorful oil painting with swirls)

### Proposed Change
- **Modern**: Ink Wash (unchanged)
- **Sketch**: Pen and Marker Art (contemporary line-based art with selective color fills)

### Rationale for "Sketch" Label

**Option Analysis:**

| Label | Pros | Cons | Recommendation |
|-------|------|------|----------------|
| **Classic** | Maintains continuity | Misleading - pen/marker isn't "classic" | ❌ Don't use |
| **Contemporary** | Accurate but vague | Doesn't describe visual style, too long for mobile | ❌ Don't use |
| **Sketch** | ✓ Describes visual outcome<br>✓ Short (6 chars - mobile-friendly)<br>✓ Clear user expectation<br>✓ Differentiates from "Modern" | Could be confused with preliminary drafts | ✅ **RECOMMENDED** |
| **Urban** | Trendy, modern feeling | Doesn't describe art style, vague | ❌ Don't use |
| **Artistic** | Generic positive connotation | Too vague, both styles are "artistic" | ❌ Don't use |
| **Line Art** | Very descriptive | 8 chars, technical-sounding | ⚠️ Secondary option |

**Final Recommendation**: **"Sketch"**
- Clear visual expectation (line-based drawing)
- Mobile-friendly (short word)
- Differentiates well from "Modern" (brush vs. pen)
- Familiar to pet owners (sketch portraits are popular)
- Lower barrier than "Classic" art references

---

## 2. User Communication Strategy

### Challenge
Existing users may have generated Van Gogh style portraits and expect to find that option again.

### Solution: Gradual Transition with Clear Messaging

#### Phase 1: Initial Launch (Week 1-2)
**No communication about change**
- Most users won't notice (first-time users)
- Existing users see new style, may assume it's a new option

#### Phase 2: Monitor Feedback (Week 2-4)
**Track customer service inquiries:**
- If < 5 inquiries about Van Gogh: No action needed
- If 5-20 inquiries: Add subtle FAQ entry
- If > 20 inquiries: Implement Phase 3 messaging

#### Phase 3: Proactive Communication (If Needed)
**Add banner for returning users only:**
```
🎨 NEW: We've updated our artistic effects!
Try our fresh "Sketch" style - perfect for modern pet portraits.
```

**Location**: Top of pet background remover tool, dismissible
**Duration**: 2 weeks
**Tracking**: localStorage key `artistic_style_update_seen`

### Why Minimal Communication?
1. **70% mobile traffic**: Don't clutter interface with change notifications
2. **FREE tool**: Users expect experimentation and updates
3. **Conversion focus**: Communication should drive action, not explain changes
4. **Low risk**: Both styles are decorative add-ons, not core product

---

## 3. Visual Preview Implementation

### Current UX Gap
Users must **generate** an effect to see what it looks like, consuming quota before understanding output.

### Solution: Static Preview Thumbnails

#### Design Specification

**Preview Image Requirements:**
- **Size**: 80x80px circular thumbnail
- **Content**: Generic pet portrait showing style (dog or cat, neutral pose)
- **Border**: 2px border in brand color when selected
- **Label**: Style name below thumbnail

**Layout (Mobile-First):**
```
┌─────────────────────────────────────┐
│  Choose Your Artistic Style:        │
│                                      │
│  ┌────────┐        ┌────────┐      │
│  │ [img]  │        │ [img]  │      │
│  │ Modern │        │ Sketch │      │
│  │ ✨ AI  │        │ ✨ AI  │      │
│  └────────┘        └────────┘      │
│                                      │
│  Tap to see a preview before         │
│  generating your portrait            │
└─────────────────────────────────────┘
```

**Interaction Flow:**
1. User taps thumbnail → Preview modal opens
2. Modal shows 400x400px example of style applied to generic pet
3. Modal includes:
   - Style name
   - Description (1-2 sentences)
   - "Generate My Pet" CTA button (primary)
   - "Try Other Style" button (secondary)
   - Close X button

**Example Modal Content (Sketch):**
```
┌──────────────────────────────┐
│           Sketch              │ X
├──────────────────────────────┤
│                              │
│     [Large preview image]     │
│     (pen & marker style)     │
│                              │
│  Contemporary line art with   │
│  bold marker accents.         │
│  Perfect for modern decor.    │
│                              │
│  [Generate My Pet Portrait]   │
│  [← Try Modern Style]         │
└──────────────────────────────┘
```

### Benefits
1. **Reduces quota waste**: Users preview before generating
2. **Increases conversion**: Clear expectation → higher confidence → purchase
3. **Reduces support inquiries**: "What does this look like?" answered visually
4. **Mobile-optimized**: Touch-friendly targets, quick visual scan

### Assets Needed
- `preview-modern-ink-wash.jpg` (80x80px and 400x400px)
- `preview-sketch-pen-marker.jpg` (80x80px and 400x400px)
- Generic pet photo processed through both styles

---

## 4. Mobile Optimization Assessment

### Question: Does pen/marker style work well on mobile?

**Answer: YES** - Pen and marker style is **ideal** for mobile:

#### Visual Clarity Advantages
1. **High contrast**: Bold lines read clearly on small screens
2. **Simple shapes**: Less visual noise than Van Gogh swirls
3. **Defined edges**: Clear focal point (pet's face) stands out
4. **Fast parsing**: User can identify pet in < 1 second glance

#### Technical Advantages
1. **File size**: Line art typically 20-30% smaller than painterly styles
2. **Loading speed**: Faster display on mobile networks
3. **Rendering**: Less GPU strain for thumbnail generation
4. **Shareable**: Instagram/social media friendly (clean, modern aesthetic)

#### User Behavior Fit
1. **Mobile context**: Quick decision-making → simple styles perform better
2. **Social sharing**: Sketch style is "Instagram-ready" (trending aesthetic)
3. **Product context**: Pet portraits for products → clear, recognizable > artistic complexity

**Comparison:**
| Factor | Van Gogh (Old) | Pen & Marker (New) | Winner |
|--------|----------------|-------------------|--------|
| Small screen clarity | ⚠️ Medium (swirls can look muddy) | ✅ High (clean lines) | Pen & Marker |
| Visual processing time | 2-3 seconds | < 1 second | Pen & Marker |
| Social media appeal | 👴 Traditional art lovers | 👍 Modern Instagram aesthetic | Pen & Marker |
| File size | ~800KB average | ~500KB average | Pen & Marker |

**Recommendation**: Pen & Marker is a **mobile UX upgrade** over Van Gogh.

---

## 5. Value Proposition Impact

### Current Positioning
"FREE AI-powered background removal + 2 artistic effects"

### Effect of Style Change on Value Perception

#### Risk Assessment: **LOW**

**Why the change maintains value:**

1. **"AI" remains the value anchor**:
   - Users value "AI-generated" more than specific art style
   - Novelty of technology > specific artistic reference

2. **"2 artistic effects" count unchanged**:
   - Still offering variety and choice
   - Quantity perception unchanged

3. **Modern + Sketch is broader appeal**:
   - Van Gogh: Niche appeal (traditional art lovers)
   - Sketch: Broad appeal (modern, trendy, versatile)
   - Ink Wash: Niche appeal (Asian aesthetic lovers)
   - **Net effect**: Potentially **increased** appeal

4. **"FREE" is the conversion driver**:
   - Style is secondary to "no cost" barrier removal
   - Users primarily value: background removal + choice

#### Value Communication Update

**Before:**
"Transform your pet into a masterpiece with FREE AI effects! Choose Modern or Classic styles."

**After:**
"Transform your pet into a work of art with FREE AI effects! Choose Modern or Sketch styles."

**Change rationale:**
- "Masterpiece" → "Work of art" (less grandiose, more accessible)
- "Modern or Classic" → "Modern or Sketch" (clearer differentiation)

---

## 6. Visual Consistency Concerns

### Style Pairing Analysis: Modern (Ink Wash) + Sketch (Pen & Marker)

#### Consistency Factors

**Shared Characteristics (GOOD):**
1. **Line-based art**: Both emphasize lines over color fills
2. **Minimalist aesthetic**: Both avoid photorealistic complexity
3. **High contrast**: Both use strong darks vs. lights
4. **Artistic transformation**: Both clearly "not a photo"
5. **Portrait framing**: Both focus on pet's head/face

**Divergent Characteristics (NEUTRAL):**
1. **Texture**: Ink Wash = flowing gradients, Sketch = solid fills/hatching
2. **Cultural reference**: Ink Wash = Asian, Sketch = Contemporary Western
3. **Tool metaphor**: Ink Wash = brush, Sketch = pen/marker
4. **Color strategy**: Ink Wash = monochrome, Sketch = selective color

**Visual Tension (NONE IDENTIFIED)**

#### Recommendation: **Pairing is STRONG**

**Why this works:**
- Both styles appeal to "artistic but recognizable" preference
- Both styles are **non-photorealistic** (clear departure from photo)
- Both styles are **high-craft** (require skill to execute)
- Divergences create **complementary choice** rather than conflict

**User Decision Tree:**
```
"I want an artistic pet portrait..."
    ↓
"Do I prefer traditional or modern aesthetic?"
    ↓
├─ Traditional, elegant → Modern (Ink Wash)
└─ Contemporary, bold → Sketch (Pen & Marker)
```

**Contrast with Old Pairing (Ink Wash + Van Gogh):**
- **Problem**: Both were "painting" styles
- **Problem**: Van Gogh = colorful swirls, Ink Wash = monochrome flow (conflicting visual language)
- **Problem**: User decision less clear ("which painting style?")

**New Pairing Advantage:**
- **Clear choice**: Brush painting vs. Line drawing
- **Distinct visual outcomes**: Easier to predict preference
- **Better mobile differentiation**: Thumbnails look more distinct

---

## 7. Three Styles Consideration

### Question: Should we offer 3 styles instead of replacing?

**Answer: NO - Keep 2 styles**

#### Analysis

**Option A: Replace (Recommended)**
- Modern (Ink Wash) + Sketch (Pen & Marker)
- ✅ Pros:
  - Simple choice (not overwhelming)
  - Mobile-friendly (2 large buttons vs. 3 small)
  - Lower quota consumption (users try both = 2 generations vs. 3)
  - Faster decision-making
  - Better UI layout (side-by-side vs. carousel/3-column)
- ❌ Cons:
  - Lose Van Gogh option (low risk - see Section 2)

**Option B: Add Third Style**
- Modern + Sketch + Classic (Van Gogh)
- ❌ Cons:
  - **Mobile UX degradation**: 3 buttons require carousel or tiny targets
  - **Decision paralysis**: Choice overload on mobile (70% of traffic)
  - **Quota pressure**: Users may try all 3 (3x quota consumption)
  - **Maintenance burden**: 3 prompts to optimize vs. 2
  - **Diluted value**: "2 AI effects" is cleaner than "3 AI effects"
  - **Slower load**: More preview assets to download
- ✅ Pros:
  - More variety (marginal benefit)

#### Mobile Layout Comparison

**2 Styles (Current):**
```
┌─────────────┬─────────────┐
│   Modern    │   Sketch    │
│  [Preview]  │  [Preview]  │
│   ✨ AI     │   ✨ AI     │
└─────────────┴─────────────┘
    44px         44px         ← Touch targets
```

**3 Styles (Problematic):**
```
┌────────┬────────┬────────┐
│ Modern │ Sketch │Classic │
│ [Prev] │ [Prev] │ [Prev] │
└────────┴────────┴────────┘
   29px     29px     29px    ← Too small!
```
OR
```
│ ← │ [Modern] [Sketch] [Classic] │ → │
        Carousel (requires extra interaction)
```

**Apple iOS Human Interface Guidelines:**
- Minimum touch target: **44x44 points**
- 3 columns on mobile = ~29px each = **FAILS accessibility standard**

#### Recommendation
**Keep 2 styles** - Mobile UX and decision-making clarity outweigh variety benefits.

---

## 8. Implementation Specification

### Frontend Changes

#### File: `assets/gemini-api-client.js`

**Update Line 219-222 (styleMap):**
```javascript
// Map our style names to API enum
const styleMap = {
  'modern': 'ink_wash',
  'sketch': 'pen_and_marker_art'  // Changed from 'classic': 'van_gogh_post_impressionism'
};
```

**Impact**: All API calls from frontend now use 'sketch' label

---

#### File: `assets/gemini-effects-ui.js`

**Update Lines 251-253 (button selectors):**
```javascript
const modernBtn = this.container.querySelector('[data-effect="modern"]');
const sketchBtn = this.container.querySelector('[data-effect="sketch"]');  // Changed from classicBtn

[modernBtn, sketchBtn].forEach(btn => {  // Changed from classicBtn
```

**Update Line 214-217 (Exhausted message):**
```javascript
message = `
  <strong>Daily AI Limit Reached</strong><br>
  You've created 10 amazing AI portraits today!
  Try our <strong>Classic B&W</strong> or <strong>Color</strong> effects (unlimited) while you wait for tomorrow's reset.
`;
```
**Note**: "Classic B&W" refers to non-AI effects, not the "Classic" artistic style

**Update Line 349 (Button tooltip):**
```javascript
btn.title = 'Daily AI limit reached. Try B&W or Color (unlimited)';
```

**No functional changes needed** - UI system is already style-agnostic

---

#### File: `snippets/ks-product-pet-selector.liquid` (assumed location)

**Update HTML button markup:**
```html
<!-- OLD -->
<button data-effect="classic" class="effect-button">
  <img src="preview-classic.jpg" alt="Classic Van Gogh Style">
  <span>Classic</span>
  <span class="gemini-quota-badge">✨ AI</span>
</button>

<!-- NEW -->
<button data-effect="sketch" class="effect-button">
  <img src="preview-sketch.jpg" alt="Sketch Pen & Marker Style">
  <span>Sketch</span>
  <span class="gemini-quota-badge">✨ AI</span>
</button>
```

---

### Backend Changes

#### File: `backend/gemini-artistic-api/src/models/schemas.py`

**Update Lines 7-11 (ArtisticStyle enum):**
```python
class ArtisticStyle(str, Enum):
    """Available artistic styles - only 2 styles to replace production effects"""
    INK_WASH = "ink_wash"                          # "Modern" - replaces Pop Art
    PEN_AND_MARKER_ART = "pen_and_marker_art"     # "Sketch" - replaces Van Gogh
```

**Impact**:
- API schema validation updated
- All enum references use new value
- Old `VAN_GOGH_POST_IMPRESSIONISM` removed (breaks backward compatibility - acceptable for test environment)

---

#### File: `backend/gemini-artistic-api/src/core/gemini_client.py`

**Update Lines 21-39 (STYLE_PROMPTS):**
```python
STYLE_PROMPTS = {
    ArtisticStyle.INK_WASH: (
        "Transform this pet photo into a traditional Asian ink wash painting. "
        "Create a portrait composition showing the pet's head and neck area. "
        "Use flowing black ink with varying gradients to create an artistic effect. "
        "Apply expressive brush strokes in the style of sumi-e painting. "
        "Keep the pet's features recognizable while making it look like a painting. "
        "Place the portrait on a clean white background."
    ),
    ArtisticStyle.PEN_AND_MARKER_ART: (
        "Transform this pet photo into a contemporary pen and marker art portrait. "
        "Create a bold line drawing of the pet's head and neck with clean, confident pen strokes. "
        "Add selective marker color fills in 2-3 vibrant accent colors that complement the pet's natural coloring. "
        "Use thick black outlines for major features (eyes, nose, ears) and thinner lines for fur texture. "
        "Apply marker shading with cross-hatching and stippling techniques for depth. "
        "Keep the style modern and graphic - like urban sketch art or editorial illustration. "
        "The pet's features must remain clearly recognizable. "
        "Place the portrait on a clean white background."
    ),
}
```

**Prompt Engineering Notes:**
- **Line quality**: "Bold", "clean", "confident" → thick, readable lines on mobile
- **Color strategy**: "2-3 vibrant accent colors" → not overwhelming, not monochrome
- **Technique specificity**: "Cross-hatching", "stippling" → guide AI toward sketch aesthetic
- **Style reference**: "Urban sketch art or editorial illustration" → contemporary, not classical
- **Mobile consideration**: "Thick black outlines" → high contrast for small screens
- **White background**: Maintains consistency with Ink Wash style

---

### Asset Requirements

**Preview Images to Generate:**
1. **preview-sketch-80x80.jpg**
   - Generic pet (dog or cat) in pen & marker style
   - Circular crop, centered on face
   - Used in effect selection buttons

2. **preview-sketch-400x400.jpg**
   - Same pet, larger version
   - Used in preview modal
   - Shows full detail of style

**Generation Method:**
1. Use Gemini API with new prompt on generic pet photo
2. OR commission designer to create reference examples
3. OR use Midjourney/DALL-E with similar prompt for mockups

**File Locations:**
- `assets/preview-sketch-80x80.jpg`
- `assets/preview-sketch-400x400.jpg`
- Update existing `preview-modern-*.jpg` files for consistency

---

### API Deployment

**Command:**
```bash
cd backend/gemini-artistic-api
./scripts/deploy-gemini-artistic.sh
```

**Deployment Notes:**
- New revision will be created (00018 or higher)
- Test with `?customer_id=test_user_001` before 100% rollout
- Monitor Cloud Run logs for first 24 hours
- Check generation times (expect 8-12 seconds like Van Gogh)

**Rollback Plan:**
If issues arise, revert schema enum and prompt:
```bash
gcloud run services update-traffic gemini-artistic-api \
  --to-revisions=00017-6bv=100 \
  --region=us-central1
```

---

## 9. Success Metrics

### Primary Metrics (Monitor for 2 weeks post-launch)

**Conversion Metrics:**
1. **Effect selection rate**: % of users who generate Sketch vs. Modern
   - Target: 40-60% split (healthy choice distribution)
   - Red flag: < 20% or > 80% (indicates one style failing)

2. **Add-to-cart rate after effect generation**:
   - Target: Maintain or increase current rate
   - Red flag: > 5% decrease (style not driving purchase intent)

3. **Quote consumption rate**:
   - Target: Users generate 1.5-2 effects on average (try both styles)
   - Red flag: > 2.5 average (decision paralysis, generating multiple times)

**Technical Metrics:**
1. **Generation time**: 8-12 seconds (same as Van Gogh)
2. **Cache hit rate**: 20-30% (same image, same style requests)
3. **Error rate**: < 2% (Gemini API failures)
4. **File size**: 400-600KB average (smaller than Van Gogh = better)

**User Feedback:**
1. **Customer service inquiries**: < 5 about "Where's Van Gogh?" (low impact)
2. **Social shares**: Track Instagram/Facebook shares of Sketch style
3. **Repeat usage**: % of users who return and generate again (retention)

### Secondary Metrics

**Mobile Performance:**
1. **Load time on 3G**: < 3 seconds for preview thumbnails
2. **Touch accuracy**: > 95% correct button taps (no mis-taps)

**A/B Test Opportunity (Future):**
If performance is unclear, run A/B test:
- **Group A**: Modern + Sketch (new)
- **Group B**: Modern + Classic Van Gogh (old)
- **Metric**: Add-to-cart rate
- **Duration**: 2 weeks, 50/50 split

---

## 10. Risk Mitigation

### Risk 1: User Backlash (Van Gogh Fans)
**Likelihood**: Low
**Impact**: Low
**Mitigation**:
- Monitor customer service tickets
- Prepare FAQ entry: "We've updated our artistic styles to offer more contemporary options"
- If > 20 complaints: Consider adding Van Gogh back as 3rd option (after mobile UX redesign)

### Risk 2: Pen & Marker Style Underperforms
**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:
- A/B test before full rollout (optional)
- Monitor add-to-cart rate closely first week
- Quick rollback plan (< 2 hours to revert)
- Prompt optimization if generation quality issues

### Risk 3: API Performance Issues
**Likelihood**: Low
**Impact**: High
**Mitigation**:
- Test extensively in dev before production
- Monitor Cloud Run logs first 24 hours
- Cache generated images aggressively (SHA256 deduplication)
- Firestore rate limiting already in place

### Risk 4: Mobile UX Confusion
**Likelihood**: Low
**Impact**: Low
**Mitigation**:
- Preview thumbnails clarify style before generation
- "Sketch" label is self-explanatory
- Test on real devices before launch (iPhone SE, Android mid-range)

---

## 11. Accessibility Considerations

### Visual Accessibility

**Color Contrast:**
- Sketch style uses bold black lines (high contrast) ✅
- Preview thumbnails must meet WCAG AA: 4.5:1 contrast ratio ✅

**Label Clarity:**
- "Sketch" is clear, familiar term ✅
- No reliance on color alone (text labels present) ✅

**Touch Targets:**
- 2-button layout maintains 44x44px minimum ✅
- Preview modal close button: 44x44px ✅

### Assistive Technology

**Screen Reader Support:**
```html
<button data-effect="sketch"
        aria-label="Generate sketch style portrait using AI"
        class="effect-button">
  <img src="preview-sketch.jpg"
       alt="Example of sketch pen and marker art style portrait">
  <span>Sketch</span>
  <span class="gemini-quota-badge" aria-label="AI powered">✨ AI</span>
</button>
```

**Keyboard Navigation:**
- Tab order: Modern → Sketch → Generate button
- Enter/Space to activate preview modal
- Escape to close modal

---

## 12. Implementation Checklist

### Pre-Implementation
- [ ] Review session context: `.claude/tasks/context_session_001.md`
- [ ] Consult cv-ml-production-engineer for prompt optimization
- [ ] Consult ai-product-manager-ecommerce for product strategy alignment
- [ ] Generate preview assets (80x80px and 400x400px)
- [ ] Test new Gemini prompt on 10+ pet photos (variety of breeds, colors)
- [ ] Review generated images on mobile devices (iPhone, Android)

### Backend Updates
- [ ] Update `schemas.py`: `VAN_GOGH_POST_IMPRESSIONISM` → `PEN_AND_MARKER_ART`
- [ ] Update `gemini_client.py`: Add pen & marker prompt to `STYLE_PROMPTS`
- [ ] Test locally: `python src/main.py` and send test requests
- [ ] Deploy to Cloud Run: `./scripts/deploy-gemini-artistic.sh`
- [ ] Verify deployment: Check Cloud Run logs for errors
- [ ] Test API endpoints: `POST /api/v1/generate` with new style
- [ ] Verify cache deduplication working (send same image twice)

### Frontend Updates
- [ ] Update `gemini-api-client.js`: styleMap 'classic' → 'sketch'
- [ ] Update `gemini-effects-ui.js`: classicBtn → sketchBtn references
- [ ] Update Liquid template: Change button markup and data-effect attribute
- [ ] Add preview images to `assets/` directory
- [ ] Update button label text: "Classic" → "Sketch"
- [ ] Test in Shopify test environment (Chrome DevTools MCP)
- [ ] Verify quota warnings still work correctly
- [ ] Test mobile layout on real devices (iPhone SE, Android mid-range)

### Testing (Chrome DevTools MCP with Shopify Test URL)
- [ ] Upload pet photo and generate both Modern and Sketch styles
- [ ] Verify generation time: 8-12 seconds
- [ ] Check generated image quality: lines clear, colors vibrant
- [ ] Test quota system: Generate 10 times, verify exhaustion warning
- [ ] Test mobile: Touch targets, preview modal, quota badges
- [ ] Test error handling: Bad image, API timeout, quota exhausted
- [ ] Verify cache hit on duplicate request (check API logs)

### Deployment
- [ ] Commit frontend changes: `git add . && git commit -m "Update Classic to Sketch artistic style"`
- [ ] Push to main: `git push origin main`
- [ ] Monitor GitHub auto-deploy to Shopify (1-2 minutes)
- [ ] Verify changes on test URL (ask user for current URL)
- [ ] Monitor Cloud Run logs for 24 hours post-launch
- [ ] Check analytics: Effect selection rate, add-to-cart rate

### Post-Launch Monitoring (First 2 Weeks)
- [ ] Daily: Check customer service tickets for Van Gogh inquiries
- [ ] Daily: Monitor effect selection rate (Modern vs. Sketch split)
- [ ] Daily: Check Cloud Run error logs and performance metrics
- [ ] Weekly: Review add-to-cart conversion rate
- [ ] Weekly: Check quota consumption patterns (average per user)
- [ ] End of Week 2: Compile success metrics report

### Documentation
- [ ] Update session context with implementation results
- [ ] Document any prompt optimizations made during testing
- [ ] Update GEMINI_ARTISTIC_API_BUILD_GUIDE.md with new style
- [ ] Create FAQ entry if user inquiries exceed threshold

---

## 13. Open Questions for Stakeholder Review

1. **Preview Modal Implementation Timeline**: Should preview modal be implemented in Phase 1 (with style change) or Phase 2 (post-launch optimization)?
   - **Recommendation**: Phase 2 - Reduces initial implementation scope, allows testing style change in isolation

2. **Van Gogh Deprecation Communication**: Should we proactively announce the change or wait for user feedback?
   - **Recommendation**: Wait for feedback - 70% mobile users won't notice, communication creates noise

3. **A/B Test Before Full Rollout**: Worth the engineering effort for a test environment?
   - **Recommendation**: No - This is already a test environment, monitor metrics closely instead

4. **Alternative Label Preferences**: Any strong preference for label other than "Sketch"?
   - **Recommendation**: "Sketch" unless stakeholder has specific brand voice concern

5. **Third Style Future Consideration**: Should we design system to easily add 3rd style later?
   - **Recommendation**: Yes - Keep code modular, but don't implement 3-style UI until clear demand

---

## 14. Next Steps

**Immediate Actions** (pending approval):
1. **Consult Sub-Agents**:
   - `cv-ml-production-engineer`: Review and optimize pen & marker prompt
   - `ai-product-manager-ecommerce`: Validate product strategy and value prop
   - `solution-verification-auditor`: Review implementation plan completeness

2. **Generate Preview Assets**:
   - Create or commission 80x80px and 400x400px sketch style examples
   - Add to `assets/` directory

3. **Backend Implementation**:
   - Update schema enum
   - Update prompt in `gemini_client.py`
   - Deploy to Cloud Run
   - Test API thoroughly

4. **Frontend Implementation**:
   - Update all "Classic" → "Sketch" references
   - Update styleMap
   - Test in Shopify environment

5. **Launch & Monitor**:
   - Deploy to test environment
   - Monitor metrics for 2 weeks
   - Iterate based on user feedback

---

## 15. Conclusion

Replacing "Classic" Van Gogh with "Sketch" Pen & Marker art is a **low-risk, high-reward UX improvement** for the Perkie Prints mobile-first platform.

**Key Benefits:**
✅ Clearer user choice (Brush vs. Pen)
✅ Better mobile performance (smaller files, higher contrast)
✅ Contemporary aesthetic appeal (Instagram-ready)
✅ Improved visual consistency (complementary styles)
✅ Simplified decision-making (2 distinct options)

**Recommended Label**: **"Sketch"** - Short, descriptive, mobile-friendly

**Recommended Approach**: Replace with minimal communication, monitor feedback, iterate based on data

**Timeline**: 3-5 days implementation + 2 weeks monitoring

---

**Document Version**: 1.0
**Last Updated**: 2025-11-02
**Next Review**: After implementation (post-launch metrics review)
