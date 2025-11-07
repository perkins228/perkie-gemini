# Hybrid Inline Preview Implementation Plan

**Created**: 2025-11-07
**Purpose**: Step-by-step implementation guide for pivoting to hybrid approach
**Timeline**: 20-30 hours total (1 week)
**Risk Level**: LOW-MEDIUM (reusing proven components)

## Critical Context

We're pivoting from building a standalone inline preview to a hybrid approach that:
1. **Keeps existing upload flow** via pet-selector (works perfectly)
2. **Intercepts Preview button click** to open modal instead of navigating
3. **Reuses pet-processor.js logic** for all processing
4. **Delivers inline modal UX** without page navigation

## Phase 1: Preview Button Interception (4 hours)

### Task 1.1: Create Modal Trigger Hook (1 hour)

**File**: `snippets/ks-product-pet-selector-stitch.liquid`

**Current Code** (lines 1886-1897):
```javascript
function openProcessorModal(imageDataUrl, petIndex) {
  sessionStorage.setItem('pet_selector_return_url', window.location.href);
  sessionStorage.setItem('pet_selector_scroll_position', window.scrollY.toString());
  sessionStorage.setItem('pet_selector_active_index', petIndex.toString());

  // Navigate away from page
  window.location.href = '/pages/custom-image-processing#processor';
}
```

**New Code**:
```javascript
function openProcessorModal(imageDataUrl, petIndex) {
  // Store context for potential fallback
  sessionStorage.setItem('pet_selector_return_url', window.location.href);
  sessionStorage.setItem('pet_selector_active_index', petIndex.toString());

  // Check if inline preview is available and enabled
  const urlParams = new URLSearchParams(window.location.search);
  const inlineEnabled = urlParams.get('inline_preview') !== 'false';

  if (inlineEnabled && window.InlineProcessorModal) {
    // Open inline modal with existing data
    window.InlineProcessorModal.open({
      imageUrl: imageDataUrl,
      petIndex: petIndex,
      productId: getProductId(), // Already defined in file
      productHandle: window.location.pathname.split('/').pop()
    });
  } else {
    // Fallback to original processor page
    sessionStorage.setItem('pet_selector_scroll_position', window.scrollY.toString());
    window.location.href = '/pages/custom-image-processing#processor';
  }
}
```

### Task 1.2: Create Modal Shell (1 hour)

**New File**: `snippets/inline-processor-modal.liquid`

```liquid
{% comment %} Inline Processor Modal - Hybrid Approach {% endcomment %}
<div id="inline-processor-modal" class="inline-processor-modal" style="display: none;">
  <div class="inline-processor-backdrop"></div>
  <div class="inline-processor-content">
    <div class="inline-processor-header">
      <h2>Preview Your Custom Portrait</h2>
      <button type="button" class="inline-processor-close" aria-label="Close">
        <svg>...</svg>
      </button>
    </div>

    <div class="inline-processor-body">
      {% comment %} Mount point for processor UI {% endcomment %}
      <div id="inline-processor-mount"></div>
    </div>
  </div>
</div>

<script src="{{ 'inline-processor-modal.js' | asset_url }}" defer></script>
<link rel="stylesheet" href="{{ 'inline-processor-modal.css' | asset_url }}">
```

### Task 1.3: Test Basic Modal Opening (1 hour)

**Test Checklist**:
- [ ] Upload image via pet-selector
- [ ] Preview button appears
- [ ] Click Preview → Modal opens
- [ ] Modal displays placeholder content
- [ ] Close button works
- [ ] ESC key closes modal
- [ ] Backdrop click closes modal
- [ ] No scroll freeze

### Task 1.4: Implement Kill Switch (1 hour)

**URL Parameters**:
- `?inline_preview=false` - Use original processor page
- `?inline_preview=true` - Force inline modal (default)
- `?inline_preview=debug` - Show debug info

## Phase 2: Processor Integration (12 hours)

### Task 2.1: Create Processor Adapter (4 hours)

**New File**: `assets/inline-processor-modal.js`

```javascript
class InlineProcessorModal {
  constructor() {
    this.modal = document.getElementById('inline-processor-modal');
    this.mountPoint = document.getElementById('inline-processor-mount');
    this.processor = null;
    this.currentData = null;
  }

  async open(data) {
    this.currentData = data;
    this.modal.style.display = 'block';

    // Initialize processor in modal context
    if (!this.processor) {
      this.processor = new ModalPetProcessor(this.mountPoint);
    }

    // Load with existing data from pet-selector
    await this.processor.loadFromUpload(data);
  }
}

class ModalPetProcessor extends PetProcessor {
  constructor(container) {
    super();
    this.container = container;
    this.isModal = true;

    // Override methods that navigate away
    this.setupModalOverrides();
  }

  setupModalOverrides() {
    // Override redirect after add to cart
    this.redirectAfterCart = () => {
      this.showSuccessMessage();
      setTimeout(() => {
        window.InlineProcessorModal.close();
        location.reload(); // Refresh product page to show cart update
      }, 2000);
    };
  }

  async loadFromUpload(data) {
    const { imageUrl, petIndex } = data;

    // Check if GCS URL or base64
    if (imageUrl.startsWith('https://storage.googleapis.com')) {
      // Already uploaded to GCS
      this.currentPet = {
        originalImage: imageUrl,
        processedImage: null,
        effects: {},
        name: localStorage.getItem(`pet_${petIndex}_name`) || '',
        index: petIndex
      };
    } else {
      // Base64 data - convert
      this.currentPet = {
        originalImage: imageUrl,
        processedImage: null,
        effects: {},
        name: '',
        index: petIndex
      };
    }

    // Start processing
    await this.processImage();
  }
}
```

### Task 2.2: Extract Core Processor Methods (4 hours)

**Create Shared Module**: `assets/pet-processor-core.js`

Extract from `pet-processor.js`:
- `removeBackground()`
- `uploadToGCS()`
- `generateGeminiEffects()`
- `buildOrderProperties()`
- `addToCart()`
- Error handling utilities
- Progress tracking utilities

Make these methods work standalone without DOM dependencies.

### Task 2.3: Build Modal UI Components (2 hours)

**Reuse Existing HTML** from `sections/ks-pet-processor-v5.liquid`:
- Processing spinner
- Effect grid
- Preview display
- Add to cart section

But simplify for modal context:
- No upload zone (already done)
- No multi-pet tabs (single pet)
- Streamlined layout for modal

### Task 2.4: Wire Up Processing Flow (2 hours)

**Processing Pipeline**:
1. Receive image from pet-selector
2. Show processing UI
3. Call removeBackground()
4. Display processed image
5. Generate effects on demand
6. Handle Add to Cart

## Phase 3: UI Polish & Testing (8 hours)

### Task 3.1: Responsive Modal Design (2 hours)

**Mobile Optimizations**:
```css
.inline-processor-modal {
  /* Full screen on mobile */
  @media (max-width: 768px) {
    .inline-processor-content {
      width: 100%;
      height: 100%;
      max-height: 100%;
      border-radius: 0;
    }
  }
}
```

### Task 3.2: Fix Known Issues (2 hours)

**Must Fix**:
1. Scroll freeze issue (use position: fixed trick)
2. API parameter format (use File object)
3. Duplicate script loading (check before loading)

### Task 3.3: End-to-End Testing (2 hours)

**Test Scenarios**:
1. Upload → Preview → Process → Add to Cart
2. Upload multiple pets → Preview each
3. Cancel during processing
4. Error handling (bad image, API down)
5. Mobile experience (iOS/Android)
6. Session persistence

### Task 3.4: Performance Optimization (2 hours)

**Optimize**:
- Lazy load Gemini effects
- Image compression before upload
- Progress indicators accuracy
- Memory cleanup on close

## Phase 4: A/B Test Setup (6 hours)

### Task 4.1: Create Test Variants (2 hours)

**Control**: Original processor page flow
**Variant**: Inline modal flow

### Task 4.2: Implement Tracking (2 hours)

Track events:
- Preview button clicks
- Processing completions
- Add to cart from preview
- Conversion rate

### Task 4.3: Configure Split (2 hours)

- 50/50 split initially
- Cookie-based assignment
- Minimum 1000 users per variant

## File Changes Summary

### Modified Files
1. `snippets/ks-product-pet-selector-stitch.liquid`
   - Lines 1886-1897: Intercept Preview button

### New Files
1. `snippets/inline-processor-modal.liquid` (HTML structure)
2. `assets/inline-processor-modal.js` (Modal controller)
3. `assets/inline-processor-modal.css` (Modal styles)
4. `assets/pet-processor-core.js` (Extracted shared logic)

### Deleted Files (from failed MVP)
1. `snippets/inline-preview-mvp.liquid`
2. `assets/inline-preview-mvp.js`
3. `assets/inline-preview-mvp.css`

## Risk Mitigation

### Potential Issues & Solutions

1. **localStorage Conflicts**
   - Namespace modal data: `modal_pet_1_*`
   - Clear on modal close

2. **Memory Leaks**
   - Destroy processor instance on close
   - Remove event listeners
   - Clear image references

3. **CSS Conflicts**
   - Scope all styles with `.inline-processor-modal`
   - Use CSS modules or BEM naming

4. **API Rate Limiting**
   - Reuse existing rate limiter
   - Show queue position if needed

## Success Metrics

### Technical Success
- [ ] No console errors
- [ ] No scroll freeze
- [ ] API calls succeed
- [ ] Add to cart works
- [ ] Mobile responsive

### Business Success
- [ ] 30%+ conversion lift
- [ ] <3s time to first preview
- [ ] <5% error rate
- [ ] 80%+ completion rate

## Rollback Plan

If issues arise:
1. Set `inline_preview=false` globally
2. All users revert to original flow
3. Fix issues offline
4. Re-enable gradually

## Next Actions

1. **Immediate** (Today):
   - Implement Phase 1.1 (Preview button hook)
   - Test basic modal opening

2. **Tomorrow**:
   - Extract processor core methods
   - Build modal adapter

3. **Day 3-4**:
   - Complete integration
   - Fix known issues

4. **Day 5**:
   - Full testing
   - Deploy to test environment

## Notes

- This approach minimizes risk by reusing proven code
- Kill switch allows instant rollback if needed
- Modal context isolates changes from main processor
- Can ship MVP in 5 days vs 14 days for full rebuild