/**
 * Effect Processor - Image Effects Module
 * Handles client-side previews and effect application
 * Optimized for mobile with canvas and WebP support
 */

export class EffectProcessor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.worker = null;
    this.supportsWebP = this.checkWebPSupport();
    
    this.effects = {
      original: this.original.bind(this),
      color: this.original.bind(this),      // Color effect shows unmodified processedImage
      blackwhite: this.blackwhite.bind(this),
      popart: this.popart.bind(this),
      dithering: this.dithering.bind(this),
      vintage: this.vintage.bind(this)
    };
  }

  async apply(imageUrl, effectName, orientation = 1) {
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

  popart(ctx, img) {
    const imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;

    // Define pop art color palette
    const colors = [
      [255, 0, 128],   // Hot pink
      [0, 255, 255],   // Cyan
      [255, 255, 0],   // Yellow
      [128, 0, 255],   // Purple
      [0, 255, 0]      // Green
    ];

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      
      // Quantize to 5 levels
      const level = Math.floor((brightness / 255) * colors.length);
      const color = colors[Math.min(level, colors.length - 1)];
      
      data[i] = color[0];     // Red
      data[i + 1] = color[1]; // Green
      data[i + 2] = color[2]; // Blue
    }

    ctx.putImageData(imageData, 0, 0);
  }

  dithering(ctx, img) {
    const imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    const width = this.canvas.width;

    // Floyd-Steinberg dithering
    for (let y = 0; y < this.canvas.height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Convert to grayscale
        const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        
        // Threshold (black or white)
        const newVal = gray > 128 ? 255 : 0;
        const error = gray - newVal;
        
        data[idx] = newVal;
        data[idx + 1] = newVal;
        data[idx + 2] = newVal;
        
        // Distribute error to neighboring pixels
        if (x < width - 1) {
          data[idx + 4] += error * 7 / 16;
        }
        if (y < this.canvas.height - 1) {
          if (x > 0) {
            data[idx + width * 4 - 4] += error * 3 / 16;
          }
          data[idx + width * 4] += error * 5 / 16;
          if (x < width - 1) {
            data[idx + width * 4 + 4] += error * 1 / 16;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  vintage(ctx, img) {
    const imageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Apply sepia tone
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
      data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
      data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
    }

    // Add vignette effect
    this.addVignette(ctx);

    ctx.putImageData(imageData, 0, 0);
  }

  enhanceContrast(value, factor) {
    // Enhance contrast around midpoint
    return ((value / 255 - 0.5) * factor + 0.5) * 255;
  }

  addVignette(ctx) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

    // Create radial gradient for vignette
    const gradient = ctx.createRadialGradient(
      centerX, centerY, maxRadius * 0.5,
      centerX, centerY, maxRadius
    );
    
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
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
  async generatePreviews(imageUrl, effectList = ['original', 'blackwhite', 'popart']) {
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