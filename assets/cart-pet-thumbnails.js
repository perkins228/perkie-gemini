/**
 * Cart Pet Thumbnails - Below Media Implementation
 * Displays customer pet thumbnails below product images in cart
 * ES5 Compatible for older mobile browsers
 * Supports up to 3 pet thumbnails per product
 */

(function() {
  'use strict';

  var CartPetThumbnails = {
    // Initialize when DOM is ready
    init: function() {
      var self = this;
      
      // Wait for cart drawer to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          self.setup();
        });
      } else {
        self.setup();
      }
    },

    setup: function() {
      var self = this;
      
      // Update thumbnails on initial load
      self.updateAllThumbnails();
      
      // Listen for multiple cart update events for better compatibility
      document.addEventListener('cart:updated', function() {
        self.updateAllThumbnails();
      });
      
      document.addEventListener('cart:change', function() {
        self.updateAllThumbnails();
      });
      
      document.addEventListener('cart/update', function() {
        self.updateAllThumbnails();
      });
      
      // Listen for cart drawer open
      document.addEventListener('cart-drawer:opened', function() {
        self.updateAllThumbnails();
      });
      
      // Also listen for AJAX cart updates
      document.addEventListener('ajaxCart.afterCartLoad', function() {
        self.updateAllThumbnails();
      });
      
      // Fallback for Shopify cart drawer events
      var cartDrawer = document.querySelector('cart-drawer');
      if (cartDrawer) {
        // Observe when cart drawer opens
        var observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              if (cartDrawer.classList.contains('active') || cartDrawer.classList.contains('opened')) {
                self.updateAllThumbnails();
              }
            }
          });
        });
        
        observer.observe(cartDrawer, { attributes: true });
      }
    },

    // Update all cart item thumbnails
    updateAllThumbnails: function() {
      // Find all pet containers in the cart
      var petContainers = document.querySelectorAll('.cart-item__pets');
      var self = this;
      
      // Process each container
      for (var i = 0; i < petContainers.length; i++) {
        self.updatePetContainer(petContainers[i]);
      }
    },

    // Update a single pet container with thumbnails
    updatePetContainer: function(container) {
      var petNames = container.getAttribute('data-pet-names');
      if (!petNames) return;
      
      // Split pet names (comma-separated for multiple pets)
      var petNameArray = petNames.split(',').map(function(name) {
        return name.trim();
      }).filter(function(name) {
        return name.length > 0;
      });
      
      if (petNameArray.length === 0) return;
      
      // Get the thumbnail container
      var thumbnailContainer = container.querySelector('.pet-thumbnails-container');
      if (!thumbnailContainer) return;
      
      // Clear existing thumbnails
      thumbnailContainer.innerHTML = '';
      
      // Add each pet thumbnail
      var self = this;
      var petsAdded = 0;
      
      for (var i = 0; i < petNameArray.length && i < 3; i++) {
        var petData = self.getPetDataFromStorage(petNameArray[i]);
        if (petData && petData.thumbnail) {
          self.addPetThumbnail(thumbnailContainer, petData, i);
          petsAdded++;
        }
      }
      
      // Show container if we added pets
      if (petsAdded > 0) {
        container.style.display = 'block';
      }
    },

    // Add a single pet thumbnail to the container
    addPetThumbnail: function(container, petData, index) {
      var self = this;
      
      // Create thumbnail element
      var thumbnail = document.createElement('img');
      thumbnail.className = 'pet-thumbnail pet-thumbnail-' + index;
      thumbnail.setAttribute('data-pet-name', petData.name || '');
      
      // Set alt text for accessibility
      var altText = 'Pet: ' + (petData.name || 'Custom Pet');
      thumbnail.setAttribute('alt', altText);
      thumbnail.setAttribute('title', altText);

      // Check if pet has thumbnail (name-only orders won't have one)
      if (!petData.thumbnail || petData.thumbnail === '') {
        // Name-only order - use placeholder immediately
        thumbnail.src = 'https://cdn.shopify.com/s/files/1/0029/3057/3424/files/cart-pet-placeholder.png';
        thumbnail.classList.add('placeholder-image');
        thumbnail.alt = petData.name + ' (image pending)';
        container.appendChild(thumbnail);
        return;
      }

      // Create a new image to test loading
      var tempImg = new Image();

      tempImg.onload = function() {
        // Image loaded successfully, apply to thumbnail
        thumbnail.src = petData.thumbnail;
        
        // Add click handler for future enhancements
        thumbnail.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          self.handleThumbnailClick(petData);
        });
        
        // Add touch feedback for mobile
        thumbnail.addEventListener('touchstart', function() {
          thumbnail.classList.add('touch-active');
        }, { passive: true });
        
        thumbnail.addEventListener('touchend', function() {
          thumbnail.classList.remove('touch-active');
        }, { passive: true });
      };
      
      tempImg.onerror = function() {
        // Failed to load or no image (name-only order), show placeholder
        console.log('No pet thumbnail for:', petData.name, '- using placeholder');
        thumbnail.src = 'https://cdn.shopify.com/s/files/1/0029/3057/3424/files/cart-pet-placeholder.png';
        thumbnail.classList.add('placeholder-image');
        thumbnail.alt = petData.name + ' (image pending)';
      };
      
      // Append to container immediately (will show when image loads)
      container.appendChild(thumbnail);
      
      // Start loading the image
      tempImg.src = petData.thumbnail;
    },

    // Get pet data from localStorage
    getPetDataFromStorage: function(petName) {
      try {
        // Check cart pet data first
        var cartPets = localStorage.getItem('cartPetData');
        if (cartPets) {
          var cartData = JSON.parse(cartPets);
          if (cartData[petName]) {
            return cartData[petName];
          }
        }
        
        // Fallback: check for individual pet data
        var keys = Object.keys(localStorage);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          if (key.indexOf('perkie_pet_') === 0) {
            try {
              var petData = JSON.parse(localStorage.getItem(key));
              if (petData && petData.name === petName) {
                return {
                  name: petData.name,
                  thumbnail: petData.processedImage || petData.thumbnail,
                  effect: petData.effect || 'original'
                };
              }
            } catch (e) {
              // Skip invalid entries
            }
          }
        }
      } catch (e) {
        console.warn('Error reading pet data:', e);
      }
      
      return null;
    },

    // Handle thumbnail click (for future enhancements)
    handleThumbnailClick: function(petData) {
      // Could open a modal or show full-size image
      console.log('Pet thumbnail clicked:', petData.name);
      
      // Visual feedback
      var event = new CustomEvent('pet:thumbnail:clicked', {
        detail: petData
      });
      document.dispatchEvent(event);
    },

    // Helper: Check if mobile device
    isMobile: function() {
      return window.innerWidth <= 768 || 'ontouchstart' in window;
    },

    // Public method to manually refresh thumbnails
    refresh: function() {
      this.updateAllThumbnails();
    }
  };

  // Initialize when ready
  CartPetThumbnails.init();

  // Expose to global for debugging and manual refresh
  window.CartPetThumbnails = CartPetThumbnails;

})();