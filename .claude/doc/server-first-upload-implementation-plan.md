# Server-First Upload with Automatic Fallback Implementation Plan

**Date**: 2025-11-06
**Author**: Project Manager - E-commerce
**Priority**: CRITICAL
**Estimated Time**: 6 hours
**Risk Level**: LOW (with proper fallback)

## Business Objective

Eliminate localStorage quota exceeded errors affecting 70% of mobile customers attempting multi-pet orders (2-3 pets) by uploading images directly to server instead of storing 3.4MB base64 strings locally.

## Technical Requirements

1. **Upload images to server immediately on selection**
   - Acceptance: GCS URL stored in localStorage (100 bytes vs 3.4MB)
   - Priority: P0 - Critical

2. **Automatic fallback to localStorage base64 when server fails**
   - Acceptance: 99%+ success rate including fallback
   - Priority: P0 - Critical

3. **Non-blocking optimistic UI with progress indicators**
   - Acceptance: Instant file preview, background upload progress
   - Priority: P1 - High

4. **Backward compatibility with existing processor**
   - Acceptance: Processor accepts both GCS URLs and base64
   - Priority: P0 - Critical

5. **Mobile-optimized touch targets and error handling**
   - Acceptance: 44px minimum touch targets, clear error states
   - Priority: P1 - High

## Implementation Plan

### Phase 1: Infrastructure Verification (30 minutes)

**Task 1.1: Verify CORS Configuration**
- File: N/A (runtime verification)
- Location: Browser console on product page
- Test: `fetch('https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health')`
- Success: No CORS errors
- Agent: infrastructure-reliability-engineer
- Dependencies: None

**Task 1.2: Test /store-image Endpoint from Product Page**
- File: Browser DevTools console
- Test upload with FormData:
  ```javascript
  const formData = new FormData();
  formData.append('file', new Blob(['test'], {type: 'image/jpeg'}), 'test.jpg');
  formData.append('image_type', 'original');
  formData.append('tier', 'temporary');
  fetch('https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/store-image', {
    method: 'POST',
    body: formData
  }).then(r => r.json()).then(console.log);
  ```
- Success: Returns `{success: true, url: "gs://..."}`
- Agent: infrastructure-reliability-engineer
- Dependencies: Task 1.1

### Phase 2: Upload Handler Implementation (1.5 hours)

**Task 2.1: Add Server Upload Function**
- File: `snippets/ks-product-pet-selector-stitch.liquid`
- Location: Line ~1500 (before file input event handler)
- Changes:
  ```javascript
  // Add new function for server upload with retry
  async function uploadToServer(file, petIndex, retryCount = 0) {
    const maxRetries = 3;
    const retryDelays = [0, 1000, 3000]; // exponential backoff

    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('image_type', 'original');
      formData.append('tier', 'temporary');
      formData.append('pet_index', petIndex.toString());

      const response = await fetch(
        'https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/store-image',
        {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(30000) // 30s timeout
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.url) {
        return { success: true, url: result.url };
      } else {
        throw new Error('No URL in response');
      }

    } catch (error) {
      console.warn(`Upload attempt ${retryCount + 1} failed:`, error);

      if (retryCount < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelays[retryCount + 1]));
        return uploadToServer(file, petIndex, retryCount + 1);
      }

      return { success: false, error: error.message };
    }
  }
  ```
- Agent: code implementation
- Dependencies: Phase 1 complete

**Task 2.2: Modify File Input Change Handler**
- File: `snippets/ks-product-pet-selector-stitch.liquid`
- Location: Lines 1553-1620 (replace existing handler content)
- Changes:
  ```javascript
  fileInput.addEventListener('change', async (e) => {
    const newFiles = Array.from(e.target.files);

    // Validation (keep existing)
    if (newFiles.length === 0) return;
    const newFile = newFiles[0];

    if (newFile.size > 50 * 1024 * 1024) {
      alert(`${newFile.name} is too large. Max 50MB per file.`);
      fileInput.value = '';
      return;
    }

    if (!newFile.type.startsWith('image/')) {
      alert(`${newFile.name} is not an image file.`);
      fileInput.value = '';
      return;
    }

    // Store file reference
    petFiles[i] = [newFile];
    fileInput.value = '';

    // Optimistic UI update
    uploadText.textContent = 'Uploading...';
    uploadZone.classList.add('has-files', 'uploading');
    displayUploadedFiles(i, petFiles[i]);

    // Show preview immediately (optimistic)
    const reader = new FileReader();
    reader.onload = (event) => {
      // Store preview for modal
      const previewData = [{
        name: newFile.name,
        data: event.target.result,
        size: newFile.size,
        type: newFile.type
      }];
      sessionStorage.setItem(`pet_${i}_preview`, JSON.stringify(previewData));
    };
    reader.readAsDataURL(newFile);

    // PRIMARY: Try server upload
    showUploadProgress(i, 'Uploading to server...');
    const uploadResult = await uploadToServer(newFile, i);

    if (uploadResult.success) {
      // SUCCESS: Store GCS URL (100 bytes!)
      localStorage.setItem(`pet_${i}_image_url`, uploadResult.url);
      localStorage.setItem(`pet_${i}_image_name`, newFile.name);
      localStorage.setItem(`pet_${i}_image_type`, newFile.type);
      localStorage.setItem(`pet_${i}_image_size`, newFile.size.toString());

      // Clear fallback if exists
      localStorage.removeItem(`pet_${i}_images`);

      uploadText.textContent = 'CHANGE IMAGE?';
      uploadZone.classList.remove('uploading');
      uploadZone.classList.add('upload-success');
      hideUploadProgress(i);

      console.log(`✅ Pet ${i} uploaded to server: ${uploadResult.url}`);

    } else {
      // FALLBACK: Use localStorage base64
      console.warn(`Server upload failed for Pet ${i}, using offline mode`);

      showUploadProgress(i, 'Saving locally (offline mode)...');

      const reader2 = new FileReader();
      reader2.onload = (event) => {
        const previewData = [{
          name: newFile.name,
          data: event.target.result,
          size: newFile.size,
          type: newFile.type
        }];
        localStorage.setItem(`pet_${i}_images`, JSON.stringify(previewData));

        // Clear server URL if exists
        localStorage.removeItem(`pet_${i}_image_url`);

        uploadText.textContent = 'CHANGE IMAGE? (Offline)';
        uploadZone.classList.remove('uploading');
        uploadZone.classList.add('offline-mode');
        hideUploadProgress(i);

        showOfflineWarning(i);
      };
      reader2.readAsDataURL(newFile);
    }

    // Update order properties
    updateFileInputWithAllFiles(i, petFiles[i]);
    populateOrderProperties(i, petFiles[i]);
    savePetSelectorStateImmediate();
  });
  ```
- Agent: code implementation
- Dependencies: Task 2.1

### Phase 3: Optimistic UI Implementation (1 hour)

**Task 3.1: Add Progress UI Functions**
- File: `snippets/ks-product-pet-selector-stitch.liquid`
- Location: Line ~1400 (before main setup)
- Changes:
  ```javascript
  // Upload progress UI helpers
  function showUploadProgress(petIndex, message = 'Uploading...') {
    const container = document.querySelector('.pet-upload-progress');
    if (!container) {
      const div = document.createElement('div');
      div.className = 'pet-upload-progress';
      div.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 24px;
        z-index: 9999;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
      `;
      div.innerHTML = `
        <svg class="spinner" width="20" height="20" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" stroke="white" stroke-width="3"></circle>
        </svg>
        <span class="message">${message}</span>
      `;
      document.body.appendChild(div);
    } else {
      container.querySelector('.message').textContent = message;
      container.style.display = 'flex';
    }
  }

  function hideUploadProgress(petIndex) {
    const container = document.querySelector('.pet-upload-progress');
    if (container) {
      container.style.display = 'none';
    }
  }

  function showOfflineWarning(petIndex) {
    const uploadZone = document.querySelector(`[data-upload-zone="${petIndex}"]`);
    const warning = document.createElement('div');
    warning.className = 'offline-warning';
    warning.style.cssText = `
      background: #fff3cd;
      color: #856404;
      padding: 8px 12px;
      border-radius: 4px;
      margin-top: 8px;
      font-size: 12px;
    `;
    warning.textContent = 'Upload failed - saved locally. Some features may be limited.';

    // Remove existing warning if any
    const existing = uploadZone.parentElement.querySelector('.offline-warning');
    if (existing) existing.remove();

    uploadZone.parentElement.appendChild(warning);

    // Auto-hide after 5 seconds
    setTimeout(() => warning.remove(), 5000);
  }
  ```
- Add CSS for spinner animation in `<style>` section:
  ```css
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .pet-upload-progress .spinner {
    animation: spin 1s linear infinite;
  }
  .pet-upload-progress .spinner circle {
    stroke-dasharray: 125;
    stroke-dashoffset: 100;
    animation: dash 1.5s ease-in-out infinite;
  }
  @keyframes dash {
    0% { stroke-dashoffset: 125; }
    50% { stroke-dashoffset: 60; }
    100% { stroke-dashoffset: 125; }
  }
  ```
- Agent: mobile-commerce-architect
- Dependencies: Phase 2 complete

**Task 3.2: Update Touch Targets**
- File: `snippets/ks-product-pet-selector-stitch.liquid`
- Location: CSS section (~line 100-200)
- Changes:
  ```css
  /* Ensure 44px minimum touch targets on mobile */
  @media (max-width: 768px) {
    .pet-detail__upload-status__file-delete {
      min-width: 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      padding: 0;
    }

    .pet-detail__upload-zone {
      min-height: 120px; /* Larger touch target */
      padding: 20px;
    }
  }
  ```
- Agent: mobile-commerce-architect
- Dependencies: None

### Phase 4: Processor Page Integration (30 minutes)

**Task 4.1: Modify checkPetSelectorUploads Function**
- File: `assets/pet-processor.js`
- Location: Lines 701-769 (modify existing function)
- Changes:
  ```javascript
  checkPetSelectorUploads() {
    try {
      const activeIndex = parseInt(sessionStorage.getItem('pet_selector_active_index') || '0');

      // Check active index first
      const activeKey = `pet_${activeIndex}_images`;
      const activeUrl = localStorage.getItem(`pet_${activeIndex}_image_url`);

      // PRIMARY: Check for GCS URL (server upload)
      if (activeUrl) {
        const name = localStorage.getItem(`pet_${activeIndex}_image_name`) || 'pet.jpg';
        const type = localStorage.getItem(`pet_${activeIndex}_image_type`) || 'image/jpeg';
        const size = parseInt(localStorage.getItem(`pet_${activeIndex}_image_size`) || '0');

        console.log(`✅ Found server-uploaded image: ${activeUrl}`);
        sessionStorage.removeItem('pet_selector_active_index');

        return {
          petIndex: activeIndex,
          key: `pet_${activeIndex}_image_url`,
          name: name,
          url: activeUrl,  // GCS URL instead of base64
          size: size,
          type: type,
          isServerUpload: true
        };
      }

      // FALLBACK: Check for base64 localStorage (offline mode)
      const activeStored = localStorage.getItem(activeKey);
      if (activeStored) {
        const images = JSON.parse(activeStored);
        if (Array.isArray(images) && images.length > 0) {
          const img = images[0];
          if (img.data && img.data.startsWith('data:image/')) {
            console.log(`✅ Found offline image: ${activeKey}`);
            sessionStorage.removeItem('pet_selector_active_index');
            return {
              petIndex: activeIndex,
              key: activeKey,
              ...img,
              isServerUpload: false
            };
          }
        }
      }

      // Check all pets (0, 1, 2) with same priority logic
      for (let i = 0; i < 3; i++) {
        // Check server URL first
        const url = localStorage.getItem(`pet_${i}_image_url`);
        if (url) {
          const name = localStorage.getItem(`pet_${i}_image_name`) || 'pet.jpg';
          const type = localStorage.getItem(`pet_${i}_image_type`) || 'image/jpeg';
          const size = parseInt(localStorage.getItem(`pet_${i}_image_size`) || '0');

          console.log(`✅ Found server-uploaded image (fallback): pet_${i}`);
          return {
            petIndex: i,
            key: `pet_${i}_image_url`,
            name: name,
            url: url,
            size: size,
            type: type,
            isServerUpload: true
          };
        }

        // Then check base64
        const key = `pet_${i}_images`;
        const stored = localStorage.getItem(key);
        if (stored) {
          const images = JSON.parse(stored);
          if (Array.isArray(images) && images.length > 0) {
            const img = images[0];
            if (img.data && img.data.startsWith('data:image/')) {
              console.log(`✅ Found offline image (fallback): ${key}`);
              return {
                petIndex: i,
                key: key,
                ...img,
                isServerUpload: false
              };
            }
          }
        }
      }

      console.log('🔍 No pet selector uploads found');
      return null;
    } catch (error) {
      console.error('❌ Error checking pet selector uploads:', error);
      return null;
    }
  }
  ```
- Agent: code implementation
- Dependencies: None

**Task 4.2: Modify loadPetSelectorImage Function**
- File: `assets/pet-processor.js`
- Location: Lines 776-820 (modify to handle GCS URLs)
- Changes:
  ```javascript
  async loadPetSelectorImage(imageData) {
    try {
      console.log('🚀 Auto-loading image from pet selector...');

      // NEW: Handle server-uploaded images (GCS URL)
      if (imageData.isServerUpload && imageData.url) {
        console.log('📥 Loading from server URL:', imageData.url);

        try {
          // Load image from GCS URL
          const response = await fetch(imageData.url);
          if (!response.ok) {
            throw new Error(`Failed to load image: ${response.status}`);
          }

          const blob = await response.blob();
          const file = new File([blob], imageData.name || 'pet.jpg', {
            type: imageData.type || 'image/jpeg'
          });

          console.log('📸 Processing server image:', {
            name: file.name,
            size: file.size,
            type: file.type
          });

          // Clear the server URL after loading
          localStorage.removeItem(`pet_${imageData.petIndex}_image_url`);
          localStorage.removeItem(`pet_${imageData.petIndex}_image_name`);
          localStorage.removeItem(`pet_${imageData.petIndex}_image_type`);
          localStorage.removeItem(`pet_${imageData.petIndex}_image_size`);

          // Process the file
          await this.processFile(file);

        } catch (error) {
          console.error('❌ Failed to load from server, trying fallback:', error);

          // Try to load from base64 if available
          const fallbackKey = `pet_${imageData.petIndex}_images`;
          const fallbackData = localStorage.getItem(fallbackKey);
          if (fallbackData) {
            const images = JSON.parse(fallbackData);
            if (images && images[0] && images[0].data) {
              imageData.data = images[0].data;
              imageData.isServerUpload = false;
              // Continue with base64 processing below
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }

      // EXISTING: Handle base64 images (offline mode or fallback)
      if (!imageData.isServerUpload && imageData.data) {
        const sanitized = validateAndSanitizeImageData(imageData.data);
        if (!sanitized) {
          console.error('❌ Invalid image data from pet selector');
          this.clearPetSelectorUploads();
          this.showError('Invalid image data. Please try uploading again.');
          return;
        }

        const response = await fetch(sanitized);
        const blob = await response.blob();

        const fileName = imageData.name || 'pet.jpg';
        const file = new File([blob], fileName, {
          type: imageData.type || 'image/jpeg'
        });

        console.log('📸 Processing offline image:', {
          name: file.name,
          size: file.size,
          type: file.type
        });

        // Clear the localStorage after loading
        if (imageData.key) {
          localStorage.removeItem(imageData.key);
        }

        // Process the file
        await this.processFile(file);
      }

    } catch (error) {
      console.error('❌ Failed to load pet selector image:', error);
      this.clearPetSelectorUploads();
      this.showError('Failed to load image. Please try uploading again.');
    }
  }
  ```
- Agent: code implementation
- Dependencies: Task 4.1

### Phase 5: Testing (2 hours)

**Task 5.1: Test Fast Network (4G/WiFi)**
- Environment: Chrome DevTools with "Fast 3G" throttling
- Test cases:
  1. Upload single pet → Verify GCS URL stored
  2. Upload 3 pets → Verify no quota errors
  3. Navigate to processor → Verify auto-load from GCS
  4. Check console for success messages
- Agent: mobile-commerce-architect
- Dependencies: Phase 1-4 complete

**Task 5.2: Test Slow Network (3G)**
- Environment: Chrome DevTools with "Slow 3G" throttling
- Test cases:
  1. Upload with progress indicator visible
  2. Verify retry logic on timeout
  3. Test 30s timeout handling
  4. Verify user can still interact during upload
- Agent: mobile-commerce-architect
- Dependencies: Phase 1-4 complete

**Task 5.3: Test Offline Mode**
- Environment: Chrome DevTools with "Offline" network
- Test cases:
  1. Upload fails → Verify fallback to localStorage
  2. Verify offline warning shown
  3. Navigate to processor → Verify loads from base64
  4. Re-enable network → Test recovery
- Agent: infrastructure-reliability-engineer
- Dependencies: Phase 1-4 complete

**Task 5.4: Test Multi-Pet Orders**
- Environment: Real mobile device (iPhone/Android)
- Test cases:
  1. Upload 3 pets sequentially
  2. Verify localStorage usage < 1KB (URLs only)
  3. Complete checkout flow
  4. Verify all pets in order
- Agent: mobile-commerce-architect
- Dependencies: All tests pass

### Phase 6: Code Review & Deployment (30 minutes)

**Task 6.1: Code Quality Review**
- Review all code changes
- Verify error handling
- Check for memory leaks
- Validate accessibility
- Agent: code-quality-reviewer
- Dependencies: All phases complete

**Task 6.2: Commit and Deploy**
- Commit message: "FEATURE: Server-first image upload with automatic fallback to eliminate localStorage quota errors"
- Push to main branch (auto-deploys)
- Monitor error logs
- Agent: infrastructure-reliability-engineer
- Dependencies: Task 6.1

## Technical Considerations

1. **CORS Configuration**: Must be verified before implementation
2. **Cold Start Handling**: First upload may take 30-60s (GPU initialization)
3. **Retry Logic**: 3 attempts with exponential backoff (0s, 1s, 3s)
4. **Timeout**: 30s per upload attempt (90s total with retries)
5. **Fallback**: Automatic switch to localStorage on failure
6. **Cleanup**: GCS URLs removed after processing to prevent accumulation

## Critical Assumptions

1. `/store-image` endpoint accepts uploads from product page domain
2. CORS is properly configured or can be configured
3. No rate limiting on the API endpoint
4. GCS URLs remain accessible for 7 days (tier: temporary)
5. Processor page can fetch from GCS URLs (CORS on bucket)

## Risk Mitigation

1. **Network Failure**: Automatic fallback to localStorage
2. **CORS Issues**: Test in Phase 1, abort if not resolvable
3. **Cold Start**: Show progress indicator, user expects upload time
4. **Quota Still Exceeded**: Only if ALL uploads fail (very unlikely)
5. **Browser Compatibility**: FileReader API supported on all target browsers

## Success Metrics

1. **localStorage quota errors**: 0% (down from current failure rate)
2. **Multi-pet order success**: 100% (3+ pets without errors)
3. **Upload success rate**: >95% (including fallback)
4. **User-perceived performance**: <10s total (currently 13.4s)
5. **Backward compatibility**: 100% (no breaking changes)

## Rollback Plan

If critical issues arise:
1. Revert git commit
2. Push to main (auto-deploys previous version)
3. Clear CDN cache if needed
4. Monitor for immediate recovery

## Next Steps After Implementation

1. Monitor error logs for 24 hours
2. Track conversion rate changes
3. Gather user feedback on mobile experience
4. Consider pre-warming API on page load
5. Evaluate IndexedDB for future enhancement

## Files to Modify

1. **`snippets/ks-product-pet-selector-stitch.liquid`** (lines 1500-1700)
   - Add server upload function
   - Modify file input handler
   - Add progress UI functions
   - Update CSS for mobile

2. **`assets/pet-processor.js`** (lines 700-820)
   - Modify checkPetSelectorUploads
   - Update loadPetSelectorImage
   - Handle GCS URLs

## No New Files Required

This implementation modifies existing files only. No new infrastructure or files needed.

## Dependencies

- Existing `/store-image` endpoint (already in production)
- Existing GCS bucket (perkieprints-processing-cache)
- Existing Cloud Run service (inspirenet-bg-removal-api)

## Implementation Time Breakdown

- Phase 1: 30 minutes (infrastructure verification)
- Phase 2: 1.5 hours (upload handler)
- Phase 3: 1 hour (optimistic UI)
- Phase 4: 30 minutes (processor integration)
- Phase 5: 2 hours (comprehensive testing)
- Phase 6: 30 minutes (review & deploy)

**Total: 6 hours** (vs 19 hours for IndexedDB approach)

## Agent Coordination Summary

**infrastructure-reliability-engineer**:
- Verify CORS (Task 1.1, 1.2)
- Test offline fallback (Task 5.3)
- Deploy and monitor (Task 6.2)

**mobile-commerce-architect**:
- Implement progress UI (Task 3.1, 3.2)
- Test mobile scenarios (Task 5.1, 5.2, 5.4)

**code-quality-reviewer**:
- Final code review (Task 6.1)

**Primary implementer** (YOU):
- Core upload logic (Task 2.1, 2.2)
- Processor integration (Task 4.1, 4.2)

## User Documentation

After implementation, users will experience:
1. **Instant image preview** when selecting files
2. **Background upload** with progress indicator (non-blocking)
3. **Automatic retry** on network issues
4. **Offline mode** when network unavailable
5. **No quota errors** even with 3+ pets
6. **Faster checkout** due to pre-uploaded images