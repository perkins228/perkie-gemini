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

      // Listen for pet selection events
      document.addEventListener('pet:selected', function(e) {
        self.updateFormFields(e.detail);
        self.enableAddToCart(); // Enable button when pet selected
      });

      // Listen for pet removal events
      document.addEventListener('pet:removed', function(e) {
        self.clearFormFields();
        self.checkIfAnyPetsSelected(); // Check if button should be disabled
      });

      // Listen for returning customer events
      document.addEventListener('returning-customer:selected', function(e) {
        self.updateReturningCustomerFields(e.detail);
      });

      document.addEventListener('returning-customer:deselected', function(e) {
        self.clearReturningCustomerFields();
      });

      document.addEventListener('returning-customer:updated', function(e) {
        self.updateReturningCustomerFields(e.detail);
      });

      // Listen for font selection changes (fired by pet-font-selector.liquid)
      document.addEventListener('font:selected', function(e) {
        if (e.detail && e.detail.style) {
          self.updateFontStyleFields(e.detail.style);
        }
      });

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

    // Update hidden form fields with pet data
    updateFormFields: function(petData) {
      if (!petData) return;
      
      // Find all product forms
      var forms = document.querySelectorAll('form[action*="/cart/add"]');
      
      for (var i = 0; i < forms.length; i++) {
        var form = forms[i];
        var sectionId = this.getSectionId(form);
        
        // Create or update pet name field - accumulate multiple pets
        var petNameField = form.querySelector('[name="properties[_pet_name]"]');
        if (!petNameField) {
          petNameField = document.createElement('input');
          petNameField.type = 'hidden';
          petNameField.name = 'properties[_pet_name]';
          petNameField.id = 'pet-name-' + sectionId;
          form.appendChild(petNameField);
        }
        
        // Set pet names directly (selector now passes all names comma-separated)
        petNameField.value = petData.name || '';
        
        // Create or update font style field
        var fontStyleField = form.querySelector('[name="properties[_font_style]"]');
        if (!fontStyleField) {
          fontStyleField = document.createElement('input');
          fontStyleField.type = 'hidden';
          fontStyleField.name = 'properties[_font_style]';
          fontStyleField.id = 'font-style-' + sectionId;
          form.appendChild(fontStyleField);
        }
        // CRITICAL FIX: Only use localStorage if font selector was actually shown this session
        // This prevents stale localStorage values from overriding user selections
        var fontSelectorShown = sessionStorage.getItem('fontSelectorShown') === 'true';
        var productSupportsFonts = window.productSupportsFonts === true;
        var rawFontStyle;

        if (fontSelectorShown) {
          // Font selector was shown - use localStorage preference
          rawFontStyle = localStorage.getItem('selectedFontStyle') || 'classic';
          console.log('✅ Font selector was shown, using stored preference:', rawFontStyle);
        } else if (!productSupportsFonts) {
          // Product doesn't support fonts - explicitly set to "no-text"
          rawFontStyle = 'no-text';
          console.log('ℹ️ Product does not support fonts, using: no-text');
        } else {
          // Font selector not shown yet (Quick Upload initial state) - use safe default
          rawFontStyle = 'classic';
          console.log('⚠️ Font selector not shown yet, using default: classic');
        }

        var selectedFontStyle = validateFontStyle(rawFontStyle) ? rawFontStyle : 'classic';
        fontStyleField.value = selectedFontStyle;
        console.log('🎨 Font style set to:', selectedFontStyle);
        
        // Create or update processed image URL field
        var processedUrlField = form.querySelector('[name="properties[_processed_image_url]"]');
        if (!processedUrlField) {
          processedUrlField = document.createElement('input');
          processedUrlField.type = 'hidden';
          processedUrlField.name = 'properties[_processed_image_url]';
          processedUrlField.id = 'processed-url-' + sectionId;
          form.appendChild(processedUrlField);
        }
        // CRITICAL FIX: Prioritize GCS URL over compressed thumbnail
        if (petData.gcsUrl) {
          // Use full-resolution GCS URL if available
          processedUrlField.value = petData.gcsUrl;
          console.log('✅ Using GCS URL for processed image:', petData.gcsUrl);
        } else if (petData.processedImage) {
          // Fallback to compressed thumbnail if GCS upload hasn't completed
          processedUrlField.value = this.compressImageUrl(petData.processedImage);
          console.warn('⚠️ Using compressed thumbnail (GCS URL not available yet)');
        }

        // Create or update original image URL field (NEW)
        var originalUrlField = form.querySelector('[name="properties[_original_image_url]"]');
        if (!originalUrlField) {
          originalUrlField = document.createElement('input');
          originalUrlField.type = 'hidden';
          originalUrlField.name = 'properties[_original_image_url]';
          originalUrlField.id = 'original-url-' + sectionId;
          form.appendChild(originalUrlField);
        }
        if (petData.originalUrl) {
          originalUrlField.value = petData.originalUrl;
          console.log('✅ Using GCS URL for original image:', petData.originalUrl);
        }

        // Create or update artist notes field (NEW)
        var artistNotesField = form.querySelector('[name="properties[_artist_notes]"]');
        if (!artistNotesField) {
          artistNotesField = document.createElement('input');
          artistNotesField.type = 'hidden';
          artistNotesField.name = 'properties[_artist_notes]';
          artistNotesField.id = 'artist-notes-' + sectionId;
          form.appendChild(artistNotesField);
        }
        if (petData.artistNote) {
          artistNotesField.value = petData.artistNote;
          console.log('✅ Artist notes populated:', petData.artistNote);
        }
        
        // Create or update has custom pet flag
        var hasCustomPetField = form.querySelector('[name="properties[_has_custom_pet]"]');
        if (!hasCustomPetField) {
          hasCustomPetField = document.createElement('input');
          hasCustomPetField.type = 'hidden';
          hasCustomPetField.name = 'properties[_has_custom_pet]';
          hasCustomPetField.id = 'has-custom-pet-' + sectionId;
          form.appendChild(hasCustomPetField);
        }
        hasCustomPetField.value = 'true';
        
        // Create or update effect field
        var effectField = form.querySelector('[name="properties[_effect_applied]"]');
        if (!effectField) {
          effectField = document.createElement('input');
          effectField.type = 'hidden';
          effectField.name = 'properties[_effect_applied]';
          effectField.id = 'effect-applied-' + sectionId;
          form.appendChild(effectField);
        }
        if (petData.effect) {
          effectField.value = petData.effect;
        }
        
        // Store in localStorage for cart access
        this.storePetDataForCart(petData);
      }
    },

    // Clear form fields when no pets selected
    clearFormFields: function() {
      var forms = document.querySelectorAll('form[action*="/cart/add"]');

      for (var i = 0; i < forms.length; i++) {
        var form = forms[i];

        var hasCustomPetField = form.querySelector('[name="properties[_has_custom_pet]"]');
        if (hasCustomPetField) {
          hasCustomPetField.value = 'false';
        }

        var petNameField = form.querySelector('[name="properties[_pet_name]"]');
        if (petNameField) {
          petNameField.value = '';
        }
      }
    },

    // Update font style in all forms when user changes selection
    // This fixes the race condition where pet:selected creates fields with default "classic"
    // before user has chance to select their preferred font
    updateFontStyleFields: function(fontStyle) {
      if (!fontStyle) return;

      // Validate font style
      if (!validateFontStyle(fontStyle)) {
        console.warn('⚠️ Invalid font style provided:', fontStyle, '- defaulting to classic');
        fontStyle = 'classic';
      }

      var forms = document.querySelectorAll('form[action*="/cart/add"]');
      var updatedCount = 0;

      for (var i = 0; i < forms.length; i++) {
        var form = forms[i];
        var fontStyleField = form.querySelector('[name="properties[_font_style]"]');

        if (fontStyleField) {
          fontStyleField.value = fontStyle;
          updatedCount++;
        }
      }

      console.log('🔄 Updated font style in', updatedCount, 'form(s) to:', fontStyle);

      // Also update localStorage for consistency
      localStorage.setItem('selectedFontStyle', fontStyle);
    },

    // Update returning customer fields
    updateReturningCustomerFields: function(data) {
      if (!data) return;

      var forms = document.querySelectorAll('form[action*="/cart/add"]');

      for (var i = 0; i < forms.length; i++) {
        var form = forms[i];
        var sectionId = this.getSectionId(form);

        // Create or update order type field
        var orderTypeField = form.querySelector('[name="properties[_order_type]"]');
        if (!orderTypeField) {
          orderTypeField = document.createElement('input');
          orderTypeField.type = 'hidden';
          orderTypeField.name = 'properties[_order_type]';
          orderTypeField.id = 'order-type-' + sectionId;
          form.appendChild(orderTypeField);
        }
        orderTypeField.value = data.orderType || 'returning';

        // Create or update previous order number field
        var orderNumberField = form.querySelector('[name="properties[_previous_order_number]"]');
        if (!orderNumberField) {
          orderNumberField = document.createElement('input');
          orderNumberField.type = 'hidden';
          orderNumberField.name = 'properties[_previous_order_number]';
          orderNumberField.id = 'previous-order-number-' + sectionId;
          form.appendChild(orderNumberField);
        }
        orderNumberField.value = data.previousOrderNumber || '';

        // Create or update is repeat customer field
        var isRepeatField = form.querySelector('[name="properties[_is_repeat_customer]"]');
        if (!isRepeatField) {
          isRepeatField = document.createElement('input');
          isRepeatField.type = 'hidden';
          isRepeatField.name = 'properties[_is_repeat_customer]';
          isRepeatField.id = 'is-repeat-customer-' + sectionId;
          form.appendChild(isRepeatField);
        }
        isRepeatField.value = data.isReturning ? 'true' : 'false';

        console.log('✅ Updated returning customer fields:', {
          orderType: orderTypeField.value,
          previousOrderNumber: orderNumberField.value,
          isReturning: isRepeatField.value
        });
      }
    },

    // Clear returning customer fields
    clearReturningCustomerFields: function() {
      var forms = document.querySelectorAll('form[action*="/cart/add"]');

      for (var i = 0; i < forms.length; i++) {
        var form = forms[i];

        var orderTypeField = form.querySelector('[name="properties[_order_type]"]');
        if (orderTypeField) {
          orderTypeField.value = 'standard';
        }

        var orderNumberField = form.querySelector('[name="properties[_previous_order_number]"]');
        if (orderNumberField) {
          orderNumberField.value = '';
        }

        var isRepeatField = form.querySelector('[name="properties[_is_repeat_customer]"]');
        if (isRepeatField) {
          isRepeatField.value = 'false';
        }

        console.log('🗑️ Cleared returning customer fields');
      }
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

      var petSelector = document.querySelector('[data-max-pets]');
      if (!petSelector) return; // Not a custom product

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
        var self = this;
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
    },

    // NEW: Sanitize pet name input to prevent XSS
    sanitizePetName: function(name) {
      if (!name) return '';
      // Allow only letters, numbers, spaces, commas, hyphens, apostrophes
      return name.replace(/[^A-Za-z0-9, \-']/g, '').substring(0, 100);
    },

    // Disable Add to Cart button with instructional message
    disableAddToCart: function() {
      var buttons = document.querySelectorAll('form[action*="/cart/add"] button[name="add"]');
      var isMobile = window.innerWidth <= 750;

      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        btn.disabled = true;

        // Store original text if not already stored
        if (!btn.dataset.originalText) {
          btn.dataset.originalText = btn.textContent;
        }

        // Updated messaging for name-only flow
        if (isMobile) {
          btn.textContent = '👆 Enter pet name above';
        } else {
          btn.textContent = '↑ Enter pet name above';
        }

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