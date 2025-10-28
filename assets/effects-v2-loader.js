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
      uploadButton.addEventListener('click', () => {
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
        if (e.target === dropzone || e.target.closest('.upload-dropzone')) {
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

    // Show processing view
    showProcessing(container, sectionId);

    // TODO: Implement actual processing with Effects V2
    // This is a placeholder - will be completed in Phase 4
    updateProcessingMessage(container, sectionId, 'Processing your pet photo...', 0);

    setTimeout(() => {
      updateProcessingMessage(container, sectionId, 'Removing background...', 50);
    }, 1000);

    setTimeout(() => {
      updateProcessingMessage(container, sectionId, 'Applying effects...', 75);
    }, 2000);

    setTimeout(() => {
      // Placeholder: Show result
      showResult(container, sectionId, file);
    }, 3000);
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
   * Show result view (placeholder)
   * @param {HTMLElement} container - Container element
   * @param {string} sectionId - Section ID
   * @param {File} file - Original file
   */
  function showResult(container, sectionId, file) {
    container.querySelector('.effects-upload-area').hidden = true;
    container.querySelector(`#processing-${sectionId}`).hidden = true;
    container.querySelector(`#result-${sectionId}`).hidden = false;

    // Placeholder: Show uploaded image
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = container.querySelector(`#result-image-${sectionId}`);
      if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Handle share action
   * @param {HTMLElement} container - Container element
   * @param {string} sectionId - Section ID
   */
  function handleShare(container, sectionId) {
    const { sharingManager } = window.EffectsV2;
    const img = container.querySelector(`#result-image-${sectionId}`);

    if (sharingManager && img) {
      sharingManager.share(img, {
        title: 'Check out my pet!',
        text: 'Created with PerkiePrints.com'
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
