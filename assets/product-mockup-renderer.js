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

    // GPU memory optimization: display-only blob URL (never persisted)
    this._displayBlobUrl = null;
    this._updateGeneration = 0;
    this._mockupObserver = null;
    this._lastThumbnailSourceUrl = null;  // Deduplication: skip re-creating thumbnail for same URL

    // Don't auto-initialize - wait for pet processing to complete
    this.bindEvents();

    // Cleanup blob URLs on page unload to prevent GPU memory leaks
    window.addEventListener('beforeunload', () => {
      if (this._displayBlobUrl) {
        URL.revokeObjectURL(this._displayBlobUrl);
        this._displayBlobUrl = null;
      }
    });

    // Check if returning from product page with preserved session
    this.checkForRestoredSession();

    console.log('[ProductMockupRenderer] Initialized, waiting for pet processing');
  }

  /**
   * Check if user is returning from product page and should restore mockup grid
   * Called during initialization to provide seamless back navigation
   */
  checkForRestoredSession() {
    try {
      // Check URL for return navigation indicator
      const urlParams = new URLSearchParams(window.location.search);
      const isReturning = urlParams.get('from') === 'product' ||
                          sessionStorage.getItem('returning_from_product') === 'true';

      if (!isReturning) {
        return;
      }

      console.log('[ProductMockupRenderer] User returning from product page, checking saved state');

      // Clear the return indicator
      sessionStorage.removeItem('returning_from_product');

      // Check for saved processor state
      const savedState = sessionStorage.getItem('processor_mockup_state');
      if (!savedState) {
        console.log('[ProductMockupRenderer] No saved processor state found');
        return;
      }

      const state = JSON.parse(savedState);

      // Validate state freshness (expire after 30 minutes)
      const MAX_AGE = 30 * 60 * 1000;
      if (Date.now() - state.timestamp > MAX_AGE) {
        console.log('[ProductMockupRenderer] Saved state expired');
        sessionStorage.removeItem('processor_mockup_state');
        return;
      }

      // Restore pet data and show grid
      this.currentPetData = state.petData;
      this.currentEffectUrl = state.effectUrl;

      if (this.currentEffectUrl) {
        console.log('[ProductMockupRenderer] Restoring mockup grid from saved state');

        // Show the section immediately without waiting for pet processing
        this.show();
        this.updateAllMockups(this.currentEffectUrl);
        this.isInitialized = true;

        // Track restoration
        this.trackEvent('session_restored', {
          effect: state.petData?.selectedEffect || 'unknown'
        });
      }
    } catch (error) {
      console.error('[ProductMockupRenderer] Failed to restore session:', error);
      sessionStorage.removeItem('processor_mockup_state');
    }
  }

  /**
   * Save processor state before navigating to product page
   * Enables seamless return navigation without re-processing
   */
  saveProcessorState() {
    if (!this.currentPetData || !this.currentEffectUrl) {
      console.warn('[ProductMockupRenderer] No state to save');
      return;
    }

    try {
      // Read fresh effects from PetStorage (may have Gemini effects added after BiRefNet)
      // This ensures ink_wash and sketch are included in the saved state
      let petDataToSave = this.currentPetData;

      if (typeof window.PetStorage !== 'undefined' && window.PetStorage.get) {
        const storedPet = window.PetStorage.get(this.currentPetData.sessionKey);
        if (storedPet && storedPet.effects) {
          const storedEffectCount = Object.keys(storedPet.effects).length;
          const currentEffectCount = Object.keys(this.currentPetData.effects || {}).length;

          if (storedEffectCount > currentEffectCount) {
            console.log('[ProductMockupRenderer] Using fresh effects from PetStorage for state save:', {
              stored: Object.keys(storedPet.effects),
              current: Object.keys(this.currentPetData.effects || {})
            });
            // Create new object with fresh effects
            petDataToSave = {
              ...this.currentPetData,
              effects: storedPet.effects
            };
          }
        }
      }

      // Guard: never persist blob URLs — they are page-scoped and become invalid after navigation
      var effectUrlToSave = this.currentEffectUrl;
      if (effectUrlToSave && effectUrlToSave.indexOf('blob:') === 0) {
        console.warn('[ProductMockupRenderer] Blocked blob URL from being saved to sessionStorage');
        effectUrlToSave = null;
      }

      const state = {
        petData: petDataToSave,
        effectUrl: effectUrlToSave,
        isExpanded: this.isExpanded,
        timestamp: Date.now()
      };

      sessionStorage.setItem('processor_mockup_state', JSON.stringify(state));
      console.log('[ProductMockupRenderer] Processor state saved for return navigation', {
        effectCount: Object.keys(petDataToSave.effects || {}).length,
        effects: Object.keys(petDataToSave.effects || {})
      });
    } catch (error) {
      console.error('[ProductMockupRenderer] Failed to save processor state:', error);
    }
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

    // Bind carousel navigation (desktop only)
    this.bindCarouselNavigation();

    // Bind product card clicks
    this.bindCardClicks();

    // Bind crop suggestion link
    this.bindCropSuggestionLink();
  }

  /**
   * Bind crop suggestion link click handler
   * Scrolls to and triggers crop button when user clicks "Crop your image" link
   */
  bindCropSuggestionLink() {
    if (!this.section) return;

    const cropLink = this.section.querySelector('[data-scroll-to-crop]');
    if (cropLink) {
      cropLink.addEventListener('click', () => {
        // Find the crop button in the pet processor section
        // Primary selector: .crop-btn (the main crop button in effect grid)
        const cropBtn = document.querySelector('.crop-btn, [data-crop-button], [data-action="crop"]');

        if (cropBtn) {
          // Scroll to the crop button
          cropBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Highlight the button briefly
          cropBtn.classList.add('highlight-pulse');
          setTimeout(() => cropBtn.classList.remove('highlight-pulse'), 2000);

          // Trigger the crop tool after scroll completes
          setTimeout(() => {
            cropBtn.click();
            console.log('[ProductMockupRenderer] Crop button clicked');
          }, 600);

          // Track the interaction
          this.trackEvent('crop_suggestion_clicked', {
            source: 'mockup_grid'
          });
        } else {
          console.warn('[ProductMockupRenderer] Crop button not found - selectors tried: .crop-btn, [data-crop-button], [data-action="crop"]');
        }
      });
    }
  }

  /**
   * Bind carousel navigation buttons (desktop only)
   */
  bindCarouselNavigation() {
    if (!this.section) return;

    const prevBtn = this.section.querySelector('[data-carousel-prev]');
    const nextBtn = this.section.querySelector('[data-carousel-next]');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.scrollCarousel('prev'));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.scrollCarousel('next'));
    }

    // Update button states on scroll
    if (this.itemsContainer) {
      this.itemsContainer.addEventListener('scroll', () => this.updateCarouselButtons());
      // Initial state
      setTimeout(() => this.updateCarouselButtons(), 100);
    }
  }

  /**
   * Scroll carousel in specified direction
   * @param {string} direction - 'prev' or 'next'
   */
  scrollCarousel(direction) {
    if (!this.itemsContainer) return;

    const card = this.itemsContainer.querySelector('.mockup-card');
    if (!card) return;

    const cardWidth = card.offsetWidth + 16; // Include gap
    const scrollAmount = cardWidth * 3; // Scroll 3 cards at a time

    if (direction === 'prev') {
      this.itemsContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      this.itemsContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }

  /**
   * Update carousel navigation button states
   */
  updateCarouselButtons() {
    if (!this.section || !this.itemsContainer) return;

    const prevBtn = this.section.querySelector('[data-carousel-prev]');
    const nextBtn = this.section.querySelector('[data-carousel-next]');

    const scrollLeft = this.itemsContainer.scrollLeft;
    const maxScroll = this.itemsContainer.scrollWidth - this.itemsContainer.clientWidth;

    if (prevBtn) {
      prevBtn.disabled = scrollLeft <= 0;
    }
    if (nextBtn) {
      nextBtn.disabled = scrollLeft >= maxScroll - 1;
    }
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
   * @param {Object} detail - Event detail with effectUrl, selectedEffect, sessionKey, originalUrl
   */
  async handleProcessingComplete(detail) {
    if (!detail) return;

    const { effectUrl, selectedEffect, sessionKey, effects, originalUrl } = detail;

    // Store pet data for bridge (including originalUrl for fulfillment)
    this.currentPetData = {
      sessionKey,
      selectedEffect,
      effects,
      originalUrl: originalUrl || '',  // GCS URL for original image
      timestamp: Date.now()
    };

    console.log('[ProductMockupRenderer] currentPetData SET:', this.currentPetData);

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

    // Save to PetStorage v3 immediately
    // This ensures data persists in localStorage for product page bridge consumption
    console.log('🔍 [ProductMockupRenderer] Checking PetStorage availability:', {
      PetStorageExists: typeof window.PetStorage !== 'undefined',
      savePetExists: typeof window.PetStorage !== 'undefined' && typeof window.PetStorage.savePet === 'function',
      currentPetDataExists: !!this.currentPetData,
      currentPetData: this.currentPetData
    });
    if (typeof window.PetStorage !== 'undefined' && window.PetStorage.savePet && this.currentPetData) {
      // Extract pet number from session key
      // V3 uses slot numbers 1-3, not UUID-style IDs
      // Session key formats: "pet_1_timestamp" (slot) or "pet_960031dd-..." (UUID)
      let petNumber = 1;
      if (this.currentPetData.sessionKey) {
        // Try to extract slot number from formats like "pet_1_timestamp" or "pet_2_abc"
        const slotMatch = this.currentPetData.sessionKey.match(/^pet_(\d)_/);
        if (slotMatch) {
          petNumber = parseInt(slotMatch[1], 10);
        }
        // If no slot pattern found, default to 1 (single-pet processing)
      }
      console.log('[ProductMockupRenderer] Extracted petNumber:', petNumber, 'from sessionKey:', this.currentPetData.sessionKey);

      window.PetStorage.savePet(petNumber, {
        sessionKey: this.currentPetData.sessionKey,
        effects: this.currentPetData.effects,
        selectedEffect: this.currentPetData.selectedEffect,
        originalGcsUrl: this.currentPetData.originalUrl || '',
        processedAt: Date.now()
      });
      console.log('[ProductMockupRenderer] Pet saved to PetStorage v3, petNumber:', petNumber);
    } else {
      console.warn('⚠️ [ProductMockupRenderer] PetStorage save SKIPPED - check conditions above');
    }

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

    // NOTE: Auto-scroll removed to avoid jarring UX on mobile.
    // Users are notified via scroll hint in pet processor section instead.
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
   * Wrap canvas.toBlob in a Promise for async usage
   * @param {HTMLCanvasElement} canvas
   * @param {string} type - MIME type (default image/png for transparency)
   * @param {number} quality - Compression quality (0-1)
   * @returns {Promise<Blob>}
   */
  _canvasToBlob(canvas, type, quality) {
    return new Promise(function(resolve, reject) {
      try {
        canvas.toBlob(function(blob) {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('toBlob returned null'));
          }
        }, type || 'image/png', quality);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Create a downsampled thumbnail blob URL from an effect image URL.
   * Returns a single blob URL that can be shared across all 16 mockup <img> elements,
   * ensuring browsers share one GPU texture instead of allocating 16 separate ones.
   * Uses PNG format to preserve transparency from background removal.
   *
   * @param {string} url - Original effect URL (data URL or GCS URL)
   * @param {number} maxWidth - Maximum thumbnail width in pixels
   * @returns {Promise<string>} - Blob URL for display, or original URL on failure
   */
  createMockupThumbnail(url, maxWidth) {
    var self = this;
    maxWidth = maxWidth || 400;

    return new Promise(function(resolve) {
      var img = new Image();

      // Required for GCS URLs: prevents canvas tainting so toBlob() works
      img.crossOrigin = 'anonymous';

      img.onload = function() {
        try {
          // Calculate proportional dimensions
          var scale = Math.min(1, maxWidth / img.width);
          var newWidth = Math.round(img.width * scale);
          var newHeight = Math.round(img.height * scale);

          // Skip if already small enough (within 20% of target)
          if (scale > 0.8) {
            // Image is close to target size — use object URL from original without resize
            // but still convert data URL → blob URL for GPU deduplication
            if (url.indexOf('data:') === 0) {
              fetch(url).then(function(r) { return r.blob(); }).then(function(blob) {
                resolve(URL.createObjectURL(blob));
              }).catch(function() {
                resolve(url);
              });
              return;
            }
            resolve(url);
            return;
          }

          var canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;
          var ctx = canvas.getContext('2d');

          ctx.imageSmoothingEnabled = true;
          if ('imageSmoothingQuality' in ctx) {
            ctx.imageSmoothingQuality = 'high';
          }
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          // Use PNG to preserve transparency from background removal
          self._canvasToBlob(canvas, 'image/png').then(function(blob) {
            // Release canvas GPU memory immediately
            canvas.width = 0;
            canvas.height = 0;

            var blobUrl = URL.createObjectURL(blob);
            console.log('[ProductMockupRenderer] Thumbnail created: ' + img.width + 'x' + img.height + ' → ' + newWidth + 'x' + newHeight + ' (' + Math.round(blob.size / 1024) + 'KB)');
            resolve(blobUrl);
          }).catch(function(err) {
            // SecurityError from tainted canvas (CORS issue) — graceful degradation
            console.warn('[ProductMockupRenderer] Thumbnail creation failed, using original:', err.message);
            canvas.width = 0;
            canvas.height = 0;
            resolve(url);
          });
        } catch (err) {
          console.warn('[ProductMockupRenderer] Thumbnail error, using original:', err.message);
          resolve(url);
        }
      };

      img.onerror = function() {
        console.warn('[ProductMockupRenderer] Failed to load image for thumbnail, using original URL');
        resolve(url);
      };

      img.src = url;
    });
  }

  /**
   * Apply a display URL to a single mockup overlay image
   * @param {HTMLImageElement} img - The overlay image element
   * @param {string} displayUrl - The blob URL or fallback URL for display
   * @param {string} originalUrl - The original full-resolution URL for data operations
   */
  _applyMockupImage(img, displayUrl, originalUrl) {
    // WARNING: img.src is a display-only blob URL (GPU-optimized thumbnail).
    // For data operations (bridge, cart, session), use data-original-src or PetStorage.
    img.setAttribute('data-original-src', originalUrl);
    img.src = displayUrl;
    img.classList.add('visible');
  }

  /**
   * Update all mockup pet overlays with new effect URL.
   * Creates a downsampled thumbnail and uses IntersectionObserver for lazy rendering.
   * GPU memory reduction: ~97% (79 MB → ~0.5 MB for overlay textures).
   *
   * @param {string} effectUrl - URL of the processed pet image (full resolution)
   */
  updateAllMockups(effectUrl) {
    if (!this.itemsContainer || !effectUrl) return;

    var self = this;

    // ALWAYS preserve the original full-resolution URL for serialization/persistence
    this.currentEffectUrl = effectUrl;

    // Deduplication: skip thumbnail recreation if same source URL and display blob exists
    if (effectUrl === this._lastThumbnailSourceUrl && this._displayBlobUrl) {
      return;
    }
    this._lastThumbnailSourceUrl = effectUrl;

    // Increment generation counter to guard against race conditions from rapid effect switching
    var generation = ++this._updateGeneration;

    // Disconnect any previous IntersectionObserver
    if (this._mockupObserver) {
      this._mockupObserver.disconnect();
      this._mockupObserver = null;
    }

    var petOverlays = this.itemsContainer.querySelectorAll('[data-pet-overlay]');
    if (!petOverlays.length) return;

    // Compute dynamic thumbnail width: card display width × devicePixelRatio, capped at 512px
    var firstCard = this.itemsContainer.querySelector('.mockup-card');
    var cardWidth = firstCard ? firstCard.offsetWidth : 200;
    var dpr = window.devicePixelRatio || 1;
    var thumbnailWidth = Math.min(Math.ceil(cardWidth * dpr), 512);

    // How many cards to load immediately (above fold)
    var isMobile = window.innerWidth < 768;
    var immediateCount = isMobile ? 2 : 4;

    // Create thumbnail asynchronously, then apply to mockup images
    this.createMockupThumbnail(effectUrl, thumbnailWidth).then(function(displayUrl) {
      // Race condition guard: if another updateAllMockups was called while we were
      // creating this thumbnail, discard this stale result
      if (generation !== self._updateGeneration) {
        if (displayUrl !== effectUrl && displayUrl.indexOf('blob:') === 0) {
          URL.revokeObjectURL(displayUrl);
        }
        return;
      }

      // Revoke previous display blob URL to free GPU memory
      if (self._displayBlobUrl && self._displayBlobUrl !== displayUrl) {
        URL.revokeObjectURL(self._displayBlobUrl);
      }
      self._displayBlobUrl = (displayUrl !== effectUrl && displayUrl.indexOf('blob:') === 0) ? displayUrl : null;

      // Load first N cards immediately (above the fold)
      var deferredOverlays = [];
      petOverlays.forEach(function(img, index) {
        if (index < immediateCount) {
          self._applyMockupImage(img, displayUrl, effectUrl);
        } else {
          // Store original URL in data attribute now, but defer loading src
          img.setAttribute('data-original-src', effectUrl);
          img.setAttribute('data-lazy-src', displayUrl);
          deferredOverlays.push(img);
        }
      });

      // Lazy-load remaining cards via IntersectionObserver
      if (deferredOverlays.length > 0 && typeof IntersectionObserver !== 'undefined') {
        self._mockupObserver = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              var img = entry.target;
              var lazySrc = img.getAttribute('data-lazy-src');
              if (lazySrc) {
                img.src = lazySrc;
                img.classList.add('visible');
                img.removeAttribute('data-lazy-src');
              }
              self._mockupObserver.unobserve(img);
            }
          });
        }, {
          rootMargin: '0px 0px 400px 0px'  // 400px preload buffer for fast mobile scroll
        });

        deferredOverlays.forEach(function(img) {
          self._mockupObserver.observe(img);
        });
      } else if (deferredOverlays.length > 0) {
        // Fallback for browsers without IntersectionObserver: stagger load
        deferredOverlays.forEach(function(img, i) {
          setTimeout(function() {
            var lazySrc = img.getAttribute('data-lazy-src');
            if (lazySrc) {
              img.src = lazySrc;
              img.classList.add('visible');
              img.removeAttribute('data-lazy-src');
            }
          }, (i + 1) * 200);
        });
      }

      console.log('[ProductMockupRenderer] Updated ' + petOverlays.length + ' mockups (immediate: ' + immediateCount + ', lazy: ' + deferredOverlays.length + ', thumbnail: ' + thumbnailWidth + 'px)');
    });
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
   * Prepare bridge data for product page navigation
   * Uses PetStorage v3 unified bridge (pointer only, not full data copy)
   */
  prepareBridgeData() {
    console.log('[ProductMockupRenderer] prepareBridgeData called');
    console.log('🔍 [ProductMockupRenderer] Bridge creation check:', {
      PetStorageExists: typeof window.PetStorage !== 'undefined',
      createBridgeExists: typeof window.PetStorage !== 'undefined' && typeof window.PetStorage.createBridge === 'function',
      currentPetData: this.currentPetData
    });

    // Extract pet number from session key or use default
    // V3 uses slot numbers 1-3, not UUID-style IDs
    let petNumber = 1;
    let selectedEffect = this.currentPetData?.selectedEffect || 'enhancedblackwhite';

    if (this.currentPetData?.sessionKey) {
      // Try to extract slot number from formats like "pet_1_timestamp" or "pet_2_abc"
      const slotMatch = this.currentPetData.sessionKey.match(/^pet_(\d)_/);
      if (slotMatch) {
        petNumber = parseInt(slotMatch[1], 10);
      }
      // If no slot pattern found, default to 1 (single-pet processing)
    } else if (typeof window.PetStorage !== 'undefined' && window.PetStorage.getRecentPets) {
      // Fallback: get most recent pet from storage
      const recentPets = window.PetStorage.getRecentPets(1);
      if (recentPets && recentPets.length > 0) {
        petNumber = recentPets[0].petNumber || 1;
        selectedEffect = recentPets[0].selectedEffect || 'enhancedblackwhite';
        console.log('[ProductMockupRenderer] Using recent pet from storage:', petNumber);
      }
    }

    // Create lightweight bridge using PetStorage v3
    // Bridge is just a pointer - product page reads full data from perkie_pets_v3
    if (typeof window.PetStorage !== 'undefined' && window.PetStorage.createBridge) {
      window.PetStorage.createBridge(petNumber, selectedEffect);
      console.log('[ProductMockupRenderer] Bridge created (v3):', { petNumber, selectedEffect });
    } else {
      // Fallback for legacy compatibility
      console.warn('[ProductMockupRenderer] PetStorage.createBridge not available, using legacy bridge');
      sessionStorage.setItem('perkie_bridge', JSON.stringify({
        petNumber: petNumber,
        selectedEffect: selectedEffect,
        timestamp: Date.now()
      }));
    }

    // Save processor state for return navigation
    this.saveProcessorState();
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

  // Debug helper: window.debugMockupRenderers() to check all instances
  window.debugMockupRenderers = function() {
    const renderers = window.productMockupRenderers || {};
    console.log('=== ProductMockupRenderer Debug ===');
    Object.entries(renderers).forEach(function(entry) {
      const id = entry[0];
      const r = entry[1];
      console.log('Section:', id);
      console.log('  currentPetData:', r.currentPetData);
      console.log('  currentEffectUrl:', r.currentEffectUrl);
      console.log('  isInitialized:', r.isInitialized);
    });
    return renderers;
  };
});

// =============================================================================
// Export for module usage
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductMockupRenderer;
}
