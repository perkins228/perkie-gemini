# PetStorage Migration Playwright Test Plan

## Overview
This test plan verifies the completed PetStorage migration from Map-based storage to localStorage-based PetStorage system. The migration has been completed with USE_PETSTORAGE: true enabled and the 3-storage system simplified to single source of truth.

## Context
- **Migration Status**: COMPLETE (Commit: 561b93a)
- **Current Configuration**: USE_PETSTORAGE: true, COMPATIBILITY_MODE: false
- **Architecture**: Pet Processor → PetStorage → Pet Selector (direct)
- **Critical Test**: Multiple pet sequencing (previously failed with Map sync issues)

## Test Environment
- **Staging URL**: TBD (user must provide current staging URL)
- **Images Available**:
  1. `C:\Users\perki\OneDrive\Desktop\Perkie\Production\Sam.jpg` (black lab)
  2. `C:\Users\perki\OneDrive\Desktop\Perkie\Production\testing\IMG_2733.jpeg` (brown dog with harness)

## Critical Test Cases

### 1. Sequential Pet Processing Verification
**Purpose**: Verify that multiple pets can be processed and ALL appear in selector (primary regression issue)

**Steps**:
1. Navigate to pet background remover page
2. Upload first image (Sam.jpg) 
3. Process with background removal
4. Click "Process Another Pet"
5. Verify pet name field clears
6. Upload second image (IMG_2733.jpeg)
7. Process with different effect (e.g., popart)
8. Verify BOTH pets appear in pet selector
9. Test switching between pets in selector

**Expected Results**:
- Pet name field clears after "Process Another Pet"
- Both processed pets visible in selector
- Pet data persists correctly in PetStorage
- No "syncToLegacyStorage" errors in console

### 2. PetStorage Data Persistence
**Purpose**: Verify localStorage-based storage works across page refresh

**Steps**:
1. Process two pets as above
2. Note pet names and effects applied
3. Refresh the page
4. Check if pet selector shows both pets
5. Verify pet data is restored correctly

**Expected Results**:
- Pet selector rebuilds from localStorage
- All pet names, effects, and thumbnails restored
- No data loss on page refresh

### 3. Cart Integration Complete Flow
**Purpose**: Verify all pet data flows to cart and order fulfillment

**Steps**:
1. Process two pets with different effects and fonts
2. Add artist notes for customization
3. Select product variant and add to cart
4. Open cart drawer
5. Verify pet thumbnails display for the product
6. Verify font style shows in cart (if selected)
7. Check cart data contains all line item properties

**Expected Line Item Properties**:
- `_pet_name`: Comma-separated pet names
- `_processed_image_url`: URLs of processed images
- `_original_image_url`: URLs of original uploaded images
- `_effect_applied`: Applied effects (e.g., "enhancedblackwhite,popart")
- `_font_style`: Selected font styles
- `_artist_notes`: Custom instructions
- `_has_custom_pet`: "true"

### 4. "Process Another Pet" Field Clearing
**Purpose**: Verify regression fix for field clearing

**Steps**:
1. Upload and process first pet with name "Sam" and artist notes "Good boy"
2. Click "Process Another Pet"
3. Verify pet name input is cleared
4. Verify artist notes input is cleared
5. Verify upload zone is reset
6. Upload second pet and verify clean processing

### 5. Console Error Monitoring
**Purpose**: Detect any JavaScript errors from migration

**Monitor Throughout Tests**:
- No "syncToLegacyStorage" errors
- No "window.perkieEffects" undefined errors
- No localStorage quota exceeded warnings
- No data persistence failures
- Performance warnings for mobile simulation

## Playwright Test Script

```javascript
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('PetStorage Migration Verification', () => {
  let page;
  const stagingUrl = 'STAGING_URL_TBD'; // User must provide
  const testImages = {
    sam: path.join(__dirname, '..', '..', 'Sam.jpg'),
    brownDog: path.join(__dirname, '..', '..', 'testing', 'IMG_2733.jpeg')
  };

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Monitor console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`❌ Console Error: ${msg.text()}`);
      }
      if (msg.text().includes('syncToLegacyStorage')) {
        console.log(`⚠️ Legacy Storage: ${msg.text()}`);
      }
    });

    await page.goto(`${stagingUrl}/pages/pet-background-remover`);
    await page.waitForLoadState('networkidle');
  });

  test('Sequential Pet Processing - Core Migration Test', async () => {
    console.log('🧪 Testing sequential pet processing...');
    
    // Process first pet
    await page.setInputFiles('input[type="file"]', testImages.sam);
    await page.fill('input[name="pet_name"]', 'Sam');
    await page.fill('textarea[name="artist_notes"]', 'Black lab, good boy');
    
    await page.click('button:has-text("Remove Background")');
    await page.waitForSelector('.result-view img', { timeout: 60000 });
    
    // Verify first pet processed
    const firstResult = await page.locator('.result-view img').first();
    await expect(firstResult).toBeVisible();
    
    // Process another pet
    await page.click('button:has-text("Process Another Pet")');
    
    // Verify fields cleared (regression fix)
    const petNameValue = await page.inputValue('input[name="pet_name"]');
    const artistNotesValue = await page.inputValue('textarea[name="artist_notes"]');
    expect(petNameValue).toBe('');
    expect(artistNotesValue).toBe('');
    
    // Process second pet
    await page.setInputFiles('input[type="file"]', testImages.brownDog);
    await page.fill('input[name="pet_name"]', 'Buddy');
    
    // Select different effect
    await page.click('button[data-effect="popart"]');
    await page.waitForSelector('.result-view img', { timeout: 60000 });
    
    // CRITICAL: Verify both pets appear in selector
    const petSelector = page.locator('.pet-selector');
    await expect(petSelector).toBeVisible();
    
    const petOptions = petSelector.locator('.pet-option');
    const petCount = await petOptions.count();
    expect(petCount).toBe(2);
    
    // Verify pet names
    await expect(petOptions.nth(0)).toContainText('Sam');
    await expect(petOptions.nth(1)).toContainText('Buddy');
    
    console.log('✅ Sequential processing verified - both pets visible');
  });

  test('PetStorage Data Persistence Across Page Refresh', async () => {
    console.log('🧪 Testing data persistence...');
    
    // Process pet
    await page.setInputFiles('input[type="file"]', testImages.sam);
    await page.fill('input[name="pet_name"]', 'Sam');
    await page.click('button:has-text("Remove Background")');
    await page.waitForSelector('.result-view img', { timeout: 60000 });
    
    // Refresh page
    await page.reload({ waitUntil: 'networkidle' });
    
    // Verify pet data restored
    const petSelector = page.locator('.pet-selector');
    await expect(petSelector).toBeVisible();
    
    const petOptions = petSelector.locator('.pet-option');
    await expect(petOptions.first()).toContainText('Sam');
    
    console.log('✅ Data persistence verified');
  });

  test('Complete Cart Integration Flow', async () => {
    console.log('🧪 Testing cart integration...');
    
    // Process two pets with different effects
    await page.setInputFiles('input[type="file"]', testImages.sam);
    await page.fill('input[name="pet_name"]', 'Sam');
    await page.click('button:has-text("Remove Background")');
    await page.waitForSelector('.result-view img', { timeout: 60000 });
    
    await page.click('button:has-text("Process Another Pet")');
    await page.setInputFiles('input[type="file"]', testImages.brownDog);
    await page.fill('input[name="pet_name"]', 'Buddy');
    await page.click('button[data-effect="popart"]');
    await page.waitForSelector('.result-view img', { timeout: 60000 });
    
    // Navigate to product page
    await page.goto(`${stagingUrl}/products/test-product`);
    await page.waitForLoadState('networkidle');
    
    // Verify pet selector shows both pets
    const productPetSelector = page.locator('.pet-selector');
    await expect(productPetSelector).toBeVisible();
    
    const productPetOptions = productPetSelector.locator('.pet-option');
    expect(await productPetOptions.count()).toBe(2);
    
    // Select pets and add to cart
    await productPetOptions.first().click();
    await page.click('button:has-text("Add to Cart")');
    
    // Open cart drawer
    await page.click('.cart-link');
    await page.waitForSelector('.cart-drawer');
    
    // Verify pet thumbnails in cart
    const cartPetThumbnails = page.locator('.cart-item__pets img');
    expect(await cartPetThumbnails.count()).toBeGreaterThan(0);
    
    console.log('✅ Cart integration verified');
  });

  test('Console Error Monitoring', async () => {
    console.log('🧪 Testing for console errors...');
    
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Process pets to trigger all code paths
    await page.setInputFiles('input[type="file"]', testImages.sam);
    await page.fill('input[name="pet_name"]', 'Sam');
    await page.click('button:has-text("Remove Background")');
    await page.waitForSelector('.result-view img', { timeout: 60000 });
    
    await page.click('button:has-text("Process Another Pet")');
    await page.setInputFiles('input[type="file"]', testImages.brownDog);
    await page.fill('input[name="pet_name"]', 'Buddy');
    await page.click('button[data-effect="popart"]');
    await page.waitForSelector('.result-view img', { timeout: 60000 });
    
    // Check for specific migration-related errors
    const syncErrors = errors.filter(e => e.includes('syncToLegacyStorage'));
    const mapErrors = errors.filter(e => e.includes('perkieEffects'));
    
    expect(syncErrors.length).toBe(0);
    expect(mapErrors.length).toBe(0);
    
    if (errors.length > 0) {
      console.log('⚠️ Console errors found:', errors);
    } else {
      console.log('✅ No console errors detected');
    }
  });

  test('Mobile Performance Simulation', async () => {
    console.log('🧪 Testing mobile performance...');
    
    // Simulate mobile device (70% of traffic)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.emulate({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      viewport: { width: 375, height: 667 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    
    const startTime = Date.now();
    
    // Process pet
    await page.setInputFiles('input[type="file"]', testImages.sam);
    await page.fill('input[name="pet_name"]', 'Sam');
    await page.click('button:has-text("Remove Background")');
    await page.waitForSelector('.result-view img', { timeout: 60000 });
    
    const processingTime = Date.now() - startTime;
    console.log(`📱 Mobile processing time: ${processingTime}ms`);
    
    // Verify mobile UI elements are accessible
    await expect(page.locator('input[type="file"]')).toBeVisible();
    await expect(page.locator('.result-view')).toBeVisible();
    await expect(page.locator('.pet-selector')).toBeVisible();
    
    console.log('✅ Mobile simulation completed');
  });
});
```

## Manual Testing Checklist

- [ ] Navigate to staging URL
- [ ] Upload Sam.jpg, process with background removal
- [ ] Click "Process Another Pet" - verify fields clear
- [ ] Upload IMG_2733.jpeg, process with popart effect
- [ ] Verify both pets appear in pet selector
- [ ] Switch between pets in selector
- [ ] Navigate to product page
- [ ] Verify both pets available for selection
- [ ] Add to cart and verify thumbnails
- [ ] Check console for migration errors
- [ ] Test mobile responsiveness
- [ ] Verify data persists across page refresh

## Expected Outcomes

### SUCCESS CRITERIA ✅
1. **Sequential Processing**: Multiple pets process and ALL appear in selector
2. **Field Clearing**: "Process Another Pet" properly clears input fields
3. **Data Persistence**: Pet data survives page refresh via localStorage
4. **Cart Integration**: All line item properties flow to cart correctly
5. **No Console Errors**: No syncToLegacyStorage or Map-related errors
6. **Mobile Performance**: Acceptable performance on mobile simulation

### FAILURE INDICATORS ❌
1. Only last processed pet shows in selector (regression)
2. Pet name/artist notes don't clear after "Process Another Pet"
3. Console errors about syncToLegacyStorage failures
4. Pet data lost on page refresh
5. Cart thumbnails don't display
6. Performance degradation on mobile

## Rollback Plan
If critical issues found:
1. Set `USE_PETSTORAGE: false` in migration config
2. Deploy within 5 minutes to restore Map functionality
3. Investigate specific failure points
4. Fix and re-test before re-enabling

## Context Documentation
After testing, document results in `.claude/tasks/context_session_001.md`:
- Test execution results
- Performance metrics observed
- Any issues encountered
- Migration verification status
- Next steps for production deployment