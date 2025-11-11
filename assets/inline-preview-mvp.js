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

      // Countdown timer properties
      this.countdownTimer = null;
      this.startTime = null;
      this.estimatedTime = null;

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
      this.continueBtn = this.modal.querySelector('.inline-continue-btn');
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

      // Continue button - saves pet data and closes modal
      if (this.continueBtn) {
        this.continueBtn.addEventListener('click', () => this.savePetDataAndClose());
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
      // Initialize pet metadata with defaults if not already set (e.g., direct upload)
      if (!this.petNumber) {
        this.petNumber = 1; // Default to Pet 1
      }
      if (!this.petName) {
        this.petName = 'Your Pet'; // Default name
      }

      // Clear artist notes from previous pet (prevent carryover)
      if (this.artistNotesInput) {
        this.artistNotesInput.value = '';
        if (this.charCount) {
          this.charCount.textContent = '0';
        }
      }

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
     * Update modal header with pet name
     * @param {number} petNumber - Pet number (1, 2, 3)
     * @param {string} petName - Pet name
     */
    updateHeader(petNumber, petName) {
      const titleElement = document.getElementById('inline-preview-title');
      const subtitleElement = document.getElementById('inline-preview-subtitle');

      if (titleElement) {
        titleElement.textContent = `Preview Pet ${petNumber}: ${petName}'s Portrait`;
      }

      // Hide subtitle - removed redundant product title display
      if (subtitleElement) {
        subtitleElement.style.display = 'none';
      }

      console.log(`🎨 Header updated: Pet ${petNumber} - ${petName}`);
    }

    /**
     * Open modal with pre-populated pet data (called from pet-selector)
     * @param {Object} data - Pet data object
     * @param {number} data.petNumber - Pet number (1, 2, 3)
     * @param {string} data.petName - Pet name
     * @param {string} data.imageUrl - Image URL (GCS or data URL)
     * @param {boolean} data.isGcsUrl - Whether imageUrl is a GCS URL
     */
    async openWithData(data) {
      console.log('🎨 Opening inline preview with data:', data);

      // Store pet metadata
      this.petNumber = data.petNumber;
      this.petName = data.petName;

      // Open the modal
      this.openModal();

      // Update header with pet name
      this.updateHeader(data.petNumber, data.petName);

      // Hide upload zone since image is already uploaded
      if (this.uploadZone) {
        this.uploadZone.hidden = true;
      }

      try {
        // Convert URL to File object for processing
        const file = await this.urlToFile(data.imageUrl, `pet-${data.petNumber}.jpg`);

        // Start processing
        await this.processImage(file);

      } catch (error) {
        console.error('❌ Failed to load image:', error);
        this.showError('Failed to load pet image. Please try again.');
      }
    }

    /**
     * Convert URL (GCS or data URL) to File object
     */
    async urlToFile(url, filename) {
      // If it's a data URL, convert directly
      if (url.startsWith('data:')) {
        const res = await fetch(url);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type });
      }

      // If it's a GCS URL, fetch it
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type });
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

      // Initialize warmth tracker outside try block for error recording
      const warmthTracker = new window.APIWarmthTracker();
      let startTime = null;

      try {
        // Show processing view
        this.showView('processing');

        // Correct image orientation based on EXIF metadata
        console.log('🔄 Correcting image orientation...');
        this.updateProgress('Preparing image...', '⏱️ A few seconds...');
        const correctedFile = await this.correctImageOrientation(file);
        if (this.processingCancelled) return;

        // Detect API warmth for accurate countdown (both InSPyReNet and Gemini)
        // Wrapped in try/catch for Safari private mode and disabled localStorage
        let inspyreNetWarm = false;
        let geminiWarm = false;
        let isFirstTime = false;

        try {
          inspyreNetWarm = warmthTracker.getServiceWarmth('inspirenet');
          geminiWarm = warmthTracker.getServiceWarmth('gemini');
          isFirstTime = warmthTracker.isFirstTimeUser();
        } catch (error) {
          console.warn('⚠️ Warmth detection failed (localStorage disabled?), assuming cold APIs:', error);
          // Defaults already set to false/cold - safe fallback
        }

        const geminiEnabled = this.geminiEnabled;

        // Calculate accurate estimated time based on BOTH API warmth states
        let estimatedTime;

        if (isFirstTime) {
          // First-time user: Both APIs cold + extra overhead
          estimatedTime = geminiEnabled ? 70000 : 45000; // 70s with Gemini, 45s without
          console.log('👋 First-time processing mode (both APIs cold):', estimatedTime / 1000 + 's');
        } else if (inspyreNetWarm && geminiWarm && geminiEnabled) {
          // Both APIs warm - best case scenario
          estimatedTime = 18000; // 18 seconds
          console.log('⚡⚡ Ultra-fast mode (both APIs warm):', estimatedTime / 1000 + 's');
        } else if (inspyreNetWarm && !geminiEnabled) {
          // Only InSPyReNet needed and it's warm
          estimatedTime = 8000; // 8 seconds
          console.log('⚡ Fast mode (InSPyReNet warm, no AI effects):', estimatedTime / 1000 + 's');
        } else if (inspyreNetWarm && !geminiWarm && geminiEnabled) {
          // InSPyReNet warm, but Gemini cold
          estimatedTime = 28000; // 8s InSPyReNet + 20s Gemini cold
          console.log('⚡❄️ Mixed mode (InSPyReNet warm, Gemini cold):', estimatedTime / 1000 + 's');
        } else if (!inspyreNetWarm && geminiWarm && geminiEnabled) {
          // InSPyReNet cold, Gemini warm
          estimatedTime = 50000; // 40s InSPyReNet cold + 10s Gemini warm
          console.log('❄️⚡ Mixed mode (InSPyReNet cold, Gemini warm):', estimatedTime / 1000 + 's');
        } else if (!inspyreNetWarm && !geminiEnabled) {
          // Only InSPyReNet cold needed
          estimatedTime = 40000; // 40 seconds
          console.log('❄️ Standard mode (InSPyReNet cold, no AI effects):', estimatedTime / 1000 + 's');
        } else {
          // Both APIs cold - worst case
          estimatedTime = 65000; // 40s InSPyReNet + 25s Gemini
          console.log('❄️❄️ Extended processing (both APIs cold):', estimatedTime / 1000 + 's');
        }

        // Process with effects directly (no GCS upload needed initially)
        console.log('🎨 Processing with AI...');
        this.updateProgress('Removing background...');
        startTime = Date.now();
        this.startProgressTimer(estimatedTime);

        const effects = await this.removeBackground(correctedFile);
        if (this.processingCancelled) return;

        const inspyreNetTime = Date.now() - startTime;
        console.log('✅ Background removal complete:', effects, `(${inspyreNetTime}ms)`);

        // Record InSPyReNet API call for future warmth detection
        warmthTracker.recordServiceCall('inspirenet', true, inspyreNetTime);

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
          const geminiStartTime = Date.now();
          await this.generateAIEffects(this.currentPet.processedImage);
          const geminiTime = Date.now() - geminiStartTime;
          console.log(`✅ AI effects complete (${geminiTime}ms)`);

          // Record Gemini API call for future warmth detection
          warmthTracker.recordServiceCall('gemini', true, geminiTime);
        }

        // Stop timer and show result
        this.stopProgressTimer();
        this.updateProgress('Complete!', '✅ Ready to preview');
        this.showResult();

      } catch (error) {
        console.error('❌ Processing error:', error);
        this.stopProgressTimer();

        // Record failed API call if processing was started
        if (startTime) {
          const totalTime = Date.now() - startTime;
          // Record failure for InSPyReNet (always attempted)
          warmthTracker.recordServiceCall('inspirenet', false, totalTime);
          // Record failure for Gemini if it was enabled
          if (this.geminiEnabled) {
            warmthTracker.recordServiceCall('gemini', false, totalTime);
          }
        }

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

          // Render locked thumbnails for Modern and Sketch (prevents broken images)
          this.renderLockedThumbnail('modern');
          this.renderLockedThumbnail('sketch');

          // Update UI to show quota exhausted state (buttons disabled, badges, etc.)
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
      // Defensive coding: Validate inputs
      if (!btn || !this.effectBtns) {
        console.warn('🎨 Invalid effect button or buttons not initialized');
        return;
      }

      const effect = btn.dataset.effect;

      // Update active state and ARIA attributes for screen readers
      this.effectBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false'); // Screen reader accessibility
      });

      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true'); // Screen reader accessibility

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
     * Render locked thumbnail when Gemini quota exhausted
     * Replaces broken image with professional lock icon + helpful messaging
     * @param {string} effectName - 'modern' or 'sketch'
     */
    renderLockedThumbnail(effectName) {
      const btn = this.modal.querySelector(`[data-effect="${effectName}"]`);
      if (!btn) {
        console.warn(`🔒 Button not found for ${effectName}`);
        return;
      }

      const thumbnail = btn.querySelector('.inline-effect-image');
      if (!thumbnail) {
        console.warn(`🔒 Thumbnail image not found for ${effectName}`);
        return;
      }

      // Remove any existing locked overlay
      const existingOverlay = btn.querySelector('.inline-thumbnail-locked-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // Hide the image element (prevents broken image icon)
      thumbnail.style.display = 'none';

      // Create lock overlay
      const overlay = document.createElement('div');
      overlay.className = 'inline-thumbnail-locked-overlay';
      overlay.innerHTML = `
        <svg class="lock-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zm-3 5c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7zm9 13H6v-8h12v8z" fill="currentColor"/>
          <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
        </svg>
        <span class="locked-primary-text">AI Limit</span>
        <span class="locked-secondary-text">Try B&W/Color</span>
      `;

      // Add to thumbnail wrapper (parent of image)
      const wrapper = thumbnail.parentElement;
      if (wrapper) {
        wrapper.appendChild(overlay);
        wrapper.style.position = 'relative'; // Ensure positioning context
      }

      // Add click handler to show helpful message
      overlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showQuotaExhaustedMessage();
      });

      console.log(`🔒 ${effectName} thumbnail locked (quota exhausted)`);
    }

    /**
     * Show helpful message when user clicks locked thumbnail
     * Uses toast notification or alert fallback
     */
    showQuotaExhaustedMessage() {
      const message = '💡 AI limit reached! Modern and Sketch reset at midnight UTC. Try B&W or Color now (unlimited)';

      // Use Gemini UI toast if available
      if (this.geminiUI && typeof this.geminiUI.showToast === 'function') {
        this.geminiUI.showToast(message, 'exhausted', 5000);
      } else {
        // Fallback: simple alert
        alert(message);
      }
    }

    /**
     * Update progress display (simplified - no percentage)
     * @param {string} text - Main status message
     * @param {string} timer - Time estimate (optional)
     */
    updateProgress(text, timer = '') {
      // Update main status text
      if (this.processingText) {
        this.processingText.textContent = text;
      }

      // Update timer (only if provided and not using countdown)
      if (this.progressTimer && timer && !this.countdownTimer) {
        this.progressTimer.textContent = timer;
      }
    }

    /**
     * Start countdown timer (similar to pet-processor.js)
     * @param {number} estimatedTimeMs - Estimated processing time in milliseconds
     */
    startProgressTimer(estimatedTimeMs) {
      // Stop any existing timer
      this.stopProgressTimer();

      this.startTime = Date.now();
      this.estimatedTime = estimatedTimeMs;

      // Update countdown every second
      this.countdownTimer = setInterval(() => {
        if (this.processingCancelled) {
          this.stopProgressTimer();
          return;
        }

        const elapsed = Date.now() - this.startTime;
        const remaining = Math.max(0, this.estimatedTime - elapsed);
        const remainingSeconds = Math.ceil(remaining / 1000);

        if (this.progressTimer) {
          if (remainingSeconds > 0) {
            this.progressTimer.textContent = `⏱️ ${remainingSeconds} seconds remaining`;
          } else {
            this.progressTimer.textContent = '⏱️ Almost done...';
          }
        }
      }, 1000);

      console.log(`⏱️ Countdown timer started: ${estimatedTimeMs / 1000}s`);
    }

    /**
     * Stop countdown timer
     */
    stopProgressTimer() {
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        console.log('⏱️ Countdown timer stopped');
      }
    }

    /**
     * Cancel processing
     */
    cancelProcessing() {
      this.processingCancelled = true;
      this.stopProgressTimer();
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
     * Save pet data to localStorage and close modal (Phase 2: Multi-Pet Storage)
     * Stores pet preview data for later cart submission on product page
     */
    async savePetDataAndClose() {
      try {
        console.log('💾 Saving pet data...');

        // Get artist notes if provided
        let artistNotes = '';
        if (this.artistNotesInput && this.artistNotesInput.value.trim()) {
          artistNotes = this.artistNotesInput.value
            .substring(0, 500) // Limit to 500 chars
            .replace(/<[^>]*>/g, '') // Strip HTML tags
            .trim();
        }

        // Generate unique session key for PetStorage compatibility
        // Format: pet_{number}_{timestamp} for uniqueness across sessions
        const sessionKey = `pet_${this.petNumber}_${Date.now()}`;

        // Build effects data in PetStorage format
        // PetStorage expects: { effectName: { gcsUrl, timestamp } }
        const effects = {};
        const effectsList = ['enhancedblackwhite', 'color', 'modern', 'sketch'];

        for (const effectName of effectsList) {
          const effectUrl = this.currentPet.effects[effectName];
          if (effectUrl) {
            effects[effectName] = {
              gcsUrl: effectUrl,
              timestamp: Date.now()
            };
          }
        }

        // Build pet data for PetStorage
        const petData = {
          artistNote: artistNotes, // PetStorage uses singular 'artistNote'
          effects: effects,
          filename: `pet_${this.petNumber}.jpg`,
          timestamp: Date.now()
        };

        // Check if PetStorage is available
        if (!window.PetStorage) {
          throw new Error('PetStorage not available. Please ensure pet-storage.js is loaded.');
        }

        // Save using PetStorage (ensures add-to-cart compatibility)
        const saved = await window.PetStorage.save(sessionKey, petData);

        if (!saved) {
          throw new Error('PetStorage.save() returned false');
        }

        console.log(`✅ Pet ${this.petNumber} (${this.petName}) saved to PetStorage:`, {
          sessionKey: sessionKey,
          selectedEffect: this.currentEffect,
          artistNotes: artistNotes ? `"${artistNotes.substring(0, 30)}..."` : 'none',
          effectsCount: Object.keys(effects).length,
          storageFormat: 'PetStorage (add-to-cart compatible)'
        });

        // Close modal
        this.closeModal();

        // Phase 3: Auto-select style button (only for single-pet orders)
        const petCount = this.getSelectedPetCount();

        if (petCount === 1) {
          // Single pet: Auto-select for convenience
          this.autoSelectStyleButton();
          this.showConfirmationToast();
          console.log('✅ Single-pet order: Style auto-selected');
        } else {
          // Multi-pet: Customer chooses style manually to avoid confusion
          console.log(`ℹ️ Multi-pet order (${petCount} pets): Skipping auto-select (customer will choose in "Choose Style" section)`);
        }

      } catch (error) {
        console.error('❌ Save pet data error:', error);
        this.showError('Failed to save pet data. Please try again.');
      }
    }

    /**
     * Auto-select the style radio button matching the previewed effect
     * This eliminates confusion by making the preview selection "stick"
     */
    autoSelectStyleButton() {
      try {
        // Map effect names to Shopify property values
        const styleMap = {
          'enhancedblackwhite': 'Black & White',
          'color': 'Color',
          'modern': 'Modern',
          'sketch': 'Sketch'
        };

        const styleValue = styleMap[this.currentEffect];
        if (!styleValue) {
          console.warn(`⚠️ Unknown effect type: ${this.currentEffect}`);
          return;
        }

        // Find and check the matching radio button
        const radioButton = document.querySelector(
          `input[name="properties[Style]"][value="${styleValue}"]`
        );

        if (radioButton) {
          radioButton.checked = true;
          radioButton.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`✅ Auto-selected "${styleValue}" style button`);
        } else {
          console.warn(`⚠️ Style radio button not found for "${styleValue}"`);
        }
      } catch (error) {
        console.error('❌ Auto-select error:', error);
      }
    }

    /**
     * Show toast confirmation when style is selected
     * Provides visual feedback that the selection was successful
     * Note: Style is product-level (not per-pet), so message doesn't include pet name
     */
    showConfirmationToast() {
      try {
        const styleName = this.getStyleDisplayName(this.currentEffect);

        // Remove any existing toast to prevent overlap
        const existingToast = document.querySelector('.pet-style-toast');
        if (existingToast) {
          existingToast.remove();
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'pet-style-toast';
        toast.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; margin-right: 8px;">
            <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M6 10l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
          <span style="vertical-align: middle;">${styleName} style selected</span>
        `;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Animate out and remove
        setTimeout(() => {
          toast.classList.remove('show');
          setTimeout(() => toast.remove(), 300);
        }, 3000);

        console.log(`📢 Toast: ${styleName} style selected`);
      } catch (error) {
        console.error('❌ Toast error:', error);
      }
    }

    /**
     * Get display name for effect
     * @param {string} effect - Effect key (e.g., 'enhancedblackwhite')
     * @returns {string} Display name (e.g., 'Black & White')
     */
    getStyleDisplayName(effect) {
      const displayNames = {
        'enhancedblackwhite': 'Black & White',
        'color': 'Color',
        'modern': 'Modern',
        'sketch': 'Sketch'
      };
      return displayNames[effect] || effect;
    }

    /**
     * Get the number of pets selected in the pet count radio buttons
     * @returns {number} Selected pet count (1, 2, or 3)
     */
    getSelectedPetCount() {
      try {
        // Find checked pet count radio button
        const checkedRadio = document.querySelector('[data-pet-count-radio]:checked');

        if (!checkedRadio) {
          console.warn('⚠️ No pet count selected, defaulting to 1');
          return 1;
        }

        const count = parseInt(checkedRadio.value);

        if (isNaN(count) || count < 1 || count > 3) {
          console.warn('⚠️ Invalid pet count: ' + count + ', defaulting to 1');
          return 1;
        }

        return count;
      } catch (error) {
        console.error('❌ Error getting pet count:', error);
        return 1; // Safe default
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

  /**
   * API Warmth Tracker
   * Detects whether the InSPyReNet API is warm (recently used) or cold (needs startup)
   * Used to provide accurate countdown timers
   */
  class APIWarmthTracker {
    constructor() {
      this.storageKey = 'perkie_api_warmth';
      this.warmthTimeout = 10 * 60 * 1000; // 10 minutes
      this.sessionKey = 'perkie_api_session';
    }

    getWarmthState() {
      try {
        // Check session storage first (most reliable for current session)
        const sessionData = sessionStorage.getItem(this.sessionKey);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const timeSinceLastCall = Date.now() - session.lastCall;

          // If called within same session and < 10 minutes, it's warm
          if (timeSinceLastCall < this.warmthTimeout) {
            console.log('🔥 API detected as WARM (recent session activity)');
            return 'warm';
          }
        }

        // Check localStorage for cross-session warmth
        const storedData = localStorage.getItem(this.storageKey);
        if (!storedData) {
          console.log('❄️ API detected as COLD (no previous usage)');
          return 'cold';
        }

        const data = JSON.parse(storedData);
        const timeSinceLastCall = Date.now() - data.lastCall;

        // Determine warmth based on time since last call
        if (timeSinceLastCall < this.warmthTimeout) {
          console.log('🔥 API detected as WARM (recent activity)');
          return 'warm';
        } else if (timeSinceLastCall < this.warmthTimeout * 2) {
          console.log('🤔 API warmth UNKNOWN (possibly cooling)');
          return 'unknown';
        } else {
          console.log('❄️ API detected as COLD (inactive > 20 minutes)');
          return 'cold';
        }
      } catch (error) {
        console.warn('Failed to detect API warmth:', error);
        return 'unknown';
      }
    }

    isFirstTimeUser() {
      try {
        // Check if user has ever used the NEW service-specific API tracking
        const hasInspyreNetData = localStorage.getItem('perkie_api_warmth_inspirenet') ||
                                  sessionStorage.getItem('perkie_api_warmth_inspirenet');
        const hasGeminiData = localStorage.getItem('perkie_api_warmth_gemini') ||
                              sessionStorage.getItem('perkie_api_warmth_gemini');
        const hasProcessedCount = localStorage.getItem('perkie_processed_count');

        // Also check legacy keys for backward compatibility
        const hasLegacyData = localStorage.getItem(this.storageKey) ||
                              sessionStorage.getItem(this.sessionKey);

        const isFirstTime = !hasInspyreNetData && !hasGeminiData && !hasProcessedCount && !hasLegacyData;

        if (isFirstTime) {
          console.log('👋 First-time user detected');
        }

        return isFirstTime;
      } catch (error) {
        console.warn('Failed to detect first-time user:', error);
        return false;
      }
    }

    recordAPICall(success, duration) {
      try {
        // Update session storage (immediate warmth)
        const sessionData = {
          lastCall: Date.now(),
          callCount: 1,
          averageDuration: duration
        };

        const existingSession = sessionStorage.getItem(this.sessionKey);
        if (existingSession) {
          const session = JSON.parse(existingSession);
          sessionData.callCount = (session.callCount || 0) + 1;
          sessionData.averageDuration = Math.round(
            ((session.averageDuration || duration) + duration) / 2
          );
        }

        sessionStorage.setItem(this.sessionKey, JSON.stringify(sessionData));

        // Update localStorage (cross-session tracking)
        let data = {
          lastCall: Date.now(),
          callHistory: [],
          warmthConfidence: 0.5
        };

        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          data = JSON.parse(stored);
        }

        // Determine if this was a warm or cold start based on duration
        const wasWarm = duration < 20000; // Less than 20s = warm

        // Add to history (keep last 10 calls)
        data.callHistory.push({
          timestamp: Date.now(),
          duration: duration,
          wasWarm: wasWarm,
          success: success
        });

        // Keep only last 10 calls
        if (data.callHistory.length > 10) {
          data.callHistory = data.callHistory.slice(-10);
        }

        // Update warmth confidence based on recent patterns
        const recentCalls = data.callHistory.slice(-5);
        const warmCalls = recentCalls.filter(c => c.wasWarm).length;
        data.warmthConfidence = warmCalls / recentCalls.length;

        // Update last call time
        data.lastCall = Date.now();

        localStorage.setItem(this.storageKey, JSON.stringify(data));

        // Update processed count
        const processedCount = parseInt(localStorage.getItem('perkie_processed_count') || '0');
        localStorage.setItem('perkie_processed_count', String(processedCount + 1));

        console.log(`📊 API call recorded: ${Math.round(duration/1000)}s (${wasWarm ? 'warm' : 'cold'})`);
      } catch (error) {
        console.warn('Failed to record API call:', error);
      }
    }

    /**
     * Check warmth for a specific service (inspirenet or gemini)
     * @param {string} service - 'inspirenet' or 'gemini'
     * @returns {boolean} - true if warm, false if cold
     */
    getServiceWarmth(service) {
      try {
        const key = `perkie_api_warmth_${service}`;

        // Check sessionStorage first (most reliable)
        const sessionData = sessionStorage.getItem(key);
        if (sessionData) {
          const data = JSON.parse(sessionData);
          const timeSinceLastCall = Date.now() - data.lastCall;

          if (timeSinceLastCall < this.warmthTimeout) {
            return true; // Warm
          }
        }

        // Check localStorage
        const storedData = localStorage.getItem(key);
        if (!storedData) {
          return false; // Cold (never used)
        }

        const data = JSON.parse(storedData);
        const timeSinceLastCall = Date.now() - data.lastCall;

        return timeSinceLastCall < this.warmthTimeout; // Warm if < 10 minutes
      } catch (error) {
        console.warn(`Failed to detect ${service} warmth:`, error);
        return false; // Assume cold on error
      }
    }

    /**
     * Record API call for a specific service
     * @param {string} service - 'inspirenet' or 'gemini'
     * @param {boolean} success - whether the call succeeded
     * @param {number} duration - duration in milliseconds
     */
    recordServiceCall(service, success, duration) {
      try {
        const key = `perkie_api_warmth_${service}`;

        // Update sessionStorage (immediate warmth)
        const sessionData = {
          lastCall: Date.now(),
          callCount: 1,
          averageDuration: duration,
          success: success
        };

        const existingSession = sessionStorage.getItem(key);
        if (existingSession) {
          const session = JSON.parse(existingSession);
          sessionData.callCount = (session.callCount || 0) + 1;
          sessionData.averageDuration = Math.round(
            ((session.averageDuration || duration) + duration) / 2
          );
        }

        sessionStorage.setItem(key, JSON.stringify(sessionData));

        // Update localStorage (cross-session tracking)
        let data = {
          lastCall: Date.now(),
          callHistory: [],
          service: service
        };

        const stored = localStorage.getItem(key);
        if (stored) {
          data = JSON.parse(stored);
        }

        // Determine if this was a warm or cold start based on duration
        // InSPyReNet: < 15s = warm, Gemini: < 15s = warm
        const wasWarm = duration < 15000;

        // Add to history (keep last 5 calls per service)
        data.callHistory.push({
          timestamp: Date.now(),
          duration: duration,
          wasWarm: wasWarm,
          success: success
        });

        // Keep only last 5 calls
        if (data.callHistory.length > 5) {
          data.callHistory = data.callHistory.slice(-5);
        }

        // Update last call time
        data.lastCall = Date.now();

        // Write to localStorage with quota exceeded handling
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch (storageError) {
          // Handle QuotaExceededError (localStorage full)
          if (storageError.name === 'QuotaExceededError' || storageError.code === 22) {
            console.warn(`⚠️ localStorage quota exceeded for ${service} tracking, cleaning up old data...`);

            // Emergency cleanup: Remove old call history, keep only last 2 calls
            try {
              data.callHistory = data.callHistory.slice(-2);
              localStorage.setItem(key, JSON.stringify(data));
              console.log(`✅ ${service} tracking recovered with reduced history`);
            } catch (retryError) {
              // If still fails, skip localStorage but continue with sessionStorage
              console.warn(`❌ Could not save ${service} tracking to localStorage, using sessionStorage only`);
            }
          } else if (storageError.name === 'SecurityError') {
            // Safari private mode or disabled localStorage
            console.warn(`⚠️ localStorage disabled (private mode?) for ${service} tracking`);
          } else {
            throw storageError; // Re-throw unexpected errors
          }
        }

        console.log(`📊 ${service} call recorded: ${Math.round(duration/1000)}s (${wasWarm ? 'warm' : 'cold'})`);
      } catch (error) {
        console.warn(`Failed to record ${service} API call:`, error);
        // Silent failure - warmth tracking is non-critical
      }
    }
  }

  // Make APIWarmthTracker available to InlinePreview class
  window.APIWarmthTracker = APIWarmthTracker;

})();
