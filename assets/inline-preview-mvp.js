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
      this.geminiEnabled = false;

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
      this.closeBtn = this.modal.querySelector('[data-modal-close]');
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
    }

    /**
     * Initialize Gemini AI effects
     */
    async initializeGemini() {
      try {
        if (window.GeminiEffectsUI) {
          // Check if initialize method exists and is a function
          if (typeof window.GeminiEffectsUI.initialize === 'function') {
            await window.GeminiEffectsUI.initialize();
          }

          // Check if isEnabled method exists
          if (typeof window.GeminiEffectsUI.isEnabled === 'function') {
            this.geminiEnabled = window.GeminiEffectsUI.isEnabled();
          } else {
            // Fallback: check if it's already initialized
            this.geminiEnabled = !!window.GeminiEffectsUI;
          }

          console.log('🎨 Gemini AI effects:', this.geminiEnabled ? 'enabled' : 'disabled');
        } else {
          console.log('🎨 Gemini AI effects: not available');
          this.geminiEnabled = false;
        }
      } catch (error) {
        console.warn('🎨 Gemini initialization skipped:', error.message);
        this.geminiEnabled = false;
      }
    }

    /**
     * Open modal
     */
    openModal() {
      this.modal.hidden = false;
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      console.log('🎨 Modal opened');
    }

    /**
     * Close modal
     */
    closeModal() {
      this.modal.hidden = true;
      document.body.style.overflow = ''; // Restore scrolling
      console.log('🎨 Modal closed');
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
     * Process uploaded image
     */
    async processImage(file) {
      this.processingCancelled = false;

      try {
        // Show processing view
        this.showView('processing');

        // Upload to GCS
        console.log('📤 Uploading to GCS...');
        this.updateProgress('Uploading image...', '⏱️ This may take a moment...');

        const gcsUrl = await this.uploadToGCS(file);
        if (this.processingCancelled) return;

        console.log('✅ Uploaded to GCS:', gcsUrl);

        // Process with effects (background removal + color)
        console.log('🎨 Processing with AI...');
        this.updateProgress('Processing with AI...', '⏱️ 30-60 seconds...');

        const effects = await this.removeBackground(gcsUrl);
        if (this.processingCancelled) return;

        console.log('✅ Processing complete:', effects);

        // Store pet data
        this.currentPet = {
          originalImage: gcsUrl,
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
    async removeBackground(imageUrl) {
      const API_URL = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects';

      // Use FormData with POST like pet-processor.js does
      const formData = new FormData();
      formData.append('image_url', imageUrl);

      const response = await fetch(`${API_URL}?return_all_effects=true&effects=enhancedblackwhite,color`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
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
     * Generate AI effects (Modern, Sketch)
     */
    async generateAIEffects(processedUrl) {
      if (!this.geminiEnabled || !window.GeminiEffectsUI) {
        return;
      }

      this.updateProgress('Generating AI styles...', '⏱️ 10-15 seconds per style...');

      try {
        // Generate Modern effect
        const modernUrl = await window.GeminiEffectsUI.generateEffect(processedUrl, 'modern');
        if (modernUrl && !this.processingCancelled) {
          this.currentPet.effects.modern = modernUrl;
        }

        // Generate Sketch effect
        const sketchUrl = await window.GeminiEffectsUI.generateEffect(processedUrl, 'sketch');
        if (sketchUrl && !this.processingCancelled) {
          this.currentPet.effects.sketch = sketchUrl;
        }
      } catch (error) {
        console.error('⚠️ AI effects generation failed:', error);
        // Continue even if AI effects fail
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

      // Reset active effect
      this.effectBtns.forEach((btn, index) => {
        btn.classList.toggle('active', index === 0);
      });

      // Show upload view
      this.showView('upload');
    }
  }

})();
