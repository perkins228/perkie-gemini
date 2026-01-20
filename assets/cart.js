class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener("click", (event) => {
      event.preventDefault();

      // Block removal for pet fee items
      if (this.dataset.isFee === "true") {
        event.stopImmediatePropagation();
        this.showFeeRemovalNotice();
        return;
      }

      const cartItems =
        this.closest("cart-items") || this.closest("cart-drawer-items");
      cartItems.updateQuantity(this.dataset.index, 0, event);
    });
  }

  showFeeRemovalNotice() {
    // Show non-intrusive toast notification
    const notice = document.createElement('div');
    notice.className = 'fee-removal-notice';
    notice.textContent = 'This fee is automatically removed when you remove the linked product.';
    notice.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 20px;border-radius:8px;z-index:9999;font-size:14px;max-width:90%;text-align:center;';
    document.body.appendChild(notice);
    setTimeout(() => {
      notice.style.opacity = '0';
      notice.style.transition = 'opacity 0.3s';
      setTimeout(() => notice.remove(), 300);
    }, 3000);
  }
}

customElements.define("cart-remove-button", CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById("shopping-cart-line-item-status") ||
      document.getElementById("CartDrawer-LineItemStatus");

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener("change", debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(
      PUB_SUB_EVENTS.cartUpdate,
      (event) => {
        if (event.source === "cart-items") {
          return;
        }
        // Pass event to onCartUpdate so it can use pre-fetched cart data if available
        return this.onCartUpdate(event);
      }
    );
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute("value");
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    // KondaSoft
    if (!event.target.closest("quantity-popover")) return;
    // END:KondaSoft

    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = "";

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace(
        "[min]",
        event.target.dataset.min
      );
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace(
        "[max]",
        event.target.max
      );
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace(
        "[step]",
        event.target.step
      );
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity("");
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute("name"),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate(event) {
    if (this.tagName === "CART-DRAWER-ITEMS") {
      // FIX: Use pre-fetched cart data from event if available (prevents stale data race)
      // The /cart/add.js response includes fresh section HTML - use it directly
      const prefetchedHtml = event?.cartData?.sections?.['cart-drawer'];

      // DEBUG: Log what we received
      console.log('🛒 [CartDebug] onCartUpdate called');
      console.log('🛒 [CartDebug] event:', event);
      console.log('🛒 [CartDebug] event?.cartData:', event?.cartData);
      console.log('🛒 [CartDebug] event?.cartData?.sections:', event?.cartData?.sections);
      console.log('🛒 [CartDebug] prefetchedHtml exists:', !!prefetchedHtml);
      if (prefetchedHtml) {
        console.log('🛒 [CartDebug] prefetchedHtml length:', prefetchedHtml.length);
        console.log('🛒 [CartDebug] prefetchedHtml preview:', prefetchedHtml.substring(0, 500));
      }

      if (prefetchedHtml) {
        // Use fresh data from the cart add response - no additional fetch needed
        const html = new DOMParser().parseFromString(prefetchedHtml, "text/html");

        // DEBUG: Check what elements exist in parsed HTML
        console.log('🛒 [CartDebug] Parsed HTML document:', html);
        console.log('🛒 [CartDebug] Found cart-drawer-items in response:', !!html.querySelector('cart-drawer-items'));
        console.log('🛒 [CartDebug] Found .cart-drawer__footer in response:', !!html.querySelector('.cart-drawer__footer'));

        const selectors = ["cart-drawer-items", ".cart-drawer__footer"];
        for (const selector of selectors) {
          const targetElement = document.querySelector(selector);
          const sourceElement = html.querySelector(selector);
          console.log(`🛒 [CartDebug] Selector "${selector}": target=${!!targetElement}, source=${!!sourceElement}`);
          if (targetElement && sourceElement) {
            console.log(`🛒 [CartDebug] Replacing ${selector}`);
            targetElement.replaceWith(sourceElement);
          }
        }
        return Promise.resolve();
      }

      // Fallback: fetch fresh data if no prefetched data available
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(
            responseText,
            "text/html"
          );
          const selectors = ["cart-drawer-items", ".cart-drawer__footer"];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      // Main cart page - use prefetched data if available
      const prefetchedHtml = event?.cartData?.sections?.['main-cart-items'];

      if (prefetchedHtml) {
        const html = new DOMParser().parseFromString(prefetchedHtml, "text/html");
        const sourceQty = html.querySelector("cart-items");
        if (sourceQty) {
          this.innerHTML = sourceQty.innerHTML;
        }
        return Promise.resolve();
      }

      // Fallback: fetch fresh data
      return fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(
            responseText,
            "text/html"
          );
          const sourceQty = html.querySelector("cart-items");
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: "main-cart-items",
        section: document.getElementById("main-cart-items").dataset.id,
        selector: ".js-contents",
      },
      {
        id: "cart-icon-bubble",
        section: "cart-icon-bubble",
        selector: ".shopify-section",
      },
      {
        id: "cart-live-region-text",
        section: "cart-live-region-text",
        selector: ".shopify-section",
      },
      {
        id: "main-cart-footer",
        section: document.getElementById("main-cart-footer").dataset.id,
        selector: ".js-contents",
      },
    ];
  }

  async updateQuantity(line, quantity, event, name, variantId) {
    this.enableLoading(line);

    // If removing item (quantity = 0), auto-remove linked pet fees FIRST
    // IMPORTANT: Must await this to prevent race condition where UI refreshes
    // before fee removal completes (fee would still show in cart)
    // v3: Fixed index shift bug - removeLinkedFees returns count of fees removed
    //     that were BEFORE the target line, so we adjust the line index
    let adjustedLine = line;
    if (quantity === 0) {
      const feesRemovedBefore = await this.removeLinkedFees(line);
      // After removing fees that were before this item, its line index shifts down
      adjustedLine = line - feesRemovedBefore;
      console.log(`🔢 [FeeSync] Line index adjusted: ${line} → ${adjustedLine} (${feesRemovedBefore} fee(s) removed before)`);
    }

    const body = JSON.stringify({
      line: adjustedLine,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });
    const eventTarget =
      event.currentTarget instanceof CartRemoveButton ? "clear" : "change";

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        CartPerformance.measure(
          `${eventTarget}:paint-updated-sections"`,
          () => {
            const quantityElement =
              document.getElementById(`Quantity-${line}`) ||
              document.getElementById(`Drawer-quantity-${line}`);
            const items = document.querySelectorAll(".cart-item");

            if (parsedState.errors) {
              quantityElement.value = quantityElement.getAttribute("value");
              this.updateLiveRegions(line, parsedState.errors);
              return;
            }

            this.classList.toggle("is-empty", parsedState.item_count === 0);
            const cartDrawerWrapper = document.querySelector("cart-drawer");
            const cartFooter = document.getElementById("main-cart-footer");

            if (cartFooter)
              cartFooter.classList.toggle(
                "is-empty",
                parsedState.item_count === 0
              );
            if (cartDrawerWrapper)
              cartDrawerWrapper.classList.toggle(
                "is-empty",
                parsedState.item_count === 0
              );

            this.getSectionsToRender().forEach((section) => {
              const elementToReplace =
                document
                  .getElementById(section.id)
                  .querySelector(section.selector) ||
                document.getElementById(section.id);
              elementToReplace.innerHTML = this.getSectionInnerHTML(
                parsedState.sections[section.section],
                section.selector
              );
            });
            const updatedValue = parsedState.items[line - 1]
              ? parsedState.items[line - 1].quantity
              : undefined;
            let message = "";
            if (
              items.length === parsedState.items.length &&
              updatedValue !== parseInt(quantityElement.value)
            ) {
              if (typeof updatedValue === "undefined") {
                message = window.cartStrings.error;
              } else {
                message = window.cartStrings.quantityError.replace(
                  "[quantity]",
                  updatedValue
                );
              }
            }
            this.updateLiveRegions(line, message);

            const lineItem =
              document.getElementById(`CartItem-${line}`) ||
              document.getElementById(`CartDrawer-Item-${line}`);
            if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
              cartDrawerWrapper
                ? trapFocus(
                    cartDrawerWrapper,
                    lineItem.querySelector(`[name="${name}"]`)
                  )
                : lineItem.querySelector(`[name="${name}"]`).focus();
            } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
              trapFocus(
                cartDrawerWrapper.querySelector(".drawer__inner-empty"),
                cartDrawerWrapper.querySelector("a")
              );
            } else if (
              document.querySelector(".cart-item") &&
              cartDrawerWrapper
            ) {
              trapFocus(
                cartDrawerWrapper,
                document.querySelector(".cart-item__name")
              );
            }
          }
        );

        CartPerformance.measureFromEvent(`${eventTarget}:user-action`, event);

        publish(PUB_SUB_EVENTS.cartUpdate, {
          source: "cart-items",
          cartData: parsedState,
          variantId: variantId,
        });
      })
      .catch(() => {
        this.querySelectorAll(".loading__spinner").forEach((overlay) =>
          overlay.classList.add("hidden")
        );
        const errors =
          document.getElementById("cart-errors") ||
          document.getElementById("CartDrawer-CartErrors");
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) ||
      document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError)
      lineItemError.querySelector(".cart-item__error-text").textContent =
        message;

    this.lineItemStatusElement.setAttribute("aria-hidden", true);

    const cartStatus =
      document.getElementById("cart-live-region-text") ||
      document.getElementById("CartDrawer-LiveRegionText");
    cartStatus.setAttribute("aria-hidden", false);

    setTimeout(() => {
      cartStatus.setAttribute("aria-hidden", true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems =
      document.getElementById("main-cart-items") ||
      document.getElementById("CartDrawer-CartItems");
    mainCartItems.classList.add("cart__items--disabled");

    const cartItemElements = this.querySelectorAll(
      `#CartItem-${line} .loading__spinner`
    );
    const cartDrawerItemElements = this.querySelectorAll(
      `#CartDrawer-Item-${line} .loading__spinner`
    );

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) =>
      overlay.classList.remove("hidden")
    );

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute("aria-hidden", false);
  }

  disableLoading(line) {
    const mainCartItems =
      document.getElementById("main-cart-items") ||
      document.getElementById("CartDrawer-CartItems");
    mainCartItems.classList.remove("cart__items--disabled");

    const cartItemElements = this.querySelectorAll(
      `#CartItem-${line} .loading__spinner`
    );
    const cartDrawerItemElements = this.querySelectorAll(
      `#CartDrawer-Item-${line} .loading__spinner`
    );

    cartItemElements.forEach((overlay) => overlay.classList.add("hidden"));
    cartDrawerItemElements.forEach((overlay) =>
      overlay.classList.add("hidden")
    );
  }

  /**
   * Remove linked pet fees when a product is removed from cart.
   * @param {number} productLineIndex - The 1-based line index of the product being removed
   * @returns {Promise<number>} - Count of fees removed that were BEFORE the product line
   *                              (used by caller to adjust the product's line index after removal)
   */
  async removeLinkedFees(productLineIndex) {
    try {
      console.log(`🔍 [FeeSync] Checking for linked fees to remove (line ${productLineIndex})`);
      const cart = await fetch('/cart.js').then(r => r.json());
      const removedItem = cart.items[productLineIndex - 1];
      if (!removedItem) {
        console.log('🔍 [FeeSync] No item found at line index, skipping');
        return 0;
      }

      const productTitle = removedItem.product_title;
      // Normalize for comparison (handles malformed titles with extra whitespace)
      const normalizedTitle = productTitle.replace(/\s+/g, ' ').trim().toLowerCase();
      console.log(`🔍 [FeeSync] Looking for fees linked to: "${normalizedTitle}"`);

      // Find fee items linked to this product
      const feesToRemove = cart.items
        .map((item, idx) => ({ item, lineIndex: idx + 1 }))
        .filter(({ item }) => {
          if (!item.properties || item.properties._fee_type !== 'additional_pets') {
            return false;
          }
          const linkedTo = item.properties._linked_to_product || '';
          const normalizedLinked = linkedTo.replace(/\s+/g, ' ').trim().toLowerCase();
          console.log(`🔍 [FeeSync] Fee item linked to: "${normalizedLinked}" | Match: ${normalizedLinked === normalizedTitle}`);
          return normalizedLinked === normalizedTitle;
        });

      console.log(`🔍 [FeeSync] Found ${feesToRemove.length} linked fee(s) to remove`);

      if (feesToRemove.length === 0) {
        return 0;
      }

      // Count how many fees are BEFORE the product line (needed for index adjustment)
      const feesBeforeProduct = feesToRemove.filter(({ lineIndex }) => lineIndex < productLineIndex).length;
      console.log(`🔢 [FeeSync] ${feesBeforeProduct} fee(s) are before product at line ${productLineIndex}`);

      // Remove each linked fee (process in reverse to avoid index shifting during removal)
      for (const { lineIndex } of feesToRemove.slice().reverse()) {
        console.log(`🗑️ [FeeSync] Removing fee at line ${lineIndex}`);
        await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line: lineIndex, quantity: 0 })
        });
      }

      console.log(`✅ [FeeSync] Auto-removed ${feesToRemove.length} linked pet fee(s)`);
      return feesBeforeProduct;
    } catch (err) {
      console.error('❌ [FeeSync] Failed to auto-remove linked fees:', err);
      return 0;
    }
  }
}

customElements.define("cart-items", CartItems);

// Note: Fee ordering now handled via CSS flexbox (order: 1 on fees)
// This provides FIFO display with fees at bottom, no JS DOM manipulation needed

if (!customElements.get("cart-note")) {
  customElements.define(
    "cart-note",
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          "input",
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, {
              ...fetchConfig(),
              ...{ body },
            }).then(() =>
              CartPerformance.measureFromEvent("note-update:user-action", event)
            );
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}
