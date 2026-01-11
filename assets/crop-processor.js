/**
 * Crop Processor - Mobile-First Pet Image Cropping
 * Native Canvas implementation with touch gestures
 *
 * Features:
 * - Pinch-to-zoom (mobile)
 * - Pan/drag gestures
 * - Aspect ratio presets: Circle, Square, 4:3 Landscape, 3:4 Portrait
 * - Rule of thirds grid overlay
 * - Post-processing crop (after background removal)
 * - Session persistence
 *
 * Version: 1.1.0
 */

class CropProcessor {
  constructor(options = {}) {
    // Configuration
    this.config = {
      minCropScale: 0.5,  // Minimum crop box size (50% of base)
      maxCropScale: 1.5,  // Maximum crop box size (150% of base)
      gridEnabled: true,
      gridOpacity: 0.3,
      overlayOpacity: 0.6,
      handleSize: 48, // Touch-friendly (WCAG 2.2)
      animationDuration: 200,
      aspectRatios: {
        circle: 1,        // 1:1 displayed as circle
        square: 1,        // 1:1
        landscape: 4/3,   // 4:3 horizontal
        portrait: 3/4     // 3:4 vertical
      },
      ...options
    };

    // State
    this.state = {
      image: null,
      imageLoaded: false,
      aspectRatio: 'square', // Default: square
      isCircle: false,
      cropScale: 1.0, // Scales crop box size (0.5 = smaller, 1.5 = larger)
      pan: { x: 0, y: 0 },
      cropBox: { x: 0, y: 0, width: 0, height: 0 },
      baseCropSize: 0, // Base crop box size before scaling
      isDragging: false,
      isPinching: false,
      touches: [],
      lastPinchDistance: 0,
      lastPinchMidpoint: { x: 0, y: 0 },
      suggestedBounds: null, // Detected pet bounding box with padding
      showSuggestedFrame: true // Toggle for suggested frame overlay
    };

    // DOM Elements (will be set in init)
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.overlay = null;

    // Callbacks
    this.callbacks = {
      onCrop: options.onCrop || null,
      onCancel: options.onCancel || null,
      onSkip: options.onSkip || null,
      onReady: options.onReady || null
    };
  }

  /**
   * Initialize the crop processor
   * @param {HTMLElement} container - Container element for crop UI
   */
  init(container) {
    this.container = container;
    this.createDOM();
    this.initCanvas();
    this.bindEvents();
  }

  /**
   * Create DOM structure for crop UI
   */
  createDOM() {
    this.container.innerHTML = `
      <div class="crop-modal" role="dialog" aria-modal="true" aria-label="Crop your pet photo">
        <div class="crop-header">
          <button class="crop-back" type="button" aria-label="Cancel crop">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h2 class="crop-title">Crop Your Pet</h2>
          <button class="crop-skip" type="button">Skip</button>
        </div>

        <div class="crop-canvas-wrapper">
          <canvas class="crop-canvas"></canvas>
          <div class="crop-overlay"></div>
        </div>

        <div class="crop-controls">
          <div class="crop-aspect-buttons">
            <button class="crop-aspect-btn" data-aspect="circle" aria-label="Circle crop">
              <span class="aspect-icon circle-icon"></span>
              <span class="aspect-label">Circle</span>
            </button>
            <button class="crop-aspect-btn active" data-aspect="square" aria-label="Square crop">
              <span class="aspect-icon square-icon"></span>
              <span class="aspect-label">Square</span>
            </button>
            <button class="crop-aspect-btn" data-aspect="landscape" aria-label="Landscape 4:3 crop">
              <span class="aspect-icon landscape-icon"></span>
              <span class="aspect-label">4:3</span>
            </button>
            <button class="crop-aspect-btn" data-aspect="portrait" aria-label="Portrait 3:4 crop">
              <span class="aspect-icon portrait-icon"></span>
              <span class="aspect-label">3:4</span>
            </button>
            <button class="crop-snap-btn" data-snap-to-pet aria-label="Snap crop to pet">
              <span class="snap-icon">&#8982;</span>
              <span class="snap-label">Snap to Pet</span>
            </button>
          </div>

          <div class="crop-zoom-controls">
            <button class="crop-zoom-btn" data-zoom="out" aria-label="Smaller crop">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <input type="range" class="crop-zoom-slider" min="0.5" max="1.5" step="0.05" value="1" aria-label="Crop size">
            <button class="crop-zoom-btn" data-zoom="in" aria-label="Larger crop">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="crop-footer">
          <button class="crop-reset-btn" type="button">Reset</button>
          <button class="crop-apply-btn" type="button">Continue</button>
        </div>
      </div>
    `;

    // Cache DOM elements
    this.canvas = this.container.querySelector('.crop-canvas');
    this.overlay = this.container.querySelector('.crop-overlay');
  }

  /**
   * Initialize canvas with proper sizing
   */
  initCanvas() {
    this.ctx = this.canvas.getContext('2d', {
      willReadFrequently: false, // Optimized for rendering
      alpha: true // Enable transparency support for BiRefNet images
    });

    // Set canvas size to container size
    this.resizeCanvas();
  }

  /**
   * Resize canvas to fit container
   */
  resizeCanvas() {
    const wrapper = this.container.querySelector('.crop-canvas-wrapper');
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set display size
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    // Set actual canvas size (accounting for device pixel ratio)
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Scale context for crisp rendering
    this.ctx.scale(dpr, dpr);

    // Update crop box if image loaded
    if (this.state.imageLoaded) {
      this.initCropBox();
      this.render();
    }
  }

  /**
   * Load image into crop processor
   * @param {File|Blob|string} source - Image source (File, Blob, or URL)
   * @returns {Promise<void>}
   */
  async loadImage(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.state.image = img;
        this.state.imageLoaded = true;

        // Detect pet bounding box for suggested crop region
        this.state.suggestedBounds = this.detectSubjectBounds();
        if (this.state.suggestedBounds) {
          console.log('[CropProcessor] Pet bounds detected, snap-to-pet available');
        }

        this.initCropBox();
        this.render();

        if (this.callbacks.onReady) {
          this.callbacks.onReady();
        }

        resolve();
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      // Handle different source types
      if (source instanceof File || source instanceof Blob) {
        img.src = URL.createObjectURL(source);
      } else if (typeof source === 'string') {
        // Set crossOrigin for external URLs (GCS, CDN) to prevent tainted canvas
        img.crossOrigin = 'anonymous';
        img.src = source;
      } else {
        reject(new Error('Invalid image source'));
      }
    });
  }

  /**
   * Initialize crop box with default dimensions
   */
  initCropBox() {
    if (!this.state.image) return;

    const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);

    // Calculate base crop size (80% of canvas minimum dimension)
    const baseCropSize = Math.min(canvasWidth, canvasHeight) * 0.8;
    this.state.baseCropSize = baseCropSize;

    // Initialize crop box at base size (scale = 1.0)
    this.state.cropBox = {
      x: (canvasWidth - baseCropSize) / 2,
      y: (canvasHeight - baseCropSize) / 2,
      width: baseCropSize,
      height: baseCropSize
    };

    // Reset crop scale and pan
    this.state.cropScale = 1.0;
    this.state.pan = { x: 0, y: 0 };

    // Set default aspect ratio to square
    this.setAspectRatio('square');
  }

  /**
   * Set aspect ratio for crop box
   * @param {string} ratio - 'circle', 'square', or 'rectangle'
   */
  setAspectRatio(ratio) {
    this.state.aspectRatio = ratio;
    this.state.isCircle = (ratio === 'circle');

    const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const baseSize = this.state.baseCropSize || Math.min(canvasWidth, canvasHeight) * 0.8;

    let width, height;

    if (ratio === 'circle' || ratio === 'square') {
      // Square/circle: 1:1 ratio
      width = height = baseSize;
    } else if (ratio === 'landscape') {
      // Landscape: 4:3 ratio (wider than tall)
      width = baseSize;
      height = width * (3/4);
    } else if (ratio === 'portrait') {
      // Portrait: 3:4 ratio (taller than wide)
      height = baseSize;
      width = height * (3/4);
    } else {
      // Fallback to square
      width = height = baseSize;
    }

    // Apply crop scale to dimensions
    width *= this.state.cropScale;
    height *= this.state.cropScale;

    // Ensure crop box fits within canvas
    width = Math.min(width, canvasWidth * 0.95);
    height = Math.min(height, canvasHeight * 0.95);

    this.state.cropBox = {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width: width,
      height: height
    };

    // Update UI
    this.updateAspectButtons();
    this.render();
  }

  /**
   * Update aspect ratio button states
   */
  updateAspectButtons() {
    const buttons = this.container.querySelectorAll('.crop-aspect-btn');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.aspect === this.state.aspectRatio);
    });
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Touch events for crop canvas
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

    // Mouse events (desktop fallback)
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

    // Prevent iOS gesture conflicts
    this.canvas.addEventListener('gesturestart', e => e.preventDefault());
    this.canvas.addEventListener('gesturechange', e => e.preventDefault());
    this.canvas.addEventListener('gestureend', e => e.preventDefault());

    // Button events
    this.container.querySelector('.crop-back')?.addEventListener('click', () => this.cancel());
    this.container.querySelector('.crop-skip')?.addEventListener('click', () => this.skip());
    this.container.querySelector('.crop-reset-btn')?.addEventListener('click', () => this.reset());
    this.container.querySelector('.crop-apply-btn')?.addEventListener('click', () => this.apply());

    // Aspect ratio buttons
    this.container.querySelectorAll('.crop-aspect-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setAspectRatio(btn.dataset.aspect));
    });

    // Snap to pet button
    this.container.querySelector('[data-snap-to-pet]')?.addEventListener('click', () => this.snapToSuggestion());

    // Crop scale controls
    this.container.querySelector('[data-zoom="in"]')?.addEventListener('click', () => this.scaleCropUp());
    this.container.querySelector('[data-zoom="out"]')?.addEventListener('click', () => this.scaleCropDown());
    this.container.querySelector('.crop-zoom-slider')?.addEventListener('input', (e) => {
      this.setCropScale(parseFloat(e.target.value));
    });

    // Keyboard
    document.addEventListener('keydown', this.handleKeydown.bind(this));

    // Resize
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  /**
   * Handle touch start
   */
  handleTouchStart(e) {
    e.preventDefault();

    this.state.touches = Array.from(e.touches).map(t => ({
      id: t.identifier,
      x: t.clientX,
      y: t.clientY
    }));

    if (this.state.touches.length === 1) {
      this.state.isDragging = true;
    } else if (this.state.touches.length === 2) {
      this.state.isPinching = true;
      this.state.lastPinchDistance = this.getTouchDistance();
      this.state.lastPinchMidpoint = this.getTouchMidpoint();
    }
  }

  /**
   * Handle touch move
   */
  handleTouchMove(e) {
    e.preventDefault();

    const touches = Array.from(e.touches).map(t => ({
      id: t.identifier,
      x: t.clientX,
      y: t.clientY
    }));

    if (touches.length === 1 && this.state.isDragging) {
      // Pan gesture
      const prevTouch = this.state.touches.find(t => t.id === touches[0].id);
      if (prevTouch) {
        const deltaX = touches[0].x - prevTouch.x;
        const deltaY = touches[0].y - prevTouch.y;
        this.pan(deltaX, deltaY);
      }
    } else if (touches.length === 2 && this.state.isPinching) {
      // Pinch-to-resize crop box
      const newDistance = this.getTouchDistance(touches);
      const newMidpoint = this.getTouchMidpoint(touches);

      if (this.state.lastPinchDistance > 0) {
        const scaleDelta = newDistance / this.state.lastPinchDistance;
        const newCropScale = Math.max(
          this.config.minCropScale,
          Math.min(this.config.maxCropScale, this.state.cropScale * scaleDelta)
        );
        this.setCropScale(newCropScale);
      }

      this.state.lastPinchDistance = newDistance;
      this.state.lastPinchMidpoint = newMidpoint;
    }

    this.state.touches = touches;
  }

  /**
   * Handle touch end
   */
  handleTouchEnd(e) {
    this.state.touches = Array.from(e.touches).map(t => ({
      id: t.identifier,
      x: t.clientX,
      y: t.clientY
    }));

    if (this.state.touches.length < 2) {
      this.state.isPinching = false;
      this.state.lastPinchDistance = 0;
    }

    if (this.state.touches.length === 0) {
      this.state.isDragging = false;
    }
  }

  /**
   * Handle mouse down (desktop)
   */
  handleMouseDown(e) {
    this.state.isDragging = true;
    this.state.touches = [{ id: 0, x: e.clientX, y: e.clientY }];
  }

  /**
   * Handle mouse move (desktop)
   */
  handleMouseMove(e) {
    if (!this.state.isDragging) return;

    const prevTouch = this.state.touches[0];
    const deltaX = e.clientX - prevTouch.x;
    const deltaY = e.clientY - prevTouch.y;

    this.pan(deltaX, deltaY);
    this.state.touches = [{ id: 0, x: e.clientX, y: e.clientY }];
  }

  /**
   * Handle mouse up (desktop)
   */
  handleMouseUp() {
    this.state.isDragging = false;
    this.state.touches = [];
  }

  /**
   * Handle mouse wheel (desktop crop box resize)
   */
  handleWheel(e) {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    const newCropScale = Math.max(
      this.config.minCropScale,
      Math.min(this.config.maxCropScale, this.state.cropScale * delta)
    );
    this.setCropScale(newCropScale);
  }

  /**
   * Handle keyboard events
   */
  handleKeydown(e) {
    if (!this.container.classList.contains('active')) return;

    switch (e.key) {
      case 'Escape':
        this.cancel();
        break;
      case 'Enter':
        this.apply();
        break;
      case '+':
      case '=':
        this.zoomIn();
        break;
      case '-':
        this.zoomOut();
        break;
      case 'ArrowUp':
        this.pan(0, 10);
        break;
      case 'ArrowDown':
        this.pan(0, -10);
        break;
      case 'ArrowLeft':
        this.pan(10, 0);
        break;
      case 'ArrowRight':
        this.pan(-10, 0);
        break;
    }
  }

  /**
   * Calculate distance between two touches
   */
  getTouchDistance(touches = this.state.touches) {
    if (touches.length < 2) return 0;

    const dx = touches[1].x - touches[0].x;
    const dy = touches[1].y - touches[0].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate midpoint between two touches
   */
  getTouchMidpoint(touches = this.state.touches) {
    if (touches.length < 2) return { x: 0, y: 0 };

    return {
      x: (touches[0].x + touches[1].x) / 2,
      y: (touches[0].y + touches[1].y) / 2
    };
  }

  /**
   * Pan the image
   */
  pan(deltaX, deltaY) {
    this.state.pan.x += deltaX;
    this.state.pan.y += deltaY;
    this.render();
  }

  /**
   * Set crop box scale level
   */
  setCropScale(level) {
    this.state.cropScale = Math.max(this.config.minCropScale, Math.min(this.config.maxCropScale, level));

    // Update slider
    const slider = this.container.querySelector('.crop-zoom-slider');
    if (slider) {
      slider.value = this.state.cropScale;
    }

    // Recalculate crop box with new scale
    this.setAspectRatio(this.state.aspectRatio);
  }

  /**
   * Increase crop box size
   */
  scaleCropUp() {
    this.setCropScale(this.state.cropScale + 0.1);
  }

  /**
   * Decrease crop box size
   */
  scaleCropDown() {
    this.setCropScale(this.state.cropScale - 0.1);
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.state.cropScale = 1.0;
    this.state.pan = { x: 0, y: 0 };
    this.initCropBox();

    const slider = this.container.querySelector('.crop-zoom-slider');
    if (slider) {
      slider.value = 1;
    }

    this.render();
  }

  /**
   * Detect subject bounds from transparent image
   * Scans alpha channel to find bounding box of non-transparent pixels
   * Adds 15% padding for comfortable framing
   */
  detectSubjectBounds() {
    if (!this.state.image) return null;

    const img = this.state.image;

    // Create temporary canvas to read pixel data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempCtx.drawImage(img, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
    const { data, width, height } = imageData;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasContent = false;

    // Scan for non-transparent pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 10) {  // Non-transparent threshold
          hasContent = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasContent) return null;

    // Calculate content dimensions
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Add 15% padding
    const padX = contentWidth * 0.15;
    const padY = contentHeight * 0.15;

    // Return bounds in source image coordinates
    return {
      sourceX: Math.max(0, minX - padX),
      sourceY: Math.max(0, minY - padY),
      sourceWidth: Math.min(width - minX + padX, contentWidth + 2 * padX),
      sourceHeight: Math.min(height - minY + padY, contentHeight + 2 * padY),
      // Store original content bounds for reference
      contentMinX: minX,
      contentMinY: minY,
      contentMaxX: maxX,
      contentMaxY: maxY
    };
  }

  /**
   * Calculate suggested bounds in canvas coordinates
   * Converts source image bounds to display canvas coordinates
   */
  calculateSuggestedCanvasBounds() {
    if (!this.state.image || !this.state.suggestedBounds) return null;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = this.canvas.width / dpr;
    const canvasHeight = this.canvas.height / dpr;

    const img = this.state.image;
    const imgAspect = img.width / img.height;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawWidth, drawHeight;

    if (imgAspect > canvasAspect) {
      drawWidth = canvasWidth;
      drawHeight = drawWidth / imgAspect;
    } else {
      drawHeight = canvasHeight;
      drawWidth = drawHeight * imgAspect;
    }

    const drawX = (canvasWidth - drawWidth) / 2 + this.state.pan.x;
    const drawY = (canvasHeight - drawHeight) / 2 + this.state.pan.y;

    // Scale factors from source to display
    const scaleX = drawWidth / img.width;
    const scaleY = drawHeight / img.height;

    const bounds = this.state.suggestedBounds;

    return {
      x: drawX + bounds.sourceX * scaleX,
      y: drawY + bounds.sourceY * scaleY,
      width: bounds.sourceWidth * scaleX,
      height: bounds.sourceHeight * scaleY
    };
  }

  /**
   * Snap crop box to suggested pet bounds
   */
  snapToSuggestion() {
    const canvasBounds = this.calculateSuggestedCanvasBounds();
    if (!canvasBounds) {
      console.warn('[CropProcessor] No suggested bounds available');
      return;
    }

    // Apply suggested bounds as crop box
    this.state.cropBox = {
      x: canvasBounds.x,
      y: canvasBounds.y,
      width: canvasBounds.width,
      height: canvasBounds.height
    };

    // Clear aspect ratio selection (custom bounds)
    this.state.aspectRatio = 'custom';
    this.state.isCircle = false;
    this.updateAspectButtons();

    this.render();

    console.log('[CropProcessor] Snapped to pet bounds');
  }

  /**
   * Render the crop interface
   */
  render() {
    if (!this.state.imageLoaded) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = this.canvas.width / dpr;
    const canvasHeight = this.canvas.height / dpr;

    // Clear canvas
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Calculate image dimensions (always fit to canvas, no zoom)
    const img = this.state.image;
    const imgAspect = img.width / img.height;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawWidth, drawHeight;

    if (imgAspect > canvasAspect) {
      // Image is wider - fit width
      drawWidth = canvasWidth;
      drawHeight = drawWidth / imgAspect;
    } else {
      // Image is taller - fit height
      drawHeight = canvasHeight;
      drawWidth = drawHeight * imgAspect;
    }

    const drawX = (canvasWidth - drawWidth) / 2 + this.state.pan.x;
    const drawY = (canvasHeight - drawHeight) / 2 + this.state.pan.y;

    // Draw image at optimal size
    this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    // Draw dimmed overlay
    this.ctx.fillStyle = `rgba(0, 0, 0, ${this.config.overlayOpacity})`;
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Clear crop area (show image through)
    const { x, y, width, height } = this.state.cropBox;

    this.ctx.save();
    if (this.state.isCircle) {
      // Circle crop
      this.ctx.beginPath();
      this.ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
      this.ctx.clip();
    } else {
      // Rectangle/Square crop
      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.clip();
    }

    // Redraw image in crop area (clear overlay)
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(x, y, width, height);
    this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    this.ctx.restore();

    // Draw crop border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;

    if (this.state.isCircle) {
      this.ctx.beginPath();
      this.ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
      this.ctx.stroke();
    } else {
      this.ctx.strokeRect(x, y, width, height);
    }

    // Draw grid (rule of thirds)
    if (this.config.gridEnabled && !this.state.isCircle) {
      this.drawGrid();
    }

    // Draw suggested frame overlay (if enabled and not snapped)
    if (this.state.showSuggestedFrame && this.state.aspectRatio !== 'custom') {
      this.drawSuggestedFrame();
    }
  }

  /**
   * Draw suggested frame overlay for optimal pet cropping
   * Shows pink dashed border where pet content is detected
   */
  drawSuggestedFrame() {
    const canvasBounds = this.calculateSuggestedCanvasBounds();
    if (!canvasBounds) return;

    const { x, y, width, height } = canvasBounds;

    // Save context state
    this.ctx.save();

    // Draw outer glow for visibility (pink theme)
    this.ctx.strokeStyle = 'rgba(236, 72, 153, 0.3)';
    this.ctx.lineWidth = 6;
    this.ctx.setLineDash([12, 6]);
    this.ctx.strokeRect(x, y, width, height);

    // Draw main suggested frame border (pink theme)
    this.ctx.strokeStyle = 'rgba(236, 72, 153, 0.9)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([8, 4]);
    this.ctx.strokeRect(x, y, width, height);

    // Reset line dash
    this.ctx.setLineDash([]);

    // Draw corner indicators for emphasis (pink theme)
    const cornerSize = Math.min(20, width * 0.1, height * 0.1);
    this.ctx.strokeStyle = 'rgba(236, 72, 153, 1)';
    this.ctx.lineWidth = 3;

    // Top-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + cornerSize);
    this.ctx.lineTo(x, y);
    this.ctx.lineTo(x + cornerSize, y);
    this.ctx.stroke();

    // Top-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(x + width - cornerSize, y);
    this.ctx.lineTo(x + width, y);
    this.ctx.lineTo(x + width, y + cornerSize);
    this.ctx.stroke();

    // Bottom-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + height - cornerSize);
    this.ctx.lineTo(x, y + height);
    this.ctx.lineTo(x + cornerSize, y + height);
    this.ctx.stroke();

    // Bottom-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(x + width - cornerSize, y + height);
    this.ctx.lineTo(x + width, y + height);
    this.ctx.lineTo(x + width, y + height - cornerSize);
    this.ctx.stroke();

    // Restore context state
    this.ctx.restore();
  }

  /**
   * Draw rule of thirds grid
   */
  drawGrid() {
    const { x, y, width, height } = this.state.cropBox;

    this.ctx.strokeStyle = `rgba(255, 255, 255, ${this.config.gridOpacity})`;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);

    // Vertical lines
    this.ctx.beginPath();
    this.ctx.moveTo(x + width / 3, y);
    this.ctx.lineTo(x + width / 3, y + height);
    this.ctx.moveTo(x + (2 * width) / 3, y);
    this.ctx.lineTo(x + (2 * width) / 3, y + height);
    this.ctx.stroke();

    // Horizontal lines
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + height / 3);
    this.ctx.lineTo(x + width, y + height / 3);
    this.ctx.moveTo(x, y + (2 * height) / 3);
    this.ctx.lineTo(x + width, y + (2 * height) / 3);
    this.ctx.stroke();

    this.ctx.setLineDash([]);
  }

  /**
   * Get cropped canvas
   * @returns {HTMLCanvasElement}
   */
  getCroppedCanvas() {
    if (!this.state.imageLoaded) return null;

    const dpr = window.devicePixelRatio || 1;
    const { x, y, width, height } = this.state.cropBox;

    // Calculate image position relative to crop box
    const img = this.state.image;
    const canvasWidth = this.canvas.width / dpr;
    const canvasHeight = this.canvas.height / dpr;
    const imgAspect = img.width / img.height;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawWidth, drawHeight;

    if (imgAspect > canvasAspect) {
      // Image is wider - fit width
      drawWidth = canvasWidth;
      drawHeight = drawWidth / imgAspect;
    } else {
      // Image is taller - fit height
      drawHeight = canvasHeight;
      drawWidth = drawHeight * imgAspect;
    }

    const drawX = (canvasWidth - drawWidth) / 2 + this.state.pan.x;
    const drawY = (canvasHeight - drawHeight) / 2 + this.state.pan.y;

    // Calculate source coordinates in original image
    const scaleX = img.width / drawWidth;
    const scaleY = img.height / drawHeight;

    const sourceX = (x - drawX) * scaleX;
    const sourceY = (y - drawY) * scaleY;
    const sourceWidth = width * scaleX;
    const sourceHeight = height * scaleY;

    // Create output canvas at SOURCE image resolution (not display resolution)
    // This preserves full quality from the original image
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = Math.round(sourceWidth);
    outputCanvas.height = Math.round(sourceHeight);
    const outputCtx = outputCanvas.getContext('2d', {
      alpha: true // Enable alpha channel for transparency preservation
    });

    // No background fill - preserve transparency from BiRefNet processing
    // BiRefNet images always have transparent backgrounds regardless of crop shape

    // Draw cropped region at full source resolution (no downsampling)
    outputCtx.drawImage(
      img,
      Math.max(0, sourceX),
      Math.max(0, sourceY),
      Math.min(sourceWidth, img.width - sourceX),
      Math.min(sourceHeight, img.height - sourceY),
      0, 0,
      outputCanvas.width,
      outputCanvas.height
    );

    // If circle, apply circular mask
    if (this.state.isCircle) {
      outputCtx.globalCompositeOperation = 'destination-in';
      outputCtx.beginPath();
      outputCtx.arc(
        outputCanvas.width / 2,
        outputCanvas.height / 2,
        outputCanvas.width / 2,
        0,
        Math.PI * 2
      );
      outputCtx.fill();
    }

    return outputCanvas;
  }

  /**
   * Get cropped image as File
   * @param {string} filename
   * @returns {Promise<File>}
   */
  async getCroppedFile(filename = 'cropped-pet.png') {
    const canvas = this.getCroppedCanvas();
    if (!canvas) return null;

    // Always use PNG to preserve transparency from BiRefNet processing
    // BiRefNet returns transparent backgrounds for all images, regardless of crop shape
    const mimeType = 'image/png';
    const extension = '.png';

    // Update filename extension if needed
    const finalFilename = filename.replace(/\.(jpg|jpeg|png)$/i, extension);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const file = new File([blob], finalFilename, { type: mimeType });
        resolve(file);
      }, mimeType); // No quality parameter for PNG (lossless)
    });
  }

  /**
   * Apply crop and call callback
   */
  async apply() {
    try {
      const croppedFile = await this.getCroppedFile();

      if (this.callbacks.onCrop) {
        this.callbacks.onCrop(croppedFile);
      }

      this.hide();
    } catch (error) {
      console.error('Crop apply error:', error);
    }
  }

  /**
   * Skip crop and use original
   */
  skip() {
    if (this.callbacks.onSkip) {
      this.callbacks.onSkip();
    }
    this.hide();
  }

  /**
   * Cancel crop
   */
  cancel() {
    if (this.callbacks.onCancel) {
      this.callbacks.onCancel();
    }
    this.hide();
  }

  /**
   * Show crop interface
   */
  show() {
    this.container.classList.add('active');
    this.container.setAttribute('aria-hidden', 'false');

    // Lock body scroll (iOS fix)
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    // Resize canvas after showing
    setTimeout(() => this.resizeCanvas(), 50);
  }

  /**
   * Hide crop interface
   */
  hide() {
    this.container.classList.remove('active');
    this.container.setAttribute('aria-hidden', 'true');

    // Restore body scroll
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }

  /**
   * Destroy crop processor
   */
  destroy() {
    // Remove event listeners
    this.canvas?.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas?.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas?.removeEventListener('touchend', this.handleTouchEnd);

    // Clear state
    this.state.image = null;
    this.state.imageLoaded = false;

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.CropProcessor = CropProcessor;
}
