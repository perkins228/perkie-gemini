# Cart Pet Thumbnails Debug Analysis

## Context
Pet thumbnail display in cart has two critical issues:
1. Only ONE thumbnail shows when multiple pets are selected
2. Thumbnails require page refresh to appear initially

## Current Implementation Summary

### Data Flow
1. **Pet Selection**: `ks-product-pet-selector.liquid` dispatches `pet:selected` events
2. **Form Integration**: `cart-pet-integration.js` listens for events and populates hidden form fields
3. **Cart Storage**: Pet data stored in `localStorage.cartPetData` by pet name
4. **Cart Display**: `cart-drawer.liquid` includes `data-pet-names` attribute
5. **Thumbnail Loading**: `cart-pet-thumbnails.js` processes pet names and displays thumbnails

### localStorage Structure
- `cartPetData`: Object with pet names as keys
- Format: `{"Sam": {name: "Sam", thumbnail: "data:image/jpeg;base64...", effect: "original", timestamp: 1635789123456}}`

### HTML Structure
- `data-pet-names="{{ item.properties._pet_name | escape }}"` in cart-drawer.liquid line 211
- Multiple pets passed as comma-separated string: "Sam,Buddy,Max"

## Issues Identified

### Issue 1: Only One Pet Thumbnail Shows
**Expected**: Multiple pet thumbnails display when multiple pets selected
**Actual**: Only first pet thumbnail appears
**Data Structure**: Pet names correctly passed as comma-separated string

### Issue 2: Thumbnails Don't Show Until Refresh
**Expected**: Thumbnails appear immediately after adding to cart
**Actual**: Only show after page refresh
**Suspected Cause**: Event timing or cart drawer state issues

## Need Debug Specialist Analysis
Please provide:
1. Root cause analysis for both issues
2. Investigation strategy
3. Specific debugging steps
4. Recommended fixes

## Files to Investigate
- `assets/cart-pet-thumbnails.js` - Main thumbnail logic
- `assets/cart-pet-integration.js` - Cart integration events
- `snippets/cart-drawer.liquid` - HTML structure and data attributes
- localStorage data structure and pet name splitting logic

## Context File Path
.claude/tasks/context_session_001.md