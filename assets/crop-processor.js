/**
 * Crop Processor - Mobile-First Pet Image Cropping
 * Native Canvas implementation with touch gestures
 *
 * Features:
 * - Pinch-to-zoom (mobile)
 * - Pan/drag gestures
 * - Aspect ratio presets: Circle, Square, Rectangle (free)
 * - Rule of thirds grid overlay
 * - API pre-warming during crop
 * - Session persistence
 *
 * Version: 1.0.0
 */

class CropProcessor {
  constructor(options = {}) {
    // Configuration
    this.config = {
      minZoom: 1.0,
      maxZoom: 4.0,
      gridEnabled: true,
      gridOpacity: 0.3,
      overlayOpacity: 0.6,
      handleSize: 48, // Touch-friendly (WCAG 2.2)
      animationDuration: 200,
      aspectRatios: {
        circle: 1,      // 1:1 but displayed as circle
        square: 1,      // 1:1
        rectangle: null // Free-form
      },
      ...options
    };

    // State
    this.state = {
      image: null,
      imageLoaded: false,
      aspectRatio: 'rectangle', // Default: free-form
      isCircle: false,
      zoom: 1.0,
      pan: { x: 0, y: 0 },
      cropBox: { x: 0, y: 0, width: 0, height: 0 },
      isDragging: false,
      isPinching: false,
      touches: [],
      lastPinchDistance: 0,
      lastPinchMidpoint: { x: 0, y: 0 }
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

    // API pre-warming
    this.apiWarmingStarted = false;
    this.apiUrl = options.apiUrl || 'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app';
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

    // Start API pre-warming in background
    this.warmAPIBackground();
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
            <button class="crop-aspect-btn" data-aspect="rectangle" aria-label="Rectangle crop">
              <span class="aspect-icon rect-icon"></span>
              <span class="aspect-label">Rectangle</span>
            </button>
          </div>

          <div class="crop-zoom-controls">
            <button class="crop-zoom-btn" data-zoom="out" aria-label="Zoom out">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <input type="range" class="crop-zoom-slider" min="1" max="4" step="0.1" value="1" aria-label="Zoom level">
            <button class="crop-zoom-btn" data-zoom="in" aria-label="Zoom in">
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
      alpha: false
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

    // Calculate image dimensions to fit canvas
    const imgAspect = this.state.image.width / this.state.image.height;
    const canvasAspect = canvasWidth / canvasHeight;

    let displayWidth, displayHeight;

    if (imgAspect > canvasAspect) {
      // Image is wider than canvas
      displayWidth = canvasWidth;
      displayHeight = canvasWidth / imgAspect;
    } else {
      // Image is taller than canvas
      displayHeight = canvasHeight;
      displayWidth = canvasHeight * imgAspect;
    }

    // Center crop box (80% of visible area)
    const cropSize = Math.min(displayWidth, displayHeight) * 0.8;

    this.state.cropBox = {
      x: (canvasWidth - cropSize) / 2,
      y: (canvasHeight - cropSize) / 2,
      width: cropSize,
      height: cropSize
    };

    // Reset zoom and pan
    this.state.zoom = 1.0;
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

    if (ratio === 'circle' || ratio === 'square') {
      // Square/circle: use smaller dimension
      const size = Math.min(canvasWidth, canvasHeight) * 0.75;
      this.state.cropBox = {
        x: centerX - size / 2,
        y: centerY - size / 2,
        width: size,
        height: size
      };
    } else {
      // Rectangle: use 4:3 aspect ratio
      const width = canvasWidth * 0.85;
      const height = width * 0.75; // 4:3 ratio
      this.state.cropBox = {
        x: centerX - width / 2,
        y: centerY - height / 2,
        width: width,
        height: Math.min(height, canvasHeight * 0.85)
      };
    }

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

    // Zoom controls
    this.container.querySelector('[data-zoom="in"]')?.addEventListener('click', () => this.zoomIn());
    this.container.querySelector('[data-zoom="out"]')?.addEventListener('click', () => this.zoomOut());
    this.container.querySelector('.crop-zoom-slider')?.addEventListener('input', (e) => {
      this.setZoom(parseFloat(e.target.value));
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
      // Pinch-to-zoom gesture
      const newDistance = this.getTouchDistance(touches);
      const newMidpoint = this.getTouchMidpoint(touches);

      if (this.state.lastPinchDistance > 0) {
        const zoomDelta = newDistance / this.state.lastPinchDistance;
        const newZoom = Math.max(
          this.config.minZoom,
          Math.min(this.config.maxZoom, this.state.zoom * zoomDelta)
        );
        this.setZoom(newZoom);
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
   * Handle mouse wheel (desktop zoom)
   */
  handleWheel(e) {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(
      this.config.minZoom,
      Math.min(this.config.maxZoom, this.state.zoom * delta)
    );
    this.setZoom(newZoom);
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
   * Set zoom level
   */
  setZoom(level) {
    this.state.zoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, level));

    // Update slider
    const slider = this.container.querySelector('.crop-zoom-slider');
    if (slider) {
      slider.value = this.state.zoom;
    }

    this.render();
  }

  /**
   * Zoom in
   */
  zoomIn() {
    this.setZoom(this.state.zoom + 0.25);
  }

  /**
   * Zoom out
   */
  zoomOut() {
    this.setZoom(this.state.zoom - 0.25);
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.state.zoom = 1.0;
    this.state.pan = { x: 0, y: 0 };
    this.initCropBox();

    const slider = this.container.querySelector('.crop-zoom-slider');
    if (slider) {
      slider.value = 1;
    }

    this.render();
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

    // Calculate image dimensions
    const img = this.state.image;
    const imgAspect = img.width / img.height;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawWidth, drawHeight;

    if (imgAspect > canvasAspect) {
      drawWidth = canvasWidth * this.state.zoom;
      drawHeight = drawWidth / imgAspect;
    } else {
      drawHeight = canvasHeight * this.state.zoom;
      drawWidth = drawHeight * imgAspect;
    }

    const drawX = (canvasWidth - drawWidth) / 2 + this.state.pan.x;
    const drawY = (canvasHeight - drawHeight) / 2 + this.state.pan.y;

    // Draw image
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

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width * dpr;
    outputCanvas.height = height * dpr;
    const outputCtx = outputCanvas.getContext('2d');

    // Calculate image position relative to crop box
    const img = this.state.image;
    const canvasWidth = this.canvas.width / dpr;
    const canvasHeight = this.canvas.height / dpr;
    const imgAspect = img.width / img.height;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawWidth, drawHeight;

    if (imgAspect > canvasAspect) {
      drawWidth = canvasWidth * this.state.zoom;
      drawHeight = drawWidth / imgAspect;
    } else {
      drawHeight = canvasHeight * this.state.zoom;
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

    // Draw cropped region
    outputCtx.drawImage(
      img,
      Math.max(0, sourceX),
      Math.max(0, sourceY),
      Math.min(sourceWidth, img.width - sourceX),
      Math.min(sourceHeight, img.height - sourceY),
      0, 0,
      width * dpr,
      height * dpr
    );

    // If circle, apply circular mask
    if (this.state.isCircle) {
      outputCtx.globalCompositeOperation = 'destination-in';
      outputCtx.beginPath();
      outputCtx.arc(
        (width * dpr) / 2,
        (height * dpr) / 2,
        (width * dpr) / 2,
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
  async getCroppedFile(filename = 'cropped-pet.jpg') {
    const canvas = this.getCroppedCanvas();
    if (!canvas) return null;

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const file = new File([blob], filename, { type: 'image/jpeg' });
        resolve(file);
      }, 'image/jpeg', 0.92);
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
   * Pre-warm API in background
   * Called when crop interface opens to eliminate cold start wait
   */
  async warmAPIBackground() {
    if (this.apiWarmingStarted) return;
    this.apiWarmingStarted = true;

    try {
      console.log('🔥 Pre-warming API during crop...');

      // Send health check to wake up Cloud Run
      await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(60000) // 60s timeout
      });

      console.log('✅ API pre-warmed successfully');
    } catch (error) {
      // Silently fail - main processing will still work
      console.log('⚠️ API pre-warm failed (will work anyway):', error.message);
    }
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
