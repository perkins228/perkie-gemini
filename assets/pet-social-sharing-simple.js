/**
 * Pet Social Sharing - Simple Version
 * Replaces 995-line complex implementation with 100-line simple solution
 * Mobile: Native Web Share API (70% of traffic)
 * Desktop: Download + Copy URL (30% of traffic)
 * Created: 2025-08-28
 */

(function() {
    'use strict';

    window.PetSocialSharingSimple = function() {
        // Simple watermark configuration
        this.watermarkConfig = {
            text: 'PerkiePrints.com',
            font: 'italic 20px Georgia, serif',
            fillStyle: 'rgba(255, 255, 255, 0.9)',
            strokeStyle: 'rgba(0, 0, 0, 0.4)',
            lineWidth: 2,
            padding: 15
        };

        this.init();
    };

    PetSocialSharingSimple.prototype = {
        init: function() {
            console.log('[Social Sharing Simple] Initializing...');
            
            // Wait for DOM ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', this.setupShareButton.bind(this));
            } else {
                this.setupShareButton();
            }
        },

        setupShareButton: function() {
            // Find or create share button
            var existingButton = document.querySelector('.pet-share-button-simple');
            if (!existingButton) {
                // Replace complex multi-button UI with single share button
                var shareContainer = document.querySelector('.share-buttons-container, .social-share-wrapper');
                if (shareContainer) {
                    shareContainer.innerHTML = this.createShareButtonHTML();
                }
            }

            // Attach event listener
            var shareButton = document.querySelector('.pet-share-button-simple');
            if (shareButton) {
                shareButton.addEventListener('click', this.handleShare.bind(this));
                console.log('[Social Sharing Simple] Share button ready');
            }
        },

        createShareButtonHTML: function() {
            return '<button class="pet-share-button-simple" aria-label="Share your pet image">' +
                   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                   '<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"></path>' +
                   '<polyline points="16 6 12 2 8 6"></polyline>' +
                   '<line x1="12" y1="2" x2="12" y2="15"></line>' +
                   '</svg>' +
                   '<span>Share</span>' +
                   '</button>';
        },

        handleShare: function(event) {
            event.preventDefault();
            
            // Get the processed canvas or create from image
            var canvas = document.getElementById('processedCanvas') || 
                        document.querySelector('.processed-image canvas') ||
                        document.querySelector('[data-processed-canvas]');
            
            // If no canvas, try to create from pet-image
            if (!canvas) {
                var img = document.querySelector('.pet-image');
                if (img && img.src) {
                    canvas = this.createCanvasFromImage(img);
                } else {
                    this.showToast('Please process an image first');
                    return;
                }
            }

            // Ensure white background before watermarking
            this.ensureWhiteBackground(canvas);
            
            // Add watermark to canvas
            this.addWatermark(canvas);

            // Determine share method
            if (navigator.share && this.isMobile()) {
                // Mobile: Use Web Share API
                this.shareViaNativeAPI(canvas);
            } else {
                // Desktop: Copy image to clipboard (no download)
                this.shareViaClipboard(canvas);
            }
        },

        ensureWhiteBackground: function(canvas) {
            // Create a new canvas with white background
            var tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            
            var tempCtx = tempCanvas.getContext('2d');
            
            // Fill with white
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Draw the original canvas on top
            tempCtx.drawImage(canvas, 0, 0);
            
            // Copy back to original canvas
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempCanvas, 0, 0);
        },

        createCanvasFromImage: function(img) {
            // Create a temporary canvas from the image
            var canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            
            var ctx = canvas.getContext('2d');
            
            // Add white background for social sharing (prevents black backgrounds on platforms)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw the image on top of white background
            ctx.drawImage(img, 0, 0);
            
            return canvas;
        },

        addWatermark: function(canvas) {
            var ctx = canvas.getContext('2d');
            var config = this.watermarkConfig;
            
            // Save context state
            ctx.save();
            
            // Set up text styling
            ctx.font = config.font;
            ctx.fillStyle = config.fillStyle;
            ctx.strokeStyle = config.strokeStyle;
            ctx.lineWidth = config.lineWidth;
            
            // Position watermark in bottom-right corner
            var text = config.text;
            var metrics = ctx.measureText(text);
            var x = canvas.width - metrics.width - config.padding;
            var y = canvas.height - config.padding;
            
            // Draw text with stroke for better visibility
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
            
            // Restore context
            ctx.restore();
            
            console.log('[Social Sharing Simple] Watermark added');
        },

        shareViaNativeAPI: function(canvas) {
            var self = this;
            
            canvas.toBlob(function(blob) {
                if (!blob) {
                    self.showToast('Failed to prepare image');
                    return;
                }

                var file = new File([blob], 'my-pet.jpg', { type: 'image/jpeg' });
                
                navigator.share({
                    files: [file],
                    title: 'Check out my pet!',
                    text: 'Created with PerkiePrints.com'
                }).then(function() {
                    console.log('[Social Sharing Simple] Shared successfully');
                    self.trackShare('native');
                }).catch(function(error) {
                    if (error.name !== 'AbortError') {
                        console.error('[Social Sharing Simple] Share failed:', error);
                        self.shareViaClipboard(canvas);
                    }
                });
            }, 'image/jpeg', 0.9);
        },

        shareViaClipboard: function(canvas) {
            var self = this;
            
            // Desktop: Copy image to clipboard (no download required)
            canvas.toBlob(function(blob) {
                if (!blob) {
                    self.showToast('Failed to prepare image');
                    return;
                }

                // Try modern Clipboard API for images
                if (navigator.clipboard && navigator.clipboard.write) {
                    // Create ClipboardItem with the image
                    var clipboardItem = new ClipboardItem({ 'image/png': blob });
                    
                    navigator.clipboard.write([clipboardItem]).then(function() {
                        // Success! Image is in clipboard
                        self.showToast('Image copied! Paste directly into any social platform.');
                        self.showPlatformInstructions();
                        self.trackShare('clipboard');
                        console.log('[Social Sharing Simple] Image copied to clipboard');
                    }).catch(function(err) {
                        console.error('[Social Sharing Simple] Clipboard API failed:', err);
                        // Fallback: Open image in new tab for manual copying
                        self.openImageInNewTab(blob);
                    });
                } else {
                    // Fallback for browsers without clipboard.write
                    self.openImageInNewTab(blob);
                }
            }, 'image/png', 0.9);
        },

        copyToClipboard: function(text) {
            // Modern clipboard API with fallback
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).catch(function(err) {
                    console.error('[Social Sharing Simple] Clipboard write failed:', err);
                });
            } else {
                // Fallback for older browsers
                var textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('[Social Sharing Simple] Fallback copy failed:', err);
                }
                document.body.removeChild(textarea);
            }
        },

        showToast: function(message) {
            // Simple toast notification
            var toast = document.createElement('div');
            toast.className = 'pet-share-toast';
            toast.textContent = message;
            toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
                                  'background:rgba(0,0,0,0.8);color:white;padding:12px 24px;' +
                                  'border-radius:4px;z-index:9999;font-size:14px;';
            
            document.body.appendChild(toast);
            
            setTimeout(function() {
                toast.style.transition = 'opacity 0.3s';
                toast.style.opacity = '0';
                setTimeout(function() {
                    document.body.removeChild(toast);
                }, 300);
            }, 3000);
        },

        isMobile: function() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
        },

        openImageInNewTab: function(blob) {
            // Fallback: Open image in new tab for right-click copying
            var url = URL.createObjectURL(blob);
            var newTab = window.open(url, '_blank');
            
            if (newTab) {
                this.showToast('Image opened in new tab. Right-click to copy.');
                // Clean up blob URL after a delay
                setTimeout(function() {
                    URL.revokeObjectURL(url);
                }, 60000); // Keep for 1 minute
            } else {
                this.showToast('Please allow pop-ups to share the image.');
            }
            
            this.trackShare('new-tab');
        },

        showPlatformInstructions: function() {
            // Create simple instruction modal
            var modal = document.createElement('div');
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
            
            document.body.appendChild(modal);
            
            // Auto-remove after 5 seconds or on button click
            var removeModal = function() {
                if (modal && modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            };
            
            modal.querySelector('.close-btn').addEventListener('click', removeModal);
            setTimeout(removeModal, 5000);
        },

        trackShare: function(method) {
            // Simple analytics tracking
            if (window.gtag) {
                window.gtag('event', 'share', {
                    event_category: 'engagement',
                    event_label: method
                });
            }
            console.log('[Social Sharing Simple] Tracked share:', method);
        }
    };

    // Initialize on page load
    window.petSocialSharingSimple = new PetSocialSharingSimple();

})();