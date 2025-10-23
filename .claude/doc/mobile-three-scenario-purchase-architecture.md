# Mobile-First Three-Scenario Purchase Architecture
**Mobile Commerce Architect | Technical Specification**
**Date:** 2025-10-20
**Project:** Perkie Prints - Pet Product Purchase Flows
**Primary Target:** 70% Mobile Revenue Source

---

## Executive Summary

This document outlines a mobile-native technical architecture supporting three distinct customer purchase journeys on our pet product platform. The solution eliminates the current conversion blocker where ALL customers are forced through 3-11s AI processing before checkout, while maintaining data integrity (pet name requirement) and optimizing for mobile-first interactions.

**Three Scenarios:**
1. **Full AI Preview Flow** (Current, Working) - Upload → Process → Preview → Select → Cart
2. **Saved Pet Selection** (Current, Working) - One-click selection → Instant cart
3. **Quick Upload WITHOUT Preview** (NEW) - Upload only → Immediate cart → Async processing

**Critical Blocker Identified:**
`assets/cart-pet-integration.js` lines 194-228 disable add-to-cart button until `pet:selected` event fires, which currently only happens after full AI processing completes.

---

## 1. Current State Analysis

### 1.1 Existing Architecture Components

**Storage Layer:**
- `assets/pet-storage.js` - PetStorage class managing localStorage
- Structure: `perkie_pet_{petId}` with compressed thumbnails
- Fields: `petId, name, filename, thumbnail, gcsUrl, originalUrl, artistNote, effect, timestamp`

**Processing Layer:**
- `assets/pet-processor.js` - Main ES6+ processing orchestrator
- `assets/api-client.js` - Backend communication (InSPyReNet API)
- Cloud Run endpoint: `/api/v2/process-with-effects?return_all_effects=true`
- Returns 4 effects: `color, enhancedblackwhite, optimized_popart, dithering`

**Cart Integration Layer:**
- `assets/cart-pet-integration.js` - Form field population + button state management
- Event system: `pet:selected`, `pet:removed`, `cart:updated`
- Hidden form fields: `_pet_name, _font_style, _processed_image_url, _original_image_url, _artist_notes, _has_custom_pet, _effect_applied`

**UI Layer:**
- `snippets/ks-product-pet-selector.liquid` - Product page pet selector widget
- `sections/ks-pet-processor-v5.liquid` - Main processor page
- Mobile-optimized CSS with touch targets ≥44px

### 1.2 Current Blocker: Button Disable Logic

```javascript
// cart-pet-integration.js lines 194-228
initializeButtonState: function() {
  var petSelector = document.querySelector('[data-max-pets]');
  if (petSelector) {
    var hasSelectedPet = document.querySelector('[name="properties[_has_custom_pet]"]');
    if (!hasSelectedPet || hasSelectedPet.value !== 'true') {
      this.disableAddToCart(); // ❌ BLOCKER
    }
  }
},

disableAddToCart: function() {
  var buttons = document.querySelectorAll('form[action*="/cart/add"] button[name="add"]');
  for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    btn.disabled = true;
    btn.textContent = isMobile ? '👆 Tap your pet above' : '↑ Select your pet above';
  }
}
```

**Problem:** Button only enables when `pet:selected` event fires, which happens AFTER:
1. File upload completes (~1s)
2. API processing completes (3-11s)
3. Effects are rendered
4. User selects specific effect

**Impact on Mobile:**
- Users on 3G/4G experience 5-15s wait before they can even attempt checkout
- Many abandon during processing spinner
- No option for "I trust you, just take my order" flow

---

## 2. Three-Scenario Mobile Architecture

### 2.1 Scenario Decision Tree (Mobile UX)

```
Product Page Load
│
├─ Has saved pets in localStorage (<60 days)?
│  ├─ YES → Show Scenario 2A: Saved Pet Selection (Instant)
│  │        └─ One-click selection → Instant cart
│  │        └─ Option to switch to Scenario 1 or 3
│  │
│  └─ NO → Returning customer (>60 days)?
│           ├─ YES → Show Scenario 2B: Order Number Lookup
│           │        └─ Input: Pet name(s) + Order number
│           │        └─ Fetch previous order data → Populate cart
│           │
│           └─ NO → Show Upload Options Modal
│                    ├─ Option A: "Preview styles first" → Scenario 1
│                    └─ Option B: "Quick add to cart" → Scenario 3
│
└─ Upload initiated
   ├─ Scenario 1: Full AI Preview Flow
   │  └─ Upload → [3-11s processing] → Preview 4 effects → Select → Cart
   │
   ├─ Scenario 2A: Saved Pet Selection (Recent - <60 days)
   │  └─ One-click localStorage selection → Instant cart
   │
   ├─ Scenario 2B: Order Number Lookup (Returning - >60 days)
   │  └─ Input order # + pet names → API fetch → Populate fields → Cart
   │
   └─ Scenario 3: Quick Upload WITHOUT Preview
      └─ Upload (~1s) → Capture pet name → Immediate cart → Background processing
```

### 2.2 State Management Architecture

**New State Model:**
```javascript
// Extend PetStorage with processing states
class PetStorage {
  static ProcessingState = {
    UPLOADED_ONLY: 'uploaded_only',        // Scenario 3: File uploaded, no AI yet
    PROCESSING: 'processing',              // AI job in flight
    PROCESSED: 'processed',                // All effects available
    ERROR: 'error'                         // Processing failed
  };

  static save(petId, data) {
    const storageData = {
      petId,
      name: data.name || 'Pet',
      filename: data.filename || '',

      // NEW: Processing state tracking
      processingState: data.processingState || 'uploaded_only',

      // Conditional fields based on state
      originalFileUrl: data.originalFileUrl || '',      // Always present after upload
      thumbnail: data.thumbnail || '',                  // Compressed original (before AI)

      // Only present after processing completes
      gcsUrl: data.gcsUrl || '',                       // Cloud Storage processed image
      originalUrl: data.originalUrl || '',             // Cloud Storage original
      effects: data.effects || null,                   // Map of all 4 effects
      effect: data.effect || 'enhancedblackwhite',     // Selected effect

      artistNote: data.artistNote || '',
      timestamp: Date.now(),

      // NEW: Background job tracking
      processingJobId: data.processingJobId || null,
      processingAttempts: data.processingAttempts || 0,
      lastProcessingError: data.lastProcessingError || null
    };

    localStorage.setItem(this.storagePrefix + petId, JSON.stringify(storageData));
  }
}
```

---

## 3. Scenario 3: Quick Upload Architecture (NEW)

### 3.1 Mobile Interaction Flow

**Step 1: Upload Trigger**
```
Product Page
└─ Pet Selector Widget (empty state)
   └─ User taps "Add your pet photo"
      └─ Bottom Sheet Appears (thumb-zone optimized)
         ├─ [Preview styles first] ← Scenario 1
         └─ [Quick add to cart] ← Scenario 3 (NEW)
```

**Step 2: File Selection**
```javascript
// Mobile-optimized file input
<input type="file"
       accept="image/*"
       capture="environment"  // Opens camera on mobile
       id="quick-upload-input">
```

**Step 3: Inline Pet Name Capture (Modal)**
```
┌─────────────────────────────────┐
│  Add Your Pet                   │
│                                 │
│  Photo: fluffy_dog.jpg ✓        │
│                                 │
│  ┌───────────────────────────┐  │
│  │ What's your pet's name?   │  │  ← Auto-focus, mobile keyboard
│  └───────────────────────────┘  │
│                                 │
│  ┌─────────────────────────────┐│
│  │   Add to Cart (Continue)    ││  ← 48px tall, thumb-zone
│  └─────────────────────────────┘│
│                                 │
│  Or preview styles first →      │  ← Switch to Scenario 1
└─────────────────────────────────┘
```

**Step 4: Immediate Cart Addition**
```javascript
// Fire pet:selected event immediately after name captured
document.dispatchEvent(new CustomEvent('pet:selected', {
  detail: {
    name: petName,
    processingState: 'uploaded_only',
    originalFileUrl: URL.createObjectURL(file),
    thumbnail: compressedThumbnail,  // Client-side compress original
    gcsUrl: '',  // Will populate later
    effect: 'pending',  // User hasn't chosen yet
    processingJobId: jobId
  }
}));

// Button enables immediately
// User can complete checkout within 2-3 seconds of upload start
```

**Step 5: Background Processing**
```
User proceeds to checkout
     ↓
Order placed with pet data:
  - Pet name: "Fluffy" ✓
  - Original image: data URL ✓
  - Effect: "pending" ✓
     ↓
Background job continues:
  - Upload to GCS
  - Process with AI (3-11s)
  - Generate 4 effects
  - Update localStorage
  - Update order via webhook (optional)
```

### 3.2 Component Architecture

**New File: `assets/quick-upload-handler.js`**
```javascript
/**
 * Quick Upload Handler - Scenario 3
 * Enables instant cart addition without AI processing wait
 * ES5 compatible for max browser support
 */
(function() {
  'use strict';

  var QuickUploadHandler = {
    init: function() {
      this.setupUploadTriggers();
      this.setupBackgroundProcessing();
    },

    // Show bottom sheet with upload options
    showUploadOptions: function() {
      var sheet = this.createBottomSheet();
      sheet.show();
    },

    createBottomSheet: function() {
      // Mobile-native bottom sheet component
      // Thumb-zone optimized (buttons in bottom 1/3 of screen)
      var template = `
        <div class="bottom-sheet" id="upload-options-sheet">
          <div class="bottom-sheet__backdrop"></div>
          <div class="bottom-sheet__content">
            <div class="bottom-sheet__header">
              <h3>Upload Your Pet Photo</h3>
              <button class="bottom-sheet__close" aria-label="Close">×</button>
            </div>

            <div class="bottom-sheet__body">
              <button class="upload-option upload-option--quick"
                      data-scenario="quick">
                <div class="upload-option__icon">⚡</div>
                <div class="upload-option__text">
                  <strong>Quick Add to Cart</strong>
                  <small>Add now, we'll process in background</small>
                </div>
              </button>

              <button class="upload-option upload-option--preview"
                      data-scenario="preview">
                <div class="upload-option__icon">🎨</div>
                <div class="upload-option__text">
                  <strong>Preview Styles First</strong>
                  <small>See 4 effects before adding (5-15s)</small>
                </div>
              </button>
            </div>
          </div>
        </div>
      `;

      var container = document.createElement('div');
      container.innerHTML = template;
      document.body.appendChild(container.firstElementChild);

      return {
        show: function() {
          var sheet = document.getElementById('upload-options-sheet');
          setTimeout(function() {
            sheet.classList.add('active');
          }, 10);
        },
        hide: function() {
          var sheet = document.getElementById('upload-options-sheet');
          sheet.classList.remove('active');
          setTimeout(function() {
            sheet.remove();
          }, 300);
        }
      };
    },

    // Handle quick upload flow
    handleQuickUpload: function(file) {
      var self = this;

      // Show pet name capture modal
      this.showPetNameModal(file, function(petName) {
        if (!petName) return;

        // Generate unique pet ID
        var petId = 'pet_' + Date.now();

        // Compress thumbnail client-side
        self.compressImage(file, 200, 0.6, function(thumbnail) {

          // Save to localStorage immediately
          PetStorage.save(petId, {
            name: petName,
            filename: file.name,
            processingState: 'uploaded_only',
            originalFileUrl: URL.createObjectURL(file),
            thumbnail: thumbnail,
            timestamp: Date.now()
          });

          // Fire pet:selected event (enables cart button)
          document.dispatchEvent(new CustomEvent('pet:selected', {
            detail: {
              name: petName,
              processingState: 'uploaded_only',
              originalImage: thumbnail,
              thumbnail: thumbnail,
              effect: 'pending',
              petId: petId
            }
          }));

          // Start background processing
          self.startBackgroundProcessing(file, petId);

          // Show success feedback
          self.showSuccessToast('Pet added! Processing in background...');
        });
      });
    },

    // Pet name capture modal (inline)
    showPetNameModal: function(file, callback) {
      var modal = document.createElement('div');
      modal.className = 'pet-name-modal';
      modal.innerHTML = `
        <div class="pet-name-modal__backdrop"></div>
        <div class="pet-name-modal__content">
          <h3>Add Your Pet</h3>

          <div class="pet-name-modal__preview">
            <img src="${URL.createObjectURL(file)}" alt="Your pet">
            <span class="pet-name-modal__filename">${file.name}</span>
          </div>

          <div class="pet-name-modal__input-group">
            <label for="pet-name-input">What's your pet's name?</label>
            <input type="text"
                   id="pet-name-input"
                   placeholder="Enter pet name"
                   maxlength="50"
                   autocomplete="off"
                   autocapitalize="words">
          </div>

          <div class="pet-name-modal__actions">
            <button class="btn btn--primary btn--large" id="confirm-pet-name">
              Add to Cart
            </button>
            <button class="btn btn--secondary" id="preview-styles">
              Preview Styles First
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Auto-focus input
      var input = modal.querySelector('#pet-name-input');
      setTimeout(function() {
        modal.classList.add('active');
        input.focus();
      }, 10);

      // Confirm handler
      modal.querySelector('#confirm-pet-name').addEventListener('click', function() {
        var petName = input.value.trim();
        if (petName) {
          modal.remove();
          callback(petName);
        } else {
          input.classList.add('error');
          input.placeholder = 'Pet name is required';
        }
      });

      // Preview styles handler (switch to Scenario 1)
      modal.querySelector('#preview-styles').addEventListener('click', function() {
        modal.remove();
        // Redirect to full processor flow
        window.location.href = '/pages/custom-image-processing?file=' + encodeURIComponent(file.name);
      });

      // Enter key submit
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          modal.querySelector('#confirm-pet-name').click();
        }
      });
    },

    // Background processing orchestration
    startBackgroundProcessing: function(file, petId) {
      var self = this;

      // Update state
      var pet = PetStorage.get(petId);
      pet.processingState = 'processing';
      PetStorage.save(petId, pet);

      // Create FormData
      var formData = new FormData();
      formData.append('file', file);
      formData.append('effects', 'color,enhancedblackwhite,optimized_popart,dithering');
      formData.append('session_id', petId);

      // Call API (non-blocking)
      fetch('https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects?return_all_effects=true', {
        method: 'POST',
        body: formData,
        mode: 'cors'
      })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        // Update localStorage with processed results
        var pet = PetStorage.get(petId);
        pet.processingState = 'processed';
        pet.effects = data.effects;
        pet.gcsUrl = data.gcs_url || '';
        pet.originalUrl = data.original_url || '';
        pet.effect = 'enhancedblackwhite'; // Default

        PetStorage.save(petId, pet);

        // Optional: Show success notification
        self.showSuccessToast('✨ ' + pet.name + ' processing complete!');

        // Optional: Update cart item with GCS URL
        self.updateCartItemWithProcessedImage(petId);
      })
      .catch(function(error) {
        console.error('Background processing failed:', error);

        // Update state
        var pet = PetStorage.get(petId);
        pet.processingState = 'error';
        pet.lastProcessingError = error.message;
        pet.processingAttempts = (pet.processingAttempts || 0) + 1;

        PetStorage.save(petId, pet);

        // Retry logic (max 2 attempts)
        if (pet.processingAttempts < 2) {
          setTimeout(function() {
            self.startBackgroundProcessing(file, petId);
          }, 5000);
        }
      });
    },

    // Optional: Update cart item after processing completes
    updateCartItemWithProcessedImage: function(petId) {
      // This requires Shopify cart API or webhook integration
      // For now, processed image updates on next page load
      // Future enhancement: WebSocket or polling
    },

    // Utility: Client-side image compression
    compressImage: function(file, maxWidth, quality, callback) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var ctx = canvas.getContext('2d');

          var ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          var compressed = canvas.toDataURL('image/jpeg', quality);
          callback(compressed);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    },

    // Toast notification
    showSuccessToast: function(message) {
      var toast = document.createElement('div');
      toast.className = 'toast toast--success';
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(function() { toast.classList.add('active'); }, 10);
      setTimeout(function() {
        toast.classList.remove('active');
        setTimeout(function() { toast.remove(); }, 300);
      }, 3000);
    }
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      QuickUploadHandler.init();
    });
  } else {
    QuickUploadHandler.init();
  }

  window.QuickUploadHandler = QuickUploadHandler;

})();
```

### 3.3 Modified Cart Integration

**File: `assets/cart-pet-integration.js`**

Changes required at lines 194-228:

```javascript
// BEFORE (Current blocker):
initializeButtonState: function() {
  var petSelector = document.querySelector('[data-max-pets]');
  if (petSelector) {
    var hasSelectedPet = document.querySelector('[name="properties[_has_custom_pet]"]');
    if (!hasSelectedPet || hasSelectedPet.value !== 'true') {
      this.disableAddToCart(); // ❌ BLOCKS all scenarios
    }
  }
}

// AFTER (Support all 3 scenarios):
initializeButtonState: function() {
  var petSelector = document.querySelector('[data-max-pets]');
  if (petSelector) {
    var hasSelectedPet = document.querySelector('[name="properties[_has_custom_pet]"]');
    if (!hasSelectedPet || hasSelectedPet.value !== 'true') {
      this.disableAddToCart();
    } else {
      // ✅ Enable if pet is selected (any processing state)
      this.enableAddToCart();
    }
  }
},

// NEW: Update form fields to handle processing states
updateFormFields: function(petData) {
  if (!petData) return;

  var forms = document.querySelectorAll('form[action*="/cart/add"]');

  for (var i = 0; i < forms.length; i++) {
    var form = forms[i];

    // Pet name (REQUIRED - always present)
    var petNameField = form.querySelector('[name="properties[_pet_name]"]');
    if (!petNameField) {
      petNameField = document.createElement('input');
      petNameField.type = 'hidden';
      petNameField.name = 'properties[_pet_name]';
      form.appendChild(petNameField);
    }
    petNameField.value = petData.name || '';

    // Processing state (NEW)
    var processingStateField = form.querySelector('[name="properties[_processing_state]"]');
    if (!processingStateField) {
      processingStateField = document.createElement('input');
      processingStateField.type = 'hidden';
      processingStateField.name = 'properties[_processing_state]';
      form.appendChild(processingStateField);
    }
    processingStateField.value = petData.processingState || 'processed';

    // Processed image URL (conditional)
    var processedUrlField = form.querySelector('[name="properties[_processed_image_url]"]');
    if (!processedUrlField) {
      processedUrlField = document.createElement('input');
      processedUrlField.type = 'hidden';
      processedUrlField.name = 'properties[_processed_image_url]';
      form.appendChild(processedUrlField);
    }

    // Use GCS URL if available, fallback to thumbnail
    if (petData.gcsUrl) {
      processedUrlField.value = petData.gcsUrl;
    } else if (petData.thumbnail) {
      processedUrlField.value = petData.thumbnail;
    } else {
      processedUrlField.value = petData.originalImage || '';
    }

    // Effect applied (may be 'pending')
    var effectField = form.querySelector('[name="properties[_effect_applied]"]');
    if (!effectField) {
      effectField = document.createElement('input');
      effectField.type = 'hidden';
      effectField.name = 'properties[_effect_applied]';
      form.appendChild(effectField);
    }
    effectField.value = petData.effect || 'pending';

    // Has custom pet flag
    var hasCustomPetField = form.querySelector('[name="properties[_has_custom_pet]"]');
    if (!hasCustomPetField) {
      hasCustomPetField = document.createElement('input');
      hasCustomPetField.type = 'hidden';
      hasCustomPetField.name = 'properties[_has_custom_pet]';
      form.appendChild(hasCustomPetField);
    }
    hasCustomPetField.value = 'true';
  }
}
```

---

## 3.4 Scenario 2B: Order Number Lookup (NEW)

### 3.4.1 Business Context

**Customer Scenario:**
- Returning customer from >60 days ago
- Browser storage cleared (localStorage lost)
- Different device than original purchase
- Wants to reorder with same pet photo

**Current Pain Point:**
- Must re-upload and re-process pet photo
- 3-11s processing delay for a pet we already have
- Poor UX for repeat customers

**Solution:**
- Simple form: "Pet name(s)" + "Order number"
- Fetch order data via Shopify API
- Extract GCS image URLs from order properties
- Populate cart fields → Enable checkout

### 3.4.2 Mobile Interaction Flow

**Step 1: Detection & UI Trigger**
```
Product Page Load
  └─ Check localStorage for saved pets
      └─ None found
          └─ Show returning customer option:
              ┌────────────────────────────────┐
              │  Ordered before?               │
              │  [Reorder with previous pet]   │ ← Tap to open lookup form
              └────────────────────────────────┘
```

**Step 2: Order Lookup Form (Bottom Sheet)**
```
┌───────────────────────────────────┐
│  Reorder With Your Pet            │
│                                   │
│  Pet name(s)                      │
│  ┌─────────────────────────────┐  │
│  │ Bella, Milo                 │  │ ← Comma-separated for multiple pets
│  └─────────────────────────────┘  │
│                                   │
│  Order number                     │
│  ┌─────────────────────────────┐  │
│  │ 1001                        │  │ ← With or without #
│  └─────────────────────────────┘  │
│                                   │
│  ┌───────────────────────────────┐│
│  │   Find My Pet Photo           ││ ← 48px tall, thumb-zone
│  └───────────────────────────────┘│
│                                   │
│  Or upload new photo →            │ ← Switch to Scenario 1/3
└───────────────────────────────────┘
```

**Step 3: API Call & Loading State**
```javascript
// User inputs:
const petNames = "Bella, Milo";  // Comma-separated
const orderNumber = "1001";       // With or without #

// Show loading skeleton
showLoadingState();

// API call
const response = await fetch('/apps/perkie-order-lookup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderNumber: orderNumber.replace('#', ''),
    petNames: petNames.split(',').map(n => n.trim()),
    customerEmail: customer.email  // If logged in (optional validation)
  })
});

// Response (2-3s on mobile 4G)
const data = await response.json();
```

**Step 4: Success Response & Cart Population**
```json
{
  "success": true,
  "orderNumber": "1001",
  "orderDate": "2024-08-15",
  "pets": [
    {
      "name": "Bella",
      "processedImageUrl": "https://storage.googleapis.com/perkieprints-customer-images/processed_12345.png",
      "originalImageUrl": "https://storage.googleapis.com/perkieprints-customer-images/original_12345.jpg",
      "fontStyle": "classic",
      "effect": "enhancedblackwhite",
      "artistNotes": "Bright background, increase contrast"
    },
    {
      "name": "Milo",
      "processedImageUrl": "https://storage.googleapis.com/perkieprints-customer-images/processed_67890.png",
      "originalImageUrl": "https://storage.googleapis.com/perkieprints-customer-images/original_67890.jpg",
      "fontStyle": "modern",
      "effect": "color",
      "artistNotes": ""
    }
  ]
}
```

**Step 5: Frontend Population**
```javascript
// Populate hidden form fields
populateCartFields(data.pets);

// Fire pet:selected event
document.dispatchEvent(new CustomEvent('pet:selected', {
  detail: {
    name: data.pets.map(p => p.name).join(', '),
    processedImageUrl: data.pets[0].processedImageUrl,
    originalImageUrl: data.pets[0].originalImageUrl,
    fontStyle: data.pets[0].fontStyle,
    effect: data.pets[0].effect,
    artistNotes: data.pets.map(p => p.artistNotes).join(' | '),
    source: 'order_lookup'
  }
}));

// Enable add-to-cart button
enableAddToCart();

// Show success message
showSuccessToast('✓ Found your pets from order #1001!');
```

**Step 6: Error Handling**
```json
// Error responses
{
  "success": false,
  "error": "ORDER_NOT_FOUND",
  "message": "We couldn't find order #1001",
  "fallback": {
    "action": "quick_upload",
    "message": "No problem! Upload your pet photo instead",
    "buttonText": "Upload Photo"
  }
}

// Other error types:
// - "PETS_NOT_FOUND": Order exists but no pet data
// - "EMAIL_MISMATCH": Order exists but doesn't match customer
// - "INVALID_ORDER_NUMBER": Format error
// - "RATE_LIMIT": Too many lookups
```

### 3.4.3 Backend Implementation Options

**RECOMMENDED: Option B - Serverless Cloud Function**

**Why This Option:**
- ✅ Shopify API access (Admin API credentials)
- ✅ Fast response (2-3s vs 5s+ for Liquid)
- ✅ Secure (credentials server-side)
- ✅ Scalable (auto-scales with traffic)
- ✅ Cacheable (Redis/Memcache for frequent lookups)
- ✅ Error handling (structured JSON responses)
- ✅ Already have Cloud Run infrastructure

**Architecture:**
```
Mobile Client
    ↓
POST /api/retrieve-order-pets
    ↓
Cloud Run Function (Node.js/Python)
    ↓
Shopify Admin API
    ↓ (Get order by number)
Shopify Order Object
    ↓ (Extract line items with pet properties)
Filter & Transform
    ↓
JSON Response to Client
```

**New File: `backend/order-lookup-api/src/index.js`**
```javascript
/**
 * Order Lookup API for Perkie Prints
 * Retrieves pet data from previous Shopify orders
 */

const express = require('express');
const Shopify = require('shopify-api-node');
const app = express();

// Shopify credentials (from environment)
const shopify = new Shopify({
  shopName: process.env.SHOPIFY_SHOP,
  apiKey: process.env.SHOPIFY_API_KEY,
  password: process.env.SHOPIFY_API_PASSWORD
});

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://perkieprints.com');
  res.header('Access-Control-Allow-Methods', 'POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());

/**
 * POST /api/retrieve-order-pets
 * Body: { orderNumber, petNames, customerEmail }
 */
app.post('/api/retrieve-order-pets', async (req, res) => {
  try {
    const { orderNumber, petNames, customerEmail } = req.body;

    // Validation
    if (!orderNumber || !petNames) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'Order number and pet names are required'
      });
    }

    // Fetch order from Shopify
    const order = await shopify.order.list({
      name: `#${orderNumber}`,
      limit: 1
    });

    if (order.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: `We couldn't find order #${orderNumber}`,
        fallback: {
          action: 'quick_upload',
          message: 'No problem! Upload your pet photo instead',
          buttonText: 'Upload Photo'
        }
      });
    }

    const orderData = order[0];

    // Optional: Validate customer email
    if (customerEmail && orderData.customer) {
      if (orderData.customer.email !== customerEmail) {
        return res.status(403).json({
          success: false,
          error: 'EMAIL_MISMATCH',
          message: 'This order belongs to a different customer'
        });
      }
    }

    // Extract pet data from line items
    const petsData = [];
    const requestedPetNames = Array.isArray(petNames)
      ? petNames
      : petNames.split(',').map(n => n.trim());

    for (const lineItem of orderData.line_items) {
      const properties = lineItem.properties || [];

      // Find pet name property
      const petNameProp = properties.find(p =>
        p.name === '_pet_name' || p.name === 'Pet Name'
      );

      if (!petNameProp) continue;

      const petName = petNameProp.value;

      // Check if this pet is in the requested list
      if (!requestedPetNames.some(n =>
        n.toLowerCase() === petName.toLowerCase()
      )) {
        continue;
      }

      // Extract all pet properties
      const petData = {
        name: petName,
        processedImageUrl: '',
        originalImageUrl: '',
        fontStyle: 'classic',
        effect: 'enhancedblackwhite',
        artistNotes: ''
      };

      properties.forEach(prop => {
        switch(prop.name) {
          case '_processed_image_url':
            petData.processedImageUrl = prop.value;
            break;
          case '_original_image_url':
            petData.originalImageUrl = prop.value;
            break;
          case '_font_style':
            petData.fontStyle = prop.value;
            break;
          case '_effect_applied':
            petData.effect = prop.value;
            break;
          case '_artist_notes':
            petData.artistNotes = prop.value;
            break;
        }
      });

      // Validate we have image URLs
      if (petData.processedImageUrl || petData.originalImageUrl) {
        petsData.push(petData);
      }
    }

    // Check if we found any pets
    if (petsData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'PETS_NOT_FOUND',
        message: `Order #${orderNumber} doesn't contain pet photos`,
        fallback: {
          action: 'quick_upload',
          message: 'Upload your pet photo to continue',
          buttonText: 'Upload Photo'
        }
      });
    }

    // Success response
    res.json({
      success: true,
      orderNumber: orderNumber,
      orderDate: orderData.created_at.split('T')[0],
      pets: petsData
    });

  } catch (error) {
    console.error('Order lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Something went wrong. Please try again.',
      fallback: {
        action: 'quick_upload',
        message: 'Upload your pet photo instead',
        buttonText: 'Upload Photo'
      }
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Order lookup API running on port ${PORT}`);
});
```

**Deployment Configuration: `backend/order-lookup-api/Dockerfile`**
```dockerfile
FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "src/index.js"]
```

**Deploy Script: `backend/order-lookup-api/deploy.sh`**
```bash
#!/bin/bash
# Deploy order lookup API to Cloud Run

PROJECT_ID="perkieprints"
REGION="us-central1"
SERVICE_NAME="order-lookup-api"

# Build container
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars "SHOPIFY_SHOP=$SHOPIFY_SHOP,SHOPIFY_API_KEY=$SHOPIFY_API_KEY,SHOPIFY_API_PASSWORD=$SHOPIFY_API_PASSWORD" \
  --max-instances 10 \
  --min-instances 0 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 10s

echo "Deployed to: https://$SERVICE_NAME-[hash].$REGION.run.app"
```

### 3.4.4 Frontend Component

**New File: `assets/order-lookup-handler.js`**
```javascript
/**
 * Order Lookup Handler - Scenario 2B
 * Enables returning customers to reuse previous pet photos
 * ES5 compatible
 */
(function() {
  'use strict';

  var OrderLookupHandler = {
    apiEndpoint: 'https://order-lookup-api-[hash].us-central1.run.app/api/retrieve-order-pets',

    init: function() {
      this.setupTriggers();
    },

    // Show order lookup form
    showLookupForm: function() {
      var modal = this.createLookupModal();
      document.body.appendChild(modal);

      setTimeout(function() {
        modal.classList.add('active');
        modal.querySelector('#pet-names-input').focus();
      }, 10);
    },

    createLookupModal: function() {
      var modal = document.createElement('div');
      modal.className = 'order-lookup-modal';
      modal.innerHTML = `
        <div class="order-lookup-modal__backdrop"></div>
        <div class="order-lookup-modal__content">
          <button class="order-lookup-modal__close" aria-label="Close">×</button>

          <h3>Reorder With Your Pet</h3>
          <p class="order-lookup-modal__description">
            We'll find your pet photo from a previous order
          </p>

          <form id="order-lookup-form" class="order-lookup-form">
            <div class="form-group">
              <label for="pet-names-input">Pet name(s)</label>
              <input
                type="text"
                id="pet-names-input"
                placeholder="Bella, Milo"
                autocomplete="off"
                autocapitalize="words"
                required
              >
              <small>Separate multiple names with commas</small>
            </div>

            <div class="form-group">
              <label for="order-number-input">Order number</label>
              <input
                type="text"
                id="order-number-input"
                placeholder="1001"
                autocomplete="off"
                pattern="[0-9#]+"
                required
              >
              <small>Found in your order confirmation email</small>
            </div>

            <button type="submit" class="btn btn--primary btn--large">
              Find My Pet Photo
            </button>

            <button type="button" class="btn btn--secondary" id="upload-instead-btn">
              Upload New Photo Instead
            </button>
          </form>

          <div id="lookup-loading" class="lookup-loading" style="display: none;">
            <div class="spinner"></div>
            <p>Searching for your pet...</p>
          </div>

          <div id="lookup-error" class="lookup-error" style="display: none;">
            <p class="error-message"></p>
            <button class="btn btn--secondary" id="retry-lookup-btn">Try Again</button>
          </div>
        </div>
      `;

      var self = this;

      // Form submit
      modal.querySelector('#order-lookup-form').addEventListener('submit', function(e) {
        e.preventDefault();
        self.handleLookup(modal);
      });

      // Close button
      modal.querySelector('.order-lookup-modal__close').addEventListener('click', function() {
        modal.remove();
      });

      // Upload instead
      modal.querySelector('#upload-instead-btn').addEventListener('click', function() {
        modal.remove();
        // Trigger upload flow (Scenario 1 or 3)
        if (window.QuickUploadHandler) {
          window.QuickUploadHandler.showUploadOptions();
        }
      });

      return modal;
    },

    handleLookup: async function(modal) {
      var petNamesInput = modal.querySelector('#pet-names-input');
      var orderNumberInput = modal.querySelector('#order-number-input');
      var form = modal.querySelector('#order-lookup-form');
      var loading = modal.querySelector('#lookup-loading');
      var errorDiv = modal.querySelector('#lookup-error');

      var petNames = petNamesInput.value.trim();
      var orderNumber = orderNumberInput.value.trim().replace('#', '');

      if (!petNames || !orderNumber) {
        this.showError(modal, 'Please fill in all fields');
        return;
      }

      // Show loading
      form.style.display = 'none';
      loading.style.display = 'block';
      errorDiv.style.display = 'none';

      var self = this;

      try {
        var response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            orderNumber: orderNumber,
            petNames: petNames,
            customerEmail: window.Shopify?.customer?.email || null
          })
        });

        var data = await response.json();

        if (data.success) {
          // Success! Populate cart
          self.populateCartWithOrderData(data);
          modal.remove();
          self.showSuccessToast('✓ Found your pet from order #' + data.orderNumber);
        } else {
          // Error response
          self.showError(modal, data.message || 'Order not found', data.fallback);
        }

      } catch (error) {
        console.error('Order lookup failed:', error);
        self.showError(modal, 'Connection error. Please try again.');
      }

      // Hide loading
      loading.style.display = 'none';
    },

    showError: function(modal, message, fallback) {
      var form = modal.querySelector('#order-lookup-form');
      var errorDiv = modal.querySelector('#lookup-error');
      var errorMessage = errorDiv.querySelector('.error-message');

      form.style.display = 'none';
      errorDiv.style.display = 'block';
      errorMessage.textContent = message;

      // Show fallback button if provided
      if (fallback && fallback.action === 'quick_upload') {
        var retryBtn = errorDiv.querySelector('#retry-lookup-btn');
        retryBtn.textContent = fallback.buttonText || 'Upload Photo';
        retryBtn.onclick = function() {
          modal.remove();
          if (window.QuickUploadHandler) {
            window.QuickUploadHandler.showUploadOptions();
          }
        };
      }
    },

    populateCartWithOrderData: function(data) {
      if (!data.pets || data.pets.length === 0) return;

      // Build pet data object for cart integration
      var petData = {
        name: data.pets.map(function(p) { return p.name; }).join(', '),
        processedImageUrl: data.pets[0].processedImageUrl,
        originalImageUrl: data.pets[0].originalImageUrl,
        fontStyle: data.pets[0].fontStyle,
        effect: data.pets[0].effect,
        artistNotes: data.pets.map(function(p) {
          return p.artistNotes;
        }).filter(function(n) {
          return n;
        }).join(' | '),
        source: 'order_lookup',
        processingState: 'processed'
      };

      // Fire pet:selected event (enables cart button)
      document.dispatchEvent(new CustomEvent('pet:selected', {
        detail: petData
      }));

      // Optional: Save to localStorage for future use
      if (window.PetStorage) {
        data.pets.forEach(function(pet) {
          var petId = 'pet_order_' + Date.now() + '_' + pet.name.replace(/\s/g, '');
          window.PetStorage.save(petId, {
            name: pet.name,
            processingState: 'processed',
            gcsUrl: pet.processedImageUrl,
            originalUrl: pet.originalImageUrl,
            effect: pet.effect,
            fontStyle: pet.fontStyle,
            artistNote: pet.artistNotes,
            timestamp: Date.now()
          });
        });
      }
    },

    showSuccessToast: function(message) {
      var toast = document.createElement('div');
      toast.className = 'toast toast--success';
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(function() { toast.classList.add('active'); }, 10);
      setTimeout(function() {
        toast.classList.remove('active');
        setTimeout(function() { toast.remove(); }, 300);
      }, 3000);
    },

    setupTriggers: function() {
      // Add "Ordered before?" link to product pages
      var self = this;
      var petSelector = document.querySelector('[data-max-pets]');

      if (petSelector && !window.PetStorage.hasAnyPets()) {
        var link = document.createElement('button');
        link.className = 'order-lookup-trigger';
        link.textContent = 'Ordered before? Reuse your pet photo →';
        link.onclick = function() {
          self.showLookupForm();
        };

        petSelector.appendChild(link);
      }
    }
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      OrderLookupHandler.init();
    });
  } else {
    OrderLookupHandler.init();
  }

  window.OrderLookupHandler = OrderLookupHandler;

})();
```

### 3.4.5 Mobile UX Specifications

**Form Input Optimization:**
```css
/* Mobile-optimized inputs */
.order-lookup-form input {
  font-size: 16px;  /* Prevents iOS zoom */
  padding: 14px 16px;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
  width: 100%;
}

.order-lookup-form input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Touch-friendly buttons */
.order-lookup-form .btn {
  min-height: 48px;
  width: 100%;
  margin-top: 12px;
}
```

**Input Types & Attributes:**
```html
<!-- Pet names: Text with word capitalization -->
<input
  type="text"
  autocomplete="off"
  autocapitalize="words"
  spellcheck="false"
>

<!-- Order number: Numeric keyboard on mobile -->
<input
  type="text"
  inputmode="numeric"
  pattern="[0-9#]+"
  autocomplete="off"
>
```

**Loading States:**
```html
<!-- Skeleton loader during API call (2-3s) -->
<div class="lookup-loading">
  <div class="skeleton-image"></div>
  <div class="skeleton-text"></div>
  <div class="skeleton-text"></div>
</div>
```

### 3.4.6 Performance Metrics

**Time to Cart (Scenario 2B):**
```
User input time:           3-4s (typing pet names + order #)
API request/response:      2-3s (Shopify API + Cloud Run)
Frontend population:       <100ms (form fields + event dispatch)
Total:                     5-7s ✅

Compare to:
- Scenario 1 (Full preview):  18s (3-11s processing + user selection)
- Scenario 3 (Quick upload):  5s (upload + name capture)
- Scenario 2A (localStorage): 0.5s (instant)
```

**Network Optimization:**
```javascript
// Cache successful lookups (5-minute TTL)
const LOOKUP_CACHE = new Map();

function getCacheKey(orderNumber, petNames) {
  return `${orderNumber}_${petNames.sort().join(',')}`;
}

async function lookupOrder(orderNumber, petNames) {
  const cacheKey = getCacheKey(orderNumber, petNames);

  // Check cache first
  if (LOOKUP_CACHE.has(cacheKey)) {
    const cached = LOOKUP_CACHE.get(cacheKey);
    if (Date.now() - cached.timestamp < 300000) { // 5 minutes
      return cached.data;
    }
  }

  // Fetch from API
  const data = await fetch(...);

  // Cache result
  LOOKUP_CACHE.set(cacheKey, {
    data: data,
    timestamp: Date.now()
  });

  return data;
}
```

### 3.4.7 Security Considerations

**Rate Limiting:**
```javascript
// Backend: Express rate limiter
const rateLimit = require('express-rate-limit');

const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 lookups per IP per 15 minutes
  message: {
    success: false,
    error: 'RATE_LIMIT',
    message: 'Too many lookup attempts. Please try again later.'
  }
});

app.post('/api/retrieve-order-pets', lookupLimiter, async (req, res) => {
  // ...
});
```

**Customer Validation:**
```javascript
// Optional: Verify customer owns the order
if (customerEmail && orderData.customer) {
  if (orderData.customer.email !== customerEmail) {
    return res.status(403).json({
      success: false,
      error: 'EMAIL_MISMATCH',
      message: 'This order belongs to a different customer'
    });
  }
}
```

**Data Exposure Prevention:**
```javascript
// Only return pet-related properties, not full order data
const petsData = extractPetData(order.line_items);

// DON'T return:
// - Customer address
// - Payment info
// - Other order items
// - Shipping details

// DO return:
// - Pet names
// - GCS image URLs (public bucket)
// - Font styles
// - Effects applied
```

### 3.4.8 Error Handling & Recovery

**Error States Matrix:**

| Error Type | Cause | User Message | Recovery Action |
|------------|-------|--------------|-----------------|
| ORDER_NOT_FOUND | Invalid order number | "We couldn't find order #1001" | Retry or upload new photo |
| PETS_NOT_FOUND | Order has no pet data | "This order doesn't contain pet photos" | Upload new photo |
| EMAIL_MISMATCH | Order belongs to different customer | "This order belongs to another account" | Login or contact support |
| INVALID_ORDER_NUMBER | Format error | "Please enter a valid order number" | Inline validation hint |
| RATE_LIMIT | Too many attempts | "Too many tries. Wait 15 minutes." | Show countdown timer |
| SERVER_ERROR | API/network failure | "Something went wrong. Try again." | Retry button |
| NETWORK_OFFLINE | No internet connection | "You're offline. Check connection." | Auto-retry when online |

**Inline Validation:**
```javascript
// Real-time validation before submit
orderNumberInput.addEventListener('blur', function() {
  const value = this.value.trim();

  // Must be numeric (with optional #)
  if (!/^#?\d+$/.test(value)) {
    showFieldError(this, 'Order numbers are numeric (e.g., 1001)');
  }

  // Reasonable range (4-6 digits typical)
  const num = parseInt(value.replace('#', ''));
  if (num < 1000 || num > 999999) {
    showFieldError(this, 'Please check your order number');
  }
});
```

**Offline Resilience:**
```javascript
// Detect offline before submitting
if (!navigator.onLine) {
  showError(modal, 'You're offline. Please check your connection.');

  // Listen for online event
  window.addEventListener('online', function() {
    showSuccessToast('Back online! Try your lookup again.');
  }, { once: true });

  return;
}
```

### 3.4.9 Multi-Pet Support

**Handling Multiple Pets:**
```javascript
// User input: "Bella, Milo, Max"
const petNames = "Bella, Milo, Max";

// API finds all 3 pets in order #1001
const response = {
  success: true,
  orderNumber: "1001",
  pets: [
    { name: "Bella", processedImageUrl: "...", ... },
    { name: "Milo", processedImageUrl: "...", ... },
    { name: "Max", processedImageUrl: "...", ... }
  ]
};

// Frontend populates form with primary pet (first)
// But stores all 3 in properties for cart
properties[_pet_name] = "Bella, Milo, Max"
properties[_processed_image_url] = response.pets[0].processedImageUrl
properties[_all_pets_data] = JSON.stringify(response.pets)  // New field
```

**Cart Display:**
```liquid
<!-- Cart drawer shows all pets -->
{% assign all_pets = item.properties._all_pets_data | parse_json %}
{% if all_pets %}
  <div class="cart-item__pets">
    {% for pet in all_pets %}
      <div class="cart-item__pet">
        <img src="{{ pet.processedImageUrl }}" alt="{{ pet.name }}">
        <span>{{ pet.name }}</span>
      </div>
    {% endfor %}
  </div>
{% endif %}
```

---

## 4. Mobile UI/UX Patterns

### 4.1 Bottom Sheet Component

**Design Specs:**
```css
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  transform: translateY(100%);
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.bottom-sheet.active {
  transform: translateY(0);
}

.bottom-sheet__backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 300ms;
}

.bottom-sheet.active .bottom-sheet__backdrop {
  opacity: 1;
}

.bottom-sheet__content {
  background: white;
  border-radius: 24px 24px 0 0;
  padding: 24px;
  max-height: 85vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  /* Thumb-zone optimization */
  padding-bottom: max(24px, env(safe-area-inset-bottom));
}

.upload-option {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 20px;
  margin-bottom: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: white;
  text-align: left;

  /* Touch target */
  min-height: 72px;

  /* Haptic feedback */
  transition: transform 100ms, background 200ms;
}

.upload-option:active {
  transform: scale(0.98);
  background: #f9fafb;
}

.upload-option__icon {
  font-size: 32px;
  flex-shrink: 0;
}

.upload-option__text strong {
  display: block;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.upload-option__text small {
  display: block;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.3;
}
```

### 4.2 Pet Name Modal

**Design Specs:**
```css
.pet-name-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 300ms;
}

.pet-name-modal.active {
  opacity: 1;
}

.pet-name-modal__backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
}

.pet-name-modal__content {
  position: relative;
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin: 16px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.pet-name-modal__preview {
  margin: 16px 0;
  text-align: center;
}

.pet-name-modal__preview img {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  object-fit: cover;
}

.pet-name-modal__input-group {
  margin: 20px 0;
}

.pet-name-modal__input-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #374151;
}

.pet-name-modal__input-group input {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 16px; /* Prevents zoom on iOS */
  transition: border-color 200ms;
}

.pet-name-modal__input-group input:focus {
  outline: none;
  border-color: #3b82f6;
}

.pet-name-modal__input-group input.error {
  border-color: #ef4444;
  animation: shake 400ms;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}

.pet-name-modal__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pet-name-modal__actions .btn {
  width: 100%;
  min-height: 48px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
}

.btn--primary {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn--secondary {
  background: white;
  color: #374151;
  border: 2px solid #e5e7eb;
}
```

### 4.3 Toast Notifications

**Design Specs:**
```css
.toast {
  position: fixed;
  bottom: 80px; /* Above bottom nav */
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  padding: 14px 20px;
  background: #1f2937;
  color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  z-index: 9998;
  opacity: 0;
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 300ms;
  max-width: calc(100% - 32px);
  text-align: center;
}

.toast.active {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

.toast--success {
  background: #10b981;
}

.toast--error {
  background: #ef4444;
}
```

---

## 5. Network Resilience & Error Handling

### 5.1 Offline Scenario Handling

**Problem:** User uploads file, loses connection, tries to add to cart.

**Solution:**
```javascript
// Check online status before upload
if (!navigator.onLine) {
  showErrorToast('You're offline. Please check your connection.');
  return;
}

// Store file data for retry
if (!navigator.onLine && processingState === 'uploaded_only') {
  // Allow cart addition with warning
  showWarningToast('Added to cart. Processing will start when online.');
}

// Listen for online event
window.addEventListener('online', function() {
  // Retry failed processing jobs
  retryFailedProcessingJobs();
});
```

### 5.2 Upload Success, Processing Failure

**Problem:** File uploads to GCS, but AI processing fails.

**Solution:**
```javascript
startBackgroundProcessing: function(file, petId) {
  // ... upload succeeds ...

  fetch(apiUrl)
    .then(function(response) { return response.json(); })
    .then(function(data) {
      // Success path
    })
    .catch(function(error) {
      // Update state to error
      var pet = PetStorage.get(petId);
      pet.processingState = 'error';
      pet.lastProcessingError = error.message;
      pet.processingAttempts++;

      PetStorage.save(petId, pet);

      // Retry with exponential backoff
      if (pet.processingAttempts < 3) {
        var delay = Math.pow(2, pet.processingAttempts) * 2000;
        setTimeout(function() {
          self.startBackgroundProcessing(file, petId);
        }, delay);
      } else {
        // Max retries reached - notify user
        showErrorToast('Processing failed. We'll fix this for you!');

        // Send error to backend for manual processing
        reportProcessingFailure(petId, error);
      }
    });
}
```

### 5.3 Progressive Enhancement Strategy

**Level 1: Baseline (All Browsers)**
- File upload works
- Pet name capture works
- Cart addition works with original image thumbnail
- Order contains all data for manual processing

**Level 2: Enhanced (Modern Browsers)**
- Background processing with fetch API
- LocalStorage state management
- Toast notifications
- Bottom sheet UI

**Level 3: Premium (Latest Browsers)**
- ServiceWorker for offline support
- WebSocket for real-time processing updates
- Push notifications when processing completes
- IndexedDB for larger image storage

---

## 6. Performance Optimization

### 6.1 Mobile Network Considerations

**3G Performance (1.6 Mbps download):**
```
Scenario 1 (Full Preview):
  - 5MB image upload: 25s
  - API processing: 3-11s
  - Total: 28-36s before cart

Scenario 2 (Saved Pet):
  - localStorage read: <100ms
  - Total: ~100ms to cart ✅

Scenario 3 (Quick Upload):
  - File read + compress: ~1s
  - Pet name input: ~3s (user)
  - Total: ~4s to cart ✅
  - Background processing: continues async
```

**4G Performance (20 Mbps download):**
```
Scenario 3 (Quick Upload):
  - File read + compress: ~500ms
  - Pet name input: ~3s (user)
  - Total: ~3.5s to cart ✅
```

### 6.2 Code Splitting Strategy

**Critical Path (Loaded immediately):**
- `cart-pet-integration.js` (5KB gzipped)
- `pet-storage.js` (3KB gzipped)
- Base product page scripts

**Lazy Loaded (On interaction):**
- `quick-upload-handler.js` (8KB gzipped) - Load when upload triggered
- `pet-processor.js` (15KB gzipped) - Load only for Scenario 1
- `api-client.js` (4KB gzipped) - Load with upload handler

**Total Critical JS:** ~8KB (instant parse on mobile)
**Total Lazy JS:** ~27KB (loads on demand)

### 6.3 Image Compression Strategy

**Client-Side Compression (Before Storage):**
```javascript
// Original image: 5MB (4000x3000)
// ↓ Compress for thumbnail
// Thumbnail: 50KB (200x150, JPEG 60% quality)
// ↓ Store in localStorage
// Storage cost: ~70KB (base64 encoded)

// vs. Current approach:
// Store full data URL: 6.7MB base64
// localStorage quota: 5-10MB total
// Result: Quota exceeded errors ❌
```

**Benefits:**
- 98% size reduction
- Fits 70+ pets in localStorage
- Instant page loads
- No quota errors

---

## 7. API Integration Strategy

### 7.1 Background Processing Endpoint

**Current Endpoint:**
```
POST /api/v2/process-with-effects?return_all_effects=true

Request:
  - FormData with file
  - effects: 'color,enhancedblackwhite,optimized_popart,dithering'
  - session_id: pet ID

Response (JSON):
  - effects: { color: base64, enhancedblackwhite: base64, ... }
  - gcs_url: Cloud Storage URL (processed)
  - original_url: Cloud Storage URL (original)
  - processing_time: 3.2s
```

**No Changes Required** - Existing endpoint supports async processing.

**Flow:**
1. Quick upload handler calls endpoint
2. User proceeds to checkout (doesn't wait)
3. API processes in background
4. Response updates localStorage
5. Next page load shows processed images

### 7.2 Optional: Order Update Webhook

**Problem:** Order placed with `effect: "pending"`, but customer wants to see final effect.

**Solution (Future Enhancement):**
```javascript
// Backend webhook endpoint
POST /shopify/webhooks/update-order-pet-image

Request:
  - order_id: Shopify order ID
  - pet_id: Our pet ID
  - gcs_url: Processed image URL
  - effect: Selected effect (or default)

Action:
  - Update order metafields with processed image
  - Optional: Email customer with preview
```

**Requires:**
- Shopify API integration
- Backend webhook handler
- Order metafield schema

**Priority:** Low (orders already have original images for fulfillment)

---

## 8. Code Organization Recommendations

### 8.1 File Structure

```
assets/
├── cart-pet-integration.js          [MODIFY] Add processing state support
├── pet-storage.js                   [MODIFY] Add state tracking fields
├── quick-upload-handler.js          [NEW] Scenario 3 orchestration
├── order-lookup-handler.js          [NEW] Scenario 2B order lookup
├── upload-options-ui.js             [NEW] Bottom sheet component
├── pet-name-capture.js              [NEW] Modal component
├── background-processor.js          [NEW] Async processing logic
└── toast-notifications.js           [NEW] Toast UI component

styles/
├── quick-upload.css                 [NEW] Scenario 3 styles
├── order-lookup-modal.css           [NEW] Scenario 2B modal styles
├── bottom-sheet.css                 [NEW] Bottom sheet component
├── pet-name-modal.css               [NEW] Modal styles
└── toast.css                        [NEW] Toast notifications

snippets/
└── ks-product-pet-selector.liquid   [MODIFY] Add upload options + order lookup trigger

sections/
└── ks-pet-processor-v5.liquid       [NO CHANGE] Scenario 1 still works

backend/
└── order-lookup-api/                [NEW] Scenario 2B backend
    ├── src/
    │   └── index.js                 [NEW] Express server with Shopify API
    ├── Dockerfile                   [NEW] Cloud Run container
    ├── deploy.sh                    [NEW] Deployment script
    └── package.json                 [NEW] Dependencies
```

### 8.2 Module Dependencies

```
CartPetIntegration (existing)
  ├─ depends on: PetStorage
  └─ listens to: pet:selected, pet:removed

QuickUploadHandler (new - Scenario 3)
  ├─ depends on: PetStorage
  ├─ depends on: UploadOptionsUI
  ├─ depends on: PetNameCapture
  ├─ depends on: BackgroundProcessor
  └─ emits: pet:selected

OrderLookupHandler (new - Scenario 2B)
  ├─ depends on: PetStorage (optional, for caching)
  ├─ depends on: OrderLookupAPI (backend)
  └─ emits: pet:selected

BackgroundProcessor (new)
  ├─ depends on: APIClient (or fetch directly)
  ├─ depends on: PetStorage
  └─ emits: processing:complete, processing:error

UploadOptionsUI (new)
  └─ emits: scenario:selected

PetNameCapture (new)
  └─ emits: name:captured, cancelled

OrderLookupAPI (backend - new)
  ├─ depends on: Shopify Admin API
  ├─ depends on: Express rate limiter
  └─ returns: Pet data JSON
```

### 8.3 Event Architecture

```javascript
// Existing events (keep)
'pet:selected'        // Fired when pet chosen (any scenario)
'pet:removed'         // Fired when pet deselected
'cart:updated'        // Fired after add to cart
'cart-drawer:opened'  // Fired when cart drawer opens

// New events (add)
'upload:started'      // File selection complete
'upload:scenario-selected'  // User chose quick vs preview
'processing:started'  // Background job started (Scenario 3)
'processing:progress' // Progress update (optional)
'processing:complete' // Background job done
'processing:error'    // Background job failed
'name:captured'       // Pet name entered
'order:lookup-started' // Order lookup initiated (Scenario 2B)
'order:lookup-success' // Order lookup found pet data
'order:lookup-failed'  // Order lookup failed
```

---

## 9. Testing Strategy

### 9.1 Mobile Device Testing Matrix

**Devices:**
- iPhone 12 Pro (iOS 16) - Safari
- iPhone SE (iOS 15) - Safari (small screen)
- Samsung Galaxy S21 (Android 12) - Chrome
- Samsung Galaxy A52 (Android 11) - Chrome (mid-tier)
- Google Pixel 6 (Android 13) - Chrome

**Network Conditions:**
- Fast 3G (1.6 Mbps)
- Slow 4G (4 Mbps)
- Fast 4G (20 Mbps)
- Offline → Online transition

**Test Cases:**

**TC1: Quick Upload - Happy Path**
1. Open product page on mobile
2. Tap "Add your pet photo"
3. Select "Quick add to cart"
4. Choose photo from gallery
5. Enter pet name "Fluffy"
6. Tap "Add to Cart"
7. Verify: Button enables within 2s
8. Verify: Can complete checkout
9. Verify: Background processing continues
10. Verify: Toast appears when complete

**TC2: Quick Upload - Offline**
1. Open product page
2. Enable airplane mode
3. Tap "Add your pet photo"
4. Verify: Offline warning appears
5. Verify: Upload disabled
6. Disable airplane mode
7. Verify: Upload re-enables

**TC3: Quick Upload - Processing Failure**
1. Mock API to return 500 error
2. Upload photo + enter name
3. Verify: Cart addition succeeds
4. Verify: Retry logic fires
5. Verify: Max 3 retry attempts
6. Verify: Error notification after max retries

**TC4: Scenario Switching**
1. Tap "Add your pet photo"
2. Select "Quick add to cart"
3. In name modal, tap "Preview styles first"
4. Verify: Redirects to Scenario 1 flow
5. Verify: Full processor loads

**TC5: Saved Pet Selection (Scenario 2A)**
1. Complete Scenario 3 (have saved pet)
2. Navigate to different product
3. Verify: Saved pet appears
4. Tap saved pet
5. Verify: Instant cart button enable (<100ms)

**TC6: Order Lookup - Happy Path (Scenario 2B)**
1. Open product page on mobile (no saved pets)
2. Tap "Ordered before? Reuse your pet photo"
3. Enter pet name(s): "Bella, Milo"
4. Enter order number: "1001"
5. Tap "Find My Pet Photo"
6. Verify: Loading state appears (2-3s)
7. Verify: Success toast "Found your pets from order #1001"
8. Verify: Cart button enables
9. Verify: Pet data saved to localStorage (future use)

**TC7: Order Lookup - Order Not Found**
1. Open order lookup form
2. Enter invalid order number: "9999999"
3. Tap "Find My Pet Photo"
4. Verify: Error message "We couldn't find order #9999999"
5. Verify: Fallback button "Upload Photo" appears
6. Tap fallback button
7. Verify: Redirects to upload flow (Scenario 1 or 3)

**TC8: Order Lookup - Rate Limiting**
1. Attempt 11 order lookups in 15 minutes
2. Verify: 11th attempt shows rate limit error
3. Verify: Error message "Too many tries. Wait 15 minutes."
4. Wait 15 minutes
5. Verify: Can retry again

**TC9: Order Lookup - Multi-Pet Support**
1. Order #1001 has 3 pets: "Bella, Milo, Max"
2. Enter all 3 names in lookup form
3. Verify: API returns all 3 pet objects
4. Verify: Cart properties contain all 3 pets
5. Verify: Cart drawer displays all 3 pet previews

**TC10: Order Lookup - Offline**
1. Open order lookup form
2. Enable airplane mode
3. Tap "Find My Pet Photo"
4. Verify: Offline error appears
5. Disable airplane mode
6. Verify: Can retry successfully

### 9.2 Performance Benchmarks

**Target Metrics:**

| Metric | Target | Critical |
|--------|--------|----------|
| Time to Interactive (TTI) | < 3s | < 5s |
| First Input Delay (FID) | < 100ms | < 300ms |
| Cumulative Layout Shift (CLS) | < 0.1 | < 0.25 |
| Quick Upload → Cart Enable (Scenario 3) | < 5s | < 8s |
| Order Lookup → Cart Enable (Scenario 2B) | < 7s | < 10s |
| Background Processing Complete | < 15s | < 30s |
| LocalStorage Write | < 50ms | < 200ms |
| Order Lookup API Response Time | < 3s | < 5s |

**Monitoring:**
```javascript
// Performance tracking
performance.mark('quick-upload-start');
// ... user flow ...
performance.mark('cart-button-enabled');
performance.measure('quick-upload-duration', 'quick-upload-start', 'cart-button-enabled');

const duration = performance.getEntriesByName('quick-upload-duration')[0].duration;
console.log('Quick upload took:', duration, 'ms');

// Send to analytics
gtag('event', 'timing_complete', {
  name: 'quick_upload',
  value: Math.round(duration),
  event_category: 'pet_upload'
});
```

---

## 10. Migration & Rollout Strategy

### 10.1 Phase 1: Foundation (Week 1)

**Deliverables:**
- [ ] Extend `PetStorage` with processing states
- [ ] Update `CartPetIntegration` to support `processingState: 'uploaded_only'`
- [ ] Test existing Scenarios 1 & 2 still work
- [ ] Deploy to staging

**Risk:** Low - No customer-facing changes yet

### 10.2 Phase 2: Quick Upload UI (Week 2)

**Deliverables:**
- [ ] Build `QuickUploadHandler` module
- [ ] Build `UploadOptionsUI` bottom sheet
- [ ] Build `PetNameCapture` modal
- [ ] Add upload trigger to product pages
- [ ] Deploy to staging

**Testing:**
- [ ] Mobile device testing matrix
- [ ] Network condition testing
- [ ] Browser compatibility (iOS Safari, Chrome Android)

**Risk:** Medium - New UI components, extensive mobile testing needed

### 10.3 Phase 3: Background Processing (Week 3)

**Deliverables:**
- [ ] Build `BackgroundProcessor` module
- [ ] Implement retry logic with exponential backoff
- [ ] Add toast notifications
- [ ] Error tracking integration
- [ ] Deploy to staging

**Testing:**
- [ ] API failure scenarios
- [ ] Network interruption testing
- [ ] Concurrent upload handling
- [ ] localStorage quota management

**Risk:** Medium - Async processing complexity

### 10.4 Phase 4: Production Rollout (Week 4)

**Approach: Gradual Feature Flag Rollout**

```javascript
// Feature flag system
const FEATURE_FLAGS = {
  quickUploadEnabled: {
    percentage: 10, // Start with 10% of users
    segments: ['mobile'] // Mobile only initially
  }
};

function isQuickUploadEnabled() {
  // Check if mobile
  if (window.innerWidth > 750) return false;

  // Check percentage (deterministic based on session)
  const sessionHash = getSessionHash();
  const bucket = sessionHash % 100;
  return bucket < FEATURE_FLAGS.quickUploadEnabled.percentage;
}

// Show appropriate UI
if (isQuickUploadEnabled()) {
  showUploadOptions(); // Bottom sheet with 2 options
} else {
  redirectToFullProcessor(); // Current behavior
}
```

**Rollout Schedule:**
- Day 1-3: 10% mobile traffic
- Day 4-7: 25% mobile traffic (monitor metrics)
- Day 8-10: 50% mobile traffic
- Day 11-14: 100% mobile traffic
- Day 15+: Enable for desktop (optional)

**Monitoring Metrics:**
- Conversion rate (product page → cart)
- Cart abandonment rate
- Average time to cart addition
- Background processing success rate
- Error rate by device/network

**Rollback Criteria:**
- Conversion rate drops > 5%
- Error rate > 10%
- Background processing failure > 20%
- Customer support complaints spike

---

## 11. Known Limitations & Future Enhancements

### 11.1 Current Limitations

**1. No Real-Time Order Updates**
- Problem: Order placed with `effect: "pending"`, processing completes later
- Impact: Customer doesn't see final effect in order confirmation
- Workaround: Fulfillment team sees processed image in metafields
- Future: Webhook integration to update order

**2. No Processing Progress Indicator**
- Problem: User can't see background processing status
- Impact: No feedback after cart addition
- Workaround: Toast notification when complete
- Future: Progress bar in cart drawer

**3. LocalStorage Limits**
- Problem: ~5MB quota, can't store unlimited pets
- Impact: Auto-cleanup after ~70 pets
- Workaround: Compress thumbnails heavily
- Future: IndexedDB migration (larger quota)

**4. No Offline Image Upload**
- Problem: Can't upload while offline
- Impact: Users with poor connectivity can't use service
- Workaround: Detect offline, show clear error
- Future: ServiceWorker queue for offline uploads

### 11.2 Future Enhancements

**Phase 5: Real-Time Processing Updates (Month 2)**
```javascript
// WebSocket connection for live updates
const ws = new WebSocket('wss://api.perkie.com/processing-updates');

ws.onmessage = function(event) {
  const update = JSON.parse(event.data);

  if (update.type === 'processing_progress') {
    updateProgressBar(update.petId, update.progress);
  }

  if (update.type === 'processing_complete') {
    const pet = PetStorage.get(update.petId);
    pet.processingState = 'processed';
    pet.effects = update.effects;
    PetStorage.save(update.petId, pet);

    showSuccessToast('✨ Processing complete!');
    updateCartDrawerThumbnail(update.petId);
  }
};
```

**Phase 6: Smart Effect Recommendation (Month 3)**
```javascript
// ML-based effect suggestion
async function recommendEffect(imageData) {
  // Analyze image characteristics
  const analysis = await analyzeImage(imageData);

  // Suggest best effect based on:
  // - Pet type (dog vs cat)
  // - Background complexity
  // - Lighting conditions
  // - Color palette

  if (analysis.petType === 'dog' && analysis.lighting === 'bright') {
    return 'popart'; // Bold colors work well
  } else if (analysis.background === 'complex') {
    return 'enhancedblackwhite'; // Simplify busy backgrounds
  }

  return 'color'; // Safe default
}
```

**Phase 7: Cart Drawer Mini-Gallery (Month 4)**
```html
<!-- Show processing status in cart drawer -->
<div class="cart-item__pet-status">
  <div class="pet-processing-indicator">
    <div class="spinner"></div>
    <span>Processing your pet photo...</span>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 60%"></div>
    </div>
  </div>

  <!-- After processing completes -->
  <div class="pet-effect-preview">
    <img src="processed-image.jpg" alt="Your pet">
    <button class="change-effect-btn">Change Style</button>
  </div>
</div>
```

---

## 12. Success Metrics

### 12.1 Primary KPIs

**Conversion Optimization:**
```
Current State (Scenario 1 only):
  - Product Page → Cart: 12% (mobile)
  - Average time to cart: 18s (includes 3-11s processing wait)
  - Cart abandonment: 68%

Target State (All 3 scenarios):
  - Product Page → Cart: 20% (+67% improvement)
  - Average time to cart: 6s (-67% reduction)
  - Cart abandonment: 55% (-13pp improvement)

Breakdown by Scenario:
  - Scenario 1 (Preview): 15% conversion, 18s to cart
  - Scenario 2 (Saved): 85% conversion, 0.5s to cart
  - Scenario 3 (Quick): 25% conversion, 5s to cart
```

**User Behavior:**
```
Scenario Distribution (Predicted):
  - Scenario 1 (Full Preview): 40% of uploads
  - Scenario 2 (Saved Pet): 35% of orders
  - Scenario 3 (Quick Upload): 25% of uploads

Repeat Customer Behavior:
  - First purchase: 60% Scenario 1, 40% Scenario 3
  - Second purchase: 20% Scenario 1, 70% Scenario 2, 10% Scenario 3
  - Third+ purchase: 10% Scenario 1, 85% Scenario 2, 5% Scenario 3
```

### 12.2 Technical Performance KPIs

**Mobile Performance:**
```
Target Metrics:
  - Time to Interactive: < 3s (currently 5s)
  - First Input Delay: < 100ms (currently 150ms)
  - Largest Contentful Paint: < 2.5s (currently 3.2s)

Background Processing:
  - Success rate: > 95%
  - Average processing time: < 8s
  - Retry success rate: > 80%
  - Max retries needed: < 10%
```

**Reliability:**
```
Uptime & Error Rates:
  - API uptime: > 99.5%
  - Background processing success: > 95%
  - LocalStorage quota errors: < 1%
  - Network failure recovery: > 90%
```

### 12.3 Business Impact

**Revenue Impact (Conservative Estimate):**
```
Current Monthly Metrics:
  - Mobile sessions: 50,000/month
  - Product page views: 15,000/month
  - Current conversion: 12% = 1,800 orders/month
  - Average order value: $45
  - Monthly revenue: $81,000

With 3-Scenario Architecture:
  - Projected conversion: 20% = 3,000 orders/month
  - Revenue increase: +$54,000/month (+67%)
  - Annual impact: +$648,000
```

**Customer Satisfaction:**
```
Expected Improvements:
  - Reduced friction: 67% faster path to cart
  - Flexibility: 3 purchase paths vs 1
  - Repeat purchases: Saved pets enable instant reorders
  - Net Promoter Score: +15 points (predicted)
```

---

## 13. Risk Assessment & Mitigation

### 13.1 Technical Risks

**Risk 1: Background Processing Failures**
- **Probability:** Medium (15-20% of requests)
- **Impact:** High (orders without final images)
- **Mitigation:**
  - Retry logic with exponential backoff (3 attempts)
  - Fallback to original image thumbnail
  - Manual processing queue for failures
  - Real-time error monitoring + alerts

**Risk 2: LocalStorage Quota Exceeded**
- **Probability:** Low (< 5% of users)
- **Impact:** Medium (can't save new pets)
- **Mitigation:**
  - Aggressive thumbnail compression (200px, 60% quality)
  - Auto-cleanup of old pets (> 30 days)
  - Emergency cleanup UI (user-triggered)
  - Quota monitoring + warning UI

**Risk 3: Browser Compatibility Issues**
- **Probability:** Low (< 5% of browsers)
- **Impact:** Medium (feature unavailable)
- **Mitigation:**
  - ES5 transpilation for all new code
  - Feature detection + graceful degradation
  - Fallback to Scenario 1 (full processor)
  - Comprehensive browser testing matrix

### 13.2 Business Risks

**Risk 4: Customer Confusion (Multiple Paths)**
- **Probability:** Medium (10-15% of users)
- **Impact:** Low (minor friction)
- **Mitigation:**
  - Clear UI copy: "Quick add" vs "Preview first"
  - Onboarding tooltips for first-time users
  - Help icon with explanation
  - A/B test different copy variations

**Risk 5: Order Fulfillment Issues**
- **Probability:** Low (< 5% of orders)
- **Impact:** High (customer disappointment)
- **Mitigation:**
  - All orders have original image (worst-case fallback)
  - Metafields include processing state
  - Fulfillment team dashboard shows pending jobs
  - Automated retry for failed processing

### 13.3 Rollback Plan

**Immediate Rollback (< 5 minutes):**
```javascript
// Feature flag kill switch
const FEATURE_FLAGS = {
  quickUploadEnabled: false // ← Set to false
};

// All users revert to Scenario 1 (current behavior)
```

**Partial Rollback (Staged):**
```javascript
// Reduce rollout percentage
const FEATURE_FLAGS = {
  quickUploadEnabled: {
    percentage: 5, // Reduce from 25% to 5%
    segments: ['mobile']
  }
};
```

**Database Rollback:**
- No database schema changes (localStorage only)
- No migration needed
- Safe to enable/disable anytime

---

## 14. Dependencies & Assumptions

### 14.1 Technical Dependencies

**Required (Existing):**
- ✅ Shopify Dawn theme (current)
- ✅ PetStorage system (current)
- ✅ InSPyReNet API (current)
- ✅ Google Cloud Storage (current)
- ✅ Cart integration events (current)

**Required (New):**
- ⚠️ ES5 transpilation pipeline (for new modules)
- ⚠️ Feature flag system (for gradual rollout)
- ⚠️ Error tracking (Sentry or similar)
- ⚠️ Analytics events (Google Analytics 4)

**Optional (Future):**
- 🔮 WebSocket server (real-time updates)
- 🔮 Webhook endpoint (order updates)
- 🔮 ServiceWorker (offline support)
- 🔮 IndexedDB (larger storage)

### 14.2 Business Assumptions

**Assumption 1: Mobile Traffic Remains 70%**
- If mobile drops to < 60%, ROI decreases
- Mitigation: Desktop version planned for Phase 5

**Assumption 2: Users Trust Background Processing**
- If > 20% users refuse quick upload, feature underutilized
- Mitigation: Clear copy explaining process

**Assumption 3: API Processing Succeeds > 95%**
- If success rate < 80%, too many manual interventions needed
- Mitigation: Invest in API reliability improvements

**Assumption 4: Average Order Value Stays Stable**
- If AOV drops due to rushed purchases, revenue impact negative
- Mitigation: Monitor AOV by scenario, optimize Scenario 3 UI

### 14.3 Timeline Assumptions

**Optimistic (3 weeks):**
- No major technical blockers
- All device testing passes first try
- API performance stable
- Team availability 100%

**Realistic (4 weeks):**
- Minor browser compatibility fixes needed
- 1-2 rounds of mobile testing iterations
- Some API optimization required
- Team availability 80%

**Pessimistic (6 weeks):**
- Major iOS Safari compatibility issues
- LocalStorage quota problems require IndexedDB migration
- API requires significant reliability work
- Team availability 60%

---

## 15. Implementation Checklist

### 15.1 Phase 1: Foundation (Week 1)

**Code Changes:**
- [ ] Extend `PetStorage.save()` with `processingState` field
- [ ] Add `ProcessingState` enum to PetStorage
- [ ] Add `processingJobId`, `processingAttempts`, `lastProcessingError` fields
- [ ] Update `CartPetIntegration.updateFormFields()` to handle states
- [ ] Update `CartPetIntegration.initializeButtonState()` to enable for all states
- [ ] Add new form field: `properties[_processing_state]`

**Testing:**
- [ ] Unit test: PetStorage with all processing states
- [ ] Integration test: Scenario 1 still works (full preview)
- [ ] Integration test: Scenario 2 still works (saved pets)
- [ ] Regression test: Cart button enables correctly
- [ ] Browser test: Chrome, Safari, Firefox

**Deployment:**
- [ ] Deploy to staging environment
- [ ] Smoke test all existing flows
- [ ] Get approval from QA

**Estimated Time:** 3 days

### 15.2 Phase 2: Quick Upload UI (Week 2)

**New Files:**
- [ ] Create `assets/quick-upload-handler.js` (ES5)
- [ ] Create `assets/upload-options-ui.js` (bottom sheet)
- [ ] Create `assets/pet-name-capture.js` (modal)
- [ ] Create `assets/toast-notifications.js` (toast system)
- [ ] Create `assets/quick-upload.css`
- [ ] Create `assets/bottom-sheet.css`
- [ ] Create `assets/pet-name-modal.css`
- [ ] Create `assets/toast.css`

**Code Changes:**
- [ ] Update `snippets/ks-product-pet-selector.liquid` with upload trigger
- [ ] Add feature flag system to `theme.liquid`
- [ ] Add analytics tracking events

**Testing:**
- [ ] Device test: iPhone 12 Pro (iOS 16) Safari
- [ ] Device test: iPhone SE (iOS 15) Safari
- [ ] Device test: Samsung Galaxy S21 Chrome
- [ ] Device test: Samsung Galaxy A52 Chrome
- [ ] Device test: Google Pixel 6 Chrome
- [ ] Network test: Fast 3G
- [ ] Network test: Slow 4G
- [ ] Network test: Fast 4G
- [ ] Interaction test: Bottom sheet gestures
- [ ] Interaction test: Modal keyboard handling
- [ ] Interaction test: File picker camera on mobile

**Deployment:**
- [ ] Deploy to staging with feature flag at 100%
- [ ] Internal team testing
- [ ] Fix any UI/UX issues
- [ ] Get approval from design team

**Estimated Time:** 5 days

### 15.3 Phase 3: Background Processing (Week 3)

**New Files:**
- [ ] Create `assets/background-processor.js` (ES5)
- [ ] Create `assets/processing-retry-logic.js`

**Code Changes:**
- [ ] Implement `QuickUploadHandler.startBackgroundProcessing()`
- [ ] Implement retry logic with exponential backoff
- [ ] Implement error tracking integration
- [ ] Implement localStorage quota management
- [ ] Add toast notifications for success/error

**API Changes:**
- [ ] Verify `/api/v2/process-with-effects` supports async calls
- [ ] Add `session_id` parameter for job tracking
- [ ] Test concurrent processing (10+ simultaneous uploads)

**Testing:**
- [ ] Scenario test: Happy path (upload → process → success)
- [ ] Scenario test: Network failure during upload
- [ ] Scenario test: Network failure during processing
- [ ] Scenario test: API returns 500 error
- [ ] Scenario test: API returns 400 error (invalid image)
- [ ] Scenario test: Processing timeout (> 30s)
- [ ] Scenario test: Retry logic (1st attempt fails, 2nd succeeds)
- [ ] Scenario test: Max retries reached (3 attempts all fail)
- [ ] Scenario test: LocalStorage quota exceeded
- [ ] Scenario test: Background tab (processing continues)
- [ ] Scenario test: Page refresh during processing
- [ ] Load test: 100 concurrent background jobs

**Deployment:**
- [ ] Deploy to staging
- [ ] Monitor error rates for 48 hours
- [ ] Monitor API success rates
- [ ] Verify retry logic working
- [ ] Get approval from engineering lead

**Estimated Time:** 5 days

### 15.4 Phase 4: Production Rollout (Week 4)

**Pre-Launch:**
- [ ] Set feature flag to 0% (disabled)
- [ ] Configure analytics dashboards
- [ ] Configure error tracking alerts
- [ ] Set up Slack notifications for errors
- [ ] Prepare rollback plan document
- [ ] Train customer support team
- [ ] Prepare customer-facing help docs

**Day 1-3: 10% Rollout**
- [ ] Set feature flag to 10% mobile traffic
- [ ] Monitor conversion rate (target: +5% vs control)
- [ ] Monitor error rate (target: < 5%)
- [ ] Monitor cart abandonment (target: -5pp vs control)
- [ ] Review customer support tickets
- [ ] Review analytics events

**Day 4-7: 25% Rollout**
- [ ] Increase feature flag to 25%
- [ ] Continue monitoring all metrics
- [ ] Conduct A/B significance test
- [ ] Review any edge cases discovered
- [ ] Apply hot fixes if needed

**Day 8-10: 50% Rollout**
- [ ] Increase feature flag to 50%
- [ ] Monitor server load (API costs)
- [ ] Review processing success rates
- [ ] Verify background jobs completing

**Day 11-14: 100% Rollout**
- [ ] Increase feature flag to 100% mobile
- [ ] Monitor for 3 days
- [ ] Document any issues
- [ ] Plan desktop rollout (optional)

**Post-Launch:**
- [ ] Write post-mortem document
- [ ] Share learnings with team
- [ ] Plan Phase 5 enhancements

**Estimated Time:** 10 days + monitoring

---

## 16. Conclusion

This mobile-first architecture enables three distinct purchase scenarios, eliminating the current conversion blocker where all customers must wait 3-11s for AI processing. By supporting quick upload without preview (Scenario 3), we enable mobile users on slow connections to complete checkout in ~5s instead of 18s, while maintaining data integrity (pet name requirement) and leveraging background processing for AI effects.

**Key Benefits:**
1. **67% Faster Path to Cart** - 5s vs 18s average
2. **3X Purchase Paths** - Preview, Saved, or Quick
3. **Mobile-Native UX** - Bottom sheets, inline modals, thumb-zone optimization
4. **Network Resilient** - Offline detection, retry logic, progressive enhancement
5. **Revenue Impact** - Projected +$648K annually from improved conversion

**Implementation Effort:**
- **Phase 1:** 3 days (foundation)
- **Phase 2:** 5 days (UI)
- **Phase 3:** 5 days (background processing)
- **Phase 4:** 10 days (rollout + monitoring)
- **Total:** 23 days (~5 weeks)

**Next Steps:**
1. Review this plan with stakeholders
2. Get approval from engineering lead
3. Allocate team resources (1 senior dev, 1 QA)
4. Begin Phase 1 implementation

---

**Document Version:** 1.0
**Last Updated:** 2025-10-20
**Author:** Mobile Commerce Architect
**Reviewers:** [Pending]
**Status:** Draft for Review
