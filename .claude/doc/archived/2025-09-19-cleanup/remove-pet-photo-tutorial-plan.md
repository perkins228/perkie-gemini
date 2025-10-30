# Removal Plan: "How To Choose Your Image" Tutorial Page

## Executive Summary
Complete removal of the poorly-executed pet photo tutorial feature from the repository. This feature was created but had Shopify validation errors and the implementation did not meet quality standards.

## Business Objective
Remove all traces of the "How To Choose Your Image" tutorial page feature from the codebase to clean up the repository and eliminate validation errors.

## Files to Remove

### Primary Files (3 files)
These are the main implementation files that must be deleted:

1. **`templates/page.how-to-choose-your-image.json`**
   - Page template file
   - Contains section references and configuration
   
2. **`sections/pet-photo-tutorial-hero.liquid`**
   - Hero section with schema
   - Contains structured data and content blocks
   
3. **`sections/pet-photo-quick-tips.liquid`**
   - Mobile-optimized collapsible tips section
   - Contains accordion functionality and schema

### Documentation Files (3 files)
These documentation files are related to the feature and should also be removed:

1. **`.claude/doc/pet-photo-tutorial-seo-implementation-plan.md`**
   - SEO implementation plan for the tutorial
   
2. **`.claude/doc/mobile-first-pet-photo-tutorial-ux-design.md`**
   - UX design documentation for mobile-first approach
   
3. **`.claude/doc/pet-photography-tutorial-seo-plan.md`**
   - SEO planning documentation

## Implementation Plan

### Phase 1: Pre-Removal Verification
**Task 1.1**: Verify no external references
- Search for any links to `/pages/how-to-choose-your-image` in navigation or other pages
- Check if any products reference the tutorial page
- Verify no hardcoded links in theme settings

**Task 1.2**: Document current state
- Take note of any custom CSS or JavaScript that might have been added for these sections
- Record the commit hash before removal for potential recovery

### Phase 2: File Removal
**Task 2.1**: Remove primary implementation files
```bash
# Remove the three main files
git rm templates/page.how-to-choose-your-image.json
git rm sections/pet-photo-tutorial-hero.liquid
git rm sections/pet-photo-quick-tips.liquid
```

**Task 2.2**: Remove documentation files
```bash
# Remove related documentation
git rm .claude/doc/pet-photo-tutorial-seo-implementation-plan.md
git rm .claude/doc/mobile-first-pet-photo-tutorial-ux-design.md
git rm .claude/doc/pet-photography-tutorial-seo-plan.md
```

### Phase 3: Verification & Commit
**Task 3.1**: Verify clean removal
```bash
# Check git status to confirm all deletions are staged
git status

# Verify no remaining references
grep -r "how-to-choose-your-image" --exclude-dir=.git .
grep -r "pet-photo-tutorial" --exclude-dir=.git .
grep -r "pet-photo-quick-tips" --exclude-dir=.git .
```

**Task 3.2**: Commit the removal
```bash
# Commit with clear message
git commit -m "Remove 'How To Choose Your Image' tutorial page implementation

- Removed page template: page.how-to-choose-your-image.json
- Removed sections: pet-photo-tutorial-hero.liquid, pet-photo-quick-tips.liquid
- Removed related documentation files
- Feature had Shopify validation errors and poor implementation quality

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Task 3.3**: Push to staging
```bash
# Push changes to staging branch
git push origin staging
```

### Phase 4: Post-Removal Verification
**Task 4.1**: Verify Shopify staging
- Wait 1-2 minutes for GitHub auto-deployment
- Check Shopify admin for any orphaned page references
- Verify no broken links or 404 errors

**Task 4.2**: Update session context
- Update `.claude/tasks/context_session_001.md` with removal completion
- Note the removal reason and date

## Technical Considerations

### Potential Issues
1. **Orphaned Page in Shopify Admin**
   - The page might still exist in Shopify admin even after template removal
   - Manual deletion in Shopify admin may be required

2. **Cached References**
   - Browser cache might still show the page temporarily
   - CDN cache may need manual purging

3. **Navigation Links**
   - Any menu items pointing to this page will become broken
   - Need to verify main navigation and footer links

### Rollback Plan
If needed, the files can be recovered using:
```bash
# Find the commit before removal
git log --oneline -n 10

# Restore specific files from that commit
git checkout <commit-hash> -- templates/page.how-to-choose-your-image.json
git checkout <commit-hash> -- sections/pet-photo-tutorial-hero.liquid
git checkout <commit-hash> -- sections/pet-photo-quick-tips.liquid
```

## Success Metrics
- ✅ All 6 files successfully removed from repository
- ✅ No remaining references in codebase
- ✅ No Shopify validation errors related to these sections
- ✅ No broken links on staging site
- ✅ Clean git history with descriptive commit message

## Notes & Assumptions

### Key Assumptions
1. No other features depend on these sections
2. No customer-facing pages currently link to this tutorial
3. The feature was never deployed to production (only staging)
4. No SEO impact as page was never indexed

### Important Notes
- This removal is permanent but reversible through git history
- Documentation files are included in removal to maintain clean repository
- The feature concept could be reimplemented properly in the future if needed

## Summary
This plan removes 6 files total (3 implementation files, 3 documentation files) to completely eliminate the poorly-executed "How To Choose Your Image" tutorial feature. The removal process includes verification steps to ensure no broken references and maintains a clean git history for potential future recovery if needed.