const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { removeBackground } = require('@imgly/background-removal-node');
const { bucket } = require('./storage');
const path = require('path');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(cors());
app.use(express.json());

// Add supported MIME types
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
];

// Professional B&W processing preset
const BNW_PRESET = {
  denoise: 1,
  matteBlur: 0.5,
  linearBoost: {
    multiplier: 1.1,
    offset: -0.05
  },
  sharpen: {
    sigma: 1.0,
    gain: 1.0,
    threshold: 0.6
  },
  laplacianBoost: {
    blurRadius: 1.5,
    blendStrength: 0.3
  },
  vignette: 0.1,
  webp: {
    quality: 85,
    alphaQuality: 90,
    effort: 6
  },
  png: {
    compressionLevel: 9
  }
};

// Background removal methods
const BG_REMOVAL_METHODS = {
  ai: 'AI-based background removal using U2Net'
};

// Add Sharp-based edge detection function
async function applyEdgeDetection(imagePath) {
  try {
    console.log('Applying edge detection with Sharp...');
    
    // Read the image and convert to grayscale
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // Apply edge detection using Sharp's convolution
    const edgesPath = imagePath.replace('.png', '_edges.png');
    await image
      .grayscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [
          -1, -1, -1,
          -1,  8, -1,
          -1, -1, -1
        ]
      })
      .normalize()
      .toFile(edgesPath);
    
    console.log('Edge detection completed:', edgesPath);
    return edgesPath;
  } catch (error) {
    console.error('Error in edge detection:', error);
    throw error;
  }
}

// Update the processImage function
async function processImage(file) {
  try {
    console.log('Starting image processing for:', file.originalname);
    
    // Create a unique filename
    const uniqueId = uuidv4();
    const originalFilename = file.originalname;
    const fileExtension = path.extname(originalFilename);
    const baseFilename = path.basename(originalFilename, fileExtension);
    const newFilename = `${baseFilename}_${uniqueId}${fileExtension}`;
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Save the uploaded file
    const tempFilePath = path.join(tempDir, newFilename);
    fs.writeFileSync(tempFilePath, file.buffer);
    console.log('File saved to temp directory:', tempFilePath);
    
    // Process the image
    const processedImagePath = path.join(tempDir, `processed_${newFilename}`);
    
    // Apply U2Net background removal using @imgly/background-removal-node
    console.log('Applying U2Net background removal...');
    const bgRemovedPath = await removeBackground({
      path: tempFilePath,
      output: {
        path: processedImagePath,
        format: 'png'
      },
      model: 'u2net' // Explicitly specify U2Net model
    });
    console.log('Background removal completed:', bgRemovedPath);
    
    // Apply edge detection using Sharp
    console.log('Applying edge detection...');
    const edgesPath = await applyEdgeDetection(bgRemovedPath);
    console.log('Edge detection completed:', edgesPath);
    
    // Upload both processed images to GCS
    const [bgRemovedUrl, edgesUrl] = await Promise.all([
      uploadToGCS(bgRemovedPath, `processed/${newFilename}`),
      uploadToGCS(edgesPath, `edges/${newFilename}`)
    ]);
    
    // Clean up temp files
    fs.unlinkSync(tempFilePath);
    fs.unlinkSync(bgRemovedPath);
    fs.unlinkSync(edgesPath);
    
    return {
      originalUrl: await uploadToGCS(tempFilePath, `original/${newFilename}`),
      processedUrl: bgRemovedUrl,
      edgesUrl: edgesUrl
    };
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

app.post('/process-image', multer().single('image'), async (req, res) => {
    if (!req.file) {
    console.log('⚠️  No file was uploaded');
    return res.status(400).json({ error: 'No image uploaded' });
  }

  // Get preset from query parameters
  const preset = req.query.preset || 'classic';
  // Get effect from form data - default to 'color' to preserve color
  const effect = req.body.effect || 'color';

  if (!BNW_PRESET) {
    return res.status(400).json({
      error: 'Invalid preset',
      details: `Supported presets: ${Object.keys(BNW_PRESET).join(', ')}`,
      presets: BNW_PRESET
    });
  }

    console.log('📦  uploaded file:', {
      field: req.file.fieldname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    size: req.file.size,
    preset: preset,
    effect: effect
  });

  // Validate MIME type
  if (!SUPPORTED_MIME_TYPES.includes(req.file.mimetype)) {
    console.error('❌ Unsupported MIME type:', req.file.mimetype);
    return res.status(400).json({ 
      error: 'Unsupported file format',
      details: `File type ${req.file.mimetype} is not supported. Please upload a JPEG, PNG, WebP, or GIF image.`
    });
    }

  try {
    // 2. Attempt to convert the input buffer to PNG, fall back to JPEG on error
    let inputBuffer;
    let mimeType;
    try {
      console.log('🔄 Converting to PNG...');
      inputBuffer = await sharp(req.file.buffer).png().toBuffer();
      mimeType = 'image/png';
      console.log('✅ Successfully converted to PNG');
    } catch (err) {
      console.log('⚠️ PNG conversion failed, falling back to JPEG:', err.message);
      inputBuffer = await sharp(req.file.buffer).jpeg().toBuffer();
      mimeType = 'image/jpeg';
      console.log('✅ Successfully converted to JPEG');
    }

    // 3. Remove background using U2Net
    let noBgBuffer;
    try {
      console.log('🔄 Attempting background removal using U2Net...');
      const inputBlob = new Blob([inputBuffer], { type: mimeType });
      const noBgBlob = await removeBackground(inputBlob);
      noBgBuffer = Buffer.from(await noBgBlob.arrayBuffer());
      console.log('✅ Background removal successful');
    } catch (err) {
      console.error('❌ Background removal error:', err.message);
      if (err.message && err.message.includes('Unsupported format')) {
        console.log('🔄 Retrying with JPEG format...');
        const jpegBuffer = await sharp(req.file.buffer).jpeg().toBuffer();
        const jpegBlob = new Blob([jpegBuffer], { type: 'image/jpeg' });
        const noBgBlob = await removeBackground(jpegBlob);
        noBgBuffer = Buffer.from(await noBgBlob.arrayBuffer());
        console.log('✅ Background removal successful with JPEG');
      } else {
        throw err;
      }
    }

    // 4. Get original image dimensions
    const metadata = await sharp(noBgBuffer).metadata();
    console.log('📏 Image dimensions:', metadata.width, 'x', metadata.height);

    let finalBuffer;
    
    if (effect === 'blackwhite') {
      // 5. Apply professional B&W processing
      console.log('🔄 Applying B&W processing...');
      finalBuffer = await applyBlackWhiteProcessing(noBgBuffer, metadata);
    } else {
      // For all other effects (oil painting, line art, color), return the color image with background removed
      console.log(`🔄 Preserving color for effect: ${effect}`);
      finalBuffer = noBgBuffer;
    }

    // 10. Format & Delivery with fallback
    console.log('🔄 Optimizing for web...');
    let imageUrl = '';
    let formatUsed = '';
    try {
      const webpBuffer = await sharp(finalBuffer)
        .webp({
          quality: BNW_PRESET.webp.quality,
          alphaQuality: BNW_PRESET.webp.alphaQuality,
          effort: BNW_PRESET.webp.effort
        })
        .toBuffer();

      const webpFileName = `${uuidv4()}.webp`;
      const webpFile = bucket.file(webpFileName);
      await webpFile.save(webpBuffer, {
        metadata: {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable'
        },
        public: true,
        resumable: false
      });
      imageUrl = `https://storage.googleapis.com/${process.env.GC_BUCKET}/${webpFileName}`;
      formatUsed = 'webp';
      console.log('✅ WebP upload complete:', imageUrl);
    } catch (err) {
      console.warn('⚠️ WebP encoding/upload failed, falling back to PNG:', err.message);
      const pngBuffer = await sharp(finalBuffer)
        .png({
          compressionLevel: BNW_PRESET.png.compressionLevel
        })
        .toBuffer();
      const pngFileName = `${uuidv4()}.png`;
      const pngFile = bucket.file(pngFileName);
      await pngFile.save(pngBuffer, {
        metadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000, immutable'
        },
        public: true,
        resumable: false
      });
      imageUrl = `https://storage.googleapis.com/${process.env.GC_BUCKET}/${pngFileName}`;
      formatUsed = 'png';
      console.log('✅ PNG upload complete:', imageUrl);
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    res.json({
      success: true,
      imageUrl,
      format: formatUsed,
      message: 'Image processed successfully'
    });
  } catch (err) {
    // 7. Log the error and return the message in JSON
    console.error('❌ Processing error:', err);
    return res.status(500).json({ 
      error: err.message,
      details: 'An error occurred while processing the image. Please ensure the file is a valid image and try again.'
    });
  }
});

// Extract B&W processing into separate function
async function applyBlackWhiteProcessing(noBgBuffer, metadata) {
  // 1. Denoise
  console.log('🔄 Applying denoising...');
  const denoisedBuffer = await sharp(noBgBuffer)
    .median(BNW_PRESET.denoise)
    .toBuffer();

  // 2. Edge Matting (Refine Alpha)
  console.log('🔄 Refining edges...');
  const { data, info } = await sharp(denoisedBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Extract and blur alpha channel
  const alphaChannel = new Uint8Array(info.width * info.height);
  for (let i = 0; i < info.width * info.height; i++) {
    alphaChannel[i] = data[i * info.channels + 3];
  }

  const blurredAlpha = await sharp(alphaChannel, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 1
    }
  })
    .blur(BNW_PRESET.matteBlur)
    .toBuffer();

  // Composite with blurred alpha
  const mattedBuffer = await sharp(denoisedBuffer)
    .composite([{
      input: blurredAlpha,
      raw: {
        width: info.width,
        height: info.height,
        channels: 1
      },
      tile: false,
      blend: 'dest-in'
    }])
    .toBuffer();

  // 3. Convert to grayscale
  console.log('🔄 Converting to grayscale...');
  const grayBuffer = await sharp(mattedBuffer)
    .grayscale()
    .toBuffer();

  // 4. Fixed Gamma and Tonal Adjustment
  console.log('🔄 Applying fixed gamma...');
  const adaptedBuffer = await sharp(grayBuffer)
    .gamma(1.1)
    .modulate({
      brightness: 1.05,
      contrast: 1.05
    })
    .toBuffer();

  // 5. Local Contrast Enhancement (CLAHE approximation)
  console.log('🔄 Applying local contrast enhancement...');
  // Use unsharp mask as a local contrast boost (higher gain, lower sigma)
  const localContrastBuffer = await sharp(adaptedBuffer)
    .sharpen(0.5, 2.0, 0.5) // sigma=0.5, gain=2.0, threshold=0.5
    .toBuffer();

  // 6. Normalize (moved here, before detail enhancement)
  console.log('🔄 Normalizing...');
  const normalizedLocalBuffer = await sharp(localContrastBuffer)
    .normalize()
    .toBuffer();

  // 7. Detail Enhancement (Unsharp Mask)
  console.log('🔄 Enhancing details...');
  const sharpenedBuffer = await sharp(normalizedLocalBuffer)
    .sharpen(
      BNW_PRESET.sharpen.sigma,
      BNW_PRESET.sharpen.gain,
      BNW_PRESET.sharpen.threshold
    )
    .toBuffer();

  // Use sharpenedBuffer as the input for the next step
  const boostedBuffer = sharpenedBuffer;

  // 8. Vignette
  console.log('🔄 Adding vignette...');
  const vignetteBuffer = await sharp(boostedBuffer)
    .composite([{
      input: {
        create: {
          width: metadata.width,
          height: metadata.height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      },
      blend: 'multiply',
      gravity: 'center'
    }])
    .toBuffer();

  return vignetteBuffer;
}

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
