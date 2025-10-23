# Testing Strategy & Priority

## Testing Priority Order

### 1. **PRIMARY: Shopify Staging URL with Playwright MCP**
**Always test here first when possible**

- **Pet Processor URL**: `https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/pages/custom-image-processing`
- **Pet Selector URL**: `https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/products/custom-pet-t-shirt?_pos=1&_psq=custom&_ss=e&_v=1.0`
- **Tool**: Use Playwright MCP (`mcp__playwright__browser_*` tools)
- **Why**: This is the actual environment where customers will interact with the code

#### How to Test on Staging:
```javascript
// Navigate to staging
mcp__playwright__browser_navigate(url: "https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/products/custom-pet-t-shirt?_pos=1&_psq=custom&_ss=e&_v=1.0")

// Take snapshot
mcp__playwright__browser_snapshot()

// Interact with elements
mcp__playwright__browser_click(element: "Upload button", ref: "e123")

// Upload test files
mcp__playwright__browser_file_upload(paths: ["path/to/test-image.jpg"])
```

#### When Staging URL Expires:
- **ASK THE USER**: "The Shopify staging URL appears to be expired. Could you provide a new preview URL?"
- Do NOT proceed with local HTML testing without attempting staging first

### 2. **SECONDARY: Local HTML Test Files**
**Only use when:**
- Staging URL is expired AND user cannot provide new one
- Testing isolated functionality that doesn't require Shopify integration
- Debugging specific JavaScript errors
- Initial rapid prototyping

**Test files available:**
- `testing/simple-test.html` - Basic pet processor functionality
- `testing/pet-processor-v5-test.html` - Full v5 implementation
- `testing/mobile-tests/*.html` - Mobile-specific features

### 3. **TERTIARY: Unit Testing**
**For API and backend testing only**
- Python tests in `backend/inspirenet-api/tests/`
- Direct API endpoint testing with curl/fetch

## Testing Checklist for Changes

When implementing any change:

1. ✅ **Check staging URL validity**
   ```javascript
   mcp__playwright__browser_navigate(url: "[staging-url]")
   // If it fails or redirects to login, ask user for new URL
   ```

2. ✅ **Test on staging first**
   - Upload pet photo
   - Process with all effects
   - Switch between effects
   - Add to cart
   - Verify cart integration

3. ✅ **Test mobile experience**
   ```javascript
   mcp__playwright__browser_resize(width: 375, height: 667) // iPhone SE
   mcp__playwright__browser_resize(width: 390, height: 844) // iPhone 14
   ```

4. ✅ **Check console for errors**
   ```javascript
   mcp__playwright__browser_console_messages()
   ```

5. ✅ **Verify network requests**
   ```javascript
   mcp__playwright__browser_network_requests()
   ```

## Common Test Scenarios

### Pet Processor Upload Flow
```javascript
// 1. Navigate to staging
mcp__playwright__browser_navigate(url: "[staging-url]")

// 2. Click upload area
mcp__playwright__browser_click(element: "Pet upload area", ref: "[ref]")

// 3. Upload test image
mcp__playwright__browser_file_upload(paths: ["testing/test-assets/sample-pet.jpg"])

// 4. Wait for processing
mcp__playwright__browser_wait_for(text: "B&W", time: 30)

// 5. Switch effects
mcp__playwright__browser_click(element: "Pop Art effect", ref: "[ref]")

// 6. Add pet name
mcp__playwright__browser_type(element: "Pet name", ref: "[ref]", text: "Fluffy")

// 7. Add to cart
mcp__playwright__browser_click(element: "Add to Cart", ref: "[ref]")

// 8. Verify cart update
mcp__playwright__browser_snapshot()
```

### Mobile Responsiveness Test
```javascript
// Test different viewport sizes
const viewports = [
  { width: 375, height: 667, name: "iPhone SE" },
  { width: 390, height: 844, name: "iPhone 14" },
  { width: 768, height: 1024, name: "iPad" },
  { width: 1920, height: 1080, name: "Desktop" }
];

for (const viewport of viewports) {
  mcp__playwright__browser_resize(width: viewport.width, height: viewport.height)
  mcp__playwright__browser_snapshot()
  // Test interactions at each size
}
```

## Environment Variables to Track

- **Staging URL Status**: Track in context session when URL changes
- **Last Valid URL Date**: Note when URL was last confirmed working
- **Test Image Paths**: 
  - `testing/test-assets/sample-pet.jpg`
  - `testing/test-assets/test-pet.jpg`
  - `testing/test-image.jpg`

## Red Flags to Watch For

1. 🚫 **Never skip staging tests** unless explicitly told by user
2. 🚫 **Don't assume staging URL is valid** - always verify first
3. 🚫 **Don't use local HTML files** as primary testing method
4. 🚫 **Don't test in isolation** - always verify Shopify integration

## How to Request New Staging URL

When the current URL expires, use this template:

```
The Shopify staging preview URL appears to have expired or is redirecting to login.
Could you please provide a new preview URL so I can test the changes on the actual
staging environment? 

This ensures we're testing in the real Shopify environment where customers will
interact with the features.
```

## Testing Documentation

After each test session, update the context session with:
- Which environment was tested (staging URL or local)
- Test results for each scenario
- Any issues found
- Screenshots or snapshots taken
- Network performance metrics