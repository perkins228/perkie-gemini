# Social Sharing Playwright MCP Testing Plan

## Overview
Comprehensive testing plan for the social sharing implementation on the processing page. The current staging URL (https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/) is expired - **PLEASE REQUEST NEW STAGING URL BEFORE TESTING**.

## Implementation Context
Based on session context 001, the social sharing has been successfully migrated from product page to processing page with:
- Mobile-first design (70% traffic)
- Web Share API for mobile
- Desktop modal fallback
- 1200px social-optimized images
- Elegant "perkie prints" cursive watermark
- 0.75 JPEG quality (good for social, not HD)

## Test Environment Setup
**CRITICAL**: Ask user for current staging URL since 9wy9fqzd0344b2sw-2930573424.shopifypreview.com is expired (HTTP 410)

### Prerequisites
- Valid Shopify staging URL
- Mobile device simulation in Playwright
- Desktop browser testing
- Network throttling capabilities

## Test Scenarios

### 1. Share Button Visibility & Positioning

#### Mobile Tests (Primary - 70% Traffic)
**Test Case 1.1: FAB Button Appearance**
- Navigate to pet background remover page
- Upload a pet image 
- Wait for processing completion
- Select any effect (blackwhite, popart, dithering, 8bit)
- **Expected**: FAB button appears bottom-right (fixed position)
- **Validation**: 
  - Button is 56x56px circular
  - Position: bottom: 20px, right: 20px
  - Z-index: 100
  - Contains share SVG icon (24x24px)
  - No text visible on mobile

**Test Case 1.2: FAB Button Animation**
- Continue from 1.1
- **Expected**: 
  - Button fades in with 0.5s delay after effect selection
  - Pulse animation occurs on first view (2 cycles)
  - `visible` class added to button
  - Transform from translateY(10px) to translateY(0)

#### Desktop Tests (Secondary - 30% Traffic)
**Test Case 1.3: Inline Button Appearance**
- Navigate to processing page on desktop viewport (>768px)
- Complete processing and effect selection
- **Expected**: 
  - Inline button below effects container
  - Text "Share This Look!" with share icon
  - Centered alignment
  - Gradient background (purple/blue)
  - 50px border-radius

### 2. Watermark Application Verification

**Test Case 2.1: Watermark Presence**
- Complete pet processing with any effect
- Trigger share action (don't complete, just capture watermarked image)
- **Expected**:
  - "perkie prints" text in cursive font (Brush Script MT)
  - Position: bottom-right with 20px padding
  - Color: rgba(255, 255, 255, 0.8)
  - Text shadow: rgba(0, 0, 0, 0.3) with 3px blur
  - Font size: 24px italic

**Test Case 2.2: Image Sizing Optimization**
- Test with various image sizes (small <500px, medium ~1000px, large >2000px)
- **Expected**:
  - All images resized to max 1200px (width or height)
  - Aspect ratio preserved
  - High quality smoothing enabled
  - JPEG output at 0.75 quality

### 3. Web Share API Integration (Mobile)

**Test Case 3.1: Native Share Trigger** 
- On mobile device/simulation with Web Share API support
- Complete processing and click FAB button
- **Expected**:
  - Native share sheet opens immediately
  - Image file included: "{petname}-perkie-prints.jpg"
  - Share data includes: title, text, and image file
  - File type: image/jpeg, proper lastModified timestamp

**Test Case 3.2: Web Share API Fallback**
- Test on mobile device without file sharing support
- **Expected**:
  - Share sheet opens with URL only (no image file)
  - Share URL includes tracking parameters:
    - `?ref={petId}`
    - `utm_source=social_share`
    - `utm_medium=pet_image` 
    - `utm_campaign=viral_pet_sharing`

**Test Case 3.3: Share Cancellation Handling**
- Trigger share, then cancel/dismiss native share sheet
- **Expected**:
  - No error shown to user
  - Button remains available for retry
  - Event tracked as 'native_share_cancelled'

### 4. Desktop Modal Fallback

**Test Case 4.1: Modal Opening**
- On desktop browser without Web Share API
- Click share button
- **Expected**:
  - Modal overlay appears with backdrop
  - Modal content centered on screen
  - Pet image preview displayed
  - Four platform buttons: Facebook, Twitter, Pinterest, Copy Link
  - Close button (×) in top-right

**Test Case 4.2: Platform Sharing**
- Test each platform button in modal:

**Facebook**:
- URL: `https://www.facebook.com/sharer/sharer.php?u={encodedUrl}`
- Opens in popup window (600x400px)

**Twitter**: 
- URL: `https://twitter.com/intent/tweet?text={encodedText}&url={encodedUrl}`
- Opens in popup window

**Pinterest**:
- URL: `https://pinterest.com/pin/create/button/?url={encodedUrl}&description={encodedText}`
- Opens in popup window

**Copy Link**:
- Copies URL to clipboard
- Shows success toast: "Link copied!"

**Test Case 4.3: Modal Closing**
- Test all methods to close modal:
  - Click close button (×)
  - Click backdrop 
  - Select any platform (auto-closes)
- **Expected**: Modal removes from DOM completely

### 5. Content Generation & Tracking

**Test Case 5.1: Share Content Validation**
- Trigger share action and capture generated content
- **Expected Share Content**:
  - Title: "{PetName}'s Custom AI Background Removal"
  - Random message from array (4 options)
  - URL with tracking parameters
  - Proper URL encoding
  - XSS prevention (text sanitization)

**Test Case 5.2: Analytics Event Tracking**
Test all tracked events fire correctly:
- `share_initiated` - when share button clicked
- `share_completed` - when share successfully executed  
- `share_failed` - when error occurs
- `share_platform` - when specific platform used
- Each event includes: pet ID, name, product URL, platform, effect

### 6. Error Handling & Edge Cases

**Test Case 6.1: Network Failure During Watermarking**
- Simulate network failure during image processing
- Trigger share
- **Expected**: 
  - Fallback to original image without watermark
  - Share still completes successfully
  - No user-facing errors

**Test Case 6.2: CORS Issues with External Images**
- Test with external image URLs (if any)
- **Expected**:
  - Warning logged: "External image detected, watermarking may be limited"
  - Graceful degradation
  - Share still functions

**Test Case 6.3: Missing Pet Data**
- Clear localStorage or corrupt pet data
- Attempt to share
- **Expected**:
  - Error logged: "No processed pet image available"
  - User not shown broken share functionality
  - Button hidden or disabled

**Test Case 6.4: Clipboard API Unavailable**
- Disable clipboard API in browser
- Test copy link functionality
- **Expected**:
  - Fallback to alert() with share URL
  - Message: "Share this link: {url}"

### 7. Performance & Resource Management

**Test Case 7.1: Memory Cleanup**
- Complete multiple share actions
- **Expected**:
  - Canvas elements cleaned up after each use
  - No memory leaks in watermark generation
  - Observer disconnected on cleanup

**Test Case 7.2: Canvas Memory Management**
- Share large images multiple times
- **Expected**:
  - Canvas width/height reset to 0 after each use
  - Context set to null
  - Proper garbage collection

### 8. Integration Points

**Test Case 8.1: Pet Processor Integration**
- Verify proper integration with pet-processor.js
- **Expected**:
  - Share instance receives petProcessor reference
  - `switchEffect` method properly overridden
  - Current effect tracked correctly
  - Processing completion triggers share button visibility

**Test Case 8.2: Storage Integration**
- Verify integration with localStorage pet data
- **Expected**:
  - Processed images accessed from localStorage
  - Effect data properly retrieved
  - Session key used for tracking

## Critical Test Failures to Watch For

### High Priority Issues
1. **Share Button Not Appearing**: Check `switchEffect` override and DOM insertion timing
2. **Watermark Missing**: Validate canvas operations and CORS handling
3. **Web Share API Failing**: Verify file creation and canShare detection
4. **Modal Not Opening**: Check Web Share API detection logic
5. **Tracking Not Working**: Verify gtag and Shopify analytics integration

### Medium Priority Issues
1. **Image Quality Poor**: Check canvas sizing and JPEG quality settings
2. **Button Positioning Wrong**: Validate CSS media queries
3. **Share Content Malformed**: Check URL encoding and text sanitization
4. **Performance Lag**: Monitor canvas operations and memory cleanup

### Low Priority Issues
1. **Animation Timing**: Pulse animation or fade-in delays
2. **Style Inconsistencies**: Button appearance across devices
3. **Toast Notification**: Success message display timing

## Testing Strategy

### Phase 1: Core Functionality (Priority 1)
1. Share button visibility after processing
2. Basic watermark application
3. Web Share API or modal fallback
4. Content generation

### Phase 2: Platform Integration (Priority 2) 
1. Individual platform sharing
2. Analytics tracking
3. URL parameter generation
4. Clipboard operations

### Phase 3: Edge Cases & Polish (Priority 3)
1. Error scenarios
2. Performance validation  
3. Accessibility testing
4. Animation/UX refinements

## Expected Results Summary

### Mobile Experience (70% of traffic)
- FAB button appears 0.5s after effect selection
- Native share sheet with image file
- Single-tap sharing to any platform
- Elegant watermarked image at 1200px max

### Desktop Experience (30% of traffic)
- Inline share button with clear CTA text
- Platform-specific modal with preview
- Direct platform integration
- Copy link fallback option

### Image Quality
- Social-optimized 1200px resolution
- Professional watermark placement
- 0.75 JPEG quality balance
- Proper aspect ratio preservation

## Notes for Testing Implementation

1. **MUST REQUEST NEW STAGING URL** - Current URL expired
2. **Test on actual mobile devices** - Web Share API behavior varies
3. **Use network throttling** - Simulate real-world conditions
4. **Test with different image types** - JPG, PNG, various sizes
5. **Validate across browsers** - Safari, Chrome, Firefox mobile/desktop
6. **Check console for errors** - Monitor all error logging
7. **Verify analytics** - Use browser dev tools to confirm tracking

The implementation appears solid based on the code review - the testing should focus on integration points and real-world usage scenarios rather than fundamental functionality issues.