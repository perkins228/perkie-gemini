# Gemini 2.5 Flash Image Prompt Update Implementation Plan

**Task**: Update Gemini artistic API prompts for white backgrounds and Van Gogh style
**Created**: 2025-10-24
**Author**: CV/ML Production Engineer
**Status**: Ready for Implementation

---

## Executive Summary

This plan outlines the changes needed to:
1. **Replace transparent backgrounds with pure white (#ffffff) backgrounds** across all styles
2. **Replace "Charcoal Realism" with "Van Gogh Post-Impressionism"** style

The changes affect only prompt text in a single file, with minimal risk and immediate deployment capability.

---

## Root Cause Analysis

### Current State
- All three styles currently specify: "completely transparent background with no visible backdrop"
- This was updated from "transparent or white" on 2025-10-24 (revision 00011-k49)
- Charcoal Realism style focuses on monochrome hand-drawn aesthetics

### Business Need
- **White backgrounds**: Better for product visualization and print-on-demand
- **Van Gogh style**: Higher customer appeal, more colorful option for engagement

---

## Implementation Changes

### File to Modify
`backend/gemini-artistic-api/src/core/gemini_client.py`

### Change 1: Update All Background Instructions

#### Prompt Engineering Recommendations

For Gemini 2.5 Flash Image, the most effective white background specifications are:

**RECOMMENDED APPROACH** (Most explicit):
```python
"The headshot must be isolated on a pure white background (#FFFFFF) with no other colors, textures, or gradients visible in the background area."
```

**Why this works best**:
1. **Explicit color specification** (#FFFFFF) removes ambiguity
2. **"Pure white"** emphasizes solid color, not off-white
3. **"No other colors, textures, or gradients"** prevents artistic interpretation
4. **"Must be"** creates strong directive (vs "should be")

**Alternative phrasings** (in order of effectiveness):
- "solid white background (#FFFFFF)" - Good, but less explicit about purity
- "clean white background" - Can be interpreted as off-white or light gray
- "white backdrop" - May add studio-like elements

### Change 2: Replace Charcoal with Van Gogh Style

#### Current Charcoal Prompt (Lines 49-65)
```python
ArtisticStyle.CHARCOAL_REALISM: (
    "First, carefully identify all pets..."
    # ... headshot framing instructions ...
    "Then render as a hand-drawn charcoal realism portrait..."
)
```

#### New Van Gogh Post-Impressionism Prompt

**RECOMMENDED PROMPT STRUCTURE**:

```python
ArtisticStyle.VAN_GOGH_POST_IMPRESSIONISM: (
    "First, carefully identify all pets (dogs, cats, or other animals) in this image. "
    "Create a formal portrait headshot composition: Tightly frame the pet's head, neck, and upper chest. "
    "Position the pet's face prominently with careful attention to proportions and angles. "
    "Use classical portrait framing with the eyes as the primary focal point. "
    "For multiple pets: if in physical contact, create a group portrait headshot; if separated but all have clear sharp features, create a group portrait; "
    "if separated with varying focus/clarity, choose the pet with the clearest sharpest features. "
    "Remove the original background completely, isolating only the headshot portrait. "
    "Then transform into a Van Gogh Post-Impressionist painting with these specific characteristics: "
    "Apply thick, bold brushstrokes in the impasto technique with visible texture and dimension. "
    "Use vibrant, expressive colors - rich blues, warm yellows, deep greens, and earthy ochres. "
    "Create dynamic, swirling patterns in the fur using Van Gogh's characteristic curved brushwork. "
    "Apply bold, dark outlines around the pet's features for definition and structure. "
    "Build up layers of complementary colors - oranges against blues, purples against yellows. "
    "Emphasize emotional intensity through exaggerated color contrasts and energetic brush movement. "
    "The brushstrokes should follow the natural contours of the pet's form, creating rhythm and flow. "
    "Capture the pet's expression with the same psychological depth Van Gogh brought to his portraits. "
    "Reference the style of Van Gogh's Arles period (1888-1889) with its peak vibrancy and technical mastery. "
    "The headshot must be isolated on a pure white background (#FFFFFF) with no other colors, textures, or gradients visible in the background area."
)
```

#### Key Van Gogh Techniques to Emphasize

1. **Impasto Technique**
   - "thick, textured brushstrokes that create physical dimension"
   - "paint appears to rise from the canvas surface"

2. **Color Philosophy**
   - "complementary color juxtaposition for vibrancy"
   - "emotional color choices over realistic ones"
   - Specific palette: "cobalt blue, chrome yellow, emerald green, burnt sienna"

3. **Brushwork Patterns**
   - "swirling, rhythmic strokes following form"
   - "directional brushwork creating movement"
   - "short, deliberate marks building texture"

4. **Period Reference**
   - Arles period (1888-1889): Peak technical skill and color vibrancy
   - Avoid Saint-Rémy period: Darker, more troubled palette

### Change 3: Update Enum and References

#### Update the ArtisticStyle enum
Location: `backend/gemini-artistic-api/src/models/schemas.py`

```python
class ArtisticStyle(str, Enum):
    """Available artistic styles with headshot framing"""
    BW_FINE_ART = "bw_fine_art"
    INK_WASH = "ink_wash"
    VAN_GOGH_POST_IMPRESSIONISM = "van_gogh_post_impressionism"  # Changed from CHARCOAL_REALISM
```

### Complete Updated Prompts

#### Black & White Fine Art (Lines 21-34)
```python
ArtisticStyle.BW_FINE_ART: (
    "First, carefully identify all pets (dogs, cats, or other animals) in this image. "
    "Create a professional headshot portrait composition: Focus tightly on the pet's head, neck, and upper shoulders. "
    "Frame the pet's face as the central focal point with eyes positioned in the upper third of the frame. "
    "Use a classic portrait crop that includes just enough chest/shoulders for natural framing. "
    "For multiple pets: if touching, create a group headshot; if separated but all in focus, create a group headshot; "
    "if separated with some unfocused/blurry, focus on the most prominent clear pet. "
    "Remove the background completely, isolating only the headshot portrait. "
    "Then transform the pet headshot into a stunning Black & White Fine Art Portrait. "
    "Use dramatic lighting on the facial features, rich tonal depth, and exquisite detail. "
    "Emphasize texture in fur, whiskers, and especially the eyes with museum-quality black and white photography aesthetics. "
    "Create gallery-worthy contrast focused on the pet's expression and character. "
    "The headshot must be isolated on a pure white background (#FFFFFF) with no other colors, textures, or gradients visible in the background area."
),
```

#### Modern Ink & Wash (Lines 35-48)
```python
ArtisticStyle.INK_WASH: (
    "First, carefully identify all pets (dogs, cats, or other animals) in this image. "
    "Create an intimate headshot portrait composition: Focus on the pet's head and graceful neck curve. "
    "Frame to capture the pet's expression and character, with the face as the clear focal point. "
    "Use a portrait-style crop that suggests the shoulders but emphasizes the head. "
    "For multiple pets: if touching, compose them together in a group headshot; if separated but all clear and focused, create a group headshot; "
    "if separated with some blurry or out of focus, select the clearest focused subject. "
    "Remove the background completely, isolating only the headshot portrait. "
    "Then create a Modern Ink & Wash style headshot artwork in the tradition of East Asian brush painting. "
    "Use flowing ink gradients to define facial features, spontaneous brush strokes for fur texture. "
    "Capture the pet's expression and gaze with minimal yet expressive lines. "
    "Focus artistic detail on the eyes and facial structure while keeping the style elegant and simple. "
    "The headshot must be isolated on a pure white background (#FFFFFF) with no other colors, textures, or gradients visible in the background area."
),
```

---

## Temperature & Parameter Optimization

### Current Settings (backend/gemini-artistic-api/src/config.py)
```python
gemini_temperature: float = 0.7
gemini_top_p: float = 0.9
gemini_top_k: int = 40
```

### Recommended Adjustments for Consistency

For artistic style generation with Gemini 2.5 Flash Image:

```python
gemini_temperature: float = 0.4  # Lower for more consistent styling
gemini_top_p: float = 0.85       # Slightly lower for predictability
gemini_top_k: int = 30           # Tighter token selection
```

**Rationale**:
- **Temperature 0.4**: Balances creativity with consistency (0.7 too variable for production)
- **Top-p 0.85**: Reduces outlier generations while maintaining artistic quality
- **Top-k 30**: Prevents wild style variations between requests

---

## Testing Strategy

### Pre-Deployment Testing

1. **Local Prompt Testing**
   ```python
   # Test script to validate prompts
   test_images = [
       "single_dog_clear.jpg",
       "multiple_cats_touching.jpg",
       "dog_cat_separated.jpg",
       "blurry_background_pet.jpg"
   ]

   for image in test_images:
       for style in [BW_FINE_ART, INK_WASH, VAN_GOGH_POST_IMPRESSIONISM]:
           result = await generate_artistic_style(image, style)
           # Verify white background
           # Verify headshot framing
           # Verify style characteristics
   ```

2. **Background Verification**
   - Check RGB values in corners: Should be (255, 255, 255)
   - Verify no transparency in PNG alpha channel
   - Confirm no gradient or texture in background area

3. **Van Gogh Style Validation**
   - Visible brushstroke texture
   - Vibrant color palette present
   - Bold outlines visible
   - Swirling patterns in fur

### Post-Deployment Testing

1. **A/B Test Setup**
   - 50% users see new styles (white bg + Van Gogh)
   - 50% users see previous version
   - Track engagement metrics

2. **Quality Metrics**
   - User satisfaction rating
   - Download rate
   - Time spent viewing
   - Style selection distribution

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| White background reduces appeal | Low | Medium | A/B test before full rollout |
| Van Gogh style too abstract | Low | Low | Prompt emphasizes clear features |
| Increased generation failures | Very Low | Low | Rollback to previous prompts |
| Higher API costs | Zero | N/A | Same model, same pricing |

---

## Deployment Steps

### Phase 1: Backend Update (15 minutes)

1. **Update gemini_client.py**
   ```bash
   cd backend/gemini-artistic-api
   # Edit src/core/gemini_client.py with changes above
   ```

2. **Update schemas.py**
   ```bash
   # Edit src/models/schemas.py to rename enum value
   ```

3. **Update config.py** (optional but recommended)
   ```bash
   # Edit src/config.py to adjust temperature settings
   ```

4. **Deploy to Cloud Run**
   ```bash
   ./scripts/deploy-gemini-artistic.sh
   ```

5. **Verify deployment**
   ```bash
   curl https://gemini-artistic-api-753651513695.us-central1.run.app/health
   ```

### Phase 2: Frontend Update (if needed)

Update style selector UI to show "Van Gogh Style" instead of "Charcoal Realism":
- Update label text
- Update description
- Update icon/preview if applicable

---

## Rollback Plan

If issues arise:

```bash
# Immediate rollback to previous revision
gcloud run services update-traffic gemini-artistic-api \
  --region=us-central1 \
  --to-revisions=gemini-artistic-api-00011-k49=100
```

Previous working revision with transparent backgrounds: `00011-k49`

---

## Color Balance Analysis

### Current State (After Changes)
- **Black & White Fine Art**: Pure B&W (unchanged)
- **Modern Ink & Wash**: Grayscale with subtle ink tones (unchanged)
- **Van Gogh Post-Impressionism**: Full vibrant color (NEW)

### Customer Choice Distribution
- **1 Pure B&W option** (33%): Classic, timeless
- **1 Subtle/Muted option** (33%): Artistic, understated
- **1 Vibrant Color option** (33%): Bold, expressive

**Assessment**: Good balance. Covers full spectrum of customer preferences.

---

## Monitoring & Success Criteria

### Week 1 Metrics
- Generation success rate > 95%
- White background accuracy > 98%
- Van Gogh style recognition > 90%
- No increase in generation time

### Month 1 Metrics
- Van Gogh selection rate > 25%
- Overall engagement increase > 5%
- Customer satisfaction maintained or improved
- Cost per generation stable

---

## Additional Recommendations

### 1. Consider Style Variants (Future)
- **Van Gogh Night**: Starry Night inspired backgrounds
- **Van Gogh Sunflower**: Warm yellow/orange palette
- **Van Gogh Iris**: Cool blue/purple palette

### 2. Prompt Optimization Loop
- Collect user feedback on generated images
- Identify common issues (too abstract, wrong colors, etc.)
- Refine prompts based on data
- Deploy improvements weekly

### 3. Caching Strategy Enhancement
- Pre-generate popular breed + style combinations
- Cache for 7 days instead of 24 hours
- Could reduce API costs by 40-50%

---

## Summary

**Total Implementation Time**: ~20 minutes
- Code changes: 10 minutes
- Deployment: 5 minutes
- Verification: 5 minutes

**Risk Level**: LOW
- Simple prompt text changes
- No architectural modifications
- Easy rollback available
- Testsite environment only

**Expected Outcome**:
- Clean white backgrounds for all styles
- New colorful Van Gogh option increases engagement
- Better product visualization for print-on-demand
- Maintained cost structure ($0.039/image)

---

## Questions & Answers

### Q1: Best white background specification?
**A**: Use `"pure white background (#FFFFFF) with no other colors, textures, or gradients visible"`
- Most explicit and unambiguous
- Prevents off-white or textured interpretations

### Q2: Van Gogh prompt structure?
**A**: Maintain same headshot framing logic, then apply Van Gogh style:
1. Identify pets
2. Frame as headshot
3. Remove background
4. Apply Van Gogh transformation with specific technique callouts

### Q3: Color balance good?
**A**: Yes, excellent distribution:
- B&W for classic taste (33%)
- Ink wash for subtle artistic (33%)
- Van Gogh for vibrant/bold (33%)

### Q4: Specific Van Gogh techniques?
**A**: Emphasize these in order of importance:
1. Impasto (thick brushstrokes)
2. Complementary colors
3. Swirling patterns
4. Bold outlines
5. Arles period reference

### Q5: Temperature adjustments?
**A**: Strongly recommend 0.7 → 0.4:
- Better consistency across generations
- Reduces "wild" interpretations
- Maintains artistic quality
- Especially important for Van Gogh style

---

## Next Actions

1. **Immediate**: Review and approve this plan
2. **Today**: Implement code changes
3. **Today**: Deploy to Cloud Run
4. **This Week**: Monitor generation quality
5. **Next Week**: Analyze usage patterns
6. **Month 1**: Full A/B test analysis

---

**Document Version**: 1.0
**Review Status**: Ready for Implementation
**Approval Required From**: Product Owner