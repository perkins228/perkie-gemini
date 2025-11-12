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
    this.effectOrder = ['enhancedblackwhite', 'color', 'modern', 'sketch'];
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
    
    this.apiUrl = 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app';
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

      // === NEW: Check for pet selector uploaded images FIRST ===
      const petSelectorImage = await this.checkPetSelectorUploads();
      if (petSelectorImage) {
        console.log('📸 Found uploaded image from pet selector, auto-loading...');
        await this.loadPetSelectorImage(petSelectorImage);
        return; // Early return - don't check PetStorage
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

      // Check for other Gemini effects in localStorage (modern/sketch)
      // These might exist even if not the selected effect
      const modernKey = `${latestPet.id}_modern`;
      const sketchKey = `${latestPet.id}_sketch`;

      const modernData = safeGetLocalStorage(modernKey, null);
      if (modernData && !this.currentPet.effects.modern) {
        // Validate modern effect data
        let validModernUrl = null;
        if (typeof modernData === 'string') {
          if (modernData.startsWith('http') && validateGCSUrl(modernData)) {
            validModernUrl = modernData;
          } else if (modernData.startsWith('data:')) {
            validModernUrl = validateAndSanitizeImageData(modernData);
          }
        }

        if (validModernUrl) {
          this.currentPet.effects.modern = {
            gcsUrl: validModernUrl.startsWith('http') ? validModernUrl : '',
            dataUrl: validModernUrl.startsWith('data:') ? validModernUrl : null,
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

        // Set initial image to selected effect
        const img = this.container.querySelector('.pet-image');
        if (img) {
          const selectedEffectData = this.currentPet.effects[this.currentPet.selectedEffect];
          if (selectedEffectData) {
            img.src = selectedEffectData.gcsUrl || selectedEffectData.dataUrl;
          }
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
        const key = `pet_${i}_images`;
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          cleared++;
          console.log(`🧹 Cleared old upload: ${key}`);
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
    // Initialize comparison manager
    if (typeof ComparisonManager !== 'undefined') {
      this.comparisonManager = new ComparisonManager(this);
    }

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
        console.log('🎨 Gemini AI effects enabled - Modern and Classic styles available');

        // Initialize UI after container is rendered
        setTimeout(() => {
          this.geminiUI = new GeminiEffectsUI(this.geminiClient);
          this.geminiUI.initialize(this.container);

          // Start midnight quota reset checker
          this.geminiUI.checkQuotaReset();

          // Update button states now that Gemini is initialized
          // This ensures buttons reflect geminiEnabled = true for restored sessions
          this.updateEffectButtonStates();
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
            
            <!-- Effect Selection (shown in result view) -->
            <div class="effect-grid-wrapper" hidden>
              <h3 class="effect-grid-heading">Choose Style</h3>
              <!-- Effect Selection -->
              <div class="effect-grid style-selector__grid">
                <label class="effect-btn style-card active" data-effect="enhancedblackwhite">
                  <div class="style-card__content">
                    <div class="style-card__image-wrapper">
                      <img src="" alt="Black & White style preview" class="style-card__image" data-style-preview="bw">
                    </div>
                    <p class="style-card__label">Black & White</p>
                  </div>
                </label>
                <label class="effect-btn style-card" data-effect="color">
                  <div class="style-card__content">
                    <div class="style-card__image-wrapper">
                      <img src="" alt="Color style preview" class="style-card__image" data-style-preview="color">
                    </div>
                    <p class="style-card__label">Color</p>
                  </div>
                </label>
                <label class="effect-btn style-card effect-btn--ai" data-effect="modern">
                  <div class="style-card__content">
                    <div class="style-card__image-wrapper">
                      <img src="" alt="Modern style preview" class="style-card__image" data-style-preview="modern">
                    </div>
                    <p class="style-card__label">Modern</p>
                  </div>
                </label>
                <label class="effect-btn style-card effect-btn--ai" data-effect="sketch">
                  <div class="style-card__content">
                    <div class="style-card__image-wrapper">
                      <img src="" alt="Sketch style preview" class="style-card__image" data-style-preview="sketch">
                    </div>
                    <p class="style-card__label">Sketch</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Actions (shown in result view) -->
            <div class="action-buttons" hidden>

              <!-- Inline Email Capture Section -->
              <div class="email-capture-inline" role="region" aria-label="Email capture for free download">
                <div class="email-capture-header">
                  <h3 class="email-heading">Love it?</h3>
                </div>

                <!-- Primary CTA: Add to Product (moved inside container) -->
                <button class="btn-primary-shop add-to-product-btn" aria-label="Add to product page">
                  🛍️ Add to Product
                </button>

                <!-- OR Separator -->
                <div class="cta-separator">
                  <span class="separator-line"></span>
                  <span class="separator-text">or</span>
                  <span class="separator-line"></span>
                </div>

                <!-- Email prompt text -->
                <p class="email-prompt-text">Enter your email to download this image and get updates on new styles and offers</p>

                <form class="email-form-inline" id="email-form-inline-${this.sectionId}">
                  <div class="email-input-group">
                    <input type="email"
                           class="email-input-inline"
                           id="email-input-inline-${this.sectionId}"
                           name="email"
                           placeholder="your@email.com"
                           autocomplete="email"
                           autocorrect="off"
                           autocapitalize="off"
                           spellcheck="false"
                           aria-label="Email address for download links"
                           required>

                    <button type="submit" class="btn-email-submit" aria-label="Submit email to get free download link">
                      <span class="btn-text">Get Image</span>
                      <span class="btn-icon">📥</span>
                    </button>
                  </div>

                  <p class="email-privacy-note">
                    We respect your privacy. Unsubscribe anytime.
                    <a href="/policies/privacy-policy" target="_blank">Privacy Policy</a>
                  </p>

                  <div class="email-error-inline" role="alert" aria-live="polite" hidden></div>
                  <div class="email-success-inline" role="status" aria-live="polite" hidden>
                    <span class="success-icon">✓</span>
                    <span class="success-message">Download link sent to your email!</span>
                  </div>
                </form>
              </div>

              <!-- Tertiary CTA: Try Another Pet -->
              <button class="btn-link process-another-btn" aria-label="Process another pet image">
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
        'modern': {
          setting: section.dataset.stylePreviewModern,
          fallback: 'pet-modern-preview.jpg',
          element: '[data-style-preview="modern"]'
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

  bindEvents() {
    // File input
    const fileInput = this.container.querySelector('.file-input');
    fileInput?.addEventListener('change', (e) => this.handleFileSelect(e));
    
    // Drag and drop
    const uploadZone = this.container.querySelector('[data-upload-zone]');
    uploadZone?.addEventListener('dragover', (e) => this.handleDragOver(e));
    uploadZone?.addEventListener('drop', (e) => this.handleDrop(e));
    
    // Effect buttons
    this.container.querySelectorAll('.effect-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchEffect(e.target.closest('.effect-btn')));
    });
    
    // Action buttons
    this.container.querySelector('.add-to-product-btn')?.addEventListener('click', () => this.handleAddToProduct());
    this.container.querySelector('.process-another-btn')?.addEventListener('click', async () => await this.processAnother());
    this.container.querySelector('.try-again-btn')?.addEventListener('click', () => this.reset());

    // Inline email capture form
    const emailFormInline = this.container.querySelector('.email-form-inline');
    if (emailFormInline) {
      emailFormInline.addEventListener('submit', (e) => this.handleInlineEmailSubmit(e));
    }
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
      // Process image with API (no longer uploading original)
      const result = await this.callAPI(file);

      // Store result (no originalUrl - customer will upload on product page)
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
  
  async callAPI(file) {
    // Simple EXIF rotation fix for mobile photos
    const fixedFile = await this.fixImageRotation(file);
    
    const formData = new FormData();
    formData.append('file', fixedFile);
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
      // Cold API or first-time user: 75-85 seconds
      estimatedTime = 80000;
      initialMessage = isFirstTime ? 
        '🤖 First-time setup - loading specialized pet AI...' : 
        '🧠 Warming up AI model for premium quality...';
      timeRemaining = '80 seconds remaining';
    } else {
      // Unknown state: Conservative estimate
      estimatedTime = 45000;
      initialMessage = '📤 Processing your pet photo...';
      timeRemaining = '45 seconds remaining';
    }
    
    const startTime = Date.now();
    
    // Start single countdown timer (no restarts ever)
    this.startProgressTimer(estimatedTime);
    
    // Initial progress with appropriate expectation
    this.updateProgressWithTimer(10, initialMessage, timeRemaining);
    
    // Add return_all_effects=true to get JSON response with all effects
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
    
    // Process response - effects are nested in data.effects object
    const effects = {};
    
    // API returns: {success: true, effects: {enhancedblackwhite: "base64...", ...}}
    const effectsData = data.effects || {};
    
    // Upload all effects to GCS in parallel to avoid localStorage quota issues
    const uploadPromises = [];
    const effectNames = Object.keys(effectsData);

    for (const [effectName, base64Data] of Object.entries(effectsData)) {
      // Convert base64 to data URL
      const dataUrl = `data:image/png;base64,${base64Data}`;

      // Create upload promise (will execute in parallel)
      const uploadPromise = this.uploadToGCS(
        dataUrl,
        this.getSessionId(),
        'processed',
        effectName
      ).then(gcsUrl => ({
        effectName,
        gcsUrl,
        dataUrl
      }));

      uploadPromises.push(uploadPromise);
    }

    // Update progress: uploading effects
    this.updateProgressWithTimer(78, '📤 Uploading effects to cloud storage...', null);

    // Wait for all uploads to complete
    const uploadResults = await Promise.all(uploadPromises);

    // Process upload results
    for (const result of uploadResults) {
      effects[result.effectName] = {
        gcsUrl: result.gcsUrl || '', // Use GCS URL (CORS now fixed)
        dataUrl: result.gcsUrl ? null : result.dataUrl  // Only keep dataUrl if upload failed
      };

      if (result.gcsUrl) {
        console.log(`✅ ${result.effectName} uploaded to GCS: ${result.gcsUrl}`);
      } else {
        console.warn(`⚠️ ${result.effectName} upload failed, using dataUrl fallback`);
      }
    }

    // Generate Gemini AI effects (Modern + Classic) if enabled
    if (this.geminiEnabled && this.geminiClient) {
      try {
        // Set Gemini generation flag and reset main processing flag
        this.geminiGenerating = true;
        this.isProcessing = false;  // Main processing complete, allow UI interactions

        // Update progress for AI generation
        this.updateProgressWithTimer(85, '✨ Generating AI artistic styles...', null);

        // Get background-removed image for Gemini
        const processedImage = data.processed_image || effectsData.color || effectsData.enhancedblackwhite;

        if (processedImage) {
          // Convert to data URL if needed
          const imageDataUrl = processedImage.startsWith('data:')
            ? processedImage
            : `data:image/png;base64,${processedImage}`;

          // Batch generate both Modern and Classic styles
          const geminiResults = await this.geminiClient.batchGenerate(imageDataUrl, {
            sessionId: this.getSessionId()
          });

          // Add Gemini effects to effects object
          effects.modern = {
            gcsUrl: geminiResults.modern.url,
            dataUrl: null, // Gemini effects use Cloud Storage URLs
            cacheHit: geminiResults.modern.cacheHit,
            processingTime: geminiResults.modern.processingTime
          };

          effects.sketch = {
            gcsUrl: geminiResults.sketch.url,
            dataUrl: null, // Gemini effects use Cloud Storage URLs
            cacheHit: geminiResults.sketch.cacheHit,
            processingTime: geminiResults.sketch.processingTime
          };

          // Store quota information
          if (geminiResults.quota) {
            this.geminiQuota = geminiResults.quota;

            // Update UI with new quota state
            if (this.geminiUI) {
              this.geminiUI.updateUI();
            }
          }

          console.log('🎨 Gemini AI effects generated:', {
            modern: geminiResults.modern.cacheHit ? 'cached' : 'generated',
            sketch: geminiResults.sketch.cacheHit ? 'cached' : 'generated',
            quota: geminiResults.quota
          });

          // Update button states - Modern and Sketch should now be enabled
          this.updateEffectButtonStates();
        }

        // Reset Gemini generation flag
        this.geminiGenerating = false;
      } catch (error) {
        // Reset Gemini generation flag on error
        this.geminiGenerating = false;

        console.error('🎨 Gemini generation failed (graceful degradation):', error);

        // Graceful degradation - don't fail the whole process
        // Users still have B&W and Color effects
        if (error.quotaExhausted) {
          console.log('🎨 Gemini quota exhausted - only B&W and Color available');

          // Update UI to show quota exhausted state
          if (this.geminiUI) {
            this.geminiUI.updateUI();
          }

          // Update button states - Modern and Classic should be disabled due to quota
          this.updateEffectButtonStates();
        }
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
  
  switchEffect(button) {
    if (!button || !this.currentPet) return;

    const effect = button.dataset.effect;
    const effectData = this.currentPet.effects[effect];

    if (!effectData) {
      // Check if this is a Gemini effect that's unavailable due to quota
      if ((effect === 'modern' || effect === 'sketch') && this.geminiEnabled) {
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

    // Update image - all effects now use GCS URLs (prefer GCS, fallback to dataUrl)
    const img = this.container.querySelector('.pet-image');
    if (img) {
      const imageUrl = effectData.gcsUrl || effectData.dataUrl;
      if (imageUrl) {
        img.src = imageUrl;
      }
    }

    // Update current selection
    this.currentPet.selectedEffect = effect;
    this.selectedEffect = effect;

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
        if (btn.dataset.effect === 'modern' || btn.dataset.effect === 'sketch') {
          btn.disabled = true;
          btn.classList.add('effect-btn--disabled');
          btn.classList.remove('effect-btn--loading', 'effect-btn--ready');
          btn.title = 'Upload a photo to enable AI effects';
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

      // Handle Gemini effects (Modern and Sketch)
      if (effect === 'modern' || effect === 'sketch') {
        const effectData = this.currentPet.effects[effect];
        const effectLabel = effect === 'modern' ? 'Modern' : 'Sketch';

        // Priority 1: Effect already loaded → ENABLE for viewing
        if (effectData) {
          btn.disabled = false;
          btn.classList.remove('effect-btn--loading', 'effect-btn--disabled', 'effect-btn--ready');
          btn.title = `View ${effectLabel} effect`;
          return;
        }

        // Priority 2: Check if Gemini is disabled globally
        if (!this.geminiEnabled) {
          btn.disabled = true;
          btn.classList.add('effect-btn--disabled');
          btn.classList.remove('effect-btn--loading', 'effect-btn--ready');
          btn.title = 'AI effects not available';
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
            btn.title = 'Daily AI limit reached (resets at midnight)';
            return;
          }
        }

        // Priority 4: Check if Gemini is currently generating
        if (this.geminiGenerating) {
          btn.disabled = true;
          btn.classList.add('effect-btn--loading');
          btn.classList.remove('effect-btn--disabled', 'effect-btn--ready');
          btn.title = `Generating ${effectLabel} effect...`;
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
    });
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
        'modern': '[data-style-preview="modern"]',
        'sketch': '[data-style-preview="sketch"]'
      };

      // Update each style card with the actual processed image
      Object.entries(styleMap).forEach(([effectKey, selector]) => {
        const effectData = result.effects[effectKey];
        const imgElement = this.container.querySelector(selector);

        if (imgElement && effectData) {
          // All effects now use GCS URLs (CORS fixed)
          // Prefer GCS URL, fallback to dataUrl if upload failed
          const imageUrl = effectData.gcsUrl || effectData.dataUrl;
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
      
    } else if (estimatedTime >= 70000) {
      // Cold start processing (75-85s)
      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(15, '📦 Loading AI models into memory...', null);
        }
      }, 10000);
      
      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(30, '🔍 Analyzing your pet\'s unique features...', null);
        }
      }, 25000);
      
      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(50, '🎨 Creating professional-quality effects...', null);
        }
      }, 45000);
      
      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(75, '✨ Perfecting your pet\'s transformation...', null);
        }
      }, 65000);
      
    } else {
      // Conservative processing (unknown state: 45s)
      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(25, '🔍 Analyzing your pet\'s unique features...', null);
        }
      }, 10000);
      
      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(50, '🎨 Creating professional-quality effects...', null);
        }
      }, 22000);
      
      setTimeout(() => {
        if (!this.processingComplete) {
          this.updateProgressWithTimer(75, '✨ Perfecting your pet\'s transformation...', null);
        }
      }, 34000);
    }
  }
  
  
  cancelProcessing() {
    this.processingComplete = true;
    this.stopProgressTimer();
    this.hideAllViews();
    const uploadView = this.container.querySelector('.upload-zone');
    if (uploadView) uploadView.parentElement.hidden = false;
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

    // Upload to GCS if needed (InSPyReNet effects only - Gemini already has gcsUrl)
    console.log('📤 Uploading processed image to GCS if needed...');
    let gcsUrl = effectData.gcsUrl || '';

    // Upload processed image if not already uploaded (InSPyReNet effects)
    if (!gcsUrl && effectData.dataUrl) {
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

  /**
   * Handle Download FREE button click
   * Opens email capture modal to collect email for download links
   */

  /**
   * Validate email address
   * Returns { valid: boolean, error: string }
   */
  validateEmail(email) {
    // Basic format validation
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || email.trim() === '') {
      return { valid: false, error: 'Email address is required' };
    }
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }

    // Disposable email detection (common providers)
    var disposableDomains = [
      'tempmail.com', 'guerrillamail.com', '10minutemail.com',
      'throwaway.email', 'mailinator.com', 'trashmail.com'
    ];
    var domain = email.split('@')[1].toLowerCase();
    if (disposableDomains.indexOf(domain) !== -1) {
      return { valid: false, error: 'Please use a permanent email address' };
    }

    return { valid: true, error: '' };
  }

  /**
   * Handle inline email form submission
   */
  async handleInlineEmailSubmit(event) {
    event.preventDefault();

    var form = this.container.querySelector('.email-form-inline');
    var emailInput = this.container.querySelector('.email-input-inline');
    var submitBtn = form.querySelector('.btn-email-submit');
    var errorEl = this.container.querySelector('.email-error-inline');
    var successEl = this.container.querySelector('.email-success-inline');

    if (!emailInput || !submitBtn) {
      console.error('❌ Form elements not found');
      return;
    }

    var email = emailInput.value.trim();

    // Validate email
    var validation = this.validateEmail(email);
    if (!validation.valid) {
      emailInput.classList.add('error');
      if (errorEl) {
        errorEl.textContent = validation.error;
        errorEl.hidden = false;
      }
      emailInput.focus();
      return;
    }

    // Check if we have processed images to download
    if (!this.currentPet || !this.currentPet.effects) {
      emailInput.classList.add('error');
      if (errorEl) {
        errorEl.textContent = 'No processed images available to download';
        errorEl.hidden = false;
      }
      return;
    }

    // Clear errors
    emailInput.classList.remove('error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');

    console.log('📧 Capturing email via Shopify:', email);

    // Get selected effect
    var selectedEffect = this.currentPet.selectedEffect || 'enhancedblackwhite';
    var effectData = this.currentPet.effects[selectedEffect];

    // Check if selected effect is ready
    if (!effectData || (!effectData.gcsUrl && !effectData.dataUrl)) {
      console.error('❌ Selected effect not ready:', selectedEffect);
      emailInput.classList.add('error');
      if (errorEl) {
        errorEl.textContent = 'The selected image is not ready yet. Please wait for processing to complete.';
        errorEl.hidden = false;
      }
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
      return;
    }

    try {
      // Step 1: Submit to Shopify native form to capture email
      var shopifyForm = document.getElementById('pet-email-capture-form');
      if (!shopifyForm) {
        throw new Error('Shopify email form not found');
      }

      // Populate hidden Shopify form with email and metadata
      var shopifyEmailInput = document.getElementById('pet-email-input');
      var shopifyNameInput = document.getElementById('pet-customer-name');
      var shopifyTagsInput = document.getElementById('pet-email-tags');

      shopifyEmailInput.value = email;
      shopifyNameInput.value = email.split('@')[0];

      // Build tags: pet-processor, style name, download date
      var today = new Date().toISOString().split('T')[0];
      var tags = 'pet-processor,' + selectedEffect + ',downloaded-' + today;
      shopifyTagsInput.value = tags;

      // Submit form via AJAX to avoid page reload
      var formData = new FormData(shopifyForm);
      var shopifyResponse = await fetch(shopifyForm.action, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      // Shopify form submission may return various responses - we consider any non-error as success
      console.log('✅ Email submitted to Shopify customer database with tags:', tags);

      // Step 2: Download image directly using blob URL method
      var imageUrl = effectData.dataUrl || effectData.gcsUrl;
      var imageBlob = null;

      if (imageUrl.startsWith('data:')) {
        // Convert data URL to blob
        var parts = imageUrl.split(',');
        var mimeMatch = parts[0].match(/:(.*?);/);
        var mime = mimeMatch ? mimeMatch[1] : 'image/png';
        var bstr = atob(parts[1]);
        var n = bstr.length;
        var u8arr = new Uint8Array(n);
        for (var i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }
        imageBlob = new Blob([u8arr], {type: mime});
      } else {
        // Fetch GCS URL and convert to blob
        var imageResponse = await fetch(imageUrl);
        imageBlob = await imageResponse.blob();
      }

      // Create blob URL and trigger download
      var blobUrl = URL.createObjectURL(imageBlob);
      var downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;

      // Generate filename: perkie-pet-{effect}-{timestamp}.png
      var timestamp = new Date().getTime();
      var filename = 'perkie-pet-' + selectedEffect + '-' + timestamp + '.png';
      downloadLink.download = filename;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up blob URL after a short delay
      setTimeout(function() {
        URL.revokeObjectURL(blobUrl);
      }, 100);

      console.log('✅ Image downloaded:', filename);

      // Step 3: Save email to localStorage (backup)
      try {
        var emailData = {
          email: email,
          timestamp: new Date().toISOString(),
          sessionId: this.currentPet ? this.currentPet.sessionId : null,
          selectedEffect: selectedEffect
        };
        localStorage.setItem('perkie_email_capture', JSON.stringify(emailData));
      } catch (error) {
        console.error('❌ Failed to save email data to localStorage:', error);
      }

      // Step 4: Show success state
      if (successEl) {
        var successMsg = successEl.querySelector('.success-message');
        if (successMsg) {
          successMsg.textContent = 'Image downloaded! Check your downloads folder.';
        }
        successEl.hidden = false;
      }

      // Reset form
      form.reset();

      // Hide success message after 5 seconds
      setTimeout(function() {
        if (successEl) successEl.hidden = true;
      }, 5000);

    } catch (error) {
      console.error('❌ Email capture or download failed:', error);
      emailInput.classList.add('error');
      if (errorEl) {
        var errorMsg = error.message || 'Failed to process your request. Please try again.';
        errorEl.textContent = errorMsg;
        errorEl.hidden = false;
      }
    } finally {
      // Reset button state
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
  }

  /**
   * Handle Add to Product button click
   * Saves pet data and redirects to products
   * Phase 4: Will add session bridge for seamless transition
   */
  async handleAddToProduct() {
    console.log('🛍️ Add to Product button clicked');

    // Save pet data first
    const saved = await this.savePetData();
    if (!saved) {
      console.error('❌ Failed to save pet data');
      return;
    }

    const btn = this.container.querySelector('.add-to-product-btn');
    if (btn) {
      btn.disabled = true;

      // Smart redirect based on selected effect/style
      let redirectUrl = '/collections/personalized-pet-products-gifts'; // Default fallback

      try {
        // Get current effect for smart routing
        const currentEffect = this.currentPet?.selectedEffect || null;

        // Smart routing: Return to product page if user came from one
        const referrer = document.referrer;
        if (referrer && referrer.includes('/products/')) {
          redirectUrl = referrer;
          console.log(`✅ Smart routing: Returning to product page: ${redirectUrl}`);
        } else {
          // Fallback: Main collection
          redirectUrl = '/collections/personalized-pet-products-gifts?utm_source=processor&utm_medium=cta';
          console.log(`ℹ️ Fallback routing: Using main collection: ${redirectUrl}`);
        }

        // Phase 4: Create session bridge before redirect
        // Only pass GCS URLs (not dataUrls) to avoid localStorage quota issues
        const effectsForBridge = {};
        for (const [effectName, effectData] of Object.entries(this.currentPet.effects)) {
          if (effectData.gcsUrl) {
            // Only include GCS URL (not dataUrl)
            effectsForBridge[effectName] = {
              gcsUrl: effectData.gcsUrl
            };
          } else if (effectData.dataUrl) {
            console.warn(`⚠️ ${effectName} missing GCS URL, will use dataUrl as fallback`);
            // Fallback: include dataUrl only if no GCS URL available
            effectsForBridge[effectName] = {
              dataUrl: effectData.dataUrl
            };
          }
        }

        const bridgeData = {
          sessionKey: this.currentPet.id,
          artistNote: '', // Collected on product page
          effects: effectsForBridge,
          selectedEffect: this.currentPet.selectedEffect || 'enhancedblackwhite',
          timestamp: Date.now(),
          redirectUrl: redirectUrl
        };

        // Validate bridge size (should be ~400 bytes with GCS URLs, not 2.7MB with dataUrls)
        const bridgeSize = JSON.stringify(bridgeData).length;
        console.log(`📊 Bridge data size: ${(bridgeSize / 1024).toFixed(1)}KB`);
        if (bridgeSize > 100000) { // 100KB threshold
          console.error(`❌ Bridge data too large (${(bridgeSize / 1024).toFixed(1)}KB)! May cause quota issues.`);
        }

        // Save to sessionStorage (cleared after page load)
        sessionStorage.setItem('processor_to_product_bridge', JSON.stringify(bridgeData));
        console.log('🌉 Bridge data saved for product page redirect:', bridgeData);

        // Verify sessionStorage was written
        const verifyBridge = sessionStorage.getItem('processor_to_product_bridge');
        if (verifyBridge) {
          console.log('✅ Bridge verification: sessionStorage contains bridge data');
          console.log('📦 Bridge contents:', JSON.parse(verifyBridge));
        } else {
          console.error('❌ Bridge verification FAILED: sessionStorage is empty after save!');
        }

        // Also save to localStorage as fallback (persist across sessions)
        try {
          localStorage.setItem('processor_to_product_bridge_backup', JSON.stringify({
            ...bridgeData,
            expiresAt: Date.now() + (5 * 60 * 1000) // 5 minute expiry
          }));
          console.log('💾 Bridge backup saved to localStorage (5 min expiry)');
        } catch (e) {
          console.warn('⚠️ Failed to save localStorage backup:', e);
        }

      } catch (error) {
        console.warn('⚠️ Error in smart routing, using fallback:', error);
      }

      // Update button text
      btn.innerHTML = '<span class="btn-text">✓ Taking you to products...</span>';

      // Redirect after brief success message
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 800); // Shorter delay (800ms vs 1500ms)
    }
  }


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
   * Upload selected effect's images to GCS
   * Called from buy-buttons.liquid during cart integration
   * @param {string} sessionKey - Pet session identifier
   * @param {string} effect - Effect name
   * @param {Function} callback - Called with {processed: url} or null
   */
  async syncSelectedToCloud(sessionKey, effect, callback) {
    try {
      console.log(`📤 Syncing to cloud: ${sessionKey}, effect: ${effect}`);

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