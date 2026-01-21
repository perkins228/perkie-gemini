/**
 * Pet Processor - Mobile-First ES6+ Implementation
 * Replaces 2,343 lines of ES5 with 600 lines of modern JavaScript
 * Version: 1.0.3 - Security Hardening & Session Restoration
 */

// Gemini modules loaded via global scope (gemini-api-client.js, gemini-effects-ui.js)
// Available as: window.GeminiAPIClient, window.GeminiEffectsUI

// ============================================================================
// SECURITY UTILITIES
// Phase 0: Security hardening for localStorage and URL validation
// ============================================================================

/**
 * Validates that a URL is a trusted Google Cloud Storage URL
 * Prevents XSS and phishing attacks via URL injection
 *
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is from trusted GCS domain
 */
function validateGCSUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);

    // Whitelist: Only allow Google Cloud Storage domains
    const trustedDomains = [
      'storage.googleapis.com',
      'storage.cloud.google.com'
    ];

    // Check if hostname matches trusted domains
    const isTrusted = trustedDomains.some(domain =>
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );

    // Must use HTTPS
    if (urlObj.protocol !== 'https:') {
      console.warn('🔒 Rejected non-HTTPS URL:', url);
      return false;
    }

    if (!isTrusted) {
      console.warn('🔒 Rejected untrusted domain:', urlObj.hostname);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('🔒 Invalid URL format:', url);
    return false;
  }
}

/**
 * Validates and sanitizes image data URLs
 * Prevents arbitrary code execution via SVG data URLs
 *
 * @param {string} dataUrl - Data URL to validate
 * @returns {string|null} Sanitized data URL or null if invalid
 */
function validateAndSanitizeImageData(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return null;
  }

  // Must start with data:image/
  if (!dataUrl.startsWith('data:image/')) {
    console.warn('🔒 Rejected non-image data URL');
    return null;
  }

  // Block SVG data URLs (can contain embedded scripts)
  if (dataUrl.startsWith('data:image/svg+xml')) {
    console.warn('🔒 Blocked SVG data URL (XSS risk)');
    return null;
  }

  // Allowed formats: jpeg, jpg, png, webp
  const allowedFormats = ['jpeg', 'jpg', 'png', 'webp'];
  const formatMatch = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,/);

  if (!formatMatch) {
    console.warn('🔒 Rejected data URL with invalid format');
    return null;
  }

  // Check size (data URLs can be large - limit to 10MB base64 encoded)
  const maxSize = 10 * 1024 * 1024 * 1.37; // Base64 is ~37% larger
  if (dataUrl.length > maxSize) {
    console.warn('🔒 Rejected oversized data URL:', dataUrl.length, 'bytes');
    return null;
  }

  return dataUrl;
}

/**
 * Checks if localStorage has available quota
 * Prevents silent failures on mobile devices with limited storage
 *
 * @param {number} estimatedSizeKB - Estimated size needed in KB
 * @returns {boolean} True if quota is available
 */
function checkLocalStorageQuota(estimatedSizeKB = 100) {
  try {
    // Try to estimate current usage
    let currentSize = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        currentSize += localStorage[key].length + key.length;
      }
    }

    const currentSizeKB = currentSize / 1024;
    const estimatedTotalKB = currentSizeKB + estimatedSizeKB;

    // Most browsers: 5-10MB limit for localStorage
    // Conservative limit: 4MB to leave safety margin
    const maxQuotaKB = 4 * 1024;

    if (estimatedTotalKB > maxQuotaKB) {
      console.warn('🔒 localStorage quota nearly exhausted:', {
        current: `${currentSizeKB.toFixed(2)} KB`,
        estimated: `${estimatedTotalKB.toFixed(2)} KB`,
        max: `${maxQuotaKB} KB`
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('🔒 localStorage quota check failed:', error);
    return false; // Fail safe
  }
}

/**
 * Wraps async operations with timeout protection
 * Prevents operations from hanging indefinitely
 *
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @param {string} operationName - Name for logging
 * @returns {Promise} Promise that rejects on timeout
 */
function withTimeout(promise, timeoutMs = 5000, operationName = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Safe localStorage wrapper with error boundaries
 * Prevents single corrupted entry from crashing the app
 *
 * @param {string} key - localStorage key
 * @param {any} defaultValue - Default value if operation fails
 * @returns {any} Parsed value or defaultValue
 */
function safeGetLocalStorage(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) {
      return defaultValue;
    }

    // Try to parse as JSON if it looks like JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch (parseError) {
        console.warn(`🔒 Failed to parse localStorage key "${key}" as JSON, returning raw value`);
        return value;
      }
    }

    return value;
  } catch (error) {
    console.error(`🔒 localStorage.getItem failed for key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Safe localStorage setter with quota checking
 *
 * @param {string} key - localStorage key
 * @param {any} value - Value to store (will be JSON stringified if object)
 * @returns {boolean} True if successful
 */
function safeSetLocalStorage(key, value) {
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const estimatedSizeKB = stringValue.length / 1024;

    // Check quota before setting
    if (!checkLocalStorageQuota(estimatedSizeKB)) {
      console.error(`🔒 Insufficient localStorage quota for key "${key}"`);
      return false;
    }

    localStorage.setItem(key, stringValue);
    return true;
  } catch (error) {
    console.error(`🔒 localStorage.setItem failed for key "${key}":`, error);
    return false;
  }
}

// Comparison Manager for Effect Gallery
// Moved before PetProcessor to fix initialization error
class ComparisonManager {
  constructor(petProcessor) {
    this.petProcessor = petProcessor;
    this.isComparisonMode = false;
    this.currentEffect = 'enhancedblackwhite';
    this.comparisonEffect = null;
    this.longPressTimer = null;
    this.swipeStartX = null;
    this.effectOrder = ['enhancedblackwhite', 'color', 'ink_wash', 'sketch'];
    this.currentComparisonIndex = 0;
    
    this.initializeComparison();
  }
  
  initializeComparison() {
    // Add long-press handlers to effect buttons
    const effectButtons = this.petProcessor.container.querySelectorAll('.effect-btn');
    
    effectButtons.forEach(button => {
      // Touch events for mobile
      button.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
      button.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
      
      // Mouse events for desktop
      button.addEventListener('mousedown', this.handleMouseDown.bind(this));
      button.addEventListener('mouseup', this.handleMouseUp.bind(this));
      button.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    });
  }
  
  handleTouchStart(e) {
    const button = e.currentTarget;
    button.classList.add('long-press-active');
    
    this.longPressTimer = setTimeout(() => {
      if (this.petProcessor.currentPet) {
        this.enterComparisonMode(button.dataset.effect);
      }
    }, 500);
  }
  
  handleTouchEnd(e) {
    this.clearLongPress(e.currentTarget);
  }
  
  handleMouseDown(e) {
    if (e.button !== 0) return; // Only left click
    const button = e.currentTarget;
    button.classList.add('long-press-active');
    
    this.longPressTimer = setTimeout(() => {
      if (this.petProcessor.currentPet) {
        this.enterComparisonMode(button.dataset.effect);
      }
    }, 500);
  }
  
  handleMouseUp(e) {
    this.clearLongPress(e.currentTarget);
  }
  
  handleMouseLeave(e) {
    this.clearLongPress(e.currentTarget);
  }
  
  clearLongPress(button) {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    button.classList.remove('long-press-active');
  }
  
  enterComparisonMode(selectedEffect) {
    if (this.isComparisonMode) return;
    
    const currentPet = this.petProcessor.currentPet;
    if (!currentPet || !currentPet.effects) return;
    
    this.isComparisonMode = true;
    this.currentEffect = this.petProcessor.selectedEffect || 'enhancedblackwhite';
    this.comparisonEffect = selectedEffect;
    this.currentComparisonIndex = this.effectOrder.indexOf(selectedEffect);
    
    // Show comparison overlay
    const overlay = this.petProcessor.container.querySelector('.comparison-overlay');
    const instructions = this.petProcessor.container.querySelector('.comparison-instructions');
    
    if (overlay) {
      // Set images
      const currentImg = overlay.querySelector('.comparison-current .comparison-image');
      const altImg = overlay.querySelector('.comparison-alternative .comparison-image');
      
      if (currentImg && currentPet.effects[this.currentEffect]) {
        currentImg.src = currentPet.effects[this.currentEffect].dataUrl;
      }
      
      if (altImg && currentPet.effects[this.comparisonEffect]) {
        altImg.src = currentPet.effects[this.comparisonEffect].dataUrl;
      }
      
      // Show overlay
      overlay.hidden = false;
      instructions.hidden = false;
      
      requestAnimationFrame(() => {
        overlay.classList.add('active');
      });
      
      // Add event listeners for comparison interactions
      this.setupComparisonInteractions(overlay);
    }
  }
  
  setupComparisonInteractions(overlay) {
    // Click handlers for panels
    const currentPanel = overlay.querySelector('.comparison-current');
    const altPanel = overlay.querySelector('.comparison-alternative');
    
    if (currentPanel) {
      currentPanel.addEventListener('click', () => this.exitComparisonMode());
    }
    
    if (altPanel) {
      altPanel.addEventListener('click', () => this.selectAlternativeEffect());
    }
    
    // Swipe detection for mobile
    let touchStartX = null;
    
    altPanel.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    
    altPanel.addEventListener('touchend', (e) => {
      if (!touchStartX) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX - touchEndX;
      
      if (Math.abs(diff) > 50) { // Minimum swipe distance
        if (diff > 0) {
          this.cycleAlternativeEffect(1); // Swipe left - next
        } else {
          this.cycleAlternativeEffect(-1); // Swipe right - previous
        }
      }
      
      touchStartX = null;
    }, { passive: true });
    
    // Keyboard navigation for desktop
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        this.exitComparisonMode();
      } else if (e.key === 'ArrowLeft') {
        this.cycleAlternativeEffect(-1);
      } else if (e.key === 'ArrowRight') {
        this.cycleAlternativeEffect(1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        this.selectAlternativeEffect();
      }
    };
    
    document.addEventListener('keydown', handleKeydown);
    overlay.dataset.keyHandler = 'true';
  }
  
  cycleAlternativeEffect(direction) {
    const currentPet = this.petProcessor.currentPet;
    if (!currentPet || !currentPet.effects) return;
    
    // Update index
    this.currentComparisonIndex += direction;
    
    // Wrap around
    if (this.currentComparisonIndex < 0) {
      this.currentComparisonIndex = this.effectOrder.length - 1;
    } else if (this.currentComparisonIndex >= this.effectOrder.length) {
      this.currentComparisonIndex = 0;
    }
    
    // Update comparison effect
    this.comparisonEffect = this.effectOrder[this.currentComparisonIndex];
    
    // Update image
    const altImg = this.petProcessor.container.querySelector('.comparison-alternative .comparison-image');
    if (altImg && currentPet.effects[this.comparisonEffect]) {
      altImg.src = currentPet.effects[this.comparisonEffect].dataUrl;
    }
  }
  
  selectAlternativeEffect() {
    // Select the alternative effect as the new current
    const effectBtn = this.petProcessor.container.querySelector(`[data-effect="${this.comparisonEffect}"]`);
    if (effectBtn) {
      this.petProcessor.switchEffect(effectBtn);
    }
    
    this.exitComparisonMode();
  }
  
  exitComparisonMode() {
    if (!this.isComparisonMode) return;
    
    const overlay = this.petProcessor.container.querySelector('.comparison-overlay');
    const instructions = this.petProcessor.container.querySelector('.comparison-instructions');
    
    if (overlay) {
      overlay.classList.remove('active');
      
      setTimeout(() => {
        overlay.hidden = true;
        instructions.hidden = true;
      }, 300);
      
      // Remove keyboard handler
      if (overlay.dataset.keyHandler) {
        document.removeEventListener('keydown', this.handleKeydown);
        delete overlay.dataset.keyHandler;
      }
    }
    
    this.isComparisonMode = false;
  }
}

class PetProcessor {
  constructor(sectionId) {
    console.log('🐾 PetProcessor constructor called with sectionId:', sectionId);
    this.sectionId = sectionId;
    
    this.container = document.getElementById(`pet-processor-content-${sectionId}`);
    
    // STAGING: BiRefNet (faster, higher quality)
    // PRODUCTION: 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app'
    this.apiUrl = 'https://birefnet-bg-removal-api-753651513695.us-central1.run.app';
    this.currentPet = null;
    this.isProcessing = false;
    this.geminiGenerating = false;  // Track Gemini generation state separately
    this.selectedEffect = 'enhancedblackwhite';

    // Initialize new features
    this.comparisonManager = null;
    this.sharing = null;

    // Initialize Gemini integration
    this.geminiClient = null;
    this.geminiUI = null;
    this.geminiEnabled = false;

    // Track pending GCS uploads for deferred completion
    // Uploads happen in background, awaited only at cart time
    this.pendingGcsUploads = null;

    // Initialize
    this.init();
  }
  
  async init() {
    if (!this.container) {
      console.error('🐾 Cannot initialize PetProcessor - no container found');
      return;
    }

    // Render UI
    this.render();

    // Load style preview images from section settings
    this.loadStylePreviewImages();

    // Bind events
    this.bindEvents();

    // Restore previous session if exists (with timeout protection)
    try {
      await withTimeout(
        this.restoreSession(),
        5000,
        'Session restoration'
      );
    } catch (error) {
      console.warn('⚠️ Session restoration timed out or failed:', error.message);
      // Non-critical - continue with fresh session
    }

    // Initialize features
    this.initializeFeatures();
  }

  /**
   * Restore previous session from localStorage
   * Phase 1: Session Restoration with Security Hardening
   * Called during initialization to recover pet data after page refresh
   */
  async restoreSession() {
    try {
      console.log('🔄 Attempting to restore session from localStorage');

      // === PRIORITY: Check if returning from product page ===
      // If returning, skip pet selector check to avoid re-processing
      const urlParams = new URLSearchParams(window.location.search);
      const isReturningFromProduct = urlParams.get('from') === 'product' ||
                                      sessionStorage.getItem('returning_from_product') === 'true';

      if (isReturningFromProduct) {
        console.log('🔙 Returning from product page - checking sessionStorage for saved state');
        // Clear the return indicator (ProductMockupRenderer will also clear it)
        sessionStorage.removeItem('returning_from_product');

        // === FIX: Read from sessionStorage.processor_mockup_state ===
        // When clicking products in mockup grid, only sessionStorage is saved (not PetStorage)
        // ProductMockupRenderer.saveProcessorState() saves to processor_mockup_state
        const savedState = sessionStorage.getItem('processor_mockup_state');
        if (savedState) {
          try {
            const state = JSON.parse(savedState);

            // Validate state freshness (expire after 30 minutes)
            const MAX_AGE = 30 * 60 * 1000;
            if (Date.now() - state.timestamp > MAX_AGE) {
              console.log('🔙 Saved state expired, clearing');
              sessionStorage.removeItem('processor_mockup_state');
            } else if (state.petData && state.petData.effects) {
              console.log('🔙 Restoring from sessionStorage.processor_mockup_state');

              // Reconstruct currentPet from saved state
              this.currentPet = {
                id: state.petData.sessionKey || `pet_restored_${Date.now()}`,
                filename: 'Pet',
                effects: {},
                selectedEffect: state.petData.selectedEffect || 'enhancedblackwhite'
              };

              // Restore all effects from saved state
              for (const [effectName, effectData] of Object.entries(state.petData.effects)) {
                if (effectData && (effectData.dataUrl || effectData.gcsUrl)) {
                  this.currentPet.effects[effectName] = {
                    gcsUrl: effectData.gcsUrl || '',
                    dataUrl: effectData.dataUrl || null,
                    cacheHit: true
                  };
                }
              }

              const effectCount = Object.keys(this.currentPet.effects).length;
              if (effectCount > 0) {
                console.log(`✅ [SessionStorage] Restored ${effectCount} effect(s):`, Object.keys(this.currentPet.effects));

                // Show the result view
                this.showResult({ effects: this.currentPet.effects });

                // === Explicitly show views after RAF schedules ===
                setTimeout(() => {
                  const uploadZone = this.container.querySelector('.upload-zone');
                  const effectGrid = this.container.querySelector('.effect-grid-wrapper');
                  const resultView = this.container.querySelector('.processor-preview .result-view');
                  const placeholder = this.container.querySelector('.preview-placeholder');
                  const container = this.container.querySelector('.pet-processor-container');
                  const inlineHeader = this.container.querySelector('.inline-section-header');

                  if (uploadZone && !uploadZone.hidden) {
                    uploadZone.hidden = true;
                    console.log('🔧 [SessionStorage Restoration] Hiding upload zone');
                  }
                  if (effectGrid && effectGrid.hidden) {
                    effectGrid.hidden = false;
                    console.log('🔧 [SessionStorage Restoration] Showing effect grid');
                  }
                  if (resultView && resultView.hidden) {
                    resultView.hidden = false;
                    console.log('🔧 [SessionStorage Restoration] Showing result view');
                  }
                  if (placeholder && placeholder.style.display !== 'none') {
                    placeholder.style.display = 'none';
                    console.log('🔧 [SessionStorage Restoration] Hiding placeholder');
                  }
                  if (container && !container.classList.contains('has-result')) {
                    container.classList.add('has-result');
                    console.log('🔧 [SessionStorage Restoration] Adding has-result class');
                  }
                  if (inlineHeader && inlineHeader.hidden) {
                    inlineHeader.hidden = false;
                    console.log('🔧 [SessionStorage Restoration] Showing inline header');
                  }
                }, 50);

                // Set initial image to selected effect
                const img = this.container.querySelector('.pet-image');
                if (img) {
                  const selectedEffectData = this.currentPet.effects[this.currentPet.selectedEffect];
                  if (selectedEffectData) {
                    img.src = selectedEffectData.dataUrl || selectedEffectData.gcsUrl;
                  }
                }

                // Update style card thumbnails
                this.updateStyleCardPreviews({ effects: this.currentPet.effects });

                // Dispatch event for mockup grid
                document.dispatchEvent(new CustomEvent('petProcessingComplete', {
                  detail: {
                    sessionKey: this.currentPet.id,
                    selectedEffect: this.currentPet.selectedEffect,
                    effects: this.currentPet.effects,
                    isRestored: true
                  }
                }));

                return; // Successfully restored from sessionStorage
              }
            }
          } catch (parseError) {
            console.error('❌ Failed to parse processor_mockup_state:', parseError);
          }
        }

        console.log('🔙 No valid sessionStorage state, falling back to PetStorage');
        // Fall through to PetStorage check below
      } else {
        // === FIX: Check PetStorage FIRST before checking pet selector uploads ===
        // PetStorage may already have fully processed effects (including Gemini effects)
        // Only fall through to pet selector uploads if no processed effects found

        let hasPetStorageEffects = false;

        if (typeof PetStorage !== 'undefined') {
          try {
            const recentPets = PetStorage.getRecentPets(1);
            if (recentPets && recentPets.length > 0) {
              const recentPet = recentPets[0];
              const effectCount = Object.keys(recentPet.effects || {}).length;

              // Check if pet was processed within last 30 minutes (fresh session)
              const MAX_AGE = 30 * 60 * 1000;
              const isRecent = (Date.now() - (recentPet.timestamp || 0)) < MAX_AGE;

              if (effectCount > 0 && isRecent) {
                console.log(`🔄 [Priority Check] PetStorage has ${effectCount} processed effect(s), skipping pet selector re-processing`);
                hasPetStorageEffects = true;
                // Fall through to PetStorage restoration below
              }
            }
          } catch (err) {
            console.warn('⚠️ PetStorage priority check failed:', err);
          }
        }

        // Only check pet selector uploads if PetStorage doesn't have processed effects
        if (!hasPetStorageEffects) {
          const petSelectorImage = await this.checkPetSelectorUploads();
          if (petSelectorImage) {
            console.log('📸 Found uploaded image from pet selector, auto-loading...');
            await this.loadPetSelectorImage(petSelectorImage);
            return; // Early return - don't check PetStorage
          }
        }
      }

      // === EXISTING: Check PetStorage for processed pets ===
      // Check if PetStorage is available
      if (typeof PetStorage === 'undefined') {
        console.log('🔄 PetStorage not available, skipping restore');
        return;
      }

      // Get all pets from PetStorage with error boundary
      let allPets;
      try {
        allPets = PetStorage.getAll();
      } catch (storageError) {
        console.error('❌ PetStorage.getAll() failed:', storageError);
        return;
      }

      if (!allPets || typeof allPets !== 'object') {
        console.warn('⚠️ Invalid pet storage format, skipping restore');
        return;
      }

      const petIds = Object.keys(allPets);

      if (petIds.length === 0) {
        console.log('🔄 No session to restore (no saved pets)');
        return;
      }

      // Validate and filter pets with corrupted data
      const validPets = petIds
        .map(id => ({ id, data: allPets[id] }))
        .filter(pet => {
          // Basic validation
          if (!pet.data || typeof pet.data !== 'object') {
            console.warn(`⚠️ Skipping pet ${pet.id}: invalid data structure`);
            return false;
          }

          if (!pet.data.timestamp || typeof pet.data.timestamp !== 'number') {
            console.warn(`⚠️ Skipping pet ${pet.id}: missing or invalid timestamp`);
            return false;
          }

          return true;
        });

      if (validPets.length === 0) {
        console.warn('⚠️ No valid pets found in storage');
        return;
      }

      // Get most recent pet (by timestamp)
      const sortedPets = validPets.sort((a, b) => (b.data.timestamp || 0) - (a.data.timestamp || 0));
      const latestPet = sortedPets[0];

      console.log(`🔄 Restoring most recent pet: ${latestPet.id}`);

      // Validate URLs with security checks
      const gcsUrl = latestPet.data.gcsUrl;

      // Validate GCS URL
      if (gcsUrl && !validateGCSUrl(gcsUrl)) {
        console.warn('🔒 Invalid GCS URL detected, clearing:', gcsUrl);
        latestPet.data.gcsUrl = '';
      }

      // Reconstruct currentPet object with validated data (no originalUrl, no thumbnail)
      this.currentPet = {
        id: latestPet.id,
        filename: PetStorage.sanitizeName(latestPet.data.filename || 'Pet'),
        effects: {},
        selectedEffect: latestPet.data.selectedEffect || latestPet.data.effect || 'enhancedblackwhite'
      };

      // Restore all effects from new simplified format
      if (latestPet.data.effects && typeof latestPet.data.effects === 'object') {
        for (const [effectName, effectData] of Object.entries(latestPet.data.effects)) {
          if (!effectData || typeof effectData !== 'object') continue;

          // Validate URLs/data for each effect
          let validatedEffect = { cacheHit: true };

          if (effectData.gcsUrl && validateGCSUrl(effectData.gcsUrl)) {
            validatedEffect.gcsUrl = effectData.gcsUrl;
          }

          if (effectData.dataUrl) {
            const sanitized = validateAndSanitizeImageData(effectData.dataUrl);
            if (sanitized) {
              validatedEffect.dataUrl = sanitized;
            }
          }

          // Only add effect if we have valid data
          if (validatedEffect.gcsUrl || validatedEffect.dataUrl) {
            this.currentPet.effects[effectName] = validatedEffect;
          }
        }
      }
      // Note: Old format data is ignored (fresh start for new test site)

      // Check for other Gemini effects in localStorage (ink_wash/marker)
      // These might exist even if not the selected effect
      const inkWashKey = `${latestPet.id}_ink_wash`;
      const sketchKey = `${latestPet.id}_sketch`;

      const inkWashData = safeGetLocalStorage(inkWashKey, null);
      if (inkWashData && !this.currentPet.effects.ink_wash) {
        // Validate ink_wash effect data
        let validInkWashUrl = null;
        if (typeof inkWashData === 'string') {
          if (inkWashData.startsWith('http') && validateGCSUrl(inkWashData)) {
            validInkWashUrl = inkWashData;
          } else if (inkWashData.startsWith('data:')) {
            validInkWashUrl = validateAndSanitizeImageData(inkWashData);
          }
        }

        if (validInkWashUrl) {
          this.currentPet.effects.ink_wash = {
            gcsUrl: validInkWashUrl.startsWith('http') ? validInkWashUrl : '',
            dataUrl: validInkWashUrl.startsWith('data:') ? validInkWashUrl : null,
            cacheHit: true
          };
        }
      }

      const sketchData = safeGetLocalStorage(sketchKey, null);
      if (sketchData && !this.currentPet.effects.sketch) {
        // Validate sketch effect data
        let validSketchUrl = null;
        if (typeof sketchData === 'string') {
          if (sketchData.startsWith('http') && validateGCSUrl(sketchData)) {
            validSketchUrl = sketchData;
          } else if (sketchData.startsWith('data:')) {
            validSketchUrl = validateAndSanitizeImageData(sketchData);
          }
        }

        if (validSketchUrl) {
          this.currentPet.effects.sketch = {
            gcsUrl: validSketchUrl.startsWith('http') ? validSketchUrl : '',
            dataUrl: validSketchUrl.startsWith('data:') ? validSketchUrl : null,
            cacheHit: true
          };
        }
      }

      // Show result view with restored data (only if we have effects)
      const effectCount = Object.keys(this.currentPet.effects).length;
      if (effectCount > 0) {
        console.log(`✅ Session restored with ${effectCount} effect(s):`, Object.keys(this.currentPet.effects));

        // Show the result view
        this.showResult({ effects: this.currentPet.effects });

        // === CRITICAL FIX: Explicitly show views after RAF schedules ===
        // showResult() uses requestAnimationFrame which is async.
        // Ensure views are shown immediately for restoration flow.
        setTimeout(() => {
          // Double-check views are visible (RAF might not have fired yet)
          const uploadZone = this.container.querySelector('.upload-zone');
          const effectGrid = this.container.querySelector('.effect-grid-wrapper');
          const resultView = this.container.querySelector('.processor-preview .result-view');
          const placeholder = this.container.querySelector('.preview-placeholder');
          const container = this.container.querySelector('.pet-processor-container');
          const inlineHeader = this.container.querySelector('.inline-section-header');

          // Hide upload zone
          if (uploadZone && !uploadZone.hidden) {
            uploadZone.hidden = true;
            console.log('🔧 [Restoration] Explicitly hiding upload zone');
          }

          // Show effect grid
          if (effectGrid && effectGrid.hidden) {
            effectGrid.hidden = false;
            console.log('🔧 [Restoration] Explicitly showing effect grid');
          }

          // Show result view
          if (resultView && resultView.hidden) {
            resultView.hidden = false;
            console.log('🔧 [Restoration] Explicitly showing result view');
          }

          // Hide placeholder
          if (placeholder && placeholder.style.display !== 'none') {
            placeholder.style.display = 'none';
            console.log('🔧 [Restoration] Explicitly hiding placeholder');
          }

          // Add has-result class
          if (container && !container.classList.contains('has-result')) {
            container.classList.add('has-result');
            console.log('🔧 [Restoration] Explicitly adding has-result class');
          }

          // Show inline section header (desktop side-by-side layout)
          if (inlineHeader && inlineHeader.hidden) {
            inlineHeader.hidden = false;
            console.log('🔧 [Restoration] Explicitly showing inline section header');
          }
        }, 50); // Small delay to let RAF callback fire first if it will

        // Set initial image to selected effect
        const img = this.container.querySelector('.pet-image');
        if (img) {
          const selectedEffectData = this.currentPet.effects[this.currentPet.selectedEffect];
          if (selectedEffectData) {
            // Prefer dataUrl (transparent for Gemini effects), fallback to gcsUrl
            img.src = selectedEffectData.dataUrl || selectedEffectData.gcsUrl;
          }
        }

        // === CRITICAL: Populate style card thumbnails with cached images ===
        // Without this, thumbnails show placeholders instead of user's pet
        this.updateStyleCardPreviews({ effects: this.currentPet.effects });

        // Highlight the selected effect button
        const selectedBtn = this.container.querySelector(`[data-effect="${this.currentPet.selectedEffect}"]`);
        if (selectedBtn) {
          this.container.querySelectorAll('.effect-btn').forEach(btn => btn.classList.remove('active'));
          selectedBtn.classList.add('active');
        }

        // Dispatch event for mockup grid restoration
        // This triggers ProductMockupRenderer to show product previews
        const selectedEffectUrl = this.currentPet.effects[this.currentPet.selectedEffect]?.gcsUrl ||
                                   this.currentPet.effects[this.currentPet.selectedEffect]?.dataUrl;
        if (selectedEffectUrl) {
          this.dispatchProcessingComplete({
            effects: this.currentPet.effects,
            sessionKey: this.currentPet.id,
            selectedEffect: this.currentPet.selectedEffect,
            isRestoration: true // Flag to skip animations in mockup grid
          });
          console.log('📤 Dispatched petProcessingComplete for mockup grid restoration');
        }
      } else {
        console.log('🔄 Pet found but no valid effects to restore');
      }

    } catch (error) {
      console.error('❌ Session restoration failed:', error);
      // Non-critical - just start fresh
      this.currentPet = null;
    }
  }

  /**
   * Check for uploaded images from pet selector
   * Supports both GCS URLs (new server-first) and base64 data (legacy fallback)
   * Pet selector stores images as: localStorage['pet_X_image_url'] or localStorage['pet_X_images']
   * @returns {Promise<Object|null>} Image data if found, null otherwise
   */
  async checkPetSelectorUploads() {
    try {
      // Check for active pet index from sessionStorage (set by pet selector)
      const activeIndex = parseInt(sessionStorage.getItem('pet_selector_active_index') || '0');

      // Helper function to check a specific pet index
      const checkPetIndex = async (i) => {
        // NEW: Check for GCS URL first (server-first upload)
        const urlKey = `pet_${i}_image_url`;
        const imageUrl = localStorage.getItem(urlKey);

        if (imageUrl) {
          try {
            console.log(`🌐 Found GCS URL for pet ${i}, fetching...`, imageUrl);

            // Fetch image from GCS URL
            const response = await fetch(imageUrl);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();

            // Convert to base64 for compatibility with existing code
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            // Get metadata from localStorage
            const metadataKey = `pet_${i}_file_metadata`;
            const metadata = localStorage.getItem(metadataKey);
            let name = 'pet-image.jpg';
            let size = blob.size;
            let type = blob.type;

            if (metadata) {
              try {
                const parsed = JSON.parse(metadata);
                if (Array.isArray(parsed) && parsed[0]) {
                  name = parsed[0].name || name;
                  type = parsed[0].type || type;
                }
              } catch (e) {
                console.warn('⚠️ Could not parse metadata:', e);
              }
            }

            console.log(`✅ Loaded image from GCS URL for pet ${i}`, {
              name,
              size,
              type,
              source: 'gcs'
            });

            return {
              petIndex: i,
              key: urlKey,
              data: base64,
              name,
              size,
              type,
              source: 'gcs' // Mark source for debugging
            };
          } catch (error) {
            console.warn(`⚠️ Failed to fetch from GCS URL for pet ${i}:`, error.message);
            // Fall through to base64 fallback below
          }
        }

        // LEGACY: Fall back to base64 localStorage (backward compatibility)
        const base64Key = `pet_${i}_images`;
        const stored = localStorage.getItem(base64Key);

        if (stored) {
          const images = JSON.parse(stored);
          if (Array.isArray(images) && images.length > 0) {
            const img = images[0];

            // Validate it's a proper image data structure
            if (img.data && img.data.startsWith('data:image/')) {
              console.log(`✅ Found base64 image for pet ${i} (legacy)`, {
                name: img.name,
                size: img.size,
                type: img.type,
                source: 'base64'
              });

              return {
                petIndex: i,
                key: base64Key,
                ...img,
                source: 'base64' // Mark source for debugging
              };
            }
          }
        }

        return null;
      };

      // First check the active index
      const activeResult = await checkPetIndex(activeIndex);
      if (activeResult) {
        // Clean up the active index marker
        sessionStorage.removeItem('pet_selector_active_index');
        return activeResult;
      }

      // Fallback: Check pet_0, pet_1, pet_2 in order
      for (let i = 0; i < 3; i++) {
        const result = await checkPetIndex(i);
        if (result) {
          return result;
        }
      }

      console.log('🔍 No pet selector uploads found');
      return null;
    } catch (error) {
      console.error('❌ Error checking pet selector uploads:', error);
      return null;
    }
  }

  /**
   * Load and process image from pet selector
   * Converts base64 data URL to File object and triggers standard processing flow
   * @param {Object} imageData - Image data from pet selector {name, data, size, type, key}
   */
  async loadPetSelectorImage(imageData) {
    try {
      console.log('🚀 Auto-loading image from pet selector...');

      // Validate and sanitize the data URL
      const sanitized = validateAndSanitizeImageData(imageData.data);
      if (!sanitized) {
        console.error('❌ Invalid image data from pet selector');
        this.clearPetSelectorUploads();
        this.showError('Invalid image data. Please try uploading again.');
        return;
      }

      // Convert data URL to Blob
      const response = await fetch(sanitized);
      const blob = await response.blob();

      // Create File object with original filename
      const fileName = imageData.name || 'pet.jpg';
      const file = new File([blob], fileName, {
        type: imageData.type || 'image/jpeg'
      });

      console.log('📸 Processing uploaded image:', {
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)}KB`,
        type: file.type
      });

      // Clear the pet selector upload now that we've loaded it
      this.clearPetSelectorUploads();

      // Trigger standard file processing flow
      await this.processFile(file);

    } catch (error) {
      console.error('❌ Failed to load pet selector image:', error);
      this.showError('Failed to load uploaded image. Please try uploading again.');
      this.clearPetSelectorUploads();
    }
  }

  /**
   * Clear all pet selector uploads from localStorage
   * Prevents stale data from previous sessions
   * Called after successfully loading an image or on error
   */
  clearPetSelectorUploads() {
    try {
      let cleared = 0;
      // Clear up to 10 pet slots (pet_0 through pet_9)
      for (let i = 0; i < 10; i++) {
        // Clear base64 format (pet_X_images)
        const base64Key = `pet_${i}_images`;
        if (localStorage.getItem(base64Key)) {
          localStorage.removeItem(base64Key);
          cleared++;
          console.log(`🧹 Cleared old upload: ${base64Key}`);
        }

        // FIX: Also clear GCS URL format (pet_X_image_url)
        // This prevents re-processing when user returns to processor page
        // after the 30-minute PetStorage timeout expires
        const urlKey = `pet_${i}_image_url`;
        if (localStorage.getItem(urlKey)) {
          localStorage.removeItem(urlKey);
          cleared++;
          console.log(`🧹 Cleared GCS URL upload: ${urlKey}`);
        }

        // Clear metadata too (pet_X_file_metadata)
        const metaKey = `pet_${i}_file_metadata`;
        if (localStorage.getItem(metaKey)) {
          localStorage.removeItem(metaKey);
        }
      }

      // Also clear any active index marker
      if (sessionStorage.getItem('pet_selector_active_index')) {
        sessionStorage.removeItem('pet_selector_active_index');
      }

      if (cleared > 0) {
        console.log(`✅ Cleared ${cleared} pet selector upload(s)`);
      }
    } catch (error) {
      console.error('❌ Error clearing pet selector uploads:', error);
    }
  }

  initializeFeatures() {
    // DISABLED: Comparison manager not part of current customer journey
    // Caused unexpected comparison overlay trigger when selecting effects
    // if (typeof ComparisonManager !== 'undefined') {
    //   this.comparisonManager = new ComparisonManager(this);
    // }

    // Initialize social sharing
    if (typeof PetSocialSharing !== 'undefined') {
      this.sharing = new PetSocialSharing(this);
    }

    // Initialize Gemini AI effects
    this.initializeGemini();
  }

  initializeGemini() {
    try {
      // Check if Gemini modules are available
      if (typeof GeminiAPIClient === 'undefined' || typeof GeminiEffectsUI === 'undefined') {
        console.log('🎨 Gemini modules not loaded - AI effects disabled');
        return;
      }

      // Initialize Gemini client
      this.geminiClient = new GeminiAPIClient();
      this.geminiEnabled = this.geminiClient.enabled;

      if (this.geminiEnabled) {
        console.log('🎨 Gemini AI effects enabled - Ink Wash and Marker styles available');

        // Check quota on initialization to get accurate state BEFORE updating UI
        this.geminiClient.checkQuota().then(() => {
          console.log('🎨 Initial quota check complete:', this.geminiClient.quotaState);

          // Update button states after quota check completes
          this.updateEffectButtonStates();
        }).catch(err => {
          console.warn('🎨 Initial quota check failed, using default:', err);

          // Still update buttons even if quota check fails (will use default state)
          this.updateEffectButtonStates();
        });

        // Initialize UI after container is rendered
        setTimeout(() => {
          this.geminiUI = new GeminiEffectsUI(this.geminiClient);
          this.geminiUI.initialize(this.container);

          // Start midnight quota reset checker
          this.geminiUI.checkQuotaReset();
        }, 100);
      } else {
        console.log('🎨 Gemini AI effects disabled by feature flag');

        // Update button states when Gemini is disabled
        // This ensures Modern/Sketch buttons show correct disabled state
        if (this.currentPet) {
          this.updateEffectButtonStates();
        }
      }
    } catch (error) {
      console.error('🎨 Failed to initialize Gemini:', error);
      this.geminiEnabled = false;

      // Update button states on error
      // Ensures buttons show disabled state if Gemini init fails
      if (this.currentPet) {
        this.updateEffectButtonStates();
      }
    }
  }
  
  render() {
    this.container.innerHTML = `
      <div class="pet-processor-container">
        <!-- Two-column layout wrapper -->
        <div class="processor-columns">
          <!-- Left Column: Controls -->
          <div class="processor-controls">
            <!-- Upload Zone -->
            <div class="upload-zone" data-upload-zone>
              <input type="file" 
                     id="pet-upload-${this.sectionId}" 
                     class="file-input" 
                     accept="image/*">
              <label for="pet-upload-${this.sectionId}" class="upload-label">
                <div class="upload-icon">📷</div>
                <div class="upload-text">Tap to upload or take photo</div>
                <div class="upload-hint">JPG or PNG • Max 10MB</div>
              </label>
            </div>
            
            <!-- Processing View -->
            <div class="processing-view" hidden>
              <div class="processing-spinner"></div>
              <div class="processing-status">
                <div class="processing-text">Processing your pet photo...</div>
                <div class="progress-timer">⏱️ Estimating time...</div>
              </div>
              <div class="progress-stage-info"></div>
              <button class="cancel-processing-btn" onclick="window.petProcessor?.cancelProcessing()">
                Cancel Upload
              </button>
            </div>
            
            <!-- Inline Section Heading (desktop side-by-side layout only) -->
            <div class="inline-section-header" hidden>
              <h2 class="inline-section-heading"></h2>
              <p class="inline-section-subheading"></p>
            </div>

            <!-- Effect Selection (shown in result view) -->
            <div class="effect-grid-wrapper" hidden>
              <h3 class="effect-grid-heading">Choose Style</h3>
              <!-- Effect Selection -->
              <div class="effect-grid style-selector__grid">
                <label class="effect-btn style-card active" data-effect="enhancedblackwhite">
                  <div class="style-card__content">
                    <div class="style-card__image-wrapper">
                      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f5f5f5' width='100' height='100'/%3E%3C/svg%3E" alt="Black & White style preview" class="style-card__image" data-style-preview="bw">
                    </div>
                    <p class="style-card__label">Black & White</p>
                  </div>
                </label>
                <label class="effect-btn style-card" data-effect="color">
                  <div class="style-card__content">
                    <div class="style-card__image-wrapper">
                      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f5f5f5' width='100' height='100'/%3E%3C/svg%3E" alt="Color style preview" class="style-card__image" data-style-preview="color">
                    </div>
                    <p class="style-card__label">Color</p>
                  </div>
                </label>
                <label class="effect-btn style-card" data-effect="ink_wash">
                  <div class="style-card__content">
                    <div class="style-card__image-wrapper">
                      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f5f5f5' width='100' height='100'/%3E%3C/svg%3E" alt="Ink Wash style preview" class="style-card__image" data-style-preview="ink_wash">
                    </div>
                    <p class="style-card__label">Ink Wash</p>
                  </div>
                </label>
                <label class="effect-btn style-card" data-effect="sketch">
                  <div class="style-card__content">
                    <div class="style-card__image-wrapper">
                      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f5f5f5' width='100' height='100'/%3E%3C/svg%3E" alt="Marker style preview" class="style-card__image" data-style-preview="sketch">
                    </div>
                    <p class="style-card__label">Marker</p>
                  </div>
                </label>
              </div>

              <!-- Crop Button - directly below style buttons -->
              <button class="btn-secondary crop-btn" aria-label="Crop image">
                ✂️ Crop Image
              </button>

              <!-- Try Another Pet Button - same styling as crop button -->
              <button class="btn-secondary try-another-btn" aria-label="Process another pet image">
                ↻ Try Another Pet
              </button>
            </div>

            <!-- Error View -->
            <div class="error-view" hidden>
              <div class="error-icon">⚠️</div>
              <div class="error-message"></div>
              <button class="btn-primary try-again-btn">Try Again</button>
            </div>
          </div>
          
          <!-- Right Column: Preview -->
          <div class="processor-preview">
            <!-- Result View -->
            <div class="result-view" hidden>
              <div class="pet-image-container">
                <img class="pet-image" alt="Your pet">
                
                <!-- Comparison Overlay (hidden by default) -->
                <div class="comparison-overlay" hidden>
                  <div class="comparison-panel comparison-current">
                    <img class="comparison-image" alt="Current effect">
                    <div class="comparison-label">Current</div>
                  </div>
                  <div class="comparison-panel comparison-alternative">
                    <img class="comparison-image" alt="Comparing effect">
                    <div class="comparison-label">Compare</div>
                  </div>
                  <div class="comparison-divider"></div>
                </div>
                <div class="comparison-instructions" hidden>
                  Tap right to select • Swipe for more • Tap left to exit
                </div>
              </div>
              
              <!-- Share Button Container -->
              <div class="share-buttons-container">
                <!-- Simple share button will be inserted here by pet-social-sharing-simple.js -->
              </div>
            </div>
            
            <!-- Placeholder for when no image is loaded -->
            <div class="preview-placeholder">
              <div class="placeholder-icon">🖼️</div>
              <div class="placeholder-text">Your processed image will appear here</div>
            </div>
          </div>
        </div>

        <!-- Scroll Hint - Encourages product discovery -->
        <div class="scroll-hint-container" data-scroll-hint>
          <p class="scroll-hint-text">See your pet on our products</p>
          <span class="scroll-hint-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </span>
        </div>
      </div>
    `;
  }

  /**
   * Load style preview images from section settings
   * Reads data attributes from section element and updates image sources
   */
  loadStylePreviewImages() {
    try {
      // Get the section element
      const section = this.container.closest('[data-section-type="ks-pet-processor-v5"]');
      if (!section) {
        console.warn('⚠️ Could not find section element for style previews');
        return;
      }

      // Define image mapping with fallbacks to default assets
      const styleImageMap = {
        'bw': {
          setting: section.dataset.stylePreviewBw,
          fallback: 'pet-bw-preview.jpg',
          element: '[data-style-preview="bw"]'
        },
        'color': {
          setting: section.dataset.stylePreviewColor,
          fallback: 'pet-color-preview.jpg',
          element: '[data-style-preview="color"]'
        },
        'ink_wash': {
          setting: section.dataset.stylePreviewStencil,
          fallback: 'pet-stencil-preview.jpg',
          element: '[data-style-preview="ink_wash"]'
        },
        'sketch': {
          setting: section.dataset.stylePreviewSketch,
          fallback: 'pet-sketch-preview.jpg',
          element: '[data-style-preview="sketch"]'
        }
      };

      // Update each style preview image
      Object.entries(styleImageMap).forEach(([key, config]) => {
        const imgElement = this.container.querySelector(config.element);
        if (imgElement) {
          // Use customizer image if available, otherwise use fallback asset
          imgElement.src = config.setting || `https://cdn.shopify.com/s/files/1/0624/6672/0275/files/${config.fallback}`;
        }
      });

      console.log('🎨 Style preview images loaded successfully');
    } catch (error) {
      console.error('❌ Error loading style preview images:', error);
    }
  }

  /**
   * Load a pet from storage into the processor view
   *
   * @param {Object} pet - Pet data object with sessionKey, effects, selectedEffect
   */
  loadPetFromStorage(pet) {
    if (!pet || !pet.effects) {
      console.error('❌ Invalid pet data:', pet);
      return;
    }

    // Reconstruct currentPet object
    this.currentPet = {
      id: pet.sessionKey,
      filename: 'Pet',
      effects: {},
      selectedEffect: pet.selectedEffect || 'enhancedblackwhite'
    };

    // Restore effects from pet data
    for (const [effectName, effectData] of Object.entries(pet.effects)) {
      if (effectData && (effectData.gcsUrl || effectData.dataUrl)) {
        this.currentPet.effects[effectName] = {
          gcsUrl: effectData.gcsUrl || '',
          dataUrl: effectData.dataUrl || null,
          cacheHit: true
        };
      }
    }

    const effectCount = Object.keys(this.currentPet.effects).length;
    if (effectCount === 0) {
      console.warn('⚠️ Pet has no valid effects:', pet.sessionKey);
      return;
    }

    console.log(`✅ Loaded pet ${pet.sessionKey} with ${effectCount} effect(s)`);

    // Show the result view
    this.showResult({ effects: this.currentPet.effects });

    // Ensure views are properly shown
    setTimeout(() => {
      const uploadZone = this.container.querySelector('.upload-zone');
      const effectGrid = this.container.querySelector('.effect-grid-wrapper');
      const resultView = this.container.querySelector('.processor-preview .result-view');
      const placeholder = this.container.querySelector('.preview-placeholder');
      const container = this.container.querySelector('.pet-processor-container');
      const inlineHeader = this.container.querySelector('.inline-section-header');

      if (uploadZone) uploadZone.hidden = true;
      if (effectGrid) effectGrid.hidden = false;
      if (resultView) resultView.hidden = false;
      if (placeholder) placeholder.style.display = 'none';
      if (container) container.classList.add('has-result');
      if (inlineHeader) inlineHeader.hidden = false;
    }, 50);

    // Set initial image to selected effect
    const img = this.container.querySelector('.pet-image');
    if (img) {
      const selectedEffectData = this.currentPet.effects[this.currentPet.selectedEffect];
      if (selectedEffectData) {
        img.src = selectedEffectData.dataUrl || selectedEffectData.gcsUrl;
      }
    }

    // Update style card thumbnails
    this.updateStyleCardPreviews({ effects: this.currentPet.effects });

    // Highlight the selected effect button
    const selectedBtn = this.container.querySelector(`[data-effect="${this.currentPet.selectedEffect}"]`);
    if (selectedBtn) {
      this.container.querySelectorAll('.effect-btn').forEach(btn => btn.classList.remove('active'));
      selectedBtn.classList.add('active');
    }

    // Dispatch event for mockup grid
    this.dispatchProcessingComplete({
      effects: this.currentPet.effects,
      sessionKey: this.currentPet.id,
      selectedEffect: this.currentPet.selectedEffect,
      isRestoration: true
    });
  }

  /**
   * Get effect display name for UI
   * @param {string} effectKey - Internal effect key
   * @returns {string} Human-readable name
   */
  getEffectDisplayName(effectKey) {
    const names = {
      'enhancedblackwhite': 'B&W',
      'color': 'Color',
      'ink_wash': 'Ink Wash',
      'sketch': 'Marker'
    };
    return names[effectKey] || effectKey;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  bindEvents() {
    // File input
    const fileInput = this.container.querySelector('.file-input');
    fileInput?.addEventListener('change', (e) => this.handleFileSelect(e));

    // Drag and drop
    const uploadZone = this.container.querySelector('[data-upload-zone]');
    uploadZone?.addEventListener('dragover', (e) => this.handleDragOver(e));
    uploadZone?.addEventListener('drop', (e) => this.handleDrop(e));

    // Click handler for collapsed upload zone (mobile "Change Photo" button)
    uploadZone?.addEventListener('click', (e) => {
      const container = this.container.querySelector('.pet-processor-container');
      if (container?.classList.contains('has-result')) {
        // In collapsed state, click anywhere on upload zone triggers file input
        fileInput?.click();
      }
    });

    // Phase 2: Tap-to-zoom on mobile image preview
    const imageContainer = this.container.querySelector('.pet-image-container');
    if (imageContainer && window.innerWidth <= 768) {
      imageContainer.addEventListener('click', () => this.showImageZoom());
    }

    // Effect buttons
    this.container.querySelectorAll('.effect-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchEffect(e.target.closest('.effect-btn')));
    });
    
    // Action buttons
    this.container.querySelector('.crop-btn')?.addEventListener('click', () => this.handleCropClick());
    this.container.querySelector('.try-again-btn')?.addEventListener('click', () => this.reset());
    this.container.querySelector('.try-another-btn')?.addEventListener('click', async () => await this.processAnother());

    // Listen for "Try Another Pet" event from mockup grid
    document.addEventListener('tryAnotherPet', async () => await this.processAnother());
  }
  
  handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (file) this.processFile(file);
  }
  
  handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
  }
  
  handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const file = event.dataTransfer.files?.[0];
    if (file) this.processFile(file);
  }

  /**
   * Phase 2: Show fullscreen image zoom overlay
   * Displays the current processed image in a fullscreen overlay
   * with backdrop and close button
   */
  showImageZoom() {
    const petImage = this.container.querySelector('.pet-image');
    if (!petImage || !petImage.src) {
      console.warn('No image available to zoom');
      return;
    }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'image-zoom-overlay';
    overlay.innerHTML = `
      <div class="zoom-backdrop"></div>
      <div class="zoom-container">
        <img src="${petImage.src}" class="zoom-image" alt="Full size pet image">
        <button class="zoom-close" aria-label="Close zoom">✕</button>
      </div>
    `;

    // Close on backdrop click
    const backdrop = overlay.querySelector('.zoom-backdrop');
    backdrop?.addEventListener('click', () => overlay.remove());

    // Close on button click
    const closeBtn = overlay.querySelector('.zoom-close');
    closeBtn?.addEventListener('click', () => overlay.remove());

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Add overlay to body
    document.body.appendChild(overlay);

    console.log('🔍 Image zoom overlay displayed');
  }

  async processFile(file) {
    // Validate file
    if (!file.type.startsWith('image/')) {
      this.showError('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.showError('Image must be less than 10MB');
      return;
    }

    // Show processing view
    this.showProcessing();

    try {
      // Process image with API (uploads original to GCS in background for fulfillment)
      const result = await this.callAPI(file);

      // Store result (originalUrl uploaded in background, available via effects._originalUrl)
      this.currentPet = {
        id: `pet_${crypto.randomUUID()}`,
        filename: file.name,
        originalFile: file,
        ...result
      };

      // Show result
      this.showResult(result);

      // Update button states (Modern/Sketch will be disabled/loading initially)
      this.updateEffectButtonStates();

    } catch (error) {
      this.showError('Processing failed. Please try again.');
      console.error('Processing error:', error);
    }
  }
  
  // REMOVED: uploadOriginalImage() method
  // Original images are no longer uploaded to GCS
  // Customers will upload images on the product page or provide order number
  
  getSessionId() {
    // Get or create session ID for tracking uploads
    let sessionId = sessionStorage.getItem('pet_processor_session');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('pet_processor_session', sessionId);
    }
    return sessionId;
  }

  /**
   * Show crop interface for post-processing crop
   * Called after effects are applied, allows user to crop the result
   * @param {string} imageUrl - URL of the processed image to crop
   * @returns {Promise<{croppedUrl: string, croppedFile: File}|null>} Cropped result or null if cancelled
   */
  async showCropInterface(imageUrl) {
    // Check if crop is enabled (feature flag)
    const cropEnabled = localStorage.getItem('perkieprints_crop_enabled') !== 'false';
    if (!cropEnabled || !window.CropProcessor) {
      console.log('Crop disabled or CropProcessor not available');
      return null;
    }

    return new Promise((resolve, reject) => {
      // Get or create crop container
      let cropContainer = document.querySelector('.crop-container');
      if (!cropContainer) {
        cropContainer = document.createElement('div');
        cropContainer.className = 'crop-container';
        cropContainer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(cropContainer);
      }

      // Initialize crop processor
      const cropProcessor = new window.CropProcessor({
        onCrop: async (croppedFile) => {
          console.log('✂️ Post-processing crop applied');

          // Convert cropped file to data URL for display
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              croppedUrl: reader.result,
              croppedFile: croppedFile
            });
          };
          reader.readAsDataURL(croppedFile);
        },
        onSkip: () => {
          console.log('⏭️ Crop skipped');
          resolve(null);
        },
        onCancel: () => {
          console.log('❌ Crop cancelled');
          resolve(null);
        }
      });

      cropProcessor.init(cropContainer);

      // Load processed image and show crop UI
      cropProcessor.loadImage(imageUrl).then(() => {
        cropProcessor.show();
      }).catch(reject);
    });
  }

  /**
   * Handle crop button click - crops the currently selected effect
   */
  async handleCropClick() {
    if (!this.currentPet || !this.currentPet.selectedEffect) {
      console.warn('No effect selected for cropping');
      return;
    }

    const selectedEffect = this.currentPet.selectedEffect;
    const effectData = this.currentPet.effects?.[selectedEffect];

    if (!effectData) {
      console.warn('Effect data not found:', selectedEffect);
      return;
    }

    // Get the image URL (prefer dataUrl for transparent Gemini effects, fallback to gcsUrl)
    const imageUrl = effectData.dataUrl || effectData.gcsUrl;
    if (!imageUrl) {
      console.warn('No image URL found for effect:', selectedEffect);
      return;
    }

    try {
      const cropResult = await this.showCropInterface(imageUrl);

      if (cropResult) {
        // Update the effect with cropped version
        this.currentPet.effects[selectedEffect].croppedUrl = cropResult.croppedUrl;
        this.currentPet.effects[selectedEffect].croppedFile = cropResult.croppedFile;

        // Update the displayed image
        const petImage = this.container.querySelector('.pet-image');
        if (petImage) {
          petImage.src = cropResult.croppedUrl;
        }

        console.log('✅ Crop applied to effect:', selectedEffect);

        // Dispatch petCropped event for mockup grid integration
        document.dispatchEvent(new CustomEvent('petCropped', {
          detail: {
            effect: selectedEffect,
            croppedUrl: cropResult.croppedUrl,
            sessionKey: this.currentPet?.id,
            timestamp: Date.now()
          },
          bubbles: true
        }));
        console.log('📤 petCropped event dispatched');
      }
    } catch (error) {
      console.error('Crop error:', error);
    }
  }

  async callAPI(file) {
    // Detailed timing breakdown for debugging
    const timing = {
      totalStart: Date.now(),
      exifFix: { start: 0, end: 0 },
      birefnet: { start: 0, end: 0 },
      gcsUpload: { start: 0, end: 0 },
      gemini: { start: 0, end: 0 }
    };

    // EXIF rotation fix SKIPPED - modern browsers + APIs handle EXIF automatically
    // Saves ~1 second per upload (was doing unnecessary canvas rotation)
    timing.exifFix.start = Date.now();
    // Resize large images before upload to reduce bandwidth (1600px max)
    // BiRefNet caps at 2048px anyway, so this saves 50-70% upload time for 12MP+ images
    const resizedFile = await this.resizeImageForUpload(file, 1600);
    timing.exifFix.end = Date.now();
    console.log(`⏱️ Image prep (resize if needed): ${timing.exifFix.end - timing.exifFix.start}ms`);

    const formData = new FormData();
    formData.append('file', resizedFile);
    formData.append('effects', 'enhancedblackwhite,color');

    // Detect API warmth state BEFORE showing any timer
    const warmthTracker = new APIWarmthTracker();
    const warmthState = warmthTracker.getWarmthState();
    const isFirstTime = warmthTracker.isFirstTimeUser();
    
    // Select appropriate timer based on warmth detection
    let estimatedTime, initialMessage, timeRemaining;
    
    if (warmthState === 'warm') {
      // Warm API: 12-15 seconds
      estimatedTime = 15000;
      initialMessage = '⚡ Fast processing mode active...';
      timeRemaining = '15 seconds remaining';
    } else if (warmthState === 'cold' || isFirstTime) {
      // Cold API or first-time user: 55-65 seconds (50s actual + 10s buffer)
      estimatedTime = 60000;
      initialMessage = isFirstTime ?
        '🤖 First-time setup - loading pet processing engine...' :
        '🧠 Warming up for premium quality...';
      timeRemaining = '60 seconds remaining';
    } else {
      // Unknown state: Conservative estimate (35s actual + 5s buffer)
      estimatedTime = 40000;
      initialMessage = '📤 Processing your pet photo...';
      timeRemaining = '40 seconds remaining';
    }
    
    const startTime = Date.now();
    
    // Start single countdown timer (no restarts ever)
    this.startProgressTimer(estimatedTime);
    
    // Initial progress with appropriate expectation
    this.updateProgressWithTimer(10, initialMessage, timeRemaining);
    
    // Add return_all_effects=true to get JSON response with all effects
    timing.birefnet.start = Date.now();
    const responsePromise = fetch(`${this.apiUrl}/api/v2/process-with-effects?return_all_effects=true&effects=enhancedblackwhite,color`, {
      method: 'POST',
      body: formData
    });

    // Setup unified progressive messaging based on timer duration
    this.setupProgressMessages(estimatedTime);

    const response = await responsePromise;

    if (!response.ok) {
      this.stopProgressTimer();
      throw new Error(`API error: ${response.status}`);
    }

    // Continue with value-focused progress messages
    this.updateProgressWithTimer(75, '🏁 Finalizing your custom preview...', null);

    const data = await response.json();
    timing.birefnet.end = Date.now();
    console.log(`⏱️ BiRefNet API (including network): ${timing.birefnet.end - timing.birefnet.start}ms`);
    
    // Process response - effects are nested in data.effects object
    const effects = {};
    
    // API returns: {success: true, effects: {enhancedblackwhite: "base64...", ...}}
    const effectsData = data.effects || {};
    
    // OPTIMIZATION: Display results immediately with data URLs
    // GCS uploads happen in BACKGROUND (saves ~14s from perceived time)
    const effectNames = Object.keys(effectsData);
    const dataUrls = {};  // Store data URLs for immediate display

    for (const [effectName, base64Data] of Object.entries(effectsData)) {
      // Convert base64 to data URL (handle both raw base64 and full data URLs)
      // BiRefNet API returns full data URLs, InSPyReNet returns raw base64
      const dataUrl = base64Data.startsWith('data:image/')
        ? base64Data  // Already a full data URL
        : `data:image/png;base64,${base64Data}`;  // Raw base64, add prefix

      dataUrls[effectName] = dataUrl;

      // Set up effects with data URLs immediately (user sees results NOW)
      effects[effectName] = {
        gcsUrl: '',  // Will be populated when background upload completes
        dataUrl: dataUrl  // Display immediately
      };
    }

    // Fire GCS uploads in BACKGROUND (don't await - saves ~14.6s)
    // Uploads complete silently, awaited only at cart time
    timing.gcsUpload.start = Date.now();
    console.log('🚀 Starting background GCS uploads (not blocking UI)...');

    // Track original URL for fulfillment (populated by background upload)
    let originalUrl = null;

    const uploadPromises = effectNames.map(effectName =>
      this.uploadToGCS(
        dataUrls[effectName],
        this.getSessionId(),
        'processed',
        effectName
      ).then(gcsUrl => {
        // Update effect with GCS URL when upload completes
        if (gcsUrl) {
          effects[effectName].gcsUrl = gcsUrl;
          effects[effectName].dataUrl = null;  // Clear data URL to save memory
          console.log(`✅ ${effectName} uploaded to GCS (background): ${gcsUrl}`);
        } else {
          console.warn(`⚠️ ${effectName} background upload failed, keeping dataUrl`);
        }
        return { effectName, gcsUrl };
      }).catch(err => {
        console.error(`❌ ${effectName} background upload error:`, err);
        return { effectName, gcsUrl: null };
      })
    );

    // Upload ORIGINAL image to GCS for fulfillment (runs in parallel with effects)
    const originalUploadPromise = this.uploadOriginalToGCS(file, this.getSessionId())
      .then(url => {
        if (url) {
          originalUrl = url;
          // Store in effects object for easy access
          effects._originalUrl = url;
          console.log(`✅ Original image uploaded to GCS: ${url}`);
        }
        return { effectName: '_original', gcsUrl: url };
      })
      .catch(err => {
        console.warn('⚠️ Original image upload failed (non-blocking):', err);
        return { effectName: '_original', gcsUrl: null };
      });

    // Combine effect uploads + original upload
    const allUploadPromises = [...uploadPromises, originalUploadPromise];

    // Store pending uploads - awaited at cart time via ensureUploadsComplete()
    this.pendingGcsUploads = Promise.all(allUploadPromises).then(results => {
      timing.gcsUpload.end = Date.now();
      console.log(`⏱️ Background GCS uploads completed: ${timing.gcsUpload.end - timing.gcsUpload.start}ms`);
      this.pendingGcsUploads = null;  // Clear once complete
      return results;
    });

    // DON'T AWAIT - Fire both GCS uploads AND Gemini generation in background
    // This allows showResult() to be called immediately after BiRefNet completes (~15s)
    // Gemini will update thumbnails progressively when ready (~37s later)

    // Generate Gemini AI effects (Modern + Classic) in background if enabled
    const SKIP_GEMINI_FOR_TESTING = false;  // Re-activated 2026-01-05
    if (!SKIP_GEMINI_FOR_TESTING && this.geminiEnabled && this.geminiClient) {
      // Get background-removed image for Gemini
      const processedImage = data.processed_image || effectsData.color || effectsData.enhancedblackwhite;

      if (processedImage) {
        // Set flags for background generation
        this.geminiGenerating = true;
        this.isProcessing = false;  // Main processing complete, allow UI interactions

        // Update progress for artistic style generation
        this.updateProgressWithTimer(85, '✨ Generating artistic styles...', null);
        timing.gemini.start = Date.now();

        // Convert to data URL if needed
        const imageDataUrl = processedImage.startsWith('data:')
          ? processedImage
          : `data:image/png;base64,${processedImage}`;

        // Fire-and-forget: Generate in background, don't block UI
        this.geminiClient.batchGenerate(imageDataUrl, {
          sessionId: this.getSessionId()
        }).then(async geminiResults => {
          // SUCCESS: Gemini completed in background
          timing.gemini.end = Date.now();
          console.log(`⏱️ Gemini API (background): ${timing.gemini.end - timing.gemini.start}ms`);

          // Only update if user hasn't uploaded a new image
          if (this.currentPet && this.currentPet.effects) {
            // Add Gemini effects to current pet's effects object (initial - with solid backgrounds)
            this.currentPet.effects.ink_wash = {
              gcsUrl: geminiResults.ink_wash.url,
              dataUrl: null,
              cacheHit: geminiResults.ink_wash.cacheHit,
              processingTime: geminiResults.ink_wash.processingTime,
              transparent: false  // Will be set to true after re-segmentation
            };

            this.currentPet.effects.sketch = {
              gcsUrl: geminiResults.sketch.url,
              dataUrl: null,
              cacheHit: geminiResults.sketch.cacheHit,
              processingTime: geminiResults.sketch.processingTime,
              transparent: false  // Will be set to true after re-segmentation
            };

            // Store quota information
            if (geminiResults.quota) {
              this.geminiQuota = geminiResults.quota;
              if (this.geminiUI) {
                this.geminiUI.updateUI();
              }
            }

            console.log('🎨 Gemini AI effects generated (background):', {
              ink_wash: geminiResults.ink_wash.cacheHit ? 'cached' : 'generated',
              sketch: geminiResults.sketch.cacheHit ? 'cached' : 'generated',
              quota: geminiResults.quota
            });

            // Update thumbnails and button states progressively (shows solid bg versions first)
            this.updateStyleCardPreviews(this.currentPet);
            this.updateEffectButtonStates();

            // ============================================================
            // RE-SEGMENTATION: Remove solid backgrounds from Gemini effects
            // Run both in parallel for speed, then update UI when done
            // ============================================================
            console.log('🔄 Starting background removal for AI effects...');
            const resegmentStart = Date.now();

            // Process both effects in parallel
            const [inkWashResult, sketchResult] = await Promise.all([
              this.resegmentGeminiEffect(geminiResults.ink_wash.url),
              this.resegmentGeminiEffect(geminiResults.sketch.url)
            ]);

            const resegmentTime = Date.now() - resegmentStart;
            console.log(`⏱️ AI effects re-segmentation: ${resegmentTime}ms`);

            // Update effects with transparent versions (if still same pet)
            if (this.currentPet && this.currentPet.effects) {
              if (inkWashResult.success) {
                this.currentPet.effects.ink_wash.dataUrl = inkWashResult.dataUrl;
                this.currentPet.effects.ink_wash.transparent = true;
                console.log('✅ Ink Wash: transparent background applied');
              } else {
                console.warn('⚠️ Ink Wash: keeping solid background (re-segmentation failed)');
              }

              if (sketchResult.success) {
                this.currentPet.effects.sketch.dataUrl = sketchResult.dataUrl;
                this.currentPet.effects.sketch.transparent = true;
                console.log('✅ Marker: transparent background applied');
              } else {
                console.warn('⚠️ Marker: keeping solid background (re-segmentation failed)');
              }

              // Update UI with transparent versions
              this.updateStyleCardPreviews(this.currentPet);
              this.updateEffectButtonStates();

              console.log('🎨 AI effects now have transparent backgrounds');

              // CRITICAL: Update PetStorage with Gemini effects (ink_wash, sketch)
              // The initial save happened after BiRefNet (B&W + Color only)
              // This update adds the Gemini effects so they appear in Session Pet Gallery
              if (typeof PetStorage !== 'undefined' && this.currentPet && this.currentPet.id) {
                const updatedPetData = {
                  effects: this.currentPet.effects,  // Now includes all 4 effects
                  timestamp: Date.now()
                };
                console.log('📦 Saving Gemini effects to PetStorage:', {
                  petId: this.currentPet.id,
                  effectKeys: Object.keys(this.currentPet.effects),
                  ink_wash: this.currentPet.effects.ink_wash ? {
                    hasGcsUrl: !!this.currentPet.effects.ink_wash.gcsUrl,
                    hasDataUrl: !!this.currentPet.effects.ink_wash.dataUrl
                  } : 'NOT PRESENT',
                  sketch: this.currentPet.effects.sketch ? {
                    hasGcsUrl: !!this.currentPet.effects.sketch.gcsUrl,
                    hasDataUrl: !!this.currentPet.effects.sketch.dataUrl
                  } : 'NOT PRESENT'
                });
                PetStorage.save(this.currentPet.id, updatedPetData)
                  .then(() => {
                    console.log('✅ PetStorage updated with Gemini effects (ink_wash, sketch)');
                  })
                  .catch((err) => {
                    console.warn('⚠️ Failed to update PetStorage with Gemini effects:', err);
                  });
              }
            }
          } else {
            console.log('🎨 Gemini completed but user uploaded new image - discarding results');
          }

          // Reset generation flag
          this.geminiGenerating = false;
        }).catch(error => {
          // ERROR: Gemini failed (quota, network, etc.)
          timing.gemini.end = Date.now();
          this.geminiGenerating = false;

          console.error('🎨 Gemini generation failed (graceful degradation):', error);

          // Graceful degradation - users still have B&W and Color
          if (error.quotaExhausted) {
            console.log('🎨 Gemini quota exhausted - only B&W and Color available');

            if (this.geminiUI) {
              this.geminiUI.updateUI();
            }
          }

          // Update button states to show AI effects unavailable
          if (this.currentPet) {
            this.updateEffectButtonStates();
          }
        });
      }
    }

    // Final progress
    this.updateProgressWithTimer(100, '🎉 Your Perkie Print preview is ready!', 'Complete!');
    this.processingComplete = true;
    this.stopProgressTimer();
    
    // Record API call for future warmth detection
    const totalTime = Date.now() - startTime;
    warmthTracker.recordAPICall(true, totalTime);

    // Record processing timestamp to prevent unnecessary warmup
    sessionStorage.setItem('last_processing_time', Date.now().toString());

    // Show completion time
    const totalSeconds = Math.round(totalTime / 1000);
    const expectedSeconds = Math.round(estimatedTime / 1000);
    const finishedEarly = totalSeconds < expectedSeconds;
    console.log(`✅ Processing completed in ${totalSeconds} seconds ${finishedEarly ? '(ahead of schedule!)' : '(on time)'}`);

    // Log detailed timing breakdown
    const exifTime = timing.exifFix.end - timing.exifFix.start;
    const birefnetTime = timing.birefnet.end - timing.birefnet.start;
    const geminiTime = timing.gemini.end ? (timing.gemini.end - timing.gemini.start) : 0;
    // GCS uploads now happen in background - show "in progress" if not done
    const gcsTime = timing.gcsUpload.end ? (timing.gcsUpload.end - timing.gcsUpload.start) : 0;
    const gcsStatus = timing.gcsUpload.end ? `${gcsTime}ms` : 'background';
    const accountedTime = exifTime + birefnetTime + geminiTime;  // Don't include GCS (it's background)
    const unaccountedTime = totalTime - accountedTime;

    console.log('%c📊 TIMING BREAKDOWN', 'font-weight: bold; font-size: 14px; color: #007bff;');
    console.log(`┌─────────────────────────────────────────────────────┐`);
    console.log(`│ EXIF Fix:       ${String(exifTime).padStart(6)}ms  (${((exifTime/totalTime)*100).toFixed(1)}%)`);
    console.log(`│ BiRefNet API:   ${String(birefnetTime).padStart(6)}ms  (${((birefnetTime/totalTime)*100).toFixed(1)}%)`);
    console.log(`│ GCS Uploads:    ${gcsStatus.padStart(10)}  (background - not blocking)`);
    console.log(`│ Gemini API:     ${String(geminiTime).padStart(6)}ms  (${((geminiTime/totalTime)*100).toFixed(1)}%)`);
    console.log(`│ Unaccounted:    ${String(unaccountedTime).padStart(6)}ms  (${((unaccountedTime/totalTime)*100).toFixed(1)}%)`);
    console.log(`├─────────────────────────────────────────────────────┤`);
    console.log(`│ TOTAL:          ${String(totalTime).padStart(6)}ms  (100%)`);
    console.log(`│ 🚀 GCS uploads running in background - user sees results NOW`);
    console.log(`└─────────────────────────────────────────────────────┘`);

    return {
      effects,
      selectedEffect: 'enhancedblackwhite'
    };
  }
  
  async fixImageRotation(file) {
    // Simple EXIF handling for mobile photos
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Set proper dimensions
          canvas.width = img.width;
          canvas.height = img.height;

          // Draw image (browser handles EXIF automatically in most cases)
          ctx.drawImage(img, 0, 0);

          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.9);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Resize image before upload to reduce bandwidth and processing time
   * BiRefNet API caps at 2048px anyway, so we resize to 1600px max
   * Saves 50-70% upload bandwidth for 12MP+ images
   * @param {File} file - Input image file
   * @param {number} maxDimension - Maximum dimension (default 1600)
   * @returns {Promise<File>} - Resized file or original if already small
   */
  async resizeImageForUpload(file, maxDimension = 1600) {
    return new Promise((resolve) => {
      // Use createImageBitmap for efficient image loading
      const img = new Image();
      img.onload = () => {
        // Check if resize is needed
        if (img.width <= maxDimension && img.height <= maxDimension) {
          console.log(`📐 Image already optimized: ${img.width}x${img.height}`);
          resolve(file);
          return;
        }

        // Calculate new dimensions maintaining aspect ratio
        let newWidth, newHeight;
        if (img.width > img.height) {
          newWidth = maxDimension;
          newHeight = Math.round(img.height * (maxDimension / img.width));
        } else {
          newHeight = maxDimension;
          newWidth = Math.round(img.width * (maxDimension / img.height));
        }

        // Create canvas and resize
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');

        // Use high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Convert to blob with 90% quality JPEG
        canvas.toBlob((blob) => {
          const originalSize = file.size;
          const newSize = blob.size;
          const savings = Math.round((1 - newSize / originalSize) * 100);
          console.log(`📐 Resized for upload: ${img.width}x${img.height} → ${newWidth}x${newHeight} (${savings}% smaller)`);
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.90);
      };

      // Load image from file
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  
  async fetchAsDataUrl(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('Failed to fetch image:', url);
      return '';
    }
  }

  /**
   * Re-segment a Gemini-generated image through BiRefNet to remove solid background
   * Gemini produces artistic effects with solid backgrounds - this makes them transparent
   * @param {string} imageUrl - GCS URL of the Gemini-generated image
   * @returns {Promise<{dataUrl: string, success: boolean}>} - Transparent image as data URL
   */
  async resegmentGeminiEffect(imageUrl) {
    const startTime = Date.now();
    console.log('🔄 Re-segmenting Gemini effect for transparent background...');

    try {
      // Fetch the Gemini image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch Gemini image: ${response.status}`);
      }
      const blob = await response.blob();

      // Send to BiRefNet for background removal
      const formData = new FormData();
      formData.append('file', blob, 'gemini-effect.png');

      const birefnetResponse = await fetch(
        `${this.apiUrl}/remove-background?format=webp`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!birefnetResponse.ok) {
        throw new Error(`BiRefNet re-segmentation failed: ${birefnetResponse.status}`);
      }

      // BiRefNet /remove-background returns raw binary image data, not JSON
      // Convert the binary response to a data URL
      const imageBlob = await birefnetResponse.blob();
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(imageBlob);
      });

      const elapsed = Date.now() - startTime;
      console.log(`✅ Re-segmentation complete: ${elapsed}ms`);

      return {
        dataUrl: dataUrl,
        success: true
      };
    } catch (error) {
      console.error('❌ Re-segmentation failed:', error);
      return {
        dataUrl: null,
        success: false
      };
    }
  }

  switchEffect(button) {
    if (!button || !this.currentPet) return;

    const effect = button.dataset.effect;
    const effectData = this.currentPet.effects[effect];

    if (!effectData) {
      // Check if this is a Gemini effect that's unavailable due to quota
      if ((effect === 'ink_wash' || effect === 'sketch') && this.geminiEnabled) {
        // Show quota exhausted message
        if (this.geminiUI) {
          this.geminiUI.showWarning(4, 0); // Level 4 = exhausted
        }
      }
      return;
    }

    // Update UI
    this.container.querySelectorAll('.effect-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    button.classList.add('active');

    // Update image - prefer dataUrl (transparent for Gemini effects), fallback to gcsUrl
    const img = this.container.querySelector('.pet-image');
    if (img) {
      const imageUrl = effectData.dataUrl || effectData.gcsUrl;
      if (imageUrl) {
        img.src = imageUrl;
      }
    }

    // Update current selection
    this.currentPet.selectedEffect = effect;
    this.selectedEffect = effect;

    // Dispatch effectChanged event for product mockup grid
    const effectUrl = effectData.dataUrl || effectData.gcsUrl;
    if (effectUrl) {
      document.dispatchEvent(new CustomEvent('effectChanged', {
        detail: {
          effect: effect,
          effectUrl: effectUrl,
          sessionKey: this.currentPet.id
        },
        bubbles: true
      }));
    }

    // Show share button after effect selection
    if (this.sharing) {
      this.sharing.showShareButton();
    }
  }

  /**
   * Update effect button states based on availability
   * Phase 3: Improved Button State Logic
   *
   * State priority (highest to lowest):
   * 1. Effect loaded → ENABLED (can view)
   * 2. Quota exhausted (0/10) → DISABLED with helpful message
   * 3. Processing → LOADING indicator
   * 4. Gemini disabled globally → DISABLED/HIDDEN
   * 5. Ready to generate → ENABLED (allow generation)
   */
  updateEffectButtonStates() {
    // No pet loaded - disable all Gemini buttons
    if (!this.currentPet) {
      const buttons = this.container.querySelectorAll('.effect-btn');
      buttons.forEach(btn => {
        if (btn.dataset.effect === 'ink_wash' || btn.dataset.effect === 'sketch') {
          btn.disabled = true;
          btn.classList.add('effect-btn--disabled');
          btn.classList.remove('effect-btn--loading', 'effect-btn--ready');
          btn.title = 'Upload a photo to unlock all effects';
        }
      });
      return;
    }

    const buttons = this.container.querySelectorAll('.effect-btn');
    buttons.forEach(btn => {
      const effect = btn.dataset.effect;

      // Always enable B&W and Color (unlimited, always available)
      if (effect === 'enhancedblackwhite' || effect === 'color') {
        btn.disabled = false;
        btn.classList.remove('effect-btn--loading', 'effect-btn--disabled', 'effect-btn--ready');
        btn.title = effect === 'enhancedblackwhite' ? 'Black & White effect' : 'Color effect';
        return;
      }

      // Handle Gemini effects (Ink Wash and Sketch)
      if (effect === 'ink_wash' || effect === 'sketch') {
        const effectData = this.currentPet.effects[effect];
        const effectLabel = effect === 'ink_wash' ? 'Ink Wash' : 'Marker';

        // Priority 1: Effect already loaded → ENABLE for viewing
        if (effectData) {
          btn.disabled = false;
          btn.classList.remove('effect-btn--loading', 'effect-btn--disabled', 'effect-btn--ready');
          btn.title = `View ${effectLabel} effect`;

          // Remove loading accessibility attributes
          btn.removeAttribute('aria-label');
          btn.removeAttribute('aria-busy');
          return;
        }

        // Priority 2: Check if Gemini is disabled globally
        if (!this.geminiEnabled) {
          btn.disabled = true;
          btn.classList.add('effect-btn--disabled');
          btn.classList.remove('effect-btn--loading', 'effect-btn--ready');
          btn.title = 'Ink Wash & Marker unavailable';
          return;
        }

        // Priority 3: Check quota status
        if (this.geminiClient) {
          const quotaExhausted = this.geminiClient.isQuotaExhausted();

          if (quotaExhausted) {
            // Quota exhausted - disable with helpful message
            btn.disabled = true;
            btn.classList.add('effect-btn--disabled');
            btn.classList.remove('effect-btn--loading', 'effect-btn--ready');
            btn.title = 'Daily limit reached (resets at midnight)';
            return;
          }
        }

        // Priority 4: Check if Gemini is currently generating
        if (this.geminiGenerating) {
          btn.disabled = true;
          btn.classList.add('effect-btn--loading');
          btn.classList.remove('effect-btn--disabled', 'effect-btn--ready');
          btn.title = `Generating ${effectLabel} effect...`;

          // Add accessibility attributes for screen readers
          btn.setAttribute('aria-label', `Generating ${effectLabel} effect, please wait`);
          btn.setAttribute('aria-busy', 'true');
          return;
        }

        // Priority 5: Ready to generate → ENABLE
        // Allow user to click to trigger generation
        btn.disabled = false;
        btn.classList.add('effect-btn--ready');
        btn.classList.remove('effect-btn--loading', 'effect-btn--disabled');
        btn.title = `Click to generate ${effectLabel} effect`;
      }
    });
  }

  showProcessing() {
    this.hideAllViews();
    const view = this.container.querySelector('.processing-view');
    if (view) view.hidden = false;
    
    // Hide preview placeholder on desktop
    const placeholder = this.container.querySelector('.preview-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    
    this.isProcessing = true;
  }
  
  showResult(result) {
    // NEW: Use requestAnimationFrame to ensure non-blocking UI update
    requestAnimationFrame(() => {
      this.hideAllViews();

      // Add class to enable side-by-side layout on desktop
      const container = this.container.querySelector('.pet-processor-container');
      if (container) container.classList.add('has-result');

      // Show result elements in left column
      const leftResultElements = this.container.querySelectorAll('.processor-controls .effect-grid-wrapper, .processor-controls .action-buttons');
      leftResultElements.forEach(el => el.hidden = false);

      // Show inline section header for desktop side-by-side layout
      const inlineSectionHeader = this.container.querySelector('.inline-section-header');
      if (inlineSectionHeader) {
        inlineSectionHeader.hidden = false;
        // Copy heading text from original section header
        const section = this.container.closest('.ks-pet-processor-section');
        if (section) {
          const originalHeading = section.querySelector('.section-heading');
          const originalSubheading = section.querySelector('.section-subheading');
          const inlineHeading = inlineSectionHeader.querySelector('.inline-section-heading');
          const inlineSubheading = inlineSectionHeader.querySelector('.inline-section-subheading');
          if (originalHeading && inlineHeading) {
            inlineHeading.textContent = originalHeading.textContent;
          }
          if (originalSubheading && inlineSubheading) {
            inlineSubheading.textContent = originalSubheading.textContent;
          }
        }
      }

      // Show result view in right column
      const rightResultView = this.container.querySelector('.processor-preview .result-view');
      if (rightResultView) rightResultView.hidden = false;

      // Hide preview placeholder
      const placeholder = this.container.querySelector('.preview-placeholder');
      if (placeholder) placeholder.style.display = 'none';

      this.isProcessing = false;

      // Set initial image (prefer GCS URL, fallback to dataUrl)
      const img = this.container.querySelector('.pet-image');
      if (img && result.effects.enhancedblackwhite) {
        const imageUrl = result.effects.enhancedblackwhite.gcsUrl || result.effects.enhancedblackwhite.dataUrl;
        if (imageUrl) {
          img.src = imageUrl;
        }
      }

      // Update style card preview images with actual processed images
      this.updateStyleCardPreviews(result);

      // Show scroll hint for product discovery (desktop only)
      const scrollHint = this.container.querySelector('[data-scroll-hint]');
      if (scrollHint) scrollHint.classList.add('visible');

      // Dispatch event for product mockup grid to display
      this.dispatchProcessingComplete(result);
    });
  }

  /**
   * Dispatch petProcessingComplete event for product mockup grid integration
   * Called after processing completes and result is displayed
   * @param {Object} result - Processing result containing effects
   */
  dispatchProcessingComplete(result) {
    if (!result || !result.effects || !this.currentPet) {
      console.warn('[PetProcessor] Cannot dispatch processing complete - missing data');
      return;
    }

    try {
      // Get the current selected effect (default to enhancedblackwhite)
      const selectedEffect = this.selectedEffect || 'enhancedblackwhite';
      const effectData = result.effects[selectedEffect];
      const effectUrl = effectData?.gcsUrl || effectData?.dataUrl;

      // Prepare effects object with GCS URLs
      const effects = {};
      for (const [key, value] of Object.entries(result.effects)) {
        if (value && (value.gcsUrl || value.dataUrl)) {
          effects[key] = {
            gcsUrl: value.gcsUrl || null,
            dataUrl: value.dataUrl || null
          };
        }
      }

      // Get original URL from effects (uploaded in background)
      const originalUrl = result.effects._originalUrl || null;

      const eventDetail = {
        sessionKey: this.currentPet.id,
        selectedEffect: selectedEffect,
        effectUrl: effectUrl,
        effects: effects,
        originalUrl: originalUrl,  // GCS URL for original image (for fulfillment)
        timestamp: Date.now()
      };

      console.log('[PetProcessor] Dispatching petProcessingComplete event', eventDetail);

      document.dispatchEvent(new CustomEvent('petProcessingComplete', {
        detail: eventDetail,
        bubbles: true
      }));
    } catch (error) {
      console.error('[PetProcessor] Error dispatching processing complete event:', error);
    }
  }

  /**
   * Update style selection card images with actual processed pet images
   * Replaces generic placeholder images with user's processed results
   * @param {Object} result - Processing result containing effects
   */
  updateStyleCardPreviews(result) {
    if (!result || !result.effects) return;

    try {
      // Map of effect names to their corresponding preview image selectors
      const styleMap = {
        'enhancedblackwhite': '[data-style-preview="bw"]',
        'color': '[data-style-preview="color"]',
        'ink_wash': '[data-style-preview="ink_wash"]',
        'sketch': '[data-style-preview="sketch"]'
      };

      // Update each style card with the actual processed image
      Object.entries(styleMap).forEach(([effectKey, selector]) => {
        const effectData = result.effects[effectKey];
        const imgElement = this.container.querySelector(selector);

        if (imgElement && effectData) {
          // For Gemini effects (ink_wash, sketch): prefer dataUrl (transparent version from re-segmentation)
          // For BiRefNet effects (color, enhancedblackwhite): prefer gcsUrl (already transparent)
          // Fallback chain: dataUrl -> gcsUrl (ensures transparent AI effects are used when available)
          const imageUrl = effectData.dataUrl || effectData.gcsUrl;
          if (imageUrl) {
            imgElement.src = imageUrl;
          }
        }
      });

      console.log('✅ Style card previews updated with processed images');
    } catch (error) {
      console.error('❌ Error updating style card previews:', error);
    }
  }
  
  showError(message) {
    this.hideAllViews();
    const view = this.container.querySelector('.error-view');
    if (!view) return;
    
    view.hidden = false;
    
    // Show preview placeholder on desktop
    const placeholder = this.container.querySelector('.preview-placeholder');
    if (placeholder) placeholder.style.display = '';
    
    this.isProcessing = false;
    
    const msgEl = view.querySelector('.error-message');
    if (msgEl) msgEl.textContent = message;
  }
  
  hideAllViews() {
    // Hide all views in left column
    const leftViews = this.container.querySelectorAll('.upload-zone, .processing-view, .error-view, .effect-grid-wrapper, .action-buttons');
    leftViews.forEach(view => view.hidden = true);
    
    // Hide result view in right column
    const rightResultView = this.container.querySelector('.processor-preview .result-view');
    if (rightResultView) rightResultView.hidden = true;
    
    // Show placeholder in right column by default
    const placeholder = this.container.querySelector('.preview-placeholder');
    if (placeholder) placeholder.style.display = '';
  }
  
  updateProgress(percent, message) {
    const bar = this.container.querySelector('.progress-bar');
    const text = this.container.querySelector('.processing-text');
    
    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = message;
  }
  
  updateProgressWithTimer(percent, message, timeRemaining) {
    const text = this.container.querySelector('.processing-text');
    const timer = this.container.querySelector('.progress-timer');
    
    if (text) text.textContent = `${message} (${percent}%)`;
    // Only update timer if timeRemaining is provided
    if (timer && timeRemaining !== null) {
      timer.textContent = `⏱️ ${timeRemaining}`;
    }
  }
  
  startProgressTimer(estimatedTime) {
    this.startTime = Date.now();
    this.estimatedTime = estimatedTime;
    this.processingComplete = false;
    
    // Update countdown every second
    this.countdownTimer = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      const remaining = Math.max(0, this.estimatedTime - elapsed);
      const remainingSeconds = Math.ceil(remaining / 1000);
      
      const timer = this.container.querySelector('.progress-timer');
      if (timer) {
        if (remainingSeconds > 0) {
          timer.textContent = `⏱️ ${remainingSeconds} seconds remaining`;
        } else {
          timer.textContent = '⏱️ Almost done...';
        }
      }
    }, 1000);
  }
  
  stopProgressTimer() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
  
  setupProgressMessages(estimatedTime) {
    // Unified progress messaging system - single module for all timer scenarios
    // Messages are scheduled based on the estimated processing time
    
    if (estimatedTime <= 20000) {
      // Fast processing (warm API: 12-15s)
      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(50, '🎨 Creating your pet\'s artistic effects...', null);
        }
      }, 7000);
      
      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(80, '✨ Finalizing your custom preview...', null);
        }
      }, 12000);
      
    } else if (estimatedTime >= 55000) {
      // Cold start processing (55-65s)
      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(15, '📦 Loading processing engine...', null);
        }
      }, 8000);

      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(30, '🔍 Analyzing your pet\'s unique features...', null);
        }
      }, 19000);

      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(50, '🎨 Creating professional-quality effects...', null);
        }
      }, 34000);

      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(75, '✨ Perfecting your pet\'s transformation...', null);
        }
      }, 49000);

    } else {
      // Conservative processing (unknown state: 40s)
      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(25, '🔍 Analyzing your pet\'s unique features...', null);
        }
      }, 9000);

      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(50, '🎨 Creating professional-quality effects...', null);
        }
      }, 20000);

      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(75, '✨ Perfecting your pet\'s transformation...', null);
        }
      }, 30000);
    }
  }
  
  
  cancelProcessing() {
    this.processingComplete = true;
    this.stopProgressTimer();
    // Use reset() to properly clear state and remove has-result class
    // This ensures upload zone shows in full expanded state (not collapsed)
    this.reset();
    console.log('Processing cancelled by user');
  }
  
  // Save pet data without navigation (extracted from saveToCart)
  async savePetData() {
    if (!this.currentPet || !this.currentPet.effects) {
      console.error('❌ No current pet or effects available');
      return false;
    }

    // Pet name is not collected on processor page (collected on product page instead)
    const petName = '';
    const artistNote = ''; // Artist notes collected in inline preview modal (product page)
    const selectedEffect = this.currentPet.selectedEffect || 'enhancedblackwhite';
    const effectData = this.currentPet.effects[selectedEffect];

    // Check if effect data exists (handle both InSPyReNet dataUrl and Gemini gcsUrl)
    if (!effectData || (!effectData.dataUrl && !effectData.gcsUrl)) {
      console.error('❌ Effect data not found for:', selectedEffect);
      console.log('Available effects:', Object.keys(this.currentPet.effects));
      return false;
    }

    // Upload to GCS if needed
    // For Gemini effects with transparent backgrounds: upload the transparent dataUrl to replace solid background
    // For InSPyReNet effects: upload if not already uploaded
    console.log('📤 Uploading processed image to GCS if needed...');
    let gcsUrl = effectData.gcsUrl || '';

    // For Gemini effects with transparent backgrounds, upload the transparent version
    // This replaces the original Gemini output (solid background) with transparent version
    const isGeminiEffect = selectedEffect === 'ink_wash' || selectedEffect === 'sketch';
    const hasTransparentVersion = effectData.dataUrl && effectData.transparent === true;

    if (isGeminiEffect && hasTransparentVersion) {
      // Upload transparent version to GCS (replaces solid background)
      console.log('📤 Uploading transparent AI effect to GCS...');
      const transparentGcsUrl = await this.uploadToGCS(
        effectData.dataUrl,
        this.currentPet.id,
        'processed',
        `${selectedEffect}_transparent`
      );
      if (transparentGcsUrl) {
        gcsUrl = transparentGcsUrl;
        effectData.transparentGcsUrl = transparentGcsUrl; // Store transparent version URL
        console.log(`✅ Transparent AI effect uploaded: ${transparentGcsUrl}`);
      } else {
        console.warn('⚠️ Transparent AI effect upload failed, using original');
      }
    } else if (!gcsUrl && effectData.dataUrl) {
      // InSPyReNet effects or Gemini without transparent version
      gcsUrl = await this.uploadToGCS(
        effectData.dataUrl,
        this.currentPet.id,
        'processed',
        selectedEffect
      );
      if (gcsUrl) {
        effectData.gcsUrl = gcsUrl; // Cache in memory
        console.log(`✅ Processed image uploaded: ${gcsUrl}`);
      } else {
        console.warn('⚠️ Processed image upload failed');
      }
    }

    // Save only effects GCS URLs
    // Customer provides name, selects effect, and uploads image on product page
    // Artist notes are now captured in the inline preview modal
    const petData = {
      effects: this.currentPet.effects, // ALL generated effects with GCS URLs
      timestamp: Date.now()             // For cleanup/sorting
    };

    // Save with GCS URLs to localStorage
    try {
      await PetStorage.save(this.currentPet.id, petData);
      const totalPets = Object.keys(PetStorage.getAll()).length;
      console.log(`✅ Pet saved: ${this.currentPet.id} (Total pets: ${totalPets})`);
    } catch (error) {
      console.error('❌ Failed to save pet:', error);
      if (error.name === 'QuotaExceededError') {
        alert('Storage is full. Please refresh the page and try again.');
      }
      return false;
    }

    // Dispatch event for Shopify integration
    // Only include sessionKey and artistNote (customer provides name/effect on product page)
    document.dispatchEvent(new CustomEvent('petProcessorComplete', {
      detail: {
        sessionKey: this.currentPet.id,
        artistNote: artistNote,
        effects: this.currentPet.effects  // All effect GCS URLs
      }
    }));

    return true;  // Success
  }

  // Email capture and Add to Product methods removed - users now click products directly from mockup grid


  async saveToCart() {
    // Use the extracted save logic
    const saved = await this.savePetData();
    if (!saved) {
      return;  // Exit if save failed
    }

    // Smart redirect: return to originating product page if available
    const btn = this.container.querySelector('.add-to-cart-btn');
    if (btn) {
      btn.disabled = true;

      // Check document.referrer for product page
      let redirectUrl = '/collections/personalized-pet-products-gifts'; // Default fallback
      let productTitle = 'products';

      try {
        const referrer = document.referrer;

        // Check if referrer is a product page (contains /products/)
        if (referrer && referrer.includes('/products/')) {
          redirectUrl = referrer;

          // Extract product title from URL
          const match = referrer.match(/\/products\/([^?#]+)/);
          if (match && match[1]) {
            productTitle = match[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          } else {
            productTitle = 'product';
          }

          console.log(`✅ Returning to product: ${productTitle} (${redirectUrl})`);
        } else {
          console.log('ℹ️ No product referrer found, using collections fallback');
        }
      } catch (error) {
        console.warn('⚠️ Error reading referrer, using fallback:', error);
      }

      // Update button text based on destination
      if (redirectUrl.includes('/products/')) {
        btn.textContent = `✓ Saved! Returning to ${productTitle}...`;
      } else {
        btn.textContent = '✓ Saved! Taking you to products...';
      }

      // Redirect after brief success message
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1500);
    }
  }
  
  async processAnother() {
    // Double-click protection
    const processAnotherBtn = this.container.querySelector('.process-another-btn');
    if (processAnotherBtn && processAnotherBtn.disabled) {
      console.log('⏳ Already processing, please wait...');
      return;
    }
    
    // Disable button to prevent double-clicks
    if (processAnotherBtn) {
      processAnotherBtn.disabled = true;
    }
    
    // CRITICAL FIX: Save current pet before resetting (without navigation)
    if (this.currentPet && this.currentPet.id) {
      console.log('💾 Saving current pet before processing another...');
      
      try {
        // Use savePetData instead of saveToCart to avoid navigation
        const saved = await this.savePetData();
        
        if (saved) {
          // Show brief success message
          if (processAnotherBtn) {
            const originalText = processAnotherBtn.textContent;
            processAnotherBtn.textContent = '✓ Pet saved! Starting new...';
            setTimeout(() => {
              if (processAnotherBtn) {
                processAnotherBtn.textContent = originalText;
                processAnotherBtn.disabled = false;  // Re-enable after success
              }
            }, 1500);
          }
        } else {
          // Re-enable button if save failed
          if (processAnotherBtn) {
            processAnotherBtn.disabled = false;
          }
        }
      } catch (error) {
        console.error('❌ Failed to save pet before reset:', error);
        // Re-enable button on error
        if (processAnotherBtn) {
          processAnotherBtn.disabled = false;
        }
        // Still proceed with reset even if save fails
      }
    } else {
      // Re-enable button if no pet to save
      if (processAnotherBtn) {
        processAnotherBtn.disabled = false;
      }
    }
    
    // Reset the interface to show upload zone
    this.reset();
    
    console.log('🐕 Ready to process another pet');
  }
  
  /**
   * TEMPORARY: Sync pet data to legacy window.perkieEffects Map
   * Needed because pet selector component hasn't been fully migrated to PetStorage
   */
  syncToLegacyStorage(petId, petData) {
    // This method is temporarily re-enabled until pet selector migration is complete
    console.log('🔄 syncToLegacyStorage called with petId:', petId);
    
    try {
      // Initialize window.perkieEffects as Map if needed
      if (!window.perkieEffects || !(window.perkieEffects instanceof Map)) {
        console.log('🔧 Initializing window.perkieEffects Map');
        window.perkieEffects = new Map();
      }
      
      // IMPORTANT: First, reload all existing pets from PetStorage to maintain full list
      const allPets = PetStorage.getAll();
      console.log('📊 PetStorage contains', Object.keys(allPets).length, 'pets:', Object.keys(allPets));
      
      Object.entries(allPets).forEach(([existingId, existingPet]) => {
        if (existingId !== petId) {  // Don't duplicate current pet
          console.log('🐕 Processing existing pet:', existingId, existingPet);
          
          // Ensure existingPet has required properties
          if (!existingPet || typeof existingPet !== 'object') {
            console.warn('⚠️ Invalid pet data for:', existingId);
            return;
          }
          
          const petEffect = existingPet.effect || 'enhancedblackwhite';
          const petThumbnail = existingPet.thumbnail || existingPet.gcsUrl || '';
          const petName = existingPet.name || existingPet.petName || 'Pet';
          
          const existingEffectKey = `${existingId}_${petEffect}`;
          
          if (petThumbnail) {
            window.perkieEffects.set(existingEffectKey, petThumbnail);
            console.log('✅ Set effect key:', existingEffectKey);
          } else {
            console.warn('⚠️ No thumbnail for pet:', existingId);
          }
          
          window.perkieEffects.set(`${existingId}_metadata`, {
            sessionKey: existingId,
            name: petName,
            effect: petEffect,
            timestamp: existingPet.timestamp || Date.now()
          });
          console.log('✅ Set metadata for:', existingId);
        }
      });
      
      // Now add the current pet
      const selectedEffect = petData.effect || 'enhancedblackwhite';
      const effectKey = `${petId}_${selectedEffect}`;
      
      if (petData.thumbnail) {
        window.perkieEffects.set(effectKey, petData.thumbnail);
        localStorage.setItem(effectKey, petData.thumbnail);
        console.log('✅ Stored selected effect:', effectKey);
      }
      
      // Store metadata with special key
      const metadataKey = `${petId}_metadata`;
      const metadata = {
        sessionKey: petId,
        name: petData.name,
        artistNote: petData.artistNote || '',
        filename: petData.filename || 'pet.jpg',
        selectedEffect: selectedEffect,
        timestamp: Date.now(),
        gcsUrl: petData.gcsUrl || ''
      };
      
      window.perkieEffects.set(metadataKey, metadata);
      localStorage.setItem(metadataKey, JSON.stringify(metadata));
      
      // Update legacy perkieEffects_selected format for backward compatibility
      let effects = {};
      const stored = localStorage.getItem('perkieEffects_selected');
      if (stored) {
        try {
          effects = JSON.parse(stored);
        } catch (e) {
          effects = {};
        }
      }
      
      effects[petId] = {
        sessionKey: petId,
        effect: petData.selectedEffect || petData.effect,
        gcsUrl: petData.gcsUrl || '',
        name: petData.name,
        filename: petData.filename || 'pet.jpg',
        timestamp: Date.now()
      };
      
      localStorage.setItem('perkieEffects_selected', JSON.stringify(effects));
      
      // Create/update session list for pet selector compatibility
      const sessionKey = 'pet_session_pet-bg-remover';
      let sessionData = {};
      try {
        const existing = localStorage.getItem(sessionKey);
        if (existing) {
          sessionData = JSON.parse(existing);
        }
      } catch (e) {
        sessionData = {};
      }
      
      // Initialize arrays if missing
      if (!sessionData.processedPets) sessionData.processedPets = [];
      if (!sessionData.petNames) sessionData.petNames = {};
      
      // Add pet if not already in list
      if (!sessionData.processedPets.includes(petId)) {
        sessionData.processedPets.push(petId);
      }
      
      // Update pet name and metadata
      sessionData.petNames[petId] = petData.name || 'My Pet';
      sessionData.timestamp = Date.now();
      
      localStorage.setItem(sessionKey, JSON.stringify(sessionData));
      console.log('✅ Created session list for pet selector compatibility');
      
      console.log('✅ Synced pet to all storage formats:', petId);
      console.log('📊 Final Map size:', window.perkieEffects.size, 'entries');
      
      // Log final Map contents for debugging
      if (window.perkieEffects.size > 0) {
        const mapKeys = Array.from(window.perkieEffects.keys());
        console.log('🗺️ Map contains keys:', mapKeys);
      }
      
      this.validateStorageSync(petId);
    } catch (error) {
      console.error('❌ Failed to sync to legacy storage:', error);
      console.error('❌ Error details:', error.message, error.stack);
      
      // Try to identify which operation failed
      if (error.message && error.message.includes('PetStorage')) {
        console.error('❌ PetStorage.getAll() may have failed');
      }
      if (error.message && error.message.includes('forEach')) {
        console.error('❌ Error during pet iteration');
      }
    }
  }
  
  /**
   * Validate that storage sync worked correctly
   */
  validateStorageSync(petId) {
    console.log('🔍 Validating storage sync for:', petId);
    
    // Check window.perkieEffects
    if (!window.perkieEffects || !(window.perkieEffects instanceof Map)) {
      console.error('❌ window.perkieEffects not initialized as Map');
      return false;
    }
    
    let hasEffect = false;
    let hasMetadata = false;
    
    window.perkieEffects.forEach((value, key) => {
      if (key.startsWith(petId + '_')) {
        if (key.endsWith('_metadata')) {
          hasMetadata = true;
          console.log('✅ Found metadata:', key);
        } else {
          hasEffect = true;
          console.log('✅ Found effect thumbnail:', key);
        }
      }
    });
    
    console.log(`✅ Pet ${petId}: ${hasEffect ? 'has thumbnail' : 'missing thumbnail'}, ${hasMetadata ? 'has metadata' : 'missing metadata'}`);
    
    // Check localStorage persistence
    const legacyData = localStorage.getItem('perkieEffects_selected');
    if (legacyData) {
      try {
        const parsed = JSON.parse(legacyData);
        if (parsed[petId]) {
          console.log('✅ Found in perkieEffects_selected:', petId);
        } else {
          console.error('❌ Missing from perkieEffects_selected:', petId);
        }
      } catch (e) {
        console.error('❌ Invalid perkieEffects_selected format');
      }
    }
    
    // Validate session list was created
    const sessionKey = 'pet_session_pet-bg-remover';
    const sessionData = localStorage.getItem(sessionKey);
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        if (parsed.processedPets && parsed.processedPets.includes(petId)) {
          console.log('✅ Pet found in session list');
        } else {
          console.error('❌ Pet missing from session list:', petId);
        }
      } catch (e) {
        console.error('❌ Invalid session list format');
      }
    } else {
      console.error('❌ No session list found');
    }
    
    return hasEffect && hasMetadata;
  }
  
  reset() {
    this.currentPet = null;
    this.isProcessing = false;
    this.hideAllViews();

    // Remove side-by-side layout class
    const container = this.container.querySelector('.pet-processor-container');
    if (container) container.classList.remove('has-result');

    // Hide scroll hint
    const scrollHint = this.container.querySelector('[data-scroll-hint]');
    if (scrollHint) scrollHint.classList.remove('visible');

    // Show upload zone
    const uploadZone = this.container.querySelector('[data-upload-zone]');
    if (uploadZone) uploadZone.hidden = false;

    // Reset file input
    const fileInput = this.container.querySelector('.file-input');
    if (fileInput) fileInput.value = '';

    // Note: Pet name and artist notes are not collected on processor page
    // They are collected on product page instead

    // Clear artist notes textarea (if it exists for backward compatibility)
    const artistNotesInput = this.container.querySelector('.artist-notes-input');
    if (artistNotesInput) artistNotesInput.value = '';
  }

  /**
   * Upload image to Google Cloud Storage
   * @param {string} dataUrl - Base64 data URL
   * @param {string} sessionKey - Pet session identifier
   * @param {string} imageType - 'original' or 'processed'
   * @param {string} effect - Effect name (e.g., 'enhancedblackwhite')
   * @returns {Promise<string|null>} GCS public URL or null if failed
   */
  async uploadToGCS(dataUrl, sessionKey, imageType, effect = 'none') {
    try {
      console.log(`📤 Uploading ${imageType} image to GCS...`);

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Create form data
      const formData = new FormData();
      const filename = `${sessionKey}_${imageType}_${effect}_${Date.now()}.png`;
      formData.append('file', blob, filename);
      formData.append('session_id', sessionKey);
      formData.append('image_type', imageType === 'original' ? 'original' : `processed_${effect}`);
      formData.append('tier', 'temporary'); // 7-day retention

      // Add metadata if available
      if (this.currentPet && this.currentPet.name) {
        formData.append('pet_name', this.currentPet.name);
      }
      if (effect && effect !== 'none') {
        formData.append('effect_applied', effect);
      }

      // Upload to existing /store-image endpoint
      const apiUrl = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/store-image';
      const uploadResponse = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error(`❌ Upload failed (${uploadResponse.status}):`, errorText);
        return null;
      }

      const result = await uploadResponse.json();

      if (result.success && result.url) {
        console.log(`✅ ${imageType} uploaded:`, result.url);
        return result.url;
      } else {
        console.error('❌ Upload succeeded but no URL returned:', result);
        return null;
      }

    } catch (error) {
      console.error(`❌ GCS upload error (${imageType}):`, error);
      return null;
    }
  }

  /**
   * Convert File object to data URL
   * @param {File} file - File object to convert
   * @returns {Promise<string>} Data URL (data:image/...;base64,...)
   */
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Upload original image to GCS for fulfillment purposes
   * Runs in background (fire-and-forget) - does not block processing
   * @param {File} file - Original image file
   * @param {string} sessionKey - Pet session identifier
   * @returns {Promise<string|null>} GCS public URL or null if failed
   */
  async uploadOriginalToGCS(file, sessionKey) {
    try {
      console.log('📤 Uploading original image to GCS for fulfillment...');

      // Convert file to data URL
      const dataUrl = await this.fileToDataUrl(file);

      // Use existing uploadToGCS method with 'original' type
      const gcsUrl = await this.uploadToGCS(dataUrl, sessionKey, 'original', 'source');

      if (gcsUrl) {
        console.log(`✅ Original image uploaded to GCS: ${gcsUrl}`);
        return gcsUrl;
      } else {
        console.warn('⚠️ Original image upload failed');
        return null;
      }
    } catch (error) {
      console.error('❌ Original image upload error:', error);
      return null;
    }
  }

  /**
   * Ensure all background GCS uploads are complete
   * Called before cart operations to guarantee GCS URLs are available
   * @returns {Promise<void>}
   */
  async ensureUploadsComplete() {
    if (this.pendingGcsUploads) {
      console.log('⏳ Waiting for background GCS uploads to complete...');
      await this.pendingGcsUploads;
      console.log('✅ Background GCS uploads complete');
    }
  }

  /**
   * Upload selected effect's images to GCS
   * Called from buy-buttons.liquid during cart integration
   * @param {string} sessionKey - Pet session identifier
   * @param {string} effect - Effect name
   * @param {Function} callback - Called with {processed: url} or null
   */
  async syncSelectedToCloud(sessionKey, effect, callback) {
    try {
      console.log(`📤 Syncing to cloud: ${sessionKey}, effect: ${effect}`);

      // Ensure any background uploads are complete before proceeding
      await this.ensureUploadsComplete();

      // Find pet in processed pets
      const pet = this.processedPets.find(p => p.id === sessionKey);
      if (!pet) {
        console.error('❌ Pet not found:', sessionKey);
        callback(null);
        return;
      }

      // Get effect data
      const effectData = pet.effects[effect];
      if (!effectData || !effectData.dataUrl) {
        console.error('❌ Effect data not found:', effect);
        callback(null);
        return;
      }

      // Check if URL already exists (cached)
      if (effectData.gcsUrl) {
        console.log('✅ Using cached GCS URL');
        callback({
          processed: effectData.gcsUrl
        });
        return;
      }

      // Upload processed image
      const processedUrl = await this.uploadToGCS(
        effectData.dataUrl,
        sessionKey,
        'processed',
        effect
      );

      if (!processedUrl) {
        console.error('❌ Failed to upload processed image');
        callback(null);
        return;
      }

      // Update pet data with GCS URL
      effectData.gcsUrl = processedUrl;

      // Update PetStorage with GCS URL
      const petData = PetStorage.get(sessionKey);
      if (petData) {
        await PetStorage.save(sessionKey, {
          ...petData,
          gcsUrl: processedUrl
        });
        console.log('✅ Updated PetStorage with GCS URL');
      }

      // Return URL via callback (no originalUrl - customer uploads on product page)
      callback({
        processed: processedUrl
      });

    } catch (error) {
      console.error('❌ syncSelectedToCloud error:', error);
      callback(null);
    }
  }
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🐾 DOMContentLoaded - Initializing PetProcessor');
    const sections = document.querySelectorAll('[data-section-type="ks-pet-processor-v5"]');
    console.log('🐾 Found sections:', sections.length);
    sections.forEach(section => {
      console.log('🐾 Section element:', section);
      console.log('🐾 Section ID attribute:', section.id);
      console.log('🐾 Section dataset.sectionId:', section.dataset.sectionId);
      const processor = new PetProcessor(section.dataset.sectionId);
      // Store globally for debugging and integration
      window.petProcessor = processor;
    });
  });
} else {
  console.log('🐾 DOM already loaded - Initializing PetProcessor');
  const sections = document.querySelectorAll('[data-section-type="ks-pet-processor-v5"]');
  console.log('🐾 Found sections:', sections.length);
  sections.forEach(section => {
    console.log('🐾 Section element:', section);
    console.log('🐾 Section ID attribute:', section.id);
    console.log('🐾 Section dataset.sectionId:', section.dataset.sectionId);
    const processor = new PetProcessor(section.dataset.sectionId);
    // Store globally for debugging and integration
    window.petProcessor = processor;
  });
}

// API Warmth Tracker for intelligent timer selection
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
      // Check if user has ever used the API
      const hasLocalData = localStorage.getItem(this.storageKey);
      const hasSessionData = sessionStorage.getItem(this.sessionKey);
      const hasProcessedCount = localStorage.getItem('perkie_processed_count');
      
      const isFirstTime = !hasLocalData && !hasSessionData && !hasProcessedCount;
      
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
  
  getEstimatedTime() {
    // Helper method to get estimated processing time
    const state = this.getWarmthState();
    const isFirstTime = this.isFirstTimeUser();
    
    if (state === 'warm') {
      return { min: 8000, max: 15000, estimate: 15000 };
    } else if (state === 'cold' || isFirstTime) {
      return { min: 60000, max: 85000, estimate: 80000 };
    } else {
      return { min: 15000, max: 75000, estimate: 45000 };
    }
  }
  
  // Debug helper
  debugWarmthState() {
    console.group('🔍 API Warmth Debug Info');
    console.log('Current state:', this.getWarmthState());
    console.log('First-time user:', this.isFirstTimeUser());
    console.log('Estimated time:', this.getEstimatedTime());

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        console.log('Last call:', new Date(data.lastCall).toLocaleString());
        console.log('Call history:', data.callHistory);
        console.log('Warmth confidence:', data.warmthConfidence);
      }
    } catch (e) {}

    console.groupEnd();
  }
}

// Export for global access
window.PetProcessor = PetProcessor;
window.ComparisonManager = ComparisonManager;