/**
 * Quick Upload Handler - Shopify File Upload for Express Checkout
 * ES5-compatible for broad browser support
 * Handles Scenario 3: Express customers upload photos without AI preview
 */

(function() {
  'use strict';

  // Section-scoped upload state (prevents memory leaks and cross-section contamination)
  var uploadState = {}; // { 'section-id': { files: [], locked: false, timestamp: Date.now() } }

  // Check DataTransfer API support (Safari 14+, Chrome 60+, Firefox 62+)
  // IMPORTANT: Must use try-catch + instance test to avoid "Illegal invocation" on Safari
  // Accessing DataTransfer.prototype.items directly throws error because it's a getter property
  var supportsDataTransfer = false;
  try {
    if (typeof DataTransfer !== 'undefined') {
      var testDT = new DataTransfer();
      supportsDataTransfer = (testDT.items !== undefined && typeof testDT.items.add === 'function');
    }
  } catch (e) {
    // Browser doesn't support DataTransfer constructor (older browsers)
    supportsDataTransfer = false;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    setupQuickUploadTriggers();
    setupFileInputHandlers();
    setupPreviewTriggers();
    setupFormSubmitLock();
    cleanupStaleState(); // Clean old state on page load
  }

  /**
   * Get or create upload state for a section
   */
  function getUploadState(sectionId) {
    if (!uploadState[sectionId]) {
      uploadState[sectionId] = {
        files: [],
        locked: false,
        timestamp: Date.now()
      };
    }
    return uploadState[sectionId];
  }

  /**
   * Cleanup stale upload states (older than 30 minutes)
   */
  function cleanupStaleState() {
    var now = Date.now();
    var maxAge = 30 * 60 * 1000; // 30 minutes

    for (var sectionId in uploadState) {
      if (uploadState.hasOwnProperty(sectionId)) {
        if (now - uploadState[sectionId].timestamp > maxAge) {
          delete uploadState[sectionId];
        }
      }
    }
  }

  /**
   * Setup Quick Upload button click handlers
   */
  function setupQuickUploadTriggers() {
    var triggers = document.querySelectorAll('[data-quick-upload-trigger]');

    for (var i = 0; i < triggers.length; i++) {
      triggers[i].addEventListener('click', function(e) {
        e.preventDefault();
        handleQuickUploadClick(this);
      });
    }
  }

  /**
   * Handle Quick Upload button click - triggers file picker
   */
  function handleQuickUploadClick(trigger) {
    // Extract section ID by removing known prefix (not splitting on dashes)
    var sectionId = trigger.id.replace('quick-upload-trigger-', '');
    var fileInput = document.getElementById('quick-upload-input-' + sectionId);
    var petNameInput = document.getElementById('pet-name-input-' + sectionId);

    // Validate pet name is entered first
    if (!petNameInput || !petNameInput.value.trim()) {
      // Step 1: Blur ANY focused input to close mobile keyboard
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }

      // Step 2: Wait for keyboard to close (250-300ms on iOS/Android)
      setTimeout(function() {
        // Show error message now that keyboard is closed
        showToast('Please enter your pet name(s) first', 'warning');

        // Announce error for screen readers
        announceError('Please enter your pet name first');

        // Step 3: Scroll to name input field for context
        if (petNameInput) {
          petNameInput.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });

          // Step 4: Add visual highlight to show WHERE to enter name
          petNameInput.style.outline = '3px solid #FF9800';
          petNameInput.style.outlineOffset = '2px';

          // Step 5: Remove highlight after 2 seconds
          setTimeout(function() {
            petNameInput.style.outline = '';
            petNameInput.style.outlineOffset = '';
          }, 2000);
        }
      }, 300); // 300ms = keyboard close animation + buffer

      return;
    }

    // Track analytics
    if (window.gtag) {
      gtag('event', 'quick_upload_initiated', {
        device_type: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      });
    }

    // Trigger native file picker
    if (fileInput) {
      fileInput.click();
    }
  }

  /**
   * Setup file input change handlers
   */
  function setupFileInputHandlers() {
    var fileInputs = document.querySelectorAll('[data-quick-upload-input]');

    for (var i = 0; i < fileInputs.length; i++) {
      fileInputs[i].addEventListener('change', function(e) {
        handleFileSelection(this);
      });
    }
  }

  /**
   * Handle file selection from native picker
   */
  function handleFileSelection(fileInput) {
    var files = Array.prototype.slice.call(fileInput.files);
    var sectionId = fileInput.id.replace('quick-upload-input-', '');
    var petNameInput = document.getElementById('pet-name-input-' + sectionId);
    var maxFiles = parseInt(fileInput.dataset.maxFiles) || 1;
    var state = getUploadState(sectionId);

    // Validation 1: File count
    if (files.length === 0) {
      return; // User cancelled
    }

    if (files.length > maxFiles) {
      showToast('You can only upload ' + maxFiles + ' photo(s) for this product.', 'error');
      fileInput.value = ''; // Clear selection
      return;
    }

    // Validation 2: File size (max 50MB per Shopify)
    for (var i = 0; i < files.length; i++) {
      if (files[i].size > 50 * 1024 * 1024) {
        showToast(files[i].name + ' is too large. Max 50MB per file.', 'error');
        fileInput.value = '';
        return;
      }
    }

    // Validation 3: File type (must be image)
    for (var i = 0; i < files.length; i++) {
      if (!files[i].type.startsWith('image/')) {
        showToast(files[i].name + ' is not an image file. Please select JPG, PNG, or HEIC.', 'error');
        fileInput.value = '';
        return;
      }
    }

    // Validation 4: Flexible file count (allow 1-max files regardless of name count)
    // Real-world use cases:
    // - Multiple pets in one photo (2 names, 1 file) ✅
    // - Sequential mobile camera captures (limited by device) ✅
    // - Mixed sources (library + camera) ✅
    var petNameValue = petNameInput.value.trim();
    var petNames = petNameValue.split(',')
      .map(function(n) { return n.trim(); })
      .filter(function(n) { return n.length > 0; });

    // No strict matching - just ensure at least 1 file
    if (files.length === 0) {
      showToast('Please select at least 1 photo', 'error');
      return;
    }

    // All validations passed - MERGE new files with existing files (additive upload)
    var existingFiles = state.files || [];
    var newFiles = files;

    // Check total file count (existing + new)
    var totalFileCount = existingFiles.length + newFiles.length;
    if (totalFileCount > maxFiles) {
      showToast('You can upload a maximum of ' + maxFiles + ' photo(s). You already have ' + existingFiles.length + ' file(s) uploaded.', 'error');
      fileInput.value = ''; // Clear new selection
      return;
    }

    // Deduplicate files by name+size to prevent confusion
    var mergedFiles = existingFiles.slice(); // Copy existing files
    var duplicatesSkipped = 0;

    for (var i = 0; i < newFiles.length; i++) {
      var isDuplicate = false;
      for (var j = 0; j < mergedFiles.length; j++) {
        if (mergedFiles[j].name === newFiles[i].name &&
            mergedFiles[j].size === newFiles[i].size) {
          isDuplicate = true;
          duplicatesSkipped++;
          break;
        }
      }
      if (!isDuplicate) {
        mergedFiles.push(newFiles[i]);
      }
    }

    // Show duplicate warning if any were skipped
    if (duplicatesSkipped > 0) {
      var dupMsg = duplicatesSkipped === 1 ?
        newFiles[0].name + ' is already uploaded (duplicate skipped)' :
        duplicatesSkipped + ' duplicate file(s) skipped';
      showToast(dupMsg, 'warning');
    }

    // Update state with merged files
    state.files = mergedFiles;
    state.timestamp = Date.now();

    // Rebuild file input with ALL files using DataTransfer API
    if (supportsDataTransfer) {
      rebuildFileInput(sectionId, mergedFiles);
    }

    // Render file previews with delete buttons
    renderFilePreviews(sectionId, mergedFiles, petNames);

    // Show upload status
    displayUploadStatus(sectionId, mergedFiles, petNames);

    // Populate order properties
    populateOrderProperties(sectionId, mergedFiles);

    // Fire pet:selected event to trigger cart-pet-integration.js
    // This ensures pet name and font style are saved to the order
    var petNameInput = document.getElementById('pet-name-input-' + sectionId);
    if (petNameInput && petNames.length > 0) {
      var petEvent = new CustomEvent('pet:selected', {
        detail: {
          name: petNames.join(', '),
          processedImage: null,  // Quick upload has no processed image
          originalImage: null,   // Files handled by form submit
          effect: 'original',
          gcsUrl: null,
          originalUrl: null,
          artistNote: ''
        }
      });
      document.dispatchEvent(petEvent);
      console.log('🔔 Quick Upload: Fired pet:selected event with name:', petNames.join(', '));
    }

    // Enable add-to-cart button
    updateAddToCartButton(sectionId, true);

    // Track success with merge details
    if (window.gtag) {
      gtag('event', 'quick_upload_file_selected', {
        file_count: mergedFiles.length,
        existing_count: existingFiles.length,
        new_count: newFiles.length,
        duplicates_skipped: duplicatesSkipped,
        device_type: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      });
    }

    // Show success message with smart guidance
    var successMessage;
    if (mergedFiles.length === petNames.length) {
      // Perfect match
      var petText = mergedFiles.length === 1 ? petNames[0] : mergedFiles.length + ' pets';
      successMessage = '✅ ' + petText + ' ready! Files will upload when you add to cart.';
    } else if (mergedFiles.length < petNames.length) {
      // Fewer files than names (e.g., both pets in one photo)
      successMessage = '✅ ' + mergedFiles.length + ' photo(s) for ' + petNames.length + ' pets. Our team will review your order.';
    } else {
      // More files than names (e.g., user uploaded extras)
      successMessage = '✅ ' + mergedFiles.length + ' photo(s) uploaded. Our team will review your order.';
    }

    // Only show success toast if no duplicates (duplicate toast already shown)
    if (duplicatesSkipped === 0) {
      showToast(successMessage, 'success');
    }
  }

  /**
   * Render file preview cards with delete buttons
   */
  function renderFilePreviews(sectionId, files, petNames) {
    var statusContainer = document.getElementById('upload-status-' + sectionId);
    if (!statusContainer) return;

    var progressDiv = document.getElementById('upload-progress-' + sectionId);
    if (progressDiv) {
      progressDiv.style.display = 'block';
    }

    var html = '<div style="margin-top: 8px;">';

    // Individual file preview cards with delete buttons
    for (var i = 0; i < files.length; i++) {
      var fileName = files[i].name;
      var fileSize = formatFileSize(files[i].size);
      var petName = petNames[i] || 'Pet ' + (i + 1);

      html += '<div class="file-preview-card" data-file-index="' + i + '" style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 6px; margin-bottom: 8px; border: 1px solid #ddd;">';

      // Status checkmark (moved to left)
      html += '<span style="color: #4CAF50; font-size: 24px; margin-right: 12px; flex-shrink: 0;">✓</span>';

      // File info
      html += '<div style="flex: 1; min-width: 0;">';
      html += '<strong style="display: block; font-size: 14px; margin-bottom: 2px;">' + escapeHtml(petName) + '</strong>';
      html += '<small style="color: #666; font-size: 13px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + escapeHtml(fileName) + ' (' + fileSize + ')</small>';
      html += '</div>';

      // Delete button (moved to right, lighter styling, 44px size)
      if (supportsDataTransfer) {
        html += '<button type="button" class="delete-file-btn" data-section-id="' + sectionId + '" data-file-index="' + i + '" style="background: white; color: #666; border: 2px solid #e0e0e0; border-radius: 50%; width: 44px; height: 44px; font-size: 20px; cursor: pointer; margin-left: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" aria-label="Delete ' + escapeHtml(fileName) + '" onmouseover="this.style.borderColor=\'#f44336\'; this.style.color=\'#f44336\';" onmouseout="this.style.borderColor=\'#e0e0e0\'; this.style.color=\'#666\';">';
        html += '×';
        html += '</button>';
      }

      html += '</div>';
    }

    html += '</div>';

    statusContainer.innerHTML = html;

    // Attach event listeners to delete buttons
    var deleteButtons = statusContainer.querySelectorAll('.delete-file-btn');
    for (var i = 0; i < deleteButtons.length; i++) {
      deleteButtons[i].addEventListener('click', function(e) {
        e.preventDefault();
        var btnSectionId = this.getAttribute('data-section-id');
        var fileIndex = parseInt(this.getAttribute('data-file-index'));
        removeFile(btnSectionId, fileIndex);
      });
    }

  }

  /**
   * Remove a single file from the upload state
   */
  function removeFile(sectionId, fileIndex) {
    var state = getUploadState(sectionId);

    // Race condition protection: prevent deletion during form submission
    if (state.locked) {
      showToast('Please wait - upload in progress', 'warning');
      return;
    }

    // Validate file index
    if (fileIndex < 0 || fileIndex >= state.files.length) {
      showToast('Invalid file selection', 'error');
      return;
    }

    var fileName = state.files[fileIndex].name;

    // Remove file from state
    state.files.splice(fileIndex, 1);
    state.timestamp = Date.now();

    // Get pet names for re-rendering
    var petNameInput = document.getElementById('pet-name-input-' + sectionId);
    var petNames = [];
    if (petNameInput && petNameInput.value.trim()) {
      petNames = petNameInput.value.trim().split(',')
        .map(function(n) { return n.trim(); })
        .filter(function(n) { return n.length > 0; });
    }

    // If no files left, clear everything
    if (state.files.length === 0) {
      startOver(sectionId);
      showToast('File removed: ' + fileName, 'info');
      return;
    }

    // Re-render previews with updated file list
    renderFilePreviews(sectionId, state.files, petNames);

    // Rebuild file input with remaining files
    rebuildFileInput(sectionId, state.files);

    // Update order properties
    populateOrderProperties(sectionId, state.files);

    // Show feedback
    showToast('File removed: ' + fileName, 'info');

    // Track analytics
    if (window.gtag) {
      gtag('event', 'quick_upload_file_deleted', {
        remaining_count: state.files.length
      });
    }
  }

  /**
   * Clear all files and reset upload state
   */
  function startOver(sectionId) {
    var state = getUploadState(sectionId);

    // Race condition protection
    if (state.locked) {
      showToast('Please wait - upload in progress', 'warning');
      return;
    }

    // Clear state
    state.files = [];
    state.timestamp = Date.now();

    // Clear file input
    var fileInput = document.getElementById('quick-upload-input-' + sectionId);
    if (fileInput) {
      fileInput.value = '';
    }

    // Clear upload status display
    var statusContainer = document.getElementById('upload-status-' + sectionId);
    if (statusContainer) {
      statusContainer.innerHTML = '';
    }

    var progressDiv = document.getElementById('upload-progress-' + sectionId);
    if (progressDiv) {
      progressDiv.style.display = 'none';
    }

    // Clear order properties
    var orderTypeField = document.getElementById('order-type-' + sectionId);
    var processingStateField = document.getElementById('processing-state-' + sectionId);
    var uploadTimestampField = document.getElementById('upload-timestamp-' + sectionId);

    if (orderTypeField) orderTypeField.value = '';
    if (processingStateField) processingStateField.value = '';
    if (uploadTimestampField) uploadTimestampField.value = '';

    // Disable add-to-cart (will be re-enabled if pet name exists)
    updateAddToCartButton(sectionId, false);

    // Check if pet name exists to re-enable add-to-cart
    var petNameInput = document.getElementById('pet-name-input-' + sectionId);
    if (petNameInput && petNameInput.value.trim()) {
      updateAddToCartButton(sectionId, true);
    }

    showToast('Files cleared - you can upload new photos', 'info');

    // Track analytics
    if (window.gtag) {
      gtag('event', 'quick_upload_start_over');
    }
  }

  /**
   * Rebuild file input with updated file list using DataTransfer API
   * Note: Only called when supportsDataTransfer is true
   */
  function rebuildFileInput(sectionId, files) {
    var fileInput = document.getElementById('quick-upload-input-' + sectionId);
    if (!fileInput) return;

    try {
      var dataTransfer = new DataTransfer();

      // Add remaining files to DataTransfer
      for (var i = 0; i < files.length; i++) {
        dataTransfer.items.add(files[i]);
      }

      // Update file input with new FileList
      fileInput.files = dataTransfer.files;
    } catch (e) {
      console.warn('Failed to rebuild file input:', e);
      showToast('Could not update file selection. Please use "Start Over" to reselect files.', 'warning');
    }
  }

  /**
   * Display upload status with file previews (DEPRECATED - use renderFilePreviews)
   * Kept for backward compatibility
   */
  function displayUploadStatus(sectionId, files, petNames) {
    // This function is now handled by renderFilePreviews
    // Keeping empty function to prevent errors if called elsewhere
  }

  /**
   * Populate hidden order properties for express upload
   */
  function populateOrderProperties(sectionId, files) {
    var orderTypeField = document.getElementById('order-type-' + sectionId);
    var processingStateField = document.getElementById('processing-state-' + sectionId);
    var uploadTimestampField = document.getElementById('upload-timestamp-' + sectionId);

    if (orderTypeField) {
      orderTypeField.value = 'express_upload';
    }

    if (processingStateField) {
      processingStateField.value = 'uploaded_only';
    }

    if (uploadTimestampField) {
      uploadTimestampField.value = new Date().toISOString();
    }

    // Note: Shopify file input automatically handles the file upload when form submits
    // Files are attached to properties[_pet_image] and uploaded to Shopify CDN
  }

  /**
   * Update add-to-cart button state
   */
  function updateAddToCartButton(sectionId, enable) {
    var addButton = document.querySelector('button[name="add"], input[name="add"]');

    if (!addButton) return;

    if (enable) {
      addButton.disabled = false;
      addButton.style.opacity = '1';
      addButton.style.cursor = 'pointer';

      // Update button text if it was showing "Enter Pet Name"
      if (addButton.textContent.indexOf('Enter') !== -1) {
        addButton.textContent = 'Add to Cart';
      }
    }
  }

  /**
   * Setup preview trigger analytics
   */
  function setupPreviewTriggers() {
    var triggers = document.querySelectorAll('[data-preview-trigger]');

    for (var i = 0; i < triggers.length; i++) {
      triggers[i].addEventListener('click', function(e) {
        // Track analytics
        if (window.gtag) {
          gtag('event', 'preview_flow_initiated', {
            device_type: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
          });
        }

        // Save pet name to localStorage for preview page
        var sectionId = this.id.replace('preview-cta-', '');
        var petNameInput = document.getElementById('pet-name-input-' + sectionId);

        if (petNameInput && petNameInput.value.trim()) {
          try {
            localStorage.setItem('pending_pet_name', petNameInput.value.trim());
          } catch (e) {
            console.warn('Could not save pet name to localStorage:', e);
          }
        }
      });
    }
  }

  /**
   * Setup form submission lock to prevent file deletion during upload
   */
  function setupFormSubmitLock() {
    // Find all product forms (cart add forms)
    var forms = document.querySelectorAll('form[action*="/cart/add"]');

    for (var i = 0; i < forms.length; i++) {
      forms[i].addEventListener('submit', function(e) {
        var form = this;

        // CRITICAL FIX: Move file inputs into form before submit
        // File inputs must be inside <form> tag for Shopify to process them
        for (var sectionId in uploadState) {
          if (uploadState.hasOwnProperty(sectionId)) {
            var state = uploadState[sectionId];

            // Only process if files were uploaded via Quick Upload
            if (state.files && state.files.length > 0) {
              var fileInput = document.getElementById('quick-upload-input-' + sectionId);

              if (fileInput && fileInput.files.length > 0) {
                // Remove file input from current parent (pet-selector snippet)
                if (fileInput.parentNode) {
                  fileInput.parentNode.removeChild(fileInput);
                }

                // Append to form so Shopify can upload files to CDN
                form.appendChild(fileInput);

                console.log('📎 Quick Upload: Moved ' + fileInput.files.length + ' file(s) into form for submission');

                // DIAGNOSTIC LOGGING: Verify file input state before form submission
                var fileNames = [];
                for (var f = 0; f < fileInput.files.length; f++) {
                  fileNames.push(fileInput.files[f].name + ' (' + formatFileSize(fileInput.files[f].size) + ')');
                }

                console.log('📋 File input state before submit:', {
                  id: fileInput.id,
                  name: fileInput.getAttribute('name'),
                  hasNameAttribute: fileInput.hasAttribute('name'),
                  filesCount: fileInput.files.length,
                  fileNames: fileNames,
                  parentFormAction: fileInput.closest('form') ? fileInput.closest('form').action : 'NO FORM FOUND',
                  isInsideForm: !!fileInput.closest('form')
                });

                // Verify the name attribute is exactly what Shopify expects
                if (!fileInput.hasAttribute('name')) {
                  console.error('❌ CRITICAL: File input missing name attribute!');
                  fileInput.setAttribute('name', 'properties[_pet_image]');
                  console.log('✅ Fixed: Added name attribute back');
                } else if (fileInput.getAttribute('name') !== 'properties[_pet_image]') {
                  console.warn('⚠️ File input has unexpected name:', fileInput.getAttribute('name'));
                }
              }
            }
          }
        }

        // Lock all section states to prevent deletions during submission
        for (var sectionId in uploadState) {
          if (uploadState.hasOwnProperty(sectionId)) {
            uploadState[sectionId].locked = true;
          }
        }

        // Track if page is unloading (form redirect success)
        var unlocked = false;

        var beforeUnloadHandler = function() {
          unlocked = true; // Page is navigating away, don't unlock
        };

        window.addEventListener('beforeunload', beforeUnloadHandler);

        // Fallback: Unlock after 10s IF page hasn't unloaded
        // (handles form errors, slow networks, etc.)
        setTimeout(function() {
          if (!unlocked) {
            for (var sectionId in uploadState) {
              if (uploadState.hasOwnProperty(sectionId)) {
                uploadState[sectionId].locked = false;
              }
            }
          }
          // Cleanup listener
          window.removeEventListener('beforeunload', beforeUnloadHandler);
        }, 10000); // Increased to 10s for slow networks/large files
      });
    }
  }

  /**
   * Show toast notification
   */
  function showToast(message, type) {
    type = type || 'info';

    var toast = document.createElement('div');
    toast.className = 'quick-upload-toast';
    toast.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: ' + getToastColor(type) + '; color: white; padding: 16px 24px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; max-width: 90%; text-align: center; font-size: 15px; animation: slideUp 0.3s ease-out;';
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function() {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 4000);
  }

  /**
   * Announce error for screen readers (accessibility)
   */
  function announceError(message) {
    // Create or update aria-live region
    var liveRegion = document.getElementById('validation-announcer');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'validation-announcer';
      liveRegion.setAttribute('aria-live', 'assertive');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
      document.body.appendChild(liveRegion);
    }

    // Update text to trigger announcement
    liveRegion.textContent = message;

    // Clear after announcement
    setTimeout(function() {
      liveRegion.textContent = '';
    }, 1000);
  }

  /**
   * Get toast background color by type
   */
  function getToastColor(type) {
    var colors = {
      success: '#4CAF50',
      error: '#f44336',
      warning: '#FF9800',
      info: '#2196F3'
    };
    return colors[type] || colors.info;
  }

  /**
   * Format file size for display
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Add CSS animation for toast and focus styles
  if (!document.getElementById('quick-upload-toast-styles')) {
    var style = document.createElement('style');
    style.id = 'quick-upload-toast-styles';
    style.textContent = '@keyframes slideUp { from { bottom: -100px; opacity: 0; } to { bottom: 20px; opacity: 1; } }' +
      '.delete-file-btn:focus { outline: 3px solid #1976D2; outline-offset: 2px; }' +
      '.delete-file-btn:hover { background: #d32f2f; }' +
      '.delete-file-btn:active { transform: scale(0.9); transition: transform 0.1s; }';
    document.head.appendChild(style);
  }

})();
