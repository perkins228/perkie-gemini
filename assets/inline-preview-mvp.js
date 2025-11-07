/**
 * Inline Preview MVP - Phase 1 JavaScript
 * Simplified version of pet-processor.js for product page modal
 * Reuses existing APIs and utilities
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Check if inline preview is enabled
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('inline_preview') === 'false') {
      console.log('🎨 Inline preview disabled by URL parameter');
      return;
    }

    const modal = document.getElementById('inline-preview-modal');
    if (!modal) {
      console.warn('🎨 Inline preview modal not found');
      return;
    }

    // Initialize inline preview
    window.inlinePreview = new InlinePreview(modal);
  }

  /**
   * InlinePreview Class
   * Manages the inline preview modal functionality
   */
  class InlinePreview {
    constructor(modal) {
      this.modal = modal;
      this.currentPet = null;
      this.currentEffect = 'enhancedblackwhite';
      this.processingCancelled = false;
      this.scrollPosition = 0; // Track scroll position for modal

      // Gemini AI integration (matches pet-processor.js pattern)
      this.geminiClient = null;
      this.geminiUI = null;
      this.geminiEnabled = false;
      this.geminiGenerating = false;

      // Store original modal position for restoration
      this.originalParent = modal.parentElement;
      this.originalNextSibling = modal.nextSibling;

      // Cache DOM elements
      this.cacheElements();

      // Initialize
      this.setupEventListeners();
      this.initializeGemini();

      console.log('🎨 Inline preview initialized');
    }

    /**
     * Cache all DOM elements
     */
    cacheElements() {
      // Modal controls
      this.triggerBtn = document.querySelector('[data-open-preview]');
      this.closeBtn = this.modal.querySelector('.inline-preview-close');
      this.backdrop = this.modal.querySelector('.inline-preview-backdrop');

      // Views
      this.uploadZone = this.modal.querySelector('.inline-upload-zone');
      this.processingView = this.modal.querySelector('.inline-processing-view');
      this.effectGridWrapper = this.modal.querySelector('.inline-effect-grid-wrapper');
      this.actionButtons = this.modal.querySelector('.inline-action-buttons');
      this.resultView = this.modal.querySelector('.inline-result-view');
      this.placeholder = this.modal.querySelector('.inline-preview-placeholder');
      this.errorView = this.modal.querySelector('.inline-error-view');

      // Inputs
      this.fileInput = this.modal.querySelector('#inline-pet-upload');
      this.effectBtns = this.modal.querySelectorAll('[data-effect]');
      this.petImage = this.modal.querySelector('.inline-pet-image');

      // Artist notes
      this.artistNotesSection = this.modal.querySelector('.inline-artist-notes-section');
      this.artistNotesInput = this.modal.querySelector('#inline-artist-notes');
      this.charCount = this.modal.querySelector('#inline-char-count');

      // Buttons
      this.cancelBtn = this.modal.querySelector('[data-cancel-processing]');
      this.addToCartBtn = this.modal.querySelector('.inline-add-to-cart-btn');
      this.tryAgainBtn = this.modal.querySelector('.inline-try-again-btn');

      // Progress elements
      this.processingText = this.modal.querySelector('.inline-processing-text');
      this.progressTimer = this.modal.querySelector('.inline-progress-timer');
      this.progressStageInfo = this.modal.querySelector('.inline-progress-stage-info');
      this.errorMessage = this.modal.querySelector('.inline-error-message');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
      // Open modal
      if (this.triggerBtn) {
        this.triggerBtn.addEventListener('click', () => this.openModal());
      }

      // Close modal
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.closeModal());
      }
      if (this.backdrop) {
        this.backdrop.addEventListener('click', () => this.closeModal());
      }

      // ESC key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.modal.hidden) {
          this.closeModal();
        }
      });

      // File upload
      if (this.fileInput) {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
      }

      // Effect selection
      this.effectBtns.forEach(btn => {
        btn.addEventListener('click', () => this.handleEffectSelect(btn));
      });

      // Cancel processing
      if (this.cancelBtn) {
        this.cancelBtn.addEventListener('click', () => this.cancelProcessing());
      }

      // Add to cart
      if (this.addToCartBtn) {
        this.addToCartBtn.addEventListener('click', () => this.addToCart());
      }

      // Try again
      if (this.tryAgainBtn) {
        this.tryAgainBtn.addEventListener('click', () => this.reset());
      }

      // Artist notes character counter
      if (this.artistNotesInput && this.charCount) {
        this.artistNotesInput.addEventListener('input', (e) => {
          this.charCount.textContent = e.target.value.length;
        });
      }
    }

    /**
     * Initialize Gemini AI effects integration
     * Pattern extracted from pet-processor.js (lines 922-968)
     */
    initializeGemini() {
      try {
        // Check if Gemini modules are available in global scope
        if (typeof GeminiAPIClient === 'undefined' || typeof GeminiEffectsUI === 'undefined') {
          console.log('🎨 Gemini modules not loaded - AI effects disabled');
          this.geminiEnabled = false;
          return;
        }

        // Initialize Gemini client (constructor checks localStorage 'gemini_enabled' flag)
        this.geminiClient = new GeminiAPIClient();
        this.geminiEnabled = this.geminiClient.enabled;

        if (this.geminiEnabled) {
          console.log('🎨 Gemini AI effects enabled - Modern and Sketch styles available');

          // Initialize UI after modal container is rendered
          // Delay ensures DOM is ready for banner/UI elements
          setTimeout(() => {
            if (!this.modal) {
              console.warn('🎨 Modal not ready for Gemini UI initialization');
              return;
            }

            // Create UI manager with client instance
            this.geminiUI = new GeminiEffectsUI(this.geminiClient);

            // Initialize UI elements (banner, quota display, etc.)
            this.geminiUI.initialize(this.modal);

            // Start midnight quota reset checker (24h interval)
            if (typeof this.geminiUI.checkQuotaReset === 'function') {
              this.geminiUI.checkQuotaReset();
            }

            console.log('🎨 Gemini UI initialized successfully');
          }, 100);
        } else {
          console.log('🎨 Gemini AI effects disabled by feature flag (localStorage.gemini_enabled = false)');
          this.geminiEnabled = false;
        }
      } catch (error) {
        console.error('🎨 Failed to initialize Gemini:', error);
        this.geminiEnabled = false;
        this.geminiClient = null;
        this.geminiUI = null;
      }
    }

    /**
     * Open modal
     */
    openModal() {
      // Store current scroll position
      this.scrollPosition = window.pageYOffset;

      // CRITICAL: Move modal to be direct child of body
      // This ensures position:fixed works relative to viewport, not nested container
      document.body.appendChild(this.modal);

      // Show modal
      this.modal.hidden = false;

      // Lock background scroll using position:fixed trick
      // Modal stays centered via CSS flexbox (no manual positioning needed)
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this.scrollPosition}px`;
      document.body.style.width = '100%';
      document.body.style.left = '0';
      document.body.style.right = '0';

      // NO modal position manipulation - CSS flexbox handles centering

      console.log('🎨 Modal opened (centered), background scroll locked at:', this.scrollPosition);
    }

    /**
     * Close modal
     */
    closeModal() {
      this.modal.hidden = true;

      // Restore body position and scroll
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.left = '';
      document.body.style.right = '';

      // Restore scroll position
      window.scrollTo(0, this.scrollPosition);

      // Restore modal to original position in DOM
      if (this.originalParent) {
        if (this.originalNextSibling) {
          this.originalParent.insertBefore(this.modal, this.originalNextSibling);
        } else {
          this.originalParent.appendChild(this.modal);
        }
      }

      console.log('🎨 Modal closed, scroll restored to:', this.scrollPosition);
    }

    /**
     * Handle file selection
     */
    async handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      // Validate file
      const validation = this.validateFile(file);
      if (!validation.valid) {
        this.showError(validation.error);
        return;
      }

      // Process the image
      await this.processImage(file);
    }

    /**
     * Validate uploaded file
     */
    validateFile(file) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

      if (!allowedTypes.includes(file.type)) {
        return {
          valid: false,
          error: 'Please upload a JPG, PNG, or WebP image'
        };
      }

      if (file.size > maxSize) {
        return {
          valid: false,
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum 10MB`
        };
      }

      return { valid: true };
    }

    /**
     * Correct image orientation based on EXIF data
     * Uses blueimp-load-image library to auto-rotate images
     */
    async correctImageOrientation(file) {
      // Check if library is loaded
      if (typeof loadImage === 'undefined') {
        console.warn('🔄 blueimp-load-image not loaded, skipping orientation correction');
        return file;
      }

      // Skip orientation correction for non-JPEG files (PNG/WebP don't have EXIF)
      if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
        console.log('🔄 Non-JPEG file, skipping orientation correction');
        return file;
      }

      return new Promise((resolve, reject) => {
        loadImage(
          file,
          (canvas) => {
            // Check if canvas is valid
            if (canvas.type === 'error') {
              console.warn('🔄 Failed to load image for orientation correction');
              resolve(file); // Return original file on error
              return;
            }

            // Convert canvas to blob then to File
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  console.warn('🔄 Failed to convert canvas to blob');
                  resolve(file);
                  return;
                }

                // Create new File object with corrected orientation
                const correctedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });

                console.log('✅ Image orientation corrected');
                resolve(correctedFile);
              },
              'image/jpeg',
              0.95
            );
          },
          {
            orientation: true,  // Auto-orient based on EXIF
            canvas: true,       // Return canvas (not img element)
            maxWidth: 3000,     // Limit size to prevent memory issues
            maxHeight: 3000
          }
        );
      });
    }

    /**
     * Process uploaded image
     */
    async processImage(file) {
      this.processingCancelled = false;

      try {
        // Show processing view
        this.showView('processing');

        // Correct image orientation based on EXIF metadata
        console.log('🔄 Correcting image orientation...');
        this.updateProgress('Preparing image...', '⏱️ A few seconds...');
        const correctedFile = await this.correctImageOrientation(file);
        if (this.processingCancelled) return;

        // Process with effects directly (no GCS upload needed initially)
        console.log('🎨 Processing with AI...');
        this.updateProgress('Processing with AI...', '⏱️ 30-60 seconds...');

        const effects = await this.removeBackground(correctedFile);
        if (this.processingCancelled) return;

        console.log('✅ Processing complete:', effects);

        // Store pet data with data URLs initially
        this.currentPet = {
          originalImage: null, // Will set if we upload to GCS later
          processedImage: effects.enhancedblackwhite || effects.color,
          effects: {
            enhancedblackwhite: effects.enhancedblackwhite,
            color: effects.color
          }
        };

        // Generate AI effects if enabled
        if (this.geminiEnabled) {
          await this.generateAIEffects(this.currentPet.processedImage);
        }

        // Show result
        this.showResult();

      } catch (error) {
        console.error('❌ Processing error:', error);
        this.showError(error.message || 'Failed to process image. Please try again.');
      }
    }

    /**
     * Upload file to Google Cloud Storage
     */
    async uploadToGCS(file) {
      // Use existing PetStorage utility if available
      if (window.PetStorage && window.PetStorage.uploadToGCS) {
        return await window.PetStorage.uploadToGCS(file);
      }

      // Fallback: Convert to data URL (not ideal for production)
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    }

    /**
     * Remove background using InSPyReNet API
     * Uses /api/v2/process-with-effects endpoint like pet-processor.js
     */
    async removeBackground(file) {
      const API_URL = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects';

      // Use FormData with POST like pet-processor.js does
      const formData = new FormData();
      formData.append('file', file); // Changed from 'image_url' to 'file'
      // Effects specified in URL query string (NOT in FormData - API expects query params)

      const response = await fetch(`${API_URL}?return_all_effects=true&effects=enhancedblackwhite,color`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Background removal failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.effects) {
        throw new Error('No processed effects returned');
      }

      // API returns base64 data for each effect
      const effects = {};
      for (const [effectName, base64Data] of Object.entries(result.effects)) {
        effects[effectName] = `data:image/png;base64,${base64Data}`;
      }

      return effects;
    }

    /**
     * Generate AI effects (Modern + Sketch) using Gemini API
     * Pattern extracted from pet-processor.js (lines 1352-1430)
     * Uses batch generation for efficiency (both effects in ~10s vs 20s sequential)
     */
    async generateAIEffects(processedUrl) {
      // Guard: Check if Gemini is enabled and client exists
      if (!this.geminiEnabled || !this.geminiClient) {
        console.log('🎨 Gemini disabled or not initialized - skipping AI effects');
        return;
      }

      try {
        // Set generation flag (allows tracking in-progress state)
        this.geminiGenerating = true;

        // Update progress UI
        this.updateProgress('Generating AI styles...', '⏱️ ~10 seconds for both styles...');
        console.log('🎨 Starting Gemini batch generation for Modern + Sketch styles');

        // Ensure processedUrl is a data URL (Gemini API requires base64 data URLs)
        let imageDataUrl = processedUrl;
        if (!processedUrl.startsWith('data:image/')) {
          // If it's a base64 string without prefix, add it
          imageDataUrl = `data:image/png;base64,${processedUrl}`;
        }

        // Generate session ID for caching/deduplication
        // Uses timestamp + random string for uniqueness
        const sessionId = `inline-preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Batch generate both Modern and Sketch styles (single API call)
        // Returns: {modern: {url, cacheHit, processingTime}, sketch: {...}, quota: {...}}
        const geminiResults = await this.geminiClient.batchGenerate(imageDataUrl, {
          sessionId: sessionId
        });

        // Store Modern effect with full metadata
        if (geminiResults.modern && geminiResults.modern.url) {
          this.currentPet.effects.modern = geminiResults.modern.url;

          // Store metadata if needed for analytics
          if (!this.currentPet.effectsMeta) {
            this.currentPet.effectsMeta = {};
          }
          this.currentPet.effectsMeta.modern = {
            cacheHit: geminiResults.modern.cacheHit,
            processingTime: geminiResults.modern.processingTime
          };

          console.log('🎨 Modern effect generated:',
            geminiResults.modern.cacheHit ? 'cache hit' : 'newly generated',
            `(${geminiResults.modern.processingTime}ms)`
          );

          // Update thumbnail immediately (progressive enhancement)
          this.populateEffectThumbnails();
        }

        // Store Sketch effect with full metadata
        if (geminiResults.sketch && geminiResults.sketch.url) {
          this.currentPet.effects.sketch = geminiResults.sketch.url;

          // Store metadata
          if (!this.currentPet.effectsMeta) {
            this.currentPet.effectsMeta = {};
          }
          this.currentPet.effectsMeta.sketch = {
            cacheHit: geminiResults.sketch.cacheHit,
            processingTime: geminiResults.sketch.processingTime
          };

          console.log('🎨 Sketch effect generated:',
            geminiResults.sketch.cacheHit ? 'cache hit' : 'newly generated',
            `(${geminiResults.sketch.processingTime}ms)`
          );

          // Update thumbnail immediately
          this.populateEffectThumbnails();
        }

        // Update quota state if returned
        if (geminiResults.quota && this.geminiUI) {
          console.log('🎨 Gemini quota updated:', geminiResults.quota);

          // Update UI with new quota (banner, counter, etc.)
          if (typeof this.geminiUI.updateUI === 'function') {
            this.geminiUI.updateUI();
          }
        }

        // Success logging
        console.log('✅ Gemini AI effects generation complete:', {
          modern: geminiResults.modern?.cacheHit ? 'cached' : 'generated',
          sketch: geminiResults.sketch?.cacheHit ? 'cached' : 'generated',
          totalTime: (geminiResults.modern?.processingTime || 0) + (geminiResults.sketch?.processingTime || 0),
          quota: geminiResults.quota
        });

        // Reset generation flag
        this.geminiGenerating = false;

      } catch (error) {
        // Reset generation flag on error
        this.geminiGenerating = false;

        console.error('🎨 Gemini generation failed (graceful degradation):', error);

        // Graceful degradation - users still have B&W and Color effects
        // Don't throw error, just log it

        // Check if quota was exhausted
        if (error.quotaExhausted) {
          console.warn('⚠️ Gemini quota exhausted - only B&W and Color available today');

          // Update UI to show quota exhausted state
          if (this.geminiUI && typeof this.geminiUI.updateUI === 'function') {
            this.geminiUI.updateUI();
          }
        }

        // Check if it's a network error
        if (error.message && error.message.includes('network')) {
          console.warn('⚠️ Network error during Gemini generation - check connectivity');
        }
      }
    }

    /**
     * Handle effect selection
     */
    handleEffectSelect(btn) {
      const effect = btn.dataset.effect;

      // Update active state
      this.effectBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update preview image
      this.currentEffect = effect;
      const effectUrl = this.currentPet?.effects[effect];

      if (effectUrl) {
        this.petImage.src = effectUrl;
      }

      console.log('🎨 Effect selected:', effect);
    }

    /**
     * Populate effect grid thumbnails with processed images
     */
    populateEffectThumbnails() {
      if (!this.currentPet || !this.currentPet.effects) {
        console.warn('🎨 No effects available for thumbnails');
        return;
      }

      // Map effect names to data-effect attributes
      const effectMapping = {
        'enhancedblackwhite': 'enhancedblackwhite',
        'color': 'color',
        'modern': 'modern',
        'sketch': 'sketch'
      };

      // Set thumbnail image for each available effect
      Object.keys(this.currentPet.effects).forEach(effectName => {
        const effectUrl = this.currentPet.effects[effectName];
        const effectKey = effectMapping[effectName];

        if (!effectUrl || !effectKey) return;

        // Find the button and its image
        const btn = this.modal.querySelector(`[data-effect="${effectKey}"]`);
        if (btn) {
          const thumbnail = btn.querySelector('.inline-effect-image');
          if (thumbnail) {
            thumbnail.src = effectUrl;
            console.log(`🎨 Thumbnail set for ${effectName}`);
          }
        }
      });
    }

    /**
     * Update progress display
     */
    updateProgress(text, timer = '') {
      if (this.processingText) {
        this.processingText.textContent = text;
      }
      if (this.progressTimer && timer) {
        this.progressTimer.textContent = timer;
      }
    }

    /**
     * Cancel processing
     */
    cancelProcessing() {
      this.processingCancelled = true;
      this.reset();
      console.log('❌ Processing cancelled');
    }

    /**
     * Show result view
     */
    showResult() {
      // Set initial image (default effect)
      const initialEffect = this.currentPet.effects[this.currentEffect];
      this.petImage.src = initialEffect;

      // Populate effect grid thumbnails
      this.populateEffectThumbnails();

      // Show artist notes section
      if (this.artistNotesSection) {
        this.artistNotesSection.hidden = false;
      }

      // Show result view
      this.showView('result');

      console.log('✅ Processing complete');
    }

    /**
     * Add to cart
     */
    async addToCart() {
      try {
        console.log('🛒 Adding to cart...');

        // Get current product form
        const productForm = document.querySelector('form[action="/cart/add"]');
        if (!productForm) {
          throw new Error('Product form not found');
        }

        // Get form data
        const formData = new FormData(productForm);

        // Add pet image properties
        const currentEffectUrl = this.currentPet.effects[this.currentEffect];

        formData.append('properties[_pet_1_processed_image_url]', currentEffectUrl);
        formData.append('properties[_pet_1_style]', this.currentEffect);
        formData.append('properties[_pet_1_original_image_url]', this.currentPet.originalImage);

        // Add artist notes if provided
        if (this.artistNotesInput && this.artistNotesInput.value.trim()) {
          const sanitizedNotes = this.artistNotesInput.value
            .substring(0, 500) // Limit to 500 chars
            .replace(/<[^>]*>/g, '') // Strip HTML tags
            .trim();

          if (sanitizedNotes) {
            formData.append('properties[_artist_notes]', sanitizedNotes);
            console.log(`✅ Artist notes: "${sanitizedNotes.substring(0, 50)}${sanitizedNotes.length > 50 ? '...' : ''}"`);
          }
        }

        // Submit to cart
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Failed to add to cart');
        }

        console.log('✅ Added to cart');

        // Close modal and show success
        this.closeModal();
        alert('Your custom pet portrait has been added to cart!');

        // Refresh cart
        if (window.theme && window.theme.cart) {
          window.theme.cart.refresh();
        }

      } catch (error) {
        console.error('❌ Add to cart error:', error);
        this.showError('Failed to add to cart. Please try again.');
      }
    }

    /**
     * Show specific view
     */
    showView(viewName) {
      // Hide all views
      if (this.uploadZone) this.uploadZone.hidden = true;
      if (this.processingView) this.processingView.hidden = true;
      if (this.effectGridWrapper) this.effectGridWrapper.hidden = true;
      if (this.actionButtons) this.actionButtons.hidden = true;
      if (this.resultView) this.resultView.hidden = true;
      if (this.placeholder) this.placeholder.hidden = true;
      if (this.errorView) this.errorView.hidden = true;

      // Show requested view
      switch (viewName) {
        case 'upload':
          if (this.uploadZone) this.uploadZone.hidden = false;
          if (this.placeholder) this.placeholder.hidden = false;
          break;

        case 'processing':
          if (this.processingView) this.processingView.hidden = false;
          if (this.placeholder) this.placeholder.hidden = false;
          break;

        case 'result':
          if (this.effectGridWrapper) this.effectGridWrapper.hidden = false;
          if (this.actionButtons) this.actionButtons.hidden = false;
          if (this.resultView) this.resultView.hidden = false;
          break;

        case 'error':
          if (this.uploadZone) this.uploadZone.hidden = false;
          if (this.errorView) this.errorView.hidden = false;
          if (this.placeholder) this.placeholder.hidden = false;
          break;
      }
    }

    /**
     * Show error
     */
    showError(message) {
      if (this.errorMessage) {
        this.errorMessage.textContent = message;
      }
      this.showView('error');
      console.error('❌ Error:', message);
    }

    /**
     * Reset to initial state
     */
    reset() {
      this.currentPet = null;
      this.currentEffect = 'enhancedblackwhite';
      this.processingCancelled = false;

      // Reset file input
      if (this.fileInput) {
        this.fileInput.value = '';
      }

      // Reset artist notes
      if (this.artistNotesInput) {
        this.artistNotesInput.value = '';
      }
      if (this.charCount) {
        this.charCount.textContent = '0';
      }

      // Reset active effect
      this.effectBtns.forEach((btn, index) => {
        btn.classList.toggle('active', index === 0);
      });

      // Show upload view
      this.showView('upload');
    }
  }

})();
