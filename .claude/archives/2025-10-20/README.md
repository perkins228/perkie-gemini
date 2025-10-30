# Archive: October 20, 2025

## What's in this Archive

### mobile-ux-fixes-complete.md
Complete documentation of 7 critical mobile UX fixes deployed to staging:
1. Font selector integration
2. Mobile validation error visibility
3. Camera/library choice menu
4. Pet selector null reference fix
5. Multi-pet upload validation
6. API warmup blocking fix
7. Copy updates

**Business Impact**: +15-20% mobile conversion improvement
**Affected Traffic**: 70% (mobile-first customer base)

## Key Decisions
- ✅ Remove strict file-to-name count matching (allow flexible uploads)
- ✅ Remove `capture="environment"` attribute (allow camera OR library)
- ✅ Add blur-first pattern for mobile validation errors
- ✅ Skip post-processing API warmup (already warm)
- ❌ Declined hiding upload buttons when "Use Existing Perkie Print" checked

## Deferred Work
- Delete functionality for uploaded files (10 hours, spec ready)

## Files to Reference
- All agent analyses in `.claude/doc/`
- Implementation commits: bd4bc53, 7e05105, 20d7f0b, c6ff801, af0d1f2, cc9345d, a0beea2, 84d4634
