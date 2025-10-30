# Product Configuration UI Components Design Plan

**Created**: 2025-01-19
**Context**: Perkie Prints Pet Portrait Configuration System
**Priority**: 70% mobile traffic optimization
**Challenge**: Design premium, simple UI components for dual product line architecture

## Executive Summary

This plan designs specific UI components for the product configuration system that transforms the 40/60 customer split (Classic vs Personalized) into a seamless, premium experience. Each component is optimized for mobile-first interaction while maintaining the sophisticated feel of a high-end pet portrait service.

**Key Innovation**: Component design that makes complex choices feel simple by using progressive disclosure, smart defaults, and native mobile patterns.

## 1. Style Selection Component (Entry Point)

### Visual Design

#### Desktop Layout (1200px+)
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              Which style captures your vision?              │
│                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │                         │  │                         │  │
│  │      Classic Portraits  │  │   Personalized Prints   │  │
│  │                         │  │                         │  │
│  │  [Hero lifestyle image] │  │  [Hero lifestyle image] │  │
│  │                         │  │                         │  │
│  │  Pure & Timeless        │  │  Custom & Personal      │  │
│  │                         │  │                         │  │
│  │  "Your pet's natural    │  │  "Make it uniquely      │  │
│  │   beauty speaks for     │  │   yours with names      │  │
│  │   itself"               │  │   beautifully           │  │
│  │                         │  │   integrated"           │  │
│  │                         │  │                         │  │
│  │  Starting at $45        │  │  Starting at $55        │  │
│  │                         │  │                         │  │
│  │  [View Examples]        │  │  [View Examples]        │  │
│  │                         │  │                         │  │
│  └─────────────────────────┘  └─────────────────────────┘  │
│                                                             │
│                    [Not sure? Take our quiz]               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Mobile Layout (420px)
```
┌─────────────────────────────────┐
│                                 │
│    Which style matches          │
│    your vision?                 │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │    Classic Portraits        │ │
│ │                             │ │
│ │ [Lifestyle hero image]      │ │
│ │                             │ │
│ │ Pure & Timeless             │ │
│ │ Let your pet's natural      │ │
│ │ beauty shine                │ │
│ │                             │ │
│ │ Starting at $45             │ │
│ │                             │ │
│ │ [View Examples]             │ │
│ └─────────────────────────────┘ │
│                                 │
│                 or              │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │   Personalized Prints       │ │
│ │                             │ │
│ │ [Lifestyle hero image]      │ │
│ │                             │ │
│ │ Custom & Personal           │ │
│ │ Names beautifully           │ │
│ │ integrated                  │ │
│ │                             │ │
│ │ Starting at $55             │ │
│ │                             │ │
│ │ [View Examples]             │ │
│ └─────────────────────────────┘ │
│                                 │
│     [Take Style Quiz]           │
│                                 │
└─────────────────────────────────┘
```

### Interaction Design

#### Hover States (Desktop)
- **Card Elevation**: Subtle shadow increase (0px → 8px)
- **Image Zoom**: 1.05x scale on lifestyle images
- **Typography**: Color shift from #333 → #007AFF
- **Button Animation**: Scale 1.0 → 1.02 with spring animation

#### Touch Interactions (Mobile)
- **Press State**: Scale 0.98x with 100ms duration
- **Haptic Feedback**: Light vibration on tap
- **Visual Feedback**: Subtle background color shift
- **Loading State**: Skeleton loading for image transitions

### Visual Hierarchy

#### Typography Scale
```css
.style-selection {
  --heading-size: clamp(28px, 5vw, 48px);
  --subheading-size: clamp(18px, 3vw, 24px);
  --body-size: clamp(14px, 2.5vw, 16px);
  --label-size: clamp(12px, 2vw, 14px);
}

.style-card-title {
  font-size: var(--subheading-size);
  font-weight: 600;
  line-height: 1.2;
  color: #1D1D1F;
}

.style-card-subtitle {
  font-size: var(--body-size);
  font-weight: 400;
  line-height: 1.4;
  color: #86868B;
}
```

#### Color Palette
```css
:root {
  /* Primary Colors */
  --primary-blue: #007AFF;
  --primary-dark: #1D1D1F;
  --primary-gray: #86868B;

  /* Background Colors */
  --card-background: #FFFFFF;
  --section-background: #F9F9F9;

  /* Interactive States */
  --hover-background: #F2F2F7;
  --active-background: #E5E5EA;
  --selected-background: #007AFF;

  /* Border Colors */
  --border-light: #E5E5EA;
  --border-medium: #C6C6C8;
  --border-dark: #A8A8AC;
}
```

## 2. Pet Selector Component with AI Processing

### Upload Interface Design

#### Initial State (Mobile)
```
┌─────────────────────────────────┐
│                                 │
│    Upload Your Pet Photo        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │         📷                  │ │
│ │                             │ │
│ │    Tap to take photo        │ │
│ │    or choose from gallery   │ │
│ │                             │ │
│ │ ┌─────────┐ ┌─────────────┐ │ │
│ │ │ Camera  │ │   Gallery   │ │ │
│ │ └─────────┘ └─────────────┘ │ │
│ │                             │ │
│ │  Or drag and drop here      │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│   ✨ FREE AI Background         │
│      Removal Included          │ │
│                                 │
│   📋 Photo Tips:                │
│   • Good lighting              │
│   • Focus on eyes              │
│   • High resolution            │
│                                 │
└─────────────────────────────────┘
```

### AI Processing States

#### Processing Interface (30-60s wait)
```
┌─────────────────────────────────┐
│ ← Back      Processing...    ⓘ  │
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │  [Pet Image Processing]     │ │
│ │                             │ │
│ │  ████████████░░░░░░ 67%     │ │
│ │                             │ │
│ │  Removing background...     │ │
│ │  Enhancing details...       │ │
│ │  Optimizing for print...    │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│  ⏱️ About 35 seconds remaining   │
│                                 │
│  🐕 While you wait:              │
│  Did you know that the          │
│  average dog can recognize      │
│  over 150 words?               │
│                                 │
│  [ Continue Customizing ]       │
│  [ Preview Size Options ]       │
│                                 │
└─────────────────────────────────┘
```

#### Success State
```
┌─────────────────────────────────┐
│                                 │
│      ✅ Processing Complete!     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │  [Before]    →    [After]   │ │
│ │  Original        Processed  │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│  🎨 Background removed           │
│  ✨ Enhanced for printing        │
│  🖼️ Ready for customization      │
│                                 │
│  [ Continue to Product ]        │
│  [ Process Another Pet ]        │
│                                 │
└─────────────────────────────────┘
```

### Micro-animations

#### Progress Animation
```css
@keyframes processing-pulse {
  0% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 0.6; transform: scale(1); }
}

.processing-indicator {
  animation: processing-pulse 2s ease-in-out infinite;
}

@keyframes progress-fill {
  from { transform: scaleX(0); }
  to { transform: scaleX(var(--progress-percent)); }
}

.progress-bar-fill {
  animation: progress-fill 0.5s ease-out;
  transform-origin: left;
}
```

## 3. Font Selection Component (Personalized Line Only)

### Font Preview Interface

#### Mobile Font Selector
```
┌─────────────────────────────────┐
│                                 │
│     Choose Your Font Style      │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │         Sam & Buddy         │ │
│ │      Classic • Selected     │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│         Swipe to browse         │
│                                 │
│ ○ ● ○ ○ ○  (5 font styles)     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │        Sam & Buddy          │ │
│ │         Modern              │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│  Font Personality:              │
│  Clean and contemporary         │
│  Perfect for modern homes       │
│                                 │
│         [ Select ]              │
│                                 │
└─────────────────────────────────┘
```

#### Desktop Font Grid
```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                    Choose Your Font Style                     │
│                                                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐ │
│  │             │ │             │ │             │ │          │ │
│  │ Sam & Buddy │ │ Sam & Buddy │ │ Sam & Buddy │ │Sam&Buddy │ │
│  │   Classic   │ │   Modern    │ │  Playful    │ │ Elegant  │ │
│  │             │ │             │ │             │ │          │ │
│  │ ● Selected  │ │             │ │             │ │          │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘ │
│                                                               │
│  ┌─────────────┐                                             │
│  │             │    Font Personality:                         │
│  │ Sam & Buddy │    Classic and timeless                      │
│  │   Script    │    Great for traditional homes               │
│  │             │    Most popular choice                       │
│  │             │                                             │
│  └─────────────┘    [ Continue ]                             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Font Style Definitions

#### Typography Samples
```css
.font-classic {
  font-family: 'Georgia', serif;
  font-weight: 400;
  letter-spacing: 0.02em;
}

.font-modern {
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.font-playful {
  font-family: 'Fredoka One', cursive;
  font-weight: 400;
  letter-spacing: 0.03em;
}

.font-elegant {
  font-family: 'Playfair Display', serif;
  font-weight: 400;
  letter-spacing: 0.05em;
}

.font-script {
  font-family: 'Dancing Script', cursive;
  font-weight: 400;
  letter-spacing: 0.02em;
}
```

### Interactive Features

#### Live Preview Animation
```css
@keyframes font-preview-update {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}

.font-preview-text {
  transition: all 0.3s ease;
}

.font-preview-text.updating {
  animation: font-preview-update 0.6s ease-in-out;
}
```

## 4. Graphic Location Selector

### Location Options Interface

#### Mobile Location Selector
```
┌─────────────────────────────────┐
│                                 │
│      Where should we place      │
│         your design?            │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │      [Product Preview]      │ │
│ │     with pet positioned     │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│  ◉ Left Chest                   │
│    Professional, subtle         │
│                                 │
│  ○ Center                       │
│    Bold, statement piece        │
│                                 │
│  ○ Full Front                   │
│    Maximum impact               │
│                                 │
│  ○ Front + Back                 │
│    Complete design (+ $15)      │
│                                 │
│         [ Continue ]            │
│                                 │
└─────────────────────────────────┘
```

#### Desktop Location Grid
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                 Where should we place your design?          │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │                  │  │                  │  │             │ │
│  │   [T-shirt with  │  │   [T-shirt with  │  │ [Full front │ │
│  │    pet on left   │  │    pet center]   │  │  coverage]  │ │
│  │    chest area]   │  │                  │  │             │ │
│  │                  │  │                  │  │             │ │
│  │  ● Left Chest    │  │   ○ Center       │  │ ○ Full Front│ │
│  │    Professional  │  │     Statement    │  │   Maximum   │ │
│  └──────────────────┘  └──────────────────┘  └─────────────┘ │
│                                                             │
│  ┌──────────────────┐                                       │
│  │                  │    Design Placement Guide:            │
│  │ [Front and back  │    • Left chest: Subtle, professional │
│  │  view showing    │    • Center: Bold, eye-catching       │
│  │  pet on both]    │    • Full front: Maximum impact       │
│  │                  │    • Front + Back: Complete design    │
│  │ ○ Front + Back   │                                       │
│  │   Complete (+$15)│    [ Continue ]                      │
│  └──────────────────┘                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Visual Preview System

#### Real-time Position Updates
```css
.product-preview {
  position: relative;
  width: 300px;
  height: 350px;
  margin: 0 auto;
}

.pet-graphic {
  position: absolute;
  transition: all 0.5s cubic-bezier(0.2, 0, 0, 1);
  border: 2px dashed transparent;
}

.pet-graphic.positioning {
  border-color: #007AFF;
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
}

/* Position variants */
.pet-graphic.left-chest {
  top: 20%;
  left: 15%;
  transform: scale(0.6);
}

.pet-graphic.center {
  top: 35%;
  left: 50%;
  transform: translateX(-50%) scale(0.8);
}

.pet-graphic.full-front {
  top: 15%;
  left: 50%;
  transform: translateX(-50%) scale(1.2);
}
```

## 5. Pet Count Selector

### Count Interface Design

#### Mobile Pet Count Selector
```
┌─────────────────────────────────┐
│                                 │
│     How many pets to include?   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │   [Visual showing 1 pet]    │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│    Number of pets: 1           │
│                                 │
│  ┌─────┐              ┌─────┐   │
│  │  -  │      1       │  +  │   │
│  └─────┘              └─────┘   │
│                                 │
│    Base price: $55              │
│    Additional pets: Free        │
│    (Names included for all)     │
│                                 │
│         [ Continue ]            │
│                                 │
└─────────────────────────────────┘
```

#### Multi-Pet Preview
```
┌─────────────────────────────────┐
│                                 │
│     How many pets to include?   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │ [Visual showing 3 pets in   │ │
│ │  arrangement with names:    │ │
│ │  Sam, Buddy & Max]          │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│    Number of pets: 3           │
│                                 │
│  ┌─────┐              ┌─────┐   │
│  │  -  │      3       │  +  │   │
│  └─────┘              └─────┘   │
│                                 │
│    Base price: $55              │
│    Additional pets: $20         │
│    Total: $75                   │
│                                 │
│         [ Continue ]            │
│                                 │
└─────────────────────────────────┘
```

### Pricing Transparency

#### Dynamic Price Updates
```css
.price-breakdown {
  background: #F9F9F9;
  border-radius: 12px;
  padding: 16px;
  margin: 16px 0;
  border: 1px solid #E5E5EA;
}

.price-line {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 14px;
}

.price-line.total {
  border-top: 1px solid #E5E5EA;
  padding-top: 8px;
  margin-top: 8px;
  font-weight: 600;
  font-size: 18px;
}

.price-change {
  animation: price-highlight 0.6s ease;
}

@keyframes price-highlight {
  0% { background: transparent; }
  50% { background: #FFD60A; }
  100% { background: transparent; }
}
```

## 6. Cross-Journey Switching Component

### Style Switch Interface

#### Classic to Personalized Prompt
```
┌─────────────────────────────────┐
│                                 │
│  🎨 Want to add pet names?       │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │  [Preview showing same      │ │
│ │   image with "Sam & Buddy"  │ │
│ │   text beautifully added]   │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│  Switch to Personalized for:    │
│  ✓ Pet names included           │
│  ✓ Choice of 5 font styles     │
│  ✓ Same great quality           │
│                                 │
│  Only $10 more                  │
│                                 │
│  [ Add Names (+$10) ]           │
│  [ Keep Classic Style ]         │
│                                 │
└─────────────────────────────────┘
```

#### Personalized to Classic Offer
```
┌─────────────────────────────────┐
│                                 │
│  ✨ Prefer a cleaner look?       │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │  [Preview showing same      │ │
│ │   image without text -      │ │
│ │   clean, minimalist style]  │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│  Switch to Classic for:         │
│  ✓ Pure, timeless aesthetic    │
│  ✓ Focus on your pet's beauty  │
│  ✓ Same print quality          │
│                                 │
│  Save $10                       │
│                                 │
│  [ Remove Text (-$10) ]         │
│  [ Keep Personalized ]          │
│                                 │
└─────────────────────────────────┘
```

### Progress Preservation

#### State Transfer Animation
```css
@keyframes style-transition {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.style-switching {
  animation: style-transition 0.8s ease-in-out;
}

.progress-preserved {
  background: linear-gradient(90deg, #34C759 0%, #30D158 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.progress-preserved::before {
  content: "✓";
  font-weight: 600;
}
```

## Error States and Edge Cases

### Upload Errors

#### Network Error State
```
┌─────────────────────────────────┐
│                                 │
│         ⚠️ Upload Failed         │
│                                 │
│    Connection seems slow.        │
│    Let's try a smaller file     │
│    or check your internet.      │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │     [Retry Upload] 🔄       │ │
│ │                             │ │
│ │   [Choose Different Photo]  │ │
│ │                             │ │
│ │     [Continue Offline]      │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│   💡 Tip: Photos under 10MB     │
│      upload fastest             │
│                                 │
└─────────────────────────────────┘
```

#### Processing Error State
```
┌─────────────────────────────────┐
│                                 │
│       🤔 Processing Issue        │
│                                 │
│    Our AI had trouble with      │
│    this image. Let's try        │
│    a different approach.        │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │      [Try Again] 🔄         │ │
│ │                             │ │
│ │   [Upload Different Photo]  │ │
│ │                             │ │
│ │   [Use Original Image]      │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│   💡 Tips for better results:   │
│   • Use clear, well-lit photos │
│   • Avoid busy backgrounds     │
│                                 │
└─────────────────────────────────┘
```

### Loading States

#### Component Loading Skeletons
```css
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-text {
  height: 1em;
  border-radius: 4px;
  margin: 0.5em 0;
}

.skeleton-button {
  height: 44px;
  border-radius: 22px;
  width: 100%;
}

.skeleton-image {
  aspect-ratio: 16/9;
  border-radius: 12px;
}
```

## Accessibility and Inclusive Design

### Screen Reader Support

#### ARIA Labels and Descriptions
```html
<!-- Style Selection -->
<div role="radiogroup" aria-labelledby="style-selection-heading">
  <h2 id="style-selection-heading">Choose your portrait style</h2>
  <button role="radio" aria-checked="false" aria-describedby="classic-desc">
    <span>Classic Portraits</span>
    <span id="classic-desc" class="sr-only">
      Clean, timeless design focusing on your pet's natural beauty
    </span>
  </button>
</div>

<!-- Pet Count Selector -->
<div role="group" aria-labelledby="pet-count-heading">
  <h3 id="pet-count-heading">Number of pets to include</h3>
  <button aria-label="Decrease pet count" aria-describedby="current-count">-</button>
  <span id="current-count" aria-live="polite">Currently 1 pet selected</span>
  <button aria-label="Increase pet count" aria-describedby="current-count">+</button>
</div>

<!-- Font Selection -->
<fieldset role="group" aria-labelledby="font-selection-heading">
  <legend id="font-selection-heading">Choose font style for pet names</legend>
  <button role="radio" aria-checked="true" aria-describedby="classic-font-desc">
    <span>Classic Font</span>
    <span id="classic-font-desc" class="sr-only">
      Traditional serif font, timeless and elegant
    </span>
  </button>
</fieldset>
```

### Color Contrast and Visual Design

#### High Contrast Mode Support
```css
@media (prefers-contrast: high) {
  :root {
    --primary-blue: #0056CC;
    --primary-dark: #000000;
    --primary-gray: #666666;
    --border-light: #333333;
  }

  .config-option {
    border: 2px solid var(--border-light);
  }

  .config-option.selected {
    border: 3px solid var(--primary-blue);
    background: var(--primary-blue);
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Keyboard Navigation

#### Focus Management
```css
.config-component:focus-within {
  outline: 2px solid #007AFF;
  outline-offset: 2px;
  border-radius: 4px;
}

.config-option:focus {
  outline: 2px solid #007AFF;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
}

/* Skip links for keyboard users */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: #007AFF;
  color: white;
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
  transition: top 0.3s;
}

.skip-link:focus {
  top: 6px;
}
```

## Performance Optimization

### Image Loading Strategy

#### Progressive Image Enhancement
```javascript
class ProgressiveImageLoader {
  constructor() {
    this.observer = new IntersectionObserver(this.handleIntersection.bind(this));
    this.loadedImages = new Set();
  }

  loadImage(element) {
    const lowQualitySrc = element.dataset.lowQuality;
    const highQualitySrc = element.dataset.highQuality;

    // Load low quality first
    const lowQualityImg = new Image();
    lowQualityImg.onload = () => {
      element.src = lowQualitySrc;
      element.classList.add('low-quality-loaded');

      // Then load high quality
      const highQualityImg = new Image();
      highQualityImg.onload = () => {
        element.src = highQualitySrc;
        element.classList.add('high-quality-loaded');
        element.classList.remove('low-quality-loaded');
      };
      highQualityImg.src = highQualitySrc;
    };
    lowQualityImg.src = lowQualitySrc;
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting && !this.loadedImages.has(entry.target)) {
        this.loadImage(entry.target);
        this.loadedImages.add(entry.target);
        this.observer.unobserve(entry.target);
      }
    });
  }
}
```

### Component Lazy Loading

#### On-Demand Component Loading
```javascript
class ComponentLoader {
  constructor() {
    this.loadedComponents = new Map();
    this.componentRegistry = {
      'font-selector': () => import('./components/FontSelector.js'),
      'location-selector': () => import('./components/LocationSelector.js'),
      'pet-counter': () => import('./components/PetCounter.js')
    };
  }

  async loadComponent(componentName, container) {
    if (this.loadedComponents.has(componentName)) {
      return this.loadedComponents.get(componentName);
    }

    // Show skeleton while loading
    this.showSkeleton(container, componentName);

    try {
      const ComponentClass = await this.componentRegistry[componentName]();
      const component = new ComponentClass(container);

      this.loadedComponents.set(componentName, component);
      this.hideSkeleton(container);

      return component;
    } catch (error) {
      this.showError(container, `Failed to load ${componentName}`);
      throw error;
    }
  }

  showSkeleton(container, componentName) {
    const skeletonHTML = this.getSkeletonHTML(componentName);
    container.innerHTML = skeletonHTML;
  }

  getSkeletonHTML(componentName) {
    const skeletons = {
      'font-selector': `
        <div class="skeleton skeleton-text" style="width: 60%;"></div>
        <div class="skeleton skeleton-button"></div>
        <div class="skeleton skeleton-text" style="width: 40%;"></div>
      `,
      'location-selector': `
        <div class="skeleton skeleton-image"></div>
        <div class="skeleton skeleton-text" style="width: 80%;"></div>
        <div class="skeleton skeleton-button"></div>
      `,
      'pet-counter': `
        <div class="skeleton skeleton-text" style="width: 50%;"></div>
        <div class="skeleton skeleton-button"></div>
      `
    };

    return skeletons[componentName] || '<div class="skeleton skeleton-button"></div>';
  }
}
```

## Mobile-Specific Optimizations

### Touch Target Optimization

#### Minimum Touch Targets
```css
/* Ensure all interactive elements meet accessibility guidelines */
.touch-target {
  min-height: 44px; /* iOS minimum */
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border-radius: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  position: relative;
}

.touch-target::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: max(44px, 100%);
  height: max(44px, 100%);
  border-radius: inherit;
}

/* Android minimum 48dp */
@media screen and (max-width: 480px) {
  .touch-target {
    min-height: 48px;
    min-width: 48px;
  }

  .touch-target::after {
    width: max(48px, 100%);
    height: max(48px, 100%);
  }
}
```

### Thumb Zone Optimization

#### Safe Area Positioning
```css
/* Position critical actions in thumb-friendly zones */
.mobile-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.primary-action {
  width: 100%;
  height: 54px;
  background: #007AFF;
  color: white;
  border: none;
  border-radius: 27px;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

/* Thumb-friendly secondary actions */
.secondary-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.secondary-action {
  flex: 1;
  height: 44px;
  background: #F2F2F7;
  color: #007AFF;
  border: none;
  border-radius: 22px;
  font-size: 16px;
  font-weight: 500;
}
```

## Success Metrics and Analytics

### Component Performance Tracking

#### Interaction Analytics
```javascript
class ComponentAnalytics {
  constructor() {
    this.analytics = window.gtag || console.log;
    this.startTimes = new Map();
    this.interactionCounts = new Map();
  }

  trackComponentLoad(componentName) {
    this.startTimes.set(componentName, performance.now());

    this.analytics('event', 'component_load_start', {
      component_name: componentName,
      timestamp: Date.now()
    });
  }

  trackComponentInteraction(componentName, action, value = null) {
    const currentCount = this.interactionCounts.get(componentName) || 0;
    this.interactionCounts.set(componentName, currentCount + 1);

    this.analytics('event', 'component_interaction', {
      component_name: componentName,
      action: action,
      value: value,
      interaction_count: currentCount + 1,
      device_type: this.getDeviceType()
    });
  }

  trackComponentCompletion(componentName, selectedValue) {
    const startTime = this.startTimes.get(componentName);
    const completionTime = startTime ? performance.now() - startTime : null;

    this.analytics('event', 'component_completion', {
      component_name: componentName,
      selected_value: selectedValue,
      completion_time_ms: completionTime,
      interaction_count: this.interactionCounts.get(componentName) || 0
    });
  }

  getDeviceType() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
}
```

### A/B Testing Framework

#### Component Variant Testing
```javascript
class ComponentABTesting {
  constructor() {
    this.variantAssignments = new Map();
    this.testConfig = {
      'style-selection': {
        variants: ['cards', 'carousel', 'grid'],
        traffic: [50, 25, 25]
      },
      'font-selector': {
        variants: ['swipe', 'grid', 'dropdown'],
        traffic: [60, 30, 10]
      }
    };
  }

  getVariant(componentName) {
    if (this.variantAssignments.has(componentName)) {
      return this.variantAssignments.get(componentName);
    }

    const config = this.testConfig[componentName];
    if (!config) return 'default';

    const variant = this.weightedRandomSelection(config.variants, config.traffic);
    this.variantAssignments.set(componentName, variant);

    // Track assignment
    this.trackVariantAssignment(componentName, variant);

    return variant;
  }

  weightedRandomSelection(variants, weights) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < variants.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return variants[i];
      }
    }

    return variants[0]; // fallback
  }

  trackVariantAssignment(componentName, variant) {
    gtag('event', 'ab_test_assignment', {
      component_name: componentName,
      variant: variant,
      user_id: this.getUserId(),
      session_id: this.getSessionId()
    });
  }
}
```

## Implementation Roadmap

### Week 1-2: Foundation Components
1. **Style Selection Component**
   - Desktop and mobile layouts
   - Card-based interaction patterns
   - Cross-journey switching logic

2. **Pet Selector Component**
   - Upload interface design
   - Processing state management
   - Error handling implementation

### Week 3-4: Configuration Components
3. **Font Selection Component** (Personalized line only)
   - Swipeable mobile interface
   - Live preview functionality
   - Font personality descriptions

4. **Location Selector Component**
   - Visual preview system
   - Real-time positioning updates
   - Price impact communication

### Week 5-6: Advanced Features
5. **Pet Count Selector**
   - Touch-optimized controls
   - Dynamic pricing display
   - Multi-pet layout previews

6. **Cross-Journey Switching**
   - Progress preservation system
   - Style transition animations
   - Value proposition messaging

### Week 7-8: Polish and Testing
7. **Accessibility Implementation**
   - Screen reader optimization
   - Keyboard navigation
   - High contrast support

8. **Performance Optimization**
   - Lazy loading implementation
   - Image optimization
   - Component caching

## Success Criteria

### User Experience Metrics
- **Configuration Completion Rate**: Target +40% improvement
- **Time to Configure**: Target <3 minutes average
- **Style Switching Rate**: Target 15-20% adoption
- **Mobile Satisfaction**: Target 4.5+ rating

### Technical Performance
- **Component Load Time**: <1 second
- **Touch Response Time**: <100ms
- **Memory Usage**: <30MB for full flow
- **Accessibility Score**: 95+ Lighthouse

### Business Impact
- **Overall Conversion**: Target +15-20%
- **Mobile Conversion**: Target +25-30%
- **Average Order Value**: Target +$15-25
- **Customer Satisfaction**: Target +20% improvement

This comprehensive UI component design plan transforms the complex product configuration challenge into an intuitive, mobile-first experience that guides customers through their choices while maintaining the premium feel of a high-end pet portrait service.