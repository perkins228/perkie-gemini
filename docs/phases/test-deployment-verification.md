# Deployment Verification Test Plan

## 🎯 **Systematic Testing - Following Cursor Rules**

**CONTEXT FIRST**: Before testing frontend, ensure API works correctly at each level.

---

## **Phase 1: API Deployment Verification**

### **1.1 Basic API Health Check**
```bash
# Test if API is responding
curl "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/health"

# Expected: HTTP 200, JSON health status
```

### **1.2 API v2 Endpoint Check**
```bash
# Test v2 root endpoint
curl "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/"

# Expected: JSON with service info and available_effects array
```

### **1.3 Effects List Verification**
```bash
# Test effects endpoint
curl "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/effects"

# Expected: JSON with 5 effects: color, enhancedblackwhite, dithering, popart, retro8bit
```

---

## **Phase 2: JSON Response Format Testing**

### **2.1 Single Effect Test (Legacy Mode)**
```bash
# Test without return_all_effects (should return PNG)
curl -X POST "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects" \
  -F "file=@test-image.jpg" \
  -F "effects=enhancedblackwhite" \
  -I

# Expected: Content-Type: image/png
```

### **2.2 Multiple Effects Test (JSON Mode)**
```bash
# Test with return_all_effects=true (should return JSON)
curl -X POST "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects" \
  -F "file=@test-image.jpg" \
  -F "effects=enhancedblackwhite,popart,color" \
  -F "return_all_effects=true" \
  -I

# Expected: Content-Type: application/json
```

---

## **Phase 3: Frontend Integration Testing**

### **3.1 Browser Console Verification**
When testing on frontend, check for:

**✅ SUCCESS INDICATORS:**
- `API Response status: 200`
- `API Response headers: content-type: application/json`
- `Received response data: [object with effects]`
- Effect selection UI appears
- No client-side fallback messages

**❌ FAILURE INDICATORS:**
- `content-type: image/png` (means API still in legacy mode)
- `SyntaxError: Unexpected token '�'` (trying to parse PNG as JSON)
- `falling back to client-side processing`

### **3.2 DOM Element Verification**
Check that effect selection elements exist:
```javascript
// Console commands to verify DOM
document.querySelector('#effect-selection-template--17290987929683__main_feature')
document.querySelectorAll('.ks-pet-bg-remover__effect-card').length
```

---

## **Phase 4: Step-by-Step Frontend Fix**

### **4.1 First: Fix Basic Flow**
1. Ensure API returns JSON when `return_all_effects=true`
2. Verify frontend gets JSON response
3. Test single effect works (Enhanced Black & White)

### **4.2 Second: Enable Effect Selection**
1. Verify effect selection UI appears
2. Test effect switching works
3. Verify download with correct effect name

### **4.3 Third: Polish UX**
1. Smooth animations
2. Progress messages
3. Error handling

---

## **Expected Timeline**

- ⏱️ **Phase 1**: 5 minutes (API verification)
- ⏱️ **Phase 2**: 10 minutes (response format testing)
- ⏱️ **Phase 3**: 15 minutes (frontend integration)
- ⏱️ **Phase 4**: 30 minutes (systematic frontend fixes)

**Total**: ~1 hour for complete verification and fixes

---

## **Deployment Status**

- [ ] **API Deployment**: In progress...
- [ ] **Health Check**: Pending deployment
- [ ] **JSON Format**: Pending verification
- [ ] **Frontend Test**: Pending API
- [ ] **Effect Selection**: Pending basic flow

**Next Step**: Wait for deployment completion, then execute Phase 1 tests. 