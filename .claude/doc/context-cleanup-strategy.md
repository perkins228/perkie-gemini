# Context Session Cleanup Strategy

## Executive Summary
The current context management system contains 1 active session (101KB, 2611 lines) spanning Oct 24-27 and 37 improperly named archives violating naming conventions. This cleanup will archive completed work, consolidate duplicates, properly rename files following `context_session_YYYY-MM-DD_description.md` format, and create a fresh, focused context_session_001.md containing only current system state and active work items.

---

## 1. Archive Plan for Current context_session_001.md

### Recommended Archive Filename
`context_session_2025-10-27_gemini-api-deployment-and-crop-research.md`

### Content to Archive (Lines 1-2300)
**Completed Work** (Oct 24-26):
- Dual API architecture establishment (lines 7-43)
- Gemini API bug fixes and deployment (lines 45-1563)
  - AttributeError fix
  - Cloud Storage permissions
  - CORS configuration
  - Environment variable fixes
- Prompt engineering evolution (lines 1565-1813)
  - Van Gogh style addition
  - White background updates
- B&W pipeline pivot decision (lines 1815-1950)
  - 0-byte file issue resolution
  - Move to InSPyReNet implementation

### Content to Retain in New 001 (Lines 1950-2611)
**Recent Active Research** (Oct 27):
- Face detection square crop technical analysis (lines 1872-1995)
  - Keep: Final recommendation and key findings
- Automatic vs manual crop conversion analysis (lines 1996-2611)
  - Keep: In-progress research with 36+ docs created

### Key Decisions to Preserve in New 001
1. **Architecture**: Dual API system (InSPyReNet for matting, Gemini for artistic)
2. **B&W Pipeline**: Moved to InSPyReNet `/api/v2/headshot` endpoint
3. **Cost Optimization**: Min-instances=0, $65-100/day savings
4. **Crop Strategy**: Geometric approach (2.0x multiplier) over face detection

---

## 2. Archive Cleanup Matrix

### Category A: Delete (Duplicates/Outdated)
| File | Reason |
|------|--------|
| `context_session_16082025.md` | Wrong date format, likely duplicate of 2025-08-16 |
| `context_session_1724345999000.md` | Timestamp format, no meaningful content |
| `context_session_1732276800.md` | Timestamp format, duplicate content |
| `context_session_17523579486291.md` | Invalid format, likely test file |
| `context_session_debug.md` | Generic name, outdated debug session |
| `context_session_current.md` | Outdated "current" from August |
| `context_session_001.md` (in archive) | Old 001 that should have been renamed |

### Category B: Consolidate & Rename
| Original Files | New Consolidated File | Content |
|----------------|----------------------|----------|
| `context_session_20250817.md`, `context_session_2025-08-17.md` | `context_session_2025-08-17_initial-implementation.md` | Merge duplicate Aug 17 sessions |
| `context_session_20250822.md`, `context_session_2025-08-22.md`, `context_session_22082025.md` | `context_session_2025-08-22_bug-fixes.md` | Merge Aug 22 triplicates |
| `context_session_20250823*.md` (5 files) | `context_session_2025-08-23_verification-testing.md` | Consolidate all Aug 23 work |
| `context_session_20250824*.md` (2 files) | `context_session_2025-08-24_deployment.md` | Merge Aug 24 sessions |

### Category C: Rename Only (Valuable Content)
| Current Name | New Name | Reason |
|--------------|----------|---------|
| `context_session_blob_url_fix.md` | `context_session_2025-08-16_blob-url-fix.md` | Important fix, needs date |
| `context_session_2025-08-21.md` | Keep as-is | Already correct format |
| `context_session_staging.md` | `context_session_2025-08-20_staging-deployment.md` | Deployment context |
| `context_session_default.md` | `context_session_2025-08-15_project-setup.md` | Initial setup context |
| `context_session_debug_multi_pet_storage.md` | `context_session_2025-08-19_multi-pet-storage-debug.md` | Specific debug work |
| `context_session_debug-specialist.md` | Delete | Agent name, no unique content |
| `context_session_deployment.md` | `context_session_2025-08-18_initial-deployment.md` | Early deployment work |

### Category D: Keep As-Is
- `context_session_2025-08-18.md` - Correct format
- `context_session_2025-08-20.md` - Correct format
- `context_session_2025-08-21.md` - Correct format
- `context_session_2025-08-23.md` - Correct format (keep best of Aug 23)

---

## 3. Fresh context_session_001.md Template

```markdown
# Context Session 001
## Date: 2025-10-27
## Current Focus: Pet Portrait Crop Optimization & Conversion Analysis

---

## System Architecture Status

### Production APIs
1. **InSPyReNet API** (perkieprints-com)
   - URL: https://inspirenet-bg-removal-api-725543555429.us-central1.run.app
   - Endpoints: /remove-background, /api/v2/process, /api/v2/headshot
   - Status: ✅ Production (GPU, min-instances=0 for cost control)

2. **Gemini Artistic API** (perkieprints-nanobanana)
   - URL: https://gemini-artistic-api-3km6z2qpyq-uc.a.run.app
   - Endpoints: /api/v1/generate, /api/v1/batch-generate
   - Styles: ink_wash (Modern), van_gogh (Classic)
   - Status: ✅ Production (Serverless)

### Key Architecture Decisions
- B&W processing moved to InSPyReNet (deterministic, cost-effective)
- Gemini handles artistic styles only (after 0-byte file issues)
- Min-instances=0 mandatory (saves $65-100/day)
- Cold starts acceptable (use frontend warming)

---

## Active Work Items

### 1. Crop Strategy Optimization (Oct 27)
**Current Implementation**: Geometric approach with 2.0x head height multiplier
**Status**: Researching conversion impact of manual vs automatic cropping

**Key Findings**:
- Face detection adds complexity without benefit (85-90% vs 60-75% success)
- Automatic cropping optimal for conversion (reduces friction)
- 4:5 portrait ratio matches 95% of products

**Related Documentation**:
- `.claude/doc/face-detection-square-crop-technical-analysis.md`
- `.claude/doc/automatic-vs-manual-crop-conversion-analysis.md`
- `.claude/doc/automatic-vs-manual-crop-product-strategy.md`
- `.claude/doc/automatic-vs-manual-crop-ux-analysis.md`

### 2. Next Priority Items
- [ ] Implement crop tightness refinements based on research
- [ ] Test conversion impact of current automatic system
- [ ] Monitor API performance and costs

---

## Recent Completed Work
- ✅ Gemini API deployment and bug fixes (Oct 24-26)
- ✅ B&W pipeline pivot to InSPyReNet (Oct 26)
- ✅ Face detection evaluation (Oct 27) - Decision: Keep geometric
- ✅ Crop automation research (Oct 27) - 36+ analysis docs created

---

## Quick References
- Emergency pet data cleanup: `window.emergencyCleanupPetData()`
- Staging branch auto-deploys to Shopify
- Testing: See /testing/*.html files
- NEVER set min-instances > 0 (cost control)

---

## Session History
- Previous: `archived/context_session_2025-10-27_gemini-api-deployment-and-crop-research.md`
- Created: 2025-10-27
- Focus: Active development post-Gemini deployment
```

---

## 4. Prevention Strategy

### Archive Triggers
1. **Size Threshold**: Archive when file exceeds 200KB (not 400KB - too large)
2. **Weekly Rollover**: Every Monday morning, archive previous week's work
3. **Major Milestone**: After completing major feature/deployment
4. **Context Switch**: When pivoting to unrelated work area

### Naming Convention Enforcement
```bash
# Correct format ONLY:
context_session_YYYY-MM-DD_description.md

# Description should be:
- 2-5 words maximum
- Lowercase with hyphens
- Descriptive of main work
- Examples: "api-deployment", "crop-research", "bug-fixes"
```

### .gitignore Updates Required
```gitignore
# Add to .gitignore
.claude/tasks/archived/
.claude/tasks/context_session_*.md
!.claude/tasks/context_session_001.md
!.claude/tasks/context_session_template.md
```

### Maintenance Schedule
1. **Daily**: Check session file size (auto-warning at 150KB)
2. **Weekly** (Mondays): Archive if >100KB or week old
3. **Monthly**: Review archive folder for consolidation opportunities
4. **Quarterly**: Deep clean - remove archives >6 months old

### Implementation Checklist
- [ ] Archive current 001 to `2025-10-27_gemini-api-deployment-and-crop-research.md`
- [ ] Delete 7 duplicate/invalid files
- [ ] Consolidate 15 files into 5 properly named archives
- [ ] Rename 7 valuable files with proper dates
- [ ] Create fresh context_session_001.md from template
- [ ] Update .gitignore to exclude archives
- [ ] Set up size monitoring (warning at 150KB)

---

## 5. Immediate Actions

### Step 1: Backup Current State
```bash
cp .claude/tasks/context_session_001.md .claude/tasks/context_session_001.backup
```

### Step 2: Archive Current Session
```bash
mv .claude/tasks/context_session_001.md \
   .claude/tasks/archived/context_session_2025-10-27_gemini-api-deployment-and-crop-research.md
```

### Step 3: Clean Archives (Run Consolidation Script)
```bash
# Delete duplicates
rm context_session_16082025.md
rm context_session_1724345999000.md
# ... (continue per matrix)
```

### Step 4: Create Fresh Session
```bash
cp .claude/tasks/context_session_template.md .claude/tasks/context_session_001.md
# Then populate with template content above
```

### Step 5: Verify Git Tracking
```bash
git add .claude/tasks/context_session_001.md
git rm --cached .claude/tasks/archived/*
```

---

## Expected Outcomes

### Before Cleanup
- 1 bloated active session (101KB, 2611 lines)
- 37 improperly named archives
- Difficult to find relevant context
- Git tracking unnecessary files

### After Cleanup
- 1 focused active session (~50-60 lines)
- 15-20 properly named archives
- Clear organization by date and topic
- Only active session in git
- 50% reduction in .claude/tasks/ folder size

### Success Metrics
- Active session <5KB initially
- Archive folder <500KB total
- All files follow naming convention
- No duplicate content
- Weekly archives happening consistently