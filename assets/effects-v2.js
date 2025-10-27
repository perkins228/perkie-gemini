/**
 * Effect Processor - Image Effects Module
 * Handles client-side previews and effect application
 * Optimized for mobile with canvas and WebP support
 *
 * Supported Effects:
 * - original/color: InSPyReNet background removal
 * - blackwhite: InSPyReNet enhanced B&W
 * - modern: Gemini ink_wash artistic style
 * - classic: Gemini van_gogh artistic style
 */

import { geminiClient } from './gemini-artistic-client.js';

export class EffectProcessor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.worker = null;
    this.supportsWebP = this.checkWebPSupport();

    // Canvas-based effects (InSPyReNet)
    this.effects = {
      original: this.original.bind(this),
      color: this.original.bind(this),      // Color effect shows unmodified processedImage
      blackwhite: this.blackwhite.bind(this)
    };

    // Gemini API effects (Modern & Classic)
    this.geminiEffects = ['modern', 'classic'];
  }

  async apply(imageUrl, effectName, orientation = 1) {
    // Check if this is a Gemini effect (Modern or Classic)
    if (this.geminiEffects.includes(effectName)) {
      return await this.applyGeminiEffect(imageUrl, effectName);
    }

    // Canvas-based effects (InSPyReNet: original, color, blackwhite)
    if (!this.effects[effectName]) {
      throw new Error(`Unknown effect: ${effectName}`);
    }

    // Load image
    const img = await this.loadImage(imageUrl);
    console.log('🔧 Canvas processing:', effectName, img.width + 'x' + img.height);

    // API already handles EXIF rotation and returns correctly oriented images
    const width = img.width;
    const height = img.height;

    // Initialize canvas if needed
    if (!this.canvas) {
      this.initCanvas(width, height);
    } else {
      this.resizeCanvas(width, height);
    }

    // Clear canvas and draw the API's correctly oriented image directly
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(img, 0, 0, width, height);
    console.log('🔄 Using API image directly - correct orientation preserved');

    // Apply effect (color/original effects are already drawn correctly)
    if (effectName !== 'original' && effectName !== 'color') {
      await this.effects[effectName](this.ctx, img);
    }

    // Return optimized result
    return this.getOptimizedResult();
  }

  /**
   * Apply Gemini artistic effect (Modern or Classic)
   * @param {string} imageUrl - Background-removed image URL
   * @param {string} effectName - 'modern' or 'classic'
   * @returns {Promise<string>} - Object URL of styled image
   */
  async applyGeminiEffect(imageUrl, effectName) {
    console.log('🎨 Gemini processing:', effectName);

    try {
      // Check rate limit before processing
      const rateLimit = geminiClient.checkRateLimit();
      if (!rateLimit.allowed) {
        const hoursUntilReset = Math.ceil((rateLimit.resetTime - new Date()) / (1000 * 60 * 60));
        throw new Error(`Rate limit exceeded. You've used all ${geminiClient.maxRequestsPerDay} ${effectName} requests today. Resets in ${hoursUntilReset}h.`);
      }

      // Convert image URL to Blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Call Gemini API
      const styledBlob = await geminiClient.applyStyle(blob, effectName);

      // Return object URL
      const objectUrl = URL.createObjectURL(styledBlob);
      console.log('✅ Gemini effect applied:', effectName);

      return objectUrl;

    } catch (error) {
      console.error('❌ Gemini effect failed:', error);
      throw error;
    }
  }

  initCanvas(width, height) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', {
      willReadFrequently: true,
      alpha: true
    });
    this.resizeCanvas(width, height);
  }

  resizeCanvas(width, height) {
    // Optimize for mobile - max 1024px
    const maxSize = 1024;
    
    if (width > maxSize || height > maxSize) {
      const scale = maxSize / Math.max(width, height);
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }

    this.canvas.width = width;
    this.canvas.height = height;
  }

  async loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        resolve(img);
      };
      img.onerror = reject;
      
      img.src = url;
    });
  }

  // SIMPLEST rotation handling - calculate dimensions and draw rotated
  getRotatedDimensions(width, height, orientation) {
    // Orientations 5, 6, 7, 8 require width/height swap
    if (orientation >= 5 && orientation <= 8) {
      return { width: height, height: width };
    }
    return { width, height };
  }

  drawRotatedImage(img, orientation) {
    const { width, height } = this.getRotatedDimensions(img.width, img.height, orientation);
    
    // Clear canvas and save context
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    
    // Apply transformation based on EXIF orientation
    switch (orientation) {
      case 2: // Flip horizontal
        this.ctx.translate(width, 0);
        this.ctx.scale(-1, 1);
        break;
      case 3: // Rotate 180°
        this.ctx.translate(width, height);
        this.ctx.rotate(Math.PI);
        break;
      case 4: // Flip vertical
        this.ctx.translate(0, height);
        this.ctx.scale(1, -1);
        break;
      case 5: // Rotate 90° CCW + flip horizontal
        this.ctx.translate(0, height);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.scale(-1, 1);
        break;
      case 6: // Rotate 90° CW
        this.ctx.translate(height, 0);
        this.ctx.rotate(Math.PI / 2);
        break;
      case 7: // Rotate 90° CW + flip horizontal
        this.ctx.translate(height, width);
        this.ctx.rotate(Math.PI / 2);
        this.ctx.scale(-1, 1);
        break;
      case 8: // Rotate 90° CCW
        this.ctx.translate(0, width);
        this.ctx.rotate(-Math.PI / 2);
        break;
      case 1: // Normal
      default:
        // No transformation needed
        break;
    }
    
    // Draw the image
    this.ctx.drawImage(img, 0, 0, img.width, img.height);
    
    // Restore context
    this.ctx.restore();
  }



  // Effects implementation
  original(ctx, img) {
    // Original/Color effect shows the background-removed image in full color
    // The image is already correctly drawn to canvas in apply() method with proper orientation
    // No additional processing needed - this preserves the API's correctly oriented background-removed image
    return;
  }

  blackwhite(ctx, img) {
    const imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Enhanced black & white with better contrast
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

      // Apply contrast enhancement
      const enhanced = this.enhanceContrast(gray, 1.2);

      data[i] = enhanced;     // Red
      data[i + 1] = enhanced; // Green
      data[i + 2] = enhanced; // Blue
      // Alpha remains unchanged
    }

    ctx.putImageData(imageData, 0, 0);
  }

  enhanceContrast(value, factor) {
    // Enhance contrast around midpoint
    return ((value / 255 - 0.5) * factor + 0.5) * 255;
  }

  async getOptimizedResult() {
    // Use WebP if supported, otherwise PNG
    const format = this.supportsWebP ? 'webp' : 'png';
    const quality = 0.85;

    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        resolve(URL.createObjectURL(blob));
      }, `image/${format}`, quality);
    });
  }

  checkWebPSupport() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1, 1);
    
    return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
  }

  // Generate thumbnail for mobile
  async generateThumbnail(imageUrl, size = 150) {
    const img = await this.loadImage(imageUrl);
    
    const thumbCanvas = document.createElement('canvas');
    const thumbCtx = thumbCanvas.getContext('2d');
    
    // Calculate aspect ratio
    const aspectRatio = img.width / img.height;
    let width = size;
    let height = size;
    
    if (aspectRatio > 1) {
      height = size / aspectRatio;
    } else {
      width = size * aspectRatio;
    }
    
    thumbCanvas.width = width;
    thumbCanvas.height = height;
    
    // Draw scaled image
    thumbCtx.drawImage(img, 0, 0, width, height);
    
    return thumbCanvas.toDataURL('image/webp', 0.7);
  }

  // Batch process multiple effects for preview
  async generatePreviews(imageUrl, effectList = ['original', 'blackwhite', 'modern', 'classic']) {
    const previews = new Map();

    for (const effect of effectList) {
      try {
        const result = await this.apply(imageUrl, effect);
        const thumbnail = await this.generateThumbnail(result, 150);

        previews.set(effect, {
          full: result,
          thumbnail: thumbnail
        });
      } catch (error) {
        console.error(`Failed to generate preview for ${effect}:`, error);
        // For Gemini effects, show error in preview
        if (this.geminiEffects.includes(effect)) {
          previews.set(effect, {
            full: null,
            thumbnail: null,
            error: error.message
          });
        }
      }
    }

    return previews;
  }

  // Cleanup resources
  cleanup() {
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
      this.canvas = null;
      this.ctx = null;
    }
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}