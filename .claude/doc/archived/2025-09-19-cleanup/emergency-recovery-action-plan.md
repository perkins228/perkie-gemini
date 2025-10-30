# Emergency Recovery Action Plan
## Get Back to Working State TODAY

### Executive Summary
After extensive analysis, we need to revert to a known-good state before the social sharing feature (commit dff3e25) and carefully preserve the valuable storage consolidation work.

---

## STEP 1: Preserve Valuable Changes (5 minutes)
**Create a backup branch with all recent work:**

```bash
# Create backup branch with current state
git checkout -b backup/pre-revert-20250127
git push origin backup/pre-revert-20250127
```

---

## STEP 2: Identify Recovery Point (Already Done)

**Target Commit: `ed4003b` (Jan 23, 2025)**
- Last known stable state before social sharing feature
- After successful storage consolidation
- Before ES5/ES6 syntax mixing issues

---

## STEP 3: Execute Recovery (10 minutes)

### Option A: RECOMMENDED - Clean Revert
```bash
# Return to staging branch
git checkout staging

# Hard reset to stable commit (LOSES uncommitted changes)
git reset --hard ed4003b

# Force push to update remote (coordinate with team!)
git push --force origin staging
```

### Option B: Alternative - Soft Revert (if you have uncommitted work)
```bash
# Save any uncommitted work
git stash

# Return to staging
git checkout staging

# Reset to stable commit
git reset --hard ed4003b

# Force push
git push --force origin staging

# Retrieve stashed work if needed
git stash pop
```

---

## STEP 4: Verify Recovery (5 minutes)

1. **Check critical files are restored:**
```bash
# Verify pet selector is at stable version
git show HEAD:snippets/ks-product-pet-selector.liquid | head -20

# Confirm no syntax errors in key files
grep -E "(=>|const |let |class )" assets/unified-pet-storage.js
```

2. **Test staging deployment:**
- Push to staging triggers auto-deploy
- Wait 2-3 minutes for Shopify to update
- Test pet selector functionality

---

## STEP 5: Document What to Re-implement Later

### Valuable Changes to Preserve (TODO List)

#### ✅ KEEP - Storage Consolidation (Already in ed4003b)
- Unified storage system (PetStorage)
- Safari Private Mode support
- localStorage migration
- These are ALREADY included in our target commit

#### ⚠️ DEFER - Social Sharing Feature (dff3e25)
- Effect comparison gallery
- Social sharing with tracking
- Split-screen comparison mode
- **Action:** Rebuild properly with ES5 compatibility

#### ⚠️ SKIP - Problematic ES5 Conversions
- Commits 6f574ed through 94a08ec
- These introduced syntax errors
- **Action:** Don't re-apply, fix properly if needed

#### ✅ CONSIDER - Bug Fixes
- White background regression fix (8e56eb7)
- **Action:** Test if still needed after revert

---

## STEP 6: Immediate Next Steps (After Recovery)

1. **Test Core Functionality:**
   - Pet selector works
   - Background removal works
   - Product pages load
   - No console errors

2. **Create Clean Feature Branch:**
```bash
# After confirming stability
git checkout -b feature/social-sharing-v2

# Cherry-pick only the good parts
git cherry-pick 8e56eb7  # White background fix if needed
```

3. **Rebuild Social Features Properly:**
   - Use ES5-compatible syntax throughout
   - Test locally before pushing
   - Implement incrementally

---

## Critical Commands Summary

### THE NUCLEAR OPTION - Complete Recovery
```bash
# One-liner to get back to working state
git checkout staging && git reset --hard ed4003b && git push --force origin staging
```

### After Recovery - Cherry Pick Good Changes
```bash
# Get white background fix if needed
git cherry-pick 8e56eb7

# Create new feature branch for social
git checkout -b feature/social-sharing-es5
```

---

## Time Estimate
- **Total Recovery Time:** 20-30 minutes
- Backup current state: 5 min
- Execute revert: 5 min
- Verify deployment: 10 min
- Test functionality: 10 min

## Risk Mitigation
1. **Backup branch preserves all work**
2. **Can always return to backup if needed**
3. **Target commit is known stable**
4. **Storage consolidation is preserved**

## Success Criteria
✅ Staging deploys without errors
✅ Pet selector works properly
✅ No syntax errors in console
✅ Background removal functional
✅ Can proceed with new development

---

## IMPORTANT NOTES

1. **Coordinate with team** before force push
2. **Test staging URL** immediately after deployment
3. **Don't cherry-pick problematic commits** (6f574ed-94a08ec)
4. **Rebuild social features properly** with ES5 syntax

## Recovery Complete Checklist
- [ ] Backup branch created
- [ ] Reset to ed4003b executed
- [ ] Force push completed
- [ ] Staging deployment verified
- [ ] Core functionality tested
- [ ] Team notified of changes
- [ ] Future work documented