# Local Testing Guide - Perkie Print Headshot Endpoint

## 🎯 Purpose

Test the new `/api/v2/headshot` endpoint locally before deploying to production.

## 📋 Prerequisites

1. **Python 3.11+** installed
2. **InSPyReNet API dependencies** installed
3. **Test pet images** (JPG/PNG format)

## 🚀 Quick Start

### Step 1: Start the Local Server

```bash
cd backend/inspirenet-api

# Install dependencies (if not already done)
pip install -r requirements.txt

# Start the API server
python src/main.py
```

The server will start on `http://localhost:8000`

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### Step 2: Prepare Test Images

```bash
# Create test images directory
mkdir test_images

# Add some pet photos to test_images/
# Recommended: 3-5 different pet photos with variety:
#   - Different breeds (dogs, cats)
#   - Different poses (sitting, standing, lying)
#   - Different photo quality (good, average)
#   - Different backgrounds (simple, complex)
```

**Good test images**:
- ✅ Full-body pet photos (sitting or standing)
- ✅ High resolution (2000x3000+ recommended)
- ✅ Clear subject (pet in focus)
- ✅ Various backgrounds (to test InSPyReNet matting)

**What to avoid**:
- ❌ Already-cropped headshots (can't test cropping)
- ❌ Very low resolution (<800px)
- ❌ Multiple pets (tests single subject detection)

### Step 3: Run the Test Script

```bash
# Install test dependencies
pip install requests pillow

# Run the test
python test_headshot_local.py
```

## 📊 What the Test Validates

The test script automatically checks:

### ✅ Functional Tests
1. **API Response**: HTTP 200 status code
2. **Processing Time**: <60s cold start, <5s warm
3. **Output Format**: Valid PNG file

### ✅ Quality Tests
1. **Transparency**: Has alpha channel (RGBA mode)
2. **B&W Conversion**: Grayscale (R=G=B)
3. **Aspect Ratio**: 4:5 portrait ratio (±5% tolerance)
4. **Dimensions**: Minimum 800px (reasonable size)
5. **Neck Fade**: Alpha variation in bottom 25%
6. **File Size**: Under 20MB (reasonable)

### ✅ Composition Tests
- Head positioned in top third (visual inspection required)
- 10% padding around subject (visual inspection required)
- Tight crop (no full body visible) (visual inspection required)

## 📁 Output

Test results are saved to:
```
test_output/headshots/
├── photo1_headshot.png
├── photo2_headshot.png
└── photo3_headshot.png
```

**Review these images** to verify:
- Professional headshot composition
- Head fills frame (60-70% of image)
- B&W quality looks good
- Transparent background
- Soft neck fade visible

## 🐛 Troubleshooting

### Server won't start
```bash
# Check if port 8000 is in use
lsof -i :8000  # Mac/Linux
netstat -ano | findstr :8000  # Windows

# Kill existing process or use different port
```

### "Model not loaded" error
```bash
# The first request will be slow (30-60s) as model loads
# Wait for model loading to complete
# Subsequent requests should be fast (<5s)
```

### Image validation fails
- **Alpha channel missing**: Check perkie_print_headshot.py returns BGRA
- **Not grayscale**: Check B&W conversion is applied
- **Wrong aspect ratio**: Check crop_to_headshot_framing() logic
- **No fade**: Check _compose_headshot() applies fade_mask

### Processing timeout
```bash
# Increase timeout in test script (line 148)
response = requests.post(API_URL, files=files, params=params, timeout=120)
#                                                             Change to 300 ↑
```

## 🎨 Visual Quality Inspection

After automated tests pass, **manually review** the output images:

### ✅ Good Headshot Signs
- Pet's head fills 60-70% of frame
- Eyes visible and sharp
- Head positioned in top third
- Natural-looking crop (neck/chest visible)
- Smooth fade at bottom (neck area)
- Professional B&W quality (not washed out or too dark)

### ❌ Issues to Watch For
- Head too small (still showing full body)
- Head cut off at top (crop too tight)
- Wrong aspect ratio (not portrait)
- Harsh crop (no fade transition)
- Poor B&W quality (too bright/dark)
- Subject off-center

## 📈 Expected Results

### First Request (Cold Start)
```
Processing time: 35-60s
Server processing time: 30-55s
✅ All validation checks passed
```

### Subsequent Requests (Warm)
```
Processing time: 2-5s
Server processing time: 1-4s
✅ All validation checks passed
```

## ✨ Success Criteria

**Ready to deploy when**:
- ✅ All automated tests pass (6/6 validation checks)
- ✅ Visual inspection confirms professional quality
- ✅ Processing time acceptable (<5s warm)
- ✅ Works with variety of test images

## 🚀 Next Steps After Local Testing

Once local tests pass:

1. **Deploy to Cloud Run**
   ```bash
   ./scripts/deploy-model-fix.sh
   ```

2. **Test production endpoint**
   ```bash
   curl -X POST https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/headshot \
     -F "file=@test_images/photo1.jpg" \
     --output production-test.png
   ```

3. **Compare local vs production output**
   - Should be identical
   - Production may be slightly faster (better hardware)

4. **Proceed to frontend integration**

## 📝 Test Checklist

Before deploying, verify:

- [ ] Local server starts successfully
- [ ] Test with 3+ different pet images
- [ ] All automated validation checks pass
- [ ] Visual inspection confirms quality
- [ ] Processing time acceptable
- [ ] No errors in server logs
- [ ] Output images look professional
- [ ] Headshot composition is correct (not full body)

---

## 🆘 Need Help?

**Common issues**:
- Model loading slow → Normal on first request (30-60s)
- Validation fails → Check output images in test_output/headshots/
- Server errors → Check backend/inspirenet-api/src/main.py logs

**Questions about implementation**:
- See: `.claude/tasks/context_session_001.md`
- See: `.claude/doc/bw-headshot-pipeline-evaluation.md`
