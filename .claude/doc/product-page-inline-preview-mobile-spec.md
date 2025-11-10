# Product Page Inline Preview: Mobile Implementation Specification

**Date**: 2025-11-09
**Author**: mobile-commerce-architect
**Context**: Mobile-optimized implementation for 70% mobile traffic (iOS Safari + Android Chrome)
**Session**: context_session_001.md
**Foundation**: Shared BottomSheet component (assets/components/bottom-sheet.js)

---

## Executive Summary

This specification defines the mobile implementation of the product page inline preview drawer using native mobile UX patterns. The implementation leverages the existing BottomSheet component and focuses on performance optimization for 3G/4G networks, touch interactions, and device-specific quirks.

**Target Devices**:
- iOS Safari 14-17 (40% of traffic)
- Android Chrome (latest 3 versions) (30% of traffic)
- Low-end devices (iPhone 8, Android 9) (15% of traffic)

**Performance Targets**:
- Drawer animation: <300ms, 60fps
- Style carousel swipe: <16ms per frame (60fps)
- Image loading: Progressive (blur-up technique)
- Memory usage: <50MB additional
- Network resilience: Works on 3G (slow 3G = 400kbps)

**Key Technical Challenges**:
1. Background removal (30-60s) + Gemini effects (10-15s each) = long processing times
2. iOS scroll lock and rubber band scrolling conflicts
3. Gesture conflicts (carousel swipe vs drawer dismiss vs iOS back swipe)
4. Touch target optimization (48px minimum)
5. Memory cleanup on low-end devices

---

## 1. Mobile Gesture Strategy

### 1.1 Drawer Gestures (iOS Bottom Sheet Pattern)

**Primary Gesture: Swipe Down to Dismiss**

```javascript
// Implemented in BottomSheet component, extend for product page
class ProductPagePreviewDrawer extends BottomSheet {
  constructor(options = {}) {
    super({
      container: options.container,
      height: '85vh', // Taller for product preview
      dismissible: true,
      swipeThreshold: 100, // Consistent with base component
      onOpen: options.onOpen,
      onClose: options.onClose
    });

    // Product-specific state
    this.currentPetIndex = 0;
    this.currentStyle = 'modern';
    this.processedImages = {};
  }

  /**
   * Override touch start to handle drawer-specific interactions
   */
  handleTouchStart(e) {
    // Only allow swipe-down dismiss from handle area (top 60px)
    const touchY = e.touches[0].clientY;
    const containerRect = this.container.getBoundingClientRect();
    const touchYRelative = touchY - containerRect.top;

    if (touchYRelative <= 60) {
      // Handle area - allow swipe down to dismiss
      super.handleTouchStart(e);
    } else {
      // Content area - check if user is scrolling or swiping carousel
      this.detectGestureIntent(e);
    }
  }

  /**
   * Detect if user is scrolling content or swiping carousel
   */
  detectGestureIntent(e) {
    const touch = e.touches[0];
    this.gestureStartX = touch.clientX;
    this.gestureStartY = touch.clientY;
    this.gestureStartTime = Date.now();

    // Add temporary listener to detect gesture direction
    const detectMove = (moveEvent) => {
      const deltaX = Math.abs(moveEvent.touches[0].clientX - this.gestureStartX);
      const deltaY = Math.abs(moveEvent.touches[0].clientY - this.gestureStartY);

      if (deltaX > 10 || deltaY > 10) {
        // Gesture started - determine direction
        if (deltaX > deltaY) {
          // Horizontal swipe = carousel navigation
          this.handleCarouselSwipe(moveEvent);
        } else {
          // Vertical swipe = content scroll (default behavior)
          // Let browser handle it
        }

        // Remove temporary listener
        document.removeEventListener('touchmove', detectMove);
      }
    };

    document.addEventListener('touchmove', detectMove, { passive: true });

    // Cleanup after 200ms if no movement detected
    setTimeout(() => {
      document.removeEventListener('touchmove', detectMove);
    }, 200);
  }
}
```

**Secondary Gestures: Tap Outside, Close Button, ESC Key**

Already implemented in base BottomSheet component:
- Tap overlay → close drawer
- Tap × button → close drawer
- Press ESC key → close drawer

### 1.2 Style Carousel Gestures (Horizontal Swipe)

**Swipe Left/Right: Navigate Between Styles**

```javascript
class StyleCarousel {
  constructor(container) {
    this.container = container;
    this.currentIndex = 0;
    this.styles = ['blackwhite', 'color', 'modern', 'sketch'];
    this.touchStartX = 0;
    this.touchStartTime = 0;
    this.isAnimating = false;

    this.initGestures();
  }

  initGestures() {
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
  }

  handleTouchStart(e) {
    // Prevent animation conflicts
    if (this.isAnimating) return;

    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartTime = Date.now();

    // Disable CSS transitions for smooth dragging
    this.container.style.transition = 'none';
  }

  handleTouchMove(e) {
    if (this.isAnimating) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - this.touchStartX;

    // Only allow horizontal swipe (prevent vertical scroll conflict)
    if (Math.abs(deltaX) > 10) {
      e.preventDefault(); // Prevent vertical scroll

      // Apply rubber band effect at boundaries
      const rubberBandFactor = this.getRubberBandFactor(deltaX);
      const translateX = deltaX * rubberBandFactor;

      // Move carousel
      this.container.style.transform = `translateX(calc(-${this.currentIndex * 100}% + ${translateX}px))`;
    }
  }

  handleTouchEnd(e) {
    if (this.isAnimating) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaTime = Date.now() - this.touchStartTime;

    // Restore CSS transitions
    this.container.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    // Determine if swipe was intentional
    const velocity = Math.abs(deltaX) / deltaTime; // px/ms
    const isQuickSwipe = velocity > 0.5; // Fast swipe threshold
    const isLongSwipe = Math.abs(deltaX) > 100; // Distance threshold

    if (isQuickSwipe || isLongSwipe) {
      // Navigate to next/previous style
      if (deltaX > 0) {
        this.navigatePrevious();
      } else {
        this.navigateNext();
      }
    } else {
      // Snap back to current style
      this.snapToCurrent();
    }
  }

  getRubberBandFactor(deltaX) {
    const atStart = this.currentIndex === 0 && deltaX > 0;
    const atEnd = this.currentIndex === this.styles.length - 1 && deltaX < 0;

    if (atStart || atEnd) {
      // Rubber band effect: resistance increases with distance
      return Math.max(0.1, 1 - Math.abs(deltaX) / 300);
    }

    return 1; // No resistance
  }

  navigateNext() {
    if (this.currentIndex < this.styles.length - 1) {
      this.currentIndex++;
      this.updateCarousel();
    } else {
      this.snapToCurrent(); // Bounce back
    }
  }

  navigatePrevious() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateCarousel();
    } else {
      this.snapToCurrent(); // Bounce back
    }
  }

  snapToCurrent() {
    this.container.style.transform = `translateX(-${this.currentIndex * 100}%)`;
  }

  updateCarousel() {
    this.isAnimating = true;
    this.container.style.transform = `translateX(-${this.currentIndex * 100}%)`;

    // Update active indicator
    this.updateIndicators();

    // Unlock after animation
    setTimeout(() => {
      this.isAnimating = false;
    }, 300);
  }

  updateIndicators() {
    const indicators = this.container.querySelectorAll('.carousel-indicator');
    indicators.forEach((indicator, index) => {
      indicator.classList.toggle('active', index === this.currentIndex);
    });
  }
}
```

### 1.3 Gesture Conflict Resolution

**Problem**: iOS Safari has swipe-right-from-edge to go back, which conflicts with carousel swipe.

**Solution**: Detect edge swipes and let iOS handle them.

```javascript
handleTouchStart(e) {
  const touchX = e.touches[0].clientX;
  const screenWidth = window.innerWidth;

  // iOS back gesture zone: Left 20px and right 20px of screen
  if (touchX < 20 || touchX > screenWidth - 20) {
    // Let iOS handle back/forward gesture
    return;
  }

  // Otherwise, handle carousel swipe
  // ... carousel logic
}
```

**Problem**: Drawer swipe-down conflicts with content scroll when user scrolls to top.

**Solution**: Already implemented in BottomSheet base component (lines 215-225).

```javascript
// Only start drag if touching within top 60px (handle area)
if (touchY - containerRect.top > 60) {
  // Check if content is scrollable and not at top
  if (this.content) {
    const isScrollable = this.content.scrollHeight > this.content.clientHeight;
    const isAtTop = this.content.scrollTop === 0;

    if (isScrollable && !isAtTop) {
      return; // Let content scroll normally
    }
  }
}
```

---

## 2. Performance Optimization Plan

### 2.1 Image Compression Strategy

**Problem**: High-res images (2000x2000px) are too large for mobile upload on 3G.

**Solution**: Client-side compression before upload.

```javascript
class ImageCompressor {
  /**
   * Compress image before upload
   * Target: <500KB for mobile upload
   */
  static async compressForUpload(file) {
    // Skip compression if already small
    if (file.size < 500 * 1024) {
      return file;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');

          // Calculate dimensions (max 1500px on longest side)
          const maxSize = 1500;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            0.85 // 85% quality (good balance of size/quality)
          );
        };
        img.src = e.target.result;
      };

      reader.readAsDataURL(file);
    });
  }
}
```

### 2.2 Progressive Image Loading (Blur-Up Technique)

**Pattern**: Show low-res placeholder → fade in high-res image.

```javascript
class ProgressiveImageLoader {
  /**
   * Load image with blur-up effect
   */
  static async loadWithBlurUp(container, lowResUrl, highResUrl) {
    // Step 1: Show low-res placeholder immediately (fast on 3G)
    const placeholder = document.createElement('img');
    placeholder.src = lowResUrl;
    placeholder.className = 'preview-image preview-image--blur';
    placeholder.style.filter = 'blur(10px)';
    placeholder.loading = 'eager'; // Load immediately
    container.appendChild(placeholder);

    // Step 2: Load high-res in background
    const highRes = new Image();
    highRes.onload = () => {
      // High-res loaded - fade in
      const finalImage = document.createElement('img');
      finalImage.src = highResUrl;
      finalImage.className = 'preview-image preview-image--loaded';
      finalImage.style.opacity = '0';
      container.appendChild(finalImage);

      // Fade in high-res
      requestAnimationFrame(() => {
        finalImage.style.transition = 'opacity 0.3s ease';
        finalImage.style.opacity = '1';
      });

      // Remove placeholder after fade complete
      setTimeout(() => {
        placeholder.remove();
      }, 300);
    };

    highRes.onerror = () => {
      // High-res failed to load - keep placeholder
      placeholder.style.filter = 'blur(5px)'; // Reduce blur slightly
    };

    highRes.src = highResUrl;
  }
}
```

**CSS for Smooth Transitions**:

```css
.preview-image {
  width: 100%;
  height: auto;
  display: block;
  position: absolute;
  top: 0;
  left: 0;
}

.preview-image--blur {
  filter: blur(10px);
  transform: scale(1.1); /* Prevent blur edge artifacts */
}

.preview-image--loaded {
  filter: none;
  transform: none;
}
```

### 2.3 Lazy Loading Gemini Effects (On-Demand Generation)

**Strategy**: Only generate styles when user views them.

```javascript
class LazyStyleLoader {
  constructor(petIndex) {
    this.petIndex = petIndex;
    this.processedUrl = null; // Background-removed image from GCS
    this.cachedStyles = {}; // {style: url}
    this.loadingStyles = new Set();
  }

  /**
   * Load style only when visible
   */
  async loadStyleWhenVisible(style, container) {
    // Check cache first
    if (this.cachedStyles[style]) {
      await ProgressiveImageLoader.loadWithBlurUp(
        container,
        this.getLowResUrl(style),
        this.cachedStyles[style]
      );
      return this.cachedStyles[style];
    }

    // Check localStorage cache
    const cached = localStorage.getItem(`pet_${this.petIndex}_style_${style}`);
    if (cached) {
      this.cachedStyles[style] = cached;
      await ProgressiveImageLoader.loadWithBlurUp(
        container,
        this.getLowResUrl(style),
        cached
      );
      return cached;
    }

    // Generate style (first time viewing)
    if (!this.loadingStyles.has(style)) {
      this.loadingStyles.add(style);

      // Show skeleton while generating
      this.showSkeletonLoader(container);

      try {
        const url = await this.generateStyle(style);
        this.cachedStyles[style] = url;
        localStorage.setItem(`pet_${this.petIndex}_style_${style}`, url);

        await ProgressiveImageLoader.loadWithBlurUp(
          container,
          this.getLowResUrl(style),
          url
        );

        return url;
      } catch (error) {
        console.error('Style generation failed:', error);
        this.showErrorState(container);
      } finally {
        this.loadingStyles.delete(style);
      }
    }
  }

  async generateStyle(style) {
    // Call Gemini API to generate style
    const response = await fetch('/api/gemini-artistic/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: this.processedUrl,
        style: style,
        pet_index: this.petIndex
      })
    });

    const data = await response.json();
    return data.generated_url;
  }

  getLowResUrl(style) {
    // Return low-res cached thumbnail (generated during background removal)
    return localStorage.getItem(`pet_${this.petIndex}_style_${style}_thumb`);
  }

  showSkeletonLoader(container) {
    container.innerHTML = `
      <div class="skeleton-loader">
        <div class="skeleton-loader__image"></div>
        <div class="skeleton-loader__text">Generating ${style} style...</div>
      </div>
    `;
  }

  showErrorState(container) {
    container.innerHTML = `
      <div class="error-state">
        <p>Style generation failed</p>
        <button onclick="this.retry()">Retry</button>
      </div>
    `;
  }
}
```

### 2.4 Cache Strategy (LocalStorage + Memory)

**Hierarchy**:
1. Memory cache (fastest, cleared on page refresh)
2. LocalStorage cache (persists between sessions)
3. GCS cache (server-side, indexed by SHA256)

```javascript
class CacheManager {
  constructor() {
    this.memoryCache = new Map(); // In-memory cache
    this.maxMemorySize = 50 * 1024 * 1024; // 50MB memory limit
    this.currentMemorySize = 0;
  }

  /**
   * Get from cache (memory → localStorage → GCS)
   */
  async get(key) {
    // Try memory cache first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    // Try localStorage
    const localData = localStorage.getItem(key);
    if (localData) {
      // Promote to memory cache
      this.set(key, localData);
      return localData;
    }

    // Not in cache
    return null;
  }

  /**
   * Set cache (memory + localStorage)
   */
  set(key, value) {
    // Estimate size (rough)
    const size = new Blob([value]).size;

    // Check memory limit
    if (this.currentMemorySize + size > this.maxMemorySize) {
      // Evict oldest entries until enough space
      this.evictLRU(size);
    }

    // Add to memory cache
    this.memoryCache.set(key, value);
    this.currentMemorySize += size;

    // Add to localStorage (sync)
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        // LocalStorage full - clear old pet data
        this.cleanupOldPets();
      }
    }
  }

  /**
   * Evict least recently used entries
   */
  evictLRU(requiredSize) {
    const entries = Array.from(this.memoryCache.entries());
    let freedSize = 0;

    for (const [key, value] of entries) {
      const size = new Blob([value]).size;
      this.memoryCache.delete(key);
      this.currentMemorySize -= size;
      freedSize += size;

      if (freedSize >= requiredSize) {
        break;
      }
    }
  }

  /**
   * Cleanup old pet data from localStorage
   */
  cleanupOldPets() {
    const keys = Object.keys(localStorage);
    const petKeys = keys.filter(k => k.startsWith('pet_'));

    // Remove oldest 50% of pet data
    const toRemove = petKeys.slice(0, Math.floor(petKeys.length / 2));
    toRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Clear all cache on drawer close
   */
  clearMemoryCache() {
    this.memoryCache.clear();
    this.currentMemorySize = 0;
  }
}
```

### 2.5 Memory Cleanup on Low-End Devices

**Problem**: Low-end devices (iPhone 8, Android 9) have limited memory.

**Solution**: Aggressive cleanup when drawer closes.

```javascript
class LowEndDeviceOptimizer {
  static detect() {
    const isLowEnd =
      /Android [4-8]/.test(navigator.userAgent) ||
      /iPhone [5-8]/.test(navigator.userAgent) ||
      parseInt(navigator.hardwareConcurrency || 0) < 4 ||
      parseInt(navigator.deviceMemory || 8) < 4;

    return isLowEnd;
  }

  static optimizeForDevice() {
    if (this.detect()) {
      // Reduce image quality
      this.imageQuality = 0.7; // Lower JPEG quality
      this.maxImageSize = 1200; // Smaller max dimensions

      // Disable animations
      document.body.classList.add('low-end-device');

      // Clear cache more aggressively
      this.cacheCleanupInterval = 30000; // 30 seconds

      // Monitor memory usage
      this.startMemoryMonitoring();
    }
  }

  static startMemoryMonitoring() {
    setInterval(() => {
      if (performance.memory) {
        const used = performance.memory.usedJSHeapSize;
        const limit = performance.memory.jsHeapSizeLimit;
        const usage = used / limit;

        if (usage > 0.9) {
          // Memory pressure - clear cache
          console.warn('Memory pressure detected, clearing cache');
          window.cacheManager.clearMemoryCache();
        }
      }
    }, this.cacheCleanupInterval);
  }
}
```

---

## 3. Touch Interaction Design

### 3.1 Touch Target Sizes (WCAG 2.1 AAA + Material Design)

**Minimum Sizes**:
- iOS: 44x44pt (HIG guideline)
- Android: 48x48dp (Material Design)
- WCAG AAA: 44x44px minimum

**Implementation**:

```css
/* ============================================================================
   TOUCH TARGET OPTIMIZATION
   ============================================================================ */

/* Drawer close button */
.preview-drawer__close {
  min-width: 48px;
  min-height: 48px;
  padding: 12px;
  margin: 8px; /* Spacing prevents accidental taps */
}

/* Style selection cards */
.style-card {
  min-width: 120px; /* Larger than minimum for better thumb accuracy */
  min-height: 140px;
  margin: 12px 8px; /* Spacing prevents accidental taps */
  cursor: pointer;
}

/* Apply style button */
.preview-drawer__apply-btn {
  min-height: 56px; /* Larger primary action */
  width: 100%;
  padding: 16px 24px;
  font-size: 18px; /* Prevent iOS zoom on focus */
  margin-top: 16px;
}

/* Carousel navigation dots */
.carousel-indicator {
  min-width: 44px;
  min-height: 44px;
  padding: 12px;
  margin: 4px;
}

/* Swipe handle (visual affordance) */
.drawer-handle {
  padding: 16px 0; /* Increase tap area around handle */
  min-height: 48px;
}

/* iOS-specific: Prevent text selection during swipe */
.preview-drawer {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* Thumb zone optimization (bottom 1/3 of screen) */
@media (max-height: 736px) {
  /* iPhone 8 Plus and smaller */
  .preview-drawer__actions {
    position: sticky;
    bottom: 0;
    background: white;
    padding: 16px;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  }
}
```

### 3.2 Scroll Zones (Content Scroll vs Carousel Swipe vs Drawer Dismiss)

**Zone Map**:

```
┌─────────────────────────────────────┐
│  ═══════  ← HANDLE (swipe down)     │ ← Zone 1: Swipe down to dismiss
├─────────────────────────────────────┤
│  × Close                            │ ← Zone 2: Tap to close
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Style Carousel (swipe ←→)     │ │ ← Zone 3: Horizontal swipe only
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Content Area (scroll ↕)       │ │ ← Zone 4: Vertical scroll only
│  │                               │ │
│  │ Processing status...          │ │
│  │ Preview details...            │ │
│  └───────────────────────────────┘ │
│                                     │
│  [Apply Style] ← Tap               │ ← Zone 5: Primary action (no scroll)
└─────────────────────────────────────┘
```

**Implementation**:

```javascript
class GestureZoneManager {
  constructor(drawer) {
    this.drawer = drawer;
    this.zones = {
      handle: drawer.querySelector('.drawer-handle'),
      close: drawer.querySelector('.preview-drawer__close'),
      carousel: drawer.querySelector('.style-carousel'),
      content: drawer.querySelector('.preview-drawer__content'),
      actions: drawer.querySelector('.preview-drawer__actions')
    };

    this.initZoneHandlers();
  }

  initZoneHandlers() {
    // Zone 1: Handle - Swipe down to dismiss
    this.zones.handle.addEventListener('touchstart', (e) => {
      this.handleZone = 'handle';
      // Let BottomSheet handle swipe-down gesture
    });

    // Zone 3: Carousel - Horizontal swipe only
    this.zones.carousel.addEventListener('touchstart', (e) => {
      this.gestureStartX = e.touches[0].clientX;
      this.gestureStartY = e.touches[0].clientY;
    });

    this.zones.carousel.addEventListener('touchmove', (e) => {
      const deltaX = Math.abs(e.touches[0].clientX - this.gestureStartX);
      const deltaY = Math.abs(e.touches[0].clientY - this.gestureStartY);

      // Determine gesture direction
      if (deltaX > deltaY && deltaX > 10) {
        // Horizontal swipe = carousel navigation
        e.preventDefault(); // Prevent vertical scroll
        // ... carousel swipe logic
      }
      // If vertical swipe, let default scroll happen
    }, { passive: false });

    // Zone 4: Content - Vertical scroll only
    this.zones.content.addEventListener('touchstart', (e) => {
      this.contentScrollTop = this.zones.content.scrollTop;
    });

    this.zones.content.addEventListener('touchmove', (e) => {
      // Check if user is at top and swiping down
      if (this.zones.content.scrollTop === 0 &&
          e.touches[0].clientY > this.gestureStartY) {
        // At top and swiping down = dismiss drawer (not scroll)
        // Let BottomSheet handle this
      }
      // Otherwise, let content scroll normally
    }, { passive: true });

    // Zone 5: Actions - No scroll, just tap
    this.zones.actions.addEventListener('touchmove', (e) => {
      e.preventDefault(); // Prevent any scroll
    }, { passive: false });
  }
}
```

### 3.3 iOS Edge Swipe-Back Handling

**Problem**: iOS Safari has swipe-right-from-edge to go back, which conflicts with carousel.

**Solution**: Detect edge zone and disable carousel swipe.

```javascript
class IOSEdgeSwipeHandler {
  constructor() {
    this.edgeZoneWidth = 20; // Left 20px = iOS back gesture zone
  }

  isInEdgeZone(touchX) {
    const screenWidth = window.innerWidth;
    return touchX < this.edgeZoneWidth || touchX > screenWidth - this.edgeZoneWidth;
  }

  handleTouchStart(e) {
    const touchX = e.touches[0].clientX;

    if (this.isInEdgeZone(touchX)) {
      // In iOS edge zone - don't intercept
      return true; // Let iOS handle back gesture
    }

    return false; // Safe to handle carousel swipe
  }
}
```

---

## 4. Network Resilience

### 4.1 Offline Detection

**Strategy**: Detect offline state and show appropriate UI.

```javascript
class NetworkMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.connectionType = this.getConnectionType();

    this.initListeners();
  }

  initListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.showOnlineNotification();
      this.retryFailedRequests();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showOfflineNotification();
    });

    // Monitor connection quality
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', () => {
        this.connectionType = this.getConnectionType();
        this.adaptToConnection();
      });
    }
  }

  getConnectionType() {
    if (!('connection' in navigator)) return 'unknown';

    const conn = navigator.connection;
    const type = conn.effectiveType; // 'slow-2g', '2g', '3g', '4g'

    return type;
  }

  adaptToConnection() {
    if (this.connectionType === 'slow-2g' || this.connectionType === '2g') {
      // Very slow connection - reduce quality
      window.imageQuality = 0.6;
      window.maxImageSize = 1000;
      this.showSlowConnectionWarning();
    } else if (this.connectionType === '3g') {
      // Moderate connection
      window.imageQuality = 0.75;
      window.maxImageSize = 1200;
    } else {
      // Fast connection
      window.imageQuality = 0.85;
      window.maxImageSize = 1500;
    }
  }

  showOfflineNotification() {
    const notification = document.createElement('div');
    notification.className = 'network-notification network-notification--offline';
    notification.innerHTML = `
      <svg><!-- Offline icon --></svg>
      <span>You're offline. Preview will load when connection is restored.</span>
    `;
    document.body.appendChild(notification);
  }

  showOnlineNotification() {
    const notification = document.querySelector('.network-notification--offline');
    if (notification) {
      notification.remove();
    }
  }

  showSlowConnectionWarning() {
    const warning = document.createElement('div');
    warning.className = 'network-notification network-notification--slow';
    warning.innerHTML = `
      <svg><!-- Slow connection icon --></svg>
      <span>Slow connection detected. Reducing image quality for faster loading.</span>
    `;
    document.body.appendChild(warning);

    setTimeout(() => warning.remove(), 5000);
  }
}
```

### 4.2 Retry Strategy for Failed Uploads

**Pattern**: Exponential backoff with max 3 retries.

```javascript
class RetryManager {
  constructor() {
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 second
  }

  async retryWithBackoff(fn, context = 'request') {
    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < this.maxRetries - 1) {
          // Calculate backoff delay: 1s, 2s, 4s
          const delay = this.baseDelay * Math.pow(2, attempt);

          console.log(`${context} failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${delay}ms...`);

          this.showRetryNotification(attempt + 1, delay);

          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    throw new Error(`${context} failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showRetryNotification(attempt, delay) {
    const notification = document.createElement('div');
    notification.className = 'retry-notification';
    notification.innerHTML = `
      <span>Connection issue. Retrying (${attempt}/3) in ${delay/1000}s...</span>
    `;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), delay);
  }
}
```

### 4.3 Progress Indication During Slow Connections

**Strategy**: Realistic progress bars with time estimates.

```javascript
class ProgressIndicator {
  constructor(container) {
    this.container = container;
    this.startTime = null;
    this.estimatedDuration = null;
  }

  start(estimatedDuration = 45000) {
    this.startTime = Date.now();
    this.estimatedDuration = estimatedDuration; // 45 seconds default

    this.render();
    this.updateInterval = setInterval(() => this.update(), 1000);
  }

  render() {
    this.container.innerHTML = `
      <div class="progress-indicator">
        <div class="progress-indicator__bar">
          <div class="progress-indicator__fill" style="width: 0%"></div>
        </div>
        <div class="progress-indicator__text">
          <span class="progress-indicator__message">Processing your pet...</span>
          <span class="progress-indicator__time">About 45 seconds</span>
        </div>
      </div>
    `;
  }

  update() {
    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(95, (elapsed / this.estimatedDuration) * 100);

    const fill = this.container.querySelector('.progress-indicator__fill');
    const timeText = this.container.querySelector('.progress-indicator__time');

    fill.style.width = `${progress}%`;

    const remaining = Math.max(0, this.estimatedDuration - elapsed);
    timeText.textContent = this.formatTimeRemaining(remaining);
  }

  formatTimeRemaining(ms) {
    const seconds = Math.ceil(ms / 1000);

    if (seconds > 60) {
      const minutes = Math.ceil(seconds / 60);
      return `About ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else if (seconds > 10) {
      return `About ${seconds} seconds`;
    } else if (seconds > 0) {
      return `Almost done...`;
    } else {
      return 'Finishing up...';
    }
  }

  complete() {
    clearInterval(this.updateInterval);

    const fill = this.container.querySelector('.progress-indicator__fill');
    fill.style.width = '100%';

    setTimeout(() => {
      this.container.querySelector('.progress-indicator').classList.add('complete');
    }, 300);
  }

  error(message) {
    clearInterval(this.updateInterval);

    this.container.innerHTML = `
      <div class="progress-indicator progress-indicator--error">
        <svg><!-- Error icon --></svg>
        <span>${message}</span>
        <button onclick="retry()">Retry</button>
      </div>
    `;
  }
}
```

### 4.4 Fallback for Timeout Scenarios

**Strategy**: If processing takes >90 seconds, show fallback UI.

```javascript
class TimeoutHandler {
  constructor(timeoutMs = 90000) {
    this.timeoutMs = timeoutMs;
    this.timeoutId = null;
  }

  start(onTimeout) {
    this.timeoutId = setTimeout(() => {
      onTimeout();
    }, this.timeoutMs);
  }

  cancel() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  static showTimeoutFallback(container) {
    container.innerHTML = `
      <div class="timeout-fallback">
        <svg><!-- Clock icon --></svg>
        <h3>Processing is taking longer than expected</h3>
        <p>Your image is still being processed. You can:</p>
        <ul>
          <li>Wait a bit longer (we'll notify you when ready)</li>
          <li>Continue shopping and check back later</li>
          <li>Try uploading a different image</li>
        </ul>
        <div class="timeout-fallback__actions">
          <button class="btn btn--secondary" onclick="continueWaiting()">
            Keep Waiting
          </button>
          <button class="btn btn--primary" onclick="tryDifferentImage()">
            Upload Different Image
          </button>
        </div>
      </div>
    `;
  }
}
```

---

## 5. Device-Specific Optimizations

### 5.1 iOS Safe Area Handling

**Problem**: iPhone X+ has notch and home indicator that overlap content.

**Solution**: Use CSS environment variables.

```css
/* ============================================================================
   iOS SAFE AREA INSETS
   ============================================================================ */

.preview-drawer {
  /* Account for notch at top */
  padding-top: env(safe-area-inset-top);

  /* Account for home indicator at bottom */
  padding-bottom: calc(env(safe-area-inset-bottom) + 16px);
}

.preview-drawer__actions {
  /* Keep action buttons above home indicator */
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

/* Landscape mode - account for left/right notches */
@media (orientation: landscape) {
  .preview-drawer {
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}
```

### 5.2 Android System UI Insets

**Problem**: Android navigation bar can overlap content.

**Solution**: Detect system UI and adjust layout.

```javascript
class AndroidSystemUIManager {
  constructor() {
    this.isAndroid = /Android/i.test(navigator.userAgent);

    if (this.isAndroid) {
      this.adjustForSystemUI();
    }
  }

  adjustForSystemUI() {
    // Check if using gesture navigation (no nav bar) or buttons (has nav bar)
    const hasNavigationBar = window.innerHeight < screen.availHeight;

    if (hasNavigationBar) {
      // Estimate navigation bar height (~48-56dp)
      const navBarHeight = screen.availHeight - window.innerHeight;

      // Add padding to avoid overlap
      document.documentElement.style.setProperty('--android-nav-bar-height', `${navBarHeight}px`);
    }
  }
}
```

```css
/* Android navigation bar spacing */
@supports not (padding: env(safe-area-inset-bottom)) {
  /* Android devices (no safe-area support) */
  .preview-drawer__actions {
    padding-bottom: calc(16px + var(--android-nav-bar-height, 0px));
  }
}
```

### 5.3 Low-End Device Detection

**Strategy**: Detect device capabilities and adjust performance.

```javascript
class DeviceCapabilityDetector {
  static detect() {
    return {
      isLowEnd: this.isLowEndDevice(),
      cores: this.getCPUCores(),
      memory: this.getMemory(),
      connection: this.getConnectionSpeed(),
      supportsWebP: this.supportsWebP(),
      supportsAnimation: this.supportsAnimation()
    };
  }

  static isLowEndDevice() {
    // Check multiple signals
    const signals = [
      parseInt(navigator.hardwareConcurrency || 0) < 4, // Less than 4 cores
      parseInt(navigator.deviceMemory || 8) < 4, // Less than 4GB RAM
      /Android [4-8]/.test(navigator.userAgent), // Old Android
      /iPhone [5-8]/.test(navigator.userAgent) // Old iPhone
    ];

    // Device is low-end if 2+ signals are true
    return signals.filter(Boolean).length >= 2;
  }

  static getCPUCores() {
    return navigator.hardwareConcurrency || 4; // Default to 4 if unknown
  }

  static getMemory() {
    return navigator.deviceMemory || 8; // Default to 8GB if unknown
  }

  static getConnectionSpeed() {
    if ('connection' in navigator) {
      return navigator.connection.effectiveType; // 'slow-2g', '2g', '3g', '4g'
    }
    return 'unknown';
  }

  static supportsWebP() {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    return false;
  }

  static supportsAnimation() {
    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !prefersReducedMotion;
  }
}
```

### 5.4 Reduced Motion Preference

**Strategy**: Respect user's motion preference.

```css
/* ============================================================================
   REDUCED MOTION SUPPORT
   ============================================================================ */

@media (prefers-reduced-motion: reduce) {
  /* Disable all animations */
  .preview-drawer,
  .preview-drawer *,
  .style-carousel {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Use instant transitions */
  .preview-drawer {
    transition: none;
  }

  .style-carousel {
    scroll-behavior: auto; /* Disable smooth scroll */
  }
}
```

```javascript
class ReducedMotionHandler {
  constructor() {
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.prefersReducedMotion) {
      this.disableAnimations();
    }

    // Listen for changes
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.prefersReducedMotion = e.matches;
      if (e.matches) {
        this.disableAnimations();
      } else {
        this.enableAnimations();
      }
    });
  }

  disableAnimations() {
    document.body.classList.add('reduce-motion');

    // Override animation durations
    window.animationDuration = 0;
    window.transitionDuration = 0;
  }

  enableAnimations() {
    document.body.classList.remove('reduce-motion');

    // Restore default durations
    window.animationDuration = 300;
    window.transitionDuration = 300;
  }
}
```

---

## 6. Mobile Testing Matrix

### 6.1 iOS Safari Testing Checklist

**Devices to Test**:
- iPhone 14/15 (iOS 17) - Latest flagship
- iPhone 12/13 (iOS 16) - Common current device
- iPhone 11 (iOS 15) - Popular older device
- iPhone 8 (iOS 14) - Low-end device

**Test Cases**:

| Test Case | Expected Behavior | iOS Safari Specific Issues |
|-----------|------------------|---------------------------|
| **Drawer Open** | Drawer slides up in <300ms, 60fps | Check rubber band scrolling at bottom |
| **Scroll Lock** | Body doesn't scroll when drawer open | Use `position: fixed` technique |
| **Swipe Down** | Drawer dismisses at 100px threshold | Check conflict with pull-to-refresh |
| **Carousel Swipe** | Smooth horizontal swipe, no jank | Test near screen edges (back gesture zone) |
| **iOS Back Swipe** | Edge swipe closes drawer (not carousel) | Left 20px zone should close drawer |
| **Safe Area** | Content not hidden by notch/home indicator | Check on iPhone X+ in portrait/landscape |
| **Keyboard Open** | Drawer adjusts, input visible | Check viewport resize on focus |
| **Image Upload** | Compression works, preview shows | Test with 3000x3000px HEIC image |
| **Progress Bar** | Animates smoothly during 45s processing | Check GPU acceleration |
| **Network Switch** | Handles wifi → cellular transition | Test offline → online recovery |

**iOS Safari Quirks to Verify**:

```javascript
// Test scroll lock fix
function testIOSScrollLock() {
  const drawer = document.querySelector('.preview-drawer');
  const body = document.body;

  // Open drawer
  drawer.classList.add('open');

  // Check body is locked
  console.assert(body.style.position === 'fixed', 'Body should be position: fixed');
  console.assert(body.style.overflow === 'hidden', 'Body should be overflow: hidden');

  // Close drawer
  drawer.classList.remove('open');

  // Check body is unlocked
  console.assert(body.style.position === '', 'Body position should be reset');
  console.assert(window.scrollY > 0, 'Scroll position should be restored');
}

// Test safe area insets
function testSafeAreaInsets() {
  const drawerContent = document.querySelector('.preview-drawer__content');
  const computedStyle = getComputedStyle(drawerContent);

  const topInset = computedStyle.paddingTop;
  const bottomInset = computedStyle.paddingBottom;

  console.log('Safe area top:', topInset); // Should include env(safe-area-inset-top)
  console.log('Safe area bottom:', bottomInset); // Should include env(safe-area-inset-bottom)
}
```

### 6.2 Android Chrome Testing Checklist

**Devices to Test**:
- Samsung Galaxy S23 (Android 13) - Latest flagship
- Google Pixel 6 (Android 12) - Popular current device
- Samsung Galaxy A52 (Android 11) - Mid-range device
- Motorola Moto G (Android 9) - Low-end device

**Test Cases**:

| Test Case | Expected Behavior | Android Chrome Specific Issues |
|-----------|------------------|-------------------------------|
| **Drawer Open** | Drawer slides up in <300ms | Check system nav bar overlap |
| **Tap Outside** | Scrim tap dismisses drawer | Test on devices with gesture navigation |
| **System Back** | Back button closes drawer (not navigate) | Use `history.pushState()` technique |
| **Carousel Swipe** | Smooth horizontal swipe | Test with Chrome's scroll-snap |
| **Touch Targets** | All buttons ≥48dp | Verify with Chrome DevTools touch mode |
| **Network Indicator** | Shows 2G/3G/4G connection type | Use `navigator.connection.effectiveType` |
| **Image Format** | WebP used when supported | Check DevTools Network tab |
| **Low Memory** | Handles <4GB RAM gracefully | Test on Moto G or similar |
| **Dark Mode** | Respects Android dark theme | Check `prefers-color-scheme` |
| **Permissions** | Camera/file picker works | Test both camera and gallery upload |

**Android Chrome Quirks to Verify**:

```javascript
// Test system back button
function testAndroidBackButton() {
  const drawer = document.querySelector('.preview-drawer');

  // Open drawer
  drawer.classList.add('open');

  // Simulate back button press
  history.back();

  // Check drawer is closed
  setTimeout(() => {
    console.assert(!drawer.classList.contains('open'), 'Drawer should close on back button');
  }, 100);
}

// Test connection type detection
function testConnectionDetection() {
  if ('connection' in navigator) {
    const conn = navigator.connection;
    console.log('Connection type:', conn.effectiveType); // '2g', '3g', '4g'
    console.log('Downlink speed:', conn.downlink, 'Mbps');
    console.log('RTT:', conn.rtt, 'ms');
  }
}
```

### 6.3 Cross-Browser Compatibility Matrix

| Feature | iOS Safari 14 | iOS Safari 17 | Chrome Android | Samsung Internet |
|---------|--------------|---------------|----------------|-----------------|
| Bottom Sheet | ✅ | ✅ | ✅ | ✅ |
| Swipe Gestures | ✅ | ✅ | ✅ | ✅ |
| CSS env() | ✅ | ✅ | ✅ | ⚠️ Partial |
| IntersectionObserver | ✅ | ✅ | ✅ | ✅ |
| Touch Events | ✅ | ✅ | ✅ | ✅ |
| WebP Images | ❌ iOS 14 | ✅ iOS 15+ | ✅ | ✅ |
| Backdrop Filter | ✅ | ✅ | ✅ | ⚠️ Slow |
| Navigator.connection | ❌ | ❌ | ✅ | ✅ |
| RequestIdleCallback | ❌ | ✅ | ✅ | ✅ |

### 6.4 Performance Testing Procedure

**Tools**:
- Chrome DevTools Lighthouse (mobile mode)
- WebPageTest (real device testing)
- BrowserStack (cross-device testing)

**Metrics to Measure**:

| Metric | Target | Measurement Tool |
|--------|--------|-----------------|
| Drawer open time | <300ms | Chrome DevTools Performance tab |
| Carousel swipe frame rate | 60fps | `requestAnimationFrame` logging |
| Image upload time (3G) | <8s | Network throttling (400kbps) |
| Background removal time | 30-60s | API response time |
| Style generation time | 10-15s | API response time |
| Total time to cart | <2 minutes | User flow tracking |
| Memory usage (low-end) | <50MB | Chrome DevTools Memory profiler |
| Lighthouse Performance score | >85 | Lighthouse audit |
| Lighthouse Accessibility score | 100 | Lighthouse audit |

**Performance Testing Script**:

```javascript
// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.marks = {};
    this.measures = {};
  }

  mark(name) {
    this.marks[name] = performance.now();
    performance.mark(name);
  }

  measure(name, startMark, endMark) {
    const start = this.marks[startMark];
    const end = this.marks[endMark] || performance.now();
    const duration = end - start;

    this.measures[name] = duration;
    performance.measure(name, startMark, endMark || undefined);

    console.log(`${name}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  getReport() {
    return {
      marks: this.marks,
      measures: this.measures,
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null
    };
  }
}

// Usage
const monitor = new PerformanceMonitor();

// Measure drawer open time
monitor.mark('drawer-open-start');
drawer.open();
requestAnimationFrame(() => {
  monitor.mark('drawer-open-end');
  monitor.measure('drawer-open', 'drawer-open-start', 'drawer-open-end');
});

// Measure carousel swipe smoothness
let frameCount = 0;
let droppedFrames = 0;
let lastFrameTime = performance.now();

function monitorCarouselFrames() {
  const currentTime = performance.now();
  const frameDuration = currentTime - lastFrameTime;

  frameCount++;

  if (frameDuration > 16.67) { // 60fps = 16.67ms per frame
    droppedFrames++;
  }

  lastFrameTime = currentTime;

  if (frameCount < 180) { // Monitor for 3 seconds (180 frames)
    requestAnimationFrame(monitorCarouselFrames);
  } else {
    const fps = 1000 / (currentTime / frameCount);
    const dropRate = (droppedFrames / frameCount) * 100;
    console.log(`Carousel FPS: ${fps.toFixed(2)}, Dropped: ${dropRate.toFixed(2)}%`);
  }
}
```

---

## 7. Implementation Checklist

### Phase 1: Core Drawer Implementation (Week 1)

- [ ] **Extend BottomSheet component for product page**
  - [ ] Create `ProductPagePreviewDrawer` class extending `BottomSheet`
  - [ ] Add product-specific state (pet index, style, processed images)
  - [ ] Implement gesture zone management
  - [ ] Test drawer open/close on iOS Safari 14-17
  - [ ] Test drawer open/close on Android Chrome

- [ ] **Implement style carousel**
  - [ ] Create `StyleCarousel` class with swipe gestures
  - [ ] Add horizontal swipe detection (left/right)
  - [ ] Implement rubber band effect at boundaries
  - [ ] Add visual indicators (dots, active state)
  - [ ] Test carousel swipe smoothness (60fps target)

- [ ] **Add progress indicators**
  - [ ] Create `ProgressIndicator` component
  - [ ] Show realistic time estimates (45s for processing)
  - [ ] Update progress every second
  - [ ] Show "almost done" state at 90%
  - [ ] Test on slow 3G connections

### Phase 2: Performance Optimization (Week 2)

- [ ] **Implement image compression**
  - [ ] Add client-side compression before upload (target <500KB)
  - [ ] Test compression quality (85% JPEG)
  - [ ] Verify compression on iPhone HEIC images
  - [ ] Test on Android gallery images

- [ ] **Add progressive image loading**
  - [ ] Implement blur-up technique (low-res → high-res)
  - [ ] Generate low-res thumbnails (200x200px)
  - [ ] Cache low-res in localStorage
  - [ ] Test on 3G throttled connection

- [ ] **Implement lazy loading for styles**
  - [ ] Only generate styles when visible
  - [ ] Cache generated styles in localStorage
  - [ ] Show skeleton loader while generating
  - [ ] Test memory usage on low-end devices

- [ ] **Add cache management**
  - [ ] Implement memory cache (50MB limit)
  - [ ] Implement localStorage cache (5MB limit)
  - [ ] Add LRU eviction strategy
  - [ ] Clear memory cache on drawer close
  - [ ] Test on devices with limited storage

### Phase 3: Network Resilience (Week 3)

- [ ] **Implement offline detection**
  - [ ] Show offline notification
  - [ ] Queue requests when offline
  - [ ] Retry when connection restored
  - [ ] Test airplane mode → wifi transition

- [ ] **Add retry logic**
  - [ ] Exponential backoff (1s, 2s, 4s)
  - [ ] Max 3 retries
  - [ ] Show retry notifications
  - [ ] Test with flaky network

- [ ] **Add timeout handling**
  - [ ] 90s timeout for processing
  - [ ] Show fallback UI after timeout
  - [ ] Allow user to continue waiting
  - [ ] Test with slow API responses

- [ ] **Implement connection quality adaptation**
  - [ ] Detect 2G/3G/4G connection
  - [ ] Adjust image quality based on speed
  - [ ] Show slow connection warning
  - [ ] Test with Chrome DevTools throttling

### Phase 4: Device-Specific Optimizations (Week 4)

- [ ] **iOS Safari optimizations**
  - [ ] Implement safe area inset handling
  - [ ] Test on iPhone X, 12, 14 (notch devices)
  - [ ] Fix scroll lock (position: fixed technique)
  - [ ] Handle edge swipe-back gesture (left 20px zone)
  - [ ] Test keyboard open behavior

- [ ] **Android Chrome optimizations**
  - [ ] Detect system navigation bar height
  - [ ] Add padding to avoid nav bar overlap
  - [ ] Implement back button handling (history API)
  - [ ] Test on gesture navigation devices
  - [ ] Test on button navigation devices

- [ ] **Low-end device optimizations**
  - [ ] Detect low-end devices (cores, memory)
  - [ ] Disable animations on low-end
  - [ ] Reduce image quality (70% JPEG)
  - [ ] Clear cache more aggressively
  - [ ] Test on iPhone 8, Moto G

- [ ] **Reduced motion support**
  - [ ] Detect prefers-reduced-motion
  - [ ] Disable all animations when enabled
  - [ ] Use instant transitions
  - [ ] Test with OS settings

### Phase 5: Accessibility & Testing (Week 5)

- [ ] **Accessibility implementation**
  - [ ] Add ARIA roles (dialog, region)
  - [ ] Implement focus trap
  - [ ] Add keyboard navigation (Tab, ESC, Arrow keys)
  - [ ] Add screen reader announcements
  - [ ] Test with VoiceOver (iOS)
  - [ ] Test with TalkBack (Android)

- [ ] **Touch target optimization**
  - [ ] Verify all buttons ≥48px
  - [ ] Add spacing between touch targets
  - [ ] Test with Chrome DevTools touch mode
  - [ ] Test on actual devices

- [ ] **Cross-browser testing**
  - [ ] Test on iOS Safari 14, 15, 16, 17
  - [ ] Test on Android Chrome (latest 3 versions)
  - [ ] Test on Samsung Internet
  - [ ] Test on Firefox Mobile (if significant traffic)

- [ ] **Performance testing**
  - [ ] Run Lighthouse audits (mobile mode)
  - [ ] Test with WebPageTest (real devices)
  - [ ] Measure drawer open time (<300ms)
  - [ ] Measure carousel FPS (60fps)
  - [ ] Test memory usage (<50MB)

---

## 8. Success Criteria

**Functional**:
- ✅ Drawer opens in <300ms on all devices
- ✅ Carousel swipes at 60fps with no dropped frames
- ✅ All touch targets ≥48px
- ✅ Works offline (queues requests)
- ✅ Handles slow 3G connections (<400kbps)

**Performance**:
- ✅ Lighthouse Performance score >85
- ✅ Lighthouse Accessibility score 100
- ✅ Memory usage <50MB on low-end devices
- ✅ Image upload <8s on 3G
- ✅ Total time to cart <2 minutes

**Device Compatibility**:
- ✅ iOS Safari 14-17 (all features working)
- ✅ Android Chrome (latest 3 versions)
- ✅ Samsung Internet (core features working)
- ✅ Low-end devices (iPhone 8, Android 9) - reduced animations

**User Experience**:
- ✅ Native-feeling gestures (swipe down, swipe left/right)
- ✅ No scroll lock issues on iOS
- ✅ No gesture conflicts (carousel vs drawer vs iOS back)
- ✅ Clear progress indication during processing
- ✅ Graceful error handling and recovery

---

## 9. Next Steps

1. **Read session context**: Review `.claude/tasks/context_session_001.md` for full context
2. **Review existing code**: Examine `assets/components/bottom-sheet.js` for extension points
3. **Create implementation plan**: Break down each phase into specific tasks
4. **Begin Phase 1**: Start with core drawer implementation for mobile
5. **Test early and often**: Use Chrome DevTools MCP with Shopify test URL

---

**Document Status**: ✅ COMPLETE - Ready for implementation

**File Location**: `.claude/doc/product-page-inline-preview-mobile-spec.md`

**Cross-References**:
- `assets/components/bottom-sheet.js` - Base component to extend
- `assets/components/bottom-sheet.css` - Base styles to build upon
- `.claude/doc/preview-before-purchase-ux-strategy.md` - Overall UX strategy
- `.claude/tasks/context_session_001.md` - Session context

**Author**: mobile-commerce-architect
**Date**: 2025-11-09
**Session**: 001
