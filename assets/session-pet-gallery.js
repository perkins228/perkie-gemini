/**
 * Session Pet Gallery
 * Displays previously processed pets for quick reuse on product pages
 * Part of Phase 1: Session Pet Gallery implementation
 *
 * Dependencies:
 * - PetStorage (pet-storage.js) - for getRecentPets(), getEffectDisplayName()
 */

(function() {
  'use strict';

  /**
   * Initialize session pet galleries on all pet detail sections
   */
  function initSessionPetGalleries() {
    // Check if PetStorage is available
    if (typeof window.PetStorage === 'undefined') {
      console.warn('[SessionPetGallery] PetStorage not available, skipping initialization');
      return;
    }

    // Get recent pets from storage
    var recentPets = window.PetStorage.getRecentPets(5);

    // If no recent pets, leave galleries hidden
    if (!recentPets || recentPets.length === 0) {
      console.log('[SessionPetGallery] No recent pets found, galleries will remain hidden');
      return;
    }

    console.log('[SessionPetGallery] Found ' + recentPets.length + ' recent pets');

    // Find all gallery containers
    var galleries = document.querySelectorAll('[data-session-gallery]');

    galleries.forEach(function(gallery) {
      var petIndex = gallery.getAttribute('data-session-gallery');
      initGallery(gallery, petIndex, recentPets);
    });
  }

  /**
   * Initialize a single gallery instance
   * @param {HTMLElement} gallery - Gallery container element
   * @param {string} petIndex - Pet index (1, 2, or 3)
   * @param {Array} recentPets - Array of recent pet objects
   */
  function initGallery(gallery, petIndex, recentPets) {
    var petsContainer = gallery.querySelector('[data-gallery-pets]');
    var toggleBtn = gallery.querySelector('[data-gallery-toggle]');

    if (!petsContainer) {
      console.warn('[SessionPetGallery] Pets container not found for index ' + petIndex);
      return;
    }

    // Populate gallery with pet cards
    populateGallery(petsContainer, recentPets, petIndex);

    // Show the gallery
    gallery.style.display = 'block';

    // Setup toggle functionality
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        toggleGallery(toggleBtn, petsContainer);
      });
    }
  }

  /**
   * Populate gallery with pet cards
   * @param {HTMLElement} container - Container for pet cards
   * @param {Array} pets - Array of pet objects
   * @param {string} petIndex - Pet index for this gallery
   */
  function populateGallery(container, pets, petIndex) {
    // Clear existing content
    container.innerHTML = '';

    pets.forEach(function(pet) {
      var card = createPetCard(pet, petIndex);
      container.appendChild(card);
    });
  }

  /**
   * Create a pet card element
   * @param {Object} pet - Pet data object
   * @param {string} petIndex - Pet index for click handling
   * @returns {HTMLElement} Pet card element
   */
  function createPetCard(pet, petIndex) {
    var card = document.createElement('div');
    card.className = 'session-pet-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'Use this pet');
    card.setAttribute('data-session-key', pet.sessionKey);
    card.setAttribute('data-selected-effect', pet.selectedEffect);

    // Build card HTML (badge removed per user request)
    var html = '<div class="session-pet-card__image-wrapper">' +
      '<button type="button" class="session-pet-card__delete" ' +
        'aria-label="Remove this pet from library" ' +
        'title="Remove from library">' +
        '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M1 1L11 11M1 11L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
        '</svg>' +
      '</button>' +
      '<img class="session-pet-card__image" ' +
        'src="' + escapeHtml(pet.thumbnailUrl) + '" ' +
        'alt="Previously processed pet" ' +
        'loading="lazy" ' +
        'onerror="this.parentElement.style.backgroundColor=\'#e5e7eb\'; this.style.display=\'none\';">' +
    '</div>';

    if (pet.ageText) {
      html += '<div class="session-pet-card__meta">' +
        '<span class="session-pet-card__age">' + escapeHtml(pet.ageText) + '</span>' +
      '</div>';
    }

    card.innerHTML = html;

    // Add delete button handler (must stop propagation to prevent card click)
    var deleteBtn = card.querySelector('.session-pet-card__delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        deletePet(pet.sessionKey, card);
      });
    }

    // Add click handler
    card.addEventListener('click', function() {
      selectPet(pet, petIndex);
    });

    // Add keyboard handler for accessibility
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectPet(pet, petIndex);
      }
    });

    return card;
  }

  /**
   * Delete a pet from the session library
   * @param {string} sessionKey - Pet session key to delete
   * @param {HTMLElement} card - Card element to remove from DOM
   */
  function deletePet(sessionKey, card) {
    // Simple confirmation dialog
    if (!confirm('Remove this pet from your library?')) {
      return;
    }

    console.log('[SessionPetGallery] Deleting pet:', sessionKey);

    // Delete from PetStorage
    if (window.PetStorage && typeof window.PetStorage.delete === 'function') {
      window.PetStorage.delete(sessionKey);
    }

    // Remove card from DOM with animation
    card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.8)';

    setTimeout(function() {
      if (card.parentNode) {
        var gallery = card.closest('[data-session-gallery]');
        card.parentNode.removeChild(card);

        // Hide gallery if no pets left
        if (gallery) {
          var remainingCards = gallery.querySelectorAll('.session-pet-card');
          if (remainingCards.length === 0) {
            gallery.style.display = 'none';
          }
        }
      }

      // Show confirmation toast
      showDeleteFeedback();
    }, 200);
  }

  /**
   * Show brief feedback when pet is deleted
   */
  function showDeleteFeedback() {
    var existingFeedback = document.querySelector('.session-pet-delete-feedback');
    if (existingFeedback) {
      existingFeedback.remove();
    }

    var feedback = document.createElement('div');
    feedback.className = 'session-pet-delete-feedback';
    feedback.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
      'background:#6b7280;color:white;padding:12px 24px;border-radius:8px;' +
      'font-weight:500;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);' +
      'animation:sessionFeedbackIn 0.3s ease;';
    feedback.textContent = 'Pet removed from library';

    document.body.appendChild(feedback);

    // Remove after 2 seconds
    setTimeout(function() {
      feedback.style.animation = 'sessionFeedbackOut 0.3s ease forwards';
      setTimeout(function() {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 300);
    }, 2000);
  }

  /**
   * Handle pet selection from gallery
   * @param {Object} pet - Selected pet data
   * @param {string} petIndex - Pet index to populate
   */
  function selectPet(pet, petIndex) {
    console.log('[SessionPetGallery] Selected pet:', pet.sessionKey, 'for index:', petIndex);

    // Find the pet detail section
    var petDetail = document.querySelector('[data-pet-index="' + petIndex + '"]');
    if (!petDetail) {
      console.error('[SessionPetGallery] Pet detail section not found for index:', petIndex);
      return;
    }

    // Store selected pet data for use by inline preview or product form
    var petData = {
      sessionKey: pet.sessionKey,
      selectedEffect: pet.selectedEffect,
      effects: pet.effects,
      artistNote: pet.artistNote || '',
      thumbnailUrl: pet.thumbnailUrl,
      fromSessionGallery: true
    };

    // Store in sessionStorage for inline preview to pick up
    sessionStorage.setItem('session_gallery_pet_' + petIndex, JSON.stringify(petData));

    // Dispatch custom event for other components to react
    var event = new CustomEvent('sessionPetSelected', {
      bubbles: true,
      detail: {
        petIndex: petIndex,
        petData: petData
      }
    });
    petDetail.dispatchEvent(event);

    // Update upload zone visual to show pet is selected
    updateUploadZoneForSelectedPet(petDetail, pet);

    // Show success feedback
    showSelectionFeedback(petDetail);
  }

  /**
   * Update upload zone to show selected pet
   * @param {HTMLElement} petDetail - Pet detail container
   * @param {Object} pet - Selected pet data
   */
  function updateUploadZoneForSelectedPet(petDetail, pet) {
    var uploadZone = petDetail.querySelector('[data-upload-zone]');
    var uploadText = petDetail.querySelector('[data-upload-text]');

    if (uploadZone) {
      // Add visual indicator that pet is selected
      uploadZone.classList.add('has-files');

      // Create or update preview thumbnail in upload zone
      var existingPreview = uploadZone.querySelector('.session-pet-preview');
      if (existingPreview) {
        existingPreview.remove();
      }

      var preview = document.createElement('div');
      preview.className = 'session-pet-preview';
      preview.style.cssText = 'display:flex;align-items:center;gap:8px;';

      var img = document.createElement('img');
      img.src = pet.thumbnailUrl;
      img.alt = 'Selected pet';
      img.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:4px;';

      var text = document.createElement('span');
      text.textContent = 'Pet selected';
      text.style.cssText = 'font-weight:600;color:#16a34a;';

      preview.appendChild(img);
      preview.appendChild(text);

      // Hide upload icon and text, show preview
      var uploadIcon = uploadZone.querySelector('.pet-detail__upload-icon');
      if (uploadIcon) uploadIcon.style.display = 'none';
      if (uploadText) uploadText.style.display = 'none';

      uploadZone.insertBefore(preview, uploadZone.firstChild);
    }

    // Enable the Preview button if it exists (since we already have processed images)
    var previewBtn = petDetail.querySelector('[data-pet-preview-btn]');
    if (previewBtn) {
      previewBtn.disabled = false;
      previewBtn.textContent = 'View Effects';
    }

    // Show the upload status wrapper
    var statusWrapper = petDetail.querySelector('[data-upload-status-wrapper]');
    if (statusWrapper) {
      statusWrapper.style.display = 'flex';

      var uploadStatus = statusWrapper.querySelector('[data-upload-status]');
      if (uploadStatus) {
        uploadStatus.innerHTML = '<span style="color:#16a34a;font-weight:500;">Using previously processed pet</span>';
      }
    }
  }

  /**
   * Show brief feedback when pet is selected
   * @param {HTMLElement} petDetail - Pet detail container
   */
  function showSelectionFeedback(petDetail) {
    // Find or create feedback element
    var existingFeedback = petDetail.querySelector('.session-pet-feedback');
    if (existingFeedback) {
      existingFeedback.remove();
    }

    var feedback = document.createElement('div');
    feedback.className = 'session-pet-feedback';
    feedback.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
      'background:#22c55e;color:white;padding:12px 24px;border-radius:8px;' +
      'font-weight:600;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);' +
      'animation:sessionFeedbackIn 0.3s ease;';
    feedback.textContent = 'Pet selected! Click "View Effects" to customize.';

    document.body.appendChild(feedback);

    // Remove after 3 seconds
    setTimeout(function() {
      feedback.style.animation = 'sessionFeedbackOut 0.3s ease forwards';
      setTimeout(function() {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Toggle gallery collapse/expand
   * @param {HTMLElement} toggleBtn - Toggle button element
   * @param {HTMLElement} petsContainer - Pets container element
   */
  function toggleGallery(toggleBtn, petsContainer) {
    var isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      // Collapse
      toggleBtn.setAttribute('aria-expanded', 'false');
      petsContainer.classList.add('collapsed');
    } else {
      // Expand
      toggleBtn.setAttribute('aria-expanded', 'true');
      petsContainer.classList.remove('collapsed');
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Add CSS animations for feedback
   */
  function addFeedbackAnimations() {
    if (document.getElementById('session-pet-gallery-animations')) return;

    var style = document.createElement('style');
    style.id = 'session-pet-gallery-animations';
    style.textContent = '@keyframes sessionFeedbackIn {' +
      'from { opacity: 0; transform: translateX(-50%) translateY(20px); }' +
      'to { opacity: 1; transform: translateX(-50%) translateY(0); }' +
    '}' +
    '@keyframes sessionFeedbackOut {' +
      'from { opacity: 1; transform: translateX(-50%) translateY(0); }' +
      'to { opacity: 0; transform: translateX(-50%) translateY(20px); }' +
    '}';
    document.head.appendChild(style);
  }

  /**
   * Clear session gallery selection for a pet index
   * Called when user uploads a new image
   * @param {string} petIndex - Pet index to clear
   */
  function clearSessionGallerySelection(petIndex) {
    sessionStorage.removeItem('session_gallery_pet_' + petIndex);

    var petDetail = document.querySelector('[data-pet-index="' + petIndex + '"]');
    if (!petDetail) return;

    var uploadZone = petDetail.querySelector('[data-upload-zone]');
    if (uploadZone) {
      // Remove selected preview
      var preview = uploadZone.querySelector('.session-pet-preview');
      if (preview) preview.remove();

      // Restore upload icon and text
      var uploadIcon = uploadZone.querySelector('.pet-detail__upload-icon');
      var uploadText = uploadZone.querySelector('[data-upload-text]');
      if (uploadIcon) uploadIcon.style.display = '';
      if (uploadText) uploadText.style.display = '';
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      addFeedbackAnimations();
      initSessionPetGalleries();
    });
  } else {
    addFeedbackAnimations();
    initSessionPetGalleries();
  }

  // Also reinitialize when pet count changes (for multi-pet products)
  document.addEventListener('petCountChanged', function() {
    setTimeout(initSessionPetGalleries, 100);
  });

  // Expose API for external use
  window.SessionPetGallery = {
    init: initSessionPetGalleries,
    clearSelection: clearSessionGallerySelection
  };

})();
