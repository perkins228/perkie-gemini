/**
 * Pet Property Utilities - Centralized Management for Pet Form Fields
 *
 * Purpose: Manage clearing of pet property form fields to prevent carryover
 *          between products while preserving processor bridge architecture.
 *
 * Architecture:
 * - Clears ONLY form fields (properties[_pet_*])
 * - NEVER touches processor pet data (perkie_pet_pet_*)
 * - NEVER touches bridge data (processor_to_product_bridge)
 * - Preserves processor → product bridge functionality
 *
 * @version 1.0.0
 * @date 2025-11-14
 */

(function() {
  'use strict';

  // Constants
  var PET_PROPERTY_PREFIX = 'properties[_pet_';
  var LOG_PREFIX = '[PetProps]';

  // Valid pet property field patterns (security whitelist)
  var VALID_PET_FIELD_PATTERNS = [
    /^properties\[_pet_\d+_processed_image_url\]$/,
    /^properties\[_pet_\d+_filename\]$/,
    /^properties\[_pet_\d+_order_type\]$/,
    /^properties\[_pet_\d+_artist_notes\]$/,
    /^properties\[_pet_\d+_previous_order_number\]$/,
    /^properties\[_pet_\d+_images\]$/,
    /^properties\[_pet_\d+_selected_effect\]$/,
    /^properties\[_pet_\d+_session_key\]$/
  ];

  /**
   * Logging utility with consistent formatting
   * @param {string} level - info, success, warn, error
   * @param {string} layer - Which layer is calling (cart_success, page_load, etc.)
   * @param {string} message - Log message
   * @param {*} data - Optional data to log
   */
  function log(level, layer, message, data) {
    var timestamp = new Date().toISOString();
    var emoji = {
      'info': 'ℹ️',
      'success': '✅',
      'warn': '⚠️',
      'error': '❌'
    }[level] || '';

    var logMessage = emoji + ' ' + LOG_PREFIX + ' [' + layer + '] ' + message;

    var consoleMethod = console[level] || console.log;

    if (data) {
      consoleMethod(logMessage, data);
    } else {
      consoleMethod(logMessage);
    }
  }

  /**
   * Validate pet property field name against whitelist
   * @param {string} fieldName - Field name to validate
   * @returns {boolean} True if valid
   */
  function isValidPetField(fieldName) {
    if (!fieldName) return false;

    for (var i = 0; i < VALID_PET_FIELD_PATTERNS.length; i++) {
      if (VALID_PET_FIELD_PATTERNS[i].test(fieldName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape selector string to prevent injection
   * @param {string} str - Selector string to escape
   * @returns {string} Escaped selector
   */
  function escapeSelector(str) {
    if (!str) return '';
    return str.replace(/["'`\\]/g, '\\$&');
  }

  /**
   * Get all pet property fields for a form
   *
   * @param {HTMLFormElement|null} form - The form element (optional)
   * @returns {NodeList} Pet property fields
   */
  function getFields(form) {
    try {
      // If no form provided, try to find product form
      if (!form) {
        var productFormWrapper = document.querySelector('[data-product-form]');
        if (productFormWrapper) {
          form = productFormWrapper.querySelector('form');
        }
      }

      if (!form) {
        log('warn', 'getFields', 'No form found, using document-wide query');
        return document.querySelectorAll('input[name^="' + PET_PROPERTY_PREFIX + '"]');
      }

      var formId = form.getAttribute('id');

      if (!formId) {
        // No form ID, query within form element
        log('info', 'getFields', 'Form has no ID, querying within form element');
        return form.querySelectorAll('input[name^="' + PET_PROPERTY_PREFIX + '"]');
      }

      // Escape formId for security
      formId = escapeSelector(formId);

      // Primary: query by form attribute (includes fields outside form element via HTML5 form attribute)
      return document.querySelectorAll(
        'input[form="' + formId + '"][name^="' + PET_PROPERTY_PREFIX + '"]'
      );

    } catch (error) {
      log('error', 'getFields', 'Error getting fields:', error);
      // Return empty NodeList on error
      return document.createDocumentFragment().querySelectorAll('input');
    }
  }

  /**
   * Clear all pet property fields
   *
   * @param {HTMLFormElement|null} form - The form element (optional)
   * @returns {Object} Result object with success/failure counts
   */
  function clearFields(form) {
    var result = {
      success: true,
      cleared: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    try {
      var fields = getFields(form);

      if (fields.length === 0) {
        log('warn', 'clearFields', 'No pet fields found to clear');
        return result;
      }

      // Use classic for loop for IE11 compatibility (NOT forEach on NodeList)
      for (var i = 0; i < fields.length; i++) {
        var field = fields[i];

        try {
          // Validate field name (security check)
          if (!isValidPetField(field.name)) {
            log('warn', 'clearFields', 'Skipping invalid pet field:', { name: field.name });
            result.skipped++;
            continue;
          }

          // Skip readonly/disabled fields
          if (field.readOnly || field.disabled) {
            log('info', 'clearFields', 'Skipping readonly/disabled field:', { name: field.name });
            result.skipped++;
            continue;
          }

          // Clear field value
          field.value = '';
          result.cleared++;

        } catch (e) {
          log('error', 'clearFields', 'Failed to clear field:', { name: field.name, error: e });
          result.failed++;
          result.success = false;
          result.errors.push({ field: field.name, error: e.message });
        }
      }

      log('success', 'clearFields', 'Cleared ' + result.cleared +
          ' fields (' + result.failed + ' failed, ' + result.skipped + ' skipped)');

      return result;

    } catch (error) {
      log('error', 'clearFields', 'Unexpected error:', error);
      result.success = false;
      result.errors.push({ error: error.message });
      return result;
    }
  }

  /**
   * Clear fields and send telemetry
   *
   * @param {HTMLFormElement|null} form - The form element
   * @param {string} layer - Which layer is calling (for telemetry)
   * @returns {Object} Result object
   */
  function clearFieldsWithTelemetry(form, layer) {
    var startTime = Date.now();
    var result = clearFields(form);
    var duration = Date.now() - startTime;

    // Log telemetry
    log('info', layer, 'Clear operation completed in ' + duration + 'ms', result);

    // Send to Google Analytics if available
    if (window.gtag) {
      try {
        window.gtag('event', 'pet_fields_cleared', {
          'event_category': 'pet_customization',
          'event_label': layer,
          'layer': layer,
          'cleared_count': result.cleared,
          'failed_count': result.failed,
          'skipped_count': result.skipped,
          'success': result.success,
          'duration_ms': duration
        });
      } catch (e) {
        log('warn', layer, 'Failed to send analytics event:', e);
      }
    }

    // Send exception event if failed
    if (!result.success && window.gtag) {
      try {
        window.gtag('event', 'exception', {
          'description': 'pet_field_clear_failure_' + layer,
          'fatal': false,
          'layer': layer,
          'failed_count': result.failed
        });
      } catch (e) {
        // Silently fail analytics
      }
    }

    return result;
  }

  /**
   * Validate pet customization data (for Phase 2 restoration)
   *
   * @param {Object} customization - Customization data to validate
   * @returns {boolean} True if valid
   */
  function isValidCustomization(customization) {
    if (!customization || typeof customization !== 'object') {
      return false;
    }

    // Validate sessionKey format (alphanumeric, underscore, hyphen only)
    if (!customization.sessionKey || !/^[a-zA-Z0-9_-]+$/.test(customization.sessionKey)) {
      log('warn', 'validation', 'Invalid sessionKey format:', { key: customization.sessionKey });
      return false;
    }

    // Validate timestamp (not in future, not too old)
    var now = Date.now();
    var MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (!customization.timestamp ||
        customization.timestamp > now ||
        customization.timestamp < now - MAX_AGE) {
      log('warn', 'validation', 'Invalid timestamp:', { timestamp: customization.timestamp });
      return false;
    }

    // Validate selectedEffect (whitelist)
    var VALID_EFFECTS = ['enhancedblackwhite', 'color', 'stencil', 'sketch', 'popart', 'dithering', '8bit'];
    if (customization.selectedEffect && !VALID_EFFECTS.includes(customization.selectedEffect)) {
      log('warn', 'validation', 'Invalid selectedEffect:', { effect: customization.selectedEffect });
      return false;
    }

    // Sanitize artist notes (prevent XSS)
    if (customization.artistNotes) {
      customization.artistNotes = escapeHtml(customization.artistNotes);
    }

    // Validate productId (must be positive integer)
    if (customization.productId && (!Number.isInteger(customization.productId) || customization.productId <= 0)) {
      log('warn', 'validation', 'Invalid productId:', { productId: customization.productId });
      return false;
    }

    return true;
  }

  /**
   * Clean up old product customizations (prevent localStorage bloat)
   *
   * @param {number} maxAgeMs - Maximum age in milliseconds (default: 7 days)
   * @returns {number} Number of items cleaned up
   */
  function cleanupOldCustomizations(maxAgeMs) {
    maxAgeMs = maxAgeMs || (7 * 24 * 60 * 60 * 1000); // Default: 7 days
    var now = Date.now();
    var cleanedCount = 0;

    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);

        if (key && key.indexOf('petCustomization_product_') === 0) {
          try {
            var data = JSON.parse(localStorage.getItem(key));

            if (!data.timestamp || now - data.timestamp > maxAgeMs) {
              localStorage.removeItem(key);
              cleanedCount++;
              log('info', 'cleanup', 'Removed old customization:', { key: key, age: Math.floor((now - data.timestamp) / 1000 / 60 / 60) + 'h' });
            }
          } catch (e) {
            // Corrupted data, remove it
            localStorage.removeItem(key);
            cleanedCount++;
            log('warn', 'cleanup', 'Removed corrupted customization:', { key: key });
          }
        }
      }

      if (cleanedCount > 0) {
        log('success', 'cleanup', 'Cleaned up ' + cleanedCount + ' old customizations');
      }

      return cleanedCount;

    } catch (error) {
      log('error', 'cleanup', 'Error during cleanup:', error);
      return cleanedCount;
    }
  }

  // Export public API
  window.PetPropertyUtils = {
    getFields: getFields,
    clearFields: clearFields,
    clearFieldsWithTelemetry: clearFieldsWithTelemetry,
    isValidCustomization: isValidCustomization,
    cleanupOldCustomizations: cleanupOldCustomizations,
    escapeHtml: escapeHtml,

    // Version info
    version: '1.0.0',

    // Constants (for external use)
    RESTORE_TIMEOUT: 10 * 60 * 1000  // 10 minutes
  };

  // Run cleanup on load (remove expired customizations)
  cleanupOldCustomizations();

  log('success', 'init', 'PetPropertyUtils loaded successfully (v' + window.PetPropertyUtils.version + ')');

})();
