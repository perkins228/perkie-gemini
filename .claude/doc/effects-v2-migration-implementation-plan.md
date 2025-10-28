# Effects V2 Migration Implementation Plan

## Executive Summary

**Strategic Decision**: Replace Pet Processor V5 (600 lines) with Effects V2 (335 lines) as the foundation for a modernized customer journey.

### Key Metrics
- **Total Estimated Effort**: 48-64 hours (6-8 business days)
- **Critical Path**: ES6 Module compatibility with Shopify themes (Phase 1)
- **Biggest Risks**:
  1. ES6 module loading in Shopify (no native support)
  2. Mobile performance regression (70% traffic)
  3. Storage migration for existing users
- **Recommended Starting Point**: Phase 1 - Module Compatibility Resolution
- **Blocking Questions**:
  1. Accept bundling requirement for ES6 modules? (webpack/rollup needed)
  2. Keep rate limiting at 5/day for Gemini styles?
  3. Preserve comparison mode feature from V5?

---

## 1. Architecture Analysis

### Current State (Pet Processor V5)
```
assets/
├── pet-processor.js (600 lines, ES6 classes but no modules)
├── pet-storage.js (75 lines, storage abstraction)
└── pet-social-sharing-simple.js (100 lines, sharing logic)

sections/
└── ks-pet-processor-v5.liquid (loads scripts via defer)
```

**Key Characteristics**:
- Self-contained ES6 classes (no import/export)
- Direct InSPyReNet API integration
- NO Gemini integration (Modern/Classic buttons non-functional)
- Hardcoded API URLs (recently updated to staging)
- ComparisonManager for effect gallery
- localStorage-based session management

### Target State (Effects V2)
```
assets/
├── effects-v2.js (335 lines, ES6 module)
├── gemini-artistic-client.js (ES6 module)
├── effects-v2-bundle.js (NEW - webpack bundle for Shopify)
├── pet-storage-v2.js (NEW - ported storage)
└── pet-sharing-v2.js (NEW - ported sharing)

sections/
└── ks-effects-processor-v2.liquid (NEW - replaces V5)
```

**Key Characteristics**:
- ES6 module architecture (requires bundling)
- Dual API support (InSPyReNet + Gemini)
- Canvas-based effect processing
- Rate limiting for Gemini (5/day)
- Modern async/await patterns

### Critical Architecture Decisions

#### ES6 Module Compatibility Strategy

**Option A: Bundle to IIFE (Recommended)**
```javascript
// webpack.config.js
module.exports = {
  entry: './assets/effects-v2.js',
  output: {
    filename: 'effects-v2-bundle.js',
    library: 'EffectsProcessor',
    libraryTarget: 'var',  // Creates global window.EffectsProcessor
    libraryExport: 'default'
  }
};
```
- **Pros**: Works with Shopify's script loading, maintains ES6 benefits
- **Cons**: Requires build step, 5-10KB larger bundle
- **Effort**: 4-6 hours setup

**Option B: Rewrite as Non-Module ES6**
```javascript
// Convert from modules to global classes
class EffectsProcessor { ... }
window.EffectsProcessor = EffectsProcessor;
```
- **Pros**: No build step, direct deployment
- **Cons**: Loses module benefits, more refactoring
- **Effort**: 8-10 hours rewriting

**Recommendation**: Option A - Bundle to IIFE. Maintains code quality while ensuring compatibility.

### File Structure & Naming

```
assets/
├── effects-v2/
│   ├── effects-processor.js (main processor)
│   ├── gemini-client.js (Gemini integration)
│   ├── storage-manager.js (ported from V5)
│   └── sharing-manager.js (ported from V5)
├── effects-v2-bundle.js (webpack output)
└── effects-v2-loader.js (initialization)

sections/
├── ks-effects-processor-v2.liquid (new section)
└── ks-pet-processor-v5.liquid (keep for rollback)
```

### Dependencies & Load Order

```html
<!-- In ks-effects-processor-v2.liquid -->
<!-- Core Bundle (includes all modules) -->
<script src="{{ 'effects-v2-bundle.js' | asset_url }}" defer></script>

<!-- Initialization (after bundle loads) -->
<script src="{{ 'effects-v2-loader.js' | asset_url }}" defer></script>

<!-- Styles -->
{{ 'effects-v2.css' | asset_url | stylesheet_tag }}
{{ 'effects-v2-mobile.css' | asset_url | stylesheet_tag }}
```

---

## 2. Feature Port Plan

### Share Functionality Integration

**Current V5 Implementation**:
- Client-side only (no server dependencies)
- Native Web Share API for mobile
- Clipboard copy for desktop
- Watermark application
- Toast notifications

**Port Strategy**:
```javascript
// In effects-v2/sharing-manager.js
export class SharingManager {
  constructor(effectsProcessor) {
    this.processor = effectsProcessor;
    this.watermarkConfig = { ... };  // From V5
  }

  async shareEffect(effectName) {
    const canvas = await this.processor.getCanvas(effectName);
    this.addWatermark(canvas);

    if (navigator.share && this.isMobile()) {
      return this.shareViaNative(canvas);
    } else {
      return this.shareViaClipboard(canvas);
    }
  }
}
```

**Integration Points**:
- Hook into Effects V2's canvas processing
- Maintain effect-specific sharing
- Preserve watermark positioning
- **Effort**: 6-8 hours

### Storage Integration Architecture

**Current V5 Storage**:
```javascript
// Stores: petId, name, thumbnail, gcsUrl, effect, timestamp
PetStorage.save(petId, {
  thumbnail: compressedDataUrl,
  gcsUrl: cloudStorageUrl,
  effect: selectedEffect
});
```

**Effects V2 Storage Strategy**:
```javascript
// In effects-v2/storage-manager.js
export class StorageManager {
  constructor() {
    this.prefix = 'effects_v2_';
    this.maxThumbnailSize = 200;
  }

  async saveProcessedPet(petId, effects) {
    // Save all effect URLs (color, B&W, modern, classic)
    const data = {
      petId,
      effects: {
        color: effects.color?.url,
        blackwhite: effects.blackwhite?.url,
        modern: effects.modern?.url,
        classic: effects.classic?.url
      },
      selectedEffect: effects.selected,
      thumbnails: await this.compressThumbnails(effects),
      metadata: {
        name: effects.name,
        timestamp: Date.now(),
        apiVersion: 'v2'
      }
    };

    return this.saveToLocalStorage(petId, data);
  }

  // Migration helper for V5 -> V2
  async migrateV5Data() {
    const v5Keys = Object.keys(localStorage)
      .filter(k => k.startsWith('perkie_pet_'));

    for (const key of v5Keys) {
      const v5Data = JSON.parse(localStorage.getItem(key));
      await this.convertV5ToV2(v5Data);
    }
  }
}
```

**Key Differences**:
- V2 stores all 4 effects (vs V5 single effect)
- Separate thumbnails per effect
- Effect tracking for analytics
- **Effort**: 8-10 hours

### Session Management Strategy

**Current V5 Approach**:
- Pet data in localStorage
- Emergency cleanup method
- Global window.perkiePets array

**Effects V2 Session Architecture**:
```javascript
// In effects-v2/session-manager.js
export class SessionManager {
  constructor(storageManager) {
    this.storage = storageManager;
    this.currentSession = {
      petId: null,
      effects: {},
      processingState: null
    };

    // Maintain V5 compatibility
    window.emergencyCleanupPetData = this.emergencyCleanup.bind(this);
    window.effectsProcessor = this;  // Global access
  }

  async startNewSession(imageFile) {
    this.currentSession = {
      petId: this.generatePetId(),
      originalImage: imageFile,
      effects: {},
      startTime: Date.now()
    };

    return this.currentSession.petId;
  }

  async addEffect(effectName, result) {
    this.currentSession.effects[effectName] = result;
    await this.storage.saveProcessedPet(
      this.currentSession.petId,
      this.currentSession
    );
  }
}
```

**Effort**: 4-6 hours

### Features NOT to Port

**1. Comparison Mode (ComparisonManager)**
- 150+ lines of complex interaction
- Low usage based on no documentation/tests
- Alternative: Simple A/B toggle
- **Decision**: Defer to Phase 2

**2. Progress Steps UI**
- V5's 4-step progress indicator
- V2 uses simpler loading states
- **Decision**: Keep V2's approach

**3. How It Works Section**
- Educational overlay in V5
- Better as separate landing content
- **Decision**: Move to marketing page

**4. Complex Error Recovery**
- V5's multi-level retry logic
- V2's simpler error boundaries sufficient
- **Decision**: Use V2's approach

---

## 3. Implementation Phases

### Phase 1: Foundation & Compatibility (12-16 hours)

**Day 1-2 Focus**: Resolve ES6 module compatibility

**Tasks**:
1. **Set up webpack build** (4 hours)
   ```bash
   npm init -y
   npm install --save-dev webpack webpack-cli
   npm install --save-dev babel-loader @babel/core @babel/preset-env
   ```

2. **Create webpack config** (2 hours)
   ```javascript
   // webpack.config.js
   module.exports = {
     entry: {
       'effects-v2': './assets/effects-v2.js',
     },
     output: {
       path: path.resolve(__dirname, 'assets'),
       filename: '[name]-bundle.js',
       library: '[name]',
       libraryTarget: 'var'
     },
     module: {
       rules: [{
         test: /\.js$/,
         exclude: /node_modules/,
         use: {
           loader: 'babel-loader',
           options: {
             presets: ['@babel/preset-env']
           }
         }
       }]
     }
   };
   ```

3. **Update Effects V2 exports** (2 hours)
   - Export main class as default
   - Ensure Gemini client is bundled
   - Test bundle output

4. **Create loader script** (2 hours)
   ```javascript
   // effects-v2-loader.js
   document.addEventListener('DOMContentLoaded', () => {
     if (window.EffectsProcessor) {
       const processor = new window.EffectsProcessor();
       processor.initialize('#effects-container');
     }
   });
   ```

5. **Create new Liquid section** (2-4 hours)
   - Copy ks-pet-processor-v5.liquid
   - Rename to ks-effects-processor-v2.liquid
   - Update script references
   - Add feature flag

**Testing Checkpoint**:
- Bundle builds successfully
- Effects V2 loads in browser
- No console errors
- Basic image upload works

### Phase 2: Core Feature Ports (16-20 hours)

**Day 3-4 Focus**: Port storage and sharing

**Tasks**:

1. **Port Storage Manager** (6-8 hours)
   - Extract storage logic from pet-storage.js
   - Convert to ES6 module
   - Add Effects V2 specific methods
   - Implement migration helper
   - Test localStorage operations

2. **Port Sharing Manager** (6-8 hours)
   - Extract sharing from pet-social-sharing-simple.js
   - Integrate with Effects V2 canvas
   - Add per-effect sharing
   - Test mobile Web Share API
   - Test desktop clipboard

3. **Session Management** (4-6 hours)
   - Create session manager class
   - Link storage and effects
   - Add recovery methods
   - Test session persistence

**Testing Checkpoint**:
- Storage saves/loads correctly
- Sharing works on mobile/desktop
- Session survives page reload
- Migration from V5 data works

### Phase 3: Shopify Integration (8-10 hours)

**Day 5 Focus**: Theme integration

**Tasks**:

1. **Update Liquid Templates** (3-4 hours)
   ```liquid
   <!-- In ks-effects-processor-v2.liquid -->
   <section id="effects-processor-{{ section.id }}"
            class="effects-processor-section"
            data-section-type="effects-processor-v2">
     <div id="effects-container" class="page-width">
       <!-- UI injected by JavaScript -->
     </div>
   </section>

   <script src="{{ 'effects-v2-bundle.js' | asset_url }}" defer></script>
   <script src="{{ 'effects-v2-loader.js' | asset_url }}" defer></script>
   ```

2. **Update Theme Settings** (2 hours)
   - Add Effects V2 section to templates
   - Create feature flag setting
   - Update navigation if needed

3. **Style Migration** (3-4 hours)
   - Port necessary styles from V5
   - Create effects-v2.css
   - Mobile-specific styles
   - Ensure responsive design

**Testing Checkpoint**:
- Section renders in theme
- Styles match brand
- Mobile responsive
- No conflicts with V5

### Phase 4: API Integration Finalization (8-10 hours)

**Day 6 Focus**: Dual API coordination

**Tasks**:

1. **InSPyReNet Integration** (3-4 hours)
   - Verify endpoints work
   - Test color/B&W processing
   - Handle timeouts gracefully
   - Add retry logic

2. **Gemini Integration** (3-4 hours)
   - Test Modern/Classic styles
   - Verify rate limiting
   - Handle quota errors
   - Add user feedback

3. **Error Handling** (2-3 hours)
   - Network errors
   - API failures
   - Rate limit exceeded
   - Invalid images

**Testing Checkpoint**:
- All 4 effects work
- Rate limiting enforced
- Errors handled gracefully
- Good mobile performance

### Phase 5: Testing & Optimization (8-10 hours)

**Day 7 Focus**: Comprehensive testing

**Tasks**:

1. **Create Test Suite** (4-5 hours)
   ```html
   <!-- testing/effects-v2-test.html -->
   - Upload tests
   - Effect application tests
   - Storage tests
   - Sharing tests
   - Error scenarios
   ```

2. **Mobile Testing** (2-3 hours)
   - Real device testing
   - Touch interactions
   - Performance profiling
   - Network conditions

3. **Performance Optimization** (2-3 hours)
   - Image compression
   - Lazy loading
   - Memory management
   - Bundle size optimization

**Testing Checkpoint**:
- All tests pass
- Mobile performance acceptable
- No memory leaks
- Bundle < 100KB

### Phase 6: Migration & Rollout (6-8 hours)

**Day 8 Focus**: Production preparation

**Tasks**:

1. **Data Migration Script** (2-3 hours)
   ```javascript
   // migrate-v5-to-v2.js
   async function migrateAllUsers() {
     const v5Users = getV5Users();
     for (const user of v5Users) {
       await migrateUserData(user);
       await validateMigration(user);
     }
   }
   ```

2. **Feature Flag Setup** (1-2 hours)
   - Add to theme settings
   - Create A/B test groups
   - Monitor performance

3. **Rollback Procedure** (1-2 hours)
   - Document rollback steps
   - Test rollback locally
   - Prepare monitoring alerts

4. **Documentation** (2-3 hours)
   - Update CLAUDE.md
   - Create migration guide
   - Update testing docs

**Final Checkpoint**:
- Migration tested
- Rollback tested
- Documentation complete
- Ready for staging

---

## 4. Shopify Template Updates

### Changes to ks-pet-processor-v5.liquid

**Step 1: Create New Section** (keep V5 for rollback)
```bash
cp sections/ks-pet-processor-v5.liquid sections/ks-effects-processor-v2.liquid
```

### New ks-effects-processor-v2.liquid Structure

```liquid
{%- comment -%}
  Effects Processor V2 Section
  Modern dual-API architecture with Gemini integration
  Type: ks-effects-processor-v2
{%- endcomment -%}

{%- comment -%} Feature flag for gradual rollout {%- endcomment -%}
{%- assign use_effects_v2 = section.settings.enable_v2 | default: false -%}

{%- if use_effects_v2 -%}

  {%- comment -%} V2 Styles {%- endcomment -%}
  {{ 'effects-v2.css' | asset_url | stylesheet_tag }}
  {{ 'effects-v2-mobile.css' | asset_url | stylesheet_tag }}

  <section id="effects-processor-{{ section.id }}"
           class="effects-processor-v2 color-{{ section.settings.color_scheme }}"
           data-section-type="effects-processor-v2"
           data-section-id="{{ section.id }}"
           data-api-url="{{ section.settings.api_url | default: 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app' }}"
           data-gemini-url="{{ section.settings.gemini_url | default: 'https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app' }}">

    <div class="page-width">
      {%- if section.settings.heading != blank -%}
        <div class="section-header">
          <h2 class="section-heading">{{ section.settings.heading }}</h2>
          {%- if section.settings.subheading != blank -%}
            <p class="section-subheading">{{ section.settings.subheading }}</p>
          {%- endif -%}
        </div>
      {%- endif -%}

      <div id="effects-container-{{ section.id }}" class="effects-container">
        <!-- Effects V2 UI injected here -->
        <noscript>
          <div class="effects-fallback">
            <p>JavaScript is required for image processing.</p>
          </div>
        </noscript>
      </div>
    </div>
  </section>

  {%- comment -%} V2 Scripts - Bundled {%- endcomment -%}
  <script src="{{ 'effects-v2-bundle.js' | asset_url }}" defer></script>
  <script src="{{ 'effects-v2-loader.js' | asset_url }}" defer></script>

{%- else -%}

  {%- comment -%} Fallback to V5 {%- endcomment -%}
  {%- include 'ks-pet-processor-v5-content' -%}

{%- endif -%}
```

### Script Tag Updates for ES6 Modules

**Option A: Bundled Approach (Recommended)**
```liquid
<!-- Single bundle includes all modules -->
<script src="{{ 'effects-v2-bundle.js' | asset_url }}" defer></script>

<!-- Initialization after bundle loads -->
<script>
  document.addEventListener('DOMContentLoaded', function() {
    if (window.EffectsProcessor) {
      const container = document.getElementById('effects-container-{{ section.id }}');
      const processor = new window.EffectsProcessor({
        container: container,
        apiUrl: container.dataset.apiUrl,
        geminiUrl: container.dataset.geminiUrl
      });
      processor.initialize();
    }
  });
</script>
```

**Option B: Module Script Tags (Requires server support)**
```liquid
<!-- NOT RECOMMENDED - Shopify CDN doesn't set correct MIME types -->
<script type="module">
  import { EffectsProcessor } from '{{ "effects-v2.js" | asset_url }}';
  // This will likely fail due to MIME type issues
</script>
```

### CSS Requirements

```css
/* effects-v2.css */
.effects-processor-v2 {
  --effects-primary: #FF6B6B;
  --effects-secondary: #4ECDC4;
  --effects-bg: #F7F7F7;
  --effects-text: #2D3436;
}

.effects-container {
  min-height: 600px;
  position: relative;
}

.effects-upload-zone {
  border: 2px dashed var(--effects-primary);
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  transition: all 0.3s ease;
}

.effects-upload-zone.drag-over {
  background: rgba(78, 205, 196, 0.1);
  border-color: var(--effects-secondary);
}

.effect-button {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.effect-button.active {
  background: var(--effects-primary);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

/* Mobile-specific */
@media (max-width: 749px) {
  .effects-container {
    min-height: auto;
  }

  .effect-buttons-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
}
```

### Schema Updates

```json
{
  "name": "Effects Processor V2",
  "tag": "section",
  "class": "section",
  "limit": 1,
  "settings": [
    {
      "type": "checkbox",
      "id": "enable_v2",
      "label": "Enable Effects V2",
      "default": false,
      "info": "Use new Effects V2 processor (experimental)"
    },
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Transform Your Pet Photos"
    },
    {
      "type": "text",
      "id": "subheading",
      "label": "Subheading",
      "default": "AI-powered background removal and artistic effects"
    },
    {
      "type": "text",
      "id": "api_url",
      "label": "InSPyReNet API URL",
      "default": "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app",
      "info": "Leave empty for default production URL"
    },
    {
      "type": "text",
      "id": "gemini_url",
      "label": "Gemini API URL",
      "default": "https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app",
      "info": "Leave empty for default production URL"
    },
    {
      "type": "select",
      "id": "color_scheme",
      "label": "Color scheme",
      "options": [
        {
          "value": "accent-1",
          "label": "Accent 1"
        },
        {
          "value": "accent-2",
          "label": "Accent 2"
        },
        {
          "value": "background-1",
          "label": "Background 1"
        },
        {
          "value": "background-2",
          "label": "Background 2"
        }
      ],
      "default": "background-1"
    }
  ],
  "presets": [
    {
      "name": "Effects Processor V2"
    }
  ]
}
```

---

## 5. Testing Strategy

### Unit Tests for Ported Features

```javascript
// tests/effects-v2-tests.js

describe('Effects V2 Storage', () => {
  it('should save pet with all effects', async () => {
    const storage = new StorageManager();
    const petId = 'test-123';
    const effects = {
      color: { url: 'blob:...', thumbnail: 'data:...' },
      blackwhite: { url: 'blob:...', thumbnail: 'data:...' },
      modern: { url: 'blob:...', thumbnail: 'data:...' },
      classic: { url: 'blob:...', thumbnail: 'data:...' }
    };

    await storage.saveProcessedPet(petId, effects);
    const saved = await storage.getPet(petId);

    expect(saved.effects).toHaveProperty('color');
    expect(saved.effects).toHaveProperty('modern');
  });

  it('should migrate V5 data correctly', async () => {
    // Add V5 data to localStorage
    localStorage.setItem('perkie_pet_old', JSON.stringify({
      petId: 'old-123',
      thumbnail: 'data:...',
      effect: 'enhancedblackwhite'
    }));

    const storage = new StorageManager();
    await storage.migrateV5Data();

    const migrated = await storage.getPet('old-123');
    expect(migrated.metadata.apiVersion).toBe('v2');
  });
});

describe('Effects V2 Sharing', () => {
  it('should add watermark to canvas', async () => {
    const sharing = new SharingManager();
    const canvas = document.createElement('canvas');

    sharing.addWatermark(canvas);

    const ctx = canvas.getContext('2d');
    // Verify watermark was drawn
  });

  it('should use Web Share API on mobile', async () => {
    // Mock navigator.share
    navigator.share = jest.fn();

    const sharing = new SharingManager();
    await sharing.shareEffect('modern');

    expect(navigator.share).toHaveBeenCalled();
  });
});
```

### Integration Tests

```html
<!-- testing/effects-v2-integration-test.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Effects V2 Integration Test</title>
  <link rel="stylesheet" href="../assets/effects-v2.css">
  <style>
    .test-section {
      margin: 20px;
      padding: 20px;
      border: 1px solid #ddd;
    }
    .status { padding: 10px; margin: 10px 0; }
    .success { background: #d4edda; color: #155724; }
    .error { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <h1>Effects V2 Integration Tests</h1>

  <div class="test-section">
    <h2>1. Module Loading</h2>
    <button onclick="testModuleLoading()">Test Loading</button>
    <div id="module-status" class="status"></div>
  </div>

  <div class="test-section">
    <h2>2. Image Processing</h2>
    <input type="file" id="test-image" accept="image/*">
    <button onclick="testProcessing()">Test All Effects</button>
    <div id="processing-status" class="status"></div>
    <div id="effect-results"></div>
  </div>

  <div class="test-section">
    <h2>3. Storage Operations</h2>
    <button onclick="testStorage()">Test Storage</button>
    <div id="storage-status" class="status"></div>
  </div>

  <div class="test-section">
    <h2>4. Sharing Functions</h2>
    <button onclick="testSharing()">Test Sharing</button>
    <div id="sharing-status" class="status"></div>
  </div>

  <div class="test-section">
    <h2>5. Gemini Rate Limiting</h2>
    <button onclick="testRateLimit()">Test Rate Limit</button>
    <div id="rate-status" class="status"></div>
  </div>

  <script src="../assets/effects-v2-bundle.js"></script>
  <script>
    let processor;

    async function testModuleLoading() {
      const status = document.getElementById('module-status');
      try {
        processor = new window.EffectsProcessor();
        await processor.initialize('#effect-results');
        status.className = 'status success';
        status.textContent = '✓ Module loaded successfully';
      } catch (error) {
        status.className = 'status error';
        status.textContent = '✗ Loading failed: ' + error.message;
      }
    }

    async function testProcessing() {
      const file = document.getElementById('test-image').files[0];
      if (!file) {
        alert('Please select an image');
        return;
      }

      const status = document.getElementById('processing-status');
      const results = document.getElementById('effect-results');
      results.innerHTML = '';

      try {
        // Test each effect
        const effects = ['color', 'blackwhite', 'modern', 'classic'];

        for (const effect of effects) {
          const start = performance.now();
          const result = await processor.applyEffect(file, effect);
          const time = ((performance.now() - start) / 1000).toFixed(2);

          const img = document.createElement('img');
          img.src = result.url;
          img.width = 200;
          img.title = `${effect} (${time}s)`;
          results.appendChild(img);
        }

        status.className = 'status success';
        status.textContent = '✓ All effects processed successfully';
      } catch (error) {
        status.className = 'status error';
        status.textContent = '✗ Processing failed: ' + error.message;
      }
    }

    async function testStorage() {
      const status = document.getElementById('storage-status');
      try {
        // Test save
        const testData = {
          petId: 'test-' + Date.now(),
          effects: { color: { url: 'test' } }
        };
        await processor.storage.saveProcessedPet(testData.petId, testData);

        // Test load
        const loaded = await processor.storage.getPet(testData.petId);

        if (loaded.petId === testData.petId) {
          status.className = 'status success';
          status.textContent = '✓ Storage working correctly';
        } else {
          throw new Error('Data mismatch');
        }
      } catch (error) {
        status.className = 'status error';
        status.textContent = '✗ Storage failed: ' + error.message;
      }
    }

    async function testSharing() {
      const status = document.getElementById('sharing-status');
      try {
        // Create test canvas
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, 100, 100);

        // Test sharing
        await processor.sharing.shareEffect('test', canvas);

        status.className = 'status success';
        status.textContent = '✓ Sharing initiated successfully';
      } catch (error) {
        status.className = 'status error';
        status.textContent = '✗ Sharing failed: ' + error.message;
      }
    }

    async function testRateLimit() {
      const status = document.getElementById('rate-status');
      try {
        const limit = processor.geminiClient.checkRateLimit();

        status.className = 'status success';
        status.textContent = `✓ Rate limit: ${limit.remaining}/${processor.geminiClient.maxRequestsPerDay} remaining`;

        if (!limit.allowed) {
          const reset = new Date(limit.resetTime);
          status.textContent += ` (resets at ${reset.toLocaleTimeString()})`;
        }
      } catch (error) {
        status.className = 'status error';
        status.textContent = '✗ Rate limit check failed: ' + error.message;
      }
    }
  </script>
</body>
</html>
```

### Mobile-Specific Tests

```javascript
// tests/mobile-tests.js

describe('Mobile Performance', () => {
  it('should process image under 3s on mobile', async () => {
    // Simulate mobile environment
    const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)';
    Object.defineProperty(navigator, 'userAgent', { value: userAgent });

    const processor = new EffectsProcessor();
    const file = new File(['...'], 'test.jpg', { type: 'image/jpeg' });

    const start = performance.now();
    await processor.applyEffect(file, 'color');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(3000);
  });

  it('should handle touch events correctly', async () => {
    const processor = new EffectsProcessor();
    const mockTouch = new Touch({
      identifier: 1,
      target: document.body,
      clientX: 100,
      clientY: 100
    });

    const event = new TouchEvent('touchstart', {
      touches: [mockTouch]
    });

    processor.handleTouch(event);
    expect(processor.touchActive).toBe(true);
  });
});
```

### Shopify Staging Tests

```javascript
// tests/shopify-staging-tests.js

const STAGING_URL = 'https://your-store.myshopify.com';

describe('Shopify Staging Integration', () => {
  it('should load Effects V2 section', async () => {
    const response = await fetch(`${STAGING_URL}/pages/pet-processor`);
    const html = await response.text();

    expect(html).toContain('effects-processor-v2');
    expect(html).toContain('effects-v2-bundle.js');
  });

  it('should process through to cart', async () => {
    // 1. Upload image
    // 2. Apply effect
    // 3. Add to cart
    // 4. Verify cart contains correct variant
  });
});
```

### Regression Tests

```javascript
// tests/regression-tests.js

describe('V5 to V2 Regression', () => {
  it('should maintain same conversion funnel', async () => {
    // Test critical user paths still work
    const v5Metrics = {
      uploadSuccess: 0.95,
      effectApplication: 0.90,
      cartAddition: 0.85
    };

    const v2Metrics = await measureV2Metrics();

    expect(v2Metrics.uploadSuccess).toBeGreaterThanOrEqual(v5Metrics.uploadSuccess);
    expect(v2Metrics.effectApplication).toBeGreaterThanOrEqual(v5Metrics.effectApplication);
    expect(v2Metrics.cartAddition).toBeGreaterThanOrEqual(v5Metrics.cartAddition);
  });

  it('should support all V5 image formats', async () => {
    const formats = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

    for (const format of formats) {
      const result = await processor.canProcess(format);
      expect(result).toBe(true);
    }
  });
});
```

---

## 6. Risk Mitigation

### Identified Risks & Mitigation Strategies

#### Risk 1: ES6 Module Incompatibility (HIGH)
**Impact**: Effects V2 won't load in Shopify
**Probability**: 90% (Shopify doesn't support ES6 modules natively)
**Mitigation**:
- Use webpack to bundle to IIFE format
- Test bundle in multiple browsers
- Have fallback to inline script if needed
- **Contingency**: Rewrite as non-module ES6 (adds 8 hours)

#### Risk 2: Mobile Performance Regression (MEDIUM)
**Impact**: Slower processing, higher bounce rate
**Probability**: 40%
**Mitigation**:
- Profile on real devices early
- Optimize bundle size (<100KB)
- Use WebP where supported
- Implement progressive enhancement
- **Contingency**: Simplify effects for mobile

#### Risk 3: Storage Migration Failure (MEDIUM)
**Impact**: Users lose saved pets
**Probability**: 30%
**Mitigation**:
- Keep V5 data intact (don't delete)
- Test migration thoroughly
- Provide manual recovery option
- Log migration errors
- **Contingency**: Manual migration tool

#### Risk 4: Gemini API Rate Limiting Issues (LOW)
**Impact**: Users hit limits unexpectedly
**Probability**: 20%
**Mitigation**:
- Clear rate limit UI feedback
- Show remaining uses prominently
- Consider increasing limit to 10/day
- Cache results aggressively
- **Contingency**: Disable Gemini temporarily

#### Risk 5: Cart Integration Breaks (MEDIUM)
**Impact**: Can't complete purchases
**Probability**: 35%
**Mitigation**:
- Test cart flow extensively
- Maintain same data structure
- Keep V5 cart handlers
- Monitor cart abandonment
- **Contingency**: Quick rollback to V5

#### Risk 6: Cold Start Times (LOW)
**Impact**: First user experiences timeout
**Probability**: 25%
**Mitigation**:
- Implement pre-warming on page load
- Show accurate progress bars
- Set appropriate timeouts (45s)
- Cache processed images
- **Contingency**: Accept cold starts

### Rollback Procedure

**Instant Rollback** (< 5 minutes):
```liquid
<!-- In theme settings or section -->
{%- assign use_effects_v2 = false -%}
```

**Full Rollback Steps**:
1. Set feature flag to false in theme settings
2. Clear CDN cache
3. Monitor error rates for 30 minutes
4. If issues persist, revert git commit
5. Notify team of rollback

**Rollback Triggers**:
- Error rate > 5%
- Cart conversion drops > 10%
- Page load time increases > 2s
- Critical bug in production

### Monitoring Plan

**Key Metrics to Track**:
1. **Performance**
   - Time to First Byte (TTFB)
   - Time to Interactive (TTI)
   - Effect processing time (p50, p95, p99)
   - Bundle size

2. **User Behavior**
   - Upload success rate
   - Effect application rate
   - Cart addition rate
   - Error rate by type

3. **API Health**
   - InSPyReNet response times
   - Gemini response times
   - Rate limit hits
   - Timeout frequency

**Monitoring Tools**:
```javascript
// Add to effects-v2-loader.js
window.effectsV2Analytics = {
  trackEvent(category, action, label, value) {
    // Send to Google Analytics
    if (window.gtag) {
      gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value
      });
    }

    // Log to console in dev
    if (window.location.hostname === 'localhost') {
      console.log('Analytics:', { category, action, label, value });
    }
  },

  trackTiming(category, variable, time) {
    if (window.gtag) {
      gtag('event', 'timing_complete', {
        event_category: category,
        name: variable,
        value: Math.round(time)
      });
    }
  }
};
```

### Success Metrics

**Phase 1 Success** (Foundation):
- Bundle builds without errors
- Loads in Shopify theme
- Basic upload works
- No console errors

**Phase 2 Success** (Features):
- Storage saves/loads correctly
- Sharing works on mobile
- Session persists
- V5 migration works

**Phase 3 Success** (Integration):
- Theme section renders
- Responsive on mobile
- Styles match brand
- No conflicts with V5

**Phase 4 Success** (APIs):
- All 4 effects work
- Rate limiting enforced
- Errors handled gracefully
- Good performance

**Phase 5 Success** (Testing):
- All tests pass
- Mobile performance good
- No memory leaks
- Bundle < 100KB

**Phase 6 Success** (Launch):
- Migration complete
- Rollback tested
- Documentation updated
- Staging deployment works

**Overall Success Criteria**:
- Conversion rate ≥ V5 baseline (2.8%)
- Mobile performance ≤ 3s processing
- Error rate < 1%
- Support tickets don't increase
- All 4 effects functional

---

## 7. Customer Journey Considerations

### How Effects V2 Enables New Requirements

#### 1. **Simplified Decision Making**
**V5 Problem**: Too many options, analysis paralysis
**V2 Solution**:
- Only 4 effects (vs 7+ in original plan)
- Clear differentiation (Original, B&W, Modern, Classic)
- Progressive disclosure (show effects after upload)
- Smart defaults (start with Original)

#### 2. **Mobile-First Experience**
**V5 Problem**: Desktop-oriented UI
**V2 Solution**:
- Touch-optimized effect buttons
- Native sharing on mobile
- Smaller bundle size
- Faster processing

#### 3. **Artistic Positioning**
**V5 Problem**: Technical focus ("background removal")
**V2 Solution**:
- Artistic effects prominent (Modern, Classic)
- Gallery-quality messaging
- Professional results emphasis
- Creative exploration encouraged

#### 4. **Conversion Optimization**
**V5 Problem**: Complex flow, many steps
**V2 Solution**:
- Single-page experience
- Instant effect preview
- One-click purchase
- Persistent cart state

### UX Improvements vs V5

#### Upload Experience
**V5**: File input + button
**V2**:
- Drag-and-drop zone
- Paste from clipboard
- Camera capture (mobile)
- Recent uploads

#### Effect Selection
**V5**: Comparison mode (complex)
**V2**:
- Simple toggle buttons
- Instant preview
- Effect descriptions
- Visual indicators

#### Processing Feedback
**V5**: 4-step progress bars
**V2**:
- Single progress indicator
- Estimated time remaining
- Cancel option
- Background processing

#### Error Handling
**V5**: Technical error messages
**V2**:
- User-friendly messages
- Suggested actions
- Automatic retry
- Fallback options

### Conversion Funnel Optimization

#### Current V5 Funnel
1. Land on page (100%)
2. Upload image (35%)
3. Wait for processing (30%)
4. View effects (25%)
5. Select effect (20%)
6. Add to cart (10%)
7. Complete purchase (2.8%)

#### Optimized V2 Funnel
1. Land on page (100%)
2. **Upload image (40%)** - Better CTA, drag-drop
3. **Process image (38%)** - Faster, progress shown
4. **View effects (35%)** - Auto-shown, no click
5. **Select effect (30%)** - Simpler choice
6. **Add to cart (15%)** - One-click from effect
7. **Complete purchase (3.5%)** - 25% improvement

#### Key Optimizations
1. **Reduce Friction**
   - Fewer clicks (7 → 4)
   - Faster processing
   - Auto-advance steps
   - Remember preferences

2. **Increase Engagement**
   - Interactive effects
   - Share functionality
   - Save for later
   - Effect comparison

3. **Build Trust**
   - "Free" messaging prominent
   - No account required
   - Privacy assurance
   - Quality guarantee

4. **Drive Urgency**
   - Limited artistic styles (5/day)
   - Session expiry warnings
   - Cart abandonment recovery
   - Special offers

### Mobile-Specific Optimizations

#### Touch Interactions
```javascript
// Swipe between effects
let touchStartX = 0;
container.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
});

container.addEventListener('touchend', (e) => {
  const touchEndX = e.changedTouches[0].clientX;
  const diff = touchStartX - touchEndX;

  if (Math.abs(diff) > 50) {
    if (diff > 0) {
      processor.nextEffect();
    } else {
      processor.previousEffect();
    }
  }
});
```

#### Progressive Enhancement
```javascript
// Start with basic, enhance if capable
class EffectsProcessor {
  initialize() {
    // Basic functionality
    this.setupBasicUpload();

    // Enhance based on capabilities
    if ('serviceWorker' in navigator) {
      this.enableOfflineMode();
    }

    if ('share' in navigator) {
      this.enableNativeSharing();
    }

    if (window.matchMedia('(hover: hover)').matches) {
      this.enableHoverEffects();
    }
  }
}
```

---

## Implementation Timeline

### Week 1: Foundation
- **Monday-Tuesday**: ES6 module setup, webpack config
- **Wednesday-Thursday**: Create Effects V2 bundle
- **Friday**: Initial Shopify integration

### Week 2: Features & Testing
- **Monday-Tuesday**: Port storage and sharing
- **Wednesday**: Session management
- **Thursday**: API integration finalization
- **Friday**: Testing and bug fixes

### Week 3: Rollout
- **Monday**: Final testing, performance optimization
- **Tuesday**: Documentation updates
- **Wednesday**: Staging deployment
- **Thursday**: Monitor and fix issues
- **Friday**: Prepare production rollout

---

## Appendix: Code Examples

### Critical Integration: Effects V2 Initialization

```javascript
// effects-v2-loader.js
(function() {
  'use strict';

  // Wait for DOM and bundle to load
  let initialized = false;

  function initializeEffectsV2() {
    if (initialized || !window.EffectsProcessor) return;
    initialized = true;

    // Find all Effects V2 containers
    const containers = document.querySelectorAll('[data-section-type="effects-processor-v2"]');

    containers.forEach(container => {
      const processor = new window.EffectsProcessor({
        container: container,
        apiUrl: container.dataset.apiUrl,
        geminiUrl: container.dataset.geminiUrl,

        // Callbacks for Shopify integration
        onEffectApplied: (effect, imageUrl) => {
          // Track in analytics
          window.effectsV2Analytics?.trackEvent('Effects', 'Applied', effect);

          // Update cart form
          updateCartForm(effect, imageUrl);
        },

        onError: (error) => {
          console.error('Effects V2 Error:', error);
          showUserNotification(error.message);
        }
      });

      // Store reference for other scripts
      container.effectsProcessor = processor;

      // Initialize
      processor.initialize();

      // Set up purchase flow integration
      setupPurchaseFlow(processor);
    });
  }

  function updateCartForm(effect, imageUrl) {
    // Update hidden inputs in cart form
    const form = document.querySelector('.product-form');
    if (form) {
      let input = form.querySelector('input[name="properties[Pet Effect]"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'properties[Pet Effect]';
        form.appendChild(input);
      }
      input.value = effect;

      // Store image URL for cart
      let urlInput = form.querySelector('input[name="properties[_petImageUrl]"]');
      if (!urlInput) {
        urlInput = document.createElement('input');
        urlInput.type = 'hidden';
        urlInput.name = 'properties[_petImageUrl]';
        form.appendChild(urlInput);
      }
      urlInput.value = imageUrl;
    }
  }

  function setupPurchaseFlow(processor) {
    // Listen for add to cart
    const addToCartBtns = document.querySelectorAll('.product-form__submit');

    addToCartBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!processor.hasProcessedImage()) {
          e.preventDefault();
          showUserNotification('Please upload and process a pet photo first');

          // Scroll to processor
          processor.container.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  function showUserNotification(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'effects-v2-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Remove after 3s
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Initialize when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEffectsV2);
  } else {
    initializeEffectsV2();
  }

  // Also try after a delay in case bundle loads async
  setTimeout(initializeEffectsV2, 1000);
})();
```

### Storage Migration Example

```javascript
// effects-v2/storage-migration.js
export class StorageMigration {
  static async migrateFromV5() {
    console.log('Starting V5 → V2 migration...');

    const v5Keys = Object.keys(localStorage).filter(k => k.startsWith('perkie_pet_'));
    const migrated = [];
    const failed = [];

    for (const key of v5Keys) {
      try {
        const v5Data = JSON.parse(localStorage.getItem(key));
        const v2Data = await this.convertV5ToV2(v5Data);

        // Save in new format
        const newKey = key.replace('perkie_pet_', 'effects_v2_');
        localStorage.setItem(newKey, JSON.stringify(v2Data));

        migrated.push(v5Data.petId);
      } catch (error) {
        console.error(`Failed to migrate ${key}:`, error);
        failed.push(key);
      }
    }

    console.log(`Migration complete: ${migrated.length} success, ${failed.length} failed`);
    return { migrated, failed };
  }

  static async convertV5ToV2(v5Data) {
    return {
      petId: v5Data.petId,
      name: v5Data.name || 'Pet',
      effects: {
        // V5 only stored selected effect
        [v5Data.effect || 'color']: {
          url: v5Data.gcsUrl || v5Data.originalUrl,
          thumbnail: v5Data.thumbnail
        }
      },
      selectedEffect: v5Data.effect || 'color',
      metadata: {
        migratedFrom: 'v5',
        originalTimestamp: v5Data.timestamp,
        migrationDate: Date.now(),
        apiVersion: 'v2'
      }
    };
  }
}
```

---

## Final Recommendations

1. **Start with Phase 1** - Module compatibility is critical
2. **Use webpack bundling** - Most reliable for Shopify
3. **Keep V5 running** during migration for quick rollback
4. **Test mobile extensively** - 70% of traffic
5. **Monitor closely** during first 48 hours after launch
6. **Have rollback ready** - Feature flag makes it instant
7. **Document everything** - Future maintenance will thank you

## Success Criteria Checklist

- [ ] Effects V2 loads without errors
- [ ] All 4 effects work (Color, B&W, Modern, Classic)
- [ ] Mobile performance < 3s processing
- [ ] Storage migration preserves data
- [ ] Sharing works on mobile and desktop
- [ ] Cart integration maintained
- [ ] Error rate < 1%
- [ ] Conversion rate ≥ 2.8%
- [ ] Bundle size < 100KB
- [ ] Rollback tested and documented