# Pet Storage Debug Implementation Plan

## Session Context: 2025-08-27
**Issues to Debug:**
1. Transparent backgrounds showing as black in thumbnails 
2. Pet names not displaying correctly (showing "Pet" instead of user input)

## Root Cause Analysis

### Issue 1: Transparent Backgrounds → Black Thumbnails

**Root Cause:** Canvas context defaults to transparent black when no background is set before drawing JPEG

**Evidence from `assets/pet-storage.js` lines 20-34:**
- Canvas is created without explicit background fill
- PNG with transparency is drawn directly onto transparent canvas
- `canvas.toDataURL('image/jpeg', quality)` converts transparency to BLACK in JPEG format
- JPEG format doesn't support transparency, defaults to black fill

**Technical Details:**
- Line 31: `ctx.drawImage(img, 0, 0, canvas.width, canvas.height);` draws on transparent canvas
- Line 34: `canvas.toDataURL('image/jpeg', quality)` - JPEG conversion makes transparent → black

### Issue 2: Pet Names Show "Pet" Instead of User Input

**Root Cause:** Pet name fallback logic triggers incorrectly during save/load flow

**Evidence Trail:**
1. **Save Path (pet-processor.js line 822):**
   ```javascript
   const petName = this.container.querySelector('.pet-name-input')?.value || 'Pet';
   ```
   ✅ Correctly reads user input

2. **Storage Path (pet-storage.js line 60):**
   ```javascript
   name: data.name || 'Pet',
   ```
   ⚠️ Fallback triggers if data.name is empty/undefined

3. **Display Path (ks-product-pet-selector.liquid line 1702-1735):**
   ```javascript
   const escapedName = (pet.name || '').replace(/[<>"']/g, ...);
   <p class="ks-pet-selector__pet-name">${escapedName}</p>
   ```
   ✅ Correctly displays stored name

**Hypothesis:** The pet name is being lost between pet processor save and PetStorage.save() call

## Implementation Plan

### Fix 1: White Background for Transparent Images
**File:** `assets/pet-storage.js`
**Method:** `compressThumbnail()`
**Lines:** 20-46

**Changes Required:**
1. Add white background fill before drawing image
2. Add after line 26 (after canvas sizing):
   ```javascript
   // Fill with white background for JPEG compression
   ctx.fillStyle = '#ffffff';
   ctx.fillRect(0, 0, canvas.width, canvas.height);
   ```

**Expected Result:** Transparent areas will show as white instead of black

### Fix 2: Pet Name Persistence Debug
**File:** `assets/pet-processor.js`
**Method:** `saveToPetStorage()`
**Lines:** Around 822-950

**Debug Steps Required:**
1. Add console.log to verify pet name is captured from input
2. Add console.log before PetStorage.save() to verify name is passed
3. Check if sanitizeName() is affecting the name
4. Verify the name reaches the pet selector correctly

**Potential Fixes:**
- Ensure pet name is passed correctly in the data object
- Check if sanitizeName() is too aggressive 
- Verify the load path preserves the original name

### Fix 3: Verify Single Thumbnail Storage
**Confirmation needed:** Ensure only the selected effect thumbnail is saved, not all effects

**File:** `assets/pet-storage.js`  
**Method:** `save()`
**Lines:** 52-95

**Current Implementation:** ✅ CORRECT
- Line 55-56: Only compresses `data.thumbnail` (single image)
- Line 62: Stores only `compressedThumbnail`
- No loops or multiple effect storage

## Testing Strategy

### Test Case 1: White Background Fix
1. Upload pet image with transparent background (PNG with removed background)
2. Save pet to storage
3. Navigate to product page
4. Verify thumbnail shows WHITE background, not black
5. Check console for compression logs showing correct dimensions

### Test Case 2: Pet Name Display
1. Upload pet image 
2. Enter custom name in "Pet Name" input field
3. Save pet to storage
4. Navigate to product page
5. Verify pet selector displays the CUSTOM name, not "Pet"
6. Check browser localStorage for stored pet data

### Test Case 3: Single Effect Storage
1. Process pet with multiple effects (B&W, Pop Art, etc.)
2. Select one effect and save
3. Check localStorage size (should be ~3-4KB for single compressed thumbnail)
4. Verify only selected effect is stored, not all 4 effects

## Implementation Files

### Primary Files to Modify:
1. `assets/pet-storage.js` - Fix compressThumbnail() white background
2. `assets/pet-processor.js` - Debug pet name passing (logging only)

### Secondary Files (Debug Only):
1. `snippets/ks-product-pet-selector.liquid` - Verify name display (no changes needed)

## Risk Assessment

### Risk Level: LOW
- **Thumbnail fix**: Simple canvas fill operation, no architectural changes
- **Pet name debug**: Logging only, no functional changes initially  
- **Storage verification**: Code review only, no changes needed

### Rollback Plan:
- **Thumbnail fix**: Remove 2 lines of white background fill
- **Debug logging**: Remove console.log statements
- **Zero impact** on existing functionality

## Success Criteria

### Issue 1 Success:
- ✅ Transparent pet images show WHITE thumbnails in pet selector
- ✅ No black backgrounds visible in compressed thumbnails
- ✅ JPEG compression maintains image quality

### Issue 2 Success:  
- ✅ User-entered pet names display correctly in pet selector
- ✅ No fallback to "Pet" when custom names are provided
- ✅ Names persist across page navigation

### Issue 3 Verification:
- ✅ Only selected effect thumbnail stored (~3KB per pet)
- ✅ No storage of multiple effect versions
- ✅ Storage quota usage remains low

## Timeline Estimate
- **Analysis**: COMPLETE
- **Implementation**: 15-20 minutes
  - White background fix: 5 minutes
  - Pet name debugging: 10-15 minutes  
- **Testing**: 10-15 minutes
- **Total**: 30-35 minutes

## Key Assumptions
1. This is a NEW BUILD with no legacy customer data
2. Testing will use staging environment
3. GitHub auto-deployment is working properly
4. PetStorage system consolidation completed successfully

## Next Steps
1. Implement white background fix in compressThumbnail()
2. Add debug logging to pet name save flow
3. Test both fixes with sample pet images
4. Verify storage efficiency (single thumbnail per pet)
5. Update context session with results