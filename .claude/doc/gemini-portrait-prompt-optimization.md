# Gemini 2.5 Flash Image Portrait Prompt Optimization

**Date**: 2025-10-30
**Author**: CV/ML Production Engineer Agent
**Task**: Optimize pet portrait generation to focus on head/neck/shoulders composition

## Executive Summary

The current Gemini API prompts are producing full-body pet images instead of portrait-focused compositions. This analysis identifies specific weaknesses and provides optimized prompts based on official Gemini documentation best practices.

## Current Prompt Analysis

### Key Issues Identified

1. **Weak Compositional Instructions**
   - Current: "Frame tightly on head, neck, and upper shoulders"
   - Problem: Too generic, lacks photographic terminology
   - Missing: Specific shot types, camera angles, aspect ratios

2. **Conflicting Instructions**
   - Current: "Tightly frame the pet's head, neck, and upper chest"
   - Problem: "Upper chest" contradicts portrait framing
   - Gemini interprets this ambiguously, defaulting to wider shots

3. **Lack of Photographic Language**
   - Missing: Professional photography terms (headshot, portrait lens, focal length)
   - Missing: Explicit crop points and framing boundaries
   - Missing: Aspect ratio specifications for portrait orientation

4. **Insufficient Negative Instructions**
   - Current approach doesn't specify what NOT to show
   - Gemini documentation recommends semantic negatives over direct negation

5. **Style Instructions Overshadowing Composition**
   - Artistic style details (70% of prompt) dominate over composition (30%)
   - Gemini prioritizes style rendering over framing constraints

## Documentation Findings

### Best Practices from Gemini Docs

1. **Use Photographic/Cinematic Language**
   - Specify shot types: "close-up portrait", "headshot", "85mm portrait lens"
   - Control depth: "shallow depth of field", "bokeh background"

2. **Hyper-Specificity for Composition**
   - Define exact boundaries: "crop at mid-chest", "fill 80% of frame"
   - Use professional terminology consistently

3. **Semantic Negative Prompts**
   - Instead of "no full body", say "focusing only on the face and shoulders"
   - Describe desired state positively with implicit exclusions

4. **Aspect Ratio Control**
   - Use `aspect_ratio` in `image_config` for portrait orientation
   - Recommend 9:16 or 1:1 for portrait compositions

5. **Iterative Instruction Structure**
   - Lead with composition requirements
   - Follow with style details
   - End with background specifications

## Recommended Improved Prompts

### Modern Style (Ink Wash) - Optimized

```python
ArtisticStyle.INK_WASH: (
    "Create a close-up portrait headshot of the pet using professional 85mm portrait lens framing. "
    "Composition: Fill 75% of the vertical frame with only the pet's head and neck, cropping precisely at the base of the neck where it meets the shoulders. "
    "Use tight portrait framing similar to a professional passport photo or LinkedIn headshot, showing only the face, ears, and neck. "
    "The pet's face should be the dominant element, occupying the center 60% of the image. "
    "No body, legs, or tail visible - focus entirely on facial features and expression. "

    "Subject preservation: Maintain identical facial structure, exact fur colors, precise eye shape and color. "
    "Preserve all unique markings, whisker placement, and the pet's natural expression without alteration. "

    "Artistic style: Apply East Asian ink wash painting technique with flowing black ink gradients. "
    "Use spontaneous brush strokes for fur texture, minimal expressive lines capturing personality. "
    "Create depth through varying ink density rather than perspective. "

    "Background: Pure white (#FFFFFF) with no gradients, textures, or environmental elements."
)
```

### Classic Style (Van Gogh) - Optimized

```python
ArtisticStyle.VAN_GOGH_POST_IMPRESSIONISM: (
    "Create a tightly cropped portrait headshot focusing exclusively on the pet's face and upper neck. "
    "Composition: Use classic portrait photographer framing - face fills 70% of frame height, crop at the base of the neck. "
    "Frame the shot as if using an 85mm lens at f/2.8, creating natural portrait proportions. "
    "Center the pet's eyes in the upper third of the frame following portrait photography rules. "
    "Absolutely no torso, chest, legs, or body parts below the neck should be visible. "

    "Subject accuracy: Preserve exact facial anatomy, accurate fur coloration, and precise eye characteristics. "
    "Maintain the pet's authentic expression, all distinctive markings, and natural head position. "

    "Van Gogh style: Apply thick impasto brushstrokes characteristic of Van Gogh's portrait period. "
    "Use vibrant Post-Impressionist colors - bold blues, warm yellows, deep ochres, and expressive greens. "
    "Create swirling fur patterns with visible brushstroke texture, bold dark outlines defining features. "
    "Reference Van Gogh's Arles period (1888-1889) portrait techniques. "

    "Background: Isolate on pure white (#FFFFFF) canvas with no environmental elements or gradients."
)
```

## Additional Implementation Parameters

### 1. Image Configuration Settings

```python
generation_config = types.GenerationConfig(
    temperature=0.7,  # Reduced from default for more consistent framing
    top_p=0.95,
    top_k=40,
)

image_config = types.ImageGenerationConfig(
    aspect_ratio="1:1",  # Square format ideal for portraits
    # Alternative: "9:16" for vertical portrait orientation
)
```

### 2. Pre-Processing Recommendations

```python
def prepare_input_image(image: Image) -> Image:
    """Pre-crop input image to guide Gemini's composition"""
    # Detect face region using simple center-crop heuristic
    width, height = image.size

    # Calculate portrait crop (assuming pet is centered)
    if height > width:
        # Already portrait oriented
        crop_size = int(width * 0.8)
        left = (width - crop_size) // 2
        top = (height - crop_size) // 2
        right = left + crop_size
        bottom = top + crop_size
    else:
        # Landscape - take upper portion where head likely is
        crop_size = min(width, height)
        left = (width - crop_size) // 2
        top = 0  # Bias towards top where head typically is
        right = left + crop_size
        bottom = crop_size

    return image.crop((left, top, right, bottom))
```

### 3. Prompt Structure Template

```python
def build_optimized_prompt(style: str, composition_weight: float = 0.6) -> str:
    """
    Build prompt with weighted sections

    Args:
        style: Artistic style instructions
        composition_weight: Proportion of prompt dedicated to composition (0.0-1.0)
    """
    composition = (
        "CRITICAL FRAMING REQUIREMENTS: Create a tightly cropped portrait headshot. "
        "Use professional portrait photography framing - face fills 70-80% of frame. "
        "Crop precisely at neck base. Show only head, ears, and neck. "
        "No body parts below neck visible. Center eyes in upper third. "
    )

    if composition_weight > 0.5:
        # Lead with composition for emphasis
        return f"{composition}\n\n{style}"
    else:
        return f"{style}\n\n{composition}"
```

## Testing Protocol

### Validation Metrics

1. **Composition Success Rate**
   - Target: >90% portraits show only head/neck
   - Measure: Presence of body parts in frame

2. **Framing Consistency**
   - Target: <15% variance in face-to-frame ratio
   - Measure: Face area as percentage of total image

3. **Style Preservation**
   - Target: 100% style application
   - Measure: Visual style matching reference

### A/B Testing Plan

1. **Control Group**: Current prompts
2. **Test Group A**: Optimized prompts with photographic language
3. **Test Group B**: Optimized prompts + pre-cropped inputs
4. **Test Group C**: Optimized prompts + aspect ratio 9:16

### Sample Test Cases

- Small dogs (Chihuahua, Yorkie)
- Large dogs (German Shepherd, Labrador)
- Cats (various breeds)
- Multiple pets in frame
- Unusual angles/positions

## Implementation Checklist

- [ ] Update `STYLE_PROMPTS` dictionary with optimized prompts
- [ ] Add `image_config` parameter to generation call
- [ ] Implement input image pre-processing (optional)
- [ ] Reduce temperature to 0.7 for consistency
- [ ] Add prompt weighting logic
- [ ] Test with 10+ diverse pet images
- [ ] Monitor composition success rate
- [ ] Document edge cases

## Risk Assessment

### Low Risk
- Prompt optimization (easily reversible)
- Parameter tuning (configuration change)

### Medium Risk
- Pre-processing may crop important features
- Tighter framing might cut off distinctive markings

### Mitigation
- Keep original prompts as fallback
- A/B test before full deployment
- Allow user to choose framing preference

## Next Steps

1. **Immediate**: Update prompts in `gemini_client.py`
2. **Short-term**: Add aspect ratio configuration
3. **Medium-term**: Implement A/B testing framework
4. **Long-term**: Build face detection pre-processor

## Conclusion

The current prompts lack the photographic specificity needed for consistent portrait framing. By implementing these optimized prompts with professional photography terminology, explicit crop boundaries, and proper prompt structure, we expect to achieve >90% portrait composition success rate while maintaining artistic style quality.

The key insight is that Gemini responds better to professional photographic language ("85mm portrait lens", "headshot framing") than generic descriptions ("tightly frame"). Combined with aspect ratio control and composition-first prompt structure, these changes will deliver the desired portrait-focused outputs.