# Shopify File Upload - Express Checkout Implementation Plan

**Agent**: ux-design-ecommerce-expert
**Date**: 2025-10-20
**Status**: Implementation-Ready UX Design + Technical Specification
**Related Docs**: `.claude/doc/three-scenario-pet-checkout-ux-design-spec.md`, `.claude/doc/add-to-cart-blocker-ux-analysis.md`

---

## Executive Summary

This document provides a complete UX design and implementation plan for **Scenario 3: Express Checkout** using Shopify's native `<input type="file">` upload feature. This enables customers to upload 1-3 pet photos directly on the product page and add to cart immediately, bypassing the 3-11s AI preview flow.

**Key Design Decision**: Use Shopify's secure file upload system to store customer images as line item properties, then process them asynchronously post-purchase. This removes the conversion blocker while maintaining image quality and customer trust.

**Business Impact**:
- Remove 3-11s forced delay for 70% mobile users
- Enable express checkout in ~10 seconds (vs 15-30s current)
- Support 1-3 pets per product via multi-file upload
- Maintain AI preview value proposition as optional enhancement

---

## 1. UX Design Overview

### Design Goals

1. **Mobile-First**: 70% of traffic, optimize for thumb zone and one-handed use
2. **Clear Distinction**: "Quick Upload" (express) vs "Preview Styles" (full AI flow)
3. **No Cannibalization**: Express path complements AI preview, doesn't replace it
4. **Multi-Pet Support**: Enable 1-3 file selection with clear visual feedback
5. **Trust Signals**: Reassure customers their photos will be processed correctly
6. **Accessibility**: WCAG 2.1 AA compliance, keyboard navigation, screen readers
7. **Progressive Enhancement**: Works with JavaScript disabled (basic HTML form)

### User Flow - Express Upload Path

```
Product Page Load
    ↓
Pet Selector shows pet name field + upload options
    ↓
Customer enters pet name: "Bella, Milo"
    ↓
Customer taps "Quick Upload" button
    ↓
Bottom sheet modal slides up from bottom (mobile native pattern)
    ↓
Modal shows:
  - Pet name pre-filled: "Bella, Milo"
  - File input: "Choose Photo(s)" (accepts 1-3 files)
  - Helper text: "Select 1-3 photos from camera or gallery"
    ↓
Customer taps "Choose Photo(s)"
    ↓
iOS Safari: Shows "Take Photo | Photo Library | Browse"
Android Chrome: Shows "Camera | Gallery | Files"
    ↓
Customer selects 1-3 photos
    ↓
Visual feedback: Thumbnail previews of selected files
  [✓ Bella.jpg] [✓ Milo.jpg] [X]
    ↓
Customer taps "Continue" button
    ↓
Files attached to hidden form fields (Shopify line item properties)
    ↓
Modal closes, success message: "✅ 2 photos uploaded!"
    ↓
Add to Cart button enabled
    ↓
Customer adds to cart → Checkout
    ↓
Order confirmation: "We'll process your photos and email preview within 1 hour"
    ↓
Backend processes images asynchronously
    ↓
Email sent: "Your preview is ready! Approve to start production"
```

**Time to Purchase**: ~10 seconds (vs 15-30s with forced AI preview)
**Processing Delay**: Zero (happens post-purchase)
**Customer Anxiety**: Low (clear messaging, no wait)

---

## 2. UI Component Design

### Component: Quick Upload Bottom Sheet Modal (Mobile)

**Visual Layout** (Mobile 375px width):

```
┌─────────────────────────────────────────────────────┐
│                   [Handle Bar]                       │ ← Drag to dismiss
├─────────────────────────────────────────────────────┤
│ 📸 Quick Upload                              [X]    │ ← Header
├─────────────────────────────────────────────────────┤
│                                                      │
│ Pet Name(s)                                          │
│ ┌──────────────────────────────────────────────────┐│
│ │ Bella, Milo                                      ││ ← Pre-filled
│ └──────────────────────────────────────────────────┘│
│ ℹ️ Separate multiple names with commas               │
│                                                      │
│ Upload Photo(s)                                      │
│ ┌──────────────────────────────────────────────────┐│
│ │                                                   ││
│ │         📷                                        ││
│ │   Choose Photo(s)                                 ││
│ │                                                   ││
│ │   Select 1-3 photos                               ││
│ │   Camera, gallery, or files                       ││
│ │                                                   ││
│ └──────────────────────────────────────────────────┘│ ← 200px tall
│                                                      │
│ No photos selected yet                               │ ← Status text
│                                                      │
│ ℹ️ We'll email you a preview before printing         │ ← Trust signal
│    Your photos stay private and secure               │
│                                                      │
│ ┌──────────────────────────────────────────────────┐│
│ │           [Continue]                              ││ ← Primary CTA
│ └──────────────────────────────────────────────────┘│  (48px tall)
│                                                      │
│ Or use full preview: [See All Styles]               │ ← Secondary option
│                                                      │
└─────────────────────────────────────────────────────┘
```

**After File Selection** (2 photos selected):

```
┌─────────────────────────────────────────────────────┐
│                   [Handle Bar]                       │
├─────────────────────────────────────────────────────┤
│ 📸 Quick Upload                              [X]    │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Pet Name(s)                                          │
│ ┌──────────────────────────────────────────────────┐│
│ │ Bella, Milo                                      ││
│ └──────────────────────────────────────────────────┘│
│                                                      │
│ Upload Photo(s)                                      │
│ ┌──────────────────────────────────────────────────┐│
│ │ ┌───────┐ ┌───────┐ ┌───────┐                   ││
│ │ │[thumb]│ │[thumb]│ │  📷   │                   ││
│ │ │  ✓    │ │  ✓    │ │  +    │                   ││ ← 3 slots
│ │ │Bella  │ │ Milo  │ │ Add   │                   ││
│ │ │  [x]  │ │  [x]  │ │       │                   ││ ← Remove button
│ │ └───────┘ └───────┘ └───────┘                   ││
│ │ IMG_1234.jpg   IMG_5678.jpg                       ││ ← Filenames
│ └──────────────────────────────────────────────────┘│
│                                                      │
│ ✅ 2 photos ready to upload (Max 3)                  │ ← Status
│                                                      │
│ ℹ️ We'll email you a preview before printing         │
│    Your photos stay private and secure               │
│                                                      │
│ ┌──────────────────────────────────────────────────┐│
│ │           [Upload & Continue]                     ││ ← Active state
│ └──────────────────────────────────────────────────┘│  (enabled)
│                                                      │
│ Or use full preview: [See All Styles]               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Desktop Version** (Inline on product page, not modal):

```
┌─────────────────────────────────────────────────────┐
│ 🐾 Your Pet                                          │
│                                                      │
│ Pet Name (Required)                                  │
│ [Bella, Milo                        ]                │
│ Separate multiple names with commas                  │
│                                                      │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ Choose How to Upload:                                │
│                                                      │
│ ┌───────────────────┐  ┌───────────────────────┐   │
│ │ 📸 Quick Upload   │  │ 🎨 Preview Styles     │   │
│ │                   │  │                        │   │
│ │ Upload & skip     │  │ See your pet in       │   │
│ │ preview           │  │ 4 different effects   │   │
│ │                   │  │                        │   │
│ │ We'll email you   │  │ Choose your favorite  │   │
│ │ when ready        │  │ before checkout       │   │
│ │                   │  │                        │   │
│ │ [Choose Files]    │  │ [Upload & Preview]    │   │
│ └───────────────────┘  └───────────────────────┘   │
│                                                      │
│ ─── OR ───                                           │
│                                                      │
│ [📧 I'll Send Photos Later]                         │
│ Upload after checkout via email link                 │
│                                                      │
│ [ Add to Cart ] ← Enabled when name entered         │
└─────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Pet Name Input Field

**Purpose**: Capture 1-3 pet names before upload

**HTML Structure**:
```html
<div class="ks-pet-name-section">
  <label for="pet-name-input">
    Pet Name(s) <span class="required">*</span>
  </label>
  <input
    type="text"
    id="pet-name-input"
    name="properties[_pet_name]"
    placeholder="e.g., Bella, Milo, Max"
    required
    maxlength="100"
    pattern="[A-Za-z0-9, \-']+"
    autocapitalize="words"
    aria-label="Enter your pet name(s)"
    aria-describedby="pet-name-help">
  <small id="pet-name-help" class="help-text">
    Required. Separate multiple names with commas.
  </small>
</div>
```

**CSS** (Mobile-First):
```css
.ks-pet-name-section {
  margin-bottom: 1.5rem;
}

.ks-pet-name-section label {
  display: block;
  font-size: 16px; /* Prevent iOS zoom on focus */
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #333;
}

.ks-pet-name-section input {
  width: 100%;
  padding: 14px 16px; /* 48px total height (thumb-friendly) */
  font-size: 16px; /* Prevent iOS zoom */
  border: 2px solid #ddd;
  border-radius: 8px;
  transition: border-color 0.2s;
}

.ks-pet-name-section input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.ks-pet-name-section .help-text {
  display: block;
  margin-top: 0.5rem;
  font-size: 14px;
  color: #666;
}

.ks-pet-name-section .required {
  color: #d9534f;
  font-weight: bold;
}
```

**Validation**:
- Real-time validation on blur
- Check for valid characters (letters, numbers, commas, spaces, hyphens, apostrophes)
- Split by comma to count pets (max 3)
- Show error if >3 pets: "Maximum 3 pets per product"
- Show error if invalid characters: "Use only letters, numbers, commas"

**Accessibility**:
- Label properly associated with input (for/id)
- Required attribute for form validation
- ARIA label for screen readers
- Describedby links to help text
- Focus visible indicator (3px blue outline)

---

### 3.2 File Upload Input (Shopify Native)

**Purpose**: Enable 1-3 file uploads using Shopify's secure file storage

**HTML Structure**:
```html
<div class="ks-file-upload-section">
  <label for="pet-photo-upload">
    Upload Photo(s) <span class="optional">(Optional)</span>
  </label>

  <!-- Visual upload button (custom styled) -->
  <div class="file-upload-wrapper">
    <button
      type="button"
      class="file-upload-trigger"
      onclick="document.getElementById('pet-photo-upload').click()"
      aria-label="Choose photos to upload">
      <svg class="camera-icon" width="32" height="32" viewBox="0 0 24 24">
        <path d="M12 15.2c1.99 0 3.6-1.61 3.6-3.6s-1.61-3.6-3.6-3.6-3.6 1.61-3.6 3.6 1.61 3.6 3.6 3.6z"/>
        <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9z"/>
      </svg>
      <span class="upload-label">Choose Photo(s)</span>
      <span class="upload-help">Select 1-3 photos</span>
    </button>

    <!-- Native file input (hidden) -->
    <input
      type="file"
      id="pet-photo-upload"
      name="properties[_pet_photo_upload]"
      accept="image/jpeg,image/png,image/heic,image/webp"
      multiple
      capture="environment"
      style="display: none;"
      aria-label="Upload pet photos"
      onchange="handleFileSelection(event)">
  </div>

  <!-- File preview area -->
  <div class="file-preview-area" id="file-preview-area" style="display: none;">
    <!-- Populated by JavaScript on file selection -->
  </div>

  <small class="help-text">
    Accepts: JPG, PNG, HEIC. Max 3 photos. Max 50MB per file.
  </small>
</div>
```

**CSS** (Mobile-First):
```css
.ks-file-upload-section {
  margin-bottom: 1.5rem;
}

.file-upload-wrapper {
  position: relative;
  margin-top: 0.5rem;
}

.file-upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 200px;
  padding: 2rem 1rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px dashed #adb5bd;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

/* Touch-friendly active state (mobile) */
@media (hover: none) {
  .file-upload-trigger:active {
    background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
    border-color: #007bff;
    transform: scale(0.98);
  }
}

/* Hover state (desktop) */
@media (hover: hover) {
  .file-upload-trigger:hover {
    background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
    border-color: #007bff;
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
  }
}

.file-upload-trigger:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
}

.camera-icon {
  fill: #6c757d;
  margin-bottom: 1rem;
}

.upload-label {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
}

.upload-help {
  display: block;
  font-size: 14px;
  color: #6c757d;
}

/* File Preview Thumbnails */
.file-preview-area {
  display: flex;
  gap: 12px;
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.file-preview-item {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #dee2e6;
}

.file-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-preview-item .remove-file {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  background: rgba(217, 83, 79, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.file-preview-item .remove-file:hover {
  background: rgba(217, 83, 79, 1);
}

.file-preview-item .file-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Add Photo slot */
.file-preview-item.add-slot {
  background: #e9ecef;
  border: 2px dashed #adb5bd;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.file-preview-item.add-slot .add-icon {
  font-size: 32px;
  color: #6c757d;
  margin-bottom: 4px;
}

.file-preview-item.add-slot .add-label {
  font-size: 12px;
  color: #6c757d;
}

/* Status indicator */
.file-upload-status {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 14px;
}

.file-upload-status.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.file-upload-status.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.file-upload-status.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}
```

**JavaScript** (File Selection Handler):
```javascript
function handleFileSelection(event) {
  const files = event.target.files;
  const previewArea = document.getElementById('file-preview-area');
  const maxFiles = 3;
  const maxFileSize = 50 * 1024 * 1024; // 50MB

  // Validate file count
  if (files.length > maxFiles) {
    showError(`Maximum ${maxFiles} photos allowed. Please select fewer files.`);
    event.target.value = ''; // Clear selection
    return;
  }

  // Validate file sizes
  let oversizedFiles = [];
  for (let i = 0; i < files.length; i++) {
    if (files[i].size > maxFileSize) {
      oversizedFiles.push(files[i].name);
    }
  }

  if (oversizedFiles.length > 0) {
    showError(`Files too large (max 50MB): ${oversizedFiles.join(', ')}`);
    event.target.value = '';
    return;
  }

  // Clear previous previews
  previewArea.innerHTML = '';
  previewArea.style.display = 'flex';

  // Generate previews
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();

    reader.onload = function(e) {
      const previewItem = createPreviewItem(file, e.target.result, i);
      previewArea.appendChild(previewItem);
    };

    reader.readAsDataURL(file);
  }

  // Show "Add" slot if < 3 files
  if (files.length < maxFiles) {
    const addSlot = createAddSlot(files.length);
    previewArea.appendChild(addSlot);
  }

  // Show success message
  showSuccess(`✅ ${files.length} photo${files.length > 1 ? 's' : ''} ready to upload (Max ${maxFiles})`);

  // Enable "Continue" button
  enableContinueButton();
}

function createPreviewItem(file, dataUrl, index) {
  const div = document.createElement('div');
  div.className = 'file-preview-item';
  div.innerHTML = `
    <img src="${dataUrl}" alt="Pet photo ${index + 1}">
    <button
      type="button"
      class="remove-file"
      onclick="removeFile(${index})"
      aria-label="Remove ${file.name}">
      ×
    </button>
    <span class="file-name">${file.name}</span>
  `;
  return div;
}

function createAddSlot(currentCount) {
  const div = document.createElement('div');
  div.className = 'file-preview-item add-slot';
  div.innerHTML = `
    <span class="add-icon">📷</span>
    <span class="add-label">Add Photo</span>
  `;
  div.onclick = function() {
    document.getElementById('pet-photo-upload').click();
  };
  return div;
}

function removeFile(index) {
  const fileInput = document.getElementById('pet-photo-upload');
  const dt = new DataTransfer();
  const files = fileInput.files;

  for (let i = 0; i < files.length; i++) {
    if (i !== index) {
      dt.items.add(files[i]);
    }
  }

  fileInput.files = dt.files;

  // Trigger change event to refresh previews
  const event = new Event('change', { bubbles: true });
  fileInput.dispatchEvent(event);
}

function showSuccess(message) {
  const statusDiv = document.getElementById('file-upload-status') || createStatusDiv();
  statusDiv.className = 'file-upload-status success';
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';
}

function showError(message) {
  const statusDiv = document.getElementById('file-upload-status') || createStatusDiv();
  statusDiv.className = 'file-upload-status error';
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';
}

function createStatusDiv() {
  const div = document.createElement('div');
  div.id = 'file-upload-status';
  const uploadSection = document.querySelector('.ks-file-upload-section');
  uploadSection.appendChild(div);
  return div;
}

function enableContinueButton() {
  const btn = document.getElementById('continue-upload-btn');
  if (btn) {
    btn.disabled = false;
    btn.classList.add('enabled');
  }
}
```

**Mobile-Specific Attributes**:
- `accept="image/jpeg,image/png,image/heic,image/webp"`: Filter file picker to images only
- `multiple`: Allow selecting multiple files (up to 3 enforced by JS)
- `capture="environment"`: On mobile, defaults to rear camera (better for pet photos)
- iOS Safari behavior: Shows "Take Photo | Photo Library | Browse"
- Android Chrome behavior: Shows "Camera | Gallery | Files"

**Accessibility**:
- Hidden native input with visible custom button (keyboard accessible)
- ARIA labels on both native input and custom trigger
- Focus visible on custom trigger
- Screen reader announces file selection count
- Error messages linked via aria-describedby

---

### 3.3 Bottom Sheet Modal (Mobile Only)

**Purpose**: Present quick upload UI without leaving product page

**HTML Structure**:
```html
<!-- Bottom Sheet Overlay -->
<div class="bottom-sheet-overlay" id="quick-upload-overlay" style="display: none;">
  <div class="bottom-sheet" id="quick-upload-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-upload-title">

    <!-- Handle bar (drag to dismiss) -->
    <div class="bottom-sheet-handle-container">
      <div class="bottom-sheet-handle" aria-hidden="true"></div>
    </div>

    <!-- Header -->
    <div class="bottom-sheet-header">
      <h3 id="quick-upload-title">📸 Quick Upload</h3>
      <button
        type="button"
        class="bottom-sheet-close"
        onclick="closeBottomSheet()"
        aria-label="Close quick upload">
        ×
      </button>
    </div>

    <!-- Content -->
    <div class="bottom-sheet-content">

      <!-- Pet name (pre-filled from main form) -->
      <div class="ks-pet-name-section">
        <label for="modal-pet-name">Pet Name(s)</label>
        <input
          type="text"
          id="modal-pet-name"
          placeholder="e.g., Bella, Milo"
          readonly
          value="">
        <small class="help-text">From your entry above</small>
      </div>

      <!-- File upload -->
      <div class="ks-file-upload-section">
        <!-- Same as 3.2 but inside modal -->
      </div>

      <!-- Trust signal -->
      <div class="trust-message">
        <span class="info-icon">ℹ️</span>
        <p>We'll email you a preview before printing.<br>Your photos stay private and secure.</p>
      </div>

    </div>

    <!-- Footer -->
    <div class="bottom-sheet-footer">
      <button
        type="button"
        class="btn-primary btn-large"
        id="continue-upload-btn"
        disabled
        onclick="completeQuickUpload()">
        Upload & Continue
      </button>

      <button
        type="button"
        class="btn-secondary btn-text"
        onclick="openFullPreview()">
        Or use full preview: <strong>See All Styles</strong>
      </button>
    </div>

  </div>
</div>
```

**CSS** (Mobile Bottom Sheet):
```css
/* Overlay */
.bottom-sheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Bottom Sheet */
.bottom-sheet {
  width: 100%;
  max-height: 90vh;
  background: white;
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease-out;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Handle bar (drag indicator) */
.bottom-sheet-handle-container {
  padding: 12px 0 8px;
  display: flex;
  justify-content: center;
}

.bottom-sheet-handle {
  width: 36px;
  height: 4px;
  background: #dee2e6;
  border-radius: 2px;
}

/* Header */
.bottom-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem 1rem;
  border-bottom: 1px solid #e9ecef;
}

.bottom-sheet-header h3 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #333;
}

.bottom-sheet-close {
  width: 32px;
  height: 32px;
  background: #f8f9fa;
  border: none;
  border-radius: 50%;
  font-size: 24px;
  line-height: 1;
  color: #6c757d;
  cursor: pointer;
  transition: background 0.2s;
}

.bottom-sheet-close:active {
  background: #e9ecef;
}

/* Content (scrollable) */
.bottom-sheet-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  -webkit-overflow-scrolling: touch; /* iOS smooth scrolling */
}

/* Trust message */
.trust-message {
  display: flex;
  gap: 12px;
  padding: 1rem;
  background: #e7f3ff;
  border-left: 4px solid #007bff;
  border-radius: 8px;
  margin-top: 1rem;
}

.trust-message .info-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.trust-message p {
  margin: 0;
  font-size: 14px;
  color: #004085;
  line-height: 1.5;
}

/* Footer (sticky) */
.bottom-sheet-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e9ecef;
  background: white;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-primary {
  width: 100%;
  min-height: 48px;
  padding: 0 1.5rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-primary:not(:disabled):active {
  background: #0056b3;
  transform: scale(0.98);
}

.btn-secondary {
  width: 100%;
  min-height: 44px;
  background: transparent;
  border: none;
  font-size: 14px;
  color: #6c757d;
  cursor: pointer;
}

.btn-secondary strong {
  color: #007bff;
}

/* Safe area inset for devices with notches */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .bottom-sheet-footer {
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }
}
```

**JavaScript** (Modal Control):
```javascript
let bottomSheetOpen = false;

function openQuickUpload() {
  const overlay = document.getElementById('quick-upload-overlay');
  const sheet = document.getElementById('quick-upload-sheet');
  const mainPetName = document.getElementById('pet-name-input').value;
  const modalPetName = document.getElementById('modal-pet-name');

  // Pre-fill pet name from main form
  if (mainPetName) {
    modalPetName.value = mainPetName;
  }

  // Show modal
  overlay.style.display = 'flex';
  bottomSheetOpen = true;

  // Lock body scroll (prevent background scrolling)
  document.body.style.overflow = 'hidden';

  // Focus management (trap focus in modal)
  sheet.focus();

  // Handle swipe-to-dismiss gesture (advanced)
  attachSwipeHandler(sheet, overlay);
}

function closeBottomSheet() {
  const overlay = document.getElementById('quick-upload-overlay');
  const sheet = document.getElementById('quick-upload-sheet');

  // Animate out
  sheet.style.animation = 'slideDown 0.3s ease-out';
  overlay.style.animation = 'fadeOut 0.2s ease-out';

  setTimeout(() => {
    overlay.style.display = 'none';
    sheet.style.animation = '';
    overlay.style.animation = '';
    bottomSheetOpen = false;

    // Restore body scroll
    document.body.style.overflow = '';
  }, 300);
}

@keyframes slideDown {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

function completeQuickUpload() {
  const fileInput = document.getElementById('pet-photo-upload');
  const files = fileInput.files;

  if (files.length === 0) {
    showError('Please select at least one photo');
    return;
  }

  // Store files in hidden form fields (Shopify line item properties)
  // This will be handled by Shopify's form submission

  // Close modal
  closeBottomSheet();

  // Show success message on main page
  const successMsg = document.createElement('div');
  successMsg.className = 'file-upload-status success';
  successMsg.textContent = `✅ ${files.length} photo${files.length > 1 ? 's' : ''} uploaded!`;

  const petSelector = document.querySelector('.ks-pet-selector');
  petSelector.insertBefore(successMsg, petSelector.firstChild);

  // Enable "Add to Cart" button
  enableAddToCart();

  // Track analytics
  if (typeof gtag !== 'undefined') {
    gtag('event', 'quick_upload_completed', {
      file_count: files.length,
      source: 'product_page'
    });
  }
}

function openFullPreview() {
  // Close modal and redirect to full preview page
  closeBottomSheet();
  window.location.href = '/pages/pet-background-remover';
}

// Swipe-to-dismiss handler (touch gesture)
function attachSwipeHandler(element, overlay) {
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  const handleStart = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    startY = touch.clientY;
    isDragging = true;
  };

  const handleMove = (e) => {
    if (!isDragging) return;

    const touch = e.touches ? e.touches[0] : e;
    currentY = touch.clientY;
    const deltaY = currentY - startY;

    // Only allow downward swipe
    if (deltaY > 0) {
      element.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const deltaY = currentY - startY;

    // If swiped down more than 150px, close modal
    if (deltaY > 150) {
      closeBottomSheet();
    } else {
      // Snap back to position
      element.style.transition = 'transform 0.3s ease-out';
      element.style.transform = 'translateY(0)';
      setTimeout(() => {
        element.style.transition = '';
      }, 300);
    }
  };

  element.addEventListener('touchstart', handleStart);
  element.addEventListener('touchmove', handleMove);
  element.addEventListener('touchend', handleEnd);

  // Also support mouse drag for desktop testing
  element.addEventListener('mousedown', handleStart);
  document.addEventListener('mousemove', handleMove);
  document.addEventListener('mouseup', handleEnd);
}

// Close on overlay click (outside modal)
document.getElementById('quick-upload-overlay').addEventListener('click', function(e) {
  if (e.target === this) {
    closeBottomSheet();
  }
});

// Close on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && bottomSheetOpen) {
    closeBottomSheet();
  }
});
```

**Accessibility**:
- `role="dialog"` and `aria-modal="true"` for screen readers
- Focus trap: Tab key stays within modal
- Escape key to close
- ARIA labels on all interactive elements
- Swipe-to-dismiss for touch users
- Click overlay to dismiss for mouse users

---

### 3.4 Add to Cart Button Logic

**Purpose**: Enable cart button when pet name entered (photo optional)

**Current State** (Blocker):
```javascript
// cart-pet-integration.js:199-227
function disableAddToCart() {
  const btn = document.querySelector('[name="add"]');
  btn.disabled = true;
  btn.textContent = isMobile() ? '👆 Tap your pet above' : '↑ Select your pet above';
}

// Only enabled after pet:selected event fires
document.addEventListener('pet:selected', function() {
  enableAddToCart();
});
```

**New State** (Enabler):
```javascript
// Enable cart when pet name entered (photo optional)
function updateAddToCartState() {
  const petNameInput = document.getElementById('pet-name-input');
  const addToCartBtn = document.querySelector('[name="add"]');
  const petName = petNameInput.value.trim();

  if (!petName || petName === '') {
    // Disable if no pet name
    addToCartBtn.disabled = true;
    addToCartBtn.textContent = 'Enter Pet Name Above';
    addToCartBtn.classList.add('disabled');
  } else {
    // Enable if pet name exists (photo optional)
    addToCartBtn.disabled = false;
    addToCartBtn.textContent = 'Add to Cart';
    addToCartBtn.classList.remove('disabled');
  }
}

// Listen for pet name input changes
document.getElementById('pet-name-input').addEventListener('input', updateAddToCartState);

// Also listen for file upload completion
document.addEventListener('files:uploaded', function(e) {
  // Optional enhancement: Show "Add to Cart (2 photos uploaded)"
  const addToCartBtn = document.querySelector('[name="add"]');
  addToCartBtn.textContent = `Add to Cart (${e.detail.fileCount} photo${e.detail.fileCount > 1 ? 's' : ''} uploaded)`;
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  updateAddToCartState();
});
```

**Visual States**:

1. **Disabled** (No pet name):
```
┌─────────────────────────────┐
│  Enter Pet Name Above       │ ← Gray, not clickable
└─────────────────────────────┘
```

2. **Enabled** (Pet name only, no photo):
```
┌─────────────────────────────┐
│  Add to Cart                │ ← Blue, clickable
└─────────────────────────────┘

ℹ️ Upload photo now or after checkout
```

3. **Enabled** (Pet name + photo uploaded):
```
┌─────────────────────────────┐
│  Add to Cart (2 photos)     │ ← Blue, clickable
└─────────────────────────────┘

✅ Photos uploaded! We'll email preview shortly
```

**CSS**:
```css
[name="add"] {
  width: 100%;
  min-height: 48px;
  padding: 0 1.5rem;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

[name="add"]:not(.disabled) {
  background: #007bff;
  color: white;
}

[name="add"]:not(.disabled):active {
  background: #0056b3;
  transform: scale(0.98);
}

[name="add"].disabled {
  background: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}
```

---

## 4. User Journey Mapping

### Scenario 3A: Quick Upload (With Photos)

**Customer**: Sarah, 32, mobile user, slow connection, impatient

**Journey**:
```
1. Lands on product page (via Google Shopping Ad)
   - Sees product image, price, "Add to Cart" (disabled)
   - Reads: "Pet Name (Required)" and "Upload Optional"

2. Enters pet name: "Bella, Milo"
   - Keyboard opens (iOS, autocapitalize on)
   - Types names, separates with comma
   - "Add to Cart" button turns blue (enabled!)

3. Taps "Quick Upload" button
   - Bottom sheet slides up from bottom
   - Sees: "Choose Photo(s)" with camera icon
   - Pet names pre-filled: "Bella, Milo"

4. Taps "Choose Photo(s)"
   - iOS: "Take Photo | Photo Library | Browse"
   - Selects "Photo Library"
   - Multi-select enabled, chooses 2 photos

5. Photos preview in modal
   - [Bella thumbnail] [Milo thumbnail] [Add slot]
   - Filenames shown: IMG_1234.jpg, IMG_5678.jpg
   - Status: "✅ 2 photos ready (Max 3)"

6. Taps "Upload & Continue"
   - Modal closes with slide-down animation
   - Success message on product page: "✅ 2 photos uploaded!"
   - "Add to Cart" shows: "Add to Cart (2 photos)"

7. Taps "Add to Cart"
   - Item added to cart
   - Cart drawer opens: Shows product + "2 pet photos attached"

8. Proceeds to checkout
   - Completes purchase in 30 seconds total

9. Order confirmation email
   - "Thank you! We're processing your pet photos now."
   - "You'll receive a preview email within 1 hour."
   - "Production starts after you approve the preview."

10. Email received (45 min later)
    - Subject: "Your Pet Preview is Ready!"
    - Body: Shows 2 processed images (Bella & Milo)
    - CTA: "Approve to Start Production" or "Request Changes"
```

**Time to Purchase**: 10 seconds (vs 25s with forced preview)
**Friction Points**: Zero (all optional, clear messaging)
**Trust**: High (email preview before production)

---

### Scenario 3B: Send Later (No Photos)

**Customer**: Mike, 45, desktop user, wants to order now, send photo later

**Journey**:
```
1. Lands on product page
   - Sees "Pet Name (Required)" field
   - Sees "Upload Optional" with 3 choices

2. Enters pet name: "Max"
   - "Add to Cart" button enables immediately

3. Sees upload options:
   - Option 1: Ordering Again? (skips - first order)
   - Option 2: Upload New Photo (skips - don't have photo handy)
   - Option 3: "I'll send my photo later" (taps this)

4. Modal appears: "Send Photo After Checkout"
   - "We'll email you a secure upload link"
   - "Upload deadline: 24 hours"
   - "Production starts after we receive your photo"
   - [Continue]

5. Taps "Continue"
   - Modal closes
   - "Add to Cart" button shows: "Add to Cart (Photo: Send Later)"

6. Adds to cart, checks out
   - Purchase completes in 5 seconds

7. Order confirmation email
   - "Thank you! Upload your photo to complete your order."
   - Secure upload link: "Upload Max's Photo"
   - Deadline: "Please upload by Oct 21, 11:59 PM"
   - Reminder: "We'll email you at 12h and 23h if not received"

8. Email reminder (12 hours later)
   - "Reminder: Upload Max's photo"
   - Same upload link
   - "18 hours remaining"

9. Customer uploads photo via email link
   - Opens link on phone
   - Upload form (same UI as quick upload)
   - Uploads photo, submits

10. Confirmation email
    - "Photo received! Processing now."
    - "Preview in your inbox within 1 hour"
    - "Approve to start production"
```

**Time to Purchase**: 5 seconds (fastest path)
**Friction Points**: Zero (deferred upload)
**Risk**: Customer forgets to upload (mitigated by reminders)

---

## 5. Error Handling & Edge Cases

### Error 1: File Too Large (>50MB)

**Trigger**: Customer selects DSLR photo (80MB RAW file)

**UI Response**:
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ File Too Large                                    │
│                                                      │
│ IMG_9876.CR2 is 80MB (max 50MB per file)            │
│                                                      │
│ Try:                                                 │
│ • Use your phone's native camera (not RAW mode)     │
│ • Export from photo app as JPEG                     │
│ • Email us at photos@perkieprints.com for help      │
│                                                      │
│ [Try Again] [Contact Support]                       │
└─────────────────────────────────────────────────────┘
```

**Actionable**: Clear next steps, support contact

---

### Error 2: More Than 3 Files Selected

**Trigger**: Customer tries to select 5 photos

**UI Response** (Immediate, before upload):
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Too Many Photos                                   │
│                                                      │
│ You selected 5 photos. Maximum 3 per product.       │
│                                                      │
│ Please select up to 3 photos, then try again.       │
│                                                      │
│ Need more pets? Add this product multiple times!    │
│                                                      │
│ [OK, Got It]                                         │
└─────────────────────────────────────────────────────┘
```

**Prevention**: File picker clears automatically, must re-select

---

### Error 3: No Files Selected (Empty Upload)

**Trigger**: Customer taps "Upload & Continue" without selecting files

**UI Response**:
```
┌─────────────────────────────────────────────────────┐
│ ℹ️ No Photos Selected                                │
│                                                      │
│ Please choose 1-3 photos, or tap "I'll Send Later"  │
│ to upload after checkout.                            │
│                                                      │
│ [Choose Photos] [Send Later Instead]                │
└─────────────────────────────────────────────────────┘
```

**Guidance**: Clear alternatives

---

### Error 4: Unsupported File Type

**Trigger**: Customer selects PDF or video

**UI Response**:
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Unsupported File Type                             │
│                                                      │
│ PetVideo.mp4 is not supported.                       │
│                                                      │
│ Accepted formats:                                    │
│ • JPG, JPEG (recommended)                            │
│ • PNG                                                │
│ • HEIC (iPhone photos)                               │
│ • WebP                                               │
│                                                      │
│ [Choose Photo Instead]                               │
└─────────────────────────────────────────────────────┘
```

**Education**: List accepted formats

---

### Edge Case 1: Customer Uploads Same Photo Twice

**Detection**: File hash comparison (JavaScript)

**UI Response**:
```
┌─────────────────────────────────────────────────────┐
│ ℹ️ Duplicate Photo Detected                          │
│                                                      │
│ You selected the same photo twice:                  │
│ IMG_1234.jpg appears in slot 1 and slot 2           │
│                                                      │
│ Did you mean to upload 2 different pets?            │
│                                                      │
│ [Keep Duplicate] [Choose Different Photo]           │
└─────────────────────────────────────────────────────┘
```

**Flexibility**: Allow duplicates if intentional

---

### Edge Case 2: Pet Name Count Mismatch

**Trigger**: 2 pet names, 1 photo uploaded

**UI Response** (Warning, not blocker):
```
┌─────────────────────────────────────────────────────┐
│ ⚠️ Pet Names vs Photos Mismatch                      │
│                                                      │
│ You entered 2 pet names (Bella, Milo)               │
│ But uploaded 1 photo                                 │
│                                                      │
│ This is OK! We'll:                                   │
│ • Use your photo for the first pet (Bella)          │
│ • Email you to upload Milo's photo later            │
│                                                      │
│ Or you can upload more photos now:                  │
│                                                      │
│ [Add More Photos] [Continue Anyway]                 │
└─────────────────────────────────────────────────────┘
```

**Smart handling**: Allow mismatch, clarify behavior

---

### Edge Case 3: iOS Safari File Picker Cancellation

**Trigger**: Customer opens file picker, then cancels

**UI Response**: Silent (no error)

**Behavior**:
- No change to UI
- Previous file selection (if any) remains
- "Choose Photo(s)" button still available

**Rationale**: Cancellation is not an error, just user control

---

### Edge Case 4: Slow Network (Upload Timeout)

**Trigger**: Mobile user on 2G, upload takes >60s

**UI Response** (Progressive):
```
Step 1 (0-10s): Normal upload progress
┌─────────────────────────────────────────────────────┐
│ Uploading 2 photos...                                │
│ [=============>                ] 40%                 │
└─────────────────────────────────────────────────────┘

Step 2 (10-30s): Slow network warning
┌─────────────────────────────────────────────────────┐
│ ⚠️ Slow connection detected                          │
│ [==================>          ] 65%                  │
│                                                      │
│ This may take a minute. Stay on this page.          │
└─────────────────────────────────────────────────────┘

Step 3 (30-60s): Still uploading...
┌─────────────────────────────────────────────────────┐
│ Almost there...                                      │
│ [=======================>     ] 85%                  │
│                                                      │
│ Hang tight! Your connection is slow but we're       │
│ making progress.                                     │
└─────────────────────────────────────────────────────┘

Step 4 (60s+): Timeout, offer alternative
┌─────────────────────────────────────────────────────┐
│ ⚠️ Upload Taking Too Long                            │
│                                                      │
│ Your connection is too slow to upload now.          │
│                                                      │
│ Options:                                             │
│ 1. Complete checkout, we'll email upload link       │
│ 2. Try again on WiFi                                 │
│ 3. Email photos to support@perkieprints.com         │
│                                                      │
│ [Checkout & Send Later] [Retry on WiFi]            │
└─────────────────────────────────────────────────────┘
```

**Graceful degradation**: Always provide path forward

---

## 6. Trust Signals & Messaging

### Trust Signal 1: Privacy & Security

**Placement**: Below file upload button

**Messaging**:
```
🔒 Your photos are secure
• Uploaded via encrypted connection (SSL)
• Stored on Google Cloud (SOC 2 compliant)
• Never shared or used for marketing
• Deleted 90 days after order fulfillment
```

**CSS**:
```css
.trust-badge {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 1rem;
  background: #f8f9fa;
  border-left: 4px solid #28a745;
  border-radius: 6px;
  margin-top: 1rem;
}

.trust-badge .lock-icon {
  font-size: 24px;
  color: #28a745;
  flex-shrink: 0;
}

.trust-badge .trust-content h4 {
  margin: 0 0 0.5rem;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.trust-badge .trust-content ul {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}
```

---

### Trust Signal 2: Approval Before Production

**Placement**: After file selection, before "Continue"

**Messaging**:
```
✅ You'll approve before we print
We'll email you a preview within 1 hour. Production starts only after you approve.
```

---

### Trust Signal 3: Free Changes

**Placement**: Bottom of upload modal

**Messaging**:
```
💙 Free changes within 24 hours
Not happy with the preview? We'll reprocess or refund—no questions asked.
```

---

### Trust Signal 4: Expert Quality Check

**Placement**: Order confirmation email

**Messaging**:
```
👨‍🎨 Artist Quality Check
Every photo is reviewed by our team before printing. We'll contact you if we spot any quality issues.
```

---

## 7. Accessibility Requirements (WCAG 2.1 AA)

### Requirement 1: Keyboard Navigation

**All interactive elements must be keyboard accessible**:
- File upload button: Tab to focus, Enter/Space to activate
- Remove file buttons: Tab to focus, Enter/Space to remove
- Bottom sheet close: Tab to focus, Enter/Escape to close
- All buttons: Tab order matches visual order

**Implementation**:
```javascript
// Focus trap in modal
const focusableElements = modal.querySelectorAll(
  'button, input, [tabindex]:not([tabindex="-1"])'
);
const firstElement = focusableElements[0];
const lastElement = focusableElements[focusableElements.length - 1];

modal.addEventListener('keydown', function(e) {
  if (e.key === 'Tab') {
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
});
```

---

### Requirement 2: Screen Reader Support

**ARIA labels and live regions**:

```html
<!-- File upload -->
<button
  aria-label="Choose pet photos to upload. Maximum 3 files accepted. Formats: JPEG, PNG, HEIC."
  aria-describedby="upload-help">
  Choose Photo(s)
</button>

<div id="upload-help" class="sr-only">
  Select 1 to 3 pet photos from your device. Accepted formats: JPEG, PNG, HEIC. Maximum 50MB per file.
</div>

<!-- File count announcer -->
<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
  <span id="file-count-announce"></span>
</div>

<script>
function announceFileCount(count) {
  const announcer = document.getElementById('file-count-announce');
  announcer.textContent = `${count} ${count === 1 ? 'file' : 'files'} selected for upload`;
}
</script>

<!-- Progress announcer -->
<div role="status" aria-live="assertive" aria-atomic="true" class="sr-only">
  <span id="upload-progress-announce"></span>
</div>
```

---

### Requirement 3: Color Contrast

**All text must meet 4.5:1 contrast ratio**:

```css
/* Primary text: #333 on white = 12.6:1 ✓ */
.primary-text {
  color: #333;
  background: #fff;
}

/* Secondary text: #666 on white = 5.7:1 ✓ */
.secondary-text {
  color: #666;
  background: #fff;
}

/* Error text: #721c24 on #f8d7da = 6.1:1 ✓ */
.error-message {
  color: #721c24;
  background: #f8d7da;
}

/* Success text: #155724 on #d4edda = 7.2:1 ✓ */
.success-message {
  color: #155724;
  background: #d4edda;
}

/* Link text: #007bff on white = 4.5:1 ✓ */
a {
  color: #007bff;
}

/* Disabled button: #6c757d on #e9ecef = 3.2:1 ✗ */
/* Fix: Increase contrast */
.btn-disabled {
  color: #495057; /* Darker gray = 5.5:1 ✓ */
  background: #e9ecef;
}
```

---

### Requirement 4: Focus Visible

**All focusable elements must have visible focus indicator**:

```css
/* Global focus style */
*:focus {
  outline: none; /* Remove default */
}

*:focus-visible {
  outline: 3px solid #007bff;
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  *:focus-visible {
    outline: 3px solid currentColor;
    outline-offset: 2px;
  }
}

/* Button focus (more prominent) */
button:focus-visible {
  outline: 3px solid #007bff;
  outline-offset: 2px;
  box-shadow: 0 0 0 5px rgba(0, 123, 255, 0.2);
}

/* Input focus */
input:focus-visible {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.15);
}
```

---

### Requirement 5: Error Identification

**Errors must be announced and clearly identified**:

```html
<!-- Invalid pet name -->
<div class="form-field">
  <label for="pet-name">Pet Name(s) *</label>
  <input
    id="pet-name"
    aria-invalid="true"
    aria-describedby="pet-name-error">
  <div id="pet-name-error" role="alert" class="error-message">
    Pet name is required. Please enter at least one name.
  </div>
</div>

<!-- File validation error -->
<div role="alert" aria-live="assertive" class="error-message">
  <strong>Error:</strong> File too large (80MB). Maximum 50MB per file.
</div>
```

---

## 8. Mobile-Specific Optimizations

### Optimization 1: Touch Target Sizes

**Minimum 44x44px for all tappable elements** (Apple HIG, Material Design):

```css
/* Buttons */
.btn-primary,
.btn-secondary {
  min-height: 48px;
  min-width: 48px;
  padding: 0 1.5rem;
}

/* File upload trigger */
.file-upload-trigger {
  min-height: 200px;
  width: 100%;
}

/* Remove file buttons */
.remove-file {
  width: 44px;
  height: 44px;
  font-size: 24px;
}

/* Bottom sheet close */
.bottom-sheet-close {
  width: 44px;
  height: 44px;
}

/* Checkbox/radio (if used) */
input[type="checkbox"],
input[type="radio"] {
  width: 24px;
  height: 24px;
  margin: 10px; /* Extends tap target to 44x44 */
}
```

---

### Optimization 2: iOS Safari Specific

**Handle iOS quirks**:

```css
/* Disable double-tap zoom on buttons */
button,
input[type="submit"],
input[type="button"] {
  touch-action: manipulation;
}

/* Prevent input zoom on focus (font-size >= 16px) */
input,
textarea,
select {
  font-size: 16px; /* Critical: prevents zoom */
}

/* Fix iOS safe area (notch) */
.bottom-sheet {
  padding-bottom: env(safe-area-inset-bottom);
}

/* Disable iOS input shadows */
input,
textarea {
  -webkit-appearance: none;
  appearance: none;
}

/* Fix iOS sticky hover states */
@media (hover: none) {
  button:hover {
    background: initial; /* Disable hover on touch */
  }
}
```

**iOS Camera/Gallery Behavior**:
```html
<!-- Prefer rear camera for pet photos -->
<input type="file" capture="environment" accept="image/*">

<!-- Result on iOS:
   - "Take Photo" opens rear camera
   - "Photo Library" opens gallery
   - "Browse" opens Files app
-->
```

---

### Optimization 3: Android Chrome Specific

**Handle Android quirks**:

```html
<!-- Multiple file selection -->
<input type="file" multiple accept="image/*">

<!-- Result on Android:
   - "Camera" opens camera app
   - "Gallery" opens photos app
   - "Files" opens file manager
   - Multiple selection enabled in gallery
-->
```

**Android Performance**:
```javascript
// Throttle file preview generation (Android can be slow)
function generatePreviews(files) {
  const promises = Array.from(files).map((file, index) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({file, dataUrl: e.target.result});
        reader.readAsDataURL(file);
      }, index * 100); // Stagger by 100ms to avoid jank
    });
  });

  return Promise.all(promises);
}
```

---

### Optimization 4: Network Awareness

**Adapt to connection speed**:

```javascript
// Detect connection type (Chrome only)
if ('connection' in navigator) {
  const conn = navigator.connection;
  const effectiveType = conn.effectiveType; // '4g', '3g', '2g', 'slow-2g'

  if (effectiveType === '2g' || effectiveType === 'slow-2g') {
    // Show warning before upload
    showSlowConnectionWarning();

    // Suggest "Send Later" option
    highlightSendLaterOption();
  }
}

function showSlowConnectionWarning() {
  const warning = document.createElement('div');
  warning.className = 'connection-warning';
  warning.innerHTML = `
    ⚠️ <strong>Slow connection detected</strong><br>
    Uploading photos may take 1-2 minutes. Consider using "Send Later" option.
  `;
  // Append to modal
}
```

---

### Optimization 5: Thumb Zone Layout

**Place primary actions in bottom third of screen** (one-handed use):

```
┌─────────────────────────────────────────────────────┐
│                                                      │ ← Top third
│  [Content area]                                      │   (read-only)
│  [Scrollable content]                                │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │ ← Middle third
│  [Less important actions]                            │   (secondary)
│  [Optional inputs]                                   │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │ ← Bottom third
│  [Upload & Continue]  ← Primary CTA                  │   (thumb zone)
│  [Or use full preview]  ← Secondary option           │   EASY TO REACH
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Right-handed vs left-handed**:
- Right-handed: Bottom-right corner easiest
- Left-handed: Bottom-left corner easiest
- **Solution**: Full-width buttons (reachable by both)

---

## 9. Visual Design Specifications

### Typography

```css
/* Font stack (Shopify Dawn theme compatible) */
:root {
  --font-body: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-heading: var(--font-body);
}

/* Type scale */
.heading-large {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
}

.heading-medium {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
}

.heading-small {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
}

.body-large {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
}

.body-medium {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
}

.body-small {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
}

.label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  text-transform: none;
}

/* Mobile adjustments */
@media (max-width: 750px) {
  .heading-large { font-size: 20px; }
  .heading-medium { font-size: 18px; }
  .heading-small { font-size: 16px; }
}
```

---

### Color Palette

```css
:root {
  /* Primary (Brand Blue) */
  --color-primary: #007bff;
  --color-primary-hover: #0056b3;
  --color-primary-light: rgba(0, 123, 255, 0.1);

  /* Grayscale */
  --color-text-primary: #333;
  --color-text-secondary: #666;
  --color-text-tertiary: #999;
  --color-border: #ddd;
  --color-background: #f8f9fa;
  --color-background-hover: #e9ecef;

  /* Semantic */
  --color-success: #28a745;
  --color-success-bg: #d4edda;
  --color-error: #d9534f;
  --color-error-bg: #f8d7da;
  --color-warning: #ffc107;
  --color-warning-bg: #fff3cd;
  --color-info: #17a2b8;
  --color-info-bg: #d1ecf1;
}
```

---

### Spacing System

```css
:root {
  --space-xs: 0.25rem;  /* 4px */
  --space-sm: 0.5rem;   /* 8px */
  --space-md: 1rem;     /* 16px */
  --space-lg: 1.5rem;   /* 24px */
  --space-xl: 2rem;     /* 32px */
  --space-2xl: 3rem;    /* 48px */
}

/* Usage */
.component {
  padding: var(--space-lg);
  margin-bottom: var(--space-md);
  gap: var(--space-sm);
}
```

---

### Border Radius

```css
:root {
  --radius-sm: 4px;   /* Subtle rounding */
  --radius-md: 8px;   /* Default */
  --radius-lg: 12px;  /* Cards, modals */
  --radius-xl: 24px;  /* Bottom sheet top corners */
  --radius-full: 50%; /* Circles */
}

/* Usage */
.btn { border-radius: var(--radius-md); }
.modal { border-radius: var(--radius-lg); }
.bottom-sheet { border-radius: var(--radius-xl) var(--radius-xl) 0 0; }
```

---

### Shadows

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 20px rgba(0, 0, 0, 0.15);
  --shadow-xl: 0 20px 40px rgba(0, 0, 0, 0.2);
}

/* Usage */
.card { box-shadow: var(--shadow-md); }
.modal { box-shadow: var(--shadow-xl); }
.btn:hover { box-shadow: var(--shadow-sm); }
```

---

## 10. Technical Implementation Details

### 10.1 Shopify Line Item Properties

**How Shopify stores uploaded files**:

```html
<!-- Form structure -->
<form action="/cart/add" method="post" enctype="multipart/form-data">

  <!-- Product variant ID -->
  <input type="hidden" name="id" value="{{ product.selected_or_first_available_variant.id }}">

  <!-- Pet name (line item property) -->
  <input
    type="text"
    name="properties[Pet Name]"
    value="Bella, Milo">

  <!-- File upload (line item property) -->
  <!-- NOTE: Shopify accepts multiple files via separate inputs -->
  <input
    type="file"
    name="properties[Pet Photo 1]"
    accept="image/*">

  <input
    type="file"
    name="properties[Pet Photo 2]"
    accept="image/*">

  <input
    type="file"
    name="properties[Pet Photo 3]"
    accept="image/*">

  <!-- Hidden order type -->
  <input type="hidden" name="properties[_order_type]" value="express_upload">

  <!-- Submit -->
  <button type="submit" name="add">Add to Cart</button>
</form>
```

**What happens after submission**:
1. Shopify uploads files to secure CDN
2. Generates unique URLs for each file
3. Stores URLs in line item properties
4. Properties accessible in:
   - Cart API: `item.properties`
   - Order API: `line_item.properties`
   - Admin: Order details page

**File URL format**:
```
https://cdn.shopify.com/s/files/1/0029/3057/3424/files/pet-photo-1_1234567890.jpg?v=1697825400
```

**Accessing in Liquid** (cart drawer):
```liquid
{% for item in cart.items %}
  {% if item.properties['Pet Photo 1'] %}
    <img src="{{ item.properties['Pet Photo 1'] }}" alt="Pet photo 1">
  {% endif %}
{% endfor %}
```

---

### 10.2 Multi-File Upload Implementation

**Problem**: Shopify's file input only accepts one file per property

**Solution**: Use 3 separate hidden inputs, populate via JavaScript

```html
<!-- Visible upload button (custom UI) -->
<button type="button" onclick="triggerFileUpload()">
  Choose Photo(s)
</button>

<!-- Hidden file inputs (3 separate) -->
<input type="file" id="file-input-1" name="properties[Pet Photo 1]" style="display:none;" accept="image/*">
<input type="file" id="file-input-2" name="properties[Pet Photo 2]" style="display:none;" accept="image/*">
<input type="file" id="file-input-3" name="properties[Pet Photo 3]" style="display:none;" accept="image/*">

<!-- Temporary multi-select input (not submitted) -->
<input type="file" id="temp-file-input" multiple accept="image/*" style="display:none;" onchange="distributeFiles(event)">
```

**JavaScript**:
```javascript
function triggerFileUpload() {
  document.getElementById('temp-file-input').click();
}

function distributeFiles(event) {
  const files = event.target.files;
  const maxFiles = 3;

  // Clear previous selections
  for (let i = 1; i <= maxFiles; i++) {
    const input = document.getElementById(`file-input-${i}`);
    input.value = '';
  }

  // Distribute files to individual inputs
  for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
    const input = document.getElementById(`file-input-${i + 1}`);
    const dt = new DataTransfer();
    dt.items.add(files[i]);
    input.files = dt.files;
  }

  // Generate previews
  handleFileSelection(files);
}
```

**Result**: Form submits with 1-3 file inputs populated

---

### 10.3 Progressive Enhancement (No JavaScript)

**Fallback for browsers with JavaScript disabled**:

```html
<noscript>
  <div class="no-js-upload">
    <p><strong>JavaScript is disabled.</strong> Please use the basic upload form below:</p>

    <form action="/cart/add" method="post" enctype="multipart/form-data">
      <input type="hidden" name="id" value="{{ product.variant.id }}">

      <label for="pet-name-nojs">Pet Name(s):</label>
      <input type="text" id="pet-name-nojs" name="properties[Pet Name]" required>

      <label for="photo-1-nojs">Pet Photo 1:</label>
      <input type="file" id="photo-1-nojs" name="properties[Pet Photo 1]" accept="image/*">

      <label for="photo-2-nojs">Pet Photo 2 (Optional):</label>
      <input type="file" id="photo-2-nojs" name="properties[Pet Photo 2]" accept="image/*">

      <label for="photo-3-nojs">Pet Photo 3 (Optional):</label>
      <input type="file" id="photo-3-nojs" name="properties[Pet Photo 3]" accept="image/*">

      <button type="submit">Add to Cart</button>
    </form>
  </div>
</noscript>
```

**Result**: Basic functionality works without JavaScript (graceful degradation)

---

### 10.4 Backend Processing Flow

**Post-purchase processing workflow**:

```
1. Customer completes checkout
   ↓
2. Shopify Order Webhook fires: "orders/create"
   ↓
3. Backend receives webhook payload
   ↓
4. Extract line item properties:
   - Pet Name: "Bella, Milo"
   - Pet Photo 1: "https://cdn.shopify.com/..."
   - Pet Photo 2: "https://cdn.shopify.com/..."
   - Order Type: "express_upload"
   ↓
5. Download images from Shopify CDN
   ↓
6. Upload to InSPyReNet API for processing
   ↓
7. Process background removal + effects (3-11s)
   ↓
8. Upload processed images to GCS
   ↓
9. Update Shopify order metafields:
   - Processed Image URLs
   - Effect used
   - Processing status: "complete"
   ↓
10. Send email to customer:
    Subject: "Your Pet Preview is Ready!"
    Body: Shows processed images
    CTA: "Approve to Start Production"
   ↓
11. Customer clicks "Approve" link
   ↓
12. Update order metafield: approval_status = "approved"
   ↓
13. Trigger fulfillment workflow
```

**Endpoint needed**: `POST /api/webhooks/shopify/orders-create`

**Webhook payload** (relevant excerpt):
```json
{
  "id": 1234567890,
  "order_number": 1001,
  "line_items": [
    {
      "id": 987654321,
      "variant_id": 45678901234,
      "title": "Personalized Pet Portrait",
      "quantity": 1,
      "properties": [
        {
          "name": "Pet Name",
          "value": "Bella, Milo"
        },
        {
          "name": "Pet Photo 1",
          "value": "https://cdn.shopify.com/s/files/1/0029/3057/3424/files/pet-photo-1_1234567890.jpg"
        },
        {
          "name": "Pet Photo 2",
          "value": "https://cdn.shopify.com/s/files/1/0029/3057/3424/files/pet-photo-2_0987654321.jpg"
        },
        {
          "name": "_order_type",
          "value": "express_upload"
        }
      ]
    }
  ]
}
```

---

### 10.5 Email Preview System

**Email template** (SendGrid/Mailchimp):

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Pet Preview is Ready!</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">

    <!-- Header -->
    <div style="background: #007bff; color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0;">Your Pet Preview is Ready! 🎨</h1>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">

      <p style="font-size: 16px; color: #333;">Hi {{customer_name}},</p>

      <p style="font-size: 16px; color: #333;">
        Great news! We've processed your pet photos and created beautiful artwork.
        Check out the preview below:
      </p>

      <!-- Pet Images -->
      <div style="margin: 30px 0;">

        <!-- Bella -->
        <div style="margin-bottom: 30px;">
          <h3 style="margin: 0 0 10px; color: #333;">Bella - Original Effect</h3>
          <img src="{{bella_processed_url}}" alt="Bella processed" style="width: 100%; max-width: 400px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        </div>

        <!-- Milo -->
        <div style="margin-bottom: 30px;">
          <h3 style="margin: 0 0 10px; color: #333;">Milo - Pop Art Effect</h3>
          <img src="{{milo_processed_url}}" alt="Milo processed" style="width: 100%; max-width: 400px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        </div>

      </div>

      <!-- CTA -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{approval_link}}" style="display: inline-block; background: #28a745; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-size: 18px; font-weight: 600;">
          ✅ Approve & Start Production
        </a>
      </div>

      <p style="font-size: 14px; color: #666; text-align: center;">
        Not happy with the results?
        <a href="{{changes_link}}" style="color: #007bff;">Request free changes</a>
      </p>

      <!-- Timeline -->
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <h4 style="margin: 0 0 10px; color: #333;">What happens next?</h4>
        <ul style="margin: 0; padding-left: 20px; color: #666;">
          <li>Click "Approve" above to confirm you love it</li>
          <li>We'll start printing within 24 hours</li>
          <li>Your order ships in 3-5 business days</li>
          <li>You'll receive tracking info via email</li>
        </ul>
      </div>

      <!-- Footer -->
      <p style="font-size: 14px; color: #999; text-align: center; margin-top: 30px;">
        Questions? Reply to this email or contact us at support@perkieprints.com
      </p>

    </div>

  </div>

</body>
</html>
```

**Variables**:
- `{{customer_name}}`: From order data
- `{{bella_processed_url}}`: GCS URL
- `{{milo_processed_url}}`: GCS URL
- `{{approval_link}}`: Unique token URL
- `{{changes_link}}`: Customer service form

---

## 11. Success Metrics & Analytics

### Key Performance Indicators (KPIs)

**Primary Metrics**:
1. **Quick Upload Adoption Rate**: % customers who use quick upload vs full preview
2. **Time to Purchase**: Average seconds from page load to cart add
3. **Cart Abandonment Rate**: % who abandon after file upload
4. **Upload Success Rate**: % successful uploads (no errors)
5. **Preview Approval Rate**: % who approve email preview vs request changes

**Target Benchmarks**:
| Metric | Current (Forced Preview) | Target (Quick Upload) | Improvement |
|--------|--------------------------|----------------------|-------------|
| Time to Purchase | 15-30s | 10-15s | -50% |
| Cart Abandonment | 69% | 40% | -42% |
| Upload Success | N/A | 95%+ | New metric |
| Approval Rate | N/A | 85%+ | New metric |

---

### Analytics Events (Google Analytics 4)

```javascript
// Event 1: Quick Upload Modal Opened
gtag('event', 'quick_upload_modal_opened', {
  'event_category': 'engagement',
  'event_label': 'product_page',
  'source': 'quick_upload_button'
});

// Event 2: Files Selected
gtag('event', 'files_selected', {
  'event_category': 'engagement',
  'event_label': 'file_count',
  'value': fileCount, // 1, 2, or 3
  'file_types': 'jpg,png', // Comma-separated
  'total_size_mb': totalSizeMB
});

// Event 3: Upload Completed
gtag('event', 'quick_upload_completed', {
  'event_category': 'conversion',
  'event_label': 'success',
  'upload_duration_seconds': durationInSeconds,
  'file_count': fileCount
});

// Event 4: Upload Error
gtag('event', 'quick_upload_error', {
  'event_category': 'error',
  'event_label': errorType, // 'file_too_large', 'too_many_files', etc.
  'file_name': fileName
});

// Event 5: Add to Cart (with upload status)
gtag('event', 'add_to_cart', {
  'event_category': 'ecommerce',
  'items': [{
    'item_id': productId,
    'item_name': productName,
    'price': productPrice
  }],
  'upload_status': 'completed', // 'completed', 'send_later', 'none'
  'file_count': fileCount
});

// Event 6: Preview Email Sent
gtag('event', 'preview_email_sent', {
  'event_category': 'engagement',
  'event_label': 'post_purchase',
  'order_number': orderNumber,
  'pet_count': petCount
});

// Event 7: Preview Approved
gtag('event', 'preview_approved', {
  'event_category': 'conversion',
  'event_label': 'email_link',
  'order_number': orderNumber,
  'time_to_approval_hours': hoursFromEmailSent
});
```

---

### A/B Testing Plan

**Test 1: Quick Upload vs Full Preview** (2 weeks)
- **Control**: Current forced preview flow (no quick upload option)
- **Variant**: New quick upload option available
- **Hypothesis**: Quick upload will increase conversion by 30-60%
- **Sample size**: 500 visitors per variant (1000 total)
- **Success criteria**: +20% conversion rate improvement

**Test 2: Modal vs Inline Upload** (1 week)
- **Control**: Bottom sheet modal for quick upload
- **Variant**: Inline upload form on product page (no modal)
- **Hypothesis**: Inline will have higher completion (less friction)
- **Sample size**: 200 uploads per variant (400 total)
- **Success criteria**: +15% upload completion rate

**Test 3: Upload Button Copy** (1 week)
- **Control**: "Quick Upload"
- **Variant A**: "Upload & Skip Preview"
- **Variant B**: "Upload Now, Preview Later"
- **Hypothesis**: Clearer copy will increase click-through
- **Sample size**: 300 visitors per variant (900 total)
- **Success criteria**: +10% button click-through rate

---

## 12. Phased Rollout Plan (4 Weeks)

### Week 1: Foundation + Pet Name Decoupling

**Goal**: Enable add-to-cart with pet name only (no photo required)

**Tasks**:
1. ✅ Add visible pet name input field to product page
2. ✅ Update add-to-cart button logic (enable on name entry)
3. ✅ Add validation for pet name format
4. ✅ Update cart drawer to show pet name
5. ✅ Add "Upload later" hidden field to track intent

**Deliverables**:
- Pet name visible and required on all custom products
- Add-to-cart enabled without photo upload
- Cart shows: "Pet: Bella, Milo (Photo: Upload later)"

**Testing**:
- Functional: Can add to cart with name only
- Visual: Pet name field matches design spec
- Mobile: Input doesn't trigger zoom (font-size 16px)

**Success Criteria**:
- Cart add-to-cart success rate: 100% (vs ~30% current)
- No regression in full preview flow

---

### Week 2: Quick Upload Modal + File Handling

**Goal**: Implement bottom sheet modal with file upload

**Tasks**:
1. ✅ Build bottom sheet modal component
2. ✅ Implement file input with multi-select
3. ✅ Add file preview thumbnails
4. ✅ Add file validation (size, type, count)
5. ✅ Implement swipe-to-dismiss gesture
6. ✅ Add success/error states
7. ✅ Connect to Shopify line item properties

**Deliverables**:
- Working bottom sheet modal on mobile
- 1-3 file upload with previews
- Files attached to cart as line item properties

**Testing**:
- iOS Safari: Camera/gallery picker works
- Android Chrome: Multi-select works
- File validation: Rejects >50MB, >3 files
- Accessibility: Keyboard navigation, screen reader

**Success Criteria**:
- 95%+ upload success rate
- <5s average upload time
- Zero crashes or hangs

---

### Week 3: Post-Purchase Processing + Email Preview

**Goal**: Async background processing and email approval flow

**Tasks**:
1. ✅ Create Shopify webhook handler (`orders/create`)
2. ✅ Download images from Shopify CDN
3. ✅ Send to InSPyReNet API for processing
4. ✅ Upload processed images to GCS
5. ✅ Update order metafields with processed URLs
6. ✅ Design and send preview email template
7. ✅ Create approval landing page
8. ✅ Add "Request Changes" flow

**Deliverables**:
- Webhook processes orders automatically
- Email sent within 1 hour of order
- Approval link updates order status

**Testing**:
- End-to-end: Order → Processing → Email → Approval
- Error handling: API timeout, image quality issues
- Email rendering: Gmail, Outlook, Apple Mail

**Success Criteria**:
- 99% webhook success rate
- <1 hour average processing time
- 85%+ email open rate

---

### Week 4: "Send Later" Option + Reminder Emails

**Goal**: Enable checkout without upload, email reminder system

**Tasks**:
1. ✅ Add "I'll Send Later" button to product page
2. ✅ Create post-purchase upload landing page
3. ✅ Generate unique upload tokens per order
4. ✅ Build reminder email schedule (12h, 23h)
5. ✅ Add upload deadline enforcement (24h)
6. ✅ Create expired deadline error page

**Deliverables**:
- "Send Later" option visible on product page
- Secure upload link in order confirmation email
- Automated reminder emails if not uploaded

**Testing**:
- Token security: Cannot guess other orders' tokens
- Upload form: Same UX as quick upload modal
- Deadline: Hard stop at 24 hours
- Reminders: Fire at correct times

**Success Criteria**:
- 70%+ customers upload within 24h
- <5% deadline violations (require support)
- 90%+ reminder email open rate

---

### Post-Launch Monitoring (Ongoing)

**Week 5-8: Optimization + Refinement**

**Monitor**:
- Quick upload adoption rate (target: 40-60%)
- Full preview adoption rate (target: 30-40%)
- Send later adoption rate (target: 10-20%)
- Upload success rate (target: 95%+)
- Preview approval rate (target: 85%+)
- Time to approval (target: <24h average)

**Iterate**:
- Adjust copy based on user feedback
- Optimize file validation error messages
- Improve email template based on open rates
- Add FAQ section for common issues

---

## 13. Files to Create/Modify

### New Files

1. **`snippets/ks-pet-quick-upload-modal.liquid`**
   - Bottom sheet modal HTML
   - File upload input
   - Preview thumbnails
   - Trust signals

2. **`assets/pet-quick-upload.js`**
   - Modal open/close logic
   - File selection handler
   - Preview generation
   - Validation
   - Analytics tracking

3. **`assets/pet-quick-upload.css`**
   - Bottom sheet styles
   - File upload button
   - Thumbnail grid
   - Mobile optimizations

4. **`backend/shopify-webhooks/orders-create.py`** (new)
   - Webhook handler
   - Image download from Shopify CDN
   - InSPyReNet API integration
   - GCS upload
   - Order metafield updates

5. **`email-templates/preview-ready.html`**
   - Email preview template
   - Approval CTA
   - Request changes link

6. **`pages/upload-post-purchase.liquid`**
   - Upload landing page for "send later"
   - Token validation
   - File upload form

---

### Modified Files

1. **`snippets/ks-product-pet-selector.liquid`** (lines 81-176)
   - Add "Quick Upload" button
   - Add "I'll Send Later" button
   - Update pet name field visibility
   - Add modal trigger

2. **`assets/cart-pet-integration.js`** (lines 199-231)
   - Update `disableAddToCart()` logic
   - Enable cart on pet name entry (photo optional)
   - Add file upload status indicator

3. **`snippets/cart-drawer.liquid`**
   - Display pet name
   - Show file upload status (count)
   - Add thumbnail previews if uploaded

4. **`sections/main-product.liquid`**
   - Include quick upload modal snippet
   - Add analytics tracking for quick upload events

---

## 14. Next Steps

### Immediate Actions

1. **Read this document** (you are here!)
2. **Consult ai-product-manager-ecommerce**
   - Define business rules for post-purchase upload
   - Determine order hold policies (when to ship)
   - Set upload deadline (24h recommended)
   - Define refund policy for non-upload

3. **Consult mobile-commerce-architect**
   - Review bottom sheet implementation for iOS/Android
   - Validate thumb-zone layout
   - Test swipe-to-dismiss gesture

4. **Consult solution-verification-auditor**
   - Review implementation plan for completeness
   - Identify edge cases not covered
   - Define acceptance criteria for each phase

### Development Workflow

**Phase 1 (Week 1)**: Start with foundation
- Create branch: `feature/quick-upload-phase-1`
- Implement pet name decoupling
- Test on staging
- Merge to staging branch
- Deploy to staging environment

**Phase 2 (Week 2)**: Build upload modal
- Create branch: `feature/quick-upload-phase-2`
- Implement bottom sheet + file upload
- Test on staging (iOS Safari, Android Chrome)
- Merge to staging
- Deploy to staging

**Phase 3 (Week 3)**: Backend processing
- Backend only (no frontend changes)
- Deploy webhook handler to production
- Test with staging Shopify store
- Monitor logs for errors

**Phase 4 (Week 4)**: Send later option
- Create branch: `feature/quick-upload-phase-4`
- Implement "send later" flow
- Test reminder emails
- Merge to staging
- Deploy to staging

**Production Rollout**: After all phases tested on staging
- Merge staging → main
- Deploy to production Shopify store
- Monitor analytics for 48 hours
- Gather user feedback
- Iterate based on data

---

## 15. Risk Assessment & Mitigation

### Risk 1: High File Upload Failure Rate

**Likelihood**: Medium
**Impact**: High (blocks conversion)
**Mitigation**:
- Progressive enhancement: Degrade gracefully to "send later"
- Clear error messages with retry options
- Network detection: Warn 2G users upfront
- Chunked upload for large files (future enhancement)

---

### Risk 2: Customer Forgets to Upload (Send Later)

**Likelihood**: Medium
**Impact**: Medium (delays order)
**Mitigation**:
- Multiple reminder emails (12h, 23h)
- Clear deadline in order confirmation
- Support team trained to assist
- Offer phone call reminder for high-value orders

---

### Risk 3: Preview Rejection Rate High (>30%)

**Likelihood**: Low
**Impact**: Medium (customer service load)
**Mitigation**:
- Free changes policy (within 24h)
- Artist quality check before email send
- Set expectations: "AI preview, human review"
- Track rejection reasons to improve AI

---

### Risk 4: Mobile File Picker Confusion

**Likelihood**: Low
**Impact**: Low (user confusion)
**Mitigation**:
- Clear instructions: "Tap to select 1-3 photos"
- Visual preview before upload
- "Cancel and try again" option always visible
- Help tooltip: "Need help? Tap here"

---

### Risk 5: Backend Processing Delays (>1 hour)

**Likelihood**: Low
**Impact**: Medium (customer anxiety)
**Mitigation**:
- Set expectations: "Preview within 1-2 hours"
- Send immediate order confirmation: "Processing started"
- Monitor processing queue (Cloud Run logs)
- Auto-scale InSPyReNet API if queue backs up

---

## 16. Conclusion

### Summary

This implementation plan provides a complete, mobile-first UX design for **Scenario 3: Express Checkout** using Shopify's native file upload. The solution:

✅ **Removes conversion blocker**: Add-to-cart enabled with pet name only
✅ **Optimizes mobile experience**: 70% of users get bottom sheet, thumb-zone layout
✅ **Supports multi-pet**: 1-3 file upload with clear visual feedback
✅ **Maintains trust**: Email preview before production, free changes
✅ **Accessible**: WCAG 2.1 AA compliant throughout
✅ **Progressive**: Works without JavaScript (basic fallback)
✅ **Complementary**: Doesn't cannibalize AI preview value proposition

### Expected Impact

**Conversion Rate**: +50-120% (1.73% → 4.0%+)
**Time to Purchase**: -50% (15-30s → 10-15s)
**Mobile Experience**: Market-leading (bottom sheet, thumb-zone)
**Revenue**: +$97k/year potential

### Implementation Complexity

**Estimated Effort**: 3-4 weeks (4 phases)
**Risk Level**: Low (non-breaking, reversible)
**Dependencies**: Shopify webhooks, InSPyReNet API, email service
**Rollback**: Feature flag controlled, easy to disable

---

## Appendix A: Copy Recommendations

### Button Labels

- **Quick Upload**: "Quick Upload" (primary)
- **Full Preview**: "Upload & Preview" (clear alternative)
- **Send Later**: "I'll Send My Photo Later" (conversational)
- **Add to Cart** (name only): "Add to Cart"
- **Add to Cart** (with photos): "Add to Cart (2 photos)"

### Helper Text

- **Pet Name Field**: "Separate multiple names with commas"
- **File Upload**: "Select 1-3 photos from camera or gallery"
- **Quick Upload Modal**: "We'll email you a preview before printing"
- **Send Later**: "Upload after checkout via email link (24h deadline)"

### Error Messages

- **File Too Large**: "File too large ({{size}}MB). Maximum 50MB per file."
- **Too Many Files**: "Maximum 3 photos per product. Please select fewer files."
- **No Files**: "Please choose at least 1 photo, or tap 'Send Later' to upload after checkout."
- **Upload Failed**: "Upload failed. Please check your connection and try again."

### Success Messages

- **Files Selected**: "✅ {{count}} photo{{s}} ready to upload (Max 3)"
- **Upload Complete**: "✅ {{count}} photo{{s}} uploaded! We'll email your preview shortly."
- **Cart Added**: "Added to cart with {{count}} photo{{s}}"

---

## Document Status

**Design**: ✅ Complete (UX specification ready)
**Technical**: ✅ Complete (Implementation details included)
**Business**: Ready for product manager review
**Next Step**: Consult solution-verification-auditor for implementation planning

---

**Last Updated**: 2025-10-20
**Author**: ux-design-ecommerce-expert
**Status**: Implementation-Ready
**Review Required**: ai-product-manager-ecommerce, solution-verification-auditor
