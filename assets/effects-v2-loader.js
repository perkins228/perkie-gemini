/**
 * Effects V2 Loader
 * Initializes the Effects V2 processor on Shopify pages
 *
 * Dependencies: effects-v2-bundle.js (must be loaded first)
 *
 * This script:
 * 1. Waits for DOM ready
 * 2. Finds Effects Processor sections
 * 3. Initializes EffectProcessor instances
 * 4. Configures API URLs from section data attributes
 * 5. Renders UI
 */

(function() {
  'use strict';

  /**
   * Initialize Effects V2 when DOM is ready
   */
  function initEffectsV2() {
    console.log('🎨 Effects V2 Loader: Initializing...');

    // Verify bundle is loaded
    if (typeof window.EffectsV2 === 'undefined') {
      console.error('❌ Effects V2 bundle not loaded! Make sure effects-v2-bundle.js loads before this script.');
      return;
    }

    // Find all Effects Processor sections
    const sections = document.querySelectorAll('[data-section-type="ks-effects-processor-v2"]');

    if (sections.length === 0) {
      console.log('ℹ️ No Effects Processor V2 sections found on this page');
      return;
    }

    console.log(`📦 Found ${sections.length} Effects Processor V2 section(s)`);

    // Initialize each section
    sections.forEach((section, index) => {
      try {
        initSection(section, index);
      } catch (error) {
        console.error(`❌ Failed to initialize section ${index}:`, error);
      }
    });
  }

  /**
   * Initialize a single Effects Processor section
   * @param {HTMLElement} section - Section element
   * @param {number} index - Section index
   */
  function initSection(section, index) {
    const sectionId = section.dataset.sectionId || `section-${index}`;
    const contentDiv = section.querySelector(`#effects-processor-content-${sectionId}`);

    if (!contentDiv) {
      console.error(`❌ Content container not found for section: ${sectionId}`);
      return;
    }

    // Get API URLs from data attributes
    const apiUrl = contentDiv.dataset.apiUrl;
    const geminiUrl = contentDiv.dataset.geminiUrl;

    console.log(`🔧 Initializing section ${sectionId}:`, { apiUrl, geminiUrl });

    // Create processor instance
    const { EffectProcessor, storageManager } = window.EffectsV2;

    // Configure storage manager API URL
    if (storageManager && apiUrl) {
      storageManager.setApiUrl(apiUrl);
    }

    // Create and configure processor
    const processor = new EffectProcessor();

    // Store processor instance for debugging
    if (!window.effectsProcessors) {
      window.effectsProcessors = {};
    }
    window.effectsProcessors[sectionId] = processor;

    // Render UI
    renderUI(contentDiv, processor, sectionId, { apiUrl, geminiUrl });

    console.log(`✅ Section ${sectionId} initialized successfully`);
  }

  /**
   * Render the Effects V2 UI
   * @param {HTMLElement} container - Container element
   * @param {Object} processor - EffectProcessor instance
   * @param {string} sectionId - Section ID
   * @param {Object} config - Configuration object
   */
  function renderUI(container, processor, sectionId, config) {
    // Clear loading state
    container.innerHTML = '';

    // Create UI structure
    const ui = document.createElement('div');
    ui.className = 'effects-v2-ui';
    ui.innerHTML = `
      <div class="effects-upload-area">
        <div class="upload-dropzone" id="upload-dropzone-${sectionId}">
          <div class="upload-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <h3>Upload Your Pet Photo</h3>
          <p>Drag & drop or click to select an image</p>
          <input type="file" id="file-input-${sectionId}" accept="image/*" hidden>
          <button class="upload-button" id="upload-button-${sectionId}">
            Choose File
          </button>
        </div>
      </div>

      <div class="effects-processing" id="processing-${sectionId}" hidden>
        <div class="processing-spinner"></div>
        <p class="processing-message">Processing your image...</p>
        <div class="processing-progress">
          <div class="progress-bar" id="progress-bar-${sectionId}"></div>
        </div>
        <p class="processing-detail" id="processing-detail-${sectionId}"></p>
      </div>

      <div class="effects-result" id="result-${sectionId}" hidden>
        <div class="result-image-container">
          <img id="result-image-${sectionId}" alt="Processed pet image">
        </div>

        <div class="effects-selector">
          <h4>Choose Your Style</h4>
          <div class="effect-buttons" id="effect-buttons-${sectionId}">
            <button class="effect-btn active" data-effect="color">
              <span class="effect-icon">🎨</span>
              <span class="effect-name">Original</span>
            </button>
            <button class="effect-btn" data-effect="blackwhite">
              <span class="effect-icon">⚫</span>
              <span class="effect-name">B&W</span>
            </button>
            <button class="effect-btn" data-effect="modern">
              <span class="effect-icon">🖌️</span>
              <span class="effect-name">Modern</span>
            </button>
            <button class="effect-btn" data-effect="classic">
              <span class="effect-icon">🎭</span>
              <span class="effect-name">Classic</span>
            </button>
          </div>
        </div>

        <div class="artist-notes-section">
          <label for="artist-note-${sectionId}">
            <strong>Artist Notes</strong> (Optional)
            <span style="color: rgba(var(--color-foreground), 0.6); font-size: 0.875rem;">
              Add custom instructions for your print
            </span>
          </label>
          <textarea
            id="artist-note-${sectionId}"
            class="artist-note-input"
            placeholder="e.g., Make the background lighter, adjust colors to match my living room..."
            maxlength="500"
            rows="3"
          ></textarea>
          <div class="character-count" id="char-count-${sectionId}">0/500</div>
        </div>

        <div class="effects-actions">
          <button class="action-btn share-btn" id="share-btn-${sectionId}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"></path>
              <polyline points="16 6 12 2 8 6"></polyline>
              <line x1="12" y1="2" x2="12" y2="15"></line>
            </svg>
            Share
          </button>
          <button class="action-btn reset-btn" id="reset-btn-${sectionId}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10"></path>
            </svg>
            Start Over
          </button>
        </div>
      </div>
    `;

    container.appendChild(ui);

    // Attach event listeners
    attachEventListeners(container, processor, sectionId, config);
  }

  /**
   * Attach event listeners to UI elements
   * @param {HTMLElement} container - Container element
   * @param {Object} processor - EffectProcessor instance
   * @param {string} sectionId - Section ID
   * @param {Object} config - Configuration object
   */
  function attachEventListeners(container, processor, sectionId, config) {
    const fileInput = container.querySelector(`#file-input-${sectionId}`);
    const uploadButton = container.querySelector(`#upload-button-${sectionId}`);
    const dropzone = container.querySelector(`#upload-dropzone-${sectionId}`);
    const shareBtn = container.querySelector(`#share-btn-${sectionId}`);
    const resetBtn = container.querySelector(`#reset-btn-${sectionId}`);

    // Upload button click
    if (uploadButton) {
      uploadButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent dropzone from also triggering
        fileInput.click();
      });
    }

    // File input change
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileUpload(e.target.files[0], container, processor, sectionId, config);
        }
      });
    }

    // Dropzone click
    if (dropzone) {
      dropzone.addEventListener('click', (e) => {
        // Only trigger if clicking dropzone directly, not on button or other elements
        if (e.target === dropzone || (e.target.closest('.upload-dropzone') && !e.target.closest('.upload-button'))) {
          fileInput.click();
        }
      });

      // Drag and drop
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFileUpload(e.dataTransfer.files[0], container, processor, sectionId, config);
        }
      });
    }

    // Share button
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        handleShare(container, sectionId);
      });
    }

    // Reset button
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        handleReset(container, sectionId);
      });
    }

    // Artist note textarea (attach after result is shown)
    const artistNoteTextarea = container.querySelector(`#artist-note-${sectionId}`);
    const charCount = container.querySelector(`#char-count-${sectionId}`);

    if (artistNoteTextarea) {
      artistNoteTextarea.addEventListener('input', (e) => {
        const length = e.target.value.length;
        if (charCount) {
          charCount.textContent = `${length}/500`;
        }

        // Save to localStorage
        const sessionKey = container.dataset.sessionKey;
        const { storageManager } = window.EffectsV2;

        if (storageManager && sessionKey) {
          const petData = storageManager.get(sessionKey);
          if (petData) {
            petData.artistNote = e.target.value;
            storageManager.save(sessionKey, petData);
            console.log('💾 Artist note saved');
          }
        }
      });
    }
  }

  /**
   * Handle file upload
   * @param {File} file - Selected file
   * @param {HTMLElement} container - Container element
   * @param {Object} processor - EffectProcessor instance
   * @param {string} sectionId - Section ID
   * @param {Object} config - Configuration object
   */
  async function handleFileUpload(file, container, processor, sectionId, config) {
    console.log('📤 File selected:', file.name, file.type, file.size);

    // Validate file
    if (!file.type.startsWith('image/')) {
      showError(container, sectionId, 'Please select an image file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      showError(container, sectionId, 'Image too large. Maximum size is 50MB');
      return;
    }

    // Show processing view
    showProcessing(container, sectionId);

    try {
      // Step 1: Call InSPyReNet API for background removal + color/B&W effects
      updateProcessingMessage(container, sectionId, 'Uploading image...', 5);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('effects', 'color,blackwhite');
      formData.append('session_id', `perkie_${Date.now()}`);

      updateProcessingMessage(container, sectionId, 'Removing background...', 15);

      const apiResponse = await fetch(`${config.apiUrl}/api/v2/process-with-effects?return_all_effects=true`, {
        method: 'POST',
        body: formData
      });

      if (!apiResponse.ok) {
        throw new Error(`API error: ${apiResponse.status}`);
      }

      updateProcessingMessage(container, sectionId, 'Processing effects...', 50);

      const data = await apiResponse.json();

      // Step 2: Convert InSPyReNet effects from base64 to URLs
      const effects = {};

      if (data.effects) {
        for (const [effectName, base64Data] of Object.entries(data.effects)) {
          const dataUrl = `data:image/png;base64,${base64Data}`;
          effects[effectName] = dataUrl;
        }
      }

      // Step 2.5: Normalize effect names (API returns 'enhancedblackwhite', UI expects 'blackwhite')
      if (effects.enhancedblackwhite && !effects.blackwhite) {
        effects.blackwhite = effects.enhancedblackwhite;
        delete effects.enhancedblackwhite;
      }

      updateProcessingMessage(container, sectionId, 'Preparing Modern & Classic styles...', 75);

      // Step 3: Initialize Modern/Classic as placeholders (generated on-demand)
      effects.modern = null;
      effects.classic = null;

      // Step 4: Generate session ID for storage
      const sessionKey = `pet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Step 5: Upload ALL effects to GCS in parallel
      const { storageManager } = window.EffectsV2;
      const gcsUrls = {
        color: null,
        blackwhite: null,
        modern: null,
        classic: null
      };

      if (storageManager) {
        try {
          // Upload Color and B&W in parallel
          updateProcessingMessage(container, sectionId, 'Uploading to cloud... (1/2)', 75);

          const uploadPromises = [];
          if (effects.color) {
            uploadPromises.push(
              uploadToStorage(effects.color, sessionKey, 'color', config.apiUrl)
                .then(url => { gcsUrls.color = url; })
            );
          }
          if (effects.blackwhite) {
            uploadPromises.push(
              uploadToStorage(effects.blackwhite, sessionKey, 'blackwhite', config.apiUrl)
                .then(url => { gcsUrls.blackwhite = url; })
            );
          }

          await Promise.all(uploadPromises);
          updateProcessingMessage(container, sectionId, 'Uploading to cloud... (2/2)', 90);
          console.log('✅ GCS URLs obtained:', gcsUrls);

        } catch (err) {
          console.warn('⚠️ Some GCS uploads failed, continuing with partial URLs:', err);
        }
      }

      // Step 6: Save to localStorage with all GCS URLs
      updateProcessingMessage(container, sectionId, 'Saving...', 95);
      if (storageManager) {
        await storageManager.save(sessionKey, {
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for pet name
          currentEffect: 'color', // Default selection
          gcsUrls: gcsUrls, // All effect URLs (color, blackwhite, modern: null, classic: null)
          artistNote: '', // Empty initially, user can add via UI
          timestamp: Date.now()
        });
      }

      updateProcessingMessage(container, sectionId, 'Ready!', 100);

      // Step 7: Show result with effects
      setTimeout(() => {
        showResult(container, sectionId, {
          sessionKey,
          effects,
          currentEffect: 'color'
        });
      }, 300);

    } catch (error) {
      console.error('❌ Processing failed:', error);
      showError(container, sectionId, error.message || 'Processing failed. Please try again.');
    }
  }

  /**
   * Upload image to GCS storage
   * @param {string} dataUrl - Image data URL
   * @param {string} sessionKey - Session key
   * @param {string} effectName - Effect name (color, blackwhite, modern, classic)
   * @param {string} apiUrl - API base URL
   * @returns {Promise<string|null>} GCS URL or null
   */
  async function uploadToStorage(dataUrl, sessionKey, effectName, apiUrl) {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      const formData = new FormData();
      const filename = `${sessionKey}_${effectName}.jpg`;
      formData.append('file', blob, filename);
      formData.append('session_key', sessionKey);
      formData.append('effect_name', effectName);

      const uploadResponse = await fetch(`${apiUrl}/store-image`, {
        method: 'POST',
        body: formData
      });

      if (uploadResponse.ok) {
        const result = await uploadResponse.json();
        console.log('✅ Uploaded to GCS:', result.url);
        return result.url;
      }
    } catch (error) {
      console.warn('GCS upload error:', error);
    }
    return null;
  }

  /**
   * Show processing view
   * @param {HTMLElement} container - Container element
   * @param {string} sectionId - Section ID
   */
  function showProcessing(container, sectionId) {
    container.querySelector('.effects-upload-area').hidden = true;
    container.querySelector(`#processing-${sectionId}`).hidden = false;
    container.querySelector(`#result-${sectionId}`).hidden = true;
  }

  /**
   * Update processing message
   * @param {HTMLElement} container - Container element
   * @param {string} sectionId - Section ID
   * @param {string} message - Message text
   * @param {number} progress - Progress percentage (0-100)
   */
  function updateProcessingMessage(container, sectionId, message, progress) {
    const detailEl = container.querySelector(`#processing-detail-${sectionId}`);
    const progressBar = container.querySelector(`#progress-bar-${sectionId}`);

    if (detailEl) detailEl.textContent = message;
    if (progressBar) progressBar.style.width = `${progress}%`;
  }

  /**
   * Show result view with effects
   * @param {HTMLElement} container - Container element
   * @param {string} sectionId - Section ID
   * @param {Object} data - Result data {sessionKey, effects, currentEffect}
   */
  function showResult(container, sectionId, data) {
    container.querySelector('.effects-upload-area').hidden = true;
    container.querySelector(`#processing-${sectionId}`).hidden = true;
    container.querySelector(`#result-${sectionId}`).hidden = false;

    // Store data on container for effect switching
    container.dataset.sessionKey = data.sessionKey;
    container.dataset.currentEffect = data.currentEffect;
    container.dataset.effects = JSON.stringify(data.effects);

    // Display initial effect (color)
    const img = container.querySelector(`#result-image-${sectionId}`);
    if (img && data.effects[data.currentEffect]) {
      img.src = data.effects[data.currentEffect];
    }

    // Attach effect button listeners
    const effectButtons = container.querySelectorAll(`#effect-buttons-${sectionId} .effect-btn`);
    effectButtons.forEach(button => {
      // Remove existing listeners
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);

      newButton.addEventListener('click', () => {
        handleEffectSwitch(container, sectionId, newButton.dataset.effect);
      });

      // Set initial active state
      if (newButton.dataset.effect === data.currentEffect) {
        newButton.classList.add('active');
      } else {
        newButton.classList.remove('active');
      }
    });
  }

  /**
   * Handle effect switching
   * @param {HTMLElement} container - Container element
   * @param {string} sectionId - Section ID
   * @param {string} effectName - Effect to switch to
   */
  async function handleEffectSwitch(container, sectionId, effectName) {
    const effects = JSON.parse(container.dataset.effects || '{}');
    const currentEffect = container.dataset.currentEffect;

    if (effectName === currentEffect) return; // Already selected

    console.log(`🔄 Switching effect: ${currentEffect} → ${effectName}`);

    // Check if effect needs to be generated (Modern/Classic via Gemini)
    if (!effects[effectName] && (effectName === 'modern' || effectName === 'classic')) {
      await generateGeminiEffect(container, sectionId, effectName, effects);
      return;
    }

    // Switch to existing effect
    if (effects[effectName]) {
      const img = container.querySelector(`#result-image-${sectionId}`);
      if (img) {
        img.src = effects[effectName];
        container.dataset.currentEffect = effectName;

        // Update button states
        const buttons = container.querySelectorAll(`#effect-buttons-${sectionId} .effect-btn`);
        buttons.forEach(btn => {
          if (btn.dataset.effect === effectName) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });

        console.log(`✅ Switched to ${effectName}`);
      }
    }
  }

  /**
   * Generate Gemini effect on-demand
   * @param {HTMLElement} container - Container element
   * @param {string} sectionId - Section ID
   * @param {string} effectName - 'modern' or 'classic'
   * @param {Object} effects - Effects object
   */
  async function generateGeminiEffect(container, sectionId, effectName, effects) {
    try {
      // Show processing state
      const button = container.querySelector(`#effect-buttons-${sectionId} .effect-btn[data-effect="${effectName}"]`);
      if (button) {
        button.disabled = true;
        button.innerHTML = `<span class="effect-icon">⏳</span><span class="effect-name">Loading...</span>`;
      }

      // Get color effect as input (background already removed)
      const colorEffect = effects.color || effects.blackwhite;
      if (!colorEffect) {
        throw new Error('No base image available');
      }

      // Convert data URL to blob
      const response = await fetch(colorEffect);
      const blob = await response.blob();

      // Call Gemini API
      const { geminiClient } = window.EffectsV2;
      const styledBlob = await geminiClient.applyStyle(blob, effectName);

      // Convert to data URL for display and storage
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(styledBlob);
      });

      // Update effects object
      effects[effectName] = dataUrl;
      container.dataset.effects = JSON.stringify(effects);

      // Upload to GCS
      const sessionKey = container.dataset.sessionKey;
      const config = JSON.parse(container.closest('[data-api-url]').dataset.apiUrl || '{}');
      let gcsUrl = null;

      const { storageManager } = window.EffectsV2;
      if (storageManager && sessionKey) {
        try {
          gcsUrl = await uploadToStorage(dataUrl, sessionKey, effectName, config.apiUrl);
          console.log(`✅ ${effectName} uploaded to GCS:`, gcsUrl);

          // Update localStorage with new GCS URL
          const petData = storageManager.get(sessionKey);
          if (petData) {
            petData.gcsUrls[effectName] = gcsUrl;
            await storageManager.save(sessionKey, petData);
            console.log(`✅ Updated localStorage with ${effectName} URL`);
          }
        } catch (uploadErr) {
          console.warn(`⚠️ Failed to upload ${effectName} to GCS:`, uploadErr);
        }
      }

      // Switch to the new effect
      const img = container.querySelector(`#result-image-${sectionId}`);
      if (img) {
        img.src = dataUrl;
        container.dataset.currentEffect = effectName;
      }

      // Restore button
      if (button) {
        const icon = effectName === 'modern' ? '🖌️' : '🎭';
        const name = effectName === 'modern' ? 'Modern' : 'Classic';
        button.disabled = false;
        button.innerHTML = `<span class="effect-icon">${icon}</span><span class="effect-name">${name}</span>`;
        button.classList.add('active');
      }

      // Update other button states
      const buttons = container.querySelectorAll(`#effect-buttons-${sectionId} .effect-btn`);
      buttons.forEach(btn => {
        if (btn.dataset.effect !== effectName) {
          btn.classList.remove('active');
        }
      });

      console.log(`✅ Generated ${effectName} effect`);

    } catch (error) {
      console.error(`❌ Failed to generate ${effectName}:`, error);

      // Restore button
      const button = container.querySelector(`#effect-buttons-${sectionId} .effect-btn[data-effect="${effectName}"]`);
      if (button) {
        const icon = effectName === 'modern' ? '🖌️' : '🎭';
        const name = effectName === 'modern' ? 'Modern' : 'Classic';
        button.disabled = false;
        button.innerHTML = `<span class="effect-icon">${icon}</span><span class="effect-name">${name}</span>`;
      }

      // Show error
      showToast(container, error.message || `Failed to generate ${effectName} effect. Please try again.`);
    }
  }

  /**
   * Show error message
   * @param {HTMLElement} container - Container element
   * @param {string} sectionId - Section ID
   * @param {string} message - Error message
   */
  function showError(container, sectionId, message) {
    container.querySelector('.effects-upload-area').hidden = false;
    container.querySelector(`#processing-${sectionId}`).hidden = true;
    container.querySelector(`#result-${sectionId}`).hidden = true;

    showToast(container, message);
  }

  /**
   * Show toast notification
   * @param {HTMLElement} container - Container element
   * @param {string} message - Message text
   */
  function showToast(container, message) {
    const toast = document.createElement('div');
    toast.className = 'effects-toast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
                          'background:rgba(0,0,0,0.8);color:white;padding:12px 24px;' +
                          'border-radius:4px;z-index:9999;font-size:14px;max-width:90%;text-align:center;';

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 4000);
  }

  /**
   * Handle share action
   * @param {HTMLElement} container - Container element
   * @param {string} sectionId - Section ID
   */
  function handleShare(container, sectionId) {
    const { sharingManager } = window.EffectsV2;
    const img = container.querySelector(`#result-image-${sectionId}`);
    const currentEffect = container.dataset.currentEffect || 'color';

    if (sharingManager && img && img.src) {
      sharingManager.share(img.src, {
        title: 'Check out my pet!',
        text: `Created with PerkiePrints.com - ${currentEffect} style`
      }).catch(err => {
        console.error('Share failed:', err);
        showToast(container, 'Sharing failed. Please try again.');
      });
    }
  }

  /**
   * Handle reset action
   * @param {HTMLElement} container - Container element
   * @param {string} sectionId - Section ID
   */
  function handleReset(container, sectionId) {
    container.querySelector('.effects-upload-area').hidden = false;
    container.querySelector(`#processing-${sectionId}`).hidden = true;
    container.querySelector(`#result-${sectionId}`).hidden = true;

    // Reset file input
    const fileInput = container.querySelector(`#file-input-${sectionId}`);
    if (fileInput) fileInput.value = '';
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEffectsV2);
  } else {
    initEffectsV2();
  }

  console.log('✅ Effects V2 Loader script loaded');
})();
