# Homepage Hero Text Positioning - Minimal Launch Implementation

**Date**: September 22, 2025
**Context**: LAUNCH BLOCKER - Homepage hero text positioning for Perkie Prints
**Priority**: URGENT - Required for launch
**Implementation Time**: 2-3 hours maximum

## Executive Summary

This is the SIMPLEST possible implementation to solve the homepage hero text positioning launch requirement. Focus is on minimal code changes, maximum reliability, and mobile responsiveness for 70% mobile traffic.

## Scope: Homepage Hero ONLY

**Target**: Homepage hero image banner positioning
**NOT targeting**: All banner sections, general banner system
**Goal**: Intuitive positioning for the single most important banner

## Problem Statement

- Current percentage sliders (0-100%) are unintuitive for homepage hero
- Homepage hero needs reliable text positioning for launch
- 70% mobile traffic requires mobile-optimized positioning
- Need FASTEST implementation that works

## Minimal Solution: 3x3 Grid for Homepage Hero

### Implementation Plan

#### Phase 1: Quick Grid Selector (2-3 hours total)

**File to Modify**: `sections/image-banner.liquid` (homepage hero section)

#### 1. Schema Addition (30 minutes)
Add new grid selector alongside existing sliders:

```liquid
{
  "type": "select",
  "id": "hero_grid_position",
  "label": "Hero Position (Grid)",
  "options": [
    { "value": "", "label": "Use sliders (current)" },
    { "value": "top-left", "label": "↖ Top Left" },
    { "value": "top-center", "label": "↑ Top Center" },
    { "value": "top-right", "label": "↗ Top Right" },
    { "value": "center-left", "label": "← Center Left" },
    { "value": "center", "label": "⊙ Center" },
    { "value": "center-right", "label": "→ Center Right" },
    { "value": "bottom-left", "label": "↙ Bottom Left" },
    { "value": "bottom-center", "label": "↓ Bottom Center" },
    { "value": "bottom-right", "label": "↘ Bottom Right" }
  ],
  "default": ""
}
```

#### 2. Position Mapping Logic (1 hour)
Add simple Liquid logic before existing positioning:

```liquid
{%- liquid
  # Grid position override for homepage hero
  if block.settings.hero_grid_position != blank
    case block.settings.hero_grid_position
      when 'top-left'
        assign grid_x = 15
        assign grid_y = 15
      when 'top-center'
        assign grid_x = 50
        assign grid_y = 15
      when 'top-right'
        assign grid_x = 85
        assign grid_y = 15
      when 'center-left'
        assign grid_x = 15
        assign grid_y = 50
      when 'center'
        assign grid_x = 50
        assign grid_y = 50
      when 'center-right'
        assign grid_x = 85
        assign grid_y = 50
      when 'bottom-left'
        assign grid_x = 15
        assign grid_y = 85
      when 'bottom-center'
        assign grid_x = 50
        assign grid_y = 85
      when 'bottom-right'
        assign grid_x = 85
        assign grid_y = 85
    endcase

    # Use grid values for both desktop and mobile (mobile-first)
    assign final_x = grid_x
    assign final_y = grid_y
    assign final_mx = grid_x
    assign final_my = grid_y
  else
    # Use existing slider values
    assign final_x = block.settings.x
    assign final_y = block.settings.y
    assign final_mx = block.settings.mx
    assign final_my = block.settings.my
  endif
-%}
```

#### 3. CSS Output Update (30 minutes)
Replace existing CSS variable output:

```liquid
{%- if block.settings.custom_position -%}
  <div class="banner__layer" data-pos="desktop mobile"
       style="--x: {{ final_x }}%;
              --y: {{ final_y }}%;
              --mx: {{ final_mx }}%;
              --my: {{ final_my }}%;">
```

#### 4. Testing & Deployment (30 minutes)
- Test all 9 grid positions on staging
- Verify mobile responsiveness
- Push to staging via GitHub

## Key Benefits

### 1. Minimal Risk
- **Additive only**: Existing sliders continue to work
- **Fallback built-in**: Empty grid selection uses current sliders
- **No breaking changes**: Current homepage works unchanged

### 2. Mobile-First
- **Same position for desktop/mobile**: Eliminates separate mobile controls
- **Safe margins**: 15/50/85% provides good edge clearance
- **Touch-friendly**: Grid selector works on mobile admin

### 3. Launch-Ready
- **2-3 hour implementation**: Can be deployed same day
- **Shopify-native**: Uses standard select dropdown
- **No JavaScript**: Pure Liquid + CSS, maximum reliability

## Implementation Steps

### Step 1: Backup (5 minutes)
```bash
git checkout -b homepage-hero-positioning
git add .
git commit -m "Backup before hero positioning implementation"
```

### Step 2: Schema Update (30 minutes)
1. Open `sections/image-banner.liquid`
2. Find the schema section for heading/text/button blocks
3. Add the `hero_grid_position` select field to each block type

### Step 3: Logic Implementation (1 hour)
1. Add position mapping logic before existing positioning code
2. Create conditional logic for grid vs slider positioning
3. Set final_x, final_y, final_mx, final_my variables

### Step 4: CSS Update (30 minutes)
1. Update style attribute to use final_* variables
2. Test that existing percentage positioning still works
3. Verify grid positioning outputs correct percentages

### Step 5: Testing & Deploy (30 minutes)
1. Test all 9 grid positions on staging
2. Verify slider fallback works
3. Test mobile responsiveness
4. Commit and push to staging

```bash
git add .
git commit -m "Add homepage hero grid positioning for launch"
git push origin homepage-hero-positioning
```

## Mobile Optimization

### Position Values (Mobile-Safe)
- **15% margins**: Safe distance from edges
- **50% center**: Perfect center positioning
- **85% far edge**: Safe distance from opposite edge

### Single Position Set
- Desktop and mobile use same values
- Eliminates complexity of separate mobile controls
- Mobile-first approach for 70% mobile traffic

## Success Criteria

### Launch Requirements Met
- ✅ Intuitive grid selector instead of percentage sliders
- ✅ Mobile-responsive positioning (70% traffic)
- ✅ Reliable Shopify theme editor integration
- ✅ Can be implemented in 2-3 hours

### Technical Requirements
- ✅ No breaking changes to existing banners
- ✅ Backward compatibility with slider controls
- ✅ Pure Liquid/CSS implementation (no JavaScript)
- ✅ Minimal code changes

### User Experience
- ✅ Visual grid selection with arrows (↖↑↗←⊙→↙↓↘)
- ✅ Immediate understanding of positioning options
- ✅ Works on mobile admin interface
- ✅ Fallback to percentage sliders if needed

## Files Modified

1. **`sections/image-banner.liquid`** - Single file change
   - Add hero_grid_position select field to schema
   - Add position mapping Liquid logic
   - Update CSS variable output

**Total Files**: 1
**Total Lines Added**: ~50
**Breaking Changes**: 0

## Alternative Quick Solutions Considered

### Option A: Preset Positions Only
- **Pro**: Even simpler (3 positions: top, center, bottom)
- **Con**: Less flexible than 9-position grid
- **Verdict**: Grid provides better positioning options

### Option B: Mobile-Specific Grid
- **Pro**: Separate mobile positioning
- **Con**: More complex, longer implementation
- **Verdict**: Single position set is mobile-first and simpler

### Option C: JavaScript Enhancement
- **Pro**: Could provide visual preview
- **Con**: Adds complexity, browser compatibility issues
- **Verdict**: Pure Liquid is more reliable for launch

## Risk Assessment

### Technical Risks: MINIMAL
- ✅ Shopify select dropdowns are well-supported
- ✅ Liquid logic is deterministic and reliable
- ✅ CSS custom properties have excellent browser support
- ✅ No JavaScript dependencies

### UX Risks: LOW
- ✅ Existing sliders remain as fallback
- ✅ Grid positions chosen for good visual results
- ✅ Mobile-safe margins prevent edge cutoff

### Launch Risks: MINIMAL
- ✅ Additive change, no breaking modifications
- ✅ Can be implemented and tested in single day
- ✅ Rollback is trivial (remove grid selector)

## Post-Launch Considerations

### If Grid System Proves Successful
- Consider extending to other banner sections
- Add fine-tune offset controls
- Implement banner preset templates

### If Issues Arise
- Grid selector can be hidden via CSS
- Sliders continue to work unchanged
- Easy rollback path available

## Conclusion

This minimal implementation solves the homepage hero positioning launch requirement with:

- **Maximum reliability**: Shopify-native, no JavaScript
- **Minimal risk**: Additive only, full backward compatibility
- **Mobile-first**: Single position set optimized for 70% mobile traffic
- **Quick delivery**: 2-3 hours from start to staging deployment

The solution focuses exclusively on the stated launch requirement (homepage hero positioning) rather than trying to solve the broader banner positioning system. This approach delivers the needed functionality quickly and reliably for launch, with the option to enhance further based on real user feedback.