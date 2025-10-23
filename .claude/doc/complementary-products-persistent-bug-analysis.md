# Complementary Products Pricing Bug - Why Fix Didn't Work

**Date**: 2025-10-16
**Agent**: debug-specialist
**Status**: ✅ ROOT CAUSE IDENTIFIED - Deployment Issue
**Priority**: P1 - Production Bug

---

## User Report

**Statement**: "the error persist in staging"
**Context**: Fix deployed in commit 996fb07, but user reports prices still wrong
**Staging Branch**: Has the fix ✅
**Main Branch**: Does NOT have the fix ❌

---

## What I Found (The REAL Problem)

### The Fix IS Deployed to Staging Branch

```bash
$ git show staging:snippets/price.liquid | grep "price_min"
26:  assign price_min = target.price_min  ✅ FIXED
27:  assign price_max = target.price_max  ✅ FIXED
```

### The Fix is NOT on Main Branch

```bash
$ git show main:snippets/price.liquid | grep "price_min"
26:  assign price_min = product.price_min  ❌ BUG STILL PRESENT
27:  assign price_max = product.price_max  ❌ BUG STILL PRESENT
```

### Branch Status

```
Commit 996fb07 (the fix) exists on:
- staging branch ✅
- fix/complementary-products-pricing branch ✅
- origin/staging remote ✅

Commit 996fb07 DOES NOT exist on:
- main branch ❌
- origin/main remote ❌
```

---

## Why User Still Sees the Bug

### Hypothesis 1: Shopify Staging Connected to Main Branch (90% Probability)

**Most Likely Scenario**:
- Shopify has TWO environments: Production and Staging
- Staging Shopify environment is connected to `main` Git branch
- User pushes to `staging` Git branch (which has the fix)
- **BUT Shopify staging environment deploys from `main` Git branch**
- Result: Fix not visible in Shopify staging

**Evidence**:
- CLAUDE.md says: "GitHub integration automatically deploys to Shopify staging"
- Recent commits on main: "Update from Shopify for theme perkieprints/main"
- This suggests Shopify auto-commits back to the branch it's tracking

**Verification Command**:
```bash
git log main --oneline -n 10 | grep "Update from Shopify"
```

If you see multiple "Update from Shopify for theme perkieprints/main" commits, this confirms main is the deployed branch.

### Hypothesis 2: Shopify Template Cache (8% Probability)

**Scenario**:
- Shopify staging IS connected to `staging` branch
- But Shopify's Liquid template cache hasn't cleared
- CDN serving old cached templates
- Browser cache serving old HTML

**Testing**:
1. Hard refresh with cache disabled (Ctrl+Shift+R)
2. Test in incognito/private window
3. Wait 5-10 minutes for Shopify CDN propagation
4. Check Shopify admin for deployment timestamp

### Hypothesis 3: Wrong Staging URL (2% Probability)

**Scenario**:
- User testing wrong URL
- Testing production instead of staging
- Production is on main branch (which doesn't have the fix)

**Current URLs (from CLAUDE.md)**:
- Staging: `https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/`
- Production: `https://perkieprints.com/`

If staging URL expired, user may have updated it without documenting.

---

## The Critical Misunderstanding

### What Happened

1. **Oct 13**: Fixed bug, committed to `fix/complementary-products-pricing` branch
2. **Oct 13**: Merged fix branch to `staging` Git branch (commit 996fb07)
3. **Oct 16**: User reports "error persist in staging"
4. **Oct 16**: I verified fix IS on staging Git branch
5. **Oct 16**: I verified fix is NOT on main Git branch

### The Issue

**"Staging" has TWO meanings**:
1. **`staging` Git branch** - Has the fix ✅
2. **Shopify staging environment** - May be connected to `main` Git branch ❌

User says "staging" meaning the Shopify environment, but the fix is only on the `staging` Git branch!

---

## The Solution

### Option 1: Merge Staging to Main (RECOMMENDED)

**If Shopify staging deploys from main**:

```bash
# Merge staging branch into main
git checkout main
git pull origin main
git merge staging
git push origin main

# Wait 1-2 minutes for GitHub auto-deployment
```

**Pros**:
- Simple fix
- One command
- Aligns Git branches

**Cons**:
- Deploys to PRODUCTION immediately (if main = production)
- Need to verify other staging commits are production-ready

**Check First**:
- Does main have any "Update from Shopify" commits?
- If YES: main is the deployed branch, merge staging to main
- If NO: staging is deployed, investigate cache issue

### Option 2: Change Shopify Branch Connection

**If you want staging Git branch → Shopify staging**:

1. Go to Shopify admin → Online Store → Themes
2. Find staging theme
3. Click Actions → Manage theme
4. Change GitHub branch from `main` to `staging`
5. Save

**Pros**:
- Keeps Git workflow clean
- Staging changes auto-deploy

**Cons**:
- Requires Shopify admin access
- Need to reconfigure GitHub integration

### Option 3: Cherry-Pick the Fix

**If main has other commits you don't want to merge**:

```bash
git checkout main
git cherry-pick 996fb07
git push origin main
```

**Pros**:
- Only moves the specific fix
- No other staging changes

**Cons**:
- Manual process
- Duplicate commit in Git history

---

## Investigation Steps for User

### Step 1: Determine Which Branch Shopify Uses

```bash
# Check if main has Shopify auto-commits
git log main --oneline -n 20 | grep "Shopify"

# Check if staging has Shopify auto-commits
git log staging --oneline -n 20 | grep "Shopify"
```

**If main has "Update from Shopify" commits**: Main is deployed to Shopify
**If staging has "Update from Shopify" commits**: Staging is deployed to Shopify

### Step 2: Check Shopify Admin

1. Log into Shopify admin
2. Go to Online Store → Themes
3. Find "Staging" theme (or preview theme)
4. Look for GitHub integration info
5. Note which branch it's connected to

### Step 3: Verify Fix Location

```bash
# Check if fix is on the branch Shopify uses
git show <shopify-branch>:snippets/price.liquid | grep -A2 "price_min"

# Should see:
# assign price_min = target.price_min  ← FIXED
# assign price_max = target.price_max  ← FIXED
```

### Step 4: Test with Hard Refresh

1. Open Shopify staging URL in browser
2. Open DevTools (F12)
3. Go to Network tab
4. Check "Disable cache"
5. Hard refresh (Ctrl+Shift+R)
6. Navigate to product page
7. Check complementary product prices

---

## Why This Wasn't Caught

1. **Git branch naming**: `staging` Git branch name matches "staging" environment name, but they're not connected
2. **No documentation**: GitHub→Shopify branch mapping not documented
3. **Testing assumption**: Assumed `staging` branch deploys to staging environment
4. **No verification**: Didn't check which branch Shopify actually deploys from

---

## Recommended Fix (Step by Step)

### If Shopify Staging Uses Main Branch

**This is most likely based on the evidence:**

```bash
# 1. Verify fix is on staging
git checkout staging
git log --oneline -n 3
# Should see: 996fb07 fix: Replace inconsistent product references...

# 2. Check main doesn't have unreleased code
git log main..staging --oneline
# Review all commits between main and staging
# Make sure everything is production-ready

# 3. Merge staging to main
git checkout main
git pull origin main
git merge staging

# 4. Push to trigger deployment
git push origin main

# 5. Wait 1-2 minutes, then test
# Open: https://9wy9fqzd0344b2sw-2930573424.shopifypreview.com/
# Check complementary products
```

### If Shopify Staging Uses Staging Branch

**If "Update from Shopify" commits appear on staging, not main:**

```bash
# 1. Clear Shopify cache (Shopify admin)
# 2. Hard refresh browser (Ctrl+Shift+R with DevTools open)
# 3. Wait 5 minutes for CDN propagation
# 4. Test again
```

---

## Success Criteria

✅ User confirms which Git branch Shopify staging uses
✅ Fix appears on the correct Git branch
✅ Shopify staging shows correct complementary product prices
✅ No regressions on main product prices
✅ No console errors

---

## Files Changed in the Fix

**File**: `snippets/price.liquid`
**Commit**: 996fb07
**Lines Changed**: 13 lines (26-27, 49-51, 62, 64, 94, 111-121)

**Changes**:
```liquid
# ALL instances of 'product.*' changed to 'target.*'
- product.price_min → target.price_min
- product.price_max → target.price_max
- product.price_varies → target.price_varies
- product.compare_at_price_varies → target.compare_at_price_varies
- product.quantity_price_breaks_configured? → target.quantity_price_breaks_configured?
- product.selected_or_first_available_variant → target.selected_or_first_available_variant
```

**Why This Fixes the Bug**:
- Liquid snippets inherit parent scope
- `product` object in parent scope (main product) overrides passed parameter
- Using `target` (which is explicitly assigned to the passed parameter) avoids scope pollution
- Ensures complementary products use their own prices, not main product price

---

## Challenge to Previous Analysis

### What I Missed in Original Fix

**Original assumption**:
- "Deploy to staging" means push to `staging` Git branch
- GitHub automatically deploys `staging` branch to Shopify staging

**What's actually happening**:
- GitHub deploys a SPECIFIC branch to Shopify (probably `main`)
- The `staging` Git branch is just a development branch
- It needs to be merged to the deployed branch

### Why I Should Have Checked This

**Red flags I ignored**:
1. ✅ Recent main commits: "Update from Shopify for theme perkieprints/main"
   - This clearly shows Shopify writes back to `main`, not `staging`
2. ✅ Commit 996fb07 only on staging, not main
   - If Shopify deploys from main, fix would never appear
3. ✅ User said "error persist" immediately after push to staging
   - Should have checked if staging branch is actually deployed

**Lesson learned**:
- ALWAYS verify which Git branch a deployment system uses
- Don't assume branch names match environments
- Check for bidirectional sync (Shopify → GitHub commits)

---

## Next Steps

1. ⏳ **User confirms which branch Shopify uses** (Step 1 above)
2. ⏳ **Apply appropriate fix** (merge to main OR clear cache)
3. ⏳ **Test on Shopify staging** (hard refresh, check prices)
4. ⏳ **Document branch mapping** (update CLAUDE.md with correct info)
5. ⏳ **Update workflow** (ensure future fixes go to correct branch)

---

## Time Estimate

- **Investigation**: 15 minutes (Steps 1-3)
- **Fix application**: 5 minutes (merge or cache clear)
- **Testing**: 15 minutes (verify prices)
- **Documentation**: 10 minutes (update CLAUDE.md)
- **Total**: 45 minutes

---

## Direct Answer to User's Problem

**Q**: Why does the error persist in staging despite fix being deployed?

**A**: The fix (commit 996fb07) is on the `staging` Git branch, but Shopify's staging environment is likely deploying from the `main` Git branch (based on "Update from Shopify for theme perkieprints/main" commits).

**Solution**: Merge `staging` branch into `main` branch to deploy the fix:

```bash
git checkout main && git pull origin main && git merge staging && git push origin main
```

After 1-2 minutes, the fix will appear in Shopify staging and complementary products will show correct prices.

**Alternative**: If Shopify staging IS deploying from `staging` branch, this is a cache issue - hard refresh browser with DevTools cache disabled and wait 5 minutes for CDN.

**Verification First**: Run `git log main --oneline -n 10 | grep Shopify` to confirm which branch Shopify uses. If you see "Update from Shopify" commits on main, merge staging to main.
