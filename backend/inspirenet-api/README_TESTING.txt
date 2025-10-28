╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║             PERKIE PRINT HEADSHOT ENDPOINT - LOCAL TESTING                   ║
║                        Quick Reference Guide                                 ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

🎯 OBJECTIVE
Test the new /api/v2/headshot endpoint locally before production deployment.


📁 TESTING FILES CREATED

  ✓ test_headshot_local.py       - Comprehensive automated test suite
  ✓ test-headshot-manual.sh      - Quick single-image test (Mac/Linux)
  ✓ test-headshot-manual.bat     - Quick single-image test (Windows)
  ✓ TESTING_GUIDE.md             - Full testing documentation
  ✓ QUICK_START_TESTING.md       - 3-step quick start guide
  ✓ download-test-images.py      - Helper to download sample images


🚀 QUICK START (3 STEPS)

  1. START SERVER
     ─────────────
     cd backend/inspirenet-api
     python src/main.py
     
     Wait for: "Uvicorn running on http://0.0.0.0:8000"

  2. ADD TEST IMAGES
     ───────────────
     mkdir test_images
     # Copy 2-3 pet photos to test_images/
     # (Full-body photos work best for testing crop functionality)

  3. RUN TESTS
     ─────────
     # Option A: Full automated test
     python test_headshot_local.py

     # Option B: Quick manual test (Windows)
     test-headshot-manual.bat test_images\your-photo.jpg

     # Option C: Quick manual test (Mac/Linux)
     ./test-headshot-manual.sh test_images/your-photo.jpg


📊 WHAT GETS TESTED

  Automated Checks:
    ✓ API responds with HTTP 200
    ✓ Output is valid PNG with alpha channel
    ✓ Image is grayscale (B&W)
    ✓ Aspect ratio is 4:5 portrait
    ✓ Dimensions are reasonable (>800px)
    ✓ Neck fade effect is present

  Manual Checks (you verify visually):
    ✓ Tight headshot crop (NOT full body)
    ✓ Head fills 60-70% of frame
    ✓ Head in top third (Rule of Thirds)
    ✓ Professional B&W quality
    ✓ Transparent background
    ✓ Smooth neck fade


⏱️  EXPECTED PERFORMANCE

  First Request (Cold Start):  30-60 seconds (model loading)
  Subsequent Requests (Warm):  1-5 seconds (production-ready)


📂 OUTPUT LOCATION

  test_output/headshots/     - Automated test results
  test_output/manual/        - Manual test results


✅ SUCCESS CRITERIA

  Ready to deploy when:
    □ All automated checks pass (6/6)
    □ Visual inspection confirms quality
    □ Works with variety of test images
    □ Processing time acceptable (<5s warm)
    □ Output shows true headshot composition


🚀 NEXT STEPS AFTER LOCAL TESTING

  1. Review output images visually
  2. Deploy to Cloud Run
  3. Test production endpoint
  4. Implement frontend routing
  5. Monitor quality metrics


🆘 TROUBLESHOOTING

  Server won't start:
    → Check if port 8000 is in use
    → Kill existing process or use different port

  "Model not loaded" error:
    → Normal! First request takes 30-60s to load model
    → Wait for completion, subsequent requests will be fast

  Validation fails:
    → Check output images in test_output/
    → Review perkie_print_headshot.py parameters
    → See TESTING_GUIDE.md for detailed troubleshooting


📚 DOCUMENTATION

  Quick Start:       QUICK_START_TESTING.md (3-step guide)
  Full Guide:        TESTING_GUIDE.md (comprehensive docs)
  Implementation:    .claude/tasks/context_session_001.md
  Architecture:      .claude/doc/bw-headshot-pipeline-evaluation.md


💡 TIPS

  • Use full-body pet photos for testing (tests the cropping)
  • Try different breeds, poses, backgrounds
  • First request is slow - this is normal!
  • Check server logs if anything fails
  • Open output images to verify quality visually


═══════════════════════════════════════════════════════════════════════════════

                        Ready to start testing!
                     Run: python test_headshot_local.py

═══════════════════════════════════════════════════════════════════════════════
