if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        const spinner = this.querySelector('.loading__spinner');
        if (spinner) spinner.classList.remove('hidden');

        // CRITICAL FIX: Use setTimeout(0) to let other submit handlers run first
        // This ensures quick-upload-handler.js moves files into form BEFORE we create FormData
        const self = this;
        setTimeout(function() {
          const config = fetchConfig('javascript');
          config.headers['X-Requested-With'] = 'XMLHttpRequest';
          delete config.headers['Content-Type'];

          // Check for file inputs in form DOM to detect file uploads
          const fileInputs = self.form.querySelectorAll('input[type="file"]');
          let hasFiles = false;

          for (let i = 0; i < fileInputs.length; i++) {
            if (fileInputs[i].files && fileInputs[i].files.length > 0) {
              hasFiles = true;
              break;
            }
          }

          // Override Accept header for file uploads (Shopify requires application/json for files)
          if (hasFiles) {
            config.headers['Accept'] = 'application/json';
          }

          const formData = new FormData(self.form);
          if (self.cart) {
            formData.append(
              'sections',
              self.cart.getSectionsToRender().map((section) => section.id)
            );
            formData.append('sections_url', window.location.pathname);
            self.cart.setActiveElement(document.activeElement);
          }
          config.body = formData;

          fetch(`${routes.cart_add_url}`, config)
            .then((response) => response.json())
            .then((response) => {
              if (response.status) {
                publish(PUB_SUB_EVENTS.cartError, {
                  source: 'product-form',
                  productVariantId: formData.get('id'),
                  errors: response.errors || response.description,
                  message: response.message,
                });
                self.handleErrorMessage(response.description);

                const soldOutMessage = self.submitButton.querySelector('.sold-out-message');
                if (!soldOutMessage) return;
                self.submitButton.setAttribute('aria-disabled', true);
                self.submitButtonText.classList.add('hidden');
                soldOutMessage.classList.remove('hidden');
                self.error = true;
                return;
              } else if (!self.cart) {
                window.location = window.routes.cart_url;
                return;
              }

              const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
              if (!self.error)
                publish(PUB_SUB_EVENTS.cartUpdate, {
                  source: 'product-form',
                  productVariantId: formData.get('id'),
                  cartData: response,
                }).then(() => {
                  CartPerformance.measureFromMarker('add:wait-for-subscribers', startMarker);

                  // LAYER 1: Save customization + clear pet property fields after cart success
                  // This prevents carryover to next product while preserving processor bridge
                  self.savePetCustomization();  // Phase 2: Save for restoration
                  self.clearPetPropertyFields(); // Phase 1: Clear form fields
                  self.clearProcessedPets();     // Phase 1: Clear processed pet data
                });
              self.error = false;
              const quickAddModal = self.closest('quick-add-modal');
              if (quickAddModal) {
                document.body.addEventListener(
                  'modalClosed',
                  () => {
                    setTimeout(() => {
                      CartPerformance.measure("add:paint-updated-sections", () => {
                        self.cart.renderContents(response);
                      });
                    });
                  },
                  { once: true }
                );
                quickAddModal.hide(true);
              } else {
                CartPerformance.measure("add:paint-updated-sections", () => {
                  self.cart.renderContents(response);
                });
              }
            })
            .catch((e) => {
              console.error(e);
            })
            .finally(() => {
              self.submitButton.classList.remove('loading');
              if (self.cart && self.cart.classList.contains('is-empty')) self.cart.classList.remove('is-empty');
              if (!self.error) self.submitButton.removeAttribute('aria-disabled');
              const spinner = self.querySelector('.loading__spinner');
              if (spinner) spinner.classList.add('hidden');

              CartPerformance.measureFromEvent("add:user-action", evt);
            });
        }, 0); // End setTimeout - delay by one tick to let other handlers run
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      /**
       * Get current product ID from page
       * @returns {number|null} Product ID
       */
      getProductId() {
        // Try window.productId first (set by Shopify themes)
        if (window.productId) {
          return parseInt(window.productId, 10);
        }

        // Try data attribute on form
        if (this.form && this.form.dataset.productId) {
          return parseInt(this.form.dataset.productId, 10);
        }

        // Try hidden input
        var productIdInput = this.form.querySelector('[name="product-id"]');
        if (productIdInput) {
          return parseInt(productIdInput.value, 10);
        }

        return null;
      }

      /**
       * Get pet session key from form fields
       * @returns {string|null} Session key
       */
      getPetSessionKey() {
        var sessionKeyInput = this.form.querySelector('[name="properties[_pet_1_session_key]"]');
        return sessionKeyInput ? sessionKeyInput.value : null;
      }

      /**
       * Get artist notes from form
       * @returns {string} Artist notes
       */
      getArtistNotes() {
        var notesInput = this.form.querySelector('[name="properties[_pet_1_artist_notes]"]');
        return notesInput ? notesInput.value : '';
      }

      /**
       * Get selected effect from form
       * @returns {string} Selected effect name
       */
      getSelectedEffect() {
        var effectInput = this.form.querySelector('[name="properties[_pet_1_selected_effect]"]');
        return effectInput ? effectInput.value : '';
      }

      /**
       * Get processed image URL from form
       * @returns {string} Processed image URL
       */
      getProcessedUrl() {
        var urlInput = this.form.querySelector('[name="properties[_pet_1_processed_image_url]"]');
        return urlInput ? urlInput.value : '';
      }

      /**
       * PHASE 2: Save pet customization for product-scoped restoration
       * This allows customers to return to same product and see their work
       */
      savePetCustomization() {
        try {
          var productId = this.getProductId();
          if (!productId) {
            console.log('ℹ️ [PetProps] No product ID, skipping customization save');
            return;
          }

          var sessionKey = this.getPetSessionKey();
          if (!sessionKey) {
            console.log('ℹ️ [PetProps] No pet session key, skipping customization save');
            return;
          }

          var customization = {
            sessionKey: sessionKey,
            artistNotes: this.getArtistNotes(),
            selectedEffect: this.getSelectedEffect(),
            processedImageUrl: this.getProcessedUrl(),
            timestamp: Date.now(),
            productId: productId
          };

          var storageKey = 'petCustomization_product_' + productId;
          localStorage.setItem(storageKey, JSON.stringify(customization));

          console.log('💾 [PetProps] Saved customization for product', productId, customization);

        } catch (e) {
          console.warn('⚠️ [PetProps] Failed to save customization:', e);
        }
      }

      /**
       * PHASE 1: Clear pet property fields after cart success
       * This prevents carryover to next product
       * Uses centralized PetPropertyUtils for consistency
       */
      clearPetPropertyFields() {
        if (!window.PetPropertyUtils) {
          console.warn('⚠️ [PetProps] PetPropertyUtils not loaded, cannot clear fields');
          return;
        }

        return window.PetPropertyUtils.clearFieldsWithTelemetry(this.form, 'cart_success');
      }

      /**
       * Clear processed pet data from localStorage after cart success
       * This prevents processed pets from being reused for different products
       */
      clearProcessedPets() {
        try {
          // Get all localStorage keys
          var keysToRemove = [];
          for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            // Match perkie_pet_pet_* keys (processed pets from processor)
            if (key && key.indexOf('perkie_pet_pet_') === 0) {
              keysToRemove.push(key);
            }
          }

          // Remove processed pets
          for (var j = 0; j < keysToRemove.length; j++) {
            localStorage.removeItem(keysToRemove[j]);
          }

          if (keysToRemove.length > 0) {
            console.log('🗑️ [PetProps] Cleared ' + keysToRemove.length + ' processed pet(s) after cart success');
          }

        } catch (e) {
          console.warn('⚠️ [PetProps] Failed to clear processed pets:', e);
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
