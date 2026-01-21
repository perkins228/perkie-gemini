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
    // Debug: Log at very start to verify onCartUpdate is being called
    console.log('🛒 [CartUpdate] onCartUpdate called, tagName:', this.tagName, 'source:', event?.source);

    if (this.tagName === "CART-DRAWER-ITEMS") {
      // Use pre-fetched cart data from event if available (prevents stale data race)
      const prefetchedHtml = event?.cartData?.sections?.['cart-drawer'];

      console.log('🛒 [CartDrawer] Processing cart-drawer-items update');
      console.log('🛒 [CartDrawer] event exists:', !!event);
      console.log('🛒 [CartDrawer] cartData exists:', !!event?.cartData);
      console.log('🛒 [CartDrawer] sections exists:', !!event?.cartData?.sections);
      console.log('🛒 [CartDrawer] prefetchedHtml exists:', !!prefetchedHtml);
      if (prefetchedHtml) {
        console.log('🛒 [CartDrawer] prefetchedHtml length:', prefetchedHtml.length);
        // Check for $0.00 in the HTML
        const hasZeroPrice = prefetchedHtml.includes('$0.00');
        console.log('🛒 [CartDrawer] Contains $0.00:', hasZeroPrice);
      }

      if (prefetchedHtml) {
        const html = new DOMParser().parseFromString(prefetchedHtml, "text/html");
        // FIX: cart-drawer-items is a custom element - use innerHTML instead of replaceWith
        // to preserve the already-upgraded custom element instance in the DOM.
        // DOMParser creates elements in an inert document without Custom Elements registry,
        // so replaceWith() would insert a non-upgraded element causing CSS issues.
        const targetElement = document.querySelector("cart-drawer-items");
        const sourceElement = html.querySelector("cart-drawer-items");
        console.log('🛒 [CartDrawer] targetElement exists:', !!targetElement);
        console.log('🛒 [CartDrawer] sourceElement exists:', !!sourceElement);
        if (sourceElement) {
          console.log('🛒 [CartDrawer] sourceElement innerHTML length:', sourceElement.innerHTML.length);
          const cartItems = sourceElement.querySelectorAll('.cart-item');
          console.log('🛒 [CartDrawer] cart-item count in source:', cartItems.length);
        }
        if (targetElement && sourceElement) {
          // Copy class attribute (e.g., is-empty state)
          targetElement.className = sourceElement.className;
          // Use innerHTML to preserve the custom element
          targetElement.innerHTML = sourceElement.innerHTML;
          console.log('🛒 [CartDrawer] cart-drawer-items innerHTML updated successfully');
        }

        // FIX: Also update the footer (contains total price, discounts, checkout button)
        // The footer is OUTSIDE cart-drawer-items, so we need to update it separately
        const footerTarget = document.querySelector('.cart-drawer__footer');
        const footerSource = html.querySelector('.cart-drawer__footer');
        console.log('🛒 [CartDrawer] footerTarget exists:', !!footerTarget);
        console.log('🛒 [CartDrawer] footerSource exists:', !!footerSource);
        if (footerTarget && footerSource) {
          footerTarget.innerHTML = footerSource.innerHTML;
          console.log('🛒 [CartDrawer] footer innerHTML updated successfully');
        }

        // FIX: Only toggle is-empty class, NOT replace entire className
        // CRITICAL: cart-drawer has 'active' and 'animate' classes that control visibility
        // Replacing className removes these, causing drawer to become invisible (visibility: hidden)
        const cartDrawer = document.querySelector('cart-drawer');
        const cartDrawerSource = html.querySelector('cart-drawer');
        console.log('🛒 [CartDrawer] cartDrawer exists:', !!cartDrawer);
        console.log('🛒 [CartDrawer] cartDrawer.classList BEFORE:', cartDrawer ? Array.from(cartDrawer.classList) : 'N/A');
        console.log('🛒 [CartDrawer] cartDrawerSource exists:', !!cartDrawerSource);
        console.log('🛒 [CartDrawer] cartDrawerSource.classList:', cartDrawerSource ? Array.from(cartDrawerSource.classList) : 'N/A');
        if (cartDrawer && cartDrawerSource) {
          const sourceIsEmpty = cartDrawerSource.classList.contains('is-empty');
          console.log('🛒 [CartDrawer] sourceIsEmpty:', sourceIsEmpty);
          cartDrawer.classList.toggle('is-empty', sourceIsEmpty);
          console.log('🛒 [CartDrawer] cartDrawer.classList AFTER:', Array.from(cartDrawer.classList));
        }

        // DEBUG: Check drawer__inner transform state
        const drawerInner = document.querySelector('.drawer__inner');
        if (drawerInner) {
          const computedStyle = window.getComputedStyle(drawerInner);
          console.log('🛒 [CartDrawer] drawer__inner transform:', computedStyle.transform);
          console.log('🛒 [CartDrawer] drawer__inner visibility:', computedStyle.visibility);
          console.log('🛒 [CartDrawer] drawer__inner display:', computedStyle.display);
        }

        // DEBUG: Check cart-drawer-items content
        const updatedItems = document.querySelector('cart-drawer-items');
        if (updatedItems) {
          console.log('🛒 [CartDrawer] cart-drawer-items innerHTML length AFTER update:', updatedItems.innerHTML.length);
          const tableBody = updatedItems.querySelector('tbody');
          console.log('🛒 [CartDrawer] tbody exists in updated element:', !!tableBody);
          if (tableBody) {
            console.log('🛒 [CartDrawer] tbody.innerHTML length:', tableBody.innerHTML.length);
            console.log('🛒 [CartDrawer] cart-item rows in tbody:', tableBody.querySelectorAll('.cart-item').length);
          }
        }

        // DEBUG: Delayed check to see if content persists
        setTimeout(() => {
          console.log('🛒 [CartDrawer] === 500ms DELAYED CHECK ===');
          const drawerEl = document.querySelector('cart-drawer');
          const itemsEl = document.querySelector('cart-drawer-items');
          const footerEl = document.querySelector('.cart-drawer__footer');

          if (drawerEl) {
            console.log('🛒 [CartDrawer] cart-drawer classes:', Array.from(drawerEl.classList));
          }
          if (itemsEl) {
            console.log('🛒 [CartDrawer] cart-drawer-items innerHTML length:', itemsEl.innerHTML.length);
            console.log('🛒 [CartDrawer] cart-drawer-items classes:', Array.from(itemsEl.classList));
            const tbody = itemsEl.querySelector('tbody');
            console.log('🛒 [CartDrawer] tbody exists:', !!tbody);
            if (tbody) {
              console.log('🛒 [CartDrawer] cart-item count:', tbody.querySelectorAll('.cart-item').length);
              // Show first 200 chars of tbody HTML
              console.log('🛒 [CartDrawer] tbody HTML preview:', tbody.innerHTML.substring(0, 200));
            }
          }
          if (footerEl) {
            console.log('🛒 [CartDrawer] footer innerHTML length:', footerEl.innerHTML.length);
            // Check for price value
            const totalsEl = footerEl.querySelector('.totals__total-value');
            console.log('🛒 [CartDrawer] total price text:', totalsEl ? totalsEl.textContent.trim() : 'N/A');
          }

          // Check drawer__inner computed styles
          const innerEl = document.querySelector('.drawer__inner');
          if (innerEl) {
            const cs = window.getComputedStyle(innerEl);
            console.log('🛒 [CartDrawer] drawer__inner computed: transform=%s, visibility=%s, display=%s, opacity=%s',
              cs.transform, cs.visibility, cs.display, cs.opacity);
          }
        }, 500);

        return Promise.resolve();
      } else {
        console.log('🛒 [CartDrawer] No prefetched HTML, falling back to fetch');
      }

      // Fallback: fetch fresh data if no prefetched data available
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(
            responseText,
            "text/html"
          );
          // FIX: Use innerHTML for custom element cart-drawer-items
          const targetElement = document.querySelector("cart-drawer-items");
          const sourceElement = html.querySelector("cart-drawer-items");
          if (targetElement && sourceElement) {
            targetElement.className = sourceElement.className;
            targetElement.innerHTML = sourceElement.innerHTML;
          }

          // FIX: Also update footer in fallback path
          const footerTarget = document.querySelector('.cart-drawer__footer');
          const footerSource = html.querySelector('.cart-drawer__footer');
          if (footerTarget && footerSource) {
            footerTarget.innerHTML = footerSource.innerHTML;
          }

          // FIX: Only toggle is-empty class (same fix as prefetched path)
          const cartDrawer = document.querySelector('cart-drawer');
          const cartDrawerSource = html.querySelector('cart-drawer');
          if (cartDrawer && cartDrawerSource) {
            const sourceIsEmpty = cartDrawerSource.classList.contains('is-empty');
            cartDrawer.classList.toggle('is-empty', sourceIsEmpty);
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
