/**
 * Cart Pet Integration - Connects Pet Processor with Cart System
 * Populates hidden form fields when pets are selected
 * Dispatches cart events for thumbnail updates
 * ES5 Compatible
 */

(function() {
  'use strict';

  // Font style validation function
  function validateFontStyle(fontStyle) {
    var allowedFonts = ['preppy', 'classic', 'playful', 'elegant', 'trend', 'no-text'];
    
    // Type check - must be string
    if (typeof fontStyle !== 'string') {
      return false;
    }
    
    // Length check - reasonable limit
    if (fontStyle.length > 20) {
      return false;
    }
    
    // Allowed values check
    if (allowedFonts.indexOf(fontStyle) === -1) {
      return false;
    }
    
    return true;
  }

  var CartPetIntegration = {
    init: function() {
      var self = this;

      // Initialize button state for custom products
      this.initializeButtonState();

      // Listen for add to cart
      this.interceptAddToCart();

      // Dispatch cart events when drawer opens
      this.setupCartDrawerEvents();
    },

    // Check if product is an add-on (has "add-on" tag)
    isAddonProduct: function() {
      // Check if we're on a product page
      var productContainer = document.querySelector('[data-product-id]');
      if (!productContainer) return false;

      // Check for add-on meta tag in page (set by Liquid template based on product.tags)
      var addonMeta = document.querySelector('meta[name="product-is-addon"]');
      if (addonMeta && addonMeta.content === 'true') return true;

      // Fallback: Check if product title or description contains add-on indicators
      var productTitle = document.querySelector('.product__title');
      if (productTitle) {
        var titleText = productTitle.textContent.toLowerCase();
        if (titleText.indexOf('add-on') > -1 || titleText.indexOf('addon') > -1) {
          return true;
        }
      }

      return false;
    },

    // Validate add-on product purchase (requires standard product in cart)
    validateAddonProduct: function(form, callback) {
      var self = this;

      // Check if current product is an add-on
      if (!this.isAddonProduct()) {
        callback(true); // Not an add-on, allow purchase
        return;
      }

      console.log('🔍 Add-on product detected - checking cart for standard products...');

      // Fetch current cart contents
      fetch('/cart.js')
        .then(function(response) {
          return response.json();
        })
        .then(function(cart) {
          // Check if cart has any items
          if (!cart.items || cart.items.length === 0) {
            console.log('❌ Cart is empty - cannot add add-on product alone');
            self.showAddonError(form, 'This is an add-on item. Please add a standard pet product to your cart first.');
            callback(false);
            return;
          }

          // Check if cart has at least one non-add-on (standard) product
          var hasStandardProduct = false;
          for (var i = 0; i < cart.items.length; i++) {
            var item = cart.items[i];
            // Check product title for add-on indicators
            var itemTitle = item.product_title ? item.product_title.toLowerCase() : '';
            var isAddon = itemTitle.indexOf('add-on') > -1 || itemTitle.indexOf('addon') > -1;

            if (!isAddon) {
              hasStandardProduct = true;
              break;
            }
          }

          if (!hasStandardProduct) {
            console.log('❌ Cart only contains add-ons - need standard product first');
            self.showAddonError(form, 'This is an add-on item. Please add a standard pet product to your cart first.');
            callback(false);
            return;
          }

          // Cart has standard product - allow add-on purchase
          console.log('✅ Standard product found in cart - allowing add-on purchase');
          self.hideAddonError(form);
          callback(true);
        })
        .catch(function(error) {
          console.error('❌ Error checking cart:', error);
          // On error, allow purchase (fail open to avoid blocking customers)
          callback(true);
        });
    },

    // Show alert for add-on validation error
    showAddonError: function(form, message) {
      alert(message);
    },

    // Hide/clear add-on error (no-op for alert-based validation)
    hideAddonError: function(form) {
      // No action needed for alert-based validation
    },

    // Initialize button state on page load for custom products
    // UPDATED: Now supports pet name-only orders (Scenario 2 & 3)
    initializeButtonState: function() {
      // Skip validation on cart and checkout pages
      var isCartPage = window.location.pathname.indexOf('/cart') > -1 ||
                       window.location.pathname.indexOf('/checkout') > -1 ||
                       document.querySelector('.cart-items') !== null ||
                       document.querySelector('[data-cart-page]') !== null;

      if (isCartPage) {
        console.log('Cart page detected - skipping pet name validation');
        return; // Exit early - don't disable add-to-cart on cart pages
      }

      // Check for NEW pet selector (ks-product-pet-selector-stitch.liquid)
      var newPetSelector = document.querySelector('.pet-selector-stitch');
      var petSelector = newPetSelector || document.querySelector('[data-max-pets]');

      if (!petSelector) return; // Not a custom product

      var self = this;

      // NEW SELECTOR: Comprehensive validation for all required fields
      if (newPetSelector) {
        // Initial validation check
        self.validateAndUpdateButton();

        // Listen for pet count changes
        var petCountRadios = newPetSelector.querySelectorAll('[data-pet-count-radio]');
        for (var i = 0; i < petCountRadios.length; i++) {
          petCountRadios[i].addEventListener('change', function() {
            self.validateAndUpdateButton();
          });
        }

        // Listen for pet name input changes
        var petNameInputs = newPetSelector.querySelectorAll('[data-pet-name-input]');
        for (var j = 0; j < petNameInputs.length; j++) {
          (function(input) {
            input.addEventListener('input', function() {
              var sanitized = self.sanitizePetName(input.value);
              input.value = sanitized;
              self.validateAndUpdateButton();
            });
          })(petNameInputs[j]);
        }

        // Listen for style selection changes
        var styleRadios = newPetSelector.querySelectorAll('[data-style-radio]');
        for (var k = 0; k < styleRadios.length; k++) {
          styleRadios[k].addEventListener('change', function() {
            self.validateAndUpdateButton();
          });
        }

        // Listen for font selection changes
        var fontRadios = newPetSelector.querySelectorAll('[data-font-radio]');
        for (var l = 0; l < fontRadios.length; l++) {
          fontRadios[l].addEventListener('change', function() {
            self.validateAndUpdateButton();
          });
        }
      }
      // OLD SELECTOR: Legacy support for ks-product-pet-selector.liquid
      else {
        var petNameInput = document.querySelector('[name="properties[_pet_name]"]');
        var hasCustomPetField = document.querySelector('[name="properties[_has_custom_pet]"]');

        // Check if we have either pet image OR pet name
        var hasPetImage = hasCustomPetField && hasCustomPetField.value === 'true';
        var hasPetName = petNameInput && petNameInput.value.trim() !== '';

        if (hasPetImage || hasPetName) {
          this.enableAddToCart();
        } else {
          this.disableAddToCart();
        }

        // Listen for pet name input changes
        if (petNameInput) {
          petNameInput.addEventListener('input', function() {
            var sanitized = self.sanitizePetName(petNameInput.value);
            petNameInput.value = sanitized;

            if (sanitized.trim() !== '') {
              self.enableAddToCart();
            } else {
              self.disableAddToCart();
            }
          });
        }
      }
    },

    // NEW: Sanitize pet name input to prevent XSS
    sanitizePetName: function(name) {
      if (!name) return '';
      // Allow only letters, numbers, spaces, commas, hyphens, apostrophes
      return name.replace(/[^A-Za-z0-9, \-']/g, '').substring(0, 100);
    },

    // NEW: Validate all required fields and update button state
    validateAndUpdateButton: function() {
      var validation = this.validateCustomization();

      if (validation.isValid) {
        this.enableAddToCart();
      } else {
        this.disableAddToCart({
          missingCount: validation.missingFields.length,
          missingFields: validation.missingFields,
          isMobile: window.innerWidth <= 750
        });
      }
    },

    // NEW: Comprehensive validation of all customization fields
    validateCustomization: function() {
      var newPetSelector = document.querySelector('.pet-selector-stitch');
      if (!newPetSelector) {
        return { isValid: true, missingFields: [] };
      }

      var missingFields = [];

      // 1. Validate pet count selection
      var petCountRadio = newPetSelector.querySelector('[data-pet-count-radio]:checked');
      if (!petCountRadio) {
        missingFields.push('pet count');
      }

      // 2. Validate pet name(s) - check if ANY pet name is filled
      var petNameInputs = newPetSelector.querySelectorAll('[data-pet-name-input]');
      var hasAnyPetName = false;
      for (var i = 0; i < petNameInputs.length; i++) {
        // Only check visible inputs (based on pet count)
        var petDetail = petNameInputs[i].closest('.pet-detail');
        if (petDetail && petDetail.style.display !== 'none') {
          if (petNameInputs[i].value.trim() !== '') {
            hasAnyPetName = true;
            break;
          }
        }
      }
      if (!hasAnyPetName) {
        missingFields.push('pet name');
      }

      // 3. Validate style selection
      var styleRadio = newPetSelector.querySelector('[data-style-radio]:checked');
      if (!styleRadio) {
        missingFields.push('style');
      }

      // 4. Validate font selection (conditional - only for products that support fonts)
      // Font section only renders when product.metafields.custom.supports_font_styles == true
      // Check if font radios exist in DOM (indicates text product supports fonts)
      var fontRadios = newPetSelector.querySelectorAll('[data-font-radio]');
      if (fontRadios.length > 0) {
        // Font section exists - validate that one is selected
        var fontRadio = newPetSelector.querySelector('[data-font-radio]:checked');
        if (!fontRadio) {
          missingFields.push('font');
        }
      }
      // If fontRadios.length === 0, this is a non-text product - skip font validation

      return {
        isValid: missingFields.length === 0,
        missingFields: missingFields
      };
    },

    // Disable Add to Cart button with instructional message
    // UPDATED: Now supports detailed missing field messages
    disableAddToCart: function(options) {
      var buttons = document.querySelectorAll('form[action*="/cart/add"] button[name="add"]');
      options = options || {};
      var missingCount = options.missingCount || 1;
      var isMobile = options.isMobile !== undefined ? options.isMobile : window.innerWidth <= 750;

      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        btn.disabled = true;

        // Store original text if not already stored
        if (!btn.dataset.originalText) {
          btn.dataset.originalText = btn.textContent;
        }

        // Progressive messaging based on completion state
        var buttonText;
        if (missingCount === 1) {
          // One step away - provide specific guidance based on what's missing
          var missingField = options.missingFields && options.missingFields[0];

          if (missingField === 'font') {
            buttonText = isMobile ? '👉 1 step left' : '👉 Select font to complete';
          } else if (missingField === 'style') {
            buttonText = isMobile ? '👉 1 step left' : '👉 Select style to complete';
          } else if (missingField === 'pet name') {
            buttonText = isMobile ? '👉 1 step left' : '👉 Add pet name to complete';
          } else if (missingField === 'pet count') {
            buttonText = isMobile ? '👉 1 step left' : '👉 Select number of pets';
          } else {
            // Generic fallback
            buttonText = isMobile ? '👉 1 step left' : '👉 Complete your selection';
          }
        } else if (missingCount === 2) {
          // Two steps remaining
          buttonText = isMobile ? '↑ 2 steps' : '2 more steps to add to cart';
        } else if (missingCount === 3) {
          // Three steps remaining
          buttonText = isMobile ? '↑ 3 steps' : '3 more steps to add to cart';
        } else if (missingCount >= 4) {
          // All steps remaining
          buttonText = isMobile ? '↑ Complete above' : '↑ Complete customization above';
        } else {
          // Fallback (legacy)
          buttonText = isMobile ? '👆 Enter pet name above' : '↑ Enter pet name above';
        }

        btn.textContent = buttonText;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';
      }
    },

    // Enable Add to Cart button with pulse animation
    enableAddToCart: function() {
      var buttons = document.querySelectorAll('form[action*="/cart/add"] button[name="add"]');

      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        btn.disabled = false;

        // Restore original text
        if (btn.dataset.originalText) {
          btn.textContent = btn.dataset.originalText;
        } else {
          btn.textContent = 'Add to Cart';
        }

        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';

        // Add pulse animation class
        btn.classList.add('pet-selected-pulse');

        // Remove animation class after completion
        setTimeout(function() {
          btn.classList.remove('pet-selected-pulse');
        }, 600);
      }
    },

    // Check if any pets are selected
    checkIfAnyPetsSelected: function() {
      var hasCustomPetField = document.querySelector('[name="properties[_has_custom_pet]"]');

      if (!hasCustomPetField || hasCustomPetField.value !== 'true') {
        this.disableAddToCart();
      }
    },

    // Store pet data in localStorage for cart access with quota handling
    storePetDataForCart: function(petData) {
      try {
        var MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
        var now = Date.now();
        var cartPets = localStorage.getItem('cartPetData') || '{}';
        var pets = JSON.parse(cartPets);
        
        // Clean old entries first to prevent quota issues
        for (var key in pets) {
          if (pets.hasOwnProperty(key) && (now - pets[key].timestamp > MAX_AGE)) {
            delete pets[key];
          }
        }
        
        // Store multiple pets if pets array exists, otherwise single pet
        if (petData.pets && petData.pets.length > 0) {
          // Multiple pets - store each one
          for (var i = 0; i < petData.pets.length; i++) {
            var pet = petData.pets[i];
            pets[pet.name] = {
              name: pet.name,
              thumbnail: this.compressImageUrl(pet.processedImage || pet.originalImage),
              effect: pet.effect || 'original',
              timestamp: now
            };
          }
        } else {
          // Single pet - backward compatibility
          pets[petData.name] = {
            name: petData.name,
            thumbnail: this.compressImageUrl(petData.processedImage || petData.originalImage),
            effect: petData.effect || 'original',
            timestamp: now
          };
        }
        
        try {
          localStorage.setItem('cartPetData', JSON.stringify(pets));
        } catch (quotaError) {
          // Handle quota exceeded error
          if (quotaError.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, clearing old pet data');
            // Clear oldest entries and retry
            this.clearOldPetData();
            localStorage.setItem('cartPetData', JSON.stringify(pets));
          } else {
            throw quotaError;
          }
        }
      } catch (e) {
        console.warn('Failed to store pet data for cart:', e);
      }
    },
    
    // Clear old pet data when quota exceeded
    clearOldPetData: function() {
      try {
        var cartPets = localStorage.getItem('cartPetData') || '{}';
        var pets = JSON.parse(cartPets);
        var entries = [];
        
        // Convert to array for sorting
        for (var key in pets) {
          if (pets.hasOwnProperty(key)) {
            entries.push(pets[key]);
          }
        }
        
        // Sort by timestamp and keep only newest 5
        entries.sort(function(a, b) {
          return (b.timestamp || 0) - (a.timestamp || 0);
        });
        
        var newPets = {};
        for (var i = 0; i < Math.min(5, entries.length); i++) {
          newPets[entries[i].name] = entries[i];
        }
        
        localStorage.setItem('cartPetData', JSON.stringify(newPets));
      } catch (e) {
        // Last resort - clear everything
        localStorage.removeItem('cartPetData');
      }
    },

    // Store image URL directly - no legacy compression needed
    compressImageUrl: function(imageUrl) {
      return imageUrl || '';
    },

    // Get section ID from form - simplified for new build with guards
    getSectionId: function(form) {
      // Guard against null/undefined form
      if (!form) {
        console.warn('CartPetIntegration: getSectionId called with null form');
        return 'main';
      }
      // Simple return for new build - no complex parsing needed
      return 'main';
    },

    // Intercept add to cart to ensure pet data is included
    interceptAddToCart: function() {
      var self = this;

      // Listen for form submissions
      document.addEventListener('submit', function(e) {
        var form = e.target;
        if (form.action && form.action.indexOf('/cart/add') > -1) {
          // VALIDATION 0: Re-validate customization fields before submission
          // This prevents bypass if button state becomes stale
          var newPetSelector = document.querySelector('.pet-selector-stitch');
          if (newPetSelector) {
            var validation = self.validateCustomization();
            if (!validation.isValid) {
              e.preventDefault();
              e.stopPropagation();

              // Show user-friendly error message
              var missingFieldsText = validation.missingFields.join(', ');
              alert('Please complete all required fields before adding to cart.\n\nMissing: ' + missingFieldsText);

              // Update button state to reflect validation
              self.disableAddToCart({
                missingCount: validation.missingFields.length,
                missingFields: validation.missingFields,
                isMobile: window.innerWidth <= 750
              });

              console.log('❌ Form submission blocked: Missing required fields -', missingFieldsText);
              return false;
            }
          }

          // VALIDATION 1: Check returning customer has order number
          var orderTypeField = form.querySelector('[name="properties[_order_type]"]');
          var orderNumberField = form.querySelector('[name="properties[_previous_order_number]"]');

          if (orderTypeField && orderTypeField.value === 'returning') {
            if (!orderNumberField || !orderNumberField.value || orderNumberField.value.trim() === '') {
              e.preventDefault();
              e.stopPropagation();
              alert('Please enter your previous order number to use an existing Perkie Print.');

              // Focus the order number input if it exists in the visible form
              var visibleOrderInput = document.querySelector('[id^="previous-order-"]');
              if (visibleOrderInput) {
                visibleOrderInput.focus();
                visibleOrderInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }

              console.log('❌ Form submission blocked: Returning customer missing order number');
              return false;
            }
          }

          // VALIDATION 2: Check if add-on product requires standard product in cart
          // Skip if already validated (to avoid infinite loop on re-submission)
          if (form.getAttribute('data-addon-validated') !== 'true' && self.isAddonProduct()) {
            // Prevent default submission
            e.preventDefault();
            e.stopPropagation();

            // Validate add-on product
            self.validateAddonProduct(form, function(isValid) {
              if (isValid) {
                // Valid - mark as validated and re-submit
                console.log('✅ Add-on validation passed - submitting form');

                // Mark form as validated to avoid infinite loop
                form.setAttribute('data-addon-validated', 'true');

                // Re-trigger form submission (will skip this validation block)
                var submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                form.dispatchEvent(submitEvent);

                // Clear validation flag after a delay to allow re-validation on next attempt
                setTimeout(function() {
                  form.removeAttribute('data-addon-validated');
                }, 2000);
              } else {
                console.log('❌ Add-on validation failed - form submission blocked');
                // Error message already shown by validateAddonProduct

                // Re-enable submit button (it was disabled by product-form.js)
                var submitButton = form.querySelector('[type="submit"]');
                if (submitButton) {
                  submitButton.removeAttribute('aria-disabled');
                  submitButton.classList.remove('loading');
                  var spinner = form.querySelector('.loading__spinner');
                  if (spinner) spinner.classList.add('hidden');
                }
              }
            });

            return false;
          }

          // Dispatch cart update event with better timing
          setTimeout(function() {
            self.dispatchCartUpdateEvent();
          }, 300);

          // Additional retry after longer delay for slower connections
          setTimeout(function() {
            self.updateThumbnailsWithRetry();
          }, 1000);
        }
      }, true);
    },

    // Setup cart drawer events
    setupCartDrawerEvents: function() {
      var self = this;
      
      // Watch for drawer open
      var cartDrawer = document.querySelector('cart-drawer');
      if (cartDrawer) {
        // Create observer for drawer state changes
        var observer = new MutationObserver(function(mutations) {
          for (var i = 0; i < mutations.length; i++) {
            var mutation = mutations[i];
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              if (cartDrawer.classList.contains('active') || 
                  cartDrawer.classList.contains('animate')) {
                self.dispatchCartDrawerOpenEvent();
              }
            }
          }
        });
        
        observer.observe(cartDrawer, { 
          attributes: true,
          attributeFilter: ['class']
        });
      }
      
      // Also listen for cart drawer toggle button clicks
      var cartButtons = document.querySelectorAll('[id*="cart-icon-bubble"], .header__icon--cart');
      for (var i = 0; i < cartButtons.length; i++) {
        cartButtons[i].addEventListener('click', function() {
          setTimeout(function() {
            self.dispatchCartDrawerOpenEvent();
          }, 100);
        });
      }
    },

    // Dispatch cart update event with retry mechanism
    dispatchCartUpdateEvent: function() {
      var event = document.createEvent('CustomEvent');
      event.initCustomEvent('cart:updated', true, true, {});
      document.dispatchEvent(event);
      
      // Also dispatch alternative events for better compatibility
      var altEvent1 = document.createEvent('CustomEvent');
      altEvent1.initCustomEvent('cart:change', true, true, {});
      document.dispatchEvent(altEvent1);
      
      // Retry mechanism to ensure thumbnails update
      this.updateThumbnailsWithRetry();
    },
    
    // Update thumbnails with retry mechanism for DOM readiness
    updateThumbnailsWithRetry: function() {
      var attempts = 0;
      var maxAttempts = 10;
      var self = this;
      
      function tryUpdate() {
        attempts++;
        
        // Check if pet containers exist in DOM
        var petContainers = document.querySelectorAll('.cart-item__pets');
        var cartItems = document.querySelectorAll('.cart-item');
        
        if ((petContainers.length > 0 || cartItems.length > 0) || attempts >= maxAttempts) {
          // DOM is ready or we've hit max attempts
          if (window.CartPetThumbnails && window.CartPetThumbnails.refresh) {
            window.CartPetThumbnails.refresh();
          }
          
          // If still no containers but we have cart items, wait a bit more
          if (petContainers.length === 0 && cartItems.length > 0 && attempts < maxAttempts) {
            setTimeout(tryUpdate, 200);
          }
        } else {
          // Retry after short delay
          setTimeout(tryUpdate, 150);
        }
      }
      
      // Start checking after initial delay
      setTimeout(tryUpdate, 100);
    },

    // Dispatch cart drawer open event
    dispatchCartDrawerOpenEvent: function() {
      var event = document.createEvent('CustomEvent');
      event.initCustomEvent('cart-drawer:opened', true, true, {});
      document.dispatchEvent(event);
    },
    
    // Verify integration is working properly
    verifyIntegration: function() {
      try {
        // Test localStorage availability
        var testKey = 'cartPetIntegrationTest';
        var testData = { test: true, timestamp: Date.now() };
        localStorage.setItem(testKey, JSON.stringify(testData));
        var retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        
        if (!retrieved) {
          console.error('CartPetIntegration: localStorage test failed');
          return false;
        }
        
        // Verify event listeners are attached
        var forms = document.querySelectorAll('form[action*="/cart/add"]');
        if (forms.length === 0) {
          console.warn('CartPetIntegration: No product forms found');
          return false;
        }
        
        console.log('CartPetIntegration: Verification passed');
        return true;
      } catch (e) {
        console.error('CartPetIntegration: Verification failed:', e);
        return false;
      }
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      CartPetIntegration.init();
    });
  } else {
    CartPetIntegration.init();
  }

  // Expose for debugging
  window.CartPetIntegration = CartPetIntegration;
  
  // Emergency reset function for troubleshooting
  window.emergencyResetCartPets = function() {
    try {
      localStorage.removeItem('cartPetData');
      console.log('Cart pet data cleared. Reloading page...');
      location.reload();
    } catch (e) {
      console.error('Failed to reset cart pets:', e);
    }
  };

})();