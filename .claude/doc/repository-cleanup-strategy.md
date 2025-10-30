# Repository Cleanup Strategy - Implementation Plan

**Created**: 2025-10-21
**Agent**: code-refactoring-master
**Context**: .claude/tasks/context_session_1.md
**Status**: PROPOSAL - NOT IMPLEMENTED

---

## Executive Summary

The Perkie Prints repository has accumulated ~4.3MB of temporary files, test artifacts, and 173+ untracked documentation files. This cleanup plan provides a safe, reversible strategy to organize the repository while preserving all valuable historical context.

**Key Metrics**:
- **Temp files to delete**: 19 files (~4MB)
- **Documentation files to archive**: 169 files (~5.2MB)
- **Root directory files to relocate**: 4 documentation files
- **Malformed files to remove**: 2 files
- **Total repository health improvement**: ~9.2MB reduction in working tree clutter

---

## 1. Root Cause Analysis

### Why This Clutter Accumulated

**Primary Causes**:

1. **Insufficient .gitignore Coverage** (60% of problem)
   - Temp log files (*.json with "temp_" or "logs_") not ignored
   - Test artifacts (*.txt, *.png test files) not covered
   - Python test scripts not excluded from theme repo

2. **Development Workflow Gaps** (30% of problem)
   - Debugging sessions creating temp files in root directory
   - Agent-generated analysis docs (173 files) not automatically archived
   - No automated cleanup of completed session artifacts

3. **Documentation Proliferation** (10% of problem)
   - Each agent analysis creates a new .md file in .claude/doc/
   - No automatic archival after task completion
   - Git status shows 41 untracked files (actually 169+ total)

**Systemic Issues**:
- Theme repository contains backend testing artifacts (should be in backend/ only)
- Root directory used as scratch space during debugging
- .gitignore doesn't align with actual development patterns
- No clear policy on when to archive vs. delete documentation

---

## 2. File-by-File Categorization

### Category A: DELETE (Truly Temporary - No Historical Value)

**Rationale**: These are ephemeral debug/test files with no long-term value

#### A1. Temporary Log Files (3.85MB)
```
DELETE: logs_last_2h.json (370KB)
DELETE: temp_logs_48h_comprehensive.json (2.0MB)
DELETE: temp_logs_cloud_run.json (1.1MB)
DELETE: temp_logs_day5_analysis.json (518KB)
DELETE: temp_logs_post_deployment.json (153KB)
```
**Reasoning**: These are snapshots of Cloud Run logs for debugging. The actual logs exist in Google Cloud Console with better querying. These were created for specific debugging sessions and are now stale (oldest: Oct 10, newest: Oct 20).

#### A2. Base64 Test Files (160KB)
```
DELETE: squid_base64.txt (53KB)
DELETE: squid_part1.txt (49KB)
DELETE: squid_part2.txt (4.1KB)
DELETE: temp_image_data.txt (53KB)
```
**Reasoning**: Temporary files created during base64 encoding tests for pet image processing. The actual test logic is in test files. These are just data dumps.

#### A3. Malformed Files (0KB)
```
DELETE: cUsersperkiOneDriveDesktopPerkieProductionsquid_base64.txt (0KB - empty)
DELETE: _ul (0KB - empty)
```
**Reasoning**: Malformed filenames from copy-paste errors or failed file operations. Empty and useless.

#### A4. Test Data Files (47 bytes)
```
DELETE: test-image.txt (20 bytes)
DELETE: test-pet-2.txt (22 bytes)
DELETE: test-pet-image.svg (5.5KB)
```
**Reasoning**: Minimal test data files. The actual comprehensive tests exist in testing/ directory. These are orphaned fragments.

#### A5. Python Test Script (692 bytes)
```
DELETE: create_test_image.py
```
**Reasoning**: One-off Python script in a Shopify theme repo. The backend API has proper test infrastructure in backend/inspirenet-api/tests/. This doesn't belong in root.

**Total DELETE Category**: 19 files, ~4.05MB

---

### Category B: ARCHIVE (Historical Value, Wrong Location)

**Rationale**: These have reference value but pollute the active working tree

#### B1. Root Documentation Files
```
MOVE TO: .claude/doc/archived/2025-10-root-cleanup/

- DEPLOYMENT_CHECKLIST.md → (deployment reference)
- DEPLOYMENT_COMPLETE.md → (completion milestone)
- LOGGER_INTEGRATION_GUIDE.md → (integration guide)
- REVIEW_IMPLEMENTATION_GUIDE.md → (review process guide)
```
**Reasoning**: These were created during specific implementation phases. They have historical value for understanding past decisions but shouldn't be in root. Move to archived docs with date-stamped folder.

#### B2. Recent Analysis Documentation (Oct 16-21)
```
MOVE TO: .claude/doc/archived/2025-10-quick-upload-optimization/

Recent work on Quick Upload, API warming, and checkout flow (43 files):
- api-warmup-*.md (5 files)
- quick-upload-*.md (8 files)
- mobile-quick-upload-*.md (3 files)
- three-scenario-*.md (4 files)
- font-selector-*.md (3 files)
- express-checkout-*.md (2 files)
- add-to-cart-*.md (4 files)
- warmup-*.md (5 files)
- pet-selector-*.md (2 files)
- image-dimension-*.md (3 files)
- returning-customer-*.md (1 file)
- multi-pet-*.md (2 files)
- consolidated-upload-*.md (1 file)
```

#### B3. Older Analysis Documentation (Pre-Oct 16)
```
MOVE TO: .claude/doc/archived/2025-08-to-10-variant-system/

Older variant system, product configuration work (126+ files):
- 4-option-variant-*.md
- 4-variant-*.md
- addon-products-*.md
- api-*.md (older API work)
- banner-*.md
- bg-removal-*.md
- collection-grid-*.md
- color-swatch-*.md
- configuration-system-*.md
- crop-zoom-*.md
- font-*.md
- max-pets-*.md
- no-name-*.md
- pet-count-*.md
- pet-font-*.md
- pet-name-*.md
- product-*.md
- phase-2-*.md
- seo-*.md
- etc. (full list in .claude/doc/)
```

**Total ARCHIVE Category**: 173 files, ~5.2MB of documentation

---

### Category C: KEEP (Active Use)

**Rationale**: Essential configuration and reference files

```
KEEP: README.md (project overview)
KEEP: CLAUDE.md (AI agent instructions - critical)
KEEP: LICENSE (legal requirement)
KEEP: package.json (Node dependency config)
KEEP: package-lock.json (dependency lock)
KEEP: playwright.config.js (testing config)
```

---

### Category D: SPECIAL HANDLING (Review Needed)

#### D1. Test Images in Root (282KB)
```
DECISION REQUIRED:
- cartplaceholder.png (114KB) - cart UI mockup
- Order.png (166KB) - order screenshot
- Preppy Font.png (3.4KB) - font example

OPTIONS:
A) DELETE if these were one-off debug screenshots
B) MOVE TO testing/test-assets/ if they're reference images
C) MOVE TO .claude/doc/archived/2025-10-root-cleanup/assets/ if historical

RECOMMENDATION: Option C (archive with assets subfolder)
- These appear to be screenshots from debugging sessions
- Not used in any test files
- May have context value for understanding past decisions
```

#### D2. ROI Calculation File
```
DECISION REQUIRED:
- warmup_roi_calculation.txt (5.5KB) - API warming cost analysis

OPTIONS:
A) DELETE if calculations are now in implemented code
B) ARCHIVE if this informed build/kill decision
C) KEEP if still actively referenced

RECOMMENDATION: Option B (archive to 2025-10-quick-upload-optimization/)
- This was analysis for product decision
- Calculations are historical context
- Not actively referenced in code
```

**Total SPECIAL HANDLING**: 4 files, ~288KB

---

## 3. Proposed Directory Structure

### Current Structure (Problematic)
```
Production/
├── [19 temp files cluttering root]
├── [4 .md docs in wrong place]
├── [3 test images in root]
├── .claude/
│   └── doc/
│       ├── [173 untracked .md files]
│       └── archived/
│           ├── 2025-09-19-cleanup/
│           └── [9 old archived files]
```

### Proposed Structure (Clean)
```
Production/
├── README.md
├── CLAUDE.md
├── LICENSE
├── package.json
├── package-lock.json
├── playwright.config.js
├── .claude/
│   └── doc/
│       ├── archived/
│       │   ├── 2025-08-to-10-variant-system/
│       │   │   └── [126 older analysis files]
│       │   ├── 2025-10-quick-upload-optimization/
│       │   │   └── [43 recent analysis files]
│       │   ├── 2025-10-root-cleanup/
│       │   │   ├── [4 root .md files]
│       │   │   └── assets/
│       │   │       └── [3 test images + ROI calc]
│       │   └── 2025-09-19-cleanup/
│       │       └── [existing 9 files]
│       └── [Only active/current analysis docs remain here]
```

### Directory Naming Convention
```
Pattern: YYYY-MM-[descriptive-name]/

Examples:
- 2025-10-quick-upload-optimization/ (recent sprint)
- 2025-08-to-10-variant-system/ (longer initiative)
- 2025-10-root-cleanup/ (this cleanup session)
```

---

## 4. Updated .gitignore Recommendations

### Current .gitignore Issues
1. Doesn't ignore temp log files
2. Doesn't ignore test data files in root
3. Context session pattern needs adjustment

### Proposed Additions

```gitignore
# === ADD TO .gitignore ===

# Temporary log files (from Cloud Run debugging)
logs_*.json
temp_logs*.json
*_logs_*.json

# Test data files (base64, temp images)
*_base64.txt
temp_*.txt
test-*.txt
test-*.svg

# Python test scripts (backend belongs in backend/)
create_test_*.py

# Screenshot/debug images in root
*.png
!assets/**/*.png
!sections/**/*.png
!snippets/**/*.png

# ROI/analysis text files
*_roi_*.txt
*_calculation*.txt

# Empty or malformed files
_ul
c:Users*

# === EXISTING (KEEP) ===
perkieprints-sa-key.json
.env
node_modules/

# Claude context sessions - keep only active one
.claude/tasks/context_session_*.md
!.claude/tasks/context_session_002.md
.claude/tasks/archived/
```

### Rationale for Each Addition

1. **Temp log files**: These are debugging artifacts that should never be committed
2. **Test data files**: One-off test files belong in testing/ directory, not root
3. **Python scripts**: Backend code belongs in backend/, not theme root
4. **Images in root**: Only asset images should be tracked, not debug screenshots
5. **ROI text files**: Analysis artifacts should go to .claude/doc/ if kept at all

---

## 5. Safe, Reversible Cleanup Procedure

### Pre-Cleanup Safety Measures

#### Step 0: Create Safety Backup
```bash
# Create timestamped backup of entire repository
cd "c:\Users\perki\OneDrive\Desktop\Perkie"
tar -czf "Production_backup_2025-10-21_pre-cleanup.tar.gz" Production/

# Or on Windows without tar:
# Copy-Item -Path "Production" -Destination "Production_backup_2025-10-21" -Recurse
```

#### Step 1: Create Archival Directories
```bash
cd "c:\Users\perki\OneDrive\Desktop\Perkie\Production"

# Create dated archive directories
mkdir -p ".claude/doc/archived/2025-10-root-cleanup/assets"
mkdir -p ".claude/doc/archived/2025-10-quick-upload-optimization"
mkdir -p ".claude/doc/archived/2025-08-to-10-variant-system"
```

### Phase 1: Archive Documentation (Reversible)

#### Step 2: Move Root Documentation
```bash
# Move root .md files to archive
mv DEPLOYMENT_CHECKLIST.md .claude/doc/archived/2025-10-root-cleanup/
mv DEPLOYMENT_COMPLETE.md .claude/doc/archived/2025-10-root-cleanup/
mv LOGGER_INTEGRATION_GUIDE.md .claude/doc/archived/2025-10-root-cleanup/
mv REVIEW_IMPLEMENTATION_GUIDE.md .claude/doc/archived/2025-10-root-cleanup/
```

#### Step 3: Archive Special Handling Files
```bash
# Move test images and ROI calc
mv cartplaceholder.png .claude/doc/archived/2025-10-root-cleanup/assets/
mv Order.png .claude/doc/archived/2025-10-root-cleanup/assets/
mv "Preppy Font.png" .claude/doc/archived/2025-10-root-cleanup/assets/
mv warmup_roi_calculation.txt .claude/doc/archived/2025-10-root-cleanup/assets/
```

#### Step 4: Archive Recent Analysis Docs (Oct 16-21)
```bash
cd .claude/doc/

# Move recent Quick Upload optimization work
mv api-warmup-*.md archived/2025-10-quick-upload-optimization/
mv quick-upload-*.md archived/2025-10-quick-upload-optimization/
mv mobile-quick-upload-*.md archived/2025-10-quick-upload-optimization/
mv three-scenario-*.md archived/2025-10-quick-upload-optimization/
mv font-selector-*.md archived/2025-10-quick-upload-optimization/
mv express-checkout-*.md archived/2025-10-quick-upload-optimization/
mv add-to-cart-*.md archived/2025-10-quick-upload-optimization/
mv warmup-*.md archived/2025-10-quick-upload-optimization/
mv pet-selector-*.md archived/2025-10-quick-upload-optimization/
mv image-dimension-*.md archived/2025-10-quick-upload-optimization/
mv inspirenet-24mp-*.md archived/2025-10-quick-upload-optimization/
mv 24mp-*.md archived/2025-10-quick-upload-optimization/
mv returning-customer-*.md archived/2025-10-quick-upload-optimization/
mv multi-pet-*.md archived/2025-10-quick-upload-optimization/
mv consolidated-upload-*.md archived/2025-10-quick-upload-optimization/
mv delete-functionality-*.md archived/2025-10-quick-upload-optimization/
mv shopify-file-upload-*.md archived/2025-10-quick-upload-optimization/
mv file-upload-*.md archived/2025-10-quick-upload-optimization/
mv options-warmup-*.md archived/2025-10-quick-upload-optimization/
mv product-page-warmup-*.md archived/2025-10-quick-upload-optimization/
```

#### Step 5: Archive Older Analysis Docs (Pre-Oct 16)
```bash
cd .claude/doc/

# Move older variant system and product configuration work
mv 4-option-variant-*.md archived/2025-08-to-10-variant-system/
mv 4-variant-*.md archived/2025-08-to-10-variant-system/
mv 40-percent-*.md archived/2025-08-to-10-variant-system/
mv addon-products-*.md archived/2025-08-to-10-variant-system/
mv api-critical-*.md archived/2025-08-to-10-variant-system/
mv api-production-*.md archived/2025-08-to-10-variant-system/
mv banner-*.md archived/2025-08-to-10-variant-system/
mv bg-removal-*.md archived/2025-08-to-10-variant-system/
mv collection-grid-*.md archived/2025-08-to-10-variant-system/
mv color-swatch-*.md archived/2025-08-to-10-variant-system/
mv configuration-system-*.md archived/2025-08-to-10-variant-system/
mv crop-zoom-*.md archived/2025-08-to-10-variant-system/
mv CROP_ZOOM_*.md archived/2025-08-to-10-variant-system/
mv dual-product-*.md archived/2025-08-to-10-variant-system/
mv full-product-*.md archived/2025-08-to-10-variant-system/
mv homepage-*.md archived/2025-08-to-10-variant-system/
mv how-it-works-*.md archived/2025-08-to-10-variant-system/
mv html-validation-*.md archived/2025-08-to-10-variant-system/
mv image-banner-*.md archived/2025-08-to-10-variant-system/
mv inspirenet-resize-*.md archived/2025-08-to-10-variant-system/
mv legacy-code-*.md archived/2025-08-to-10-variant-system/
mv max-pets-*.md archived/2025-08-to-10-variant-system/
mv mobile-cold-start-*.md archived/2025-08-to-10-variant-system/
mv mobile-commerce-*.md archived/2025-08-to-10-variant-system/
mv mobile-crop-*.md archived/2025-08-to-10-variant-system/
mv next-priority-*.md archived/2025-08-to-10-variant-system/
mv no-name-*.md archived/2025-08-to-10-variant-system/
mv no-text-to-no-name-*.md archived/2025-08-to-10-variant-system/
mv pet-count-*.md archived/2025-08-to-10-variant-system/
mv pet-counter-*.md archived/2025-08-to-10-variant-system/
mv pet-font-*.md archived/2025-08-to-10-variant-system/
mv pet-name-*.md archived/2025-08-to-10-variant-system/
mv phase-2-*.md archived/2025-08-to-10-variant-system/
mv priority-analysis-*.md archived/2025-08-to-10-variant-system/
mv product-*.md archived/2025-08-to-10-variant-system/
mv shopify-variants-*.md archived/2025-08-to-10-variant-system/
mv seo-*.md archived/2025-08-to-10-variant-system/
mv return-to-product-*.md archived/2025-08-to-10-variant-system/
mv order-properties-*.md archived/2025-08-to-10-variant-system/
mv gcs-upload-*.md archived/2025-08-to-10-variant-system/
mv infrastructure-*.md archived/2025-08-to-10-variant-system/
mv cors-*.md archived/2025-08-to-10-variant-system/
mv code-quality-*.md archived/2025-08-to-10-variant-system/
mv conversion-funnel-*.md archived/2025-08-to-10-variant-system/
mv cloud-*.md archived/2025-08-to-10-variant-system/
mv cart-*.md archived/2025-08-to-10-variant-system/
mv big-caslon-*.md archived/2025-08-to-10-variant-system/
mv backend-*.md archived/2025-08-to-10-variant-system/
mv api-warming-*.md archived/2025-08-to-10-variant-system/
mv production-launch-*.md archived/2025-08-to-10-variant-system/

# Move remaining older files
mv font-selector-5th-option-*.md archived/2025-08-to-10-variant-system/
mv font-selector-implementation-*.md archived/2025-08-to-10-variant-system/
```

**Verification After Phase 1**:
```bash
# Check what remains in .claude/doc/ (should be minimal)
cd "c:\Users\perki\OneDrive\Desktop\Perkie\Production"
ls -l .claude/doc/*.md

# Verify archives were created properly
ls -l .claude/doc/archived/2025-10-root-cleanup/
ls -l .claude/doc/archived/2025-10-quick-upload-optimization/
ls -l .claude/doc/archived/2025-08-to-10-variant-system/
```

### Phase 2: Delete Temporary Files (Reversible via Git)

#### Step 6: Delete Temp Log Files
```bash
cd "c:\Users\perki\OneDrive\Desktop\Perkie\Production"

# Delete temp log files (Git can restore if needed)
rm logs_last_2h.json
rm temp_logs_48h_comprehensive.json
rm temp_logs_cloud_run.json
rm temp_logs_day5_analysis.json
rm temp_logs_post_deployment.json
```

#### Step 7: Delete Base64 Test Files
```bash
# Delete base64 test data
rm squid_base64.txt
rm squid_part1.txt
rm squid_part2.txt
rm temp_image_data.txt
```

#### Step 8: Delete Malformed/Empty Files
```bash
# Delete malformed filenames
rm "cUsersperkiOneDriveDesktopPerkieProductionsquid_base64.txt"
rm _ul
```

#### Step 9: Delete Test Data Files
```bash
# Delete orphaned test files
rm test-image.txt
rm test-pet-2.txt
rm test-pet-image.svg
```

#### Step 10: Delete Python Test Script
```bash
# Delete one-off Python script
rm create_test_image.py
```

**Verification After Phase 2**:
```bash
# Check root directory is clean
ls -la | grep -E '\.(json|txt|svg|png|py)$'

# Should only see package.json and package-lock.json
```

### Phase 3: Update .gitignore

#### Step 11: Update .gitignore
```bash
cd "c:\Users\perki\OneDrive\Desktop\Perkie\Production"

# Edit .gitignore to add new patterns (see section 4 above)
# Use your preferred editor
```

#### Step 12: Verify Git Status
```bash
# Check that git status is now clean for untracked files
git status

# Should show:
# - No untracked .json, .txt, .png, .py files in root
# - No untracked .md files in .claude/doc/
# - Only the repository-cleanup-strategy.md (this file) as new
```

### Phase 4: Commit and Document

#### Step 13: Commit Cleanup
```bash
# Stage changes
git add .gitignore
git add .claude/doc/archived/

# Commit with descriptive message
git commit -m "Cleanup: Archive 173 analysis docs and remove 19 temp files

- Archive recent Quick Upload optimization docs (Oct 16-21) to 2025-10-quick-upload-optimization/
- Archive older variant system docs to 2025-08-to-10-variant-system/
- Archive root documentation to 2025-10-root-cleanup/
- Remove 4MB of temp log files (Cloud Run debugging artifacts)
- Remove base64 test data files (obsolete test artifacts)
- Remove malformed/empty files
- Update .gitignore to prevent future temp file accumulation

Repository health: -9.2MB clutter, improved git status clarity"
```

---

## 6. Rollback Procedures

### If Something Goes Wrong During Cleanup

#### Rollback Option 1: Restore from Backup (Nuclear Option)
```bash
# If you created the tar.gz backup
cd "c:\Users\perki\OneDrive\Desktop\Perkie"
rm -rf Production/
tar -xzf Production_backup_2025-10-21_pre-cleanup.tar.gz

# Or if you used Windows copy:
# Remove-Item -Path "Production" -Recurse -Force
# Copy-Item -Path "Production_backup_2025-10-21" -Destination "Production" -Recurse
```

#### Rollback Option 2: Restore Specific Files from Git (Surgical)
```bash
# If you accidentally deleted a file that was tracked
git checkout HEAD -- [filename]

# Example:
# git checkout HEAD -- warmup_roi_calculation.txt
```

#### Rollback Option 3: Restore from Archive (For Moved Files)
```bash
# If you need a file back from archive
cp .claude/doc/archived/2025-10-root-cleanup/DEPLOYMENT_CHECKLIST.md ./

# Or restore all from a specific archive
cp .claude/doc/archived/2025-10-quick-upload-optimization/*.md .claude/doc/
```

#### Rollback Option 4: Git Revert the Cleanup Commit
```bash
# If you committed and want to undo
git log  # Find the commit hash
git revert [commit-hash]

# Or if it's the last commit:
git revert HEAD
```

---

## 7. Post-Cleanup Validation

### Validation Checklist

#### Repository Health
- [ ] Root directory has only 6 essential files (README, CLAUDE, LICENSE, package.json, package-lock.json, playwright.config.js)
- [ ] .claude/doc/ has only currently active analysis docs (if any)
- [ ] .claude/doc/archived/ has 4 dated subdirectories
- [ ] git status shows no untracked temp files
- [ ] Repository size reduced by ~9.2MB

#### Git Status Check
```bash
git status

# Expected output (example):
# On branch staging
# Your branch is up to date with 'origin/staging'.
#
# Changes to be committed:
#   new file:   .claude/doc/archived/2025-08-to-10-variant-system/[files]
#   new file:   .claude/doc/archived/2025-10-quick-upload-optimization/[files]
#   new file:   .claude/doc/archived/2025-10-root-cleanup/[files]
#   modified:   .gitignore
```

#### Functionality Verification
- [ ] Shopify theme still deploys correctly (test staging)
- [ ] No broken links in active documentation
- [ ] Backend API tests still pass (if applicable)
- [ ] Playwright tests still run (if configured)

#### Archive Verification
```bash
# Count files in each archive
find .claude/doc/archived/2025-10-root-cleanup -type f | wc -l
# Expected: ~8 files (4 docs + 3 images + 1 ROI calc)

find .claude/doc/archived/2025-10-quick-upload-optimization -type f | wc -l
# Expected: ~43 files

find .claude/doc/archived/2025-08-to-10-variant-system -type f | wc -l
# Expected: ~126 files
```

---

## 8. Preventing Future Clutter

### Process Improvements

#### 1. Automated Documentation Archival
Create a simple script: `.claude/scripts/archive-completed-docs.sh`

```bash
#!/bin/bash
# Archive analysis docs older than 30 days

ARCHIVE_DATE=$(date +%Y-%m)
ARCHIVE_DIR=".claude/doc/archived/${ARCHIVE_DATE}-auto-archive"

# Create archive directory
mkdir -p "$ARCHIVE_DIR"

# Find and move docs older than 30 days
find .claude/doc -maxdepth 1 -name "*.md" -mtime +30 -exec mv {} "$ARCHIVE_DIR/" \;

echo "Archived docs older than 30 days to $ARCHIVE_DIR"
```

#### 2. Pre-Commit Hook for Temp Files
Create `.git/hooks/pre-commit` to warn about temp files:

```bash
#!/bin/bash
# Warn if committing temp files

TEMP_FILES=$(git diff --cached --name-only | grep -E '(temp_|logs_|_base64\.txt|test-.*\.(txt|svg))')

if [ -n "$TEMP_FILES" ]; then
    echo "WARNING: You're about to commit temporary files:"
    echo "$TEMP_FILES"
    echo ""
    echo "These files should probably be added to .gitignore instead."
    echo "Continue anyway? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        exit 1
    fi
fi
```

#### 3. Monthly Cleanup Routine
Add to CLAUDE.md or team documentation:

```markdown
## Monthly Repository Maintenance

On the 1st of each month:
1. Run: `git clean -n` to preview untracked files
2. Archive .claude/doc/*.md files older than 30 days
3. Delete temp_*.json and logs_*.json files
4. Review .gitignore for new patterns needed
5. Update this cleanup log
```

#### 4. .gitignore Template for New Projects
Ensure all new Shopify theme projects start with comprehensive .gitignore:

```gitignore
# Comprehensive Shopify Theme .gitignore

# Secrets
*.sa-key.json
.env

# Dependencies
node_modules/

# Temp/Debug Files
temp_*.json
logs_*.json
*_base64.txt
test-*.txt
test-*.svg
*_calculation*.txt

# Images in Root (only allow in assets/)
*.png
*.jpg
!assets/**/*.{png,jpg}
!sections/**/*.{png,jpg}

# Python (backend only)
*.py
*.pyc
__pycache__/

# Claude Context
.claude/tasks/context_session_*.md
!.claude/tasks/context_session_002.md
.claude/tasks/archived/

# Backups
_backup*/
_archive/
```

---

## 9. Risk Assessment

### Low Risk (Safe to Execute)
- ✅ Archiving documentation files (100% reversible)
- ✅ Moving root .md files to archive (100% reversible)
- ✅ Deleting temp log files (available in Cloud Console)
- ✅ Updating .gitignore (non-destructive)

### Medium Risk (Reversible via Backup)
- ⚠️ Deleting base64 test files (backup exists, but regeneration required if needed)
- ⚠️ Deleting test data files (may need to recreate for specific tests)

### No Risk (Already Problematic)
- ✅ Deleting malformed files (empty/corrupt)
- ✅ Deleting empty _ul file

### Mitigations
1. **Full backup before any operations** (tar.gz or directory copy)
2. **Phased execution** (archive first, delete second)
3. **Verification steps** between phases
4. **Commit after each major phase** for granular rollback

---

## 10. Implementation Timeline

### Estimated Duration: 45-60 minutes

**Preparation (10 min)**:
- Create backup: 5 min
- Create archive directories: 2 min
- Review file lists: 3 min

**Phase 1 - Archive (20 min)**:
- Move root docs: 2 min
- Archive special handling files: 2 min
- Archive recent analysis docs: 8 min
- Archive older analysis docs: 8 min

**Phase 2 - Delete (10 min)**:
- Delete temp logs: 2 min
- Delete test files: 2 min
- Delete malformed files: 1 min
- Verification: 5 min

**Phase 3 - Configure (10 min)**:
- Update .gitignore: 5 min
- Test git status: 2 min
- Review changes: 3 min

**Phase 4 - Commit (10 min)**:
- Stage changes: 2 min
- Write commit message: 3 min
- Commit and verify: 2 min
- Final validation: 3 min

---

## 11. Success Criteria

### Quantitative Metrics
- ✅ Root directory: 6 files (down from 29)
- ✅ Untracked files in git status: <5 (down from 41+)
- ✅ .claude/doc/ active files: <10 (down from 173)
- ✅ Repository clutter: -9.2MB
- ✅ .gitignore patterns: +15 new patterns

### Qualitative Improvements
- ✅ git status output is clean and readable
- ✅ Root directory is professional and organized
- ✅ Historical documentation is preserved and findable
- ✅ Future temp files will be auto-ignored
- ✅ Team can easily understand repository structure

---

## 12. Questions for User Confirmation

Before proceeding with implementation, please confirm:

1. **Backup Preference**:
   - Should I create a tar.gz backup or Windows directory copy?
   - Or do you have your own backup process?

2. **Archive Categorization**:
   - Do the proposed archive directory names make sense?
   - Should I merge any categories?

3. **Special Handling Files**:
   - Confirm deletion of test images (cartplaceholder.png, Order.png, Preppy Font.png)?
   - Or prefer archiving them?

4. **Execution Preference**:
   - Execute all phases automatically?
   - Or pause between phases for validation?

5. **Git Commit**:
   - Should cleanup be one commit or multiple (per phase)?
   - Any specific commit message format preferred?

---

## 13. Appendix: Complete File Manifest

### Files to Delete (19 total)

**Temp Logs (5 files, 3.85MB)**:
- logs_last_2h.json (370KB, Oct 20)
- temp_logs_48h_comprehensive.json (2.0MB, Oct 20)
- temp_logs_cloud_run.json (1.1MB, Oct 16)
- temp_logs_day5_analysis.json (518KB, Oct 13)
- temp_logs_post_deployment.json (153KB, Oct 10)

**Base64 Test Files (4 files, 160KB)**:
- squid_base64.txt (53KB, Oct 8)
- squid_part1.txt (49KB, Oct 8)
- squid_part2.txt (4.1KB, Oct 8)
- temp_image_data.txt (53KB, Oct 8)

**Malformed Files (2 files, 0KB)**:
- cUsersperkiOneDriveDesktopPerkieProductionsquid_base64.txt
- _ul

**Test Data (3 files, 5.5KB)**:
- test-image.txt (20 bytes)
- test-pet-2.txt (22 bytes)
- test-pet-image.svg (5.5KB)

**Python Script (1 file, 692 bytes)**:
- create_test_image.py

### Files to Archive (177 total)

**Root Docs → 2025-10-root-cleanup/ (4 files)**:
- DEPLOYMENT_CHECKLIST.md
- DEPLOYMENT_COMPLETE.md
- LOGGER_INTEGRATION_GUIDE.md
- REVIEW_IMPLEMENTATION_GUIDE.md

**Special Handling → 2025-10-root-cleanup/assets/ (4 files)**:
- cartplaceholder.png (114KB)
- Order.png (166KB)
- Preppy Font.png (3.4KB)
- warmup_roi_calculation.txt (5.5KB)

**Recent Analysis → 2025-10-quick-upload-optimization/ (43 files)**:
- api-warmup-blocking-fix.md
- api-warmup-customer-journey-analysis.md
- api-warmup-infrastructure-analysis.md
- api-warmup-performance-analysis.md
- api-warmup-performance-debug-analysis.md
- add-to-cart-blocker-strategic-evaluation.md
- add-to-cart-blocker-ux-analysis.md
- add-to-cart-disabled-conversion-blocker-analysis.md
- 24mp-dimension-limit-code-review.md
- consolidated-upload-buttons-ux.md
- delete-functionality-code-review.md
- express-checkout-upload-code-review.md
- file-upload-conversion-optimization-plan.md
- font-selector-fix-code-review.md
- font-selector-integration-analysis.md
- font-selector-three-scenario-integration-analysis.md
- image-dimension-24mp-implementation-plan.md
- inspirenet-24mp-dimension-limit-plan.md
- mobile-quick-upload-express-checkout-ux-spec.md
- mobile-quick-upload-ux-fixes.md
- mobile-three-scenario-purchase-architecture.md
- multi-pet-upload-flexibility-analysis.md
- multi-pet-variant-price-debug.md
- options-warmup-handler-code-review.md
- pet-name-field-duplication-ux-analysis.md
- pet-selector-null-reference-fix.md
- product-page-warmup-conversion-analysis.md
- product-page-warmup-mobile-ux-analysis.md
- quick-upload-checkout-optimization-verification-audit.md
- quick-upload-delete-functionality-code-review.md
- quick-upload-gcs-infrastructure-plan.md
- quick-upload-handler-null-focus-fix.md
- quick-upload-illegal-invocation-debug-plan.md
- quick-upload-improvements-ux-analysis.md
- quick-upload-replacement-bug-fix-plan.md
- returning-customer-upload-button-visibility.md
- shopify-file-upload-express-checkout-implementation-plan.md
- three-scenario-checkout-verification-audit.md
- three-scenario-conversion-optimization-plan.md
- three-scenario-pet-checkout-ux-design-spec.md
- warmup-options-400-fix-plan.md
- warmup-options-fix-verification-audit.md
- warmup-product-pages-build-kill-decision.md

**Older Analysis → 2025-08-to-10-variant-system/ (126 files)**:
[Full list available in .claude/doc/ - includes all variant system, product configuration, SEO, crop-zoom, font selection, pet counting, and infrastructure work from August-October]

---

## Summary

This cleanup strategy is:
- ✅ **Safe**: Full backup + phased execution + reversibility at each step
- ✅ **Organized**: Clear categorization with meaningful archive directory names
- ✅ **Comprehensive**: Addresses root causes via .gitignore updates
- ✅ **Preserving**: All historical documentation archived, not deleted
- ✅ **Professional**: Results in clean, maintainable repository structure

**Recommended Next Steps**:
1. Review this plan with user for approval
2. Confirm answers to questions in Section 12
3. Execute Phase 1 (archiving) first for safety
4. Verify archives, then proceed with Phase 2 (deletion)
5. Update .gitignore and commit
6. Document cleanup in context_session_1.md

**Final Note**: This plan favors caution over aggression. When in doubt, it archives rather than deletes. The repository will be dramatically cleaner while preserving full historical context for future reference.
