# Quick Start: Local Testing

## 🚀 3-Step Testing Process

### Step 1: Start the Server (2 minutes)

```bash
cd backend/inspirenet-api

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the API
python src/main.py
```

Wait for:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**✅ Server is ready when you see the Uvicorn message**

---

### Step 2: Add Test Images (1 minute)

```bash
# Create test directory
mkdir test_images

# Copy 2-3 pet photos into test_images/
# Examples:
#   test_images/golden_retriever.jpg
#   test_images/cat_sitting.jpg
#   test_images/dog_portrait.png
```

**Best test images**:
- Full-body pet photos (sitting/standing)
- High resolution (2000px+ width/height)
- Clear backgrounds (tests matting quality)

---

### Step 3: Run Tests (5 minutes)

**Option A: Quick Manual Test** (single image)

Windows:
```cmd
test-headshot-manual.bat test_images\your-pet-photo.jpg
```

Mac/Linux:
```bash
./test-headshot-manual.sh test_images/your-pet-photo.jpg
```

**Option B: Full Automated Test** (all images)

```bash
# Install test dependencies (first time only)
pip install requests pillow

# Run comprehensive test suite
python test_headshot_local.py
```

---

## 📊 What to Expect

### First Request (Cold Start)
- ⏱️ **Processing time**: 30-60 seconds
- 💭 **Why**: InSPyReNet model loading into GPU memory
- ✅ **Normal**: This is expected behavior

### Subsequent Requests (Warm)
- ⏱️ **Processing time**: 1-5 seconds
- 💭 **Why**: Model already loaded in memory
- ✅ **Production-ready**: Fast enough for customers

### Output Files
- 📁 **Location**: `test_output/headshots/` or `test_output/manual/`
- 📏 **Size**: ~2-8MB PNG files
- 🎨 **Format**: BGRA (B&W + alpha transparency)

---

## ✅ Success Criteria

**Automated checks** (test script validates):
- ✅ HTTP 200 response
- ✅ Valid PNG with alpha channel
- ✅ Grayscale (B&W) image
- ✅ 4:5 portrait aspect ratio
- ✅ Reasonable dimensions (800px+)
- ✅ Neck fade effect present

**Visual inspection** (you verify):
- ✅ Tight headshot crop (NOT full body)
- ✅ Head fills 60-70% of frame
- ✅ Head positioned in top third
- ✅ Professional B&W quality
- ✅ Transparent background
- ✅ Smooth fade at neck/shoulders

---

## 🎯 Quick Visual Check

Open the output image and ask:

1. **Is it a headshot?** (Head fills frame, not full body)
2. **Good crop?** (Head in top third, 10% padding around)
3. **Professional B&W?** (Good contrast, not washed out)
4. **Transparent background?** (Can see checker pattern in viewer)
5. **Smooth fade?** (Natural transition at neck/bottom)

If **YES to all 5** → ✅ **Ready to deploy!**

If **NO to any** → Check troubleshooting in TESTING_GUIDE.md

---

## 🐛 Quick Troubleshooting

**Server won't start**:
```bash
# Port 8000 already in use?
# Windows: netstat -ano | findstr :8000
# Mac/Linux: lsof -i :8000
# Kill the process or change port
```

**"Model not loaded" error**:
- ✅ **Normal**: Wait for first request to complete (30-60s)
- Model loads on-demand, not at startup

**Test script fails**:
```bash
# Check server logs for errors
# Common issues:
#   - Missing dependencies: pip install -r requirements.txt
#   - GPU not available: Will fall back to CPU (slower)
#   - Image too large: Resize to <4096x4096
```

**Output doesn't look right**:
- Check `backend/inspirenet-api/src/effects/perkie_print_headshot.py`
- Adjust parameters in `HEADSHOT_DEFAULTS` (lines 24-45)
- Common tweaks:
  - `contrast_boost`: Increase for more dramatic B&W
  - `eye_sharpness`: Increase for sharper eyes
  - `neck_fade_strength`: Adjust fade intensity

---

## 📈 Example Output

**Input**: 3000x4000 Golden Retriever sitting photo (full body)

**Output**: 1600x2000 BGRA headshot
- ✅ Tight crop on head/chest
- ✅ 4:5 portrait ratio
- ✅ Professional B&W
- ✅ Transparent background
- ✅ Soft fade at neck

**File size**: ~6MB (down from 12MB input)

---

## 🚀 Next Steps After Testing

Once local tests pass:

1. **Review** output images visually
2. **Deploy** to Cloud Run (see TESTING_GUIDE.md)
3. **Test** production endpoint
4. **Implement** frontend routing
5. **Monitor** quality metrics

---

## 📚 More Information

- **Full testing guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Implementation details**: `.claude/tasks/context_session_001.md`
- **Architecture decisions**: `.claude/doc/bw-headshot-pipeline-evaluation.md`

---

## ⚡ TL;DR

```bash
# 1. Start server
python src/main.py

# 2. Add test images to test_images/

# 3. Run quick test (Windows)
test-headshot-manual.bat test_images\pet.jpg

# OR run full suite
python test_headshot_local.py

# 4. Check output in test_output/
# 5. If good → Deploy!
```

🎉 **That's it!** The entire process takes ~10 minutes.
