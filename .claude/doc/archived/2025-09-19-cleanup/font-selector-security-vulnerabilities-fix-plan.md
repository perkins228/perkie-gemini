# Font Selector Security Vulnerabilities Fix Plan

**Date**: 2025-08-31  
**Priority**: HIGH - Critical Security Issues  
**Estimated Time**: 2-3 hours  
**Context**: Found XSS vulnerability and missing input validation in pet font selector  

## 🚨 Critical Security Issues Identified

### 1. XSS Vulnerability in Liquid Template (HIGH RISK)
**File**: `snippets/pet-font-selector.liquid`  
**Lines**: 10, 24, 38, 52, 66  
**Issue**: Pet name variable `{{ pet_name }}` used without escaping

**Vulnerable Code**:
```liquid
<p class="font-selector-subtitle">Select how {{ pet_name | default: "your pet's name" }} will appear on the product</p>
<span class="preview-pet-name">{{ pet_name | default: "Buddy" }}</span>
```

**Attack Vector**:
- Malicious pet name like: `<script>alert('XSS')</script>` or `<img src=x onerror=alert('XSS')>`
- Could execute arbitrary JavaScript in user's browser
- Could steal session data, cookies, or perform actions on behalf of user

### 2. Missing Input Validation (MEDIUM RISK)
**File**: `assets/cart-pet-integration.js`  
**Lines**: 66-67  
**Issue**: Font style values stored to localStorage without validation

**Vulnerable Code**:
```javascript
var selectedFontStyle = localStorage.getItem('selectedFontStyle') || 'classic';
fontStyleField.value = selectedFontStyle;
```

**Attack Vector**:
- Direct localStorage manipulation: `localStorage.setItem('selectedFontStyle', '<script>alert("XSS")</script>')`
- Could inject malicious content into form submissions
- Bypasses client-side font validation

## 📋 Implementation Plan

### Phase 1: XSS Vulnerability Fix (30 minutes)

#### 1.1 Liquid Template Escaping
**File to Edit**: `snippets/pet-font-selector.liquid`

**Lines to Fix**:
- Line 10: Subtitle display
- Line 24: Classic font preview
- Line 38: Modern font preview  
- Line 52: Playful font preview
- Line 66: Elegant font preview

**Implementation**:
```liquid
<!-- BEFORE (VULNERABLE) -->
<p class="font-selector-subtitle">Select how {{ pet_name | default: "your pet's name" }} will appear on the product</p>
<span class="preview-pet-name">{{ pet_name | default: "Buddy" }}</span>

<!-- AFTER (SECURE) -->
<p class="font-selector-subtitle">Select how {{ pet_name | default: "your pet's name" | escape }} will appear on the product</p>
<span class="preview-pet-name">{{ pet_name | default: "Buddy" | escape }}</span>
```

**Shopify Escape Filter**:
- `| escape` converts HTML special characters to entities
- `<` becomes `&lt;`, `>` becomes `&gt;`, etc.
- Safe for all user-generated content display

### Phase 2: JavaScript Input Validation (45 minutes)

#### 2.1 Font Style Validation Function
**File to Edit**: `assets/cart-pet-integration.js`

**Add Validation Function** (ES5 compatible):
```javascript
// Add after line 7, before CartPetIntegration object
function validateFontStyle(fontStyle) {
  var allowedFonts = ['classic', 'modern', 'playful', 'elegant'];
  
  // Type check - must be string
  if (typeof fontStyle !== 'string') {
    return false;
  }
  
  // Length check - reasonable limit
  if (fontStyle.length > 20) {
    return false;
  }
  
  // Allowed values check
  if (allowedFonts.indexOf(fontStyle) === -1) {
    return false;
  }
  
  return true;
}
```

#### 2.2 Update Font Style Retrieval (Line 66-67)
**Replace**:
```javascript
var selectedFontStyle = localStorage.getItem('selectedFontStyle') || 'classic';
fontStyleField.value = selectedFontStyle;
```

**With Validation**:
```javascript
var rawFontStyle = localStorage.getItem('selectedFontStyle') || 'classic';
var selectedFontStyle = validateFontStyle(rawFontStyle) ? rawFontStyle : 'classic';
fontStyleField.value = selectedFontStyle;
```

#### 2.3 Update Font Selector JavaScript (Line 224)
**File to Edit**: `snippets/pet-font-selector.liquid`

**Replace**:
```javascript
localStorage.setItem('selectedFontStyle', radio.value);
```

**With Validation**:
```javascript
// Validate before storing
if (validateFontStyle(radio.value)) {
  localStorage.setItem('selectedFontStyle', radio.value);
} else {
  console.warn('Invalid font style selected:', radio.value);
  localStorage.setItem('selectedFontStyle', 'classic');
}
```

**Note**: Need to move validation function to shared location or duplicate in font selector.

### Phase 3: Enhanced Security Measures (45 minutes)

#### 3.1 Pet Name Sanitization
**File to Edit**: `snippets/pet-font-selector.liquid` (JavaScript section)

**Add Name Sanitization Function**:
```javascript
function sanitizePetName(name) {
  if (typeof name !== 'string') {
    return 'Your Pet';
  }
  
  // Remove HTML tags and limit length
  return name
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"&]/g, '') // Remove dangerous characters
    .substring(0, 50) // Limit length
    .trim() || 'Your Pet'; // Fallback if empty
}
```

**Update Pet Name Display** (Line 199-201):
```javascript
if (e.detail && e.detail.name) {
  var safeName = sanitizePetName(e.detail.name);
  previewNames.forEach(function(preview) {
    preview.textContent = safeName; // textContent prevents XSS
  });
  // ... rest of code
}
```

#### 3.2 Content Security Policy Headers
**Recommendation**: Add CSP headers to prevent script injection
- Request to be handled at Shopify theme level (outside current scope)
- Would block inline scripts and unsafe content sources

### Phase 4: Testing & Verification (30 minutes)

#### 4.1 XSS Attack Testing
**Test Cases**:
```javascript
// Test malicious pet names
var maliciousNames = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  'javascript:alert("XSS")',
  '<iframe src="javascript:alert(\'XSS\')"></iframe>',
  '"><script>alert("XSS")</script>',
  '\'; DROP TABLE pets; --'
];

// Test malicious font styles  
localStorage.setItem('selectedFontStyle', '<script>alert("XSS")</script>');
localStorage.setItem('selectedFontStyle', 'invalid-font');
localStorage.setItem('selectedFontStyle', ''.repeat(100)); // Length attack
```

#### 4.2 Functionality Testing
- Font selection still works correctly
- Pet name preview updates properly
- Cart integration maintains font selection
- Mobile touch targets remain functional

## 🛡️ Security Best Practices Implemented

### 1. Defense in Depth
- **Input Validation**: Check font styles against whitelist
- **Output Encoding**: Escape HTML in Liquid templates
- **Data Sanitization**: Clean pet names before display

### 2. ES5 Compatibility Maintained
- No arrow functions, template literals, or modern JS
- Uses `indexOf()` instead of `includes()`
- Compatible with older mobile browsers (70% traffic)

### 3. Shopify-Specific Security
- Leverages Shopify's `| escape` filter (XSS protection)
- Works within Shopify's Content Security Policy
- Follows Shopify development best practices

## 📂 Files to Modify

### Core Files (2-3 edits each)
1. **`snippets/pet-font-selector.liquid`**
   - Add `| escape` filters to all pet name displays (5 locations)
   - Add pet name sanitization function 
   - Add font validation to localStorage storage

2. **`assets/cart-pet-integration.js`** 
   - Add font style validation function
   - Update font style retrieval with validation
   - Ensure safe handling of localStorage data

### Testing Files (verification only)
- Use existing staging environment for testing
- Test on actual mobile devices for touch targets
- Verify XSS protection with malicious inputs

## ⏱️ Implementation Timeline

### Immediate (Next 30 minutes)
1. Fix XSS vulnerability with `| escape` filters ⚡ **CRITICAL**
2. Add basic font style validation

### Within 1 Hour  
3. Implement pet name sanitization
4. Test all XSS attack vectors

### Within 2 Hours
5. Mobile testing and optimization
6. Complete security verification

### Within 3 Hours
7. Documentation and deployment ready

## 🚀 Expected Outcomes

### Security Improvements
- **XSS Protection**: 100% prevention of script injection attacks
- **Data Integrity**: Only valid font styles accepted and stored
- **Input Sanitization**: Pet names cleaned before display

### Performance Impact
- **Minimal**: <10ms additional processing time
- **Mobile Compatible**: Maintains 70% mobile traffic performance
- **ES5 Compliant**: Works on all target browsers

### User Experience
- **No Visual Changes**: UI/UX remains identical
- **Same Functionality**: All features work as before  
- **Better Reliability**: Prevents crashes from malformed data

## 🔍 Testing Strategy

### Manual Testing
1. **XSS Attempts**: Try malicious pet names and font values
2. **Edge Cases**: Empty values, very long strings, special characters
3. **Mobile Testing**: Touch interactions, font display, performance

### Automated Testing  
- Use browser dev tools to inject malicious localStorage values
- Test font selection persistence across page reloads
- Verify cart integration maintains security measures

## 📝 Next Steps After Implementation

1. **Deploy to Staging**: Test with actual Shopify staging environment
2. **Security Review**: Have another developer review the fixes
3. **Performance Monitoring**: Verify no performance degradation
4. **User Acceptance**: Confirm all features work as expected
5. **Production Deployment**: Roll out security fixes via GitHub auto-deploy

---

**Critical Note**: These security vulnerabilities should be patched immediately. The XSS vulnerability poses a direct risk to user safety and could be exploited by malicious actors. Do not deploy font selector to production without these fixes.