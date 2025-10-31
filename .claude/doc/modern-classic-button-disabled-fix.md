# Root Cause Analysis: Modern & Classic Buttons Disabled on Page Refresh

**Date**: 2025-10-31
**Issue**: Modern and Classic effect buttons remain disabled after page refresh
**Environment**: Shopify test URL with Gemini Artistic API integration
**Status**: Root cause identified, fix proposed

---

## Executive Summary

The Modern and Classic buttons are disabled on page refresh because **the feature flag check happens only once during GeminiAPIClient initialization**, which occurs during PetProcessor construction. On page refresh, there is **no session restoration logic** that re-enables Gemini effects or checks if the feature flag has changed.

**Impact**: Users who refresh the page lose access to Modern/Classic effects even though:
1. The backend API is working perfectly
2. The feature flag is enabled in localStorage
3. Their quota has remaining credits

**Root Cause**: Missing session restoration logic for Gemini integration state.

---

## Technical Analysis

### 1. Initialization Flow on Fresh Page Load

**File**: `assets/pet-processor.js`
**Lines**: 239-325

```javascript
class PetProcessor {
  constructor(sectionId) {
    // ... initialization ...
    this.geminiClient = null;
    this.geminiUI = null;
    this.geminiEnabled = false;

    this.init();
  }

  async init() {
    this.render();
    this.bindEvents();
    this.initializeFeatures();  // ← Calls initializeGemini()
  }

  initializeGemini() {
    // Check if modules loaded
    if (typeof GeminiAPIClient === 'undefined' || typeof GeminiEffectsUI === 'undefined') {
      console.log('🎨 Gemini modules not loaded - AI effects disabled');
      return;
    }

    // Initialize client (feature flag checked in constructor)
    this.geminiClient = new GeminiAPIClient();
    this.geminiEnabled = this.geminiClient.enabled;  // ← ONE-TIME CHECK

    if (this.geminiEnabled) {
      this.geminiUI = new GeminiEffectsUI(this.geminiClient);
      this.geminiUI.initialize(this.container);
    }
  }
}
```

**Key Issue**: `this.geminiEnabled` is set **once** during initialization and **never rechecked**.

---

### 2. Feature Flag Check in GeminiAPIClient

**File**: `assets/gemini-api-client.js`
**Lines**: 40-60

```javascript
class GeminiAPIClient {
  constructor() {
    // ...
    this.enabled = this.checkFeatureFlag();  // ← ONE-TIME CHECK
    // ...
  }

  checkFeatureFlag() {
    try {
      // 1. Global enable/disable
      const globalFlag = localStorage.getItem('gemini_effects_enabled');
      if (globalFlag === 'false') return false;

      // 2. Gradual rollout percentage
      const rolloutPercent = parseInt(localStorage.getItem('gemini_rollout_percent') || '0', 10);
      if (rolloutPercent === 0) return false;
      if (rolloutPercent === 100) return true;

      // 3. Session-based deterministic rollout
      const sessionHash = this.hashCustomerId(this.getOrCreateCustomerId());
      const inRollout = (sessionHash % 100) < rolloutPercent;

      return inRollout;
    } catch (error) {
      console.error('Feature flag check failed:', error);
      return false; // Fail closed
    }
  }
}
```

**Key Issue**: Feature flag is checked **only in constructor**, not on every operation.

---

### 3. Page Refresh Flow (Current Behavior)

**What happens when user refreshes page:**

1. **PetProcessor initializes** (lines 239-278)
   - Sets `this.geminiEnabled = false` initially
   - Calls `init()` → `initializeFeatures()` → `initializeGemini()`

2. **initializeGemini() executes** (lines 295-325)
   - Creates new `GeminiAPIClient()`
   - Client checks feature flag in constructor
   - **PROBLEM**: If `gemini_rollout_percent = 0` (default), `enabled = false`

3. **No session restoration**
   - Previous session had Gemini effects generated
   - But new page load doesn't restore Gemini state
   - Modern/Classic buttons rendered as disabled

4. **Button state logic** (lines 878-925)
   ```javascript
   updateEffectButtonStates() {
     buttons.forEach(btn => {
       const effect = btn.dataset.effect;

       // Gemini effects (Modern and Classic)
       if (effect === 'modern' || effect === 'classic') {
         const effectData = this.currentPet.effects[effect];

         if (!effectData) {
           // Not loaded yet
           if (this.geminiEnabled && this.geminiClient) {
             const quotaExhausted = this.geminiClient.isQuotaExhausted();

             if (quotaExhausted) {
               btn.disabled = true;
               btn.classList.add('effect-btn--disabled');
             } else {
               btn.disabled = true;
               btn.classList.add('effect-btn--loading');
             }
           } else {
             // Gemini disabled - disable button
             btn.disabled = true;  // ← THIS IS THE PROBLEM
             btn.classList.add('effect-btn--disabled');
           }
         }
       }
     });
   }
   ```

   **Why buttons stay disabled:**
   - `this.geminiEnabled = false` (feature flag default)
   - `effectData` doesn't exist (no session restoration)
   - Button is disabled with class `effect-btn--disabled`

---

### 4. Missing Session Restoration Logic

**Current state**: There is **no code** that restores previous session data from localStorage on page refresh.

**Evidence from code review**:

- **pet-processor.js** has no `restore()` method
- **session.js** exists but is not used by PetProcessor
- **PetStorage** exists but only stores pet data, not UI state
- **No initialization hook** checks for existing pets in localStorage

**What should happen on refresh:**
1. Check localStorage for existing pet sessions
2. Restore `currentPet` object with all effects
3. Re-enable buttons based on available effects
4. Update UI to show last selected effect

---

### 5. localStorage Keys Involved

**Gemini Feature Flags**:
```javascript
localStorage.getItem('gemini_effects_enabled')      // 'true' or 'false'
localStorage.getItem('gemini_rollout_percent')      // '0' to '100'
localStorage.getItem('gemini_customer_id')          // Customer ID for rate limiting
```

**Pet Data**:
```javascript
localStorage.getItem('pet_session_pet-bg-remover')  // Session data
localStorage.getItem('perkieEffects_selected')      // Selected effects
localStorage.getItem('perkie_pet_[petId]')         // Individual pet data
```

**Current Problem**:
- Feature flags are checked but **default to 0% rollout**
- Pet data exists in localStorage but **not restored on refresh**
- Gemini quota state exists but **not synced with UI**

---

## Root Cause Statement

**Primary Root Cause**: **Missing session restoration logic on page initialization**

When the page refreshes:
1. `PetProcessor` creates a new instance with `currentPet = null`
2. No code checks localStorage for previously processed pets
3. `initializeGemini()` runs but finds no pet data to work with
4. Modern/Classic buttons are disabled because `effectData` is missing
5. Even if feature flag is enabled, buttons stay disabled because there's no pet loaded

**Secondary Root Cause**: **Feature flag defaults to 0% rollout**

The feature flag check happens in `GeminiAPIClient` constructor:
```javascript
const rolloutPercent = parseInt(localStorage.getItem('gemini_rollout_percent') || '0', 10);
if (rolloutPercent === 0) return false;  // ← Defaults to disabled
```

This means unless explicitly set to 100%, Gemini is disabled on every refresh.

---

## State Management Flow Diagram

```
Page Refresh
    ↓
PetProcessor.constructor()
    ↓
init()
    ↓
initializeFeatures()
    ↓
initializeGemini()
    ↓
new GeminiAPIClient()
    ↓
checkFeatureFlag()
    ├── localStorage.getItem('gemini_rollout_percent') → "0" (default)
    ↓
this.geminiEnabled = false
    ↓
updateEffectButtonStates()
    ├── effectData missing (no session restoration)
    ├── geminiEnabled = false
    ↓
Modern/Classic buttons DISABLED ❌
```

**Expected Flow (with fix):**
```
Page Refresh
    ↓
PetProcessor.constructor()
    ↓
restoreSession()  ← NEW METHOD
    ├── Load pet data from PetStorage
    ├── Restore currentPet with all effects
    ├── Check which effects are available
    ↓
initializeGemini()
    ├── Recheck feature flag
    ├── Restore quota state from localStorage
    ↓
updateEffectButtonStates()
    ├── effectData exists (restored from storage)
    ├── Enable buttons based on available effects
    ↓
Modern/Classic buttons ENABLED ✅
```

---

## Proposed Solution

### Phase 1: Add Session Restoration (Critical Fix)

**File**: `assets/pet-processor.js`
**Location**: After `init()` method (around line 278)

**New method to add**:
```javascript
/**
 * Restore previous session from localStorage
 * Called during initialization to recover pet data after refresh
 */
async restoreSession() {
  try {
    // Get all pets from PetStorage
    const allPets = PetStorage.getAll();
    const petIds = Object.keys(allPets);

    if (petIds.length === 0) {
      console.log('🔄 No session to restore');
      return;
    }

    // Get most recent pet (by timestamp)
    const sortedPets = petIds
      .map(id => ({ id, data: allPets[id] }))
      .sort((a, b) => (b.data.timestamp || 0) - (a.data.timestamp || 0));

    const latestPet = sortedPets[0];

    console.log('🔄 Restoring session:', latestPet.id);

    // Reconstruct currentPet object
    this.currentPet = {
      id: latestPet.id,
      filename: latestPet.data.filename,
      originalUrl: latestPet.data.originalUrl,
      effects: {},
      selectedEffect: latestPet.data.effect || 'enhancedblackwhite'
    };

    // Restore effect data
    // For InSPyReNet effects (B&W, Color) - thumbnail is data URL
    // For Gemini effects (Modern, Classic) - thumbnail might be GCS URL
    if (latestPet.data.effect) {
      const effectName = latestPet.data.effect;

      if (effectName === 'modern' || effectName === 'classic') {
        // Gemini effect - use gcsUrl
        this.currentPet.effects[effectName] = {
          gcsUrl: latestPet.data.gcsUrl || latestPet.data.thumbnail,
          dataUrl: null,
          cacheHit: true
        };
      } else {
        // InSPyReNet effect - use dataUrl
        this.currentPet.effects[effectName] = {
          gcsUrl: latestPet.data.gcsUrl || '',
          dataUrl: latestPet.data.thumbnail,
          cacheHit: true
        };
      }
    }

    // Check if other effects exist in localStorage
    // Modern effect
    const modernKey = `${latestPet.id}_modern`;
    const modernData = localStorage.getItem(modernKey);
    if (modernData && !this.currentPet.effects.modern) {
      this.currentPet.effects.modern = {
        gcsUrl: modernData.startsWith('http') ? modernData : null,
        dataUrl: modernData.startsWith('data:') ? modernData : null,
        cacheHit: true
      };
    }

    // Classic effect
    const classicKey = `${latestPet.id}_classic`;
    const classicData = localStorage.getItem(classicKey);
    if (classicData && !this.currentPet.effects.classic) {
      this.currentPet.effects.classic = {
        gcsUrl: classicData.startsWith('http') ? classicData : null,
        dataUrl: classicData.startsWith('data:') ? classicData : null,
        cacheHit: true
      };
    }

    // Show result view with restored data
    this.showResult({ effects: this.currentPet.effects });

    // Update button states (will enable Modern/Classic if data exists)
    this.updateEffectButtonStates();

    // Set initial image
    const img = this.container.querySelector('.pet-image');
    if (img) {
      const selectedEffect = this.currentPet.effects[this.currentPet.selectedEffect];
      if (selectedEffect) {
        img.src = selectedEffect.gcsUrl || selectedEffect.dataUrl;
      }
    }

    console.log('✅ Session restored with effects:', Object.keys(this.currentPet.effects));

  } catch (error) {
    console.error('❌ Session restoration failed:', error);
    // Non-critical - just start fresh
  }
}
```

**Integration point**:
```javascript
async init() {
  if (!this.container) {
    console.error('🐾 Cannot initialize PetProcessor - no container found');
    return;
  }

  // Render UI
  this.render();

  // Bind events
  this.bindEvents();

  // Restore previous session if exists
  await this.restoreSession();  // ← ADD THIS LINE

  // Initialize features
  this.initializeFeatures();
}
```

---

### Phase 2: Fix Feature Flag Default (Configuration Fix)

**File**: `assets/gemini-api-client.js`
**Lines**: 48-49

**Current code**:
```javascript
const rolloutPercent = parseInt(localStorage.getItem('gemini_rollout_percent') || '0', 10);
if (rolloutPercent === 0) return false;
```

**Issue**: Defaults to 0% = disabled

**Fix Option A: Change Default to 100% (Aggressive)**
```javascript
const rolloutPercent = parseInt(localStorage.getItem('gemini_rollout_percent') || '100', 10);
```

**Fix Option B: Check if Key Exists (Conservative)**
```javascript
const rolloutKey = localStorage.getItem('gemini_rollout_percent');
// If key doesn't exist, enable by default (opt-out model)
const rolloutPercent = rolloutKey !== null ? parseInt(rolloutKey, 10) : 100;
```

**Fix Option C: Two-Stage Flag (Recommended)**
```javascript
// 1. Check explicit disable flag
const globalFlag = localStorage.getItem('gemini_effects_enabled');
if (globalFlag === 'false') return false;

// 2. If not explicitly disabled, check rollout percent (default 100%)
const rolloutKey = localStorage.getItem('gemini_rollout_percent');
if (rolloutKey === null) {
  // No rollout percent set - enable for everyone (opt-out model)
  return true;
}

const rolloutPercent = parseInt(rolloutKey, 10);
if (rolloutPercent === 0) return false;
if (rolloutPercent === 100) return true;

// 3. Session-based deterministic rollout
const sessionHash = this.hashCustomerId(this.getOrCreateCustomerId());
return (sessionHash % 100) < rolloutPercent;
```

**Recommendation**: Use Fix Option C - this creates an **opt-out** model where:
- Gemini is enabled by default for all users
- Can be disabled by setting `gemini_effects_enabled = 'false'`
- Can be gradually rolled out by setting `gemini_rollout_percent = '10'`

---

### Phase 3: Improve Button State Logic (Enhancement)

**File**: `assets/pet-processor.js`
**Lines**: 878-925

**Current logic** disables buttons if `!effectData`. This is too aggressive.

**Improved logic**:
```javascript
updateEffectButtonStates() {
  if (!this.currentPet) {
    // No pet loaded - disable all Gemini buttons
    buttons.forEach(btn => {
      if (btn.dataset.effect === 'modern' || btn.dataset.effect === 'classic') {
        btn.disabled = true;
        btn.classList.add('effect-btn--disabled');
      }
    });
    return;
  }

  buttons.forEach(btn => {
    const effect = btn.dataset.effect;

    // Always enable B&W and Color (unlimited)
    if (effect === 'enhancedblackwhite' || effect === 'color') {
      btn.disabled = false;
      btn.classList.remove('effect-btn--loading', 'effect-btn--disabled');
      return;
    }

    // Handle Gemini effects (Modern and Classic)
    if (effect === 'modern' || effect === 'classic') {
      const effectData = this.currentPet.effects[effect];

      if (effectData) {
        // Effect loaded - enable button
        btn.disabled = false;
        btn.classList.remove('effect-btn--loading', 'effect-btn--disabled');
      } else {
        // Effect not loaded - check why
        if (!this.geminiEnabled) {
          // Gemini disabled globally - hide or disable button
          btn.disabled = true;
          btn.classList.add('effect-btn--disabled');
          btn.title = 'AI effects not available';
        } else if (this.geminiClient && this.geminiClient.isQuotaExhausted()) {
          // Quota exhausted - disable with helpful message
          btn.disabled = true;
          btn.classList.add('effect-btn--disabled');
          btn.title = 'Daily AI limit reached';
        } else if (this.isProcessing) {
          // Still processing - show loading state
          btn.disabled = true;
          btn.classList.add('effect-btn--loading');
          btn.title = 'Generating AI effect...';
        } else {
          // Effect missing but should be available - try to regenerate
          btn.disabled = false;  // ← Allow clicking to trigger generation
          btn.classList.add('effect-btn--regenerate');
          btn.title = 'Click to generate AI effect';
        }
      }
    }
  });
}
```

**Additional handler for regeneration**:
```javascript
// In bindEvents() method
this.container.querySelectorAll('.effect-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const button = e.target.closest('.effect-btn');
    const effect = button.dataset.effect;

    // If Modern/Classic button clicked and effect missing, regenerate
    if ((effect === 'modern' || effect === 'classic') &&
        !this.currentPet?.effects[effect] &&
        this.geminiEnabled) {
      await this.regenerateGeminiEffect(effect);
    } else {
      this.switchEffect(button);
    }
  });
});
```

---

## Implementation Plan

### Step 1: Add Session Restoration (Priority: Critical)

**Files to modify**:
- `assets/pet-processor.js`

**Changes**:
1. Add `restoreSession()` method after line 278
2. Call `await this.restoreSession()` in `init()` method before `initializeFeatures()`
3. Ensure `PetStorage.getAll()` returns pet data with timestamps

**Testing**:
- Upload a pet with Modern/Classic effects
- Refresh the page
- Verify Modern/Classic buttons are enabled
- Verify clicking buttons switches between effects

---

### Step 2: Fix Feature Flag Default (Priority: High)

**Files to modify**:
- `assets/gemini-api-client.js`

**Changes**:
1. Update `checkFeatureFlag()` to use opt-out model (default enabled)
2. Document flag behavior in code comments

**Testing**:
- Clear localStorage
- Refresh page
- Verify Gemini is enabled by default
- Set `gemini_effects_enabled = 'false'`
- Verify Gemini is disabled

---

### Step 3: Improve Button State Logic (Priority: Medium)

**Files to modify**:
- `assets/pet-processor.js`

**Changes**:
1. Update `updateEffectButtonStates()` with improved logic
2. Add regeneration capability for missing effects
3. Add better tooltips and user feedback

**Testing**:
- Test all button state transitions
- Test regeneration flow
- Test quota exhaustion behavior

---

## Edge Cases to Handle

### 1. Gemini Effect Exists But Image URL Expired

**Scenario**: Pet data restored but GCS URL returns 403/404

**Handling**:
```javascript
// In switchEffect() method
if (effect === 'modern' || effect === 'classic') {
  // Test if URL is still valid
  const testImg = new Image();
  testImg.onerror = () => {
    // URL expired - regenerate
    this.regenerateGeminiEffect(effect);
  };
  testImg.src = effectData.gcsUrl;
}
```

---

### 2. Session Restored But Quota Exhausted

**Scenario**: User had 10/10 uses yesterday, page refreshes today (quota reset)

**Handling**:
```javascript
// In restoreSession() method
if (this.geminiEnabled && this.geminiClient) {
  // Refresh quota state from API
  await this.geminiClient.checkQuota();

  // Update UI with current quota
  if (this.geminiUI) {
    this.geminiUI.updateUI();
  }
}
```

---

### 3. Multiple Pets in localStorage

**Scenario**: User processed 3 pets, refreshes page - which one to restore?

**Current solution**: Restore most recent by timestamp

**Better solution**: Store "active pet" ID in sessionStorage
```javascript
// When pet is selected
sessionStorage.setItem('active_pet_id', petId);

// In restoreSession()
const activePetId = sessionStorage.getItem('active_pet_id');
if (activePetId && allPets[activePetId]) {
  // Restore specific pet
} else {
  // Restore most recent
}
```

---

### 4. Feature Flag Changed After Session Creation

**Scenario**: Session created with Gemini enabled, flag changed to disabled, page refreshes

**Handling**:
```javascript
// In updateEffectButtonStates()
if (effectData && (effect === 'modern' || effect === 'classic')) {
  // Even if Gemini is disabled now, keep existing effects accessible
  // (don't take away what user already generated)
  btn.disabled = false;
  btn.title = 'Previously generated AI effect';
}
```

---

## Success Criteria

### Critical Success Metrics

1. **Button State Persistence**
   - Modern/Classic buttons remain enabled after page refresh
   - Buttons reflect actual effect availability (not just feature flag)

2. **Session Restoration**
   - Most recent pet is restored on page refresh
   - All generated effects are accessible after refresh
   - Selected effect is remembered

3. **Feature Flag Behavior**
   - Default behavior is opt-out (enabled unless explicitly disabled)
   - Flag changes take effect immediately (no page refresh needed)

### Nice-to-Have Metrics

1. **Performance**
   - Session restoration completes in <100ms
   - No unnecessary API calls on refresh

2. **User Experience**
   - Clear loading states for regeneration
   - Helpful tooltips explain button states
   - Graceful degradation if effects missing

---

## Testing Checklist

### Pre-Implementation Testing

- [ ] Document current localStorage state before changes
- [ ] Screenshot current button state after refresh
- [ ] Test quota API response after refresh

### Post-Implementation Testing

**Session Restoration**:
- [ ] Fresh pet upload → refresh → buttons enabled
- [ ] Multiple pets → refresh → most recent restored
- [ ] Expired GCS URLs → refresh → graceful fallback

**Feature Flags**:
- [ ] Clear localStorage → buttons enabled (opt-out model)
- [ ] Set `gemini_effects_enabled = 'false'` → buttons disabled
- [ ] Set `gemini_rollout_percent = '50'` → deterministic rollout

**Button States**:
- [ ] Quota exhausted → buttons disabled with helpful message
- [ ] Quota available → buttons enabled
- [ ] Missing effect → button shows "generate" state
- [ ] Effect exists → button switches immediately

**Edge Cases**:
- [ ] Network offline → cached effects work
- [ ] API down → existing effects remain accessible
- [ ] Storage full → graceful error handling

---

## Rollout Plan

### Phase 1: Internal Testing (1 day)

1. Deploy fix to test environment
2. Test all scenarios with fresh sessions
3. Test all scenarios with restored sessions
4. Document any issues found

### Phase 2: Beta Testing (2-3 days)

1. Enable for test users only (10% rollout)
2. Monitor error logs and user feedback
3. Track Modern/Classic button usage rates
4. Measure session restoration success rate

### Phase 3: Full Rollout (1 day)

1. Increase rollout to 100%
2. Monitor for 24 hours
3. Be ready to rollback if issues found

---

## Rollback Plan

If issues are found post-deployment:

### Immediate Rollback (< 5 minutes)
```javascript
// Set in localStorage via browser console or Shopify admin
localStorage.setItem('gemini_effects_enabled', 'false');
```

### Code Rollback (< 30 minutes)
1. Revert PR/commit
2. Push to main branch
3. Shopify auto-deploys within 2 minutes

---

## Related Documentation

- **Session Context**: `.claude/tasks/context_session_001.md`
- **Gemini Integration**: `.claude/doc/pet-processor-gemini-integration.md`
- **Rate Limiting**: `.claude/doc/gemini-api-rate-limit-warning-implementation.md`

---

## Next Steps

1. **Review this plan** with solution-verification-auditor
2. **Implement Phase 1** (session restoration) in pet-processor.js
3. **Implement Phase 2** (feature flag fix) in gemini-api-client.js
4. **Test thoroughly** on Shopify test URL
5. **Update session context** with implementation results

---

## Conclusion

The root cause is clear: **missing session restoration logic** combined with **conservative feature flag defaults**. The fix is straightforward and involves:

1. Adding a `restoreSession()` method to reload pet data on page refresh
2. Changing feature flag default from opt-in (0%) to opt-out (100%)
3. Improving button state logic to handle edge cases gracefully

These changes are **low-risk** because:
- Session restoration is additive (doesn't break existing functionality)
- Feature flag change only affects default behavior (can be overridden)
- Button state logic improvements are defensive (don't change happy path)

**Estimated implementation time**: 2-3 hours
**Estimated testing time**: 1-2 hours
**Total time to production**: 1 day (with proper testing)
