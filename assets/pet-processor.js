/**
 * Pet Processor - Mobile-First ES6+ Implementation
 * Replaces 2,343 lines of ES5 with 600 lines of modern JavaScript
 * Version: 1.0.1 - Force resync
 */

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
    this.effectOrder = ['enhancedblackwhite', 'popart', 'dithering', 'color'];
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
    this.selectedEffect = 'enhancedblackwhite';
    
    // Initialize new features
    this.comparisonManager = null;
    this.sharing = null;
    
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
    
    // Bind events
    this.bindEvents();

    // Initialize features
    this.initializeFeatures();
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
              <!-- Effect Selection -->
              <div class="effect-grid">
                <button class="effect-btn active" data-effect="enhancedblackwhite">
                  <span class="effect-emoji">⚫⚪</span>
                  <span class="effect-name">B&W</span>
                </button>
                <button class="effect-btn" data-effect="popart">
                  <span class="effect-emoji">🎨</span>
                  <span class="effect-name">Pop Art</span>
                </button>
                <button class="effect-btn" data-effect="dithering">
                  <span class="effect-emoji">📰</span>
                  <span class="effect-name">Halftone</span>
                </button>
                <button class="effect-btn" data-effect="color">
                  <span class="effect-emoji">🌈</span>
                  <span class="effect-name">Color</span>
                </button>
              </div>
            </div>
            
            <!-- Pet Name (shown in result view) -->
            <div class="pet-name-section" hidden>
              <label for="pet-name-${this.sectionId}">Pet Name (Optional)</label>
              <input type="text" 
                     id="pet-name-${this.sectionId}" 
                     class="pet-name-input" 
                     placeholder="Enter your pet's name">
            </div>
            
            <!-- Artist Notes (shown in result view) -->
            <div class="artist-notes-section" hidden>
              <label for="artist-notes-${this.sectionId}">Note for the Artist (Optional)</label>
              <textarea 
                id="artist-notes-${this.sectionId}" 
                class="artist-notes-input"
                placeholder="Any special requests about your pet's personality or features"
                rows="3"
                maxlength="500"></textarea>
              <div class="char-count">
                <span id="char-count-${this.sectionId}">0</span>/500
              </div>
            </div>
            
            <!-- Actions (shown in result view) -->
            <div class="action-buttons" hidden>
              <button class="btn-secondary process-another-btn">Process Another Pet</button>
              <button class="btn-primary add-to-cart-btn">Add to Product</button>
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
    this.container.querySelector('.process-another-btn')?.addEventListener('click', async () => await this.processAnother());
    this.container.querySelector('.add-to-cart-btn')?.addEventListener('click', () => this.saveToCart());
    this.container.querySelector('.try-again-btn')?.addEventListener('click', () => this.reset());
    
    // Artist notes character counter
    const notesField = this.container.querySelector(`#artist-notes-${this.sectionId}`);
    const charCount = this.container.querySelector(`#char-count-${this.sectionId}`);
    if (notesField && charCount) {
      notesField.addEventListener('input', (e) => {
        charCount.textContent = e.target.value.length;
      });
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
      // Parallel operations: upload original AND process with API
      const [originalUrl, result] = await Promise.all([
        this.uploadOriginalImage(file),
        this.callAPI(file)
      ]);

      // Store result with both original and processed URLs
      this.currentPet = {
        id: `pet_${crypto.randomUUID()}`,
        filename: file.name,
        originalFile: file,
        originalUrl: originalUrl, // NEW: Cloud Storage URL for original
        ...result
      };

      // Show result
      this.showResult(result);

    } catch (error) {
      this.showError('Processing failed. Please try again.');
      console.error('Processing error:', error);
    }
  }
  
  async uploadOriginalImage(file) {
    // Convert file to data URL for upload
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    
    // Generate session ID if not exists
    const sessionId = this.getSessionId();
    
    // Upload to storage API
    const requestBody = {
      session_id: sessionId,
      images: {
        original: dataUrl
      },
      metadata: {
        filename: file.name,
        size: file.size,
        type: file.type,
        timestamp: new Date().toISOString()
      }
    };
    
    try {
      const response = await fetch(`${this.apiUrl}/api/storage/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        console.error('Failed to upload original image:', response.status);
        // Don't fail the whole process if original upload fails
        return null;
      }
      
      const data = await response.json();
      return data.urls.original || null;
    } catch (error) {
      console.error('Error uploading original image:', error);
      // Don't fail the whole process if original upload fails
      return null;
    }
  }
  
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
    formData.append('effects', 'enhancedblackwhite,popart,dithering,color');
    
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
    const responsePromise = fetch(`${this.apiUrl}/api/v2/process-with-effects?return_all_effects=true&effects=enhancedblackwhite,popart,dithering,color`, {
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
    
    for (const [effectName, base64Data] of Object.entries(effectsData)) {
      // Convert base64 to data URL
      const dataUrl = `data:image/png;base64,${base64Data}`;
      effects[effectName] = {
        gcsUrl: '', // Will be set when uploading to GCS if needed
        dataUrl: dataUrl
      };
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
    
    if (!effectData) return;
    
    // Update UI
    this.container.querySelectorAll('.effect-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Update image
    const img = this.container.querySelector('.pet-image');
    if (img) {
      img.src = effectData.dataUrl;
    }
    
    // Update current selection
    this.currentPet.selectedEffect = effect;
    this.selectedEffect = effect;
    
    // Show share button after effect selection
    if (this.sharing) {
      this.sharing.showShareButton();
    }
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
      const leftResultElements = this.container.querySelectorAll('.processor-controls .effect-grid-wrapper, .processor-controls .pet-name-section, .processor-controls .artist-notes-section, .processor-controls .action-buttons');
      leftResultElements.forEach(el => el.hidden = false);

      // Show result view in right column
      const rightResultView = this.container.querySelector('.processor-preview .result-view');
      if (rightResultView) rightResultView.hidden = false;

      // Hide preview placeholder
      const placeholder = this.container.querySelector('.preview-placeholder');
      if (placeholder) placeholder.style.display = 'none';

      this.isProcessing = false;

      // Set initial image
      const img = this.container.querySelector('.pet-image');
      if (img && result.effects.enhancedblackwhite) {
        img.src = result.effects.enhancedblackwhite.dataUrl;
      }
    });
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
    const leftViews = this.container.querySelectorAll('.upload-zone, .processing-view, .error-view, .effect-grid-wrapper, .pet-name-section, .artist-notes-section, .action-buttons');
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
  
  getArtistNote() {
    const noteField = this.container.querySelector(`#artist-notes-${this.sectionId}`);
    return noteField ? noteField.value.trim() : '';
  }
  
  // Save pet data without navigation (extracted from saveToCart)
  async savePetData() {
    if (!this.currentPet || !this.currentPet.effects) {
      console.error('❌ No current pet or effects available');
      return false;
    }

    const petName = this.container.querySelector('.pet-name-input')?.value || 'Pet';
    const artistNote = this.getArtistNote();
    const selectedEffect = this.currentPet.selectedEffect || 'enhancedblackwhite';
    const effectData = this.currentPet.effects[selectedEffect];

    // Check if effect data exists
    if (!effectData || !effectData.dataUrl) {
      console.error('❌ Effect data not found for:', selectedEffect);
      console.log('Available effects:', Object.keys(this.currentPet.effects));
      return false;
    }

    // CRITICAL FIX: Upload to GCS before saving to localStorage
    console.log('📤 Uploading images to GCS...');
    let gcsUrl = effectData.gcsUrl || '';
    let originalUrl = this.currentPet.originalUrl || '';

    // Upload processed image if not already uploaded
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
        console.warn('⚠️ Processed image upload failed, will use thumbnail');
      }
    }

    // Upload original image if not already uploaded
    if (!originalUrl && this.currentPet.originalDataUrl) {
      originalUrl = await this.uploadToGCS(
        this.currentPet.originalDataUrl,
        this.currentPet.id,
        'original',
        'none'
      );
      if (originalUrl) {
        this.currentPet.originalUrl = originalUrl; // Cache in memory
        console.log(`✅ Original image uploaded: ${originalUrl}`);
      } else {
        console.warn('⚠️ Original image upload failed');
      }
    }

    const petData = {
      name: petName,
      artistNote: artistNote,
      filename: this.currentPet.filename,
      effect: selectedEffect,
      thumbnail: effectData.dataUrl,  // Compressed thumbnail for display
      gcsUrl: gcsUrl,                 // Full-resolution processed image URL
      originalUrl: originalUrl         // Full-resolution original image URL
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
    document.dispatchEvent(new CustomEvent('petProcessorComplete', {
      detail: {
        sessionKey: this.currentPet.id,
        gcsUrl: gcsUrl,
        originalUrl: originalUrl,
        effect: selectedEffect,
        name: petName,
        artistNote: artistNote
      }
    }));

    return true;  // Success
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
        effect: petData.effect,
        thumbnail: petData.thumbnail,
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

    // Clear pet name input
    const petNameInput = this.container.querySelector('.pet-name-input');
    if (petNameInput) petNameInput.value = '';

    // Clear artist notes textarea
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
   * @param {Function} callback - Called with {original: url, processed: url} or null
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

      // Check if URLs already exist (cached)
      if (effectData.gcsUrl && pet.originalUrl) {
        console.log('✅ Using cached GCS URLs');
        callback({
          original: pet.originalUrl,
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

      // Upload original image if available
      let originalUrl = null;
      if (pet.originalDataUrl) {
        originalUrl = await this.uploadToGCS(
          pet.originalDataUrl,
          sessionKey,
          'original',
          'none'
        );
      }

      // Update pet data with GCS URLs
      effectData.gcsUrl = processedUrl;
      if (originalUrl) {
        pet.originalUrl = originalUrl;
      }

      // Update PetStorage with GCS URLs
      const petData = PetStorage.get(sessionKey);
      if (petData) {
        await PetStorage.save(sessionKey, {
          ...petData,
          gcsUrl: processedUrl,
          originalUrl: originalUrl || petData.originalUrl || ''
        });
        console.log('✅ Updated PetStorage with GCS URLs');
      }

      // Return URLs via callback
      callback({
        original: originalUrl,
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