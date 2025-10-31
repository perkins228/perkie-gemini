# Pet Processor Gemini Integration Plan

**Date**: 2025-10-30
**Task**: Integrate Gemini Artistic API into existing pet-processor.js
**Mobile Traffic**: 70% - Performance is critical
**API Endpoint**: https://gemini-artistic-api-753651513695.us-central1.run.app

---

## Executive Summary

This plan details the integration of Gemini Artistic API (Modern + Classic effects) into the existing pet-processor.js workflow. The integration is designed to be **mobile-first**, **non-blocking**, and **gracefully degrading**.

**Key Principles**:
1. **Sequential Flow**: InSPyReNet first (B&W + Color), then Gemini (Modern + Classic)
2. **Non-Blocking**: Show B&W + Color effects immediately, Gemini loads in background
3. **Graceful Degradation**: If Gemini fails, users still have B&W + Color (unlimited)
4. **Feature Flag Controlled**: Easy to disable if issues arise
5. **Mobile Optimized**: Minimize blocking, show progressive feedback

---

## Current Architecture Analysis

### Existing Flow (pet-processor.js)
```
1. User uploads → processFile(file)
2. Parallel:
   - uploadOriginalImage(file) → GCS URL
   - callAPI(file) → InSPyReNet processing
3. InSPyReNet returns 4 effects:
   - enhancedblackwhite (B&W)
   - popart (being removed)
   - dithering (being removed)
   - color (Color)
4. Store in currentPet.effects as { dataUrl, gcsUrl }
5. Display in UI with effect selector buttons
```

**Lines of Interest**:
- **Line 17**: `effectOrder = ['enhancedblackwhite', 'popart', 'dithering', 'color']`
- **Line 465-503**: `processFile()` - Main orchestration
- **Line 564-665**: `callAPI()` - InSPyReNet processing
- **Line 570**: `formData.append('effects', 'enhancedblackwhite,popart,dithering,color')`
- **Line 608**: Fetch URL with effects parameter
- **Line 629-641**: Process response and store effects
- **Line 709-737**: `switchEffect()` - Display selected effect

### Frontend Gemini Modules (Already Built)
```
assets/gemini-api-client.js:
- GeminiAPIClient class with batchGenerate() method
- Rate limiting (10/day with 4-level warnings)
- Feature flag support
- Retry logic with exponential backoff
- Customer ID tracking for quota

assets/gemini-effects-ui.js:
- GeminiEffectsUI class for warning system
- 4-level progressive warnings (silent → reminder → warning → exhausted)
- Toast notifications and persistent banners
- Effect button badges showing quota
- Mobile-optimized UI
```

---

## Implementation Plan

### Phase 1: Import and Initialize Gemini Modules

**File**: `assets/pet-processor.js`

**Location**: Top of file (after existing imports, before class definitions)

**Add**:
```javascript
// Import Gemini modules
import { GeminiAPIClient } from './gemini-api-client.js';
import { GeminiEffectsUI } from './gemini-effects-ui.js';
```

**Location**: Inside `PetProcessor` constructor (after existing initialization)

**Add**:
```javascript
// Initialize Gemini integration
this.geminiClient = null;
this.geminiUI = null;
this.geminiEnabled = false;

// Lazy-load Gemini client (only if feature enabled)
this.initializeGemini();
```

**New Method**: Add after constructor

```javascript
initializeGemini() {
  try {
    this.geminiClient = new GeminiAPIClient();
    this.geminiEnabled = this.geminiClient.enabled;

    if (this.geminiEnabled) {
      this.geminiUI = new GeminiEffectsUI(this.geminiClient);
      console.log('✨ Gemini Artistic API enabled');
    } else {
      console.log('⏸️ Gemini Artistic API disabled (feature flag)');
    }
  } catch (error) {
    console.warn('Failed to initialize Gemini:', error);
    this.geminiEnabled = false;
  }
}
```

**Why**: Lazy initialization allows feature flag to work, fail-safe if module import fails.

---

### Phase 2: Update Effect Order

**File**: `assets/pet-processor.js`

**Line 17** - CHANGE FROM:
```javascript
this.effectOrder = ['enhancedblackwhite', 'popart', 'dithering', 'color'];
```

**TO**:
```javascript
// NEW: Modern and Classic replace popart and dithering
this.effectOrder = ['enhancedblackwhite', 'color', 'modern', 'classic'];
```

**Why**: Modern and Classic are the new AI-powered effects replacing legacy filters.

---

### Phase 3: Reduce InSPyReNet API Call

**File**: `assets/pet-processor.js`

**Line 570** - CHANGE FROM:
```javascript
formData.append('effects', 'enhancedblackwhite,popart,dithering,color');
```

**TO**:
```javascript
// NEW: Only request B&W and Color from InSPyReNet (Modern/Classic from Gemini)
formData.append('effects', 'enhancedblackwhite,color');
```

**Line 608** - CHANGE FROM:
```javascript
const responsePromise = fetch(`${this.apiUrl}/api/v2/process-with-effects?return_all_effects=true&effects=enhancedblackwhite,popart,dithering,color`, {
```

**TO**:
```javascript
// NEW: Only request B&W and Color from InSPyReNet
const responsePromise = fetch(`${this.apiUrl}/api/v2/process-with-effects?return_all_effects=true&effects=enhancedblackwhite,color`, {
```

**Why**: Reduces InSPyReNet processing time by ~50%, saves API costs.

---

### Phase 4: Add Gemini Batch Generation Call

**File**: `assets/pet-processor.js`

**Location**: Inside `callAPI()` method, AFTER line 663 (after storing InSPyReNet results)

**INSERT NEW METHOD CALL**:
```javascript
// After line 663: return { effects, selectedEffect: 'enhancedblackwhite' };

// NEW: Call Gemini for Modern + Classic effects (non-blocking)
if (this.geminiEnabled) {
  this.callGeminiAPI(data.processed_image, effects).catch(error => {
    console.warn('Gemini API failed (non-critical):', error);
    // Fail gracefully - user still has B&W and Color
  });
}

return {
  effects,
  selectedEffect: 'enhancedblackwhite',
  processedImage: data.processed_image // NEW: Pass to Gemini
};
```

**NEW METHOD**: Add after `callAPI()` method (around line 665)

```javascript
/**
 * Call Gemini API for Modern + Classic effects
 * Runs AFTER InSPyReNet completes, non-blocking
 *
 * @param {string} processedImageBase64 - Background-removed image from InSPyReNet
 * @param {object} existingEffects - Effects object to update
 */
async callGeminiAPI(processedImageBase64, existingEffects) {
  if (!this.geminiEnabled || !this.geminiClient) {
    console.log('⏸️ Gemini disabled, skipping AI effects');
    return;
  }

  // Show progress in UI (85-95%)
  if (this.isProcessing) {
    this.updateProgressWithTimer(85, '🎨 Generating AI artistic styles...', '5-10 seconds');
  }

  const startTime = Date.now();

  try {
    // Convert base64 to data URL format
    const imageDataUrl = processedImageBase64.startsWith('data:')
      ? processedImageBase64
      : `data:image/png;base64,${processedImageBase64}`;

    // Call Gemini batch API (Modern + Classic together)
    const result = await this.geminiClient.batchGenerate(imageDataUrl, {
      sessionId: this.getSessionId()
    });

    const processingTime = Date.now() - startTime;
    console.log(`✨ Gemini generated in ${Math.round(processingTime / 1000)}s`);

    // Store Modern effect
    existingEffects.modern = {
      gcsUrl: result.modern.url,
      dataUrl: '', // Will be lazy-loaded when user selects
      cacheHit: result.modern.cacheHit,
      processingTime: result.modern.processingTime
    };

    // Store Classic effect
    existingEffects.classic = {
      gcsUrl: result.classic.url,
      dataUrl: '', // Will be lazy-loaded when user selects
      cacheHit: result.classic.cacheHit,
      processingTime: result.classic.processingTime
    };

    // Update currentPet effects if already set
    if (this.currentPet && this.currentPet.effects) {
      this.currentPet.effects = existingEffects;
    }

    // Update UI to enable Modern/Classic buttons
    this.updateGeminiEffectButtons(true);

    // Update quota UI
    if (this.geminiUI) {
      await this.geminiUI.updateUI();
    }

    // Update progress
    if (this.isProcessing) {
      this.updateProgressWithTimer(95, '✨ AI effects ready!', 'Complete');
    }

    // Log quota info
    console.log(`📊 Gemini quota: ${result.quota.remaining}/${result.quota.limit} remaining (Level ${result.quota.warningLevel})`);

  } catch (error) {
    console.error('Gemini API error:', error);

    // Handle quota exhaustion gracefully
    if (error.quotaExhausted) {
      console.warn('⚠️ Gemini quota exhausted for today');

      // Disable Modern/Classic buttons
      this.updateGeminiEffectButtons(false);

      // Show warning if UI available
      if (this.geminiUI) {
        this.geminiUI.showToast(
          '🎨 Daily AI limit reached! Try B&W or Color (unlimited)',
          'exhausted',
          6000
        );
      }
    } else {
      // Other errors - just log and continue
      console.warn('Gemini generation failed, B&W and Color still available');
    }

    // Don't throw - this is non-critical
  }
}

/**
 * Update Modern/Classic effect buttons based on availability
 *
 * @param {boolean} enabled - Whether effects are available
 */
updateGeminiEffectButtons(enabled) {
  const modernBtn = this.container.querySelector('[data-effect="modern"]');
  const classicBtn = this.container.querySelector('[data-effect="classic"]');

  [modernBtn, classicBtn].forEach(btn => {
    if (!btn) return;

    if (enabled) {
      // Enable button
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.classList.add('available');
      btn.classList.remove('loading');
    } else {
      // Disable button (quota exhausted or error)
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.classList.remove('available', 'loading');
    }
  });
}
```

**Why Sequential, Not Parallel**:
- Gemini needs the **background-removed image** from InSPyReNet
- InSPyReNet returns `processed_image` field with transparent background
- Running sequentially shows B&W + Color faster (better UX)
- Gemini runs async after, doesn't block main flow

---

### Phase 5: Update switchEffect() for Cloud Storage URLs

**File**: `assets/pet-processor.js`

**Line 709-737** - REPLACE `switchEffect()` method:

```javascript
async switchEffect(button) {
  if (!button || !this.currentPet) return;

  const effect = button.dataset.effect;
  const effectData = this.currentPet.effects[effect];

  if (!effectData) return;

  // Update UI
  this.container.querySelectorAll('.effect-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  button.classList.add('active');

  // Get image element
  const img = this.container.querySelector('.pet-image');
  if (!img) return;

  // NEW: Handle Modern/Classic differently (Cloud Storage URLs)
  const isGeminiEffect = (effect === 'modern' || effect === 'classic');

  if (isGeminiEffect && effectData.gcsUrl) {
    // Gemini effects: Use Cloud Storage URL directly
    // Lazy-load data URL if not cached
    if (!effectData.dataUrl) {
      // Show loading state
      img.classList.add('loading');

      try {
        effectData.dataUrl = await this.fetchAsDataUrl(effectData.gcsUrl);
      } catch (error) {
        console.error('Failed to load Gemini effect:', error);
        // Fallback to B&W if load fails
        const fallbackBtn = this.container.querySelector('[data-effect="enhancedblackwhite"]');
        if (fallbackBtn) this.switchEffect(fallbackBtn);
        return;
      } finally {
        img.classList.remove('loading');
      }
    }

    img.src = effectData.dataUrl;
  } else {
    // B&W and Color: Use data URL from InSPyReNet (existing logic)
    img.src = effectData.dataUrl;
  }

  // Update current selection
  this.currentPet.selectedEffect = effect;
  this.selectedEffect = effect;

  // Show share button after effect selection
  if (this.sharing) {
    this.sharing.showShareButton();
  }
}
```

**Why**: Modern/Classic are stored as Cloud Storage URLs (gcsUrl) to save bandwidth, lazy-loaded when user clicks.

---

### Phase 6: Update Progress Messages

**File**: `assets/pet-processor.js`

**Location**: Inside `setupProgressMessages()` method (existing)

**MODIFY** to include Gemini timing:

Current progress timeline assumes 80 seconds for InSPyReNet only.

**NEW** timeline with Gemini:
- 0-10%: Upload (3s)
- 10-75%: InSPyReNet processing (60-70s)
- 75-85%: Response parsing (2s)
- **85-95%**: Gemini generation (5-10s) ← NEW
- 95-100%: Finalization (1s)

**Update messages** around line 614:

```javascript
// Existing setupProgressMessages() - ADD Gemini phase

setupProgressMessages(estimatedTime) {
  // ... existing messages for InSPyReNet ...

  // NEW: Add Gemini message at 85%
  setTimeout(() => {
    if (this.isProcessing && !this.processingComplete) {
      this.updateProgressWithTimer(85, '🎨 Generating AI artistic styles...', '5-10 seconds');
    }
  }, estimatedTime * 0.85); // After InSPyReNet completes

  // Final message at 95%
  setTimeout(() => {
    if (this.isProcessing && !this.processingComplete) {
      this.updateProgressWithTimer(95, '✨ AI effects ready!', 'Almost done...');
    }
  }, estimatedTime * 0.95);
}
```

**NOTE**: Only show Gemini messages if `geminiEnabled === true`

---

### Phase 7: Initialize Gemini UI

**File**: `assets/pet-processor.js`

**Location**: Inside `showResult()` method (around line 751)

**ADD** after line 763:

```javascript
// Initialize Gemini UI if enabled
if (this.geminiEnabled && this.geminiUI && !this.geminiUI.container) {
  const effectsContainer = this.container.querySelector('.effect-grid-wrapper');
  if (effectsContainer) {
    this.geminiUI.initialize(effectsContainer);
  }
}
```

**Why**: Gemini UI needs to be initialized once result view is shown to attach banners/toasts.

---

### Phase 8: Update Effect Selector HTML

**File**: Likely `sections/ks-pet-bg-remover.liquid` or `snippets/pet-processor-ui.liquid`

**Find**: Effect grid with buttons for B&W, PopArt, Dithering, Color

**REPLACE**:
```liquid
<div class="effect-grid">
  <button class="effect-btn" data-effect="enhancedblackwhite">
    <span class="effect-name">B&W</span>
  </button>
  <button class="effect-btn" data-effect="popart">
    <span class="effect-name">PopArt</span>
  </button>
  <button class="effect-btn" data-effect="dithering">
    <span class="effect-name">Dithering</span>
  </button>
  <button class="effect-btn" data-effect="color">
    <span class="effect-name">Color</span>
  </button>
</div>
```

**WITH**:
```liquid
<div class="effect-grid">
  <!-- Unlimited effects from InSPyReNet -->
  <button class="effect-btn" data-effect="enhancedblackwhite">
    <span class="effect-name">B&W</span>
    <span class="effect-badge">Unlimited</span>
  </button>

  <button class="effect-btn" data-effect="color">
    <span class="effect-name">Color</span>
    <span class="effect-badge">Unlimited</span>
  </button>

  <!-- NEW: AI-powered effects from Gemini -->
  <button class="effect-btn loading" data-effect="modern">
    <span class="effect-name">Modern</span>
    <span class="effect-subtitle">AI Ink Wash</span>
    <!-- Badge added dynamically by gemini-effects-ui.js -->
  </button>

  <button class="effect-btn loading" data-effect="classic">
    <span class="effect-name">Classic</span>
    <span class="effect-subtitle">AI Van Gogh</span>
    <!-- Badge added dynamically by gemini-effects-ui.js -->
  </button>
</div>
```

**CSS Updates** (add to theme CSS):
```css
/* Gemini effect button states */
.effect-btn.loading {
  opacity: 0.5;
  cursor: wait;
  position: relative;
}

.effect-btn.loading::after {
  content: '⏳';
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 12px;
}

.effect-btn.available {
  opacity: 1;
  cursor: pointer;
  animation: effectReady 0.5s ease-out;
}

@keyframes effectReady {
  0% {
    transform: scale(0.95);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.effect-subtitle {
  display: block;
  font-size: 11px;
  opacity: 0.7;
  margin-top: 2px;
}

.effect-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(76, 175, 80, 0.9);
  color: white;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 600;
}

/* Image loading state */
.pet-image.loading {
  opacity: 0.5;
  animation: imagePulse 1.5s ease-in-out infinite;
}

@keyframes imagePulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}
```

---

## Error Handling Strategy

### 1. Gemini API Failures

**Scenario**: Gemini API returns 500 or times out

**Handling**:
```javascript
catch (error) {
  console.error('Gemini API error:', error);

  // Don't throw - this is non-critical
  // User still has B&W and Color effects

  // Update UI to show effects unavailable
  this.updateGeminiEffectButtons(false);

  // Show friendly message
  if (this.geminiUI) {
    this.geminiUI.showToast(
      'AI effects temporarily unavailable. Try B&W or Color!',
      'info',
      5000
    );
  }
}
```

**User Impact**: Can still use B&W and Color (unlimited), no conversion loss.

---

### 2. Quota Exhausted

**Scenario**: User hits 10 generations per day

**Handling**:
```javascript
if (error.quotaExhausted) {
  // Disable Modern/Classic buttons
  this.updateGeminiEffectButtons(false);

  // Show helpful message
  this.geminiUI.showToast(
    '🎉 You've created 10 AI masterpieces today! Try B&W or Color (unlimited)',
    'exhausted',
    6000
  );

  // Update button badges to show "0 left"
  await this.geminiUI.updateUI();
}
```

**User Impact**: Can still use B&W and Color, knows when quota resets.

---

### 3. Feature Flag Disabled

**Scenario**: `gemini_effects_enabled = false` in localStorage

**Handling**:
```javascript
// In initializeGemini()
if (!this.geminiClient.enabled) {
  console.log('⏸️ Gemini disabled via feature flag');
  this.geminiEnabled = false;

  // Don't show Modern/Classic buttons at all
  this.container.querySelectorAll('[data-effect="modern"], [data-effect="classic"]')
    .forEach(btn => btn.remove());
}
```

**User Impact**: No Modern/Classic buttons shown, only B&W and Color visible.

---

### 4. InSPyReNet Failure

**Scenario**: InSPyReNet fails, no processed_image returned

**Handling**:
```javascript
// In callGeminiAPI()
if (!processedImageBase64 || processedImageBase64.length === 0) {
  console.warn('No processed image for Gemini, skipping');
  this.updateGeminiEffectButtons(false);
  return;
}
```

**User Impact**: No effects at all if InSPyReNet fails (existing behavior).

---

## Mobile Performance Optimizations

### 1. Non-Blocking Gemini Call

**Strategy**: Show B&W + Color immediately, load Gemini async

```javascript
// DON'T await Gemini
if (this.geminiEnabled) {
  this.callGeminiAPI(data.processed_image, effects).catch(error => {
    console.warn('Gemini failed (non-critical):', error);
  });
}

// Return immediately with B&W + Color
return { effects, selectedEffect: 'enhancedblackwhite' };
```

**Impact**: Users see results ~50% faster (InSPyReNet only, not waiting for Gemini).

---

### 2. Lazy-Load Cloud Storage URLs

**Strategy**: Only fetch full image when user clicks Modern/Classic

```javascript
// Store only URL initially
existingEffects.modern = {
  gcsUrl: result.modern.url,
  dataUrl: '', // Empty until user clicks
};

// Fetch on demand in switchEffect()
if (!effectData.dataUrl && effectData.gcsUrl) {
  effectData.dataUrl = await this.fetchAsDataUrl(effectData.gcsUrl);
}
```

**Impact**: Saves ~2-4MB of bandwidth if user doesn't view all effects.

---

### 3. Progressive UI Updates

**Strategy**: Update UI as effects become available

```javascript
// After InSPyReNet completes
this.showResult(result); // Show B&W + Color

// After Gemini completes
this.updateGeminiEffectButtons(true); // Enable Modern + Classic
```

**Impact**: Perceived performance improvement, users can start interacting sooner.

---

### 4. Quota Pre-Check

**Strategy**: Check quota before making Gemini call

```javascript
// In callGeminiAPI()
const quota = await this.geminiClient.checkQuota();
if (!quota.allowed || quota.remaining < 1) {
  console.log('⏸️ Quota exhausted, skipping Gemini');
  this.updateGeminiEffectButtons(false);
  return;
}
```

**Impact**: Saves API call if quota exhausted, faster feedback.

---

## Testing Strategy

### 1. Unit Tests (Local HTML)

Create `testing/gemini-integration-test.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Gemini Integration Test</title>
</head>
<body>
  <h1>Gemini Integration Test</h1>

  <div id="test-results">
    <h2>Test Cases</h2>
    <ul id="test-list"></ul>
  </div>

  <script type="module">
    import { GeminiAPIClient } from '../assets/gemini-api-client.js';

    const tests = [];

    // Test 1: Feature flag disabled
    tests.push(async () => {
      localStorage.setItem('gemini_effects_enabled', 'false');
      const client = new GeminiAPIClient();
      console.assert(!client.enabled, 'Feature flag disabled should work');
      return 'Feature flag disabled: PASS';
    });

    // Test 2: Feature flag enabled
    tests.push(async () => {
      localStorage.setItem('gemini_effects_enabled', 'true');
      localStorage.setItem('gemini_rollout_percent', '100');
      const client = new GeminiAPIClient();
      console.assert(client.enabled, 'Feature flag enabled should work');
      return 'Feature flag enabled: PASS';
    });

    // Test 3: Quota check
    tests.push(async () => {
      const client = new GeminiAPIClient();
      const quota = await client.checkQuota();
      console.assert(quota.remaining >= 0, 'Quota check should return valid data');
      return `Quota check: PASS (${quota.remaining}/${quota.limit})`;
    });

    // Run tests
    for (const test of tests) {
      const result = await test();
      const li = document.createElement('li');
      li.textContent = result;
      document.getElementById('test-list').appendChild(li);
    }
  </script>
</body>
</html>
```

---

### 2. Integration Tests (Playwright MCP)

**Test Scenarios**:

1. **Happy Path**: Upload → See B&W + Color → Modern + Classic appear → Click Modern → See AI effect
2. **Quota Exhausted**: Generate 10 times → See quota warnings → 11th shows "0 left" badge
3. **Feature Flag Off**: Disable flag → Upload → Only see B&W + Color buttons
4. **Gemini Failure**: Mock API error → See B&W + Color still work → Modern + Classic disabled
5. **Mobile Flow**: Test on mobile viewport → Verify progress messages → Check touch interactions

---

### 3. Manual Testing Checklist

**Desktop**:
- [ ] Upload image → See B&W + Color immediately
- [ ] Wait 5s → See Modern + Classic buttons enable
- [ ] Click Modern → See AI ink wash effect
- [ ] Click Classic → See AI Van Gogh effect
- [ ] Click B&W → Switch back to B&W
- [ ] Check quota badge shows "X left"

**Mobile** (70% of traffic):
- [ ] Upload image → Progress bar shows InSPyReNet phase
- [ ] See "Generating AI artistic styles..." message
- [ ] B&W + Color appear first
- [ ] Modern + Classic load after ~5s
- [ ] Tap Modern → No lag, smooth transition
- [ ] Quota toast appears at appropriate levels
- [ ] Buttons are thumb-friendly (44px+ hit areas)

**Error Cases**:
- [ ] Disable Gemini API → Only B&W + Color show
- [ ] Exhaust quota → See "0 left" badge, buttons disabled
- [ ] Slow network → See loading state on Modern/Classic buttons
- [ ] Click Modern before loaded → See loading spinner

---

## Rollout Strategy

### Phase 1: Dark Launch (0% Traffic)
**Action**: Deploy code with feature flag disabled globally

```javascript
// In Shopify theme settings or localStorage
localStorage.setItem('gemini_effects_enabled', 'false');
```

**Verification**:
- Confirm Modern + Classic buttons don't appear
- Confirm only B&W + Color effects work
- Confirm no Gemini API calls in network tab

**Duration**: 1-2 days

---

### Phase 2: Internal Testing (1% Traffic)
**Action**: Enable for test accounts only

```javascript
// For specific customer IDs or internal IPs
localStorage.setItem('gemini_rollout_percent', '1');
```

**Verification**:
- Test all scenarios on mobile and desktop
- Monitor Gemini API logs for errors
- Check quota system works correctly
- Verify cost per generation (~$0.15-0.30)

**Duration**: 3-5 days

---

### Phase 3: Limited Rollout (10% Traffic)
**Action**: Gradual rollout to 10% of sessions

```javascript
localStorage.setItem('gemini_rollout_percent', '10');
```

**Metrics to Track**:
- Gemini API success rate (target: >95%)
- Average generation time (target: <10s)
- Quota exhaustion rate (how many hit 10/day)
- Conversion impact (does Modern/Classic increase sales?)
- Error rate (should be <1%)

**Duration**: 1 week

---

### Phase 4: Full Rollout (100% Traffic)
**Action**: Enable for all users

```javascript
localStorage.setItem('gemini_rollout_percent', '100');
```

**Monitoring**:
- Daily Gemini API costs
- Quota distribution (how many users hit limits)
- Conversion lift from AI effects
- Customer feedback on Modern/Classic quality

---

## Cost Analysis

### Gemini API Pricing
- **Model**: gemini-2.5-flash-image
- **Cost per image**: ~$0.15-0.30 per generation
- **Quota**: 10 generations/customer/day
- **Expected usage**: 100-200 generations/day (assuming 10-20 daily active users)

**Daily Cost Estimate**:
- Low traffic (100 gen/day): $15-30/day = $450-900/month
- Medium traffic (500 gen/day): $75-150/day = $2,250-4,500/month
- High traffic (1000 gen/day): $150-300/day = $4,500-9,000/month

**Mitigation**:
- Rate limiting (10/day) caps per-user costs
- Caching (SHA256 dedup) reduces redundant generations
- Feature flag allows instant shutdown if costs spike
- min-instances: 0 means no idle costs

---

## Monitoring & Alerts

### Key Metrics

**API Performance**:
```
- Gemini API success rate (target: >95%)
- Average generation time (target: <10s)
- Cache hit rate (target: >30%)
- Error rate by type (quota vs API vs network)
```

**Business Metrics**:
```
- Conversion rate with AI effects vs without
- Average order value with AI effects
- Customer retention with AI effects
- Quota exhaustion rate (how many hit 10/day)
```

**Cost Metrics**:
```
- Daily Gemini API spend
- Cost per conversion (AI effects)
- ROI of AI effects (revenue lift vs cost)
```

### Alert Thresholds

**Critical**:
- Gemini API error rate >5% for 10 minutes
- Daily cost exceeds $300 (budget cap)
- Success rate <90% for 30 minutes

**Warning**:
- Generation time >15s average for 1 hour
- Cache hit rate <20% (poor efficiency)
- Daily cost exceeds $200 (80% of budget)

---

## Rollback Plan

### Instant Disable (Feature Flag)

**If issues arise**, disable Gemini instantly:

```javascript
// Global disable
GeminiAPIClient.disableGlobalFlag();

// Or set in theme settings
localStorage.setItem('gemini_effects_enabled', 'false');
```

**User Impact**: Modern + Classic buttons disappear, B&W + Color still work.

**Time to Rollback**: <1 minute (no code deploy needed).

---

### Full Code Revert

**If feature flag isn't sufficient**:

1. Revert git commit
2. Push to main branch
3. Auto-deploys to Shopify test environment

**Time to Rollback**: ~5 minutes (deploy time).

---

## Success Criteria

### Technical Success
- [ ] Gemini API integration works on mobile and desktop
- [ ] B&W + Color effects appear <15s (InSPyReNet only)
- [ ] Modern + Classic appear <25s (InSPyReNet + Gemini)
- [ ] Quota system prevents abuse (10/day limit)
- [ ] Error rate <1%
- [ ] Mobile performance: no jank, smooth interactions

### Business Success
- [ ] Conversion rate increase >2% (with AI effects)
- [ ] Customer feedback positive (survey or reviews)
- [ ] ROI positive (revenue lift > Gemini API costs)
- [ ] Daily cost within budget (<$300/day)

### User Experience Success
- [ ] Modern/Classic quality meets expectations
- [ ] Quota warnings are clear and helpful
- [ ] Users understand difference between unlimited (B&W/Color) and limited (Modern/Classic)
- [ ] No negative reviews about AI effects

---

## Files to Modify

### JavaScript
1. **assets/pet-processor.js** (PRIMARY)
   - Import Gemini modules (top of file)
   - Update effectOrder (line 17)
   - Reduce InSPyReNet effects (lines 570, 608)
   - Add callGeminiAPI() method (after line 665)
   - Update switchEffect() for Cloud Storage URLs (line 709)
   - Update progress messages (line 614)
   - Initialize Gemini UI (line 763)

### HTML/Liquid
2. **sections/ks-pet-bg-remover.liquid** OR **snippets/pet-processor-ui.liquid**
   - Update effect grid to show Modern + Classic buttons
   - Add loading states and badges
   - Remove PopArt and Dithering buttons

### CSS
3. **assets/pet-processor.css** OR theme CSS file
   - Add Gemini button styles (loading, available states)
   - Add effect subtitle styles
   - Add image loading animation
   - Add badge styles

### Testing
4. **testing/gemini-integration-test.html** (NEW)
   - Unit tests for Gemini integration
   - Feature flag tests
   - Quota check tests

---

## Implementation Timeline

**Total Estimated Time**: 8-12 hours

**Phase 1**: Import and Initialize (1-2 hours)
- Add imports and initialization
- Test feature flag system

**Phase 2**: Update API Calls (2-3 hours)
- Reduce InSPyReNet effects
- Add Gemini batch generation
- Test sequential flow

**Phase 3**: Update UI (2-3 hours)
- Modify effect buttons HTML
- Update switchEffect() logic
- Add CSS styles

**Phase 4**: Testing (2-3 hours)
- Unit tests
- Integration tests with Playwright MCP
- Manual mobile testing

**Phase 5**: Deployment (1 hour)
- Dark launch (0% rollout)
- Monitor logs
- Gradual rollout to 1%, 10%, 100%

---

## Dependencies

### External Services
- **Gemini Artistic API**: https://gemini-artistic-api-753651513695.us-central1.run.app
- **InSPyReNet API**: https://inspirenet-bg-removal-api-725543555429.us-central1.run.app (existing)
- **Cloud Storage**: gs://perkieprints-processing-cache

### Frontend Modules
- **gemini-api-client.js**: Already built ✅
- **gemini-effects-ui.js**: Already built ✅

### Backend Services
- **Gemini API**: Deployed and tested ✅
- **Firestore**: Rate limiting database ✅
- **Cloud Storage**: Image caching ✅

---

## Known Limitations

1. **Quota System**: 10 generations per customer per day
   - **Mitigation**: Clear messaging, unlimited B&W + Color fallback

2. **Cold Start Latency**: First Gemini call may take 30-60s
   - **Mitigation**: Show progress messages, cache results

3. **Mobile Bandwidth**: Loading Cloud Storage URLs consumes data
   - **Mitigation**: Lazy-load only when user clicks effect

4. **Browser Compatibility**: Requires ES6+ (modules, async/await)
   - **Mitigation**: Already using ES6 in pet-processor.js

5. **Cost Uncertainty**: Usage patterns may exceed budget
   - **Mitigation**: Feature flag allows instant shutdown, rate limiting caps per-user cost

---

## Open Questions

### 1. Where exactly is the effect grid HTML?

**Need to locate**:
- `sections/ks-pet-bg-remover.liquid`?
- `snippets/pet-processor-ui.liquid`?
- Inline in template?

**Action**: Search codebase for effect button HTML.

---

### 2. Should we cache data URLs in localStorage?

**Pros**:
- Faster repeat views
- Reduces Cloud Storage API calls

**Cons**:
- localStorage size limits (5-10MB)
- Stale data if image changes

**Recommendation**: No caching for now, revisit if performance issues.

---

### 3. Should Gemini call be truly parallel with InSPyReNet?

**Current plan**: Sequential (InSPyReNet first, then Gemini)

**Alternative**: Parallel (both at same time)

**Pros of parallel**:
- Potentially faster total time

**Cons of parallel**:
- Gemini needs background-removed image from InSPyReNet
- Can't run truly parallel without uploading original to Gemini (wastes quota)

**Decision**: Keep sequential as planned.

---

### 4. How to handle "processed_image" field from InSPyReNet?

**Current response** (line 626):
```javascript
const data = await response.json();
// data.effects = { enhancedblackwhite: "base64...", color: "base64..." }
```

**Need to confirm**:
- Does response include `data.processed_image` field?
- Is it the background-removed image?
- Is it base64 or data URL?

**Action**: Test InSPyReNet API response structure.

---

### 5. Should we show quota remaining in UI?

**Options**:
1. Show quota badge on every upload
2. Show quota only at warning levels (6 remaining, 3 remaining, 0 remaining)
3. Show quota in settings/account area

**Recommendation**: Option 2 (gemini-effects-ui.js already implements this).

---

## Next Steps

### Before Implementation

1. **Locate effect grid HTML**:
   ```bash
   grep -r "effect-btn" sections/ snippets/
   ```

2. **Test InSPyReNet response structure**:
   - Confirm `processed_image` field exists
   - Verify format (base64 vs data URL)

3. **Enable Gemini feature flag for testing**:
   ```javascript
   localStorage.setItem('gemini_effects_enabled', 'true');
   localStorage.setItem('gemini_rollout_percent', '100');
   ```

4. **Review with solution-verification-auditor**:
   - Confirm approach is sound
   - Identify any missed edge cases
   - Validate error handling strategy

---

### During Implementation

1. **Test each phase independently**:
   - Phase 1: Imports work, no errors
   - Phase 2: InSPyReNet reduced to 2 effects
   - Phase 3: Gemini call executes (even if fails)
   - Phase 4: UI updates correctly

2. **Use console logging extensively**:
   ```javascript
   console.log('✅ Gemini initialized:', this.geminiEnabled);
   console.log('🎨 Calling Gemini with image:', processedImageBase64.length);
   console.log('📊 Quota:', result.quota);
   ```

3. **Test on actual mobile device**:
   - Not just responsive mode
   - Real 3G/4G network
   - Touch interactions

---

### After Implementation

1. **Monitor Gemini API logs** (Google Cloud Console)
2. **Track costs daily** (billing dashboard)
3. **Gather user feedback** (surveys, reviews)
4. **A/B test conversion impact** (with vs without AI effects)
5. **Optimize based on data** (adjust quota, caching strategy, etc.)

---

## Conclusion

This implementation plan provides a **mobile-first, gracefully degrading** integration of Gemini Artistic API into the existing pet processor. The key principles are:

1. **Non-blocking**: Show B&W + Color immediately, Gemini loads in background
2. **Fail-safe**: If Gemini fails, users still have unlimited B&W + Color
3. **Cost-controlled**: 10/day quota with caching prevents runaway costs
4. **Feature-flagged**: Can disable instantly if issues arise
5. **Mobile-optimized**: Lazy-loading, progressive feedback, smooth interactions

The plan is **ready for implementation** with clear code changes, testing strategy, and rollout phases.

---

**Total Lines of Code to Change**: ~200 lines
**Estimated Implementation Time**: 8-12 hours
**Risk Level**: Low (fail-safe design, feature flag control)
**Expected Impact**: 2-5% conversion lift, enhanced brand differentiation

---

**Author**: Mobile Commerce Architect Agent
**Date**: 2025-10-30
**Version**: 1.0
**Status**: Ready for Review → Implementation
