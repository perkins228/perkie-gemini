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

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
