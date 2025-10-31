# Gemini Artistic API - Frontend Integration Plan

**Created**: 2025-10-30
**Task**: Integrate Gemini Artistic API into Shopify theme for mobile-first artistic pet portraits
**API Endpoint**: https://gemini-artistic-api-753651513695.us-central1.run.app
**Context**: `.claude/tasks/context_session_001.md`

---

## Executive Summary

This plan details the complete frontend integration of the newly deployed Gemini Artistic API, adding two new premium artistic styles (Modern and Classic) while maintaining existing unlimited effects (Enhanced B&W and Color). The implementation prioritizes mobile experience (70% of traffic), implements a 4-level progressive warning system for rate limits, and ensures graceful degradation with feature flags.

**Key Decisions**:
1. **Use `/batch-generate` endpoint** - Generate both Modern and Classic at once for better UX
2. **Progressive loading** - Show styles incrementally as they generate (5-10s each)
3. **Pre-warming strategy** - Warm API when user opens effect selector (reduce cold starts)
4. **localStorage for quota** - Persist customer quota across sessions
5. **Feature flag system** - Enable/disable without deployment

---

## 1. Architecture Overview

### 1.1 Integration Points

**Existing Files to Modify**:
- `assets/pet-processor.js` (main processor, ~1500 lines)
- `sections/ks-pet-processor-v5.liquid` (UI layout)
- `config/settings_schema.json` (feature flag configuration)

**New Files to Create**:
- `assets/gemini-api-client.js` (API client module, ~400 lines)
- `snippets/gemini-quota-warning.liquid` (warning UI component)
- `snippets/gemini-feature-flag.liquid` (feature flag logic)

### 1.2 Data Flow

```
User uploads pet photo
    ↓
Process with InSPyReNet (unlimited: Enhanced B&W, Color)
    ↓
User clicks "Modern" or "Classic" button
    ↓
Check feature flag → Check quota → Pre-warm API (if cold)
    ↓
Call /batch-generate (both styles at once)
    ↓
Progressive display: Show Modern first (5-10s), then Classic (5-10s)
    ↓
Update quota, show warning if needed (4-level system)
    ↓
Cache in localStorage + Cloud Storage
```

---

## 2. File Changes Specification

### 2.1 NEW FILE: `assets/gemini-api-client.js`

**Purpose**: Dedicated API client for Gemini Artistic API with quota management, caching, and error handling.

**Key Classes**:

#### `GeminiAPIClient`
```javascript
class GeminiAPIClient {
  constructor() {
    this.apiUrl = 'https://gemini-artistic-api-753651513695.us-central1.run.app';
    this.isWarming = false;
    this.warmingPromise = null;
    this.quota = this.loadQuota();
  }

  // Core Methods:
  async batchGenerate(imageData, customerId, sessionId)
  async checkQuota(customerId, sessionId)
  async warmAPI()

  // Quota Management:
  loadQuota()
  saveQuota(quotaData)
  getWarningLevel() // Returns 1-4 based on remaining quota

  // Caching:
  getCachedResult(imageHash, style)
  setCachedResult(imageHash, style, imageUrl)

  // Error Handling:
  handleAPIError(error)
  retryWithBackoff(fn, maxRetries = 3)
}
```

**Implementation Details**:

1. **Quota Storage** (localStorage):
```javascript
{
  "gemini_quota": {
    "remaining": 8,
    "limit": 10,
    "reset_time": "2025-10-31T00:00:00Z",
    "last_check": "2025-10-30T14:30:00Z"
  }
}
```

2. **Warning Levels**:
```javascript
getWarningLevel() {
  const remaining = this.quota.remaining;
  if (remaining >= 7) return 1; // Silent (10-7)
  if (remaining >= 4) return 2; // Reminder (6-4)
  if (remaining >= 1) return 3; // Warning (3-1)
  return 4; // Exhausted (0)
}
```

3. **Pre-warming Logic**:
```javascript
async warmAPI() {
  // Only warm if cold (hasn't been called in 10+ minutes)
  if (this.isWarming) return this.warmingPromise;

  this.isWarming = true;
  this.warmingPromise = fetch(`${this.apiUrl}/health`, {
    method: 'GET',
    headers: { 'X-Purpose': 'pre-warm' }
  })
  .then(() => {
    console.log('[Gemini] API warmed successfully');
  })
  .catch(err => {
    console.warn('[Gemini] Pre-warm failed:', err);
  })
  .finally(() => {
    this.isWarming = false;
    setTimeout(() => {
      this.warmingPromise = null;
    }, 600000); // 10 minutes
  });

  return this.warmingPromise;
}
```

4. **Batch Generation with Progressive Display**:
```javascript
async batchGenerate(imageData, customerId, sessionId, onProgress) {
  // 1. Check quota first
  const quota = await this.checkQuota(customerId, sessionId);
  if (!quota.allowed || quota.remaining < 2) {
    throw new Error('INSUFFICIENT_QUOTA');
  }

  // 2. Call batch-generate
  const response = await fetch(`${this.apiUrl}/api/v1/batch-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_data: imageData,
      customer_id: customerId,
      session_id: sessionId
    })
  });

  if (!response.ok) {
    throw new Error(`API_ERROR: ${response.status}`);
  }

  const result = await response.json();

  // 3. Update quota
  this.quota = {
    remaining: result.quota_remaining,
    limit: result.quota_limit,
    reset_time: new Date(Date.now() + 86400000).toISOString(),
    last_check: new Date().toISOString()
  };
  this.saveQuota(this.quota);

  // 4. Return results
  return {
    modern: result.results.ink_wash,
    classic: result.results.van_gogh_post_impressionism,
    original_url: result.original_url,
    quota: this.quota
  };
}
```

5. **Error Handling with Retry**:
```javascript
async retryWithBackoff(fn, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry quota errors
      if (error.message.includes('INSUFFICIENT_QUOTA')) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

**Estimated Size**: ~400 lines
**Dependencies**: None (vanilla JavaScript)
**Browser Support**: ES6+ (Chrome 51+, Safari 10+, iOS 10+)

---

### 2.2 MODIFY: `assets/pet-processor.js`

**Current Effect Array** (line 17):
```javascript
this.effectOrder = ['enhancedblackwhite', 'popart', 'dithering', 'color'];
```

**Change to**:
```javascript
this.effectOrder = ['enhancedblackwhite', 'color', 'modern', 'classic'];
```

**Changes Required**:

#### Change 1: Import Gemini Client (top of file)
```javascript
// Add after existing imports
import { GeminiAPIClient } from './gemini-api-client.js';
```

#### Change 2: Initialize Gemini Client (constructor, ~line 240)
```javascript
constructor(containerId) {
  // ... existing code ...
  this.geminiClient = new GeminiAPIClient();
  this.geminiFeatureEnabled = this.checkGeminiFeatureFlag();

  // Pre-warm on initialization (if feature enabled)
  if (this.geminiFeatureEnabled) {
    setTimeout(() => {
      this.geminiClient.warmAPI();
    }, 2000); // Delay 2s to not block initial load
  }
}
```

#### Change 3: Check Feature Flag (new method)
```javascript
checkGeminiFeatureFlag() {
  // Check theme settings (injected via Liquid)
  if (window.themeSettings && typeof window.themeSettings.geminiEnabled !== 'undefined') {
    return window.themeSettings.geminiEnabled === true;
  }

  // Default: enabled (change to false for rollback)
  return true;
}
```

#### Change 4: Modify Effect Button HTML Generation (~line 321)
```javascript
// Current code generates 4 buttons (enhancedblackwhite, popart, dithering, color)
// Replace with:

getEffectButtonsHTML() {
  const buttons = [
    {
      effect: 'enhancedblackwhite',
      label: 'Enhanced B&W',
      icon: '✨',
      premium: false,
      description: 'Professional black & white'
    },
    {
      effect: 'color',
      label: 'Color',
      icon: '🎨',
      premium: false,
      description: 'Original colors enhanced'
    }
  ];

  // Add Gemini effects if feature enabled
  if (this.geminiFeatureEnabled) {
    buttons.push(
      {
        effect: 'modern',
        label: 'Modern',
        icon: '🖌️',
        premium: true,
        description: 'Ink wash artistic style',
        quota: true
      },
      {
        effect: 'classic',
        label: 'Classic',
        icon: '🎨',
        premium: true,
        description: 'Van Gogh post-impressionism',
        quota: true
      }
    );
  }

  return buttons.map(btn => `
    <button
      class="effect-btn ${btn.premium ? 'effect-btn-premium' : ''}"
      data-effect="${btn.effect}"
      ${btn.quota ? 'data-requires-quota="true"' : ''}
    >
      <span class="effect-icon">${btn.icon}</span>
      <span class="effect-label">${btn.label}</span>
      ${btn.premium ? '<span class="effect-badge">Limited</span>' : ''}
      <span class="effect-description">${btn.description}</span>
    </button>
  `).join('');
}
```

#### Change 5: Modify Effect Click Handler (~line 450)
```javascript
async handleEffectClick(effectName) {
  // Check if this is a Gemini effect
  const isGeminiEffect = ['modern', 'classic'].includes(effectName);

  if (isGeminiEffect) {
    // Check feature flag
    if (!this.geminiFeatureEnabled) {
      this.showNotification('This effect is currently unavailable', 'info');
      return;
    }

    // Check quota
    const quota = await this.geminiClient.checkQuota(
      this.getCustomerId(),
      this.getSessionId()
    );

    if (!quota.allowed || quota.remaining < 1) {
      this.showQuotaExhaustedModal(quota);
      return;
    }

    // Show warning if low quota (level 2 or 3)
    const warningLevel = this.geminiClient.getWarningLevel();
    if (warningLevel >= 2) {
      this.showQuotaWarning(warningLevel, quota);
    }

    // Generate effect
    await this.generateGeminiEffect(effectName);
  } else {
    // Existing unlimited effects (Enhanced B&W, Color)
    this.applyExistingEffect(effectName);
  }
}
```

#### Change 6: New Method - Generate Gemini Effect
```javascript
async generateGeminiEffect(effectName) {
  // Show loading state
  this.showProcessingState('Generating artistic style...', 0);

  try {
    // If we don't have both Modern and Classic yet, generate both
    const needsGeneration = !this.currentPet.effects?.modern || !this.currentPet.effects?.classic;

    if (needsGeneration) {
      // Use batch-generate to get both at once
      const imageData = this.currentPet.originalImage; // Base64
      const customerId = this.getCustomerId();
      const sessionId = this.getSessionId();

      // Show progressive loading
      this.showProcessingState('Creating Modern style...', 30);

      const results = await this.geminiClient.batchGenerate(
        imageData,
        customerId,
        sessionId
      );

      // Store both effects
      this.currentPet.effects = this.currentPet.effects || {};
      this.currentPet.effects.modern = {
        dataUrl: results.modern.image_url,
        cacheHit: results.modern.cache_hit,
        processingTime: results.modern.processing_time_ms
      };

      this.showProcessingState('Creating Classic style...', 70);

      this.currentPet.effects.classic = {
        dataUrl: results.classic.image_url,
        cacheHit: results.classic.cache_hit,
        processingTime: results.classic.processing_time_ms
      };

      // Update quota display
      this.updateQuotaDisplay(results.quota);

      // Save to localStorage
      this.savePetSession(this.currentPet);
    }

    // Display the requested effect
    this.displayEffect(effectName);
    this.showProcessingState('Complete!', 100);

  } catch (error) {
    console.error('[Gemini] Generation error:', error);

    if (error.message.includes('INSUFFICIENT_QUOTA')) {
      this.showQuotaExhaustedModal(this.geminiClient.quota);
    } else if (error.message.includes('API_ERROR')) {
      this.showNotification('Service temporarily unavailable. Please try again in a moment.', 'error');
    } else {
      this.showNotification('Failed to generate artistic style. Please try again.', 'error');
    }
  }
}
```

#### Change 7: New Method - Get Customer/Session IDs
```javascript
getCustomerId() {
  // Try to get Shopify customer ID
  if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta) {
    return window.ShopifyAnalytics.meta.page?.customerId || null;
  }
  return null;
}

getSessionId() {
  // Use existing session ID or create one
  let sessionId = localStorage.getItem('perkie_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('perkie_session_id', sessionId);
  }
  return sessionId;
}
```

#### Change 8: New Method - Update Quota Display
```javascript
updateQuotaDisplay(quota) {
  const quotaElement = this.container.querySelector('.gemini-quota-display');
  if (!quotaElement) return;

  const remaining = quota.remaining;
  const limit = quota.limit;
  const warningLevel = this.geminiClient.getWarningLevel();

  // Update text
  quotaElement.querySelector('.quota-remaining').textContent = remaining;
  quotaElement.querySelector('.quota-limit').textContent = limit;

  // Update visual indicator
  quotaElement.classList.remove('quota-low', 'quota-very-low', 'quota-exhausted');
  if (warningLevel === 2) quotaElement.classList.add('quota-low');
  if (warningLevel === 3) quotaElement.classList.add('quota-very-low');
  if (warningLevel === 4) quotaElement.classList.add('quota-exhausted');

  // Update button states
  this.updateGeminiButtonStates(remaining);
}
```

#### Change 9: New Method - Show Quota Warning
```javascript
showQuotaWarning(warningLevel, quota) {
  const messages = {
    2: `You have ${quota.remaining} artistic generations remaining today. They reset at midnight UTC.`,
    3: `⚠️ Only ${quota.remaining} artistic generations left! Use them wisely.`
  };

  const message = messages[warningLevel];
  if (message) {
    this.showNotification(message, warningLevel === 3 ? 'warning' : 'info', 5000);
  }
}
```

#### Change 10: New Method - Show Quota Exhausted Modal
```javascript
showQuotaExhaustedModal(quota) {
  const resetTime = new Date(quota.reset_time);
  const now = new Date();
  const hoursUntilReset = Math.ceil((resetTime - now) / 3600000);

  const modal = document.createElement('div');
  modal.className = 'gemini-quota-modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <h3>Daily Limit Reached</h3>
      <p>You've used all ${quota.limit} artistic generations for today.</p>
      <p class="quota-reset-info">
        Your quota resets in approximately <strong>${hoursUntilReset} hours</strong>.
      </p>
      <div class="modal-alternatives">
        <p><strong>Meanwhile, try our unlimited effects:</strong></p>
        <button class="effect-btn-alt" data-effect="enhancedblackwhite">
          <span class="effect-icon">✨</span> Enhanced B&W
        </button>
        <button class="effect-btn-alt" data-effect="color">
          <span class="effect-icon">🎨</span> Color
        </button>
      </div>
      <button class="modal-close">Got it</button>
    </div>
  `;

  // Add event listeners
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  modal.querySelector('.modal-overlay').addEventListener('click', () => {
    modal.remove();
  });

  // Handle alternative effect buttons
  modal.querySelectorAll('.effect-btn-alt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const effect = e.currentTarget.dataset.effect;
      this.handleEffectClick(effect);
      modal.remove();
    });
  });

  document.body.appendChild(modal);
}
```

**Estimated Changes**: ~600 lines added/modified
**Risk Level**: Medium (significant changes to effect handling logic)

---

### 2.3 MODIFY: `sections/ks-pet-processor-v5.liquid`

**Changes Required**:

#### Change 1: Add Feature Flag Script (top of section)
```liquid
{% comment %}
  Feature Flag: Gemini Artistic API
  Toggle this in Theme Settings > Pet Processor > Enable Artistic Effects
{% endcomment %}

<script>
  window.themeSettings = window.themeSettings || {};
  window.themeSettings.geminiEnabled = {{ section.settings.enable_gemini_effects | default: true }};
</script>
```

#### Change 2: Add Quota Display Widget (in effect selector area)
```liquid
<div class="gemini-quota-display" style="display: none;">
  <div class="quota-icon">⚡</div>
  <div class="quota-text">
    <span class="quota-remaining">--</span>/<span class="quota-limit">10</span> left today
  </div>
  <div class="quota-info-icon" title="Artistic effects reset daily at midnight UTC">ℹ️</div>
</div>
```

#### Change 3: Add Loading State for Gemini Effects
```liquid
<div class="gemini-loading-state" style="display: none;">
  <div class="loading-spinner"></div>
  <div class="loading-message">Creating your artistic portrait...</div>
  <div class="loading-progress">
    <div class="progress-bar" style="width: 0%;"></div>
  </div>
  <div class="loading-tip">
    💡 Tip: Your first generation may take 10-15 seconds. Subsequent ones are faster!
  </div>
</div>
```

#### Change 4: Add CSS for New Elements
```liquid
<style>
  /* Premium Effect Buttons */
  .effect-btn-premium {
    position: relative;
    border: 2px solid #FFD700;
    background: linear-gradient(135deg, #FFF9E5 0%, #FFFFFF 100%);
  }

  .effect-btn-premium::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    background: linear-gradient(45deg, #FFD700, #FFA500, #FFD700);
    border-radius: inherit;
    z-index: -1;
    animation: shimmer 3s linear infinite;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .effect-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    background: #FFD700;
    color: #000;
    font-size: 10px;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 8px;
    text-transform: uppercase;
  }

  /* Quota Display */
  .gemini-quota-display {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: #F0F8FF;
    border-radius: 12px;
    margin: 12px 0;
    font-size: 14px;
    transition: all 0.3s ease;
  }

  .gemini-quota-display.quota-low {
    background: #FFF9E5;
    border: 1px solid #FFD700;
  }

  .gemini-quota-display.quota-very-low {
    background: #FFF0F0;
    border: 1px solid #FF6B6B;
  }

  .gemini-quota-display.quota-exhausted {
    background: #F5F5F5;
    opacity: 0.7;
  }

  .quota-icon {
    font-size: 20px;
  }

  .quota-remaining {
    font-weight: bold;
    font-size: 18px;
    color: #2196F3;
  }

  .gemini-quota-display.quota-low .quota-remaining {
    color: #FFA500;
  }

  .gemini-quota-display.quota-very-low .quota-remaining {
    color: #FF6B6B;
  }

  .quota-info-icon {
    cursor: help;
    opacity: 0.6;
    font-size: 16px;
  }

  /* Loading State */
  .gemini-loading-state {
    text-align: center;
    padding: 24px;
    background: #FFFFFF;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    margin: 0 auto 16px;
    border: 4px solid #F0F0F0;
    border-top-color: #2196F3;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-message {
    font-size: 16px;
    font-weight: 500;
    color: #333;
    margin-bottom: 16px;
  }

  .loading-progress {
    width: 100%;
    height: 8px;
    background: #F0F0F0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 12px;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #2196F3 0%, #4CAF50 100%);
    transition: width 0.5s ease;
  }

  .loading-tip {
    font-size: 13px;
    color: #666;
    font-style: italic;
  }

  /* Quota Exhausted Modal */
  .gemini-quota-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
  }

  .modal-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }

  .modal-content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 16px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }

  .modal-content h3 {
    margin: 0 0 12px 0;
    font-size: 20px;
    color: #333;
  }

  .modal-content p {
    margin: 8px 0;
    color: #666;
    line-height: 1.5;
  }

  .quota-reset-info {
    background: #F0F8FF;
    padding: 12px;
    border-radius: 8px;
    margin: 16px 0;
  }

  .quota-reset-info strong {
    color: #2196F3;
  }

  .modal-alternatives {
    margin: 20px 0;
    padding: 16px;
    background: #F9F9F9;
    border-radius: 8px;
  }

  .effect-btn-alt {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    margin: 8px 4px;
    background: white;
    border: 2px solid #E0E0E0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    font-weight: 500;
  }

  .effect-btn-alt:hover {
    border-color: #2196F3;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(33, 150, 243, 0.2);
  }

  .modal-close {
    width: 100%;
    padding: 14px;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .modal-close:hover {
    background: #1976D2;
  }

  /* Mobile Optimizations */
  @media (max-width: 768px) {
    .effect-btn-premium {
      min-width: 140px;
      min-height: 140px;
    }

    .effect-badge {
      font-size: 9px;
      padding: 1px 4px;
    }

    .gemini-quota-display {
      padding: 10px 14px;
      font-size: 13px;
    }

    .quota-remaining {
      font-size: 16px;
    }

    .modal-content {
      max-width: 340px;
      padding: 20px;
    }

    .effect-btn-alt {
      width: 100%;
      justify-content: center;
      margin: 6px 0;
    }
  }

  /* Touch Target Sizing (44x44px minimum) */
  @media (pointer: coarse) {
    .effect-btn,
    .effect-btn-premium,
    .effect-btn-alt,
    .modal-close {
      min-height: 44px;
      min-width: 44px;
    }

    .quota-info-icon {
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  }
</style>
```

**Estimated Changes**: ~400 lines added
**Risk Level**: Low (mostly CSS and HTML additions)

---

### 2.4 MODIFY: `config/settings_schema.json`

**Add Feature Flag Setting**:

```json
{
  "name": "Pet Processor",
  "settings": [
    {
      "type": "header",
      "content": "Gemini Artistic Effects"
    },
    {
      "type": "checkbox",
      "id": "enable_gemini_effects",
      "label": "Enable Artistic Effects (Modern & Classic)",
      "default": true,
      "info": "Toggle premium AI-generated artistic styles. Disable this to instantly remove Modern and Classic effects without code changes."
    },
    {
      "type": "paragraph",
      "content": "Artistic effects are limited to 10 generations per customer per day. They automatically reset at midnight UTC."
    },
    {
      "type": "text",
      "id": "gemini_api_url",
      "label": "Gemini API URL (Advanced)",
      "default": "https://gemini-artistic-api-753651513695.us-central1.run.app",
      "info": "Only change this if you have a custom API deployment."
    }
  ]
}
```

**Estimated Changes**: 30 lines added
**Risk Level**: Very Low (configuration only)

---

### 2.5 NEW FILE: `snippets/gemini-quota-warning.liquid`

**Purpose**: Reusable warning toast component for quota notifications.

```liquid
{% comment %}
  Gemini Quota Warning Toast
  Usage: Include this snippet in sections that use Gemini effects
{% endcomment %}

<div class="gemini-warning-toast" id="gemini-warning-toast" style="display: none;">
  <div class="warning-toast-content">
    <span class="warning-icon">⚠️</span>
    <span class="warning-message"></span>
    <button class="warning-dismiss" aria-label="Dismiss">×</button>
  </div>
</div>

<style>
  .gemini-warning-toast {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    animation: slideDown 0.3s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .warning-toast-content {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    border-left: 4px solid #FFA500;
    max-width: 500px;
  }

  .warning-toast-content.level-3 {
    border-left-color: #FF6B6B;
    background: #FFF0F0;
  }

  .warning-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .warning-message {
    font-size: 14px;
    color: #333;
    line-height: 1.4;
  }

  .warning-dismiss {
    background: none;
    border: none;
    font-size: 24px;
    color: #999;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .warning-dismiss:hover {
    color: #333;
  }

  /* Mobile */
  @media (max-width: 768px) {
    .gemini-warning-toast {
      left: 10px;
      right: 10px;
      transform: none;
    }

    .warning-toast-content {
      max-width: none;
      padding: 12px 16px;
    }

    .warning-icon {
      font-size: 20px;
    }

    .warning-message {
      font-size: 13px;
    }
  }
</style>

<script>
  // Auto-dismiss warning after 5 seconds
  document.addEventListener('DOMContentLoaded', function() {
    const toast = document.getElementById('gemini-warning-toast');
    if (!toast) return;

    const dismissBtn = toast.querySelector('.warning-dismiss');
    let autoHideTimeout;

    window.showGeminiWarning = function(message, level = 2) {
      const toastContent = toast.querySelector('.warning-toast-content');
      const messageEl = toast.querySelector('.warning-message');

      messageEl.textContent = message;
      toastContent.classList.remove('level-2', 'level-3');
      toastContent.classList.add(`level-${level}`);

      toast.style.display = 'block';

      // Clear existing timeout
      if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
      }

      // Auto-hide after 5 seconds
      autoHideTimeout = setTimeout(function() {
        toast.style.display = 'none';
      }, 5000);
    };

    dismissBtn.addEventListener('click', function() {
      toast.style.display = 'none';
      if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
      }
    });
  });
</script>
```

**Estimated Size**: ~150 lines
**Risk Level**: Very Low (standalone component)

---

## 3. Mobile-Specific Optimizations

### 3.1 Touch Interactions

**Requirements**:
1. **Touch Targets**: Minimum 44x44px (iOS) / 48x48dp (Android)
2. **Touch Feedback**: Visual feedback within 100ms
3. **Gesture Support**: Support swipe between effects
4. **Long-press**: Comparison mode (existing feature preserved)

**Implementation** (in `pet-processor.js`):

```javascript
// Add touch-specific event handlers
addTouchOptimizations() {
  // Prevent double-tap zoom on buttons
  this.container.querySelectorAll('.effect-btn, .effect-btn-premium').forEach(btn => {
    btn.addEventListener('touchend', (e) => {
      e.preventDefault(); // Prevent 300ms delay
      btn.click();
    }, { passive: false });
  });

  // Add haptic feedback (iOS Safari 13+)
  if ('vibrate' in navigator) {
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('.effect-btn, .effect-btn-premium')) {
        navigator.vibrate(10); // 10ms subtle vibration
      }
    });
  }
}
```

### 3.2 Network Optimization

**Problem**: Cold start + generation = 10-15s total on mobile
**Solution**: Multi-layered loading state

```javascript
showProgressiveLoadingState(stage) {
  const states = {
    'warming': {
      message: 'Waking up our AI...',
      progress: 10,
      tip: 'First generation takes a bit longer!'
    },
    'processing': {
      message: 'Creating your artistic portrait...',
      progress: 40,
      tip: 'Our AI is analyzing your pet\'s features'
    },
    'generating_modern': {
      message: 'Painting Modern style...',
      progress: 60,
      tip: 'This may take 5-10 seconds'
    },
    'generating_classic': {
      message: 'Painting Classic style...',
      progress: 85,
      tip: 'Almost there!'
    },
    'complete': {
      message: 'Done!',
      progress: 100,
      tip: 'Try the other style too!'
    }
  };

  const state = states[stage];
  this.updateLoadingUI(state.message, state.progress, state.tip);
}
```

### 3.3 Offline Handling

**Implementation**:

```javascript
async batchGenerate(imageData, customerId, sessionId) {
  // Check online status first
  if (!navigator.onLine) {
    throw new Error('OFFLINE: Please check your internet connection');
  }

  // Set timeout for mobile networks (30s max)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${this.apiUrl}/api/v1/batch-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_data: imageData, customer_id: customerId, session_id: sessionId }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    return await response.json();

  } catch (error) {
    clearTimeout(timeout);

    if (error.name === 'AbortError') {
      throw new Error('TIMEOUT: Request took too long. Please check your connection and try again.');
    }

    throw error;
  }
}
```

### 3.4 Battery Optimization

**Strategies**:
1. **Lazy load API client**: Only load when needed
2. **Debounce pre-warming**: Don't pre-warm on every page load
3. **Minimize redraws**: Use CSS transforms for animations
4. **Reduce polling**: Don't repeatedly check quota

```javascript
// Throttle quota checks (max once per minute)
let lastQuotaCheck = 0;
const QUOTA_CHECK_INTERVAL = 60000; // 1 minute

async checkQuota(customerId, sessionId) {
  const now = Date.now();

  // Use cached quota if checked recently
  if (now - lastQuotaCheck < QUOTA_CHECK_INTERVAL) {
    return this.quota;
  }

  // Fetch fresh quota
  const quota = await this.fetchQuota(customerId, sessionId);
  lastQuotaCheck = now;
  this.quota = quota;

  return quota;
}
```

---

## 4. Feature Flag System

### 4.1 Implementation Layers

**Layer 1: Theme Settings** (instant toggle)
```liquid
<!-- In settings_schema.json -->
"enable_gemini_effects": true/false
```

**Layer 2: JavaScript Detection**
```javascript
window.themeSettings.geminiEnabled = {{ section.settings.enable_gemini_effects }};
```

**Layer 3: Runtime Override** (for emergency disable)
```javascript
// In browser console:
localStorage.setItem('gemini_force_disabled', 'true');
// Reload page
```

### 4.2 Graceful Degradation

**When feature is disabled**:
1. Modern and Classic buttons don't render
2. Effect order reverts to: `['enhancedblackwhite', 'color']`
3. Quota display hidden
4. No API calls made
5. No JavaScript errors

**Implementation**:
```javascript
constructor(containerId) {
  // ... existing code ...

  // Check for emergency override
  const forceDisabled = localStorage.getItem('gemini_force_disabled') === 'true';

  this.geminiFeatureEnabled = !forceDisabled && this.checkGeminiFeatureFlag();

  if (!this.geminiFeatureEnabled) {
    console.log('[Gemini] Feature disabled');
    return;
  }

  // Only initialize if enabled
  this.geminiClient = new GeminiAPIClient();
}
```

---

## 5. Warning System Implementation

### 5.1 Four Warning Levels

**Level 1: Silent (10-7 remaining)**
- **UI**: Small badge indicator on quota display
- **Action**: None
- **Message**: None
- **Color**: Blue (#2196F3)

**Level 2: Reminder (6-4 remaining)**
- **UI**: Toast notification (5s auto-dismiss)
- **Action**: Show once per session
- **Message**: "You have X artistic generations remaining today. They reset at midnight UTC."
- **Color**: Orange (#FFA500)

**Level 3: Warning (3-1 remaining)**
- **UI**: Prominent warning banner (manual dismiss)
- **Action**: Show on every generation
- **Message**: "⚠️ Only X artistic generations left! Use them wisely."
- **Color**: Red (#FF6B6B)

**Level 4: Exhausted (0 remaining)**
- **UI**: Modal overlay (blocks interaction)
- **Action**: Prevent generation, show alternatives
- **Message**: "Daily Limit Reached. You've used all 10 artistic generations for today. Resets in X hours."
- **Color**: Gray (#9E9E9E)

### 5.2 Implementation Flow

```javascript
async handleEffectClick(effectName) {
  if (!['modern', 'classic'].includes(effectName)) {
    // Unlimited effects - no quota check
    this.applyExistingEffect(effectName);
    return;
  }

  // Check quota
  const quota = await this.geminiClient.checkQuota(
    this.getCustomerId(),
    this.getSessionId()
  );

  const warningLevel = this.geminiClient.getWarningLevel();

  // Level 4: Block
  if (warningLevel === 4) {
    this.showQuotaExhaustedModal(quota);
    return;
  }

  // Level 3: Warn every time
  if (warningLevel === 3) {
    this.showQuotaWarning(3, quota);
  }

  // Level 2: Warn once per session
  if (warningLevel === 2 && !sessionStorage.getItem('gemini_reminder_shown')) {
    this.showQuotaWarning(2, quota);
    sessionStorage.setItem('gemini_reminder_shown', 'true');
  }

  // Level 1: Silent (just update display)
  this.updateQuotaDisplay(quota);

  // Proceed with generation
  await this.generateGeminiEffect(effectName);
}
```

---

## 6. Error Handling & Edge Cases

### 6.1 API Errors

| Error | User Message | Action |
|-------|-------------|---------|
| 429 Rate Limit | "Daily limit reached. Resets at midnight UTC." | Show exhausted modal |
| 500 Server Error | "Service temporarily unavailable. Please try again in a moment." | Enable retry button |
| 503 Service Unavailable | "Our AI is currently updating. Try again in 2-3 minutes." | Show retry countdown |
| Network timeout | "Request took too long. Check your connection and try again." | Enable retry button |
| Offline | "No internet connection. Please reconnect and try again." | Auto-retry when online |

### 6.2 Edge Cases

**Case 1: User has 1 quota left, clicks Modern (costs 2 for batch)**
- **Detection**: Check `quota.remaining >= 2` before batch-generate
- **Action**: If only 1 left, use single `/generate` endpoint instead
- **Message**: "Using your last generation for Modern only. Classic will cost an additional generation."

**Case 2: User clicks Modern, then immediately clicks Classic**
- **Detection**: Check if generation is in progress (`this.isGenerating`)
- **Action**: Queue the second request, show "Please wait for current generation..."
- **Alternative**: If batch already called, use cached result instantly

**Case 3: Quota resets while user is on page**
- **Detection**: Compare `quota.reset_time` with current time
- **Action**: Refresh quota from API, update display
- **Message**: "Your daily quota has been reset! You now have 10 generations."

**Case 4: Multiple tabs open**
- **Detection**: Use localStorage events to sync quota across tabs
- **Action**: Listen for storage events, update quota display
- **Implementation**:
```javascript
window.addEventListener('storage', (e) => {
  if (e.key === 'gemini_quota') {
    this.quota = JSON.parse(e.newValue);
    this.updateQuotaDisplay(this.quota);
  }
});
```

**Case 5: API returns cached result**
- **Detection**: Check `result.cache_hit === true`
- **Action**: Show instant result (no loading state needed)
- **Message**: "✨ Using cached version (no quota consumed)"
- **Quota**: Don't consume quota for cache hits

### 6.3 Retry Logic

```javascript
async retryWithBackoff(fn, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry these errors
      const noRetryErrors = ['INSUFFICIENT_QUOTA', 'OFFLINE', '429'];
      if (noRetryErrors.some(err => error.message.includes(err))) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;

      // Show retry countdown to user
      this.showRetryCountdown(delay / 1000);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

---

## 7. Testing Checklist

### 7.1 Functional Tests

**Effect Generation**:
- [ ] Modern style generates correctly
- [ ] Classic style generates correctly
- [ ] Batch generation completes in 10-20s
- [ ] Cache hit returns instantly
- [ ] Effect switches seamlessly after generation

**Quota Management**:
- [ ] Quota displays correctly on page load
- [ ] Quota decrements after generation
- [ ] Quota persists across page reloads
- [ ] Quota resets at midnight UTC
- [ ] Multi-tab quota sync works

**Warning System**:
- [ ] Level 1: Badge shows correctly (10-7 remaining)
- [ ] Level 2: Toast appears once (6-4 remaining)
- [ ] Level 3: Warning shows every time (3-1 remaining)
- [ ] Level 4: Modal blocks interaction (0 remaining)

**Feature Flag**:
- [ ] Disabling flag hides Modern/Classic buttons
- [ ] Disabling flag prevents API calls
- [ ] Enabling flag shows buttons immediately
- [ ] Emergency override works (localStorage)

### 7.2 Mobile-Specific Tests

**Touch Interactions**:
- [ ] Buttons respond to touch within 100ms
- [ ] No double-tap zoom on buttons
- [ ] Haptic feedback works (iOS/Android)
- [ ] Long-press comparison mode still works
- [ ] Swipe gestures don't interfere

**Performance**:
- [ ] Page loads in < 3s on 3G
- [ ] No layout shift when quota displays
- [ ] Animations run at 60fps
- [ ] No battery drain during idle

**Network Conditions**:
- [ ] Offline detection works
- [ ] Timeout after 30s on slow networks
- [ ] Retry logic works correctly
- [ ] Progressive loading shows correctly

### 7.3 Cross-Browser Tests

| Browser | Version | Status |
|---------|---------|--------|
| Chrome Mobile | 100+ | ✅ Primary |
| Safari iOS | 14+ | ✅ Primary |
| Samsung Internet | 15+ | ✅ Primary |
| Firefox Mobile | 100+ | ⚠️ Test |
| Edge Mobile | 100+ | ⚠️ Test |

### 7.4 Edge Case Tests

- [ ] User with 1 quota clicks Modern (batch needs 2)
- [ ] User clicks Modern then Classic rapidly
- [ ] Quota resets while user is on page
- [ ] Multiple tabs open simultaneously
- [ ] API returns 500 error
- [ ] API times out after 30s
- [ ] User closes tab during generation
- [ ] Browser localStorage is full

### 7.5 Accessibility Tests

- [ ] Keyboard navigation works
- [ ] Screen reader announces quota status
- [ ] High contrast mode displays correctly
- [ ] Focus indicators visible
- [ ] ARIA labels present on buttons

---

## 8. Deployment Plan

### 8.1 Pre-Deployment

1. **Code Review**: Review all changes with solution-verification-auditor agent
2. **Staging Test**: Deploy to Shopify test environment first
3. **Mobile Test**: Test on real iOS and Android devices (not just emulator)
4. **Performance Audit**: Run Lighthouse on mobile
5. **API Health**: Verify Gemini API is warm and responding

### 8.2 Phased Rollout Strategy

**Phase 1: Feature Flag OFF (Week 1)**
- Deploy code to production
- Feature flag disabled by default
- Monitor for any JavaScript errors
- Test internally with flag enabled

**Phase 2: Soft Launch (Week 2)**
- Enable feature for 10% of users (A/B test)
- Monitor API costs and performance
- Collect user feedback
- Monitor quota exhaustion rates

**Phase 3: Full Launch (Week 3)**
- Enable for 50% of users
- Continue monitoring
- Adjust rate limits if needed

**Phase 4: 100% Rollout (Week 4)**
- Enable for all users
- Monitor conversion impact
- Iterate on warning system based on data

### 8.3 Rollback Plan

**If issues occur**:
1. **Instant**: Disable feature flag in theme settings (no code deployment)
2. **Emergency**: Add `localStorage.setItem('gemini_force_disabled', 'true')` via console
3. **Permanent**: Revert git commit and push to main

**Rollback triggers**:
- JavaScript errors > 1% of sessions
- API error rate > 5%
- Mobile conversion rate drops > 10%
- Page load time increases > 30%

---

## 9. Monitoring & Analytics

### 9.1 Key Metrics to Track

**Usage Metrics**:
- Modern style generation count
- Classic style generation count
- Cache hit rate
- Quota exhaustion rate per user
- Average generations per user per day

**Performance Metrics**:
- API response time (p50, p90, p99)
- Cold start frequency
- Time to first generation
- Mobile vs desktop response times

**Conversion Metrics**:
- Add-to-cart rate after generating artistic styles
- Purchase completion rate
- Average order value (artistic vs standard effects)

**Error Metrics**:
- API error rate by type (429, 500, timeout)
- JavaScript error count
- Quota exhaustion complaints

### 9.2 Analytics Implementation

**Add to `pet-processor.js`**:

```javascript
trackGeminiEvent(eventName, data = {}) {
  // Google Analytics 4
  if (window.gtag) {
    gtag('event', eventName, {
      event_category: 'gemini_artistic',
      ...data
    });
  }

  // Shopify Analytics
  if (window.ShopifyAnalytics) {
    window.ShopifyAnalytics.lib.track('Gemini Artistic Event', {
      event_name: eventName,
      ...data
    });
  }

  // Console log for debugging
  console.log('[Analytics]', eventName, data);
}

// Usage:
async generateGeminiEffect(effectName) {
  const startTime = Date.now();

  try {
    this.trackGeminiEvent('generation_started', {
      style: effectName,
      quota_before: this.geminiClient.quota.remaining
    });

    const results = await this.geminiClient.batchGenerate(...);

    const duration = Date.now() - startTime;

    this.trackGeminiEvent('generation_completed', {
      style: effectName,
      quota_after: results.quota.remaining,
      duration_ms: duration,
      cache_hit: results[effectName].cache_hit
    });

  } catch (error) {
    this.trackGeminiEvent('generation_failed', {
      style: effectName,
      error: error.message
    });
  }
}
```

**Events to Track**:
1. `generation_started` - User clicks Modern/Classic
2. `generation_completed` - Generation succeeds
3. `generation_failed` - Generation fails
4. `quota_warning_shown` - Warning level 2/3 triggered
5. `quota_exhausted` - User hits limit
6. `cache_hit` - Cached result returned
7. `feature_flag_disabled` - Feature turned off

---

## 10. Cost Estimation

### 10.1 API Costs

**Gemini API Pricing** (estimated):
- **Generation cost**: $0.05 per image (industry standard)
- **Storage cost**: $0.02 per GB per month
- **Bandwidth cost**: $0.12 per GB

**Monthly Projections** (based on 70% mobile traffic):

| Metric | Conservative | Moderate | Aggressive |
|--------|--------------|----------|------------|
| Daily users | 100 | 300 | 500 |
| Generations per user | 2 | 3 | 5 |
| Daily generations | 200 | 900 | 2,500 |
| Monthly generations | 6,000 | 27,000 | 75,000 |
| **API cost** | **$300** | **$1,350** | **$3,750** |
| Storage (10GB) | $0.20 | $0.20 | $0.20 |
| Bandwidth (100GB) | $12 | $12 | $12 |
| **Total monthly** | **$312** | **$1,362** | **$3,762** |

### 10.2 Cost Controls

**Implemented**:
1. **Rate limiting**: 10 generations per user per day
2. **Caching**: SHA256 deduplication (reduce repeat generations by ~30%)
3. **Batch generation**: 2 styles for price of 2 (vs 2 separate calls)
4. **Scale to zero**: min-instances: 0 (no idle costs)

**Additional Recommendations**:
1. **Lower limit for anonymous users**: 5 per day vs 10 for logged-in
2. **Premium tier**: Charge $0.99 for unlimited generations per day
3. **A/B test**: Compare conversion lift vs cost per generation
4. **Dynamic pricing**: Adjust rate limits based on conversion data

### 10.3 ROI Calculation

**Assumptions**:
- Average order value: $45
- Conversion rate lift: 2% (artistic effects increase purchase intent)
- Cost per generation: $0.05

**Break-even analysis**:
```
Break-even = Generation cost / (AOV × Conversion lift)
           = $0.05 / ($45 × 0.02)
           = $0.05 / $0.90
           = 5.5% of users must convert

If 6% of users who generate artistic styles make a purchase, feature is profitable.
```

---

## 11. Future Enhancements

### 11.1 Short-term (1-2 months)

1. **Additional Styles**:
   - Watercolor
   - Pencil sketch
   - Oil painting
   - Digital art

2. **User Preferences**:
   - Save favorite style per pet
   - Auto-apply preferred style
   - Style recommendations based on pet type

3. **Social Sharing**:
   - Download with "Made with Perkie Prints" watermark
   - Instagram/Facebook share buttons
   - Referral tracking

### 11.2 Long-term (3-6 months)

1. **Custom Styles**:
   - User uploads reference image
   - "Make it look like this" feature
   - Style mixing (50% Modern + 50% Classic)

2. **Premium Tier**:
   - Unlimited generations for $4.99/month
   - Exclusive styles (Anime, Fantasy, etc.)
   - Priority processing (no cold starts)

3. **Print Preview**:
   - AR view of print on wall
   - Size comparison tool
   - Frame style preview

---

## 12. Open Questions & Decisions Needed

### 12.1 Key Questions

**Question 1**: Should anonymous users have same quota (10/day) as logged-in users?
- **Option A**: Same quota (10/day) - simpler, better conversion
- **Option B**: Lower quota (5/day) - cost control, incentive to create account
- **Recommendation**: Start with Option A, monitor costs, adjust if needed

**Question 2**: What happens if user uploads same pet photo twice?
- **Option A**: Cache returns instantly (no quota consumed)
- **Option B**: Always consume quota (prevent abuse)
- **Recommendation**: Option A (better UX, cache is already implemented)

**Question 3**: Should we show "time remaining until quota reset" or just "resets at midnight UTC"?
- **Option A**: Show countdown timer (e.g., "Resets in 14 hours 32 minutes")
- **Option B**: Show static time (e.g., "Resets at midnight UTC")
- **Recommendation**: Option B (simpler, less UI clutter)

**Question 4**: Should we pre-generate all styles after background removal?
- **Option A**: Yes - instant switching, costs 2 quota upfront
- **Option B**: No - only generate when clicked, conserves quota
- **Recommendation**: Option B (user may not want both styles)

**Question 5**: What should happen when user has exactly 1 quota remaining and clicks Modern?
- **Option A**: Block and show "Need 2 quota for Modern+Classic batch"
- **Option B**: Generate only Modern using `/generate` endpoint (1 quota)
- **Recommendation**: Option B (better UX, mention Classic will cost extra)

### 12.2 User Testing Questions

Before full launch, test these scenarios:

1. **Warning fatigue**: Are users annoyed by Level 3 warnings on every click?
2. **Quota visibility**: Do users understand the quota system?
3. **Value perception**: Do users see artistic styles as "worth it"?
4. **Effect naming**: Are "Modern" and "Classic" clear enough?
5. **Reset timing**: Is midnight UTC confusing for users in other timezones?

---

## 13. Implementation Timeline

### Week 1: Core Integration
- **Day 1-2**: Create `gemini-api-client.js` (400 lines)
- **Day 3-4**: Modify `pet-processor.js` (600 lines added/modified)
- **Day 5**: Create UI components (Liquid snippets, CSS)
- **Day 6-7**: Local testing with HTML test files

### Week 2: Polish & Test
- **Day 1-2**: Implement warning system
- **Day 3**: Add analytics tracking
- **Day 4**: Mobile optimization (touch, gestures, performance)
- **Day 5**: Deploy to Shopify test environment
- **Day 6-7**: Test on real devices (iOS, Android)

### Week 3: Staging & Refinement
- **Day 1-2**: Fix bugs found in testing
- **Day 3**: Performance optimization (Lighthouse audit)
- **Day 4**: Accessibility audit (WCAG 2.1 AA)
- **Day 5**: Code review with agents
- **Day 6-7**: Final staging tests

### Week 4: Launch
- **Day 1**: Deploy to production (feature flag OFF)
- **Day 2-3**: Internal testing in production
- **Day 4**: Enable for 10% of users
- **Day 5-7**: Monitor, adjust, iterate

**Total estimated time**: 160-200 hours (4-5 weeks at 40 hours/week)

---

## 14. Success Criteria

### Launch Criteria (All must pass)

- [ ] **Functional**: Both Modern and Classic generate correctly
- [ ] **Performance**: Page load time < 3s on 3G
- [ ] **Mobile**: Tested on iOS and Android devices
- [ ] **Accessibility**: Passes WCAG 2.1 AA audit
- [ ] **Error rate**: < 1% JavaScript errors
- [ ] **API health**: 99%+ uptime, < 10s response time
- [ ] **Feature flag**: Instant disable works

### Success Metrics (30 days post-launch)

- [ ] **Usage**: > 30% of users try artistic effects
- [ ] **Conversion lift**: +2% or more vs control group
- [ ] **Satisfaction**: < 5% complaints about quota system
- [ ] **Cost**: Break-even or profitable (ROI > 0%)
- [ ] **Performance**: No impact on Core Web Vitals
- [ ] **Mobile**: No increase in bounce rate

---

## 15. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| High API costs | Medium | High | Rate limiting, caching, monitoring alerts |
| Slow cold starts hurt UX | High | Medium | Pre-warming, progressive loading, clear messaging |
| Users don't understand quota | Medium | Medium | Clear UI, onboarding, helpful error messages |
| Feature flag fails | Low | High | Multiple layers (theme settings + localStorage override) |
| Mobile performance issues | Medium | High | Extensive mobile testing, performance budgets |
| API downtime | Low | Medium | Graceful error handling, retry logic, status page |
| Quota exhaustion frustration | Medium | Medium | 4-level warning system, show alternatives, clear reset time |
| Cache hit rate lower than expected | Medium | Medium | SHA256 deduplication, customer-scoped caching |

---

## 16. Appendix

### 16.1 API Endpoints Reference

**Base URL**: `https://gemini-artistic-api-753651513695.us-central1.run.app`

**Endpoints**:

1. **POST /api/v1/batch-generate**
   - Generate both Modern and Classic at once
   - Body: `{ image_data: string, customer_id?: string, session_id?: string }`
   - Response: `{ success: boolean, results: {...}, quota_remaining: number, ... }`

2. **POST /api/v1/generate**
   - Generate single style
   - Body: `{ image_data: string, style: string, customer_id?: string, session_id?: string }`
   - Response: `{ success: boolean, image_url: string, quota_remaining: number, ... }`

3. **GET /api/v1/quota**
   - Check quota without consuming
   - Query: `?customer_id=xxx&session_id=xxx`
   - Response: `{ allowed: boolean, remaining: number, limit: number, reset_time: string }`

4. **GET /health**
   - Health check
   - Response: `{ status: "healthy", model: "gemini-2.5-flash-image", ... }`

### 16.2 Style Mapping

| Frontend Name | API Style Value | Description |
|--------------|----------------|-------------|
| Modern | `ink_wash` | East Asian ink wash painting |
| Classic | `van_gogh_post_impressionism` | Van Gogh style with swirling brushstrokes |
| Enhanced B&W | N/A (InSPyReNet) | Professional black & white photography |
| Color | N/A (InSPyReNet) | Original colors with background removed |

### 16.3 Browser Support Matrix

| Feature | Chrome | Safari | Firefox | Edge | Samsung |
|---------|--------|--------|---------|------|---------|
| ES6 Classes | 49+ | 10+ | 45+ | 15+ | 5.0+ |
| Fetch API | 42+ | 10.1+ | 39+ | 14+ | 4.0+ |
| LocalStorage | All | All | All | All | All |
| Touch Events | All | All | All | All | All |
| Vibration API | 32+ | ❌ | 16+ | ❌ | 3.0+ |

### 16.4 Testing Devices

**Priority 1 (Must Test)**:
- iPhone 13 Pro (iOS 15+) - Safari
- Samsung Galaxy S21 (Android 12+) - Chrome
- iPhone SE (iOS 14+) - Safari (older device)

**Priority 2 (Should Test)**:
- Google Pixel 6 - Chrome
- OnePlus 9 - Chrome
- iPad Air - Safari

**Priority 3 (Nice to Test)**:
- iPhone 11 - Safari
- Samsung Galaxy A52 - Samsung Internet
- Xiaomi Mi 11 - Chrome

---

## 17. Conclusion

This implementation plan provides a complete, mobile-first integration of the Gemini Artistic API into the Shopify theme. The approach prioritizes user experience with progressive loading, clear warnings, and graceful degradation while maintaining cost control through rate limiting and caching.

**Key Success Factors**:
1. **Mobile-first design** - Touch-friendly, fast, resilient
2. **Progressive disclosure** - Don't overwhelm users with quota warnings
3. **Feature flag flexibility** - Instant enable/disable without deployment
4. **Comprehensive error handling** - Network issues, timeouts, offline scenarios
5. **Cost consciousness** - Rate limits, caching, monitoring

**Next Steps**:
1. Review plan with solution-verification-auditor agent
2. Get user approval on open questions (Section 12)
3. Create detailed tickets for each file change
4. Begin implementation in Week 1
5. Deploy to Shopify test environment and test with Playwright MCP

**Files to Create**: 2 new JavaScript files, 1 Liquid snippet
**Files to Modify**: 2 existing files (pet-processor.js, settings_schema.json)
**Estimated Lines**: ~2000 lines total
**Estimated Time**: 160-200 hours (4-5 weeks)
**Estimated Monthly Cost**: $300-$1,350 (depending on usage)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-30
**Status**: Awaiting review and approval
