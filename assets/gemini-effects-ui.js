/**
 * Gemini Effects UI - Warning System & User Interface
 * Handles 4-level progressive warning system for rate limits
 * Mobile-first design with toast notifications and banners
 *
 * Warning Levels:
 * 1 (Silent): 10-7 remaining - Minimal badge indicator only
 * 2 (Reminder): 6-4 remaining - Friendly toast notification
 * 3 (Warning): 3-1 remaining - Persistent warning banner
 * 4 (Exhausted): 0 remaining - Disabled buttons with helpful message
 */

class GeminiEffectsUI {
  constructor(geminiClient) {
    this.geminiClient = geminiClient;
    this.container = null;
    this.currentWarningLevel = 1;
    this.toastTimeout = null;
    this.bannerElement = null;
    this.lastShownLevel = 0; // Track to avoid duplicate notifications
  }

  /**
   * Initialize UI elements and attach to DOM
   */
  initialize(container) {
    this.container = container;

    // Create banner container for Level 3 warnings
    this.createBannerContainer();

    // Update UI based on current quota
    this.updateUI();
  }

  /**
   * Create persistent banner container (hidden by default)
   */
  createBannerContainer() {
    // Remove existing banner if any
    const existing = this.container.querySelector('.gemini-warning-banner');
    if (existing) {
      existing.remove();
    }

    this.bannerElement = document.createElement('div');
    this.bannerElement.className = 'gemini-warning-banner';
    this.bannerElement.style.cssText = `
      display: none;
      background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      margin: 12px 0;
      font-size: 14px;
      line-height: 1.5;
      box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
      animation: slideDown 0.3s ease-out;
      position: relative;
      z-index: 100;
    `;

    // Insert at top of effects container
    const effectsContainer = this.container.querySelector('.effects-container') || this.container;
    effectsContainer.insertBefore(this.bannerElement, effectsContainer.firstChild);
  }

  /**
   * Update UI based on current quota state
   * Called after every API response
   */
  async updateUI() {
    const warningLevel = this.geminiClient.getWarningLevel();
    const remaining = this.geminiClient.getRemainingQuota();

    // Only show new warnings (don't repeat)
    if (warningLevel > this.lastShownLevel) {
      this.showWarning(warningLevel, remaining);
      this.lastShownLevel = warningLevel;
    }

    // Update badges on effect buttons
    this.updateEffectBadges(remaining, warningLevel);

    // Update banner visibility
    this.updateBanner(warningLevel, remaining);

    // Disable buttons if exhausted
    this.updateButtonStates(warningLevel);

    // Store current level
    this.currentWarningLevel = warningLevel;
  }

  /**
   * Show appropriate warning for level
   */
  showWarning(level, remaining) {
    switch (level) {
      case 1:
        // Silent - no notification
        break;

      case 2:
        // Reminder - Friendly toast
        this.showToast(
          `🎨 ${remaining} Ink Wash/Marker generation${remaining > 1 ? 's' : ''} left today`,
          'info',
          4000
        );
        break;

      case 3:
        // Warning - More urgent toast + persistent banner
        this.showToast(
          `⚠️ Running low! ${remaining} Ink Wash/Marker generation${remaining > 1 ? 's' : ''} remaining`,
          'warning',
          5000
        );
        break;

      case 4:
        // Exhausted - Informative toast
        this.showToast(
          `🎉 You've created 10 masterpieces today! Try B&W or Color (unlimited)`,
          'exhausted',
          6000
        );
        break;
    }
  }

  /**
   * Show toast notification (mobile-optimized)
   */
  showToast(message, type = 'info', duration = 4000) {
    // Clear existing toast
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    const existingToast = this.container.querySelector('.gemini-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `gemini-toast gemini-toast-${type}`;

    // Style based on type
    const colors = {
      info: { bg: '#4facfe', shadow: 'rgba(79, 172, 254, 0.4)' },
      warning: { bg: '#ff8e53', shadow: 'rgba(255, 142, 83, 0.4)' },
      exhausted: { bg: '#9d50bb', shadow: 'rgba(157, 80, 187, 0.4)' }
    };

    const color = colors[type] || colors.info;

    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${color.bg};
      color: white;
      padding: 14px 24px;
      border-radius: 24px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 16px ${color.shadow};
      z-index: 10000;
      max-width: 90%;
      text-align: center;
      animation: toastSlideIn 0.3s ease-out;
      cursor: pointer;
    `;

    toast.textContent = message;

    // Click to dismiss
    toast.addEventListener('click', () => {
      toast.style.animation = 'toastSlideOut 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }
    });

    // Add to DOM
    document.body.appendChild(toast);

    // Auto-remove after duration
    this.toastTimeout = setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'toastSlideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  /**
   * Update persistent warning banner (Level 3+)
   */
  updateBanner(level, remaining) {
    if (!this.bannerElement) return;

    if (level >= 3) {
      let message, emoji;

      if (level === 4) {
        // Exhausted - helpful message
        emoji = '🎨';
        message = `
          <strong>Daily Limit Reached</strong><br>
          You've created 10 amazing portraits today!
          Try our <strong>Classic B&W</strong> or <strong>Color</strong> effects (unlimited) while you wait for tomorrow's reset.
        `;
      } else {
        // Level 3 - warning
        emoji = '⚠️';
        message = `
          <strong>Almost Out!</strong><br>
          Only <strong>${remaining}</strong> Ink Wash/Marker generation${remaining > 1 ? 's' : ''} left today.
          Choose wisely or switch to unlimited effects.
        `;
      }

      this.bannerElement.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 24px; flex-shrink: 0;">${emoji}</span>
          <div style="flex: 1;">${message}</div>
          <button onclick="this.parentElement.parentElement.style.display='none'"
                  style="background: rgba(255,255,255,0.2); border: none; color: white;
                         padding: 4px 12px; border-radius: 12px; cursor: pointer; flex-shrink: 0;
                         font-size: 12px; font-weight: 600;">
            Got it
          </button>
        </div>
      `;

      this.bannerElement.style.display = 'block';
    } else {
      this.bannerElement.style.display = 'none';
    }
  }

  /**
   * Update badges on Ink Wash and Marker effect buttons
   */
  updateEffectBadges(remaining, level) {
    const inkWashBtn = this.container.querySelector('[data-effect="ink_wash"]');
    const sketchBtn = this.container.querySelector('[data-effect="sketch"]');

    [inkWashBtn, sketchBtn].forEach(btn => {
      if (!btn) return;

      // Remove existing badge
      const existingBadge = btn.querySelector('.gemini-quota-badge');
      if (existingBadge) {
        existingBadge.remove();
      }

      // Level 1 (normal) - no badge needed, cleaner mobile UX
      if (level === 1) {
        return;
      }

      // Create quota warning badge for levels 2-4 only
      const badge = document.createElement('span');
      badge.className = 'gemini-quota-badge';

      if (level === 4) {
        // Exhausted - show "0 left"
        badge.textContent = '0 left';
        badge.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          background: #ff4757;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(255, 71, 87, 0.4);
        `;
      } else if (level === 3) {
        // Warning - show remaining
        badge.textContent = `${remaining} left`;
        badge.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          background: #ff8e53;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(255, 142, 83, 0.4);
          animation: badgePulse 2s ease-in-out infinite;
        `;
      } else if (level === 2) {
        // Reminder - subtle badge
        badge.textContent = `${remaining} left`;
        badge.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(255, 255, 255, 0.9);
          color: #333;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
        `;
      }

      btn.style.position = 'relative';
      btn.appendChild(badge);
    });
  }

  /**
   * Enable/disable Ink Wash and Marker buttons based on quota
   */
  updateButtonStates(level) {
    const inkWashBtn = this.container.querySelector('[data-effect="ink_wash"]');
    const sketchBtn = this.container.querySelector('[data-effect="sketch"]');

    [inkWashBtn, sketchBtn].forEach(btn => {
      if (!btn) return;

      if (level === 4) {
        // Exhausted - disable and add visual feedback
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.title = 'Daily limit reached. Try B&W or Color (unlimited)';

        // Add click handler to show helpful message
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showToast(
            '💡 Out of Ink Wash & Marker for today. Try B&W or Color (unlimited)',
            'exhausted',
            5000
          );
        }, { once: true });
      } else {
        // Enable
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.title = '';
      }
    });
  }

  /**
   * Reset warning state (e.g., after midnight quota reset)
   */
  reset() {
    this.lastShownLevel = 0;
    this.currentWarningLevel = 1;

    // Hide banner
    if (this.bannerElement) {
      this.bannerElement.style.display = 'none';
    }

    // Clear toast
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    const existingToast = document.body.querySelector('.gemini-toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Update UI
    this.updateUI();
  }

  /**
   * Check for quota reset at midnight
   */
  checkQuotaReset() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);

    const timeUntilMidnight = midnight - now;

    // Set timeout for midnight
    setTimeout(() => {
      this.showToast(
        '🆕 Daily limit reset! 10 fresh Ink Wash/Marker generations available',
        'info',
        6000
      );
      this.reset();

      // Check again tomorrow
      this.checkQuotaReset();
    }, timeUntilMidnight);
  }
}

// Add CSS animations to document
const style = document.createElement('style');
style.textContent = `
  @keyframes toastSlideIn {
    from {
      transform: translate(-50%, -100px);
      opacity: 0;
    }
    to {
      transform: translate(-50%, 0);
      opacity: 1;
    }
  }

  @keyframes toastSlideOut {
    from {
      transform: translate(-50%, 0);
      opacity: 1;
    }
    to {
      transform: translate(-50%, -100px);
      opacity: 0;
    }
  }

  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes badgePulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  .gemini-toast {
    pointer-events: auto;
  }

  .gemini-warning-banner a {
    color: white;
    text-decoration: underline;
    font-weight: 600;
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .gemini-toast {
      font-size: 13px;
      padding: 12px 20px;
      max-width: 85%;
    }

    .gemini-warning-banner {
      font-size: 13px;
      padding: 14px 16px;
      margin: 10px 0;
    }
  }
`;
document.head.appendChild(style);

// Export to global scope for Shopify
window.GeminiEffectsUI = GeminiEffectsUI;
