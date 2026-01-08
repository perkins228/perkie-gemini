/**
 * Product Mockup Renderer
 * Overlays processed pet images onto product mockups
 * Integrates with pet processor and handles navigation to product pages
 *
 * @version 1.0.0
 */

class ProductMockupRenderer {
  constructor(sectionId) {
    this.sectionId = sectionId;
    this.section = document.querySelector(`#product-mockup-grid-${sectionId}`);
    this.container = this.section?.querySelector('[data-mockup-container]');
    this.itemsContainer = this.section?.querySelector('[data-mockup-items]');
    this.loadingEl = this.section?.querySelector('[data-mockup-loading]');
    this.toggleBtn = this.section?.querySelector('[data-mockup-toggle]');

    this.config = window.productMockupGridConfig?.[sectionId] || {};
    this.currentEffectUrl = null;
    this.currentPetData = null;
    this.isExpanded = false;
    this.isInitialized = false;

    // Don't auto-initialize - wait for pet processing to complete
    this.bindEvents();

    console.log('[ProductMockupRenderer] Initialized, waiting for pet processing');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Listen for pet processing complete event
    document.addEventListener('petProcessingComplete', (e) => {
      console.log('[ProductMockupRenderer] Pet processing complete event received', e.detail);
      this.handleProcessingComplete(e.detail);
    });

    // Listen for effect change events
    document.addEventListener('effectChanged', (e) => {
      if (this.isInitialized && e.detail?.effectUrl) {
        console.log('[ProductMockupRenderer] Effect changed', e.detail);
        this.updateAllMockups(e.detail.effectUrl);
      }
    });

    // Listen for pet cropped events (after user uses crop tool)
    document.addEventListener('petCropped', (e) => {
      if (this.isInitialized && e.detail?.croppedUrl) {
        console.log('[ProductMockupRenderer] Pet cropped', e.detail);
        this.updateAllMockups(e.detail.croppedUrl);

        // Update current effect URL to cropped version
        this.currentEffectUrl = e.detail.croppedUrl;

        // Track crop usage
        this.trackEvent('pet_cropped', {
          effect: e.detail.effect,
          has_session: !!e.detail.sessionKey
        });
      }
    });

    // Bind expand/collapse toggle
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleExpand());
    }

    // Bind product card clicks
    this.bindCardClicks();
  }

  /**
   * Bind click handlers to product cards
   */
  bindCardClicks() {
    if (!this.itemsContainer) return;

    const cards = this.itemsContainer.querySelectorAll('.mockup-card');
    cards.forEach(card => {
      const link = card.querySelector('[data-mockup-link]');
      if (link) {
        link.addEventListener('click', (e) => this.handleCardClick(e, card));
      }
    });
  }

  /**
   * Handle pet processing complete event
   * @param {Object} detail - Event detail with effectUrl, selectedEffect, sessionKey
   */
  async handleProcessingComplete(detail) {
    if (!detail) return;

    const { effectUrl, selectedEffect, sessionKey, effects } = detail;

    // Store pet data for bridge
    this.currentPetData = {
      sessionKey,
      selectedEffect,
      effects,
      timestamp: Date.now()
    };

    // Get the current effect URL
    this.currentEffectUrl = effectUrl || this.getEffectUrlFromPetData(effects, selectedEffect);

    if (!this.currentEffectUrl) {
      console.warn('[ProductMockupRenderer] No effect URL available');
      return;
    }

    // Show the section
    await this.show();

    // Update all pet overlays
    this.updateAllMockups(this.currentEffectUrl);

    this.isInitialized = true;

    // Track analytics
    this.trackEvent('product_grid_displayed', {
      effect: selectedEffect,
      products_count: this.config.products?.length || 0
    });
  }

  /**
   * Extract effect URL from pet data
   * @param {Object} effects - Effects object
   * @param {string} selectedEffect - Selected effect name
   * @returns {string|null} Effect URL
   */
  getEffectUrlFromPetData(effects, selectedEffect) {
    if (!effects) return null;

    // Try selected effect first
    if (effects[selectedEffect]) {
      return effects[selectedEffect].gcsUrl || effects[selectedEffect].dataUrl;
    }

    // Fallback to enhancedblackwhite
    if (effects.enhancedblackwhite) {
      return effects.enhancedblackwhite.gcsUrl || effects.enhancedblackwhite.dataUrl;
    }

    // Fallback to any available effect
    for (const key of Object.keys(effects)) {
      const effect = effects[key];
      if (effect.gcsUrl || effect.dataUrl) {
        return effect.gcsUrl || effect.dataUrl;
      }
    }

    return null;
  }

  /**
   * Show the mockup grid section with animation
   */
  async show() {
    if (!this.section) return;

    // Show loading first
    this.showLoading();

    // Small delay for loading animation
    await this.delay(300);

    // Hide loading, show container
    this.hideLoading();
    this.container?.classList.add('visible');

    // Show section with fade animation
    this.section.style.display = 'block';
    // Force reflow for animation
    this.section.offsetHeight;
    this.section.classList.add('visible');

    // Scroll section into view
    this.scrollIntoView();
  }

  /**
   * Hide the mockup grid section
   */
  hide() {
    if (!this.section) return;

    this.section.classList.remove('visible');
    setTimeout(() => {
      this.section.style.display = 'none';
    }, 500);
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.loadingEl?.classList.add('visible');
    this.container?.classList.remove('visible');
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    this.loadingEl?.classList.remove('visible');
  }

  /**
   * Scroll section into view smoothly
   */
  scrollIntoView() {
    if (!this.section) return;

    // Delay scroll slightly for animation to start
    setTimeout(() => {
      this.section.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 200);
  }

  /**
   * Update all mockup pet overlays with new effect URL
   * @param {string} effectUrl - URL of the processed pet image
   */
  updateAllMockups(effectUrl) {
    if (!this.itemsContainer || !effectUrl) return;

    const petOverlays = this.itemsContainer.querySelectorAll('[data-pet-overlay]');

    petOverlays.forEach((img, index) => {
      // Stagger the reveal for visual effect
      setTimeout(() => {
        img.src = effectUrl;
        img.classList.add('visible');
      }, index * 50);
    });

    this.currentEffectUrl = effectUrl;

    console.log(`[ProductMockupRenderer] Updated ${petOverlays.length} mockups with effect`);
  }

  /**
   * Handle product card click - set up bridge and navigate
   * @param {Event} e - Click event
   * @param {HTMLElement} card - Card element
   */
  handleCardClick(e, card) {
    const productHandle = card.dataset.productHandle;
    const productIndex = parseInt(card.dataset.productIndex, 10);

    // Prepare bridge data for product page
    this.prepareBridgeData();

    // Update the link URL with parameters
    const link = card.querySelector('[data-mockup-link]');
    if (link) {
      const url = new URL(link.href, window.location.origin);
      url.searchParams.set('from', 'processor');
      url.searchParams.set('effect', this.currentPetData?.selectedEffect || 'enhancedblackwhite');
      if (this.currentPetData?.sessionKey) {
        url.searchParams.set('pet_id', this.currentPetData.sessionKey);
      }
      link.href = url.toString();
    }

    // Track click analytics
    this.trackEvent('product_grid_click', {
      product_handle: productHandle,
      product_index: productIndex,
      is_hero: productIndex === 1,
      effect: this.currentPetData?.selectedEffect || 'unknown'
    });

    // Navigation will happen via the link href
  }

  /**
   * Prepare bridge data in sessionStorage for product page
   */
  prepareBridgeData() {
    if (!this.currentPetData) {
      console.warn('[ProductMockupRenderer] No pet data available for bridge');
      return;
    }

    try {
      const bridgeData = {
        sessionKey: this.currentPetData.sessionKey,
        artistNote: '',
        effects: this.currentPetData.effects,
        selectedEffect: this.currentPetData.selectedEffect,
        timestamp: Date.now(),
        source: 'product_mockup_grid'
      };

      // Use sessionStorage for one-time bridge (clears after navigation)
      sessionStorage.setItem('processor_to_product_bridge', JSON.stringify(bridgeData));

      // Also set backup in localStorage
      localStorage.setItem('processor_to_product_bridge_backup', JSON.stringify(bridgeData));

      console.log('[ProductMockupRenderer] Bridge data prepared', bridgeData);
    } catch (error) {
      console.error('[ProductMockupRenderer] Failed to prepare bridge data:', error);
    }
  }

  /**
   * Toggle expand/collapse of additional products (mobile)
   */
  toggleExpand() {
    if (!this.itemsContainer || !this.toggleBtn) return;

    this.isExpanded = !this.isExpanded;

    if (this.isExpanded) {
      this.itemsContainer.classList.add('expanded');
      this.toggleBtn.setAttribute('aria-expanded', 'true');

      // Update toggle text
      const toggleText = this.toggleBtn.querySelector('[data-toggle-text]');
      if (toggleText) {
        toggleText.textContent = this.config.settings?.collapseButtonText || 'Show Less';
      }

      // Track expansion
      this.trackEvent('product_grid_expanded');
    } else {
      this.itemsContainer.classList.remove('expanded');
      this.toggleBtn.setAttribute('aria-expanded', 'false');

      // Update toggle text
      const toggleText = this.toggleBtn.querySelector('[data-toggle-text]');
      if (toggleText) {
        toggleText.textContent = this.config.settings?.expandButtonText || 'See All 10 Products';
      }

      // Scroll back to grid start
      this.scrollIntoView();
    }
  }

  /**
   * Track analytics event
   * @param {string} eventName - Event name
   * @param {Object} properties - Event properties
   */
  trackEvent(eventName, properties = {}) {
    const fullEvent = `mockup_grid_${eventName}`;

    // Google Analytics 4
    if (typeof gtag === 'function') {
      gtag('event', fullEvent, {
        event_category: 'Product Mockup Grid',
        ...properties
      });
    }

    // Shopify Analytics
    if (window.ShopifyAnalytics?.lib?.track) {
      ShopifyAnalytics.lib.track(fullEvent, properties);
    }

    console.log(`[ProductMockupRenderer] Event: ${fullEvent}`, properties);
  }

  /**
   * Utility: Delay helper
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current effect URL (for external access)
   * @returns {string|null}
   */
  getCurrentEffectUrl() {
    return this.currentEffectUrl;
  }

  /**
   * Force show grid with a specific effect URL (for testing/debugging)
   * @param {string} effectUrl - URL of the effect image
   * @param {string} selectedEffect - Effect name
   */
  async forceShow(effectUrl, selectedEffect = 'enhancedblackwhite') {
    this.currentPetData = {
      sessionKey: `debug_${Date.now()}`,
      selectedEffect,
      effects: {
        [selectedEffect]: { gcsUrl: effectUrl }
      },
      timestamp: Date.now()
    };

    await this.show();
    this.updateAllMockups(effectUrl);
    this.isInitialized = true;
  }
}

// =============================================================================
// Auto-initialize on DOM ready
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Find all product mockup grid sections
  const sections = document.querySelectorAll('[data-section-type="ks-product-mockup-grid"]');

  sections.forEach(section => {
    const sectionId = section.dataset.sectionId;
    if (sectionId) {
      // Store instance on window for debugging
      window.productMockupRenderers = window.productMockupRenderers || {};
      window.productMockupRenderers[sectionId] = new ProductMockupRenderer(sectionId);
    }
  });

  console.log(`[ProductMockupRenderer] Initialized ${sections.length} section(s)`);
});

// =============================================================================
// Export for module usage
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductMockupRenderer;
}
