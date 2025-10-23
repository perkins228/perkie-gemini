/**
 * Enhanced Product Form with Analytics Tracking
 * Tracks user interactions and optimizes conversion funnel
 */

class EnhancedProductForm {
  constructor() {
    this.form = document.querySelector('product-form');
    if (!this.form) return;
    
    this.setupEventListeners();
    this.trackFormInteractions();
    this.initializeUrgencyIndicators();
    this.setupAbandonmentTracking();
  }
  
  setupEventListeners() {
    // Track add to cart events with enhanced data
    subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'product-form') {
        this.trackAddToCartSuccess(event);
      }
    });
    
    // Track cart errors
    subscribe(PUB_SUB_EVENTS.cartError, (event) => {
      if (event.source === 'product-form') {
        this.trackAddToCartError(event);
      }
    });
    
    // Track variant changes
    subscribe(PUB_SUB_EVENTS.variantChange, (variant) => {
      this.trackVariantChange(variant);
    });
  }
  
  trackFormInteractions() {
    // Track quantity changes
    const quantityInput = this.form.querySelector('input[name="quantity"]');
    if (quantityInput) {
      quantityInput.addEventListener('change', (e) => {
        PerkieAnalytics.trackEvent('quantity_changed', {
          quantity: e.target.value,
          product_id: this.getProductId()
        });
      });
    }
    
    // Track form field focus (engagement indicator)
    let engagementTracked = false;
    this.form.addEventListener('focusin', () => {
      if (!engagementTracked) {
        PerkieAnalytics.trackEvent('product_form_engaged', {
          product_id: this.getProductId()
        });
        engagementTracked = true;
      }
    });
  }
  
  trackAddToCartSuccess(event) {
    const productData = this.getProductData();
    const petData = this.getPetCustomizationData();
    
    // Track successful add to cart
    PerkieAnalytics.trackAddToCart(productData, petData);
    
    // Track micro-conversions
    if (petData && petData.imageUrl) {
      PerkieAnalytics.trackPetEvent('add_to_cart_with_pet', {
        effect: petData.selectedEffect,
        pet_count: petData.pets ? petData.pets.length : 0
      });
    }
    
    // Set user properties for segmentation
    if (window.fbq) {
      fbq('trackCustom', 'PetCustomizer', {
        lifetime_pet_uploads: this.getLifetimePetUploads()
      });
    }
  }
  
  trackAddToCartError(event) {
    PerkieAnalytics.trackEvent('add_to_cart_error', {
      product_id: event.productVariantId,
      error_message: event.message || 'Unknown error',
      error_type: event.errors ? 'validation' : 'system'
    });
  }
  
  trackVariantChange(variant) {
    PerkieAnalytics.trackEvent('variant_selected', {
      product_id: this.getProductId(),
      variant_id: variant.id,
      variant_title: variant.title,
      variant_price: variant.price / 100,
      variant_available: variant.available
    });
  }
  
  initializeUrgencyIndicators() {
    // Add urgency for custom orders
    const submitButton = this.form.querySelector('[type="submit"]');
    if (!submitButton) return;
    
    // Check if product has pet customization
    const petSelector = document.querySelector('[data-pet-selector]');
    if (petSelector) {
      this.addCustomOrderUrgency(submitButton);
    }
    
    // Add inventory urgency if applicable
    this.addInventoryUrgency();
  }
  
  addCustomOrderUrgency(button) {
    const urgencyEl = document.createElement('div');
    urgencyEl.className = 'product-form__urgency';
    urgencyEl.innerHTML = `
      <svg class="icon icon-clock" viewBox="0 0 20 20" width="16" height="16">
        <path fill="currentColor" d="M10 0C4.5 0 0 4.5 0 10s4.5 10 10 10 10-4.5 10-10S15.5 0 10 0zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H9v6l5.2 3.1.8-1.3-4.5-2.7V5z"/>
      </svg>
      <span>Custom orders ship within 3-5 business days</span>
    `;
    button.parentElement.insertBefore(urgencyEl, button.nextSibling);
    
    // Track urgency display
    PerkieAnalytics.trackEvent('urgency_displayed', {
      type: 'custom_order',
      product_id: this.getProductId()
    });
  }
  
  addInventoryUrgency() {
    const variantId = this.form.querySelector('[name="id"]').value;
    const inventoryEl = document.querySelector(`[data-inventory-${variantId}]`);
    
    if (inventoryEl) {
      const inventory = parseInt(inventoryEl.dataset.inventory);
      if (inventory > 0 && inventory <= 10) {
        const urgencyEl = document.createElement('div');
        urgencyEl.className = 'product-form__urgency product-form__urgency--inventory';
        urgencyEl.innerHTML = `
          <svg class="icon icon-fire" viewBox="0 0 20 20" width="16" height="16">
            <path fill="currentColor" d="M10 0C10 0 8 5 6 7S2 11 2 14c0 4.4 3.6 8 8 8s8-3.6 8-8c0-3-2-5-4-7s-4-7-4-7zM10 19c-2.8 0-5-2.2-5-5 0-1.3.5-2.5 1.4-3.4C7.3 9.7 8.6 9 10 9s2.7.7 3.6 1.6c.9.9 1.4 2.1 1.4 3.4 0 2.8-2.2 5-5 5z"/>
          </svg>
          <span>Only ${inventory} left in stock!</span>
        `;
        this.form.querySelector('.product-form__buttons').appendChild(urgencyEl);
        
        PerkieAnalytics.trackEvent('urgency_displayed', {
          type: 'low_inventory',
          product_id: this.getProductId(),
          inventory_level: inventory
        });
      }
    }
  }
  
  setupAbandonmentTracking() {
    let interactionStarted = false;
    let addToCartAttempted = false;
    
    // Track when user starts interacting
    this.form.addEventListener('click', () => {
      if (!interactionStarted) {
        interactionStarted = true;
        this.abandonmentTimer = setTimeout(() => {
          if (!addToCartAttempted) {
            this.trackAbandonment();
          }
        }, 30000); // 30 seconds
      }
    });
    
    // Track add to cart attempts
    this.form.addEventListener('submit', () => {
      addToCartAttempted = true;
      if (this.abandonmentTimer) {
        clearTimeout(this.abandonmentTimer);
      }
    });
  }
  
  trackAbandonment() {
    const petData = this.getPetCustomizationData();
    
    PerkieAnalytics.trackEvent('product_abandoned', {
      product_id: this.getProductId(),
      had_pet_image: !!(petData && petData.imageUrl),
      abandonment_stage: petData ? 'post_customization' : 'pre_customization',
      time_on_page: Math.round((Date.now() - window.pageLoadTime) / 1000)
    });
    
    // Store abandonment data for recovery
    this.storeAbandonmentData();
  }
  
  storeAbandonmentData() {
    const abandonmentData = {
      timestamp: Date.now(),
      productId: this.getProductId(),
      variantId: this.form.querySelector('[name="id"]').value,
      petData: this.getPetCustomizationData(),
      url: window.location.href
    };
    
    localStorage.setItem('perkie_abandonment', JSON.stringify(abandonmentData));
  }
  
  getProductData() {
    const form = this.form.querySelector('form');
    const formData = new FormData(form);
    
    return {
      id: this.getProductId(),
      variant: formData.get('id'),
      quantity: formData.get('quantity') || 1,
      price: parseFloat(this.form.dataset.productPrice || 0)
    };
  }
  
  getProductId() {
    return this.form.dataset.productId || 
           document.querySelector('[data-product-id]')?.dataset.productId || 
           'unknown';
  }
  
  getPetCustomizationData() {
    // Get pet data from the pet selector component
    const petSelector = document.querySelector('[data-pet-selector]');
    if (!petSelector || !window.petSelectorData) return null;
    
    return window.petSelectorData;
  }
  
  getLifetimePetUploads() {
    const uploads = localStorage.getItem('perkie_pet_uploads_count');
    return parseInt(uploads) || 0;
  }
}

// Exit Intent Popup
class ExitIntentPopup {
  constructor() {
    this.shown = false;
    this.setupExitIntent();
  }
  
  setupExitIntent() {
    // Desktop: Track mouse leaving viewport
    document.addEventListener('mouseout', (e) => {
      if (e.clientY <= 0 && !this.shown && this.shouldShow()) {
        this.showPopup();
      }
    });
    
    // Mobile: Track rapid scroll up
    let lastScrollTop = 0;
    let scrollVelocity = 0;
    
    window.addEventListener('scroll', () => {
      const scrollTop = window.pageYOffset;
      scrollVelocity = lastScrollTop - scrollTop;
      
      if (scrollVelocity > 50 && scrollTop < 200 && !this.shown && this.shouldShow()) {
        this.showPopup();
      }
      
      lastScrollTop = scrollTop;
    });
  }
  
  shouldShow() {
    // Don't show if user has already converted or seen popup recently
    const lastShown = localStorage.getItem('perkie_exit_popup_shown');
    const daysSinceShown = lastShown ? 
      (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60 * 24) : 999;
    
    return daysSinceShown > 7 && 
           !document.querySelector('.cart-notification--active') &&
           window.location.pathname.includes('/products/');
  }
  
  showPopup() {
    this.shown = true;
    localStorage.setItem('perkie_exit_popup_shown', Date.now());
    
    const petData = window.petSelectorData;
    const hasCustomization = petData && petData.imageUrl;
    
    // Create popup with dynamic content
    const popup = document.createElement('div');
    popup.className = 'exit-intent-popup';
    popup.innerHTML = `
      <div class="exit-intent-popup__overlay"></div>
      <div class="exit-intent-popup__content">
        <button class="exit-intent-popup__close" aria-label="Close popup">&times;</button>
        ${hasCustomization ? `
          <h2>Wait! Don't lose your pet design!</h2>
          <p>Save 10% on your custom ${petData.productName || 'item'} featuring your pet!</p>
          <div class="exit-intent-popup__preview">
            <img src="${petData.imageUrl}" alt="Your pet design" width="200">
          </div>
        ` : `
          <h2>Wait! Before you go...</h2>
          <p>Get 10% off your first custom pet product!</p>
        `}
        <form class="exit-intent-popup__form">
          <input type="email" placeholder="Enter your email" required>
          <button type="submit" class="button button--primary">
            Get My 10% Discount
          </button>
        </form>
        <small>We'll email you a discount code instantly</small>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    // Animate in
    requestAnimationFrame(() => {
      popup.classList.add('exit-intent-popup--visible');
    });
    
    // Track popup display
    PerkieAnalytics.trackEvent('exit_intent_displayed', {
      has_customization: hasCustomization,
      product_id: this.getProductId()
    });
    
    // Handle form submission
    popup.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleEmailSubmit(e.target);
    });
    
    // Handle close
    popup.querySelector('.exit-intent-popup__close').addEventListener('click', () => {
      this.closePopup(popup);
    });
    
    popup.querySelector('.exit-intent-popup__overlay').addEventListener('click', () => {
      this.closePopup(popup);
    });
  }
  
  handleEmailSubmit(form) {
    const email = form.querySelector('input[type="email"]').value;
    
    // Track conversion
    PerkieAnalytics.trackEmailCapture('exit_intent', 10);
    
    // In production, send to your email service
    // For now, just show success
    form.innerHTML = `
      <div class="exit-intent-popup__success">
        <svg class="icon icon-checkmark" width="24" height="24">
          <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        <h3>Success! Check your email</h3>
        <p>Your 10% discount code has been sent to ${email}</p>
      </div>
    `;
    
    // Store email for abandonment recovery
    localStorage.setItem('perkie_exit_email', email);
    
    // Close after 3 seconds
    setTimeout(() => {
      this.closePopup(form.closest('.exit-intent-popup'));
    }, 3000);
  }
  
  closePopup(popup) {
    popup.classList.remove('exit-intent-popup--visible');
    setTimeout(() => {
      popup.remove();
    }, 300);
  }
  
  getProductId() {
    return document.querySelector('[data-product-id]')?.dataset.productId || 'unknown';
  }
}

// Initialize components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Track page load time for analytics
  window.pageLoadTime = Date.now();
  
  // Initialize enhanced product form
  new EnhancedProductForm();
  
  // Initialize exit intent popup (product pages only)
  if (window.location.pathname.includes('/products/')) {
    new ExitIntentPopup();
  }
});