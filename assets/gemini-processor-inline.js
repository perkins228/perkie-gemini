/**
 * GeminiProcessorInline - Embedded Gemini pet processor for product pages
 *
 * Provides a single-prompt AI portrait generation directly on product pages.
 * Customer uploads pet photo → auto-processes with configured Gemini prompt → result shown inline.
 * All pet data saved to order via hidden form fields.
 *
 * Dependencies: gemini-api-client.js (GeminiAPIClient), pet-storage.js (PetStorage)
 */

(function() {
  'use strict';

  var MAX_FILE_SIZE_MB = 15;
  var ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  var PROGRESS_MESSAGES = [
    'Creating your portrait...',
    'AI is working its magic...',
    'Almost there...',
    'Adding finishing touches...',
    'Perfecting the details...'
  ];

  function GeminiProcessorInline(container) {
    this.container = container;
    this.geminiClient = null;
    this.state = 'idle'; // idle | uploading | processing | result | error
    this.originalFile = null;
    this.originalDataUrl = null;
    this.processedUrl = null;
    this.originalGcsUrl = null;
    this.sessionKey = null;
    this.progressTimer = null;
    this.progressPercent = 0;
    this.messageIndex = 0;
    this.abortController = null;

    this.config = {
      productId: container.dataset.productId,
      productHandle: container.dataset.productHandle,
      productFormId: container.dataset.productFormId,
      geminiStyle: container.dataset.geminiStyle || 'ink_wash',
      customPrompt: container.dataset.customPrompt || '',
      styleDisplayName: container.dataset.styleDisplayName || 'Portrait',
      showPetName: container.dataset.showPetName === 'true',
      showArtistNotes: container.dataset.showArtistNotes === 'true',
      sectionId: container.dataset.sectionId
    };

    this.init();
  }

  GeminiProcessorInline.prototype.init = function() {
    this.cacheElements();
    this.setupEventListeners();
    this.initGeminiClient();
    this.restoreSession();
  };

  GeminiProcessorInline.prototype.cacheElements = function() {
    var c = this.container;
    this.els = {
      uploadZone: c.querySelector('[data-gemini-upload-zone]'),
      fileInput: c.querySelector('[data-gemini-file-input]'),
      processing: c.querySelector('[data-gemini-processing]'),
      progressFill: c.querySelector('[data-gemini-progress-fill]'),
      progressText: c.querySelector('[data-gemini-progress-text]'),
      cancelBtn: c.querySelector('[data-gemini-cancel]'),
      result: c.querySelector('[data-gemini-result]'),
      resultImage: c.querySelector('[data-gemini-result-image]'),
      retryBtn: c.querySelector('[data-gemini-retry]'),
      error: c.querySelector('[data-gemini-error]'),
      errorMessage: c.querySelector('[data-gemini-error-message]'),
      errorRetryBtn: c.querySelector('[data-gemini-error-retry]'),
      petNameInput: c.querySelector('[data-gemini-pet-name]'),
      artistNotes: c.querySelector('[data-gemini-artist-notes]'),
      notesSection: c.querySelector('[data-gemini-notes-section]'),
      // Hidden form fields
      formPetName: c.querySelector('[data-gemini-form-pet-name]'),
      formStyle: c.querySelector('[data-gemini-form-style]'),
      formProcessedUrl: c.querySelector('[data-gemini-form-processed-url]'),
      formOriginalUrl: c.querySelector('[data-gemini-form-original-url]'),
      formSessionKey: c.querySelector('[data-gemini-form-session-key]'),
      formSelectedEffect: c.querySelector('[data-gemini-form-selected-effect]'),
      formArtistNotes: c.querySelector('[data-gemini-form-artist-notes]')
    };
  };

  GeminiProcessorInline.prototype.setupEventListeners = function() {
    var self = this;

    // Upload zone click → trigger file input
    if (this.els.uploadZone) {
      this.els.uploadZone.addEventListener('click', function() {
        if (self.els.fileInput) self.els.fileInput.click();
      });

      // Drag and drop
      this.els.uploadZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('drag-over');
      });

      this.els.uploadZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
      });

      this.els.uploadZone.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          self.handleFileSelect(e.dataTransfer.files[0]);
        }
      });
    }

    // File input change
    if (this.els.fileInput) {
      this.els.fileInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
          self.handleFileSelect(e.target.files[0]);
        }
      });
    }

    // Cancel button
    if (this.els.cancelBtn) {
      this.els.cancelBtn.addEventListener('click', function() {
        self.cancelProcessing();
      });
    }

    // Retry buttons
    if (this.els.retryBtn) {
      this.els.retryBtn.addEventListener('click', function() {
        self.reset();
      });
    }

    if (this.els.errorRetryBtn) {
      this.els.errorRetryBtn.addEventListener('click', function() {
        self.reset();
      });
    }
  };

  GeminiProcessorInline.prototype.initGeminiClient = function() {
    if (typeof GeminiAPIClient === 'undefined') {
      console.warn('GeminiProcessorInline: GeminiAPIClient not loaded');
      return;
    }

    this.geminiClient = new GeminiAPIClient();

    if (!this.geminiClient.enabled) {
      console.warn('GeminiProcessorInline: Gemini effects disabled');
    }
  };

  // --- File Handling ---

  GeminiProcessorInline.prototype.handleFileSelect = function(file) {
    // Validate file type
    if (ACCEPTED_TYPES.indexOf(file.type) === -1) {
      this.showError('Please upload a JPG, PNG, or WebP image.');
      return;
    }

    // Validate file size
    var sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      this.showError('Image is too large (max ' + MAX_FILE_SIZE_MB + 'MB). Please use a smaller image.');
      return;
    }

    // Check Gemini client availability
    if (!this.geminiClient) {
      this.showError('AI portrait service is not available. Please try again later.');
      return;
    }

    this.originalFile = file;
    this.sessionKey = 'pet_1_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    this.processUpload(file);
  };

  GeminiProcessorInline.prototype.processUpload = function(file) {
    var self = this;
    this.setState('processing');
    this.abortController = new AbortController();

    // Convert file to data URL, then optimize and send to Gemini
    var reader = new FileReader();
    reader.onload = function(e) {
      self.originalDataUrl = e.target.result;

      // Optimize image for Gemini (resize to 800x800 max)
      self.geminiClient.optimizeImageForGemini(self.originalDataUrl, 800)
        .then(function(optimizedDataUrl) {
          // Start parallel operations
          var geminiPromise = self.processWithGemini(optimizedDataUrl);
          var uploadPromise = self.uploadOriginalToGCS(optimizedDataUrl);

          return Promise.all([geminiPromise, uploadPromise]);
        })
        .then(function(results) {
          // Guard: if user cancelled while promises were in-flight, don't overwrite idle state
          if (self.state !== 'processing') return;

          var geminiResult = results[0];
          var gcsUrl = results[1];

          self.processedUrl = geminiResult.url;
          self.originalGcsUrl = gcsUrl;

          self.displayResult(geminiResult.url);
          self.saveToPetStorage();
          self.populateFormFields();
        })
        .catch(function(error) {
          if (error.name === 'AbortError') return; // User cancelled — no error to show
          console.error('GeminiProcessorInline: Processing failed', error);
          if (self.state === 'processing') {
            if (error.quotaExhausted) {
              self.showError('Daily portrait limit reached (10/day). Please try again tomorrow.');
            } else if (error.message && error.message.indexOf('safety') !== -1) {
              self.showError('Your prompt was flagged by content safety filters. Please try a different photo.');
            } else {
              self.showError('Something went wrong creating your portrait. Please try again.');
            }
          }
        });
    };
    reader.readAsDataURL(file);
  };

  GeminiProcessorInline.prototype.processWithGemini = function(imageDataUrl) {
    var self = this;
    var config = this.config;

    this.startProgressAnimation();

    if (config.geminiStyle === 'custom' && config.customPrompt) {
      return this.geminiClient.generateCustom(imageDataUrl, config.customPrompt, {
        sessionId: this.sessionKey
      });
    } else {
      // Use named style (ink_wash or pen_and_marker)
      var style = config.geminiStyle;
      // Map pen_and_marker to 'sketch' which is what the frontend client expects
      if (style === 'pen_and_marker') style = 'sketch';

      return this.geminiClient.generate(imageDataUrl, style, {
        sessionId: this.sessionKey
      });
    }
  };

  GeminiProcessorInline.prototype.uploadOriginalToGCS = function(imageDataUrl) {
    // Use signed URL upload via Gemini API
    if (!this.geminiClient) return Promise.resolve(null);

    var base64 = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;
    var signal = this.abortController ? this.abortController.signal : undefined;

    return fetch(this.geminiClient.baseUrl + '/api/v1/upload/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: this.geminiClient.customerId,
        session_id: this.sessionKey,
        file_type: 'image/jpeg'
      }),
      signal: signal
    })
    .then(function(response) {
      if (!response.ok) throw new Error('Failed to get signed URL');
      return response.json();
    })
    .then(function(data) {
      // Convert base64 to blob for upload
      var byteCharacters = atob(base64);
      var byteNumbers = new Array(byteCharacters.length);
      for (var i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      var byteArray = new Uint8Array(byteNumbers);
      var blob = new Blob([byteArray], { type: 'image/jpeg' });

      return fetch(data.signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
        signal: signal
      }).then(function() {
        return data.public_url;
      });
    })
    .catch(function(error) {
      if (error.name === 'AbortError') throw error; // Propagate cancellation
      console.warn('GeminiProcessorInline: Original upload failed (non-critical)', error);
      return null; // Non-critical — processed URL is what matters
    });
  };

  // --- Progress Animation ---

  GeminiProcessorInline.prototype.startProgressAnimation = function() {
    var self = this;
    this.progressPercent = 0;
    this.messageIndex = 0;

    // Animate progress bar over ~60 seconds (Gemini cold start + generation)
    var totalDuration = 60000;
    var interval = 500;
    var step = (90 / (totalDuration / interval)); // Max 90%, final 10% on completion

    this.progressTimer = setInterval(function() {
      self.progressPercent = Math.min(self.progressPercent + step, 90);
      if (self.els.progressFill) {
        self.els.progressFill.style.width = self.progressPercent + '%';
      }

      // Rotate messages every 8 seconds
      if (self.progressPercent > 0 && Math.floor(self.progressPercent) % 15 === 0) {
        self.messageIndex = (self.messageIndex + 1) % PROGRESS_MESSAGES.length;
        if (self.els.progressText) {
          self.els.progressText.textContent = PROGRESS_MESSAGES[self.messageIndex];
        }
      }
    }, interval);
  };

  GeminiProcessorInline.prototype.stopProgressAnimation = function() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    // Complete the progress bar
    if (this.els.progressFill) {
      this.els.progressFill.style.width = '100%';
    }
  };

  // --- Display & State ---

  GeminiProcessorInline.prototype.displayResult = function(imageUrl) {
    this.stopProgressAnimation();

    if (this.els.resultImage) {
      this.els.resultImage.src = imageUrl;
    }

    this.setState('result');
  };

  GeminiProcessorInline.prototype.setState = function(newState) {
    this.state = newState;
    var els = this.els;

    // Hide all states
    if (els.uploadZone) els.uploadZone.style.display = 'none';
    if (els.processing) els.processing.style.display = 'none';
    if (els.result) els.result.style.display = 'none';
    if (els.error) els.error.style.display = 'none';
    if (els.notesSection) els.notesSection.style.display = 'none';

    // Show active state
    switch (newState) {
      case 'idle':
        if (els.uploadZone) els.uploadZone.style.display = '';
        break;
      case 'processing':
        if (els.processing) els.processing.style.display = '';
        break;
      case 'result':
        if (els.result) els.result.style.display = '';
        if (els.notesSection) els.notesSection.style.display = '';
        break;
      case 'error':
        if (els.error) els.error.style.display = '';
        break;
    }
  };

  GeminiProcessorInline.prototype.showError = function(message) {
    this.stopProgressAnimation();
    if (this.els.errorMessage) {
      this.els.errorMessage.textContent = message;
    }
    this.setState('error');
  };

  GeminiProcessorInline.prototype.reset = function() {
    this.stopProgressAnimation();
    this.originalFile = null;
    this.originalDataUrl = null;
    this.processedUrl = null;
    this.originalGcsUrl = null;
    this.progressPercent = 0;
    this.messageIndex = 0;

    // Reset file input
    if (this.els.fileInput) this.els.fileInput.value = '';

    // Reset progress
    if (this.els.progressFill) this.els.progressFill.style.width = '0%';
    if (this.els.progressText) this.els.progressText.textContent = PROGRESS_MESSAGES[0];

    // Clear form fields
    this.clearFormFields();

    this.setState('idle');
  };

  GeminiProcessorInline.prototype.cancelProcessing = function() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.reset();
  };

  // --- Storage & Form ---

  GeminiProcessorInline.prototype.saveToPetStorage = function() {
    if (typeof PetStorage === 'undefined') {
      console.warn('GeminiProcessorInline: PetStorage not available');
      return;
    }

    var petName = '';
    if (this.els.petNameInput) {
      petName = this.els.petNameInput.value.trim();
    }

    var effects = {};
    var effectKey = this.config.geminiStyle;
    if (effectKey === 'custom') effectKey = 'custom_gemini';
    effects[effectKey] = this.processedUrl;

    try {
      PetStorage.savePet(1, {
        sessionKey: this.sessionKey,
        name: petName,
        artistNote: this.els.artistNotes ? this.els.artistNotes.value.trim() : '',
        originalGcsUrl: this.originalGcsUrl || '',
        effects: effects,
        selectedEffect: effectKey,
        processedAt: Date.now()
      });
    } catch (e) {
      console.warn('GeminiProcessorInline: Failed to save to PetStorage', e);
    }
  };

  GeminiProcessorInline.prototype.populateFormFields = function() {
    var petName = '';
    if (this.els.petNameInput) {
      petName = this.els.petNameInput.value.trim();
    }

    var artistNotes = '';
    if (this.els.artistNotes) {
      artistNotes = this.els.artistNotes.value.trim();
    }

    if (this.els.formPetName) this.els.formPetName.value = petName;
    if (this.els.formStyle) this.els.formStyle.value = this.config.styleDisplayName;
    if (this.els.formProcessedUrl) this.els.formProcessedUrl.value = this.processedUrl || '';
    if (this.els.formOriginalUrl) this.els.formOriginalUrl.value = this.originalGcsUrl || '';
    if (this.els.formSessionKey) this.els.formSessionKey.value = this.sessionKey || '';
    if (this.els.formSelectedEffect) this.els.formSelectedEffect.value = this.config.geminiStyle;
    if (this.els.formArtistNotes) this.els.formArtistNotes.value = artistNotes;

    // Also update on pet name change
    var self = this;
    if (this.els.petNameInput && !this.els.petNameInput._geminiListenerAttached) {
      this.els.petNameInput.addEventListener('input', function() {
        if (self.els.formPetName) self.els.formPetName.value = this.value.trim();
        // Update PetStorage too
        if (self.state === 'result') self.saveToPetStorage();
      });
      this.els.petNameInput._geminiListenerAttached = true;
    }

    // Update on artist notes change
    if (this.els.artistNotes && !this.els.artistNotes._geminiListenerAttached) {
      this.els.artistNotes.addEventListener('input', function() {
        if (self.els.formArtistNotes) self.els.formArtistNotes.value = this.value.trim();
        if (self.state === 'result') self.saveToPetStorage();
      });
      this.els.artistNotes._geminiListenerAttached = true;
    }
  };

  GeminiProcessorInline.prototype.clearFormFields = function() {
    if (this.els.formPetName) this.els.formPetName.value = '';
    if (this.els.formStyle) this.els.formStyle.value = '';
    if (this.els.formProcessedUrl) this.els.formProcessedUrl.value = '';
    if (this.els.formOriginalUrl) this.els.formOriginalUrl.value = '';
    if (this.els.formSessionKey) this.els.formSessionKey.value = '';
    if (this.els.formSelectedEffect) this.els.formSelectedEffect.value = '';
    if (this.els.formArtistNotes) this.els.formArtistNotes.value = '';
  };

  // --- Session Restoration ---

  GeminiProcessorInline.prototype.restoreSession = function() {
    if (typeof PetStorage === 'undefined') return;

    try {
      var pet = PetStorage.getPet(1);
      if (!pet || !pet.effects) return;

      // Check if session is recent (within 30 minutes)
      var MAX_AGE = 30 * 60 * 1000;
      if (pet.processedAt && (Date.now() - pet.processedAt) > MAX_AGE) return;

      // Check if there's a matching effect for our configured style
      var effectKey = this.config.geminiStyle;
      if (effectKey === 'custom') effectKey = 'custom_gemini';

      var effectUrl = pet.effects[effectKey];
      if (!effectUrl) return;

      // Restore the session
      this.processedUrl = typeof effectUrl === 'string' ? effectUrl : (effectUrl.gcsUrl || effectUrl.dataUrl || '');
      this.originalGcsUrl = pet.originalGcsUrl || '';
      this.sessionKey = pet.sessionKey || '';

      if (this.processedUrl) {
        // Restore pet name
        if (this.els.petNameInput && pet.name) {
          this.els.petNameInput.value = pet.name;
        }

        // Restore artist notes
        if (this.els.artistNotes && pet.artistNote) {
          this.els.artistNotes.value = pet.artistNote;
        }

        this.displayResult(this.processedUrl);
        this.populateFormFields();
        console.log('GeminiProcessorInline: Session restored');
      }
    } catch (e) {
      console.warn('GeminiProcessorInline: Session restoration failed', e);
    }
  };

  // --- Initialize all instances on the page ---

  function initAll() {
    var containers = document.querySelectorAll('[data-gemini-processor]');
    for (var i = 0; i < containers.length; i++) {
      if (!containers[i]._geminiProcessorInit) {
        containers[i]._geminiProcessorInit = true;
        new GeminiProcessorInline(containers[i]);
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    // DOM already ready, but defer to ensure gemini-api-client.js is loaded
    setTimeout(initAll, 100);
  }

  // Expose for external access
  window.GeminiProcessorInline = GeminiProcessorInline;

})();
