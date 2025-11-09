/**
 * Shared Bottom Sheet Component
 * Reusable drawer pattern for mobile UX
 *
 * Features:
 * - iOS Safari scroll lock fix
 * - Consistent swipe gesture handling
 * - Accessibility (ARIA, keyboard navigation)
 * - Lifecycle hooks for customization
 * - Browser back button integration
 *
 * Usage:
 * const drawer = new BottomSheet({
 *   container: document.querySelector('.my-drawer'),
 *   height: '70vh',
 *   dismissible: true,
 *   onOpen: () => console.log('Opened'),
 *   onClose: () => console.log('Closed')
 * });
 *
 * drawer.open();
 */

class BottomSheet {
  constructor(options = {}) {
    // Validate required options
    if (!options.container) {
      throw new Error('BottomSheet: container element is required');
    }

    // Configuration
    this.container = options.container;
    this.config = {
      height: options.height || '70vh',
      dismissible: options.dismissible ?? true,
      swipeThreshold: options.swipeThreshold || 100, // Consistent 100px threshold
      zIndex: options.zIndex || 1000,
      backdropBlur: options.backdropBlur ?? true
    };

    // State
    this.state = {
      isOpen: false,
      isDragging: false,
      startY: 0,
      currentY: 0,
      scrollY: 0 // For iOS scroll restoration
    };

    // Lifecycle hooks
    this.hooks = {
      onOpen: options.onOpen || null,
      onClose: options.onClose || null,
      beforeOpen: options.beforeOpen || null,
      beforeClose: options.beforeClose || null
    };

    // DOM elements
    this.overlay = null;
    this.handle = null;
    this.closeButton = null;
    this.content = null;

    // Initialize
    this.init();
  }

  /**
   * Initialize the bottom sheet
   */
  init() {
    // Set initial ARIA attributes
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-hidden', 'true');

    // Find or create DOM elements
    this.overlay = this.container.querySelector('.bottom-sheet-overlay') || this.createOverlay();
    this.handle = this.container.querySelector('.bottom-sheet-handle') || this.createHandle();
    this.closeButton = this.container.querySelector('.bottom-sheet-close') || this.createCloseButton();
    this.content = this.container.querySelector('.bottom-sheet-content');

    // Set initial styles
    this.applyStyles();

    // Initialize gesture handlers
    this.initGestures();

    // Initialize keyboard navigation
    this.initKeyboard();

    // Initialize browser back button integration
    this.initBackButton();
  }

  /**
   * Create overlay element if not present
   */
  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'bottom-sheet-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    this.container.parentNode.insertBefore(overlay, this.container);
    return overlay;
  }

  /**
   * Create handle element for swipe affordance
   */
  createHandle() {
    const handle = document.createElement('div');
    handle.className = 'bottom-sheet-handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.innerHTML = '<div class="bottom-sheet-handle-bar"></div>';
    this.container.insertBefore(handle, this.container.firstChild);
    return handle;
  }

  /**
   * Create close button for accessibility
   */
  createCloseButton() {
    const button = document.createElement('button');
    button.className = 'bottom-sheet-close';
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', 'Close');
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    this.container.appendChild(button);
    return button;
  }

  /**
   * Apply initial styles
   */
  applyStyles() {
    // Container styles
    Object.assign(this.container.style, {
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      height: this.config.height,
      background: '#fff',
      borderRadius: '16px 16px 0 0',
      transform: 'translateY(100%)', // Hidden below screen
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      willChange: 'transform', // GPU acceleration
      zIndex: this.config.zIndex.toString(),
      overflow: 'hidden'
    });

    // Overlay styles
    if (this.overlay) {
      Object.assign(this.overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        background: 'rgba(0, 0, 0, 0.5)',
        opacity: '0',
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease',
        zIndex: (this.config.zIndex - 1).toString()
      });

      // Add backdrop blur on desktop only
      if (this.config.backdropBlur && window.innerWidth >= 768) {
        this.overlay.style.backdropFilter = 'blur(4px)';
        this.overlay.style.webkitBackdropFilter = 'blur(4px)';
      }
    }
  }

  /**
   * Initialize swipe gesture handlers
   */
  initGestures() {
    // Touch start
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this));

    // Touch move
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this));

    // Touch end
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this));

    // Click overlay to close
    if (this.overlay && this.config.dismissible) {
      this.overlay.addEventListener('click', () => this.close());
    }

    // Click close button
    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => this.close());
    }
  }

  /**
   * Handle touch start event
   */
  handleTouchStart(e) {
    if (!this.state.isOpen || !this.config.dismissible) return;

    // Check if touch is on the handle or at the top of the drawer
    const touchY = e.touches[0].clientY;
    const containerRect = this.container.getBoundingClientRect();

    // Only start drag if touching within top 60px (handle area)
    if (touchY - containerRect.top > 60) {
      // Check if content is scrollable and not at top
      if (this.content) {
        const isScrollable = this.content.scrollHeight > this.content.clientHeight;
        const isAtTop = this.content.scrollTop === 0;

        if (isScrollable && !isAtTop) {
          return; // Let content scroll normally
        }
      }
    }

    this.state.isDragging = true;
    this.state.startY = e.touches[0].clientY;
    this.state.currentY = this.state.startY;

    // Disable transition for smooth dragging
    this.container.style.transition = 'none';
  }

  /**
   * Handle touch move event
   */
  handleTouchMove(e) {
    if (!this.state.isDragging) return;

    this.state.currentY = e.touches[0].clientY;
    const deltaY = this.state.currentY - this.state.startY;

    // Only allow dragging down (positive deltaY)
    if (deltaY > 0) {
      e.preventDefault(); // Prevent scroll
      this.container.style.transform = `translateY(${deltaY}px)`;
    }
  }

  /**
   * Handle touch end event
   */
  handleTouchEnd(e) {
    if (!this.state.isDragging) return;

    this.state.isDragging = false;

    const deltaY = this.state.currentY - this.state.startY;

    // Re-enable transition
    this.container.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    // Close if dragged beyond threshold
    if (deltaY > this.config.swipeThreshold) {
      this.close();
    } else {
      // Snap back to open position
      this.container.style.transform = 'translateY(0)';
    }
  }

  /**
   * Initialize keyboard navigation
   */
  initKeyboard() {
    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state.isOpen && this.config.dismissible) {
        this.close();
      }
    });

    // Focus trap
    this.container.addEventListener('keydown', this.handleFocusTrap.bind(this));
  }

  /**
   * Handle focus trap within drawer
   */
  handleFocusTrap(e) {
    if (!this.state.isOpen || e.key !== 'Tab') return;

    const focusableElements = this.container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  /**
   * Initialize browser back button integration
   */
  initBackButton() {
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.bottomSheetOpen && this.state.isOpen) {
        this.close(false); // Don't push to history again
      }
    });
  }

  /**
   * Open the bottom sheet
   */
  open() {
    if (this.state.isOpen) return;

    // Call beforeOpen hook
    if (this.hooks.beforeOpen) {
      const shouldContinue = this.hooks.beforeOpen();
      if (shouldContinue === false) return;
    }

    // Save scroll position for iOS restoration
    this.state.scrollY = window.scrollY;

    // iOS scroll lock fix
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.state.scrollY}px`;
    document.body.style.width = '100%';

    // Push to browser history
    history.pushState({ bottomSheetOpen: true }, '', window.location.href);

    // Show overlay
    if (this.overlay) {
      this.overlay.style.opacity = '1';
      this.overlay.style.pointerEvents = 'auto';
    }

    // Show drawer
    this.container.style.transform = 'translateY(0)';
    this.container.setAttribute('aria-hidden', 'false');

    // Update state
    this.state.isOpen = true;

    // Focus first element
    setTimeout(() => {
      const firstFocusable = this.container.querySelector(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }, 300); // Wait for animation to complete

    // Call onOpen hook
    if (this.hooks.onOpen) {
      this.hooks.onOpen();
    }
  }

  /**
   * Close the bottom sheet
   */
  close(updateHistory = true) {
    if (!this.state.isOpen) return;

    // Call beforeClose hook
    if (this.hooks.beforeClose) {
      const shouldContinue = this.hooks.beforeClose();
      if (shouldContinue === false) return;
    }

    // Hide drawer
    this.container.style.transform = 'translateY(100%)';
    this.container.setAttribute('aria-hidden', 'true');

    // Hide overlay
    if (this.overlay) {
      this.overlay.style.opacity = '0';
      this.overlay.style.pointerEvents = 'none';
    }

    // iOS scroll lock restoration
    const scrollY = this.state.scrollY;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);

    // Update browser history
    if (updateHistory && history.state && history.state.bottomSheetOpen) {
      history.back();
    }

    // Update state
    this.state.isOpen = false;

    // Call onClose hook
    if (this.hooks.onClose) {
      this.hooks.onClose();
    }
  }

  /**
   * Toggle open/close
   */
  toggle() {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if drawer is open
   */
  isOpen() {
    return this.state.isOpen;
  }

  /**
   * Destroy the bottom sheet
   */
  destroy() {
    // Remove event listeners
    this.container.removeEventListener('touchstart', this.handleTouchStart);
    this.container.removeEventListener('touchmove', this.handleTouchMove);
    this.container.removeEventListener('touchend', this.handleTouchEnd);

    // Remove overlay if we created it
    if (this.overlay && !this.container.querySelector('.bottom-sheet-overlay')) {
      this.overlay.remove();
    }

    // Reset styles
    this.container.style.transform = '';
    this.container.style.transition = '';

    // Restore body scroll if drawer was open
    if (this.state.isOpen) {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    }
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.BottomSheet = BottomSheet;
}
