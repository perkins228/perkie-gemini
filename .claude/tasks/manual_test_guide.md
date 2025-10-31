# Manual Testing Guide: Page Refresh with Uploaded Pet
**Date**: 2025-10-31
**URL**: https://xizw2apja6j0h6hy-2930573424.shopifypreview.com/pages/custom-image-processing

---

## Test Scenario: Modern/Classic Button Persistence After Refresh

### **Pre-Test Setup** ✅ COMPLETE
- ✅ Code deployed to Shopify test environment
- ✅ Security utilities verified (all 6 functions loaded)
- ✅ Session restoration code verified (running on page load)
- ✅ Initial button states verified (Modern/Classic enabled)

---

## **Step-by-Step Test Instructions**

### Step 1: Upload Pet Image
1. Visit: https://xizw2apja6j0h6hy-2930573424.shopifypreview.com/pages/custom-image-processing
2. Open Browser DevTools (F12) → Console tab
3. Click "Tap to upload or take photo"
4. Select any pet image (JPG or PNG)

**Expected Console Logs**:
```
🐾 Processing started...
Processing pet image...
```

---

### Step 2: Wait for B&W and Color Effects
**Expected Behavior**:
- Processing spinner appears
- After ~10-30 seconds, B&W effect generates
- Color effect generates
- Result view appears with effect buttons

**Console Logs to Watch For**:
```
✅ Processing complete
Effect generated: enhancedblackwhite
Effect generated: color
```

---

### Step 3: Check Modern/Classic Button States (Before Generation)
**Look at the effect buttons**:
- B&W button: ✅ Should be enabled (you can click it)
- Color button: ✅ Should be enabled (you can click it)
- Modern button: Should show one of:
  - "Click to generate Modern effect" (enabled) ✅ CORRECT
  - OR have loading spinner (while generating)
- Classic button: Should show one of:
  - "Click to generate Classic effect" (enabled) ✅ CORRECT
  - OR have loading spinner (while generating)

**Console Check**:
```javascript
// Paste this in console to check button states:
document.querySelectorAll('.effect-btn').forEach(btn => {
  console.log(`${btn.dataset.effect}: disabled=${btn.disabled}, classes=${btn.className}`);
});
```

---

### Step 4: Wait for Modern/Classic Effects to Generate
**Expected Behavior**:
- Modern and Classic effects will generate automatically (if quota available)
- This may take 30-60 seconds (cold start on first request)
- Watch console for progress

**Console Logs to Watch For**:
```
🎨 Generating Gemini effects...
🎨 Modern effect generated
🎨 Classic effect generated
```

**If Quota Exhausted**:
```
⚠️ Daily AI limit reached (0/10 remaining)
```
If this happens, that's okay - we can still test the refresh behavior!

---

### Step 5: Verify All Effects Are Generated
**Check the effect buttons**:
- B&W button: ✅ Enabled, shows effect
- Color button: ✅ Enabled, shows effect
- Modern button: ✅ Enabled, shows effect (or disabled if quota exhausted)
- Classic button: ✅ Enabled, shows effect (or disabled if quota exhausted)

**Console Check**:
```javascript
// Check which effects are stored:
const pets = PetStorage.getAll();
console.log('Pets in storage:', pets);

// Check localStorage for Gemini effects:
for (let key in localStorage) {
  if (key.includes('_modern') || key.includes('_classic')) {
    console.log(`Found effect: ${key}`);
  }
}
```

---

### Step 6: **THE CRITICAL TEST - Page Refresh**
1. **Refresh the page** (F5 or Ctrl+R)
2. **Immediately check the console** for restoration logs

**Expected Console Logs**:
```
🔄 Attempting to restore session from localStorage
🔄 Restoring most recent pet: pet_xxxxx
✅ Session restored with N effect(s): [list of effects]
🎨 Gemini effects enabled (existing session detected)
```

---

### Step 7: **VERIFY BUTTON STATES AFTER REFRESH**
**This is the moment of truth!**

**Expected Behavior (SUCCESS)**:
- ✅ B&W button: ENABLED (can click to view effect)
- ✅ Color button: ENABLED (can click to view effect)
- ✅ **Modern button: ENABLED** (can click to view effect) ← **KEY TEST**
- ✅ **Classic button: ENABLED** (can click to view effect) ← **KEY TEST**

**Console Check**:
```javascript
// Verify button states after refresh:
const buttons = document.querySelectorAll('.effect-btn');
buttons.forEach(btn => {
  const effect = btn.dataset.effect;
  const state = btn.disabled ? '❌ DISABLED' : '✅ ENABLED';
  console.log(`${effect}: ${state} (title: "${btn.title}")`);
});
```

**Expected Output**:
```
enhancedblackwhite: ✅ ENABLED (title: "Black & White effect")
color: ✅ ENABLED (title: "Color effect")
modern: ✅ ENABLED (title: "View Modern effect")
classic: ✅ ENABLED (title: "View Classic effect")
```

---

### Step 8: Click Modern Button After Refresh
1. Click the Modern button
2. **Expected**: Should show the Modern effect IMMEDIATELY
3. **Should NOT regenerate** (should use cached version)

**Console Logs**:
```
Switching to effect: modern
Effect already loaded, using cached version
```

---

### Step 9: Click Classic Button After Refresh
1. Click the Classic button
2. **Expected**: Should show the Classic effect IMMEDIATELY
3. **Should NOT regenerate** (should use cached version)

---

## **Success Criteria**

The fix is successful if ALL of these are true after refresh:

✅ Modern button is ENABLED (not grayed out)
✅ Classic button is ENABLED (not grayed out)
✅ Clicking Modern button shows effect immediately (no regeneration)
✅ Clicking Classic button shows effect immediately (no regeneration)
✅ Console shows session restoration logs
✅ Console shows "Session restored with N effect(s)"
✅ No errors in console (except expected Shopify 404s)

---

## **Failure Scenarios**

### ❌ If Modern/Classic buttons are DISABLED after refresh:
**Check console for**:
- Are restoration logs present? (`🔄 Attempting to restore...`)
- Did restoration complete? (`✅ Session restored...`)
- Are effects in localStorage? (Run localStorage check above)
- Is feature flag enabled? (`🎨 Gemini effects enabled...`)

**Possible causes**:
- Feature flag disabled: `localStorage.getItem('gemini_effects_enabled') === 'false'`
- Quota exhausted: `0/10 remaining`
- No effects saved: `PetStorage.getAll()` returns empty
- Session restoration failed: Check error logs

### ❌ If effects don't restore (buttons enabled but blank):
**Check**:
- Are GCS URLs expired? (403/404 errors in Network tab)
- Are data URLs corrupted? (Invalid format)
- Security validation blocking URLs? (Check for 🔒 warnings)

---

## **Debugging Commands**

If something goes wrong, paste these in console:

### Check Feature Flags:
```javascript
console.log('Feature flags:', {
  enabled: localStorage.getItem('gemini_effects_enabled'),
  rollout: localStorage.getItem('gemini_rollout_percent'),
  customerId: localStorage.getItem('gemini_customer_id')
});
```

### Check Pet Storage:
```javascript
const pets = PetStorage.getAll();
console.log('Pets in storage:', Object.keys(pets).length);
Object.entries(pets).forEach(([id, data]) => {
  console.log(`Pet ${id}:`, {
    effect: data.effect,
    hasGcsUrl: !!data.gcsUrl,
    hasThumbnail: !!data.thumbnail,
    timestamp: new Date(data.timestamp).toLocaleString()
  });
});
```

### Check Button States:
```javascript
document.querySelectorAll('.effect-btn').forEach(btn => {
  console.log(`${btn.dataset.effect}:`, {
    disabled: btn.disabled,
    classes: btn.className,
    title: btn.title
  });
});
```

### Force Re-enable Gemini:
```javascript
localStorage.setItem('gemini_effects_enabled', 'true');
localStorage.setItem('gemini_rollout_percent', '100');
location.reload();
```

### Clear All Data (Nuclear Option):
```javascript
// WARNING: This clears all pet data!
PetStorage.clear();
localStorage.removeItem('gemini_effects_enabled');
localStorage.removeItem('gemini_rollout_percent');
localStorage.removeItem('gemini_customer_id');
location.reload();
```

---

## **After Testing**

### If Test PASSES ✅:
Report back:
- "Modern/Classic buttons stayed enabled after refresh ✅"
- "Effects loaded immediately on click ✅"
- Screenshot or paste console logs showing restoration

### If Test FAILS ❌:
Report back:
- Which step failed?
- What button states did you see?
- Paste console logs (especially error messages)
- Screenshot of button states

---

## **Quick Test Checklist**

- [ ] Upload pet image
- [ ] Wait for B&W + Color effects
- [ ] Wait for Modern + Classic effects (or note quota exhausted)
- [ ] **Refresh page (F5)**
- [ ] Check console for restoration logs
- [ ] **Verify Modern button ENABLED**
- [ ] **Verify Classic button ENABLED**
- [ ] Click Modern button → Shows effect immediately
- [ ] Click Classic button → Shows effect immediately
- [ ] No errors in console

---

**Ready to test? Upload an image and follow the steps above!**

Let me know what you observe at each step, especially after the page refresh.
