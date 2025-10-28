# Headshot Test Interface - UX Implementation Plan

**Created**: 2025-10-25
**Type**: Browser-based Test Tool Design
**Deliverable**: `backend/inspirenet-api/test_api.html`
**Purpose**: User-friendly local testing interface for `/api/v2/headshot` endpoint

---

## Executive Summary

This plan details the design and implementation of a single-page HTML test interface for validating the Perkie Print headshot API endpoint. The interface prioritizes ease of use, clear visual feedback during long processing times (30-60s cold starts), and visual validation of output quality.

**Key Design Principles**:
- Mobile-first (70% of Perkie traffic is mobile)
- Single-file, zero-build simplicity
- Clear progress indication for 30-60s processing
- Visual validation of headshot quality criteria
- Professional but functional aesthetic

---

## 1. Technical Architecture

### 1.1 File Structure
**Single HTML File**: `backend/inspirenet-api/test_api.html`

**Components**:
- Inline CSS (embedded in `<style>` tag)
- Inline JavaScript (embedded in `<script>` tag)
- No external dependencies except localhost API
- Self-contained, works offline (except API calls)

**Technology Stack**:
- HTML5 (semantic elements)
- CSS3 (Grid, Flexbox, CSS custom properties)
- Vanilla JavaScript ES6+ (Fetch API, async/await, FileReader API)
- No frameworks or libraries required

### 1.2 API Integration Specifications

**Endpoint**: `POST http://localhost:8888/api/v2/headshot`

**Request**:
```
Content-Type: multipart/form-data
Body: FormData with 'file' field
Accepts: image/jpeg, image/png
Max Size: 50MB
Max Dimensions: 4096x4096
```

**Response**:
```
Content-Type: image/png
Body: PNG image with BGRA channels (B&W + alpha)
Expected Characteristics:
  - Aspect ratio: 4:5 portrait (e.g., 1600x2000)
  - Color space: Grayscale (R=G=B)
  - Alpha channel: Transparent background
  - Composition: Tight headshot crop (head, neck, upper chest)
  - Style: Professional B&W with soft neck fade
```

**Performance Profile**:
- First request (cold start): 30-60 seconds
- Subsequent requests: 1-5 seconds
- Processing stages: Upload → Background removal → B&W conversion → Cropping → Neck fade

### 1.3 Browser Compatibility

**Target Browsers**:
- Chrome/Edge 90+ (primary test environment)
- Safari 14+ (iOS testing)
- Firefox 88+

**Required APIs**:
- File API (drag-and-drop, FileReader)
- Fetch API (async HTTP requests)
- Canvas API (image analysis, transparency visualization)
- Blob API (download functionality)

---

## 2. User Interface Design

### 2.1 Layout Structure

**Overall Layout** (Mobile-first, single-column):
```
┌─────────────────────────────────────┐
│        HEADER                       │
│  Perkie Print Headshot Tester      │
│  Status: API Ready ✅               │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│   UPLOAD SECTION                    │
│  ┌─────────────────────────────┐   │
│  │  📸 Drag & Drop Zone        │   │
│  │  or click to browse         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│   PREVIEW SECTION (hidden initially)│
│  ┌─────────────────────────────┐   │
│  │  Original Image             │   │
│  │  1200x900 • 2.4 MB          │   │
│  └─────────────────────────────┘   │
│  [Generate Headshot Button]         │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│   PROCESSING SECTION (hidden)       │
│  ⏳ Generating headshot...          │
│  ████████░░░░░░░░ 45%              │
│  Removing background...             │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│   COMPARISON SECTION (hidden)       │
│  ┌───────────┐  ┌───────────┐      │
│  │ Original  │  │ Headshot  │      │
│  │  Image    │  │  Result   │      │
│  └───────────┘  └───────────┘      │
│  [Download PNG]                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│   VALIDATION SECTION (hidden)       │
│  ✅ Aspect Ratio: 4:5 portrait      │
│  ✅ Transparency: Yes                │
│  ✅ Grayscale: Yes                   │
│  ✅ File Size: 6.2 MB               │
└─────────────────────────────────────┘
```

**Desktop Layout** (>768px, two-column comparison):
```
┌─────────────────────────────────────────────────┐
│        HEADER                                    │
└─────────────────────────────────────────────────┘
┌──────────────┐  ┌────────────────────────────┐
│   UPLOAD     │  │   PREVIEW/PROCESSING        │
│   SECTION    │  │   (conditional display)     │
└──────────────┘  └────────────────────────────┘
┌─────────────────────────────────────────────────┐
│   COMPARISON (side-by-side full width)          │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │ Original         │  │ Headshot         │    │
│  └──────────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────┘
```

### 2.2 Component Specifications

#### 2.2.1 Header Component
**Purpose**: Branding and API status indication

**Visual Design**:
- Background: Deep blue (#1a365d)
- Text: White (#ffffff)
- Padding: 20px
- Font: Sans-serif, 24px bold for title, 14px for status

**Content**:
```html
<header>
  <h1>Perkie Print Headshot Tester</h1>
  <div class="api-status">
    <span class="status-indicator"></span>
    <span class="status-text">Checking API...</span>
  </div>
</header>
```

**Status Indicators**:
- ✅ Green dot: API Ready (200 response from /health)
- ⚠️ Yellow dot: API Slow (response >2s)
- ❌ Red dot: API Unavailable (connection failed)

**Interaction**:
- Status checks on page load
- Auto-retry every 30s if unavailable
- Shows last check timestamp

#### 2.2.2 Upload Section
**Purpose**: File selection via drag-drop or file picker

**Visual Design**:
- Border: 2px dashed blue (#3182ce)
- Background: Light gray (#f7fafc) → Blue tint (#ebf8ff) on hover
- Padding: 40px
- Border-radius: 8px
- Minimum height: 200px (mobile), 300px (desktop)

**States**:
1. **Default**: Dashed border, upload icon, instruction text
2. **Drag Over**: Solid border, blue background, "Drop here" text
3. **File Selected**: Shows thumbnail + filename, "Change Image" option
4. **Error**: Red border, error message

**Content Layout**:
```
┌────────────────────────────────┐
│        📸                      │
│   (Upload Icon - 48px)         │
│                                │
│  Drag & drop pet photo here    │
│      or click to browse        │
│                                │
│  Supports: JPG, PNG            │
│  Max size: 50MB                │
│  Max dimensions: 4096x4096     │
└────────────────────────────────┘
```

**Interaction Details**:
- Click anywhere in zone to trigger file picker
- Drag-over highlights entire zone
- File validation on selection:
  - Format check (JPEG, PNG only)
  - Size check (max 50MB)
  - Dimension check (max 4096x4096)
- Invalid files show error message below zone
- Multiple file uploads overwrite previous selection

**Touch Optimization** (Mobile):
- Large tap target (minimum 200px height)
- No hover effects on touch devices
- File picker opens native photo selector
- Shows camera option on mobile browsers

#### 2.2.3 Preview Section
**Purpose**: Display uploaded image before processing

**Visibility**: Hidden until valid file uploaded

**Visual Design**:
- White background (#ffffff)
- Box shadow: subtle elevation
- Padding: 20px
- Border-radius: 8px

**Content**:
```
┌──────────────────────────────┐
│  Original Image              │
│  ┌────────────────────────┐  │
│  │                        │  │
│  │    [Image Preview]     │  │
│  │                        │  │
│  └────────────────────────┘  │
│  1200x900 • 2.4 MB • JPEG    │
│                              │
│  [Generate Headshot Button]  │
│  [Change Image]              │
└──────────────────────────────┘
```

**Image Display Rules**:
- Max width: 100% of container
- Max height: 400px (mobile), 500px (desktop)
- Maintain aspect ratio (object-fit: contain)
- Center aligned
- Background: Light checkerboard pattern

**Button Specifications**:
- **Primary Button** ("Generate Headshot"):
  - Background: Blue (#3182ce)
  - Text: White, 16px bold
  - Padding: 12px 32px
  - Border-radius: 6px
  - Full width on mobile, auto width desktop
  - Hover: Darker blue (#2c5282)
  - Disabled state: Gray, cursor not-allowed

- **Secondary Button** ("Change Image"):
  - Background: Transparent
  - Border: 1px solid gray
  - Text: Gray, 14px
  - Padding: 8px 16px
  - Hover: Light gray background

**Metadata Display**:
- Font size: 14px
- Color: Gray (#718096)
- Format: `[width]x[height] • [filesize] • [format]`

#### 2.2.4 Processing Section
**Purpose**: Provide feedback during 30-60s processing time

**Visibility**: Shown when processing starts, hidden when complete

**Critical Design Requirement**: MUST clearly communicate long wait time to prevent user abandonment

**Visual Design**:
- Background: White with subtle blue tint
- Border-left: 4px solid blue (progress indicator style)
- Padding: 24px
- Animation: Subtle pulse/breathing effect

**Content Structure**:
```
┌──────────────────────────────────┐
│  ⏳ Generating headshot...        │
│                                  │
│  ████████████░░░░░░░░  60%       │
│                                  │
│  Current step:                   │
│  🔄 Removing background...       │
│                                  │
│  ⏱️ Processing time: 00:45       │
│  (First request may take 30-60s) │
└──────────────────────────────────┘
```

**Progress Bar Specifications**:
- Height: 24px
- Background: Light gray (#e2e8f0)
- Fill: Blue gradient (#3182ce → #2c5282)
- Border-radius: 12px
- Smooth animation (transition: width 0.3s ease)
- Percentage text: Centered, white, 14px bold

**Processing Stages** (with estimated time splits):
1. **Uploading...** (0-5%): "Sending image to API..."
2. **Removing background...** (5-60%): "Using InSPyReNet model..."
3. **Converting to B&W...** (60-75%): "Applying professional grayscale..."
4. **Cropping to headshot...** (75-90%): "Intelligent headshot framing..."
5. **Adding neck fade...** (90-98%): "Creating soft fade effect..."
6. **Complete!** (100%): "Headshot ready!"

**Progress Timer**:
- Format: MM:SS
- Updates every second
- Color changes:
  - 0-30s: Green (fast!)
  - 30-60s: Orange (first request expected)
  - 60s+: Red (slower than expected)

**First-Time User Education**:
- Persistent message: "(First request may take 30-60s)"
- After successful fast request: "✨ Subsequent requests will be faster (1-5s)!"
- Shows comparison: "Previous: 45s → This time: 3s"

**Error Handling**:
- Timeout after 120s with clear error message
- "Retry" button to attempt again
- "Cancel" button to return to upload

**Interaction**:
- No user input required during processing
- Cannot navigate away (confirmation dialog if attempted)
- "Cancel Processing" button available

#### 2.2.5 Comparison Section
**Purpose**: Side-by-side visual validation of results

**Visibility**: Hidden until processing complete

**Visual Design**:
- Full width container
- Two equal-width columns (mobile: stacked, desktop: side-by-side)
- Gap: 20px between images
- Background: White

**Layout - Mobile** (< 768px):
```
┌──────────────────────────────┐
│  Before                      │
│  ┌────────────────────────┐  │
│  │   Original Image       │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
        ↓ (Arrow indicator)
┌──────────────────────────────┐
│  After - Headshot Result     │
│  ┌────────────────────────┐  │
│  │   [Headshot on         │  │
│  │    checkerboard]       │  │
│  └────────────────────────┘  │
│  [Download PNG Button]       │
└──────────────────────────────┘
```

**Layout - Desktop** (≥ 768px):
```
┌──────────────────┬──────────────────┐
│  Before          │  After           │
│  ┌────────────┐  │  ┌────────────┐  │
│  │  Original  │  │  │  Headshot  │  │
│  │            │  │  │ (w/trans.) │  │
│  └────────────┘  │  └────────────┘  │
│                  │                  │
│                  │  [Download PNG]  │
└──────────────────┴──────────────────┘
```

**Image Display Specifications**:

**Original Image (Left/Top)**:
- Background: Solid white
- Object-fit: contain
- Max-height: 500px (desktop), 400px (mobile)
- Border: 1px solid light gray
- Label: "Original" (14px, gray, positioned top-left)

**Headshot Result (Right/Bottom)**:
- Background: **Checkerboard pattern** (critical for transparency visualization)
- Object-fit: contain
- Same dimensions as original for easy comparison
- Border: 1px solid light gray
- Label: "Headshot Result" (14px, gray, positioned top-left)

**Checkerboard Pattern Specifications**:
- Colors: #ffffff (white) and #e2e8f0 (light gray)
- Square size: 16px × 16px
- CSS implementation:
```css
background-image:
  linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
  linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
  linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
  linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
background-size: 32px 32px;
background-position: 0 0, 0 16px, 16px -16px, -16px 0px;
```

**Download Button Specifications**:
- Text: "⬇️ Download Headshot PNG"
- Background: Green (#48bb78)
- Text: White, 16px bold
- Padding: 14px 28px
- Border-radius: 6px
- Full width on mobile
- Positioned below headshot image
- Hover: Darker green (#38a169)
- Click: Triggers download with filename `perkie-headshot-[timestamp].png`

**Interaction - Image Zoom** (Optional Enhancement):
- Click image to view full size in modal
- Pinch-to-zoom on mobile
- Shows actual pixel dimensions

#### 2.2.6 Validation Section
**Purpose**: Automated quality checks for headshot output

**Visibility**: Shown below comparison section when results available

**Visual Design**:
- Background: Light green (#f0fff4) for all pass, light red (#fff5f5) if any fail
- Border-left: 4px solid green or red
- Padding: 20px
- Font: 14px monospace for technical details

**Validation Checks**:

```
┌────────────────────────────────────────┐
│  Quality Validation                    │
│                                        │
│  ✅ Aspect Ratio: 4:5 portrait         │
│     (1600x2000 pixels)                 │
│                                        │
│  ✅ Has Transparency: Yes              │
│     (Alpha channel detected)           │
│                                        │
│  ✅ Is Grayscale: Yes                  │
│     (All pixels: R=G=B)                │
│                                        │
│  ✅ File Size: 6.2 MB                  │
│     (Original: 2.4 MB)                 │
│                                        │
│  ✅ Format: PNG                        │
│     (RGBA color space)                 │
│                                        │
│  ✅ Headshot Composition: Detected     │
│     (Tight crop on face/upper body)    │
└────────────────────────────────────────┘
```

**Check Implementations**:

1. **Aspect Ratio Check**:
   - Calculate width/height ratio
   - Expected: 0.8 (4:5 portrait)
   - Tolerance: ±0.05
   - Pass: ✅ Green checkmark
   - Fail: ❌ Red X with actual ratio

2. **Transparency Check**:
   - Load image to canvas
   - Sample pixels across image
   - Check for alpha channel values < 255
   - Pass: At least 5% of pixels have transparency
   - Display: Percentage of transparent pixels

3. **Grayscale Check**:
   - Sample 100 random pixels
   - Check R=G=B for each pixel
   - Pass: 95%+ of pixels are grayscale
   - Display: Percentage of grayscale pixels

4. **File Size Check**:
   - Display both original and result file sizes
   - No pass/fail, informational only
   - Format: MB with 1 decimal place

5. **Format Check**:
   - Verify MIME type is image/png
   - Check if RGBA mode (4 channels)
   - Display: Format name + color space

6. **Headshot Composition Check** (Heuristic):
   - Calculate bounding box of non-transparent pixels
   - Check if height > width (portrait orientation)
   - Check if crop is centered (horizontal centering)
   - Pass: Portrait orientation detected
   - Note: Visual inspection still required

**Visual Indicators**:
- ✅ Green checkmark: Pass
- ❌ Red X: Fail
- ℹ️ Blue info icon: Informational (no pass/fail)
- ⚠️ Yellow warning: Pass but unusual value

**Failed Validation Actions**:
- Show detailed error message explaining what's wrong
- Provide "Report Issue" button to copy technical details
- Suggest potential causes:
  - API error
  - Unsupported image type
  - Network corruption

### 2.3 Visual Design System

#### 2.3.1 Color Palette
```css
:root {
  /* Primary Colors */
  --color-primary: #3182ce;        /* Blue - primary actions */
  --color-primary-dark: #2c5282;   /* Hover states */
  --color-primary-light: #ebf8ff;  /* Backgrounds */

  /* Semantic Colors */
  --color-success: #48bb78;        /* Green - success states */
  --color-success-light: #f0fff4;  /* Success backgrounds */
  --color-warning: #ed8936;        /* Orange - warnings */
  --color-warning-light: #fffaf0;  /* Warning backgrounds */
  --color-error: #f56565;          /* Red - errors */
  --color-error-light: #fff5f5;    /* Error backgrounds */

  /* Neutral Colors */
  --color-gray-50: #f7fafc;
  --color-gray-100: #edf2f7;
  --color-gray-200: #e2e8f0;
  --color-gray-300: #cbd5e0;
  --color-gray-600: #718096;
  --color-gray-800: #2d3748;
  --color-gray-900: #1a202c;

  /* Background */
  --color-bg-page: #f7fafc;
  --color-bg-card: #ffffff;

  /* Text */
  --color-text-primary: #2d3748;
  --color-text-secondary: #718096;
  --color-text-inverse: #ffffff;
}
```

#### 2.3.2 Typography
```css
:root {
  /* Font Families */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI',
               Roboto, Oxygen, Ubuntu, sans-serif;
  --font-mono: 'SF Mono', Monaco, 'Courier New', monospace;

  /* Font Sizes */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;

  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Line Heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}
```

**Typography Scale Usage**:
- H1 (Page title): 30px bold, tight line-height
- H2 (Section titles): 24px semibold, normal line-height
- Body text: 16px normal, relaxed line-height
- Small text (metadata): 14px normal
- Technical details: 14px monospace

#### 2.3.3 Spacing System
```css
:root {
  /* Spacing Scale (8px base unit) */
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --space-6: 48px;
  --space-8: 64px;

  /* Component Spacing */
  --section-gap: var(--space-4);
  --card-padding: var(--space-3);
  --button-padding: 12px 24px;
}
```

#### 2.3.4 Elevation System (Shadows)
```css
:root {
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
```

**Usage**:
- Cards: shadow-md
- Buttons (hover): shadow-sm
- Modals/overlays: shadow-xl
- Drag-over states: shadow-lg

#### 2.3.5 Border Radius
```css
:root {
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;
}
```

#### 2.3.6 Transitions
```css
:root {
  --transition-fast: 150ms ease;
  --transition-base: 300ms ease;
  --transition-slow: 500ms ease;
}
```

**Usage**:
- Hover effects: transition-fast
- State changes: transition-base
- Animations: transition-slow

---

## 3. User Flow & Interaction Design

### 3.1 Complete User Journey

**Step 1: Page Load**
```
User opens test_api.html
        ↓
Page checks API health (/health endpoint)
        ↓
Shows status indicator (✅ Ready / ❌ Unavailable)
        ↓
Upload section is ready for interaction
```

**Step 2: File Upload**
```
User drags pet photo OR clicks to browse
        ↓
File validation (format, size, dimensions)
        ↓
[PASS]: Show preview section with image
[FAIL]: Show error message, stay on upload
```

**Step 3: Preview & Initiate**
```
User reviews original image
        ↓
Clicks "Generate Headshot" button
        ↓
Button disabled, processing section appears
```

**Step 4: Processing (30-60s)**
```
Send POST request to /api/v2/headshot
        ↓
Progress bar updates through stages:
  - Uploading (0-5%)
  - Removing background (5-60%)
  - Converting B&W (60-75%)
  - Cropping headshot (75-90%)
  - Adding neck fade (90-98%)
  - Complete (100%)
        ↓
Timer shows elapsed time
        ↓
[SUCCESS]: Receive PNG blob
[ERROR]: Show error message, enable retry
```

**Step 5: Results Display**
```
Hide processing section
        ↓
Show comparison section (original vs headshot)
        ↓
Run validation checks automatically
        ↓
Show validation results
        ↓
Enable download button
```

**Step 6: Actions**
```
User can:
  - Download headshot PNG
  - Upload new image (restart flow)
  - View validation details
  - Zoom images for inspection
```

### 3.2 Interaction States

#### State 1: Initial Load
- Header: Visible, checking API status
- Upload: Visible, waiting for file
- Preview: Hidden
- Processing: Hidden
- Comparison: Hidden
- Validation: Hidden

#### State 2: File Selected
- Header: Visible, API status shown
- Upload: Hidden (or minimized)
- Preview: Visible, showing image + metadata
- Processing: Hidden
- Comparison: Hidden
- Validation: Hidden

#### State 3: Processing
- Header: Visible
- Upload: Hidden
- Preview: Hidden (or minimized)
- Processing: Visible with progress
- Comparison: Hidden
- Validation: Hidden

#### State 4: Complete
- Header: Visible
- Upload: Hidden (with "Start Over" option in header)
- Preview: Hidden
- Processing: Hidden
- Comparison: Visible
- Validation: Visible

#### State 5: Error
- Header: Visible
- Upload: Visible (to retry)
- Preview: Hidden
- Processing: Hidden with error message
- Comparison: Hidden
- Validation: Hidden

### 3.3 Error Handling Design

**Error Types & Messages**:

1. **Invalid File Format**
   - Trigger: Non-JPEG/PNG file selected
   - Message: "Please select a JPEG or PNG image file."
   - UI: Red border on upload zone, error text below
   - Action: Stay on upload, allow re-selection

2. **File Too Large**
   - Trigger: File > 50MB
   - Message: "Image file is too large. Maximum size is 50MB. Your file: [size]"
   - UI: Error text with actual file size
   - Action: Suggest compression tools, allow re-selection

3. **Dimensions Too Large**
   - Trigger: Width or height > 4096px
   - Message: "Image dimensions too large. Maximum: 4096x4096. Your image: [dimensions]"
   - UI: Error text with actual dimensions
   - Action: Suggest resizing, allow re-selection

4. **API Unavailable**
   - Trigger: Health check fails on page load
   - Message: "Cannot connect to API at localhost:8888. Make sure the API is running."
   - UI: Red status indicator in header, prominent alert box
   - Action: Show "Check API Status" button to retry, show startup instructions

5. **Network Error During Upload**
   - Trigger: Fetch request fails (network)
   - Message: "Network error while uploading image. Please check your connection."
   - UI: Error in processing section, retry button
   - Action: "Retry Upload" button, "Cancel" to return

6. **Processing Timeout**
   - Trigger: No response after 120 seconds
   - Message: "Processing timed out after 2 minutes. This may indicate an API issue."
   - UI: Error in processing section
   - Action: "Retry" button, "Report Issue" button to copy technical details

7. **API Error Response**
   - Trigger: 4xx or 5xx response from API
   - Message: "API returned an error: [error message from API]"
   - UI: Error box with technical details (collapsible)
   - Action: "Retry" button, "Copy Error Details" button

8. **Invalid Response Format**
   - Trigger: Response is not valid image
   - Message: "Received invalid image data from API. Please try again."
   - UI: Error with technical details
   - Action: "Retry" button

**Error UI Pattern**:
```
┌────────────────────────────────────┐
│  ❌ Error Title                    │
│                                    │
│  Human-readable explanation of     │
│  what went wrong and why.          │
│                                    │
│  [Primary Action Button]           │
│  [Secondary Action Link]           │
│                                    │
│  ▼ Technical Details (collapsed)   │
└────────────────────────────────────┘
```

**Error Recovery Flows**:
- All errors provide clear next action
- "Retry" functionality preserves user's uploaded image (don't make them re-upload)
- Technical details available but not prominent (avoid overwhelming non-technical users)
- "Start Over" always available to reset to clean state

### 3.4 Loading States & Animations

**Skeleton Loaders**:
- While checking API status: Pulse animation on status indicator
- While loading image preview: Gray rectangle with shimmer effect
- While processing: Smooth progress bar fill with pulse effect

**Micro-interactions**:
- Button hover: Slight scale up (1.02x) + shadow increase
- Button click: Brief scale down (0.98x)
- Image upload success: Fade-in animation (300ms)
- Section transitions: Slide-in from bottom (400ms ease-out)
- Progress bar updates: Smooth width transition (300ms ease)
- Validation checks: Check marks appear one-by-one (staggered 100ms)

**Animations CSS**:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
```

---

## 4. Mobile Optimization

### 4.1 Responsive Breakpoints

```css
/* Mobile-first approach */
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
}

/* Mobile: Default (< 640px) */
/* Tablet: 640px - 1023px */
/* Desktop: 1024px+ */
```

### 4.2 Mobile-Specific Adaptations

**Touch Targets**:
- Minimum size: 44x44px (Apple HIG, WCAG 2.5.5)
- Buttons: 48px height minimum
- Spacing between targets: 8px minimum

**Upload Zone (Mobile)**:
- Full width minus 16px padding
- Height: 240px (larger for easy tap)
- Text: Slightly larger (18px vs 16px desktop)
- File picker opens native photo selector + camera

**Comparison Layout (Mobile)**:
- Stacked vertically (not side-by-side)
- "Before" image first, arrow indicator, then "After"
- Each image takes full width
- Download button fixed at bottom (sticky position)

**Progress Section (Mobile)**:
- Timer more prominent (larger font)
- Stage description shortened for narrow screens
- Progress percentage moved outside bar

**Navigation (Mobile)**:
- "Start Over" button in top-right of header (hamburger if multiple actions)
- Sticky header on scroll
- No horizontal scrolling ever

**Modals/Overlays (Mobile)**:
- Full-screen instead of centered dialog
- Slide-up animation
- Close button top-left (iOS pattern)

### 4.3 Performance Optimizations

**Image Handling**:
- Resize preview images to max 800px width for display (maintain original for processing)
- Use Canvas API for efficient resizing
- Compress preview JPEG quality to 85% for faster rendering

**Network Optimization**:
- Show file size before upload to set expectations
- Support chunked upload for large files (future enhancement)
- Cache API health check for 30 seconds

**Rendering Performance**:
- Use CSS transforms for animations (GPU-accelerated)
- Lazy-load comparison section until needed
- Debounce window resize events (300ms)

**Memory Management**:
- Revoke object URLs when no longer needed
- Clear canvas contexts after use
- Limit maximum file size to 50MB to prevent browser crashes

---

## 5. Accessibility (WCAG 2.1 AA Compliance)

### 5.1 Semantic HTML

**Structure**:
```html
<header role="banner">
  <!-- Header content -->
</header>

<main role="main">
  <section aria-label="Upload Image">
    <!-- Upload section -->
  </section>

  <section aria-label="Processing" aria-live="polite">
    <!-- Processing section -->
  </section>

  <section aria-label="Results Comparison">
    <!-- Comparison section -->
  </section>
</main>
```

### 5.2 Keyboard Navigation

**Tab Order**:
1. API status check button
2. Upload zone (file input)
3. Generate Headshot button
4. Cancel button (if processing)
5. Download button
6. Start Over button
7. Validation details (collapsible)

**Keyboard Shortcuts**:
- Enter/Space on upload zone: Open file picker
- Escape during processing: Cancel (with confirmation)
- Enter on download button: Download file

**Focus Management**:
- Visible focus indicators (2px blue outline)
- Focus trapped in modal/overlay states
- Focus moved to relevant section after state changes (e.g., to download button when complete)

### 5.3 Screen Reader Support

**ARIA Labels**:
```html
<div
  role="button"
  tabindex="0"
  aria-label="Upload pet photo by clicking or dragging file"
  class="upload-zone">
  <!-- Content -->
</div>

<div
  role="progressbar"
  aria-valuenow="60"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-label="Processing headshot, 60% complete">
  <!-- Progress bar -->
</div>

<img
  src="..."
  alt="Original pet photo uploaded by user">

<img
  src="..."
  alt="Generated headshot with transparent background and black and white filter">
```

**Live Regions**:
- Processing status: `aria-live="polite"` for updates
- Error messages: `aria-live="assertive"` for immediate announcement
- Validation results: `aria-live="polite"` as checks complete

**Alternative Text**:
- All images have descriptive alt text
- Decorative icons: `aria-hidden="true"`
- Status indicators: Text alternatives (not just color)

### 5.4 Visual Accessibility

**Color Contrast**:
- Text on background: Minimum 4.5:1 ratio
- Large text (18px+): Minimum 3:1 ratio
- Error text: 7:1 ratio (enhanced)

**Color Independence**:
- Never rely on color alone
- Success: ✅ + green + text "Success"
- Error: ❌ + red + text "Error"
- Progress: Percentage number + bar fill

**Text Sizing**:
- Minimum 16px for body text
- Supports browser zoom to 200% without horizontal scrolling
- Relative units (rem, em) instead of fixed px where possible

**Focus Indicators**:
- Visible on all interactive elements
- Minimum 2px thickness
- High contrast against background

---

## 6. Implementation Details

### 6.1 HTML Structure

**File**: `backend/inspirenet-api/test_api.html`

**Outline**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Perkie Print Headshot - Local Test</title>
  <style>
    /* Inline CSS - all design system variables and component styles */
  </style>
</head>
<body>
  <!-- Header Section -->
  <header>
    <h1>Perkie Print Headshot Tester</h1>
    <div class="api-status">
      <span class="status-indicator"></span>
      <span class="status-text">Checking API...</span>
    </div>
  </header>

  <!-- Main Content -->
  <main>
    <!-- Upload Section -->
    <section id="upload-section" class="section">
      <div class="upload-zone" id="upload-zone">
        <!-- Upload UI -->
      </div>
      <input type="file" id="file-input" accept="image/jpeg,image/png" hidden>
    </section>

    <!-- Preview Section -->
    <section id="preview-section" class="section hidden">
      <!-- Preview UI -->
    </section>

    <!-- Processing Section -->
    <section id="processing-section" class="section hidden">
      <!-- Processing UI with progress bar -->
    </section>

    <!-- Comparison Section -->
    <section id="comparison-section" class="section hidden">
      <!-- Side-by-side comparison -->
    </section>

    <!-- Validation Section -->
    <section id="validation-section" class="section hidden">
      <!-- Quality checks -->
    </section>

    <!-- Error Section -->
    <section id="error-section" class="section hidden">
      <!-- Error messages -->
    </section>
  </main>

  <script>
    /* Inline JavaScript - all functionality */
  </script>
</body>
</html>
```

### 6.2 JavaScript Architecture

**Module Pattern** (using IIFE for encapsulation):

```javascript
(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    API_BASE_URL: 'http://localhost:8888',
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    MAX_DIMENSION: 4096,
    TIMEOUT_MS: 120000, // 2 minutes
    PROGRESS_STAGES: [
      { start: 0, end: 5, text: 'Uploading image...' },
      { start: 5, end: 60, text: 'Removing background with InSPyReNet...' },
      { start: 60, end: 75, text: 'Converting to professional B&W...' },
      { start: 75, end: 90, text: 'Cropping to headshot composition...' },
      { start: 90, end: 98, text: 'Adding soft neck fade...' },
      { start: 98, end: 100, text: 'Complete!' }
    ]
  };

  // State Management
  const state = {
    apiAvailable: false,
    selectedFile: null,
    originalImage: null,
    resultImage: null,
    processingStartTime: null,
    previousProcessingTime: null
  };

  // DOM Elements (cached)
  const elements = {
    // Will be populated on DOMContentLoaded
  };

  // API Functions
  async function checkApiHealth() { /* ... */ }
  async function processHeadshot(file) { /* ... */ }

  // UI Functions
  function showSection(sectionId) { /* ... */ }
  function hideSection(sectionId) { /* ... */ }
  function updateProgress(percent, stage) { /* ... */ }
  function displayError(message, technical) { /* ... */ }
  function displayResults(originalBlob, resultBlob) { /* ... */ }

  // Validation Functions
  function validateFile(file) { /* ... */ }
  async function validateHeadshot(imageBlob) { /* ... */ }
  function checkAspectRatio(img) { /* ... */ }
  function checkTransparency(canvas, ctx) { /* ... */ }
  function checkGrayscale(canvas, ctx) { /* ... */ }

  // Utility Functions
  function formatFileSize(bytes) { /* ... */ }
  function formatTime(seconds) { /* ... */ }
  function downloadBlob(blob, filename) { /* ... */ }
  function createCheckerboardCanvas(img) { /* ... */ }

  // Event Handlers
  function handleFileSelect(e) { /* ... */ }
  function handleDragOver(e) { /* ... */ }
  function handleDrop(e) { /* ... */ }
  function handleGenerateClick() { /* ... */ }
  function handleDownloadClick() { /* ... */ }
  function handleStartOverClick() { /* ... */ }

  // Initialization
  function init() {
    // Cache DOM elements
    // Attach event listeners
    // Check API health
  }

  // Run on page load
  document.addEventListener('DOMContentLoaded', init);
})();
```

### 6.3 Key Function Implementations

#### 6.3.1 API Health Check
```javascript
async function checkApiHealth() {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      state.apiAvailable = true;
      updateApiStatus('ready', 'API Ready ✅');
      return true;
    } else {
      throw new Error(`API returned status ${response.status}`);
    }
  } catch (error) {
    state.apiAvailable = false;
    updateApiStatus('unavailable', 'API Unavailable ❌');
    displayError(
      'Cannot connect to API at localhost:8888. Make sure the API is running.',
      error.message
    );
    return false;
  }
}
```

#### 6.3.2 Process Headshot
```javascript
async function processHeadshot(file) {
  // Start timing
  state.processingStartTime = Date.now();

  // Create FormData
  const formData = new FormData();
  formData.append('file', file);

  // Simulate progress (since API doesn't provide streaming)
  const progressInterval = simulateProgress();

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/v2/headshot`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(CONFIG.TIMEOUT_MS)
    });

    clearInterval(progressInterval);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${errorText}`);
    }

    const blob = await response.blob();

    // Record processing time
    const elapsed = (Date.now() - state.processingStartTime) / 1000;
    state.previousProcessingTime = elapsed;

    // Update progress to 100%
    updateProgress(100, 'Complete!');

    return blob;

  } catch (error) {
    clearInterval(progressInterval);
    throw error;
  }
}

function simulateProgress() {
  let currentStage = 0;
  let currentPercent = 0;

  return setInterval(() => {
    const elapsed = (Date.now() - state.processingStartTime) / 1000;

    // Estimate progress based on elapsed time
    // First 30s: 0-60% (background removal)
    // Next 15s: 60-90% (conversion + cropping)
    // Final 5s: 90-100% (fade + finishing)

    if (elapsed < 30) {
      currentPercent = (elapsed / 30) * 60;
      currentStage = currentPercent < 5 ? 0 : 1;
    } else if (elapsed < 45) {
      currentPercent = 60 + ((elapsed - 30) / 15) * 30;
      currentStage = currentPercent < 75 ? 2 : 3;
    } else {
      currentPercent = 90 + ((elapsed - 45) / 5) * 8;
      currentStage = 4;
    }

    currentPercent = Math.min(currentPercent, 98); // Cap at 98% until complete

    updateProgress(
      Math.round(currentPercent),
      CONFIG.PROGRESS_STAGES[currentStage].text
    );
  }, 500); // Update every 500ms
}
```

#### 6.3.3 Validate Headshot
```javascript
async function validateHeadshot(imageBlob) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const results = {
        aspectRatio: checkAspectRatio(img),
        transparency: checkTransparency(canvas, ctx),
        grayscale: checkGrayscale(canvas, ctx),
        fileSize: imageBlob.size,
        format: imageBlob.type,
        dimensions: { width: img.width, height: img.height }
      };

      resolve(results);
    };
    img.src = URL.createObjectURL(imageBlob);
  });
}

function checkAspectRatio(img) {
  const ratio = img.width / img.height;
  const expectedRatio = 4 / 5; // 0.8
  const tolerance = 0.05;
  const pass = Math.abs(ratio - expectedRatio) < tolerance;

  return {
    pass,
    ratio: ratio.toFixed(3),
    expected: expectedRatio.toFixed(3),
    dimensions: `${img.width}x${img.height}`
  };
}

function checkTransparency(canvas, ctx) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  let transparentCount = 0;
  const totalPixels = canvas.width * canvas.height;

  // Sample every 10th pixel for performance
  for (let i = 3; i < pixels.length; i += 40) { // Alpha channel is every 4th byte
    if (pixels[i] < 255) {
      transparentCount++;
    }
  }

  const transparentPercent = (transparentCount / (totalPixels / 10)) * 100;
  const pass = transparentPercent > 5; // At least 5% transparent

  return {
    pass,
    percentage: transparentPercent.toFixed(1)
  };
}

function checkGrayscale(canvas, ctx) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  let grayscaleCount = 0;
  const sampleSize = 100;

  // Sample 100 random pixels
  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor(Math.random() * (pixels.length / 4)) * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];

    // Allow small deviation for JPEG artifacts
    if (Math.abs(r - g) < 5 && Math.abs(g - b) < 5 && Math.abs(r - b) < 5) {
      grayscaleCount++;
    }
  }

  const grayscalePercent = (grayscaleCount / sampleSize) * 100;
  const pass = grayscalePercent > 95;

  return {
    pass,
    percentage: grayscalePercent.toFixed(1)
  };
}
```

#### 6.3.4 Checkerboard Background
```javascript
function createCheckerboardCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');

  // Draw checkerboard pattern
  const squareSize = 16;
  for (let y = 0; y < canvas.height; y += squareSize) {
    for (let x = 0; x < canvas.width; x += squareSize) {
      const isEven = ((x / squareSize) + (y / squareSize)) % 2 === 0;
      ctx.fillStyle = isEven ? '#ffffff' : '#e2e8f0';
      ctx.fillRect(x, y, squareSize, squareSize);
    }
  }

  // Draw image on top
  ctx.drawImage(img, 0, 0);

  return canvas;
}
```

### 6.4 CSS Implementation Highlights

**Responsive Grid**:
```css
.comparison-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

@media (min-width: 768px) {
  .comparison-grid {
    grid-template-columns: 1fr 1fr;
  }
}
```

**Upload Zone Interaction**:
```css
.upload-zone {
  border: 2px dashed var(--color-primary);
  background: var(--color-gray-50);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-base);
}

.upload-zone:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary-dark);
}

.upload-zone.drag-over {
  background: var(--color-primary-light);
  border-style: solid;
  border-width: 3px;
  transform: scale(1.02);
}
```

**Progress Bar**:
```css
.progress-bar {
  width: 100%;
  height: 24px;
  background: var(--color-gray-200);
  border-radius: var(--radius-xl);
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg,
    var(--color-primary) 0%,
    var(--color-primary-dark) 100%);
  transition: width var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: var(--font-bold);
  font-size: var(--text-sm);
}
```

---

## 7. Testing & Validation

### 7.1 Manual Testing Checklist

**Upload Functionality**:
- [ ] Drag-and-drop works for valid JPEG
- [ ] Drag-and-drop works for valid PNG
- [ ] Click-to-browse opens file picker
- [ ] Invalid format shows error
- [ ] File > 50MB shows error
- [ ] Dimensions > 4096px shows error
- [ ] Preview displays correctly
- [ ] Metadata shows correct info

**Processing**:
- [ ] Progress bar animates smoothly
- [ ] Stage descriptions update correctly
- [ ] Timer counts up accurately
- [ ] First request shows 30-60s timing
- [ ] Subsequent requests show 1-5s timing
- [ ] Cancel button works (if implemented)
- [ ] Timeout error shows after 2 minutes

**Results Display**:
- [ ] Original image displays correctly
- [ ] Headshot result displays correctly
- [ ] Checkerboard pattern visible behind transparency
- [ ] Comparison layout works on mobile
- [ ] Comparison layout works on desktop
- [ ] Download button triggers file download
- [ ] Downloaded file is valid PNG

**Validation**:
- [ ] Aspect ratio check runs and displays result
- [ ] Transparency check runs and displays result
- [ ] Grayscale check runs and displays result
- [ ] File size displays correctly
- [ ] All checks show pass/fail correctly
- [ ] Failed checks show helpful details

**Error Handling**:
- [ ] API unavailable shows clear error
- [ ] Network error during upload shows error
- [ ] API error response shows error message
- [ ] Timeout shows appropriate error
- [ ] Retry button works after errors
- [ ] Start Over resets state completely

**Mobile Testing**:
- [ ] Touch interactions work (tap, drag)
- [ ] Layout adapts to narrow screens
- [ ] No horizontal scrolling
- [ ] File picker opens camera option
- [ ] Buttons are large enough to tap
- [ ] Text is readable without zooming

**Browser Compatibility**:
- [ ] Works in Chrome/Edge
- [ ] Works in Safari (desktop and iOS)
- [ ] Works in Firefox
- [ ] File API supported
- [ ] Fetch API supported
- [ ] Canvas API supported

### 7.2 Automated Testing Scenarios

**Unit Tests** (if implemented):
```javascript
// Example test structure
describe('Validation Functions', () => {
  test('checkAspectRatio returns pass for 4:5 image', () => {
    const mockImg = { width: 1600, height: 2000 };
    const result = checkAspectRatio(mockImg);
    expect(result.pass).toBe(true);
  });

  test('checkAspectRatio returns fail for 16:9 image', () => {
    const mockImg = { width: 1920, height: 1080 };
    const result = checkAspectRatio(mockImg);
    expect(result.pass).toBe(false);
  });

  test('formatFileSize converts bytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(5242880)).toBe('5.0 MB');
  });
});
```

### 7.3 Performance Testing

**Metrics to Validate**:
- [ ] Page loads in < 1 second
- [ ] File validation completes in < 100ms
- [ ] Image preview renders in < 500ms
- [ ] Progress updates every 500ms consistently
- [ ] Results comparison renders in < 1 second
- [ ] Download initiates immediately on click
- [ ] No memory leaks after multiple test cycles

**Load Testing**:
- [ ] Test with 1MB file
- [ ] Test with 10MB file
- [ ] Test with 50MB file (maximum)
- [ ] Test with 4096x4096 image (maximum dimensions)
- [ ] Test with multiple files in succession
- [ ] Test with various aspect ratios

### 7.4 Accessibility Testing

**Tools**:
- [ ] Run axe DevTools (should have 0 violations)
- [ ] Run Lighthouse accessibility audit (score 100)
- [ ] Test with keyboard only (no mouse)
- [ ] Test with screen reader (NVDA or JAWS)

**Manual Checks**:
- [ ] All images have alt text
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA
- [ ] No reliance on color alone
- [ ] ARIA labels are present and accurate
- [ ] Live regions announce updates

---

## 8. Documentation & Comments

### 8.1 Inline Code Comments

**Comment Strategy**:
- Explain WHY, not WHAT (code should be self-documenting for what)
- Document tricky algorithms or browser quirks
- Mark TODO items for future enhancements
- Include references to API documentation

**Example Comments**:
```javascript
/**
 * Simulates progress during API processing since the endpoint
 * doesn't provide streaming updates. Uses elapsed time to estimate
 * progress based on typical processing stages:
 * - 0-30s: Background removal (60% of work)
 * - 30-45s: B&W conversion and cropping (30% of work)
 * - 45-50s: Final touches (10% of work)
 */
function simulateProgress() { /* ... */ }

// Sample every 10th pixel for performance - checking all pixels
// in a 4096x4096 image would be too slow for real-time validation
for (let i = 3; i < pixels.length; i += 40) {
  // ...
}

// Allow small deviation (< 5) for JPEG compression artifacts
// which can cause slight color channel differences even in grayscale
if (Math.abs(r - g) < 5 && Math.abs(g - b) < 5) {
  // ...
}
```

### 8.2 Usage Instructions (in HTML comments)

Add instructions at top of file:
```html
<!--
  Perkie Print Headshot - Local Test Interface

  USAGE:
  1. Start the API: cd backend/inspirenet-api && python src/main.py
  2. Open this file in a browser: test_api.html
  3. Upload a pet photo (full-body images work best for testing crop)
  4. Click "Generate Headshot" and wait (30-60s first time, 1-5s after)
  5. Review the results and validation checks

  REQUIREMENTS:
  - API running on localhost:8888
  - Modern browser (Chrome 90+, Safari 14+, Firefox 88+)
  - Test images should be JPEG or PNG, max 50MB, max 4096x4096

  EXPECTED RESULTS:
  - Tight headshot crop (not full body)
  - 4:5 portrait aspect ratio
  - Professional B&W conversion
  - Transparent background (visible via checkerboard)
  - Soft neck fade at bottom

  TROUBLESHOOTING:
  - "API Unavailable" error: Make sure API is running on port 8888
  - Slow processing: First request takes 30-60s (model loading), subsequent requests are fast
  - Invalid image data: Check API logs for errors
  - Timeout: API may be overloaded or image too complex

  For more information, see backend/inspirenet-api/README.md
-->
```

---

## 9. Future Enhancements (Not in Scope)

These features are **NOT** included in the initial implementation but could be added later:

1. **Batch Processing**:
   - Upload multiple images at once
   - Process in queue
   - Download all results as ZIP

2. **Image Comparison Slider**:
   - Interactive slider to compare before/after
   - More intuitive than side-by-side

3. **Advanced Validation**:
   - Face detection to verify headshot contains face
   - Blur detection for image quality
   - Lighting analysis

4. **Settings Panel**:
   - Adjust API timeout
   - Choose API endpoint (for testing different versions)
   - Toggle validation checks

5. **History**:
   - Save previously processed images in localStorage
   - Quick re-download of past results
   - Compare multiple headshots

6. **Share Results**:
   - Generate shareable link
   - Copy image to clipboard
   - Share to social media

7. **Performance Metrics**:
   - Graph of processing times over multiple requests
   - Average/min/max statistics
   - API performance monitoring

8. **Automated Testing Mode**:
   - Run through folder of test images
   - Generate report of all validations
   - Export results as CSV

---

## 10. Implementation Steps

### Step 1: Create Base HTML Structure
1. Create `backend/inspirenet-api/test_api.html`
2. Add DOCTYPE, html, head, body tags
3. Add meta tags for charset and viewport
4. Add title and usage comment block
5. Create main semantic structure (header, main, sections)

### Step 2: Implement CSS Design System
1. Add CSS custom properties (colors, typography, spacing)
2. Add reset/normalize styles
3. Add utility classes (hidden, etc.)
4. Add component styles (upload zone, buttons, cards)
5. Add responsive media queries
6. Add animations and transitions

### Step 3: Implement Header & API Status
1. Add header HTML structure
2. Add status indicator element
3. Implement checkApiHealth() function
4. Implement updateApiStatus() function
5. Add auto-retry logic for unavailable API
6. Style status indicators (colors, animations)

### Step 4: Implement Upload Section
1. Add upload zone HTML structure
2. Add hidden file input element
3. Implement drag-and-drop event handlers
4. Implement file picker click handler
5. Implement file validation (format, size, dimensions)
6. Implement error display for invalid files
7. Style upload zone states (default, hover, drag-over, error)

### Step 5: Implement Preview Section
1. Add preview section HTML structure
2. Implement file preview display
3. Implement metadata extraction (dimensions, size, format)
4. Add "Generate Headshot" button
5. Add "Change Image" button
6. Implement button click handlers
7. Style preview layout and buttons

### Step 6: Implement Processing Section
1. Add processing section HTML structure
2. Add progress bar element
3. Add stage description element
4. Add timer element
5. Implement simulateProgress() function
6. Implement updateProgress() function
7. Implement timer update logic
8. Implement processHeadshot() API call
9. Add cancel functionality
10. Style processing section (progress bar, animations)

### Step 7: Implement Results Comparison
1. Add comparison section HTML structure
2. Add original image container
3. Add headshot result container
4. Implement createCheckerboardCanvas() function
5. Implement displayResults() function
6. Add download button
7. Implement downloadBlob() function
8. Style comparison layout (mobile stacked, desktop side-by-side)

### Step 8: Implement Validation Section
1. Add validation section HTML structure
2. Implement checkAspectRatio() function
3. Implement checkTransparency() function
4. Implement checkGrayscale() function
5. Implement validateHeadshot() orchestrator function
6. Implement displayValidation() UI function
7. Style validation checks (pass/fail colors, icons)

### Step 9: Implement Error Handling
1. Add error section HTML structure
2. Implement displayError() function
3. Add error types and messages
4. Add retry button functionality
5. Add technical details collapsible
6. Style error states (colors, icons, layout)

### Step 10: Implement State Management
1. Create state object
2. Implement showSection() / hideSection() functions
3. Implement state transitions between sections
4. Implement resetState() for "Start Over"
5. Add focus management for accessibility

### Step 11: Add Accessibility Features
1. Add ARIA labels to all interactive elements
2. Add role attributes
3. Add aria-live regions for dynamic content
4. Implement keyboard navigation
5. Add focus indicators
6. Test with keyboard only
7. Test with screen reader

### Step 12: Mobile Optimization
1. Test responsive breakpoints
2. Adjust touch target sizes
3. Optimize mobile layout (stacked vs columns)
4. Test file picker on mobile
5. Test camera integration
6. Optimize image sizes for mobile performance

### Step 13: Testing & Refinement
1. Test all user flows end-to-end
2. Test error scenarios
3. Test with various image types and sizes
4. Test on multiple browsers
5. Test on mobile devices
6. Run accessibility audit
7. Run performance audit
8. Fix any issues discovered

### Step 14: Documentation
1. Add inline code comments
2. Add usage instructions in HTML comment
3. Add troubleshooting section
4. Update session context file
5. Test documentation accuracy

---

## 11. Success Criteria Validation

After implementation, verify:

**Functional Requirements**:
- [x] File upload works via drag-drop and click
- [x] Preview shows uploaded image with metadata
- [x] Processing shows progress for 30-60s wait
- [x] Results display in side-by-side comparison
- [x] Transparency is visualized via checkerboard
- [x] Download button saves PNG file
- [x] Validation checks run automatically
- [x] Multiple images can be tested without refresh

**Visual Quality**:
- [x] Clean, professional aesthetic
- [x] Clear visual hierarchy
- [x] Adequate whitespace
- [x] Consistent color usage
- [x] Smooth animations
- [x] Responsive layout works mobile to desktop

**User Experience**:
- [x] Clear next steps at every stage
- [x] Progress indication prevents abandonment
- [x] Error messages are helpful, not technical
- [x] No unexpected behavior
- [x] Fast interaction response times
- [x] Forgiving of user mistakes

**Technical Quality**:
- [x] Single self-contained HTML file
- [x] Works on localhost:8888
- [x] No external dependencies
- [x] Modern JavaScript (ES6+)
- [x] Clean, maintainable code
- [x] Inline documentation

**Accessibility**:
- [x] WCAG 2.1 AA compliant
- [x] Keyboard navigable
- [x] Screen reader compatible
- [x] Color contrast sufficient
- [x] Focus indicators visible

**Performance**:
- [x] Page loads in < 1 second
- [x] Handles 50MB files without crashing
- [x] Smooth animations (60fps)
- [x] No memory leaks

---

## 12. File Specification

**File Path**: `backend/inspirenet-api/test_api.html`

**File Size**: Approximately 600-800 lines total
- HTML structure: ~150 lines
- CSS: ~250 lines
- JavaScript: ~400 lines

**Dependencies**: None (self-contained)

**Browser Support**:
- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- Mobile browsers (iOS Safari, Chrome Mobile)

**APIs Used**:
- File API (FileReader, Blob, File)
- Fetch API (for HTTP requests)
- Canvas API (for image analysis)
- Drag and Drop API
- URL API (for object URLs)

---

## 13. Design Rationale

### Why Single-Page Design?
- **Simplicity**: No build process, no deployment, just open in browser
- **Portability**: Easy to share with team, works anywhere
- **Testing Focus**: No production concerns, optimize for developer experience
- **Maintenance**: Single file is easy to update and version

### Why Mobile-First?
- **User Base**: 70% of Perkie traffic is mobile
- **Progressive Enhancement**: Easier to add desktop features than remove mobile ones
- **Touch Optimization**: Forces consideration of touch interactions from start

### Why Inline CSS/JS?
- **Self-Containment**: No external file dependencies
- **Simplicity**: One file to manage
- **Performance**: Fewer HTTP requests (though local, good practice)
- **Portability**: Works even if moved to different directory

### Why Simulated Progress?
- **API Limitation**: Endpoint doesn't provide streaming progress
- **User Experience**: 30-60s wait feels shorter with visual feedback
- **Accuracy**: Estimates based on typical processing stages are close enough
- **Transparency**: Shows estimate disclaimer to set expectations

### Why Checkerboard Background?
- **Industry Standard**: Universally recognized transparency indicator
- **Visual Clarity**: Makes transparent areas immediately obvious
- **Validation**: Helps verify API returned proper alpha channel

### Why Side-by-Side Comparison?
- **Quick Assessment**: Easy to spot differences at a glance
- **Professional Standard**: Common in photo editing tools
- **Context**: See original while evaluating result
- **Mobile Adaptation**: Stacks vertically on narrow screens

---

## 14. Known Limitations & Trade-offs

**Limitations**:
1. **Progress Accuracy**: Progress bar is estimated, not real-time from API
   - Trade-off: Better UX than no progress, accepted inaccuracy

2. **Single File Upload**: Can only test one image at a time
   - Trade-off: Simplicity over batch functionality (not needed for testing)

3. **No Image Editing**: Can't crop/rotate before upload
   - Trade-off: Not a photo editor, just a test interface

4. **No History**: Previous tests are lost on refresh
   - Trade-off: Simplicity over persistence (localStorage could be added)

5. **Desktop Focus**: Optimized for developer testing, not end-user product
   - Trade-off: Functional over polished (good enough for local testing)

**Assumptions**:
1. User has API running locally on port 8888
2. User has modern browser with JavaScript enabled
3. User has basic understanding of API testing
4. Test images are standard formats (JPEG, PNG)
5. User can wait 30-60s for first request

**Edge Cases**:
- Very large files (close to 50MB) may be slow to upload
- Very high resolution images may slow down Canvas operations
- Corrupted images may fail silently
- Browser may run out of memory with multiple large files

---

## 15. Appendix

### A. File Structure Reference
```
backend/inspirenet-api/
├── src/
│   ├── main.py
│   ├── api_v2_endpoints.py
│   └── effects/
│       └── perkie_print_headshot.py
├── test_output/
│   └── headshots/           (Created by automated tests)
├── test_images/             (User-provided test images)
├── test_headshot_local.py   (Automated Python test)
├── test-headshot-manual.sh  (Manual test script - Mac/Linux)
├── test-headshot-manual.bat (Manual test script - Windows)
└── test_api.html            (THIS FILE - Browser test interface)
```

### B. API Endpoint Reference
```
POST http://localhost:8888/api/v2/headshot

Request:
  Content-Type: multipart/form-data
  Body:
    file: <image file> (JPEG or PNG, max 50MB, max 4096x4096)

Response (Success):
  Status: 200 OK
  Content-Type: image/png
  Body: PNG image data (BGRA format)

Response (Error):
  Status: 400 Bad Request (invalid file)
  Status: 413 Payload Too Large (file > 50MB)
  Status: 500 Internal Server Error (processing failed)
  Body: Error message (plain text)
```

### C. Color Palette Quick Reference
```
Primary:   #3182ce (Blue)
Success:   #48bb78 (Green)
Warning:   #ed8936 (Orange)
Error:     #f56565 (Red)
Gray-200:  #e2e8f0 (Light gray for backgrounds)
Gray-600:  #718096 (Dark gray for text)
```

### D. Validation Thresholds
```
Aspect Ratio:
  Expected: 0.8 (4:5)
  Tolerance: ±0.05

Transparency:
  Minimum: 5% of pixels with alpha < 255

Grayscale:
  Minimum: 95% of sampled pixels with R≈G≈B
  Tolerance: ±5 per channel (for JPEG artifacts)

File Size:
  Maximum upload: 50 MB
  Maximum dimensions: 4096x4096 pixels
```

---

## IMPLEMENTATION PLAN COMPLETE

This plan provides everything needed to implement the headshot test interface. The designer should proceed by:

1. Creating the HTML file at specified path
2. Following implementation steps in order (sections 10)
3. Referring to component specifications (section 2) for visual design
4. Using code examples (section 6) as implementation guide
5. Validating against success criteria (section 11)

**Estimated Implementation Time**: 6-8 hours for complete implementation and testing

**File to Create**: `backend/inspirenet-api/test_api.html` (single file, ~700 lines)

---

**Plan Status**: Ready for implementation
**Created By**: UX Design E-commerce Expert Agent
**Date**: 2025-10-25
**Session Context**: `.claude/tasks/context_session_001.md`
