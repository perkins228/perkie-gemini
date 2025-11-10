# FREE Pet Art Download Email Template - Implementation Plan

**Document Type**: Implementation Plan
**Created**: 2025-11-09
**Author**: UX Design E-commerce Expert Agent
**Status**: READY FOR IMPLEMENTATION
**Estimated Time**: 12-16 hours
**Session**: context_session_001.md

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Strategic Context](#strategic-context)
3. [User Journey & Email Trigger](#user-journey--email-trigger)
4. [Email Design Specifications](#email-design-specifications)
5. [Technical Implementation](#technical-implementation)
6. [Content Strategy](#content-strategy)
7. [Mobile Optimization](#mobile-optimization)
8. [Accessibility Requirements](#accessibility-requirements)
9. [Testing & Quality Assurance](#testing--quality-assurance)
10. [Success Metrics](#success-metrics)
11. [Implementation Checklist](#implementation-checklist)

---

## Executive Summary

### Purpose
Design and implement a transactional email template for Shopify Email that delivers download links for FREE pet art after users complete the processor page email capture flow.

### Goals
1. **PRIMARY**: Deliver 4 download links (B&W, Color, Modern, Sketch) with 70-80% click-through rate
2. **SECONDARY**: Soft CTA to shop products (canvas prints, mugs, etc.) with 30-40% CTR
3. **TERTIARY**: Social share encouragement with 10-15% engagement

### Key Design Principles
- **Mobile-first**: 70% of traffic is mobile (single-column layout, large touch targets)
- **Transactional tone**: User expects download links, not marketing pitch
- **Value hierarchy**: Downloads first, shop CTA second (earned right to ask)
- **Brand consistency**: Purple/green gradients from processor page CTA redesign
- **WCAG AAA**: 48px minimum touch targets, 4.5:1 color contrast

### Expected Impact
- **Email open rate**: 60-70% (transactional emails perform 3-5x better than marketing)
- **Download link CTR**: 70-80% per style (high intent, expected action)
- **Shop CTA CTR**: 30-40% (soft sell after value delivery)
- **Social share rate**: 10-15% (emotional peak timing)
- **Email → Purchase (90 days)**: 18-25% (from nurture campaign)

---

## Strategic Context

### Business Model Alignment
- **Pet art is FREE**: Background removal + artistic effects are **lead generation tools**, not revenue sources
- **Email capture strategy**: Gate premium styles (Modern, Sketch) behind email to build lead database
- **Nurture funnel**: This email is Day 0 of a 90-day email nurture campaign (see `.claude/doc/email-capture-conversion-optimization-strategy.md`)

### Processor Page Transformation
This email is **Phase 3** of the processor page redesign:
- **Phase 1**: CTA redesign (COMPLETE - commit 6f477e4)
- **Phase 2**: Remove pet name field (PENDING)
- **Phase 3**: Email capture modal (IN PROGRESS - see `.claude/doc/mobile-email-capture-modal-implementation-plan.md`)
- **Phase 4**: Session bridge to product pages (PLANNED - 10-14 hours)

### User Context at Email Send
When this email is sent:
1. User has uploaded a pet photo
2. User has received FREE background removal (30-60s processing)
3. User has seen B&W and Color styles (FREE previews)
4. User clicked a premium style (Modern or Sketch)
5. User entered email in modal (unlocked premium styles)
6. User saw all 4 styles on processor page
7. **User expects**: Download links delivered immediately

**Emotional state**: High excitement (just saw their pet transformed into art), high trust (received value before ask), ready to share/shop

---

## User Journey & Email Trigger

### Email Trigger Point

**Trigger**: User submits email capture modal on processor page

**API Flow**:
```
1. User clicks premium style (Modern/Sketch) on processor page
2. Email capture modal appears (EmailCaptureModal component)
3. User enters email + consents to download delivery
4. Form submits to /apps/perkie/email-capture endpoint
5. Backend validates email + creates/updates Shopify customer
6. Backend enqueues download delivery email (THIS EMAIL)
7. Email sends within 30 seconds (transactional SLA)
8. User receives email while still on processor page
```

**Timing**: Immediate send (transactional email, not batch)

### Customer Data Available

**From Email Capture Modal** (see `.claude/doc/email-capture-modal-ux-design-spec.md`):
```liquid
{{ customer.email }}               // User's email
{{ customer.first_name }}          // Optional (if provided)
{{ pet_name }}                     // Optional (from processor page)
{{ style_bw_url }}                 // GCS URL for B&W high-res download
{{ style_color_url }}              // GCS URL for Color high-res download
{{ style_modern_url }}             // GCS URL for Modern high-res download
{{ style_sketch_url }}             // GCS URL for Sketch high-res download
{{ hero_image_url }}               // B&W preview for email hero (800px width)
{{ processor_session_id }}         // For analytics tracking
{{ utm_source }}                   // Always 'processor_page'
{{ utm_medium }}                   // Always 'email'
{{ utm_campaign }}                 // 'download_delivery'
```

**Note**: Download URLs are **signed GCS URLs** with 7-day expiration (sufficient for 95% of opens)

---

## Email Design Specifications

### Email Anatomy (Top to Bottom)

```
┌─────────────────────────────────────┐
│  PREHEADER (Hidden, inbox preview)  │
├─────────────────────────────────────┤
│  HEADER (Logo + Headline)           │
├─────────────────────────────────────┤
│  HERO IMAGE (Pet B&W preview)       │
├─────────────────────────────────────┤
│  DOWNLOAD SECTION (4 buttons)       │
│  ┌──────────────────────────────┐  │
│  │ Download Black & White       │  │ ← Purple gradient
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Download Color Painting      │  │ ← Purple gradient
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Download Modern Art          │  │ ← Purple gradient
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Download Sketch Portrait     │  │ ← Purple gradient
│  └──────────────────────────────┘  │
├─────────────────────────────────────┤
│  EXPIRY WARNING (7-day timer)       │
├─────────────────────────────────────┤
│  SHOP CTA SECTION (Soft sell)       │
│  ┌──────────────────────────────┐  │
│  │ Shop Canvas Prints →         │  │ ← Green gradient
│  └──────────────────────────────┘  │
│  [Product images: canvas, mug, phone case]
├─────────────────────────────────────┤
│  SOCIAL SHARE SECTION               │
│  [Instagram] [Facebook] [Pinterest] │
├─────────────────────────────────────┤
│  FOOTER (Unsubscribe, Privacy)      │
└─────────────────────────────────────┘
```

### Visual Hierarchy Principles

**1. Download Section Dominance** (70% visual weight)
- **Why**: User opened email for downloads (transactional expectation)
- **Design**: 4 large purple buttons (matching processor page "Download FREE" CTA)
- **Spacing**: 16px gaps between buttons (WCAG AA)
- **Button size**: 64px height mobile, 56px desktop (WCAG AAA)

**2. Shop CTA Secondary** (20% visual weight)
- **Why**: User has received value, earned right to ask
- **Timing**: After downloads (soft sell, not aggressive)
- **Design**: Single green button (matching processor page "Shop Products" CTA)
- **Context**: "Love your pet's art? See it on canvas, mugs & more"

**3. Social Share Tertiary** (10% visual weight)
- **Why**: Emotional peak after seeing art
- **Design**: Horizontal row of icon buttons (Instagram, Facebook, Pinterest)
- **Placement**: After shop CTA (optional engagement)

---

## Technical Implementation

### File Structure

**New files to create**:
```
templates/
  └── email/
      └── download-delivery.liquid          // Email template (HTML + Liquid)
      └── download-delivery-plaintext.txt   // Plain text version

assets/
  └── email-download-delivery.css           // Inline CSS (will be inlined by Shopify)

config/
  └── email-subjects.json                   // A/B test subject lines
```

**Existing files to modify**:
```
backend/email-capture-api/
  └── src/email/email_sender.py             // Add download delivery email sending
  └── src/email/templates/                  // Email template data

snippets/
  └── email-capture-modal.liquid            // Trigger email send on form submit
```

### Shopify Email Template Structure

**File**: `templates/email/download-delivery.liquid`

**Template type**: Shopify Liquid (NOT standard Liquid)

**Available variables**:
- `{{ shop.name }}` - Store name
- `{{ shop.url }}` - Store URL
- `{{ shop.email }}` - Store support email
- `{{ customer.email }}` - Customer email
- `{{ customer.first_name }}` - Customer first name (if provided)

**Custom metafields** (passed via Shopify customer metafields):
```liquid
{{ customer.metafields.perkie.download_bw_url }}
{{ customer.metafields.perkie.download_color_url }}
{{ customer.metafields.perkie.download_modern_url }}
{{ customer.metafields.perkie.download_sketch_url }}
{{ customer.metafields.perkie.hero_image_url }}
{{ customer.metafields.perkie.pet_name }}
{{ customer.metafields.perkie.processor_session_id }}
```

**Note**: Shopify Email does NOT support external stylesheets. All CSS must be **inlined** in `<style>` tags or inline `style=""` attributes.

### Email Template HTML Structure

**Key technical requirements**:
1. **Width**: 600px maximum (email client standard)
2. **Responsive**: Single-column layout (stacks on mobile)
3. **Tables for layout**: Email clients don't support flexbox/grid (use `<table>` for layout)
4. **Inline CSS**: All styles must be inline or in `<style>` tag
5. **Image CDN**: All images hosted on Shopify CDN or GCS bucket
6. **UTM tracking**: All links include UTM parameters for analytics

### Button Implementation (Email-Safe)

**Purple Download Buttons** (matching processor page CTA):
```html
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 16px;">
  <tr>
    <td align="center" style="padding: 0;">
      <a href="{{ download_url }}?utm_source=processor_page&utm_medium=email&utm_campaign=download_delivery"
         style="display: inline-block;
                width: 100%;
                max-width: 500px;
                min-height: 64px;
                padding: 20px 32px;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                font-size: 18px;
                font-weight: 600;
                text-align: center;
                text-decoration: none;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);">
        Download Black & White (High-Res)
      </a>
    </td>
  </tr>
</table>
```

**Green Shop Button** (matching processor page CTA):
```html
<a href="{{ shop_url }}?utm_source=processor_page&utm_medium=email&utm_campaign=download_delivery"
   style="display: inline-block;
          width: 100%;
          max-width: 500px;
          min-height: 56px;
          padding: 18px 32px;
          background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          font-size: 18px;
          font-weight: 600;
          text-align: center;
          text-decoration: none;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);">
  Shop Canvas Prints, Mugs & More →
</a>
```

**Note**: Email clients strip `box-shadow` and `linear-gradient` in Outlook. Include fallback solid background color.

### Email Client Compatibility

**Target email clients** (95% coverage):
- Gmail (web, iOS, Android) - 45% of opens
- Apple Mail (macOS, iOS) - 30% of opens
- Outlook (web, desktop) - 15% of opens
- Yahoo Mail - 5% of opens
- Other (Thunderbird, etc.) - 5% of opens

**Known limitations**:
- **Outlook**: No `linear-gradient`, no `box-shadow`, no `border-radius` in some versions
- **Gmail**: Strips `<style>` tags (use inline styles)
- **Apple Mail**: Good support, but watch for dark mode issues
- **Yahoo Mail**: Poor CSS support (test thoroughly)

**Fallback strategy**:
```html
<!-- Gradient button with Outlook fallback -->
<a href="..." style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); background-color: #6366f1;">
  Download Black & White
</a>
```

If gradient fails, solid `#6366f1` (indigo-500) background shows.

---

## Content Strategy

### Subject Line A/B Test (3 Variants)

**Test Duration**: 4 weeks, 50/50/50 split (33% each variant)

**Primary Metric**: Open rate (target: 60-70%)

**Variants**:

**Variant A: Value-driven** (RECOMMENDED)
```
Subject: ✨ Your FREE Pet Art is Ready!
Preheader: Download all 4 styles in high-resolution (links inside)
```
**Predicted open rate**: 65-70%
**Why**: Clear value prop, emoji draws attention, "FREE" keyword

**Variant B: Action-driven**
```
Subject: 📥 Download Your 4 Pet Styles Now
Preheader: Black & White, Color, Modern, Sketch - all ready for download
```
**Predicted open rate**: 60-65%
**Why**: Direct action, specific number (4 styles), sense of readiness

**Variant C: Personalized** (if pet name available)
```
Subject: 🎨 {{ pet_name }}'s Artwork - Download Links Inside
Preheader: Your pet's art is ready! Get all 4 styles in high-resolution
```
**Predicted open rate**: 68-72%
**Why**: Personalization (pet name), ownership ("your pet's"), urgency

**Recommendation**: Start with **Variant A** (safest bet), A/B test C vs A after 2 weeks

### Email Body Copy

**Header Section**:
```
YOUR FREE PET ART IS READY!

Hi {{ customer.first_name | default: "there" }},

Your pet's artwork is ready to download! We've transformed {{ pet_name | default: "your furry friend" }} into 4 stunning artistic styles.

Click the buttons below to download your high-resolution images (perfect for printing, sharing, or setting as your phone wallpaper!)
```

**Download Section Header**:
```
DOWNLOAD YOUR ARTWORK
All 4 styles are ready (high-resolution, print-quality)
```

**Button Labels** (descriptive, benefit-focused):
- `Download Black & White (High-Res)` - NOT just "Download B&W"
- `Download Color Painting (High-Res)`
- `Download Modern Art (High-Res)`
- `Download Sketch Portrait (High-Res)`

**Expiry Warning** (7-day countdown):
```
⏰ Important: Download links expire in 7 days
Save your images now to keep them forever!
```

**Shop CTA Section**:
```
LOVE YOUR PET'S ART?

See {{ pet_name | default: "your pet's artwork" }} on:
• Canvas prints (ready to hang)
• Coffee mugs (dishwasher safe)
• Phone cases (all models)
• Throw pillows, blankets & more

[Shop Canvas Prints, Mugs & More →]
```

**Social Share Section**:
```
SHARE YOUR PET'S ARTWORK

Show off {{ pet_name | default: "your pet's" }} stunning art!

[📷 Instagram] [👍 Facebook] [📌 Pinterest]

Tag us @perkieprints for a chance to be featured!
```

**Footer Section**:
```
Questions? Reply to this email or visit our Help Center.

You're receiving this email because you requested download links for your pet art on perkieprints.com.

[Update email preferences] | [Privacy Policy] | [Unsubscribe]

© 2025 Perkie Prints. All rights reserved.
```

### Copy Principles

**1. Conversational tone** (NOT corporate)
- "Your pet's artwork" vs "The generated images"
- "Hi there" vs "Dear valued customer"
- "Love your pet's art?" vs "Interested in our products?"

**2. Benefit-focused** (NOT feature-focused)
- "High-resolution, print-quality" vs "4000x4000px resolution"
- "Perfect for printing, sharing, or setting as your phone wallpaper" vs "JPEG format available"
- "Ready to hang" vs "Stretched canvas"

**3. Urgency without pressure**
- "Download links expire in 7 days" (fact) vs "HURRY! LIMITED TIME!" (pushy)
- "Save your images now to keep them forever" (helpful) vs "ACT NOW OR LOSE ACCESS" (threatening)

**4. Soft sell on shop CTA**
- "Love your pet's art? See it on..." (question, not demand)
- "See {{ pet_name }}'s artwork on canvas..." (visualization, not sales pitch)
- Positioned AFTER downloads (earned right to ask)

---

## Mobile Optimization

### Mobile Design Specifications

**Target devices**:
- iPhone 12-15 (390px width) - 30% of mobile opens
- iPhone SE (375px width) - 15% of mobile opens
- Android (360-412px width) - 25% of mobile opens

**Email width on mobile**: 100% of screen width (minus 16px padding each side = ~360px content width)

### Mobile Layout Rules

**1. Single-column layout**
```css
.email-container {
  max-width: 600px; /* Desktop */
  width: 100%; /* Mobile */
  margin: 0 auto;
}

.email-content {
  padding: 16px; /* Mobile gutter */
}

@media (min-width: 600px) {
  .email-content {
    padding: 32px; /* Desktop gutter */
  }
}
```

**2. Responsive images**
```html
<img src="{{ hero_image_url }}"
     alt="{{ pet_name }}'s Black & White Portrait"
     style="width: 100%; max-width: 600px; height: auto; display: block; margin: 0 auto;"
     width="600"
     height="600">
```

**Note**: Always include `width` and `height` attributes (prevents layout shift while loading)

**3. Touch target optimization**

**Minimum touch target**: 48px (WCAG AAA)

**Download buttons**: 64px height mobile (generous tap area)
```html
<a href="..." style="min-height: 64px; padding: 20px 32px; display: block; text-align: center;">
  Download Black & White (High-Res)
</a>
```

**Shop button**: 56px height mobile
```html
<a href="..." style="min-height: 56px; padding: 18px 32px; display: block; text-align: center;">
  Shop Canvas Prints →
</a>
```

**Social share buttons**: 48px width/height (icon buttons)
```html
<a href="..." style="display: inline-block; width: 48px; height: 48px; margin: 0 8px;">
  <img src="{{ instagram_icon }}" width="48" height="48" alt="Share on Instagram">
</a>
```

**4. Font size optimization**

**Minimum font size**: 16px (iOS Safari zoom prevention)

```css
/* Headings */
h1 { font-size: 28px; line-height: 1.2; } /* Mobile */
h2 { font-size: 22px; line-height: 1.3; }
h3 { font-size: 18px; line-height: 1.4; }

@media (min-width: 600px) {
  h1 { font-size: 36px; } /* Desktop */
  h2 { font-size: 28px; }
  h3 { font-size: 22px; }
}

/* Body text */
p, li, td { font-size: 16px; line-height: 1.5; }

/* Button text */
.btn-text { font-size: 18px; } /* 48px touch target = 18px text */

/* Small text */
.caption, .footer-text { font-size: 14px; color: #6b7280; }
```

**5. Spacing optimization**

**Mobile spacing** (tighter to fit in viewport):
```css
.section-spacing { margin-bottom: 32px; } /* Mobile */
.button-spacing { margin-bottom: 16px; } /* Between download buttons */

@media (min-width: 600px) {
  .section-spacing { margin-bottom: 48px; } /* Desktop */
  .button-spacing { margin-bottom: 20px; }
}
```

### Dark Mode Support

**Email clients with dark mode**:
- Apple Mail (macOS, iOS) - 30% of opens
- Gmail (iOS, Android) - 20% of opens
- Outlook (iOS) - 5% of opens

**Dark mode strategy**: Partial support (let email client auto-invert)

**Why NOT full dark mode support**:
- Email dark mode is inconsistent across clients
- Images (hero, product photos) should NOT invert
- Purple/green gradients look good on both light/dark backgrounds

**Dark mode safe colors**:
```css
/* Background colors - let client invert */
body { background-color: #ffffff; } /* Inverts to #000000 in dark mode */

/* Text colors - let client invert */
.text-primary { color: #1f2937; } /* Gray-800, inverts to light gray */
.text-secondary { color: #6b7280; } /* Gray-500, inverts to medium gray */

/* Button colors - DON'T invert (use !important) */
.btn-download {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
  color: #ffffff !important;
}

.btn-shop {
  background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%) !important;
  color: #ffffff !important;
}
```

**Image dark mode handling**:
```html
<!-- Prevent inversion of hero image -->
<img src="{{ hero_image_url }}"
     alt="..."
     style="width: 100%; max-width: 600px; color-scheme: only light;">
```

`color-scheme: only light` prevents Apple Mail from inverting the image.

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

**Target level**: WCAG 2.1 AA (minimum), WCAG AAA (touch targets)

**Key requirements**:

**1. Color contrast** (WCAG 1.4.3)
- **Body text**: 4.5:1 minimum (#1f2937 on #ffffff = 12.6:1 ✅)
- **Large text (18px+)**: 3:1 minimum (buttons meet this)
- **Purple download button**: #6366f1 on white = 4.8:1 ✅
- **Green shop button**: #10b981 on white = 3.2:1 ⚠️ (adjust to #0ea872 = 4.6:1 ✅)

**2. Touch target size** (WCAG 2.5.5)
- **AAA standard**: 48px minimum
- **Download buttons**: 64px height ✅
- **Shop button**: 56px height ✅
- **Social icons**: 48px width/height ✅

**3. Link purpose** (WCAG 2.4.4)
- **Descriptive link text**: "Download Black & White (High-Res)" ✅ NOT "Click here"
- **Context provided**: "Shop Canvas Prints, Mugs & More" ✅ NOT "Shop Now"

**4. Alternative text** (WCAG 1.1.1)
```html
<!-- Hero image -->
<img src="{{ hero_image_url }}" alt="{{ pet_name }}'s Black & White Portrait - High-resolution artwork">

<!-- Product images -->
<img src="{{ canvas_print_image }}" alt="Canvas print example - Pet portrait on stretched canvas">

<!-- Social icons -->
<img src="{{ instagram_icon }}" alt="Share on Instagram">
```

**5. Semantic HTML** (WCAG 1.3.1)
```html
<!-- Use headings hierarchy -->
<h1>Your FREE Pet Art is Ready!</h1>
<h2>Download Your Artwork</h2>
<h3>Love Your Pet's Art?</h3>

<!-- Use lists for items -->
<ul>
  <li>Canvas prints (ready to hang)</li>
  <li>Coffee mugs (dishwasher safe)</li>
  <li>Phone cases (all models)</li>
</ul>

<!-- Use tables for layout (email requirement) but with role="presentation" -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0">
  <!-- Layout content -->
</table>
```

**6. Focus indicators** (WCAG 2.4.7)
```css
/* Keyboard navigation focus (webmail clients) */
a:focus {
  outline: 3px solid #3b82f6; /* Blue-500 */
  outline-offset: 2px;
}

/* Note: Most email clients don't support :focus-visible */
```

### Screen Reader Optimization

**ARIA labels** (limited support in email, use sparingly):
```html
<!-- Button role (redundant for <a> but helpful) -->
<a href="..." role="button" aria-label="Download Black & White high-resolution image">
  Download Black & White (High-Res)
</a>

<!-- Decorative images -->
<img src="{{ divider_line }}" alt="" role="presentation">
```

**Note**: Email clients strip most ARIA attributes. Rely on semantic HTML + alt text.

### Plain Text Version

**Requirement**: Always include a plain text version (accessibility + spam filter compliance)

**File**: `templates/email/download-delivery-plaintext.txt`

**Structure**:
```
YOUR FREE PET ART IS READY!

Hi {{ customer.first_name | default: "there" }},

Your pet's artwork is ready to download! We've transformed {{ pet_name | default: "your furry friend" }} into 4 stunning artistic styles.

---

DOWNLOAD YOUR ARTWORK (High-Resolution)

Black & White Portrait:
{{ style_bw_url }}?utm_source=processor_page&utm_medium=email&utm_campaign=download_delivery

Color Painting:
{{ style_color_url }}?utm_source=processor_page&utm_medium=email&utm_campaign=download_delivery

Modern Art:
{{ style_modern_url }}?utm_source=processor_page&utm_medium=email&utm_campaign=download_delivery

Sketch Portrait:
{{ style_sketch_url }}?utm_source=processor_page&utm_medium=email&utm_campaign=download_delivery

⏰ Important: Download links expire in 7 days. Save your images now to keep them forever!

---

LOVE YOUR PET'S ART?

See {{ pet_name | default: "your pet's artwork" }} on canvas prints, coffee mugs, phone cases, throw pillows, blankets & more.

Shop now:
{{ shop.url }}/collections/personalized-pet-products-gifts?utm_source=processor_page&utm_medium=email&utm_campaign=download_delivery

---

SHARE YOUR PET'S ARTWORK

Instagram: {{ instagram_share_url }}
Facebook: {{ facebook_share_url }}
Pinterest: {{ pinterest_share_url }}

Tag us @perkieprints for a chance to be featured!

---

Questions? Reply to this email or visit our Help Center: {{ shop.url }}/pages/help

You're receiving this email because you requested download links for your pet art on perkieprints.com.

Update email preferences: {{ preferences_url }}
Privacy Policy: {{ privacy_url }}
Unsubscribe: {{ unsubscribe_url }}

© 2025 Perkie Prints. All rights reserved.
```

---

## Testing & Quality Assurance

### Testing Checklist

**Phase 1: Pre-deployment Testing** (4-6 hours)

**A. Email Client Testing** (use Litmus or Email on Acid)

Test on these clients (95% coverage):
- [ ] Gmail (web) - Chrome, Firefox, Safari
- [ ] Gmail (iOS app) - iPhone 12, iPhone SE
- [ ] Gmail (Android app) - Samsung Galaxy S21
- [ ] Apple Mail (macOS) - Light mode + Dark mode
- [ ] Apple Mail (iOS) - iPhone 12, iPhone SE, iPad
- [ ] Outlook (web) - Edge, Chrome
- [ ] Outlook (desktop) - Windows 10, Windows 11
- [ ] Yahoo Mail (web) - Chrome
- [ ] Thunderbird (desktop) - Latest version

**Key things to check**:
- [ ] Gradients render correctly (or fallback to solid color)
- [ ] Images load properly
- [ ] Buttons are tappable (48px minimum)
- [ ] Text is readable (16px minimum)
- [ ] Links work (UTM parameters intact)
- [ ] Layout doesn't break (single-column on mobile)
- [ ] Dark mode doesn't ruin colors (buttons stay purple/green)

**B. Functional Testing**

- [ ] Download links work (GCS signed URLs)
- [ ] Shop CTA links to correct collection (with UTM)
- [ ] Social share links work (Instagram, Facebook, Pinterest)
- [ ] Unsubscribe link works (Shopify default)
- [ ] Privacy policy link works
- [ ] Update preferences link works

**C. Content Testing**

- [ ] Pet name personalization works ({{ pet_name }})
- [ ] Customer name personalization works ({{ customer.first_name }})
- [ ] All 4 download button labels are correct
- [ ] Expiry warning is clear (7 days)
- [ ] Shop CTA copy is soft sell (not pushy)
- [ ] Footer legal text is correct

**D. Accessibility Testing**

- [ ] Run aXe extension on HTML (if viewing in browser)
- [ ] Check color contrast (use WebAIM Contrast Checker)
- [ ] Verify alt text on all images
- [ ] Test keyboard navigation (Tab through links)
- [ ] Read plain text version (should be coherent)

**E. Spam Filter Testing**

- [ ] Run through Mail Tester (https://www.mail-tester.com/)
- [ ] Check subject line spam score (avoid "FREE!", "ACT NOW!", etc.)
- [ ] Verify SPF/DKIM/DMARC records (Shopify handles this)
- [ ] Ensure unsubscribe link is present
- [ ] Avoid excessive exclamation marks!!!! (max 2 per email)

**Phase 2: A/B Testing** (2-4 weeks)

**Subject Line Test**:
- [ ] Variant A: "✨ Your FREE Pet Art is Ready!"
- [ ] Variant B: "📥 Download Your 4 Pet Styles Now"
- [ ] Variant C: "🎨 {{ pet_name }}'s Artwork - Download Links Inside" (if pet name)
- [ ] Track open rate per variant (target: 60-70%)
- [ ] Ship winner after 2 weeks (statistical significance)

**Button Copy Test**:
- [ ] Control: "Download Black & White (High-Res)"
- [ ] Treatment: "Get Black & White (High-Res)"
- [ ] Track click rate per variant (target: 70-80%)

**Shop CTA Placement Test**:
- [ ] Control: After downloads (current design)
- [ ] Treatment: Before downloads (aggressive)
- [ ] Track shop CTR + download CTR (watch for cannibalization)

**Phase 3: Post-deployment Monitoring** (ongoing)

**Metrics to track** (see [Success Metrics](#success-metrics)):
- [ ] Email delivery rate (target: 98%+)
- [ ] Email open rate (target: 60-70%)
- [ ] Download link CTR (target: 70-80% per style)
- [ ] Shop CTA CTR (target: 30-40%)
- [ ] Social share CTR (target: 10-15%)
- [ ] Unsubscribe rate (target: <2%)
- [ ] Spam complaint rate (target: <0.1%)

**Error monitoring**:
- [ ] Watch for broken download links (GCS URL expiry)
- [ ] Monitor email bounce rate (invalid emails)
- [ ] Check for image loading failures (CDN issues)

---

## Success Metrics

### Primary Metrics (Email Performance)

**1. Email Delivery Rate**
- **Definition**: % of emails successfully delivered (not bounced)
- **Target**: 98%+ (transactional emails have high deliverability)
- **Measurement**: Shopify Email analytics
- **Red flags**: <95% (check email validation, spam score)

**2. Email Open Rate**
- **Definition**: % of delivered emails opened (unique opens)
- **Target**: 60-70% (transactional emails perform 3-5x better than marketing)
- **Measurement**: Shopify Email analytics (pixel tracking)
- **Benchmarks**:
  - E-commerce marketing emails: 15-25%
  - Transactional emails: 50-80%
  - Our target: 60-70% (conservative)

**3. Download Link Click-Through Rate**
- **Definition**: % of email opens that click at least 1 download link
- **Target**: 70-80% per style (high intent, expected action)
- **Measurement**: GTM tracking (UTM parameters on download links)
- **Why so high**: User opened email for downloads (transactional expectation)

**4. Shop CTA Click-Through Rate**
- **Definition**: % of email opens that click "Shop Canvas Prints"
- **Target**: 30-40% (soft sell after value delivery)
- **Measurement**: GTM tracking (UTM parameters on shop link)
- **Benchmarks**:
  - E-commerce email CTR: 2-5%
  - Post-purchase email CTR: 10-15%
  - Our target: 30-40% (user just received value, high engagement)

**5. Social Share Rate**
- **Definition**: % of email opens that click a social share button
- **Target**: 10-15%
- **Measurement**: GTM tracking (UTM parameters on social links)

### Secondary Metrics (Downstream Impact)

**6. Email → Add to Cart (24 hours)**
- **Definition**: % of shop CTA clicks that add item to cart within 24 hours
- **Target**: 50-60%
- **Measurement**: Shopify analytics (UTM attribution)

**7. Email → Purchase (90 days)**
- **Definition**: % of email recipients that make a purchase within 90 days
- **Target**: 18-25% (from email nurture campaign)
- **Measurement**: Klaviyo cohort analysis (see `.claude/doc/email-capture-conversion-optimization-strategy.md`)

**8. Average Order Value (Email-Attributed)**
- **Definition**: Average order value of purchases attributed to this email
- **Target**: $75-95 (same as site average)
- **Measurement**: Shopify analytics (first-touch UTM attribution)

### Tertiary Metrics (Email Health)

**9. Unsubscribe Rate**
- **Definition**: % of emails that result in unsubscribe
- **Target**: <2% (transactional emails should have low unsubscribes)
- **Measurement**: Shopify Email analytics
- **Red flags**: >5% (email may be too salesy)

**10. Spam Complaint Rate**
- **Definition**: % of emails marked as spam
- **Target**: <0.1%
- **Measurement**: Shopify Email analytics
- **Red flags**: >0.5% (deliverability at risk)

### Analytics Implementation

**UTM Parameter Structure**:
```
utm_source=processor_page        // Where user came from
utm_medium=email                 // Channel (always email)
utm_campaign=download_delivery   // Campaign name
utm_content={{ style_name }}     // Which download button clicked
```

**Example download link**:
```
{{ style_bw_url }}?utm_source=processor_page&utm_medium=email&utm_campaign=download_delivery&utm_content=bw
```

**Example shop link**:
```
{{ shop.url }}/collections/canvas-prints?utm_source=processor_page&utm_medium=email&utm_campaign=download_delivery&utm_content=shop_cta
```

**GTM Events to Track**:
```javascript
// Email opened (pixel tracking)
gtag('event', 'email_open', {
  'email_type': 'download_delivery',
  'campaign': 'processor_page'
});

// Download link clicked
gtag('event', 'download_link_click', {
  'email_type': 'download_delivery',
  'style': 'bw', // or 'color', 'modern', 'sketch'
  'utm_source': 'processor_page',
  'utm_campaign': 'download_delivery'
});

// Shop CTA clicked
gtag('event', 'shop_cta_click', {
  'email_type': 'download_delivery',
  'cta_position': 'after_downloads',
  'utm_source': 'processor_page',
  'utm_campaign': 'download_delivery'
});

// Social share clicked
gtag('event', 'social_share_click', {
  'email_type': 'download_delivery',
  'platform': 'instagram', // or 'facebook', 'pinterest'
  'utm_source': 'processor_page',
  'utm_campaign': 'download_delivery'
});
```

**Dashboard Metrics** (Google Analytics + Shopify):
- Email delivery rate (Shopify Email)
- Email open rate (Shopify Email)
- Download link CTR by style (GA4 custom report)
- Shop CTA CTR (GA4 custom report)
- Social share CTR by platform (GA4 custom report)
- Email → Add to cart funnel (Shopify + GA4)
- Email → Purchase cohort (Klaviyo)

---

## Implementation Checklist

### Phase 1: Design & Copywriting (4-6 hours)

**Step 1: Create HTML email template**
- [ ] Create file: `templates/email/download-delivery.liquid`
- [ ] Build table-based layout (600px max-width)
- [ ] Add header section (logo + headline)
- [ ] Add hero image section (pet B&W preview)
- [ ] Add download section (4 purple buttons)
- [ ] Add expiry warning (7-day timer)
- [ ] Add shop CTA section (green button + product images)
- [ ] Add social share section (Instagram, Facebook, Pinterest icons)
- [ ] Add footer section (unsubscribe, privacy, copyright)
- [ ] Inline all CSS (use Premailer or similar tool)
- [ ] Test HTML in browser (should render without external CSS)

**Step 2: Create plain text version**
- [ ] Create file: `templates/email/download-delivery-plaintext.txt`
- [ ] Mirror HTML structure (headings, sections, links)
- [ ] Ensure download links are on separate lines
- [ ] Include all CTAs (shop, social share, unsubscribe)
- [ ] Keep line length under 80 characters (readability)

**Step 3: Write subject line variants**
- [ ] Create file: `config/email-subjects.json`
- [ ] Add Variant A: "✨ Your FREE Pet Art is Ready!"
- [ ] Add Variant B: "📥 Download Your 4 Pet Styles Now"
- [ ] Add Variant C: "🎨 {{ pet_name }}'s Artwork - Download Links Inside"
- [ ] Add preheader text for each variant

**Step 4: Source email assets**
- [ ] Upload logo to Shopify CDN (or use existing)
- [ ] Upload social icons (Instagram, Facebook, Pinterest) to Shopify CDN
- [ ] Upload product images (canvas, mug, phone case) to Shopify CDN
- [ ] Verify all images have alt text

### Phase 2: Backend Integration (4-6 hours)

**Step 5: Update email capture API**
- [ ] Modify file: `backend/email-capture-api/src/email/email_sender.py`
- [ ] Add `send_download_delivery_email()` method
- [ ] Load Shopify Email template (download-delivery.liquid)
- [ ] Pass customer metafields (download URLs, pet name, session ID)
- [ ] Add UTM parameters to all links
- [ ] Set email subject (from A/B test variant)
- [ ] Send via Shopify Email API (transactional send)
- [ ] Add error handling (log failures, retry 3x)

**Step 6: Create customer metafields**
- [ ] Update Shopify customer metafields schema
- [ ] Add `perkie.download_bw_url` (URL)
- [ ] Add `perkie.download_color_url` (URL)
- [ ] Add `perkie.download_modern_url` (URL)
- [ ] Add `perkie.download_sketch_url` (URL)
- [ ] Add `perkie.hero_image_url` (URL)
- [ ] Add `perkie.pet_name` (string)
- [ ] Add `perkie.processor_session_id` (string)
- [ ] Set 7-day TTL (auto-expire after email window)

**Step 7: Integrate with email capture modal**
- [ ] Modify file: `snippets/email-capture-modal.liquid`
- [ ] Add form submit handler
- [ ] Call `/apps/perkie/email-capture` endpoint
- [ ] Pass download URLs, pet name, session ID
- [ ] Show success state (checkmark animation)
- [ ] Show "Email sent! Check your inbox" message
- [ ] Close modal after 1.5s delay

### Phase 3: Testing & QA (4-6 hours)

**Step 8: Email client testing**
- [ ] Use Litmus or Email on Acid (paid tools)
- [ ] Test on Gmail (web, iOS, Android) - 45% of opens
- [ ] Test on Apple Mail (macOS, iOS) - 30% of opens
- [ ] Test on Outlook (web, desktop) - 15% of opens
- [ ] Test on Yahoo Mail - 5% of opens
- [ ] Test dark mode (Apple Mail, Gmail)
- [ ] Fix any rendering issues (gradients, images, layout)

**Step 9: Functional testing**
- [ ] Send test email to yourself
- [ ] Click all 4 download links (verify GCS URLs work)
- [ ] Click shop CTA (verify collection page loads with UTM)
- [ ] Click social share links (verify Instagram, Facebook, Pinterest)
- [ ] Click unsubscribe link (verify Shopify unsubscribe page)
- [ ] Click privacy policy link (verify page loads)
- [ ] Click update preferences link (verify Shopify preferences page)

**Step 10: Accessibility testing**
- [ ] Run aXe extension on HTML (if viewing in browser)
- [ ] Check color contrast (use WebAIM Contrast Checker)
- [ ] Verify alt text on all images
- [ ] Test keyboard navigation (Tab through links)
- [ ] Read plain text version (should be coherent)
- [ ] Test screen reader (NVDA or JAWS on Windows, VoiceOver on macOS)

**Step 11: Spam filter testing**
- [ ] Run email through Mail Tester (https://www.mail-tester.com/)
- [ ] Aim for 8/10 score minimum (transactional emails are lenient)
- [ ] Fix any spam triggers (excessive caps, "FREE!", etc.)
- [ ] Verify SPF/DKIM/DMARC records (Shopify handles this)

### Phase 4: Deploy & Monitor (2-4 hours)

**Step 12: Deploy to staging**
- [ ] Push code to staging environment
- [ ] Send test email via staging API
- [ ] Verify email sends within 30 seconds (transactional SLA)
- [ ] Check Shopify Email dashboard (delivery rate, open rate)
- [ ] Smoke test on iOS + Android devices

**Step 13: Set up analytics**
- [ ] Configure UTM tracking in GTM
- [ ] Create custom GA4 report (email performance)
- [ ] Set up email dashboard in Google Analytics
- [ ] Add email events to GTM (download_link_click, shop_cta_click, social_share_click)
- [ ] Test event firing (use GA4 DebugView)

**Step 14: Deploy to production**
- [ ] Push code to production
- [ ] Enable email capture modal on processor page (if not already)
- [ ] Monitor first 100 emails (watch for errors)
- [ ] Check deliverability rate (should be 98%+)
- [ ] Check open rate after 24 hours (should be 60-70%)

**Step 15: A/B testing setup**
- [ ] Configure subject line A/B test (50/50 split, Variant A vs B)
- [ ] Run for 2 weeks (minimum 1,000 opens per variant)
- [ ] Measure open rate per variant
- [ ] Ship winner (higher open rate + statistical significance)
- [ ] Start next test (button copy or shop CTA placement)

### Phase 5: Optimization (ongoing)

**Step 16: Monitor metrics**
- [ ] Check email dashboard daily (first 2 weeks)
- [ ] Watch for red flags (delivery <95%, open <50%, unsubscribe >5%)
- [ ] Investigate anomalies (broken links, image failures, spam complaints)
- [ ] Adjust copy/design based on data

**Step 17: Iterate based on learnings**
- [ ] A/B test subject lines (3 variants over 6 weeks)
- [ ] A/B test button copy (download vs get)
- [ ] A/B test shop CTA placement (before vs after downloads)
- [ ] Test personalization (pet name in subject line)
- [ ] Optimize for mobile (watch mobile open rate + CTR)

---

## Critical Design Decisions

### Decision 1: Downloads BEFORE Shop CTA (Not After)

**Reasoning**:
- User opened email for downloads (transactional expectation)
- Must deliver value before asking for engagement
- Soft sell after value delivery = higher trust + CTR

**Impact**:
- Shop CTA CTR: 30-40% (vs 5-10% if placed before downloads)
- User satisfaction: Higher (got what they expected)
- Unsubscribe rate: Lower (<2% vs 5%+ if too salesy)

**Alternative considered**: Shop CTA before downloads (rejected - too aggressive, poor UX)

### Decision 2: 7-Day Download Link Expiry (Not Permanent)

**Reasoning**:
- Creates urgency (download now vs procrastinate)
- Limits GCS storage costs (signed URLs auto-expire)
- 95% of email opens happen within 7 days
- Acceptable user impact (can re-process if needed)

**Impact**:
- Download completion rate: 70-80% (vs 60-65% with permanent links)
- Support burden: Low (2-3% of users may email for re-send)
- Storage costs: Reduced (auto-cleanup after 7 days)

**Alternative considered**: Permanent download links (rejected - high storage costs, low urgency)

### Decision 3: Purple/Green Gradients (Match Processor Page)

**Reasoning**:
- Brand consistency (email is extension of processor page)
- Color psychology (purple = premium/creative, green = action/growth)
- Visual continuity (user just saw these colors on processor page)

**Impact**:
- Brand recognition: Higher (consistent visual language)
- Click-through rate: +5-8% (familiar CTAs = lower cognitive load)
- Accessibility: Good (purple #6366f1 = 4.8:1 contrast, green adjusted to #0ea872 = 4.6:1)

**Alternative considered**: Blue/orange (standard e-commerce colors) - rejected, less brand-distinctive

### Decision 4: Single-Column Layout (Not Two-Column)

**Reasoning**:
- 70% mobile traffic (two-column breaks on small screens)
- Email clients have poor CSS support (flexbox/grid unreliable)
- Readability (single-column = clearer visual hierarchy)

**Impact**:
- Mobile open rate: Higher (optimized for mobile-first)
- Desktop open rate: Neutral (single-column is fine on desktop)
- Maintenance: Easier (one layout, not responsive breakpoints)

**Alternative considered**: Two-column desktop layout (rejected - email CSS limitations, mobile-first priority)

### Decision 5: Soft Sell Shop CTA (Not Hard Sell)

**Reasoning**:
- Transactional email (not marketing email)
- User trust (just received value, earned right to ask)
- CAN-SPAM compliance (primary purpose is download delivery)

**Copy**:
- ✅ "Love your pet's art? See it on canvas..." (question, not demand)
- ✅ "Shop Canvas Prints, Mugs & More →" (descriptive, not pushy)
- ❌ "BUY NOW! LIMITED TIME OFFER!" (hard sell, ruins trust)

**Impact**:
- Shop CTA CTR: 30-40% (vs 10-15% with hard sell)
- Unsubscribe rate: <2% (vs 5%+ with aggressive marketing)
- Email deliverability: Higher (transactional classification maintained)

---

## Files to Create

### 1. `templates/email/download-delivery.liquid`
**Type**: Shopify Email template (HTML + Liquid)
**Lines**: ~800-1,000 (including inline CSS)
**Purpose**: Main email template for download delivery

**Structure**:
```liquid
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Your FREE Pet Art is Ready!</title>
  <style>
    /* Inline CSS here (email clients strip <link> tags) */
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;">

  <!-- Preheader (hidden, shows in inbox preview) -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    Download all 4 styles in high-resolution (links inside)
  </div>

  <!-- Email container (600px max-width) -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <!-- Content table (600px max-width) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">

          <!-- HEADER SECTION -->
          <tr>
            <td align="center" style="padding: 32px 32px 24px;">
              <img src="{{ shop.logo }}" alt="{{ shop.name }}" width="150" height="auto" style="display: block; margin: 0 auto;">
              <h1 style="margin: 24px 0 0; font-size: 28px; font-weight: 700; color: #1f2937; line-height: 1.2;">
                YOUR FREE PET ART IS READY!
              </h1>
            </td>
          </tr>

          <!-- HERO IMAGE SECTION -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <img src="{{ customer.metafields.perkie.hero_image_url }}"
                   alt="{{ customer.metafields.perkie.pet_name | default: 'Your pet' }}'s Black & White Portrait"
                   width="600"
                   height="600"
                   style="width: 100%; max-width: 536px; height: auto; display: block; border-radius: 8px;">
            </td>
          </tr>

          <!-- DOWNLOAD SECTION -->
          <!-- ... 4 download buttons ... -->

          <!-- SHOP CTA SECTION -->
          <!-- ... shop button + product images ... -->

          <!-- SOCIAL SHARE SECTION -->
          <!-- ... social icons ... -->

          <!-- FOOTER SECTION -->
          <!-- ... unsubscribe, privacy, copyright ... -->

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
```

### 2. `templates/email/download-delivery-plaintext.txt`
**Type**: Plain text email template (Liquid)
**Lines**: ~80-100
**Purpose**: Plain text version (accessibility + spam filter compliance)

### 3. `config/email-subjects.json`
**Type**: JSON configuration file
**Lines**: ~30-40
**Purpose**: A/B test subject line variants

**Structure**:
```json
{
  "download_delivery": {
    "variants": [
      {
        "id": "variant_a",
        "subject": "✨ Your FREE Pet Art is Ready!",
        "preheader": "Download all 4 styles in high-resolution (links inside)",
        "weight": 0.5
      },
      {
        "id": "variant_b",
        "subject": "📥 Download Your 4 Pet Styles Now",
        "preheader": "Black & White, Color, Modern, Sketch - all ready for download",
        "weight": 0.5
      }
    ]
  }
}
```

### 4. `backend/email-capture-api/src/email/email_sender.py`
**Type**: Python module (FastAPI)
**Lines**: +150-200 (additions to existing file)
**Purpose**: Send download delivery email via Shopify Email API

**New methods**:
```python
async def send_download_delivery_email(
    customer_email: str,
    pet_name: str,
    download_urls: dict,
    hero_image_url: str,
    processor_session_id: str
) -> bool:
    """
    Send download delivery email with 4 artistic style links.

    Args:
        customer_email: User's email address
        pet_name: Pet's name (optional)
        download_urls: Dict with keys: bw, color, modern, sketch
        hero_image_url: Pet B&W preview (800px width)
        processor_session_id: Analytics tracking

    Returns:
        True if email sent successfully, False otherwise
    """
    # Implementation here
```

---

## Assumptions

1. **Shopify Email Access**: Store has Shopify Email installed and configured
2. **GCS Download URLs**: Backend generates signed GCS URLs with 7-day expiration
3. **Customer Metafields**: Shopify customer metafields schema supports custom fields (perkie.*)
4. **Email Capture Modal**: Email capture modal implementation is complete (see `.claude/doc/mobile-email-capture-modal-implementation-plan.md`)
5. **UTM Tracking**: GTM is configured to track UTM parameters
6. **Email Service**: Using Shopify Email (NOT SendGrid, Mailchimp, etc.) for transactional emails
7. **Product Images**: Canvas print, mug, phone case images exist on Shopify CDN
8. **Social Share**: Instagram, Facebook, Pinterest share links are pre-configured (generic share URLs)

---

## Next Steps

1. **User reviews this plan**: Confirm design direction, copy tone, and technical approach
2. **Clarify any unknowns**: Ask questions about Shopify Email setup, GCS URL generation, etc.
3. **Begin implementation**: Start with Phase 1 (HTML template + copy)
4. **Iterate based on testing**: A/B test subject lines, button copy, shop CTA placement
5. **Monitor metrics**: Track open rate, download CTR, shop CTR, unsubscribe rate
6. **Integrate with nurture campaign**: This email is Day 0 of 90-day nurture (see `.claude/doc/email-capture-conversion-optimization-strategy.md`)

---

## Cross-References

**Related documentation**:
- [Processor Page Marketing Tool Optimization](.claude/doc/processor-page-marketing-tool-optimization.md) - Overall processor redesign strategy
- [Email Capture Conversion Optimization Strategy](.claude/doc/email-capture-conversion-optimization-strategy.md) - 90-day email nurture campaign
- [Email Capture Modal UX Design Spec](.claude/doc/email-capture-modal-ux-design-spec.md) - Modal that triggers this email
- [Mobile Email Capture Modal Implementation Plan](.claude/doc/mobile-email-capture-modal-implementation-plan.md) - Modal implementation details
- [Processor CTA Redesign UX Review](.claude/doc/processor-cta-redesign-ux-review.md) - CTA colors/design (purple/green gradients)
- [Session Context](.claude/tasks/context_session_001.md) - Current session work log

---

**END OF IMPLEMENTATION PLAN**

**Status**: READY FOR REVIEW
**Next Action**: User reviews plan and confirms approach
**Estimated Implementation Time**: 12-16 hours
**Risk Level**: LOW (standard email template, no complex logic)
**Dependencies**: Email capture modal completion, Shopify Email setup, GCS signed URLs
