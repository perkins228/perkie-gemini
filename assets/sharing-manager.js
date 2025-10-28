/**
 * Sharing Manager - ES6 Module Version
 * Ported from pet-social-sharing-simple.js for Effects V2 Migration
 *
 * Features:
 * - Mobile: Native Web Share API (70% of traffic)
 * - Desktop: Clipboard copy + platform instructions
 * - Watermark application
 * - Toast notifications
 * - Analytics tracking
 */

export class SharingManager {
  constructor() {
    this.watermarkConfig = {
      text: 'PerkiePrints.com',
      font: 'italic 20px Georgia, serif',
      fillStyle: 'rgba(255, 255, 255, 0.9)',
      strokeStyle: 'rgba(0, 0, 0, 0.4)',
      lineWidth: 2,
      padding: 15
    };
  }

  /**
   * Share an effect image
   * @param {HTMLCanvasElement|HTMLImageElement|string} source - Canvas, Image, or data URL
   * @param {Object} options - Sharing options (title, text)
   * @returns {Promise<boolean>} Success status
   */
  async share(source, options = {}) {
    try {
      // Get canvas from source
      const canvas = await this.getCanvasFromSource(source);
      if (!canvas) {
        this.showToast('Failed to prepare image for sharing');
        return false;
      }

      // Ensure white background
      this.ensureWhiteBackground(canvas);

      // Add watermark
      this.addWatermark(canvas);

      // Determine share method (mobile vs desktop)
      if (navigator.share && this.isMobile()) {
        return await this.shareViaNativeAPI(canvas, options);
      } else {
        return await this.shareViaClipboard(canvas);
      }
    } catch (error) {
      console.error('[Sharing Manager] Share failed:', error);
      this.showToast('Failed to share image');
      return false;
    }
  }

  /**
   * Get canvas from various source types
   * @param {HTMLCanvasElement|HTMLImageElement|string} source
   * @returns {Promise<HTMLCanvasElement|null>}
   */
  async getCanvasFromSource(source) {
    // Already a canvas
    if (source instanceof HTMLCanvasElement) {
      return source;
    }

    // Image element
    if (source instanceof HTMLImageElement) {
      return this.createCanvasFromImage(source);
    }

    // Data URL string
    if (typeof source === 'string' && source.startsWith('data:')) {
      return this.createCanvasFromDataUrl(source);
    }

    console.error('[Sharing Manager] Invalid source type:', source);
    return null;
  }

  /**
   * Create canvas from image element
   * @param {HTMLImageElement} img
   * @returns {HTMLCanvasElement}
   */
  createCanvasFromImage(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext('2d');

    // Add white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(img, 0, 0);

    return canvas;
  }

  /**
   * Create canvas from data URL
   * @param {string} dataUrl
   * @returns {Promise<HTMLCanvasElement>}
   */
  createCanvasFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(this.createCanvasFromImage(img));
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Ensure white background on canvas
   * @param {HTMLCanvasElement} canvas
   */
  ensureWhiteBackground(canvas) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    const tempCtx = tempCanvas.getContext('2d');

    // Fill with white
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw original canvas on top
    tempCtx.drawImage(canvas, 0, 0);

    // Copy back to original canvas
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
  }

  /**
   * Add watermark to canvas
   * @param {HTMLCanvasElement} canvas
   */
  addWatermark(canvas) {
    const ctx = canvas.getContext('2d');
    const config = this.watermarkConfig;

    // Save context state
    ctx.save();

    // Set up text styling
    ctx.font = config.font;
    ctx.fillStyle = config.fillStyle;
    ctx.strokeStyle = config.strokeStyle;
    ctx.lineWidth = config.lineWidth;

    // Position watermark in bottom-right corner
    const text = config.text;
    const metrics = ctx.measureText(text);
    const x = canvas.width - metrics.width - config.padding;
    const y = canvas.height - config.padding;

    // Draw text with stroke for better visibility
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);

    // Restore context
    ctx.restore();

    console.log('[Sharing Manager] Watermark added');
  }

  /**
   * Share via native Web Share API (mobile)
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  async shareViaNativeAPI(canvas, options = {}) {
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          this.showToast('Failed to prepare image');
          resolve(false);
          return;
        }

        const file = new File([blob], 'my-pet.jpg', { type: 'image/jpeg' });

        try {
          await navigator.share({
            files: [file],
            title: options.title || 'Check out my pet!',
            text: options.text || 'Created with PerkiePrints.com'
          });

          console.log('[Sharing Manager] Shared successfully via native API');
          this.trackShare('native');
          resolve(true);
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error('[Sharing Manager] Native share failed:', error);
            // Fallback to clipboard
            const success = await this.shareViaClipboard(canvas);
            resolve(success);
          } else {
            // User cancelled
            resolve(false);
          }
        }
      }, 'image/jpeg', 0.9);
    });
  }

  /**
   * Share via clipboard (desktop)
   * @param {HTMLCanvasElement} canvas
   * @returns {Promise<boolean>}
   */
  async shareViaClipboard(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          this.showToast('Failed to prepare image');
          resolve(false);
          return;
        }

        // Try modern Clipboard API for images
        if (navigator.clipboard && navigator.clipboard.write) {
          try {
            const clipboardItem = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([clipboardItem]);

            this.showToast('Image copied! Paste directly into any social platform.');
            this.showPlatformInstructions();
            this.trackShare('clipboard');
            console.log('[Sharing Manager] Image copied to clipboard');
            resolve(true);
          } catch (err) {
            console.error('[Sharing Manager] Clipboard API failed:', err);
            // Fallback: Open in new tab
            this.openImageInNewTab(blob);
            resolve(true);
          }
        } else {
          // Fallback for browsers without clipboard.write
          this.openImageInNewTab(blob);
          resolve(true);
        }
      }, 'image/png', 0.9);
    });
  }

  /**
   * Open image in new tab (fallback)
   * @param {Blob} blob
   */
  openImageInNewTab(blob) {
    const url = URL.createObjectURL(blob);
    const newTab = window.open(url, '_blank');

    if (newTab) {
      this.showToast('Image opened in new tab. Right-click to copy.');
      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);
    } else {
      this.showToast('Please allow pop-ups to share the image.');
    }

    this.trackShare('new-tab');
  }

  /**
   * Show toast notification
   * @param {string} message
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'pet-share-toast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
                          'background:rgba(0,0,0,0.8);color:white;padding:12px 24px;' +
                          'border-radius:4px;z-index:9999;font-size:14px;';

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Show platform-specific instructions
   */
  showPlatformInstructions() {
    const modal = document.createElement('div');
    modal.className = 'share-instructions-modal';
    modal.innerHTML =
      '<div class="instructions-content">' +
      '<h4>Image Copied! Now paste it:</h4>' +
      '<div class="platform-list">' +
      '<div class="platform-item">📘 <strong>Facebook:</strong> Create post → Ctrl+V (Cmd+V on Mac)</div>' +
      '<div class="platform-item">📷 <strong>Instagram:</strong> Open web → Create → Ctrl+V</div>' +
      '<div class="platform-item">📌 <strong>Pinterest:</strong> Create Pin → Ctrl+V</div>' +
      '<div class="platform-item">🐦 <strong>Twitter/X:</strong> Compose tweet → Ctrl+V</div>' +
      '</div>' +
      '<button class="close-btn">Got it!</button>' +
      '</div>';

    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;' +
                          'background:rgba(0,0,0,0.7);display:flex;align-items:center;' +
                          'justify-content:center;z-index:10000;';

    document.body.appendChild(modal);

    const removeModal = () => {
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    };

    modal.querySelector('.close-btn').addEventListener('click', removeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) removeModal();
    });

    setTimeout(removeModal, 8000);
  }

  /**
   * Check if device is mobile
   * @returns {boolean}
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
  }

  /**
   * Track share event
   * @param {string} method - Sharing method used
   */
  trackShare(method) {
    if (window.gtag) {
      window.gtag('event', 'share', {
        event_category: 'engagement',
        event_label: method
      });
    }
    console.log('[Sharing Manager] Tracked share:', method);
  }
}

// Create singleton instance
export const sharingManager = new SharingManager();

// Also attach to window for backward compatibility
if (typeof window !== 'undefined') {
  window.SharingManager = SharingManager;
  window.sharingManager = sharingManager;
}
