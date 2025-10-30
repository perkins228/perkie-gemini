# Crop & Zoom Feature - UX Design Research & Recommendations

**Document Type**: UX Design Research & Implementation Plan
**Created**: 2025-10-07
**Status**: Complete - Ready for Technical Implementation Planning
**Context File**: `.claude/tasks/context_session_crop_zoom_feature.md`

---

## Purpose

This document contains comprehensive UX design research and recommendations for adding an optional crop/zoom feature to the Perkie Prints pet image processor. The feature allows customers to fine-tune their pet photos after background removal and effect selection, improving product preview confidence and reducing cart abandonment.

---

## Research Summary

### Key Findings

1. **Mobile Gestures Are Expected**: 40% of e-commerce sites fail to support pinch-zoom, creating a competitive advantage opportunity
2. **Conversion Impact**: Image zoom increases conversions 9-10%, customization tools can lift conversion 30-40%
3. **Touch Targets**: WCAG 2.2 AA requires 44x44px minimum, 48x48px recommended for screen edges
4. **Optional Steps**: Use "Next" button (not "Skip") and auto-flow design to reduce friction
5. **Shape Preference**: Context-dependent - circular for avatars (56% prefer), square more versatile for products

### Recommended Approach

**Mobile-First Progressive Disclosure**:
- Auto-show crop interface after effect selection (no permission prompt)
- Pinch-to-zoom + double-tap + drag-to-pan gestures (all required)
- Circle/square toggle with smart defaults based on product type
- Real-time preview with DPI validation (warn, don't block)
- "Skip for now" link + "Next" button (consistent forward motion)

**Desktop Enhancement**:
- Side-by-side crop editor + live product preview
- Mouse interactions: drag to pan, scroll to zoom, handles to resize
- Keyboard shortcuts for power users (+/-, arrows, C, R, Enter, Esc)
- Larger controls, more screen real estate for preview

---

## Design Specifications

### Mobile Interface (375px - iPhone SE)

```
┌───────────────────────────────┐
│ Perfect Your Photo (Optional) [×] │ ← 56px header
│ Step 3 of 4 • 60% Complete        │ ← Progress indicator
├───────────────────────────────┤
│   ┌─────────────────────┐     │
│   │░░░░░░░░░░░░░░░░░░░░░│     │ ← Dimmed overlay
│   │░░┌───────────────┐░░│     │
│   │░░│  PET IMAGE    │░░│     │ ← Crop area
│   │░░└───────────────┘░░│     │
│   └─────────────────────┘     │
│  Pinch to zoom • Drag to move │ ← Hint (fades)
│  ┌──────────┐  ┌──────────┐  │
│  │● Circle  │  │  Square  │  │ ← 52px toggles
│  └──────────┘  └──────────┘  │
│  Zoom: [−] ──●─── [+]         │ ← Manual slider
│  Quality: ✓ Print-ready       │ ← DPI indicator
├───────────────────────────────┤
│         Skip for now          │ ← Link style
│  ┌───────────────────────┐   │
│  │       Next →          │   │ ← 56px CTA
│  └───────────────────────┘   │
└───────────────────────────────┘
```

**Touch Targets**:
- Crop handles: 52x52px (small screens), 44x44px (tablets)
- Shape toggles: 52x52px minimum
- Zoom buttons: 48x48px minimum
- Skip/Next: Full-width on mobile, 48px height

### Desktop Interface (1200px)

```
┌────────────────────────────────────────────────────────┐
│  Perfect Your Photo (Optional)         [× Close]       │
│  Step 3 of 4 • 60% Complete                            │
├──────────────────────────┬─────────────────────────────┤
│  CROP EDITOR             │  LIVE PREVIEW               │
│  ┌────────────────────┐  │  ┌───────────────────────┐ │
│  │  PET IMAGE         │  │  │  [Product Mockup]     │ │
│  │  (with crop box)   │  │  │  Your pet on product  │ │
│  └────────────────────┘  │  └───────────────────────┘ │
│  Zoom: [−] ──●─── [+]    │  ✓ Print Quality (300 DPI)│
│  Shape: (● Circle) (Square) │  💡 Double-click to    │
│  [↻ Reset]               │     auto-fit crop         │
├──────────────────────────┴─────────────────────────────┤
│  [← Back]  Skip for now              [Next →]         │
└────────────────────────────────────────────────────────┘
```

**Desktop Interactions**:
- Scroll wheel: Zoom in/out
- Click-drag inside crop: Pan image
- Click-drag handles: Resize crop box
- Double-click: Auto-fit to image bounds

---

## User Flow Integration

### Complete Journey

```
Upload → BG Removal → Effect Selection → Crop/Zoom (Optional) → Product Selection → Cart
```

**Funnel Placement Rationale**:
1. After effects = customer already invested time (higher commitment)
2. Before cart = last chance to perfect (reduces post-purchase regret)
3. Optional nature = low friction for satisfied customers
4. Progressive enhancement = feels like bonus, not required task

### Entry Point Design

**Recommendation**: Auto-flow (Scenario B)
- Effect selected → [2s delay] → Crop interface appears
- No interstitial prompt ("Want to adjust?") - reduces clicks
- Clear visual indicators: "(Optional)" label, prominent skip link
- Progress bar shows 60% complete (momentum maintained)

**Alternative** (Test in A/B): Interstitial prompt
- "Want to zoom in or adjust your photo before adding to products?"
- [No thanks] [Yes, perfect it →]
- Higher friction but more explicit choice

---

## Circle vs Square Crop Strategy

### Smart Default Logic

```javascript
if (productMetafield.preferredCropShape) {
  defaultShape = productMetafield.preferredCropShape;
} else if (productCategory === 'pet-tags' || 'ornaments') {
  defaultShape = 'circle'; // Round products
} else {
  defaultShape = 'square'; // Most versatile
}
```

### When to Show Shape Choice

- **Show**: Product accepts both shapes OR no preference set
- **Hide**: Product has strict shape requirement (e.g., circular tags only)
- **Behavior**: Confirmation before switching after crop applied (prevent accidental loss)

### Shape-Specific Behaviors

**Circle Crop**:
- Auto-center on pet face (use BG removal bounding box)
- Encourage tighter crop (pets fill circles better)
- Use case: Pet tags, ornaments, profile-style products

**Square Crop**:
- Preserve more context (background, full body)
- Better for landscape/action shots
- Use case: Blankets, canvas prints, photo products

---

## Accessibility (WCAG 2.2 AA Compliance)

### Keyboard Navigation

**Tab Order**: Close → Zoom Out → Slider → Zoom In → Circle → Square → Reset → Skip → Next

**Shortcuts** (Optional):
- `+/-`: Zoom in/out
- `Arrow keys`: Pan image
- `C`: Toggle circle/square
- `R`: Reset
- `Enter`: Next
- `Esc`: Skip/Close

### Screen Reader Support

**ARIA Labels Required**:
```html
<div role="region" aria-label="Image crop and zoom editor">
  <button aria-label="Close crop editor">×</button>
  <input type="range" aria-label="Zoom level"
         aria-valuemin="100" aria-valuemax="300"
         aria-valuenow="150" aria-valuetext="150% zoom">
  <button aria-label="Crop to circle shape" aria-pressed="true">
</div>
```

**Live Regions**:
- Announce zoom level changes
- Announce shape selection
- Announce DPI warnings
- Announce save success

### Touch Gesture Alternatives

- Zoom slider (always visible, not just fallback)
- +/- buttons for increment control
- Arrow buttons for panning (4-directional)
- Keyboard shortcuts for desktop

---

## Product Selector Integration

### Display Requirements

**Pet Thumbnail**:
```
┌─────────────────┐
│   [Pet Image]   │ ← Shows CROPPED version
├─────────────────┤
│ Fluffy ✓        │ ← Pet name + selected
│ [○] Zoomed      │ ← Crop indicator (subtle)
│ [Edit crop]     │ ← Re-open editor link
└─────────────────┘
```

**Metadata to Display**:
- Crop shape icon (circle/square outline)
- Zoom level: "Original size" or "Zoomed 1.5×"
- Edit action: "Edit crop" link

**Edit Crop Flow**:
1. Click "Edit crop" from pet selector
2. Crop interface reopens with previous settings restored
3. Crop box, zoom, shape all preserved
4. Customer adjusts, clicks "Save changes"
5. Returns to selector with updated image

---

## Conversion Optimization Strategies

### Reducing Abandonment

**Risk Factors**:
- Complexity (too many options)
- Time (slows funnel)
- Uncertainty (did I do it right?)
- Technical issues (gestures fail)

**Mitigation**:
1. **Default to "Good Enough"**: Auto-center on pet, show "Looks great! Adjust if desired"
2. **Quick Exit**: Skip link always visible, Next enabled immediately
3. **Performance**: Lazy-load interface, optimize gestures, show loading states
4. **Reassurance**: Progress indicator, value reminders, trust signals

### Social Proof Placement

**Where**: Below crop interface (mobile) or sidebar (desktop)
**When**: After customer interacts (not immediately)

```
⭐⭐⭐⭐⭐ "I love that I could zoom in on my dog's face!"
- Sarah M., Verified Buyer

✓ 10,000+ pets perfectly cropped this month
```

### A/B Testing Recommendations

1. **Auto-flow vs Opt-in**: Test automatic vs permission-based entry
2. **Shape Prominence**: Front-and-center vs "Advanced" dropdown
3. **Skip Copy**: "Skip for now" vs "No thanks" vs "Looks perfect →"
4. **DPI Warning**: Red/block vs Yellow/allow vs No warning

---

## Analytics & Success Metrics

### Critical Events to Track

1. `crop_zoom_step_entered` - Interface loaded
2. `crop_interaction_started` - First gesture/control use
3. `crop_shape_selected` - Circle or square chosen
4. `zoom_level_changed` - Zoom adjusted
5. `dpi_warning_shown` - Quality warning displayed
6. `crop_step_completed` - Next clicked (track engagement)
7. `crop_step_skipped` - Skip clicked
8. `crop_edited_from_selector` - Re-opened editor

### Success Metrics

**Primary KPIs**:
- Conversion rate lift: Target +5% minimum
- Engagement rate: Target 60% (40% skip acceptable)
- Abandonment rate: Target <2% at this step
- Time to convert: Target <3 min total (crop adds ~30-45s)

**Secondary KPIs**:
- Zoom adoption rate
- Circle vs square preference by product category
- Edit rate (return to crop from selector)
- DPI warning frequency
- Error/failure rate

---

## MVP Definition

### Included in MVP

1. ✅ Pinch-to-zoom gesture (mobile)
2. ✅ Double-tap to zoom (mobile)
3. ✅ Drag-to-pan gesture (mobile/desktop)
4. ✅ Circle/square crop toggle
5. ✅ Manual zoom slider (accessibility + fallback)
6. ✅ DPI validation with non-blocking warning
7. ✅ Real-time preview (mobile: same canvas, desktop: side-by-side)
8. ✅ Skip functionality ("Skip for now" link)
9. ✅ Crop metadata storage (localStorage + GCS)
10. ✅ Pet selector thumbnail update
11. ✅ Edit crop from selector

### Excluded from MVP (V2)

1. ❌ Rotate gesture
2. ❌ Advanced crop shapes (oval, custom)
3. ❌ Crop presets
4. ❌ Batch crop (apply to multiple pets)
5. ❌ Undo/redo stack
6. ❌ Keyboard shortcuts (nice-to-have)
7. ❌ 3D product preview

### Timeline Estimate

- **Design finalization**: 2-3 days
- **Frontend development**: 8-10 days
  - Crop UI: 3 days
  - Gesture handling: 2 days
  - Preview system: 2 days
  - Integration: 2 days
  - Polish: 1 day
- **Testing**: 3-4 days
- **Total: 13-17 days**

---

## Rollout Strategy

### Progressive Rollout

**Week 1**: Internal (5% traffic)
- Staff + beta testers only
- Monitor errors, gather feedback
- Fix critical bugs

**Week 2**: Mobile-Only (25% mobile traffic)
- 70% of our traffic is mobile
- Focus on gesture performance
- Collect engagement analytics

**Week 3**: Full Platform (25% all traffic)
- Desktop + mobile
- Validate conversion lift
- Monitor abandonment rates

**Week 4**: Full Deploy (100%)
- Ship if metrics positive
- Keep feature flag for rollback
- Plan V2 enhancements

---

## Open Questions for Technical Agents

### Mobile Commerce Architect
1. Gesture library recommendation (Hammer.js vs native Pointer Events)?
2. Real-time preview performance on mid-range Android?
3. Integration pattern (CropManager class vs extend PetProcessor)?

### CV/ML Production Engineer
1. Can we use BG removal bounding box for auto-center?
2. DPI calculation formula (image resolution → crop → zoom → DPI)?
3. GCS metadata format for cropped images?

### AI Product Manager
1. A/B test on all products or specific categories first?
2. Sample size needed for statistical significance?
3. Progressive rollout vs instant full deploy?

### Solution Verification Auditor
1. Security risks with client-side canvas manipulation?
2. Rollback strategy for mid-funnel customers?
3. Critical test scenarios before launch?

---

## Key Design Decisions & Rationale

| Decision | Choice | Rationale | Risk | Mitigation |
|----------|--------|-----------|------|------------|
| **Placement** | After effects | Higher commitment point | Adds friction | Optional, clear skip |
| **Entry** | Auto-show | Less clicks, higher engagement | May seem forced | "(Optional)" label |
| **Primary Gesture** | Pinch-to-zoom | Industry standard | Browser support | Slider fallback |
| **Desktop Layout** | Side-by-side | Shows result, builds confidence | Needs space | Collapse on small screens |
| **Default Shape** | Square | More versatile | Not optimal for all | Smart product-based defaults |
| **Skip Copy** | "Skip for now" | Reduces guilt/pressure | May be ignored | Prominent placement |
| **DPI Warning** | Warn, allow | Balance quality with autonomy | Low-quality prints | Log + customer service |

---

## Next Steps

1. **Review this research** - Approve mobile-first approach and key decisions
2. **Launch technical agents** - Mobile/CV/AI/Verification research
3. **Consolidate findings** - Merge all agent recommendations
4. **Create implementation plan** - Detailed technical specification
5. **Begin development** - 13-17 day MVP timeline

---

**For full detailed research** (16 sections, 1,400+ lines), see:
`.claude/tasks/context_session_crop_zoom_feature.md` → Section "UX Design Research (ux-design-ecommerce-expert)"

---

**Document Status**: ✅ Complete
**Next Agent**: Mobile Commerce Architect
**Ready for**: Technical implementation planning
