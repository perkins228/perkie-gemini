/**
 * Mobile Scroll Lock Utility
 * Prevents unwanted scrolling during DOM transitions on mobile devices
 *
 * CRITICAL for mobile e-commerce UX (70% of Perkie orders are mobile)
 */

class MobileScrollLock {
  constructor() {
    this.scrollPosition = 0;
    this.savedPositions = {}; // Track multiple requests by ID to prevent race conditions
    this.isLocked = false;
    this.originalOverflow = '';
    this.originalPosition = '';
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  /**
   * Save current scroll position
   * Call BEFORE any DOM-changing operation
   */
  savePosition() {
    this.scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    console.debug('[ScrollLock] Saved position:', this.scrollPosition);
    return this.scrollPosition;
  }

  /**
   * Save scroll position with unique ID (prevents race conditions with rapid clicks)
   * Use this for async operations that may overlap
   */
  savePositionWithId(id) {
    const position = window.pageYOffset || document.documentElement.scrollTop;
    this.savedPositions[id] = position;
    console.debug(`[ScrollLock] Saved position ${position} for request ${id}`);
    return position;
  }

  /**
   * Restore scroll position by ID
   * Cleans up saved position after restoration
   */
  restorePositionById(id) {
    if (!this.savedPositions || !this.savedPositions[id]) {
      console.debug(`[ScrollLock] No saved position for request ${id}`);
      return;
    }
    const position = this.savedPositions[id];
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, position);
        console.debug(`[ScrollLock] Restored position ${position} for request ${id}`);
        delete this.savedPositions[id];
      });
    });
  }

  /**
   * Lock scrolling completely
   * Prevents all scroll events during critical operations
   * iOS-specific implementation required
   */
  lock() {
    if (this.isLocked) return;

    this.savePosition();
    this.isLocked = true;

    // iOS-specific scroll lock (position: fixed method)
    if (this.isIOS) {
      const body = document.body;
      this.originalPosition = body.style.position;
      this.originalOverflow = body.style.overflow;

      body.style.position = 'fixed';
      body.style.top = `-${this.scrollPosition}px`;
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    } else {
      // Android/other browsers (simpler overflow method)
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }

    console.debug('[ScrollLock] Locked at position:', this.scrollPosition);
  }

  /**
   * Unlock scrolling and restore position
   * Call AFTER DOM transition completes
   */
  unlock() {
    if (!this.isLocked) return;

    const savedPosition = this.scrollPosition;

    if (this.isIOS) {
      const body = document.body;
      body.style.position = this.originalPosition;
      body.style.top = '';
      body.style.width = '';
      body.style.overflow = this.originalOverflow;
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }

    this.isLocked = false;

    // Restore scroll position
    // Use requestAnimationFrame to ensure DOM has settled
    requestAnimationFrame(() => {
      window.scrollTo(0, savedPosition);
      console.debug('[ScrollLock] Unlocked and restored to:', savedPosition);
    });
  }

  /**
   * Quick save/restore wrapper for synchronous operations
   * Use for operations that complete within single frame
   */
  preservePosition(callback) {
    const position = this.savePosition();
    callback();
    requestAnimationFrame(() => {
      window.scrollTo(0, position);
    });
  }
}

// Global singleton instance
window.mobileScrollLock = new MobileScrollLock();
