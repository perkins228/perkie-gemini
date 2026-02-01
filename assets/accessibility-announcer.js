/**
 * Accessibility Announcer - WCAG 4.1.3 Status Messages
 *
 * Provides screen reader announcements for dynamic content changes.
 * Uses aria-live regions to announce status updates without focus change.
 *
 * Usage:
 *   AccessibilityAnnouncer.announce('Processing your pet photo...');
 *   AccessibilityAnnouncer.announceUrgent('Error: File too large');
 *   AccessibilityAnnouncer.announceProgress(50); // "50% complete"
 */

(function() {
  'use strict';

  var AccessibilityAnnouncer = {
    _container: null,
    _initialized: false,

    /**
     * Initialize the announcer by creating the aria-live region
     * Called automatically on first announcement
     */
    init: function() {
      if (this._initialized) return;

      // Create visually hidden container for announcements
      this._container = document.createElement('div');
      this._container.id = 'a11y-announcer';
      this._container.setAttribute('role', 'status');
      this._container.setAttribute('aria-live', 'polite');
      this._container.setAttribute('aria-atomic', 'true');

      // Visually hidden but accessible to screen readers
      this._container.style.cssText = [
        'position: absolute',
        'width: 1px',
        'height: 1px',
        'padding: 0',
        'margin: -1px',
        'overflow: hidden',
        'clip: rect(0, 0, 0, 0)',
        'white-space: nowrap',
        'border: 0'
      ].join(';');

      document.body.appendChild(this._container);
      this._initialized = true;

      console.log('♿ AccessibilityAnnouncer initialized');
    },

    /**
     * Announce a message to screen readers
     * @param {string} message - The message to announce
     * @param {string} priority - 'polite' (default) or 'assertive'
     */
    announce: function(message, priority) {
      if (!message) return;

      this.init();

      priority = priority || 'polite';
      this._container.setAttribute('aria-live', priority);

      // Clear then set to trigger announcement
      // Small delay ensures screen readers pick up the change
      this._container.textContent = '';

      var self = this;
      setTimeout(function() {
        self._container.textContent = message;
        console.log('♿ Announced (' + priority + '):', message);
      }, 50);
    },

    /**
     * Announce an urgent/important message (interrupts current speech)
     * Use sparingly - only for errors or critical status changes
     * @param {string} message - The message to announce
     */
    announceUrgent: function(message) {
      this.announce(message, 'assertive');
    },

    /**
     * Announce processing progress
     * @param {number} percent - Progress percentage (0-100)
     */
    announceProgress: function(percent) {
      // Only announce at significant milestones to avoid annoyance
      var milestones = [25, 50, 75, 100];
      if (milestones.indexOf(percent) !== -1) {
        if (percent === 100) {
          this.announce('Processing complete. Your pet portrait is ready.');
        } else {
          this.announce('Processing ' + percent + '% complete');
        }
      }
    },

    /**
     * Announce processing started
     * @param {number} estimatedSeconds - Estimated time in seconds (optional)
     */
    announceProcessingStart: function(estimatedSeconds) {
      var message = 'Processing your pet photo.';
      if (estimatedSeconds) {
        message += ' This may take about ' + estimatedSeconds + ' seconds.';
      }
      this.announce(message);
    },

    /**
     * Announce an error
     * @param {string} errorMessage - The error description
     */
    announceError: function(errorMessage) {
      this.announceUrgent('Error: ' + (errorMessage || 'Something went wrong. Please try again.'));
    },

    /**
     * Announce effect selection change
     * @param {string} effectName - Name of the selected effect
     */
    announceEffectChange: function(effectName) {
      this.announce(effectName + ' effect selected');
    },

    /**
     * Clear any pending announcements
     */
    clear: function() {
      if (this._container) {
        this._container.textContent = '';
      }
    }
  };

  // Export to global scope
  window.AccessibilityAnnouncer = AccessibilityAnnouncer;

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      AccessibilityAnnouncer.init();
    });
  } else {
    AccessibilityAnnouncer.init();
  }

})();
