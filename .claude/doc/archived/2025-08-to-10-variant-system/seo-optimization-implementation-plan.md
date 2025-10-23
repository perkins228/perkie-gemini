# SEO Optimization Implementation Plan - Perkie Prints Shopify Store

**Date**: 2025-10-04
**Session**: 1736094648
**Priority**: Non-breaking improvements to enhance organic search visibility
**Business Context**: 70% mobile traffic, FREE AI pet background removal as conversion tool

---

## Executive Summary

This plan outlines **18 high-impact SEO improvements** that can be implemented without affecting core functionality. Recommendations are prioritized by expected impact and implementation effort, with special focus on:

1. **Mobile-first optimization** (70% of traffic is mobile)
2. **Target keyword integration** for pet photography and background removal
3. **Technical SEO foundations** (schema markup, meta tags, internal linking)
4. **Core Web Vitals** optimization for ranking signals
5. **Content gaps** for educational/informational queries

**Key Target Keywords**:
- "free pet background remover" (primary conversion driver)
- "how to take good pet photos" (informational, high intent)
- "best pet photos for custom products" (commercial intent)
- "pet photography tips" (informational, top-of-funnel)
- "choosing photos for pet portraits" (commercial, mid-funnel)

---

## Current State Analysis

### ✅ What's Working Well

1. **Canonical URLs**: Properly implemented (`<link rel="canonical" href="{{ canonical_url }}">`)
2. **Mobile Viewport**: Correctly configured meta viewport tag
3. **Image Alt Text**: Present on product cards and media (62 instances found)
4. **Lazy Loading**: Implemented on images for performance
5. **Open Graph Tags**: Basic OG tags present in `snippets/meta-tags.liquid`
6. **Structured Data**: FAQ schema exists on `photo-guide.liquid` section
7. **Responsive Images**: Proper srcset and sizes implementation
8. **Critical CSS**: Inline critical styles to reduce render blocking

### ⚠️ Issues Identified

#### **HIGH PRIORITY**

1. **Missing Product Schema Markup**
   - No JSON-LD Product schema on product pages
   - Missing price, availability, review aggregation data
   - **Impact**: Lost rich snippet opportunities in SERPs

2. **Generic/Missing Meta Descriptions**
   - Only basic page_description variable, no custom descriptions per template
   - **Impact**: Lower CTR from search results

3. **Title Tag Optimization Gaps**
   - Title structure is: `{{ page_title }} – {{ shop.name }}`
   - No keyword-optimized titles for landing pages
   - **Impact**: Missing keyword relevance signals

4. **Missing Breadcrumb Schema**
   - Breadcrumb navigation exists (`snippets/ks-breadcrumb.liquid`) but no structured data
   - **Impact**: Lost breadcrumb rich snippets in search

5. **No Robots.txt File Found**
   - Cannot control crawler behavior or sitemap location
   - **Impact**: Potential crawl budget waste

6. **Weak Internal Linking Structure**
   - No strategic internal linking between pet background remover and products
   - Missing contextual links for keyword targeting
   - **Impact**: Reduced page authority distribution

#### **MEDIUM PRIORITY**

7. **Page Speed Optimization Opportunities**
   - 128 CSS/JS asset files (potential for consolidation)
   - No font-display: swap on Google Fonts (partially implemented)
   - **Impact**: Core Web Vitals scores affect rankings

8. **Image Optimization**
   - Alt text present but could be more descriptive/keyword-rich
   - No explicit width/height on all images (some present)
   - **Impact**: Image search visibility and CLS

9. **Missing How-To Schema**
   - Photo guide section has educational content but no HowTo schema
   - **Impact**: Lost rich snippet for "how to take good pet photos"

10. **No Organization Schema**
    - Missing brand/organization markup in footer
    - **Impact**: Knowledge Graph opportunities

11. **Limited Heading Hierarchy**
    - Some pages may have H1 duplication (product title appears twice in main-product.liquid lines 113-118)
    - **Impact**: Reduced semantic clarity for search engines

12. **Missing XML Sitemap Reference**
    - No reference found in theme code (Shopify auto-generates at /sitemap.xml)
    - **Impact**: Potential indexation delays

#### **LOW PRIORITY**

13. **Twitter Card Optimization**
    - Basic twitter:card present but missing product-specific data
    - **Impact**: Lower social media CTR

14. **Missing Video Schema**
    - If product demos exist, no VideoObject markup
    - **Impact**: Lost video rich snippets

15. **Hreflang Tags**
    - Not currently needed (single market) but future consideration
    - **Impact**: International expansion readiness

---

## Implementation Recommendations

### **Phase 1: Quick Wins (High Impact, Low Effort)** — 4-8 hours

#### 1. Add Product Schema Markup
**File**: `sections/main-product.liquid`
**Location**: After line 61 (after model viewer section)
**Priority**: 🔴 CRITICAL
**Impact**: ⭐⭐⭐⭐⭐ High
**Effort**: ⏱️ 1-2 hours

**Implementation**:
```liquid
{%- if product -%}
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": {{ product.title | json }},
    "description": {{ product.description | strip_html | truncatewords: 50 | json }},
    "image": [
      {%- for image in product.images limit: 5 -%}
        {{ image | image_url: width: 1200 | prepend: 'https:' | json }}
        {%- unless forloop.last -%},{%- endunless -%}
      {%- endfor -%}
    ],
    "brand": {
      "@type": "Brand",
      "name": {{ shop.name | json }}
    },
    "offers": {
      "@type": "Offer",
      "url": {{ product.url | within: collection | prepend: request.origin | json }},
      "priceCurrency": {{ cart.currency.iso_code | json }},
      "price": {{ product.selected_or_first_available_variant.price | divided_by: 100.0 | json }},
      "availability": "{% if product.selected_or_first_available_variant.available %}https://schema.org/InStock{% else %}https://schema.org/OutOfStock{% endif %}",
      "priceValidUntil": "{{ 'now' | date: '%s' | plus: 31536000 | date: '%Y-%m-%d' }}"
    }
    {%- if product.metafields.reviews.rating.value -%}
    ,"aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": {{ product.metafields.reviews.rating.value | json }},
      "reviewCount": {{ product.metafields.reviews.count.value | default: 1 | json }}
    }
    {%- endif -%}
  }
  </script>
{%- endif -%}
```

**Notes**:
- Add after existing schema markup sections
- Uses Shopify's standard review metafields (if app installed)
- Validates with Google Rich Results Test
- Include SKU/GTIN if available in product metafields

---

#### 2. Add Breadcrumb Schema Markup
**File**: `snippets/ks-breadcrumb.liquid`
**Location**: End of file
**Priority**: 🟠 HIGH
**Impact**: ⭐⭐⭐⭐ Medium-High
**Effort**: ⏱️ 30-60 minutes

**Implementation**:
Add at the end of the breadcrumb snippet:
```liquid
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "{{ shop.url }}"
    }
    {%- if collection -%}
    ,{
      "@type": "ListItem",
      "position": 2,
      "name": {{ collection.title | json }},
      "item": "{{ collection.url | prepend: shop.url }}"
    }
    {%- endif -%}
    {%- if product -%}
    ,{
      "@type": "ListItem",
      "position": {{ 2 | plus: 1 }},
      "name": {{ product.title | json }},
      "item": "{{ product.url | prepend: shop.url }}"
    }
    {%- endif -%}
  ]
}
</script>
```

**Notes**:
- Dynamically adjusts position based on page type
- Test with Google Rich Results Test
- Ensure breadcrumb navigation is visible on page

---

#### 3. Optimize Meta Descriptions
**Files**:
- `templates/page.pet-background-remover.json`
- `templates/product.json`
- `templates/collection.json`
- `templates/index.json`

**Priority**: 🟠 HIGH
**Impact**: ⭐⭐⭐⭐ Medium-High
**Effort**: ⏱️ 1-2 hours

**Implementation**:
Add SEO metafield references in each template's section settings.

For **pet background remover page**, add to page settings:
```json
{
  "seo_title": "Free Pet Background Remover | AI-Powered Pet Photo Editor - Perkie Prints",
  "seo_description": "Remove backgrounds from pet photos instantly with our FREE AI tool. Perfect for creating custom pet portraits, prints, and gifts. No signup required. Upload and preview in seconds."
}
```

For **product pages**, create dynamic descriptions:
```liquid
{% comment %}In snippets/meta-tags.liquid{% endcomment %}
{%- if template contains 'product' and product.metafields.seo.description -%}
  <meta name="description" content="{{ product.metafields.seo.description | escape }}">
{%- elsif template contains 'product' -%}
  <meta name="description" content="Custom {{ product.title | escape }} with your pet's photo. Free AI background removal, hand-illustrated by artists. Starting at {{ product.price | money_without_currency }} {{ cart.currency.iso_code }}. Ships worldwide.">
{%- endif -%}
```

**Target Keyword Meta Descriptions**:
- **Pet Background Remover Page**: "Free Pet Background Remover | AI-Powered Pet Photo Editor" (58 chars)
- **Product Pages**: "Custom [Product Type] | Your Pet's Photo Hand-Illustrated | Free Background Removal" (75 chars)
- **Photo Guide Page**: "Pet Photography Tips: How to Take the Best Photos for Custom Pet Portraits | Perkie Prints" (91 chars)

**Notes**:
- Keep under 155-160 characters
- Front-load primary keywords
- Include compelling CTA
- Add to Shopify Admin > Online Store > Pages/Products > Search engine listing preview

---

#### 4. Fix H1 Duplication Issue
**File**: `sections/main-product.liquid`
**Location**: Lines 111-119
**Priority**: 🟡 MEDIUM
**Impact**: ⭐⭐⭐ Medium
**Effort**: ⏱️ 15 minutes

**Current Code** (lines 111-119):
```liquid
{%- when 'title' -%}
  <div class="product__title" {{ block.shopify_attributes }}>
    <h1>{{ product.title | escape }}</h1>
    <a href="{{ product.url }}" class="product__title">
      <h2 class="h1">
        {{ product.title | escape }}
      </h2>
    </a>
  </div>
```

**Issue**: Duplicate heading - both H1 and H2 with same content

**Corrected Code**:
```liquid
{%- when 'title' -%}
  <div class="product__title" {{ block.shopify_attributes }}>
    <h1>{{ product.title | escape }}</h1>
  </div>
```

**Notes**:
- Remove the redundant H2 wrapped in anchor tag
- Keep only the H1 for semantic clarity
- Test that product title still displays correctly
- May need CSS adjustments if link styling was intentional

---

#### 5. Add robots.txt Configuration
**File**: Create new file in Shopify Admin
**Location**: Shopify Admin > Online Store > Themes > Actions > Edit code > Add new asset
**Priority**: 🟡 MEDIUM
**Impact**: ⭐⭐⭐ Medium
**Effort**: ⏱️ 30 minutes

**Implementation**:
⚠️ **IMPORTANT**: Shopify automatically generates robots.txt at the domain root. This cannot be overridden via theme files. Instead, configure via Shopify settings:

1. **Shopify Admin > Online Store > Preferences**
   - Scroll to "Search engine listing preview"
   - Uncheck "Discourage search engines from indexing this site" (if enabled)

2. **Use Shopify's default robots.txt** at `yourdomain.com/robots.txt`:
   - Shopify automatically includes sitemap reference
   - Blocks /admin, /cart, /checkout, /account

3. **For custom rules**, use `theme.liquid` meta robots tags:
```liquid
{%- comment -%}Add to theme.liquid head section{%- endcomment -%}
{%- if template == 'search' or template contains 'cart' -%}
  <meta name="robots" content="noindex, follow">
{%- endif -%}

{%- if template == '404' -%}
  <meta name="robots" content="noindex, nofollow">
{%- endif -%}
```

**Notes**:
- Shopify manages robots.txt automatically
- Focus on noindex tags for low-value pages
- Verify sitemap.xml is accessible at `/sitemap.xml`

---

### **Phase 2: Content Optimization (Medium Impact, Medium Effort)** — 8-16 hours

#### 6. Add HowTo Schema to Photo Guide
**File**: `sections/photo-guide.liquid`
**Location**: Replace existing FAQPage schema (lines 156-166)
**Priority**: 🟠 HIGH
**Impact**: ⭐⭐⭐⭐ Medium-High
**Effort**: ⏱️ 1-2 hours

**Implementation**:
Replace the existing FAQPage schema with combined HowTo + FAQPage:

```liquid
<!-- Structured Data: HowTo + FAQ -->
<script type="application/ld+json">
[
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Take the Best Pet Photos for Custom Portraits",
    "description": "Step-by-step guide to capturing high-quality pet photos perfect for custom pet portraits and prints. Learn about lighting, framing, camera settings, and common mistakes to avoid.",
    "image": {
      "@type": "ImageObject",
      "url": "{{ section.settings.good_image | img_url: '1200x' | prepend: 'https:' }}"
    },
    "totalTime": "PT10M",
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": "USD",
      "value": "0"
    },
    "tool": [
      {
        "@type": "HowToTool",
        "name": "Smartphone camera or DSLR"
      }
    ],
    "step": [
      {
        "@type": "HowToStep",
        "name": "Choose the Right Lighting",
        "text": "Use natural, indirect daylight. Position your pet near a window with soft, diffused light. Avoid harsh direct sunlight and flash photography.",
        "url": "{{ shop.url }}{{ page.url }}#lighting"
      },
      {
        "@type": "HowToStep",
        "name": "Frame Your Pet Properly",
        "text": "Fill the frame with your pet's head and shoulders. Keep the eyes visible and in focus. Step back and zoom rather than getting too close to avoid distortion.",
        "url": "{{ shop.url }}{{ page.url }}#framing"
      },
      {
        "@type": "HowToStep",
        "name": "Configure Camera Settings",
        "text": "Use the rear camera for higher quality. Turn off heavy filters. Tap to focus on the eyes. Use burst mode and select the sharpest frame.",
        "url": "{{ shop.url }}{{ page.url }}#settings"
      },
      {
        "@type": "HowToStep",
        "name": "Select or Capture the Photo",
        "text": "Choose a calm, in-pose photo with clear eyes. For existing photos, prefer originals over screenshots. Upload 2-3 candidates for best results.",
        "url": "{{ shop.url }}{{ page.url }}#selection"
      },
      {
        "@type": "HowToStep",
        "name": "Prepare and Upload",
        "text": "Save as JPEG or PNG with 2000px+ resolution. Use simple filenames like 'bella_window.jpg'. Upload with artist notes about pose and background preferences.",
        "url": "{{ shop.url }}{{ page.url }}#upload"
      }
    ]
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What if my pet photo isn't perfect?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Upload it anyway — our artists will review and advise. You can request edits or upload a different photo if needed. We offer unlimited revisions until you're satisfied with the preview."
        }
      },
      {
        "@type": "Question",
        "name": "Can I combine two pet photos into one portrait?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes — leave a note during upload and our artists will advise on the best approach to combine multiple pets or poses into a single custom portrait."
        }
      },
      {
        "@type": "Question",
        "name": "What if I want a full redraw of my pet portrait?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We offer a full redraw option if you'd like to start from a new photo. Pricing details are available at checkout, and you can request this during the preview approval process."
        }
      },
      {
        "@type": "Question",
        "name": "What are the best photo file types for pet portraits?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "JPEG or PNG files are preferred. Upload the original file rather than screenshots for best quality. Higher resolution is better — aim for 2000px or more on the shortest side."
        }
      },
      {
        "@type": "Question",
        "name": "How long does it take to get my pet portrait preview?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We send a digital preview in 1-3 business days after you upload your photo. You can request unlimited edits until it's perfect, then we'll print your Perkie Print."
        }
      }
    ]
  }
]
</script>
```

**Notes**:
- Adds HowTo rich snippet eligibility
- Maintains existing FAQ schema
- Uses array format for multiple schema types
- Add ID anchors (#lighting, #framing, etc.) to corresponding content sections
- Test with Google Rich Results Test

---

#### 7. Optimize Title Tags for Target Keywords
**File**: `layout/theme.liquid`
**Location**: Lines 26-31 (title tag section)
**Priority**: 🟠 HIGH
**Impact**: ⭐⭐⭐⭐⭐ High
**Effort**: ⏱️ 2-3 hours

**Current Code**:
```liquid
<title>
  {{ page_title }}
  {%- if current_tags %} &ndash; tagged "{{ current_tags | join: ', ' }}"{% endif -%}
  {%- if current_page != 1 %} &ndash; Page {{ current_page }}{% endif -%}
  {%- unless page_title contains shop.name %} &ndash; {{ shop.name }}{% endunless -%}
</title>
```

**Optimized Code**:
```liquid
<title>
  {%- liquid
    # Keyword-optimized title templates by page type
    assign seo_title = page_title

    # Homepage
    if template == 'index'
      assign seo_title = 'Custom Pet Portraits & Prints | Free AI Background Remover | ' | append: shop.name

    # Pet Background Remover Page
    elsif page.handle == 'pet-background-remover'
      assign seo_title = 'Free Pet Background Remover | AI-Powered Pet Photo Editor | ' | append: shop.name

    # Photo Guide Page
    elsif page.handle == 'photo-guide' or page.handle contains 'photography'
      assign seo_title = 'How to Take Good Pet Photos | Pet Photography Tips for Custom Portraits | ' | append: shop.name

    # Product Pages
    elsif template contains 'product'
      assign seo_title = product.title | append: ' | Custom Pet Portrait with Free Background Removal | ' | append: shop.name

    # Collection Pages
    elsif template contains 'collection' and collection
      assign seo_title = collection.title | append: ' | Custom Pet Products | ' | append: shop.name

    # Fallback to default
    else
      assign seo_title = page_title
      unless page_title contains shop.name
        assign seo_title = seo_title | append: ' | ' | append: shop.name
      endunless
    endif
  -%}

  {{ seo_title }}
  {%- if current_tags %} &ndash; tagged "{{ current_tags | join: ', ' }}"{% endif -%}
  {%- if current_page != 1 %} &ndash; Page {{ current_page }}{% endif -%}
</title>
```

**Keyword-Optimized Title Templates**:
- **Homepage**: "Custom Pet Portraits & Prints | Free AI Background Remover | Perkie Prints" (72 chars)
- **Background Remover**: "Free Pet Background Remover | AI-Powered Pet Photo Editor | Perkie Prints" (73 chars)
- **Photo Guide**: "How to Take Good Pet Photos | Pet Photography Tips for Custom Portraits | Perkie Prints" (87 chars)
- **Product Pages**: "[Product Name] | Custom Pet Portrait with Free Background Removal | Perkie Prints"
- **Collection Pages**: "[Collection Name] | Custom Pet Products | Perkie Prints"

**Notes**:
- Titles under 60 characters ideal, max 70 before truncation
- Front-load primary keywords
- Include brand name for recognition
- Test all page types after implementation
- Consider adding metafield override option for custom titles

---

#### 8. Enhance Internal Linking Strategy
**Files**:
- `sections/ks-pet-processor-v5.liquid`
- `sections/how-it-works.liquid`
- `templates/page.pet-background-remover.json`
- Product templates

**Priority**: 🟡 MEDIUM
**Impact**: ⭐⭐⭐⭐ Medium-High
**Effort**: ⏱️ 3-4 hours

**Implementation Areas**:

**A. Pet Background Remover → Product Links**
Add contextual links in the background remover page template:
```liquid
{%- comment -%}Add to page.pet-background-remover.json sections{%- endcomment -%}
<div class="rich-text-section">
  <p>
    Once you've removed your pet's background, browse our
    <a href="/collections/custom-pet-portraits" title="Custom Pet Portrait Collection">
      custom pet portrait collection
    </a>
    to see your photo transformed into beautiful artwork. Choose from
    <a href="/collections/canvas-prints" title="Canvas Pet Prints">
      canvas prints
    </a>,
    <a href="/collections/framed-prints" title="Framed Pet Portraits">
      framed portraits
    </a>,
    or
    <a href="/collections/digital-art" title="Digital Pet Art">
      digital pet art
    </a>.
  </p>
</div>
```

**B. Product Pages → Photo Guide Link**
Add to product description or trust indicators section:
```liquid
{%- comment -%}Add to snippets/product-trust-indicators.liquid{%- endcomment -%}
<div class="trust-indicator">
  <svg><!-- Camera icon --></svg>
  <span>
    Not sure if your photo is good enough?
    <a href="/pages/pet-photography-guide" title="How to Take Good Pet Photos">
      Read our pet photography guide
    </a>
    for tips on choosing the perfect photo.
  </span>
</div>
```

**C. How It Works → Background Remover Link**
Update `sections/how-it-works.liquid` step descriptions:
```liquid
{%- comment -%}Step 1 description update{%- endcomment -%}
<p>
  Upload your pet photo or
  <a href="/pages/pet-background-remover" title="Free Pet Background Remover">
    use our free background remover
  </a>
  to prepare your image. Choose a well-lit, high-resolution photo (JPG/PNG, max 50MB).
</p>
```

**D. Footer Navigation Links**
Add "Resources" or "Help" footer section:
```liquid
{%- comment -%}Add to sections/footer.liquid{%- endcomment -%}
<div class="footer-block">
  <h3>Resources</h3>
  <ul>
    <li>
      <a href="/pages/pet-background-remover" title="Free Pet Background Remover Tool">
        Free Background Remover
      </a>
    </li>
    <li>
      <a href="/pages/pet-photography-guide" title="Pet Photography Tips">
        How to Take Good Pet Photos
      </a>
    </li>
    <li>
      <a href="/pages/choosing-photos" title="Guide to Choosing Pet Portrait Photos">
        Choosing Photos for Pet Portraits
      </a>
    </li>
  </ul>
</div>
```

**Internal Linking Structure Map**:
```
Homepage
  ↓
  ├─→ Pet Background Remover (primary CTA)
  │     ├─→ Photo Guide (educational)
  │     ├─→ Product Collections (conversion)
  │     └─→ How It Works (process)
  │
  ├─→ Product Pages
  │     ├─→ Photo Guide (help choosing photos)
  │     ├─→ Background Remover (photo prep)
  │     └─→ Related Products (cross-sell)
  │
  └─→ Photo Guide
        ├─→ Background Remover (tool CTA)
        ├─→ Product Collections (conversion)
        └─→ Homepage (navigation)
```

**Notes**:
- Use descriptive anchor text (avoid "click here")
- Include title attributes for accessibility and SEO
- Maintain natural, contextual placement
- Track internal link CTR in Google Analytics
- Prioritize links from high-authority pages

---

#### 9. Optimize Image Alt Text for Keywords
**Files**:
- `snippets/card-product.liquid`
- `sections/photo-guide.liquid`
- Product image uploads

**Priority**: 🟡 MEDIUM
**Impact**: ⭐⭐⭐ Medium
**Effort**: ⏱️ 2-3 hours

**Current State**: Basic alt text exists (lines 76, 99 in card-product.liquid):
```liquid
alt="{{ card_product.featured_media.alt | escape }}"
```

**Implementation**:

**A. Product Card Images - Enhanced Alt Text**
Update `snippets/card-product.liquid`:
```liquid
{%- comment -%}Enhanced alt text for product cards{%- endcomment -%}
{%- liquid
  assign default_alt = card_product.title | append: ' - Custom Pet Portrait'
  if card_product.featured_media.alt != blank
    assign image_alt = card_product.featured_media.alt
  else
    assign image_alt = default_alt
  endif
-%}

<img
  srcset="..."
  src="..."
  alt="{{ image_alt | escape }}"
  loading="lazy"
  width="{{ card_product.featured_media.width }}"
  height="{{ card_product.featured_media.height }}"
>
```

**B. Photo Guide Example Images**
Update `sections/photo-guide.liquid` lines 87, 96, 105:
```liquid
{%- comment -%}Good example{%- endcomment -%}
<img
  src="{{ section.settings.good_image | img_url: '1200x' }}"
  alt="Example of a good pet photo for custom portraits: clear headshot at eye level with soft natural light, perfect for pet background removal"
  style="..."
>

{%- comment -%}Okay example{%- endcomment -%}
<img
  src="{{ section.settings.okay_image | img_url: '1200x' }}"
  alt="Acceptable pet photo for custom artwork: sharp action shot with good lighting, suitable for pet portrait illustration"
  style="..."
>

{%- comment -%}Bad example{%- endcomment -%}
<img
  src="{{ section.settings.bad_image | img_url: '1200x' }}"
  alt="Poor quality pet photo example: blurry, heavily filtered, or low resolution image to avoid for pet portraits"
  style="..."
>
```

**C. Product Image Upload Guidelines**
Create Shopify Admin metafield for image alt text templates:
- **Namespace**: `seo`
- **Key**: `image_alt_template`
- **Type**: Single line text
- **Example**: "{product.title} - Custom {product.type} with Pet Photo | Perkie Prints"

**Alt Text Best Practices**:
1. **Be Descriptive**: Describe what's in the image (e.g., "Golden retriever portrait on canvas with white frame")
2. **Include Keywords**: Naturally incorporate target keywords
3. **Keep Under 125 Characters**: Screen readers may cut off longer text
4. **Avoid Keyword Stuffing**: "Image of" and "Picture of" prefixes unnecessary
5. **Context Matters**: Alt text should make sense if image doesn't load

**Keyword-Rich Alt Text Templates**:
- Product cards: "[Product Name] - Custom Pet Portrait | [Product Type]"
- Category images: "Custom [Category] Collection | Pet Photo Artwork"
- Guide images: "How to take good pet photos: [specific tip] example"
- Process images: "Step [X]: [Action] - Pet portrait creation process"

**Notes**:
- Update existing product images via CSV bulk import
- Train content team on alt text best practices
- Add alt text field to product image upload workflow
- Monitor image search traffic in Google Search Console

---

### **Phase 3: Technical Performance (High Effort, High Impact)** — 16-24 hours

#### 10. Optimize Core Web Vitals - LCP (Largest Contentful Paint)
**Files**:
- `layout/theme.liquid`
- `sections/main-product.liquid`
- Asset files

**Priority**: 🔴 CRITICAL (for mobile rankings)
**Impact**: ⭐⭐⭐⭐⭐ High
**Effort**: ⏱️ 4-6 hours

**Current Issues**:
- 128 CSS/JS assets may block rendering
- Google Fonts loaded without optimal font-display
- No preload hints for critical resources

**Implementation**:

**A. Preload Critical Resources**
Add to `layout/theme.liquid` after line 18:
```liquid
{%- comment -%}Preload critical assets for LCP{%- endcomment -%}
{%- if template contains 'product' -%}
  {%- if product.featured_image -%}
    <link rel="preload" as="image" href="{{ product.featured_image | image_url: width: 1200 }}" imagesrcset="{{ product.featured_image | image_url: width: 600 }} 600w, {{ product.featured_image | image_url: width: 1200 }} 1200w" imagesizes="(max-width: 600px) 600px, 1200px">
  {%- endif -%}
{%- endif -%}

{%- comment -%}Preload critical CSS{%- endcomment -%}
<link rel="preload" href="{{ 'base.css' | asset_url }}" as="style">
<link rel="preload" href="{{ 'component-price.css' | asset_url }}" as="style">
```

**B. Optimize Google Fonts Loading**
Update `layout/theme.liquid` lines 22-24:
```liquid
{%- comment -%}Optimized Google Fonts with font-display swap{%- endcomment -%}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Permanent+Marker&family=Rampart+One&family=Sacramento&display=swap" rel="stylesheet">
```

**C. Defer Non-Critical JavaScript**
Review and defer non-critical scripts. Update `layout/theme.liquid` lines 40-49:
```liquid
{%- comment -%}Defer non-critical scripts{%- endcomment -%}
<script src="{{ 'constants.js' | asset_url }}" defer></script>
<script src="{{ 'pubsub.js' | asset_url }}" defer></script>
<script src="{{ 'global.js' | asset_url }}" defer></script>
<script src="{{ 'details-disclosure.js' | asset_url }}" defer></script>
<script src="{{ 'details-modal.js' | asset_url }}" defer></script>
<script src="{{ 'search-form.js' | asset_url }}" defer></script>
```
✅ Already implemented - keep as-is

**D. Implement Fetchpriority for Hero Images**
Add to main product image in `sections/main-product.liquid`:
```liquid
{%- comment -%}Hero image optimization{%- endcomment -%}
<img
  src="{{ featured_image | image_url: width: 1200 }}"
  alt="{{ featured_image.alt | escape }}"
  width="{{ featured_image.width }}"
  height="{{ featured_image.height }}"
  fetchpriority="high"
  loading="eager"
>
```

**E. Image Dimension Attributes**
Ensure all above-the-fold images have explicit width/height to prevent CLS:
```liquid
{%- comment -%}Prevent layout shift{%- endcomment -%}
<img
  src="..."
  alt="..."
  width="{{ image.width }}"
  height="{{ image.height }}"
>
```

**Performance Targets**:
- **LCP**: < 2.5 seconds (currently unknown)
- **FID**: < 100ms (likely good with defer)
- **CLS**: < 0.1 (needs width/height attributes)

**Testing Tools**:
- PageSpeed Insights (mobile focus)
- Chrome DevTools Lighthouse
- WebPageTest.org (real device testing)
- Google Search Console Core Web Vitals report

**Notes**:
- Test mobile performance on 3G/4G connections
- Monitor field data in Google Search Console
- Consider lazy loading below-the-fold images only
- Prioritize mobile optimization (70% of traffic)

---

#### 11. Consolidate and Minify CSS/JS Assets
**Files**: Asset files in `/assets` directory
**Priority**: 🟡 MEDIUM
**Impact**: ⭐⭐⭐⭐ Medium-High
**Effort**: ⏱️ 6-8 hours

**Current State**: 128 CSS/JS files (potential redundancy and HTTP overhead)

**Implementation Strategy**:

**A. Audit Asset Usage**
Create asset inventory:
```bash
# Count references to each asset
grep -r "asset_url" sections/ snippets/ layout/ | sort | uniq -c
```

**B. Identify Consolidation Opportunities**
Group related stylesheets:
- Product-related CSS (component-price, component-rating, component-variant-picker)
- Cart-related CSS (component-cart, component-cart-drawer, component-totals)
- Form-related CSS (component-localization-form, component-predictive-search)

**C. Use Shopify's Asset Bundling**
⚠️ **Shopify Limitation**: Dawn theme uses modular CSS approach. Instead of consolidating, optimize loading:

```liquid
{%- comment -%}Critical CSS inline, defer non-critical{%- endcomment -%}
<style>
  {% comment %}Inline critical CSS here{% endcomment %}
  .product__title { font-size: 2.4rem; }
  .price { font-weight: 600; }
</style>

{%- comment -%}Load non-critical CSS asynchronously{%- endcomment -%}
<link rel="preload" href="{{ 'component-rating.css' | asset_url }}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="{{ 'component-rating.css' | asset_url }}"></noscript>
```

**D. Implement Resource Hints**
Add to `layout/theme.liquid`:
```liquid
{%- comment -%}DNS prefetch for third-party resources{%- endcomment -%}
<link rel="dns-prefetch" href="//cdn.shopify.com">
<link rel="dns-prefetch" href="//fonts.googleapis.com">
<link rel="dns-prefetch" href="//fonts.gstatic.com">
```

**E. Remove Unused Assets**
Identify and remove:
- Commented-out asset references
- Deprecated scripts (e.g., url-error-monitor.js already removed)
- Duplicate functionality

**Expected Improvements**:
- **Reduce HTTP requests**: 128 → ~80 assets (via async loading)
- **Faster page load**: 20-30% improvement on mobile
- **Better caching**: Fewer assets = better cache hit rate

**Notes**:
- Test thoroughly after asset changes
- Keep backups of original asset structure
- Monitor Shopify theme performance metrics
- Consider Shopify's HTTP/2 automatic asset optimization

---

#### 12. Mobile-First Optimization (70% Traffic Focus)
**Files**:
- `layout/theme.liquid`
- CSS files
- Mobile-specific sections

**Priority**: 🔴 CRITICAL
**Impact**: ⭐⭐⭐⭐⭐ High
**Effort**: ⏱️ 4-6 hours

**Mobile SEO Priorities**:

**A. Mobile-Friendly Test Validation**
Ensure passing Google's Mobile-Friendly Test:
- Viewport configured ✅ (line 6 in theme.liquid)
- Text readable without zooming
- Tap targets appropriately sized (min 48px × 48px)
- No horizontal scrolling

**B. Mobile-Specific Meta Tags**
Add to `layout/theme.liquid` head section:
```liquid
{%- comment -%}Mobile optimization meta tags{%- endcomment -%}
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="format-detection" content="telephone=no">

{%- comment -%}PWA-ready (future enhancement){%- endcomment -%}
<link rel="manifest" href="{{ 'manifest.json' | asset_url }}">
<meta name="theme-color" content="{{ settings.color_schemes[0].settings.background }}">
```

**C. Touch-Friendly Interactive Elements**
Audit and update tap target sizes:
```css
/* Minimum tap target size for mobile SEO */
.button,
.mobile-nav-link,
.product-card-link {
  min-height: 48px;
  min-width: 48px;
  padding: 12px 16px;
}

/* Increase spacing between interactive elements */
.product-card {
  margin-bottom: 24px;
}
```

**D. Mobile Performance Budget**
Set mobile-specific performance targets:
- **Time to Interactive (TTI)**: < 3.5 seconds on 4G
- **Total Page Size**: < 1.5MB (uncompressed)
- **JavaScript**: < 300KB (uncompressed)
- **Images**: Properly sized for mobile (max 600px width for portrait orientation)

**E. Responsive Image Optimization**
Ensure mobile-appropriate image sizes:
```liquid
{%- comment -%}Mobile-first image sizing{%- endcomment -%}
<img
  srcset="
    {{ product.featured_image | image_url: width: 375 }} 375w,
    {{ product.featured_image | image_url: width: 600 }} 600w,
    {{ product.featured_image | image_url: width: 900 }} 900w,
    {{ product.featured_image | image_url: width: 1200 }} 1200w
  "
  sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
  src="{{ product.featured_image | image_url: width: 600 }}"
  alt="{{ product.featured_image.alt | escape }}"
  loading="lazy"
  width="{{ product.featured_image.width }}"
  height="{{ product.featured_image.height }}"
>
```

**F. Mobile-Specific Content Adjustments**
Hide non-essential elements on mobile:
```liquid
{%- comment -%}Conditionally load desktop-only content{%- endcomment -%}
<div class="desktop-only" aria-hidden="true" style="display: none;">
  {%- comment -%}Desktop-specific content{%- endcomment -%}
</div>

<div class="mobile-only">
  {%- comment -%}Mobile-optimized content{%- endcomment -%}
</div>
```

**Mobile SEO Checklist**:
- ✅ Viewport meta tag configured
- ✅ Responsive design (CSS media queries)
- ⚠️ Tap targets 48px minimum (needs audit)
- ⚠️ Mobile page speed < 2.5s LCP (needs testing)
- ⚠️ No intrusive interstitials (verify pop-ups)
- ✅ Readable font sizes (16px+ base)
- ⚠️ Structured data renders on mobile (test)

**Testing Protocol**:
1. Google Mobile-Friendly Test
2. PageSpeed Insights (mobile score)
3. Real device testing (iOS Safari, Chrome Android)
4. BrowserStack/LambdaTest cross-device testing
5. Google Search Console Mobile Usability report

**Notes**:
- Prioritize mobile experience over desktop (70% traffic)
- Google uses mobile-first indexing exclusively
- Test on real devices, not just emulators
- Monitor mobile rankings separately in GSC

---

### **Phase 4: Advanced Schema & Content** — 12-16 hours

#### 13. Add Organization Schema
**File**: `layout/theme.liquid` or `sections/footer.liquid`
**Location**: End of body section
**Priority**: 🟡 MEDIUM
**Impact**: ⭐⭐⭐ Medium
**Effort**: ⏱️ 1 hour

**Implementation**:
Add to `layout/theme.liquid` before closing `</body>` tag:
```liquid
{%- comment -%}Organization Schema for Knowledge Graph{%- endcomment -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": {{ shop.name | json }},
  "url": {{ shop.url | json }},
  "logo": {
    "@type": "ImageObject",
    "url": {{ settings.logo | image_url: width: 600 | prepend: 'https:' | json }},
    "width": 600,
    "height": {{ settings.logo.height | times: 600.0 | divided_by: settings.logo.width | round }}
  },
  "description": {{ shop.description | default: "Custom pet portraits and prints with free AI background removal. Hand-illustrated pet artwork by professional artists." | json }},
  "sameAs": [
    {%- if settings.social_facebook_link != blank -%}{{ settings.social_facebook_link | json }}{%- endif -%}
    {%- if settings.social_instagram_link != blank -%},{{ settings.social_instagram_link | json }}{%- endif -%}
    {%- if settings.social_twitter_link != blank -%},{{ settings.social_twitter_link | json }}{%- endif -%}
    {%- if settings.social_pinterest_link != blank -%},{{ settings.social_pinterest_link | json }}{%- endif -%}
    {%- if settings.social_youtube_link != blank -%},{{ settings.social_youtube_link | json }}{%- endif -%}
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "Customer Service",
    "email": {{ shop.email | json }},
    "availableLanguage": ["English"]
  }
}
</script>
```

**Notes**:
- Helps Google understand brand entity
- Enables Knowledge Graph eligibility
- Include all social profiles for verification
- Add local business schema if physical location exists

---

#### 14. Create Educational Content Pages
**Files**: New Shopify pages to create
**Priority**: 🟠 HIGH
**Impact**: ⭐⭐⭐⭐⭐ High (for keyword targeting)
**Effort**: ⏱️ 8-12 hours (content writing + implementation)

**Pages to Create**:

**A. Pet Photography Tips Guide** (Target: "pet photography tips")
- **URL**: `/pages/pet-photography-tips`
- **Template**: Use existing `photo-guide.liquid` section
- **Content Outline**:
  1. Introduction to pet photography for portraits
  2. Camera settings and equipment recommendations
  3. Lighting techniques (natural light, studio setups)
  4. Composition tips (rule of thirds, eye focus)
  5. Common mistakes to avoid
  6. Editing recommendations
  7. CTA: Upload to background remover or shop products

**B. Choosing Photos for Pet Portraits** (Target: "choosing photos for pet portraits")
- **URL**: `/pages/choosing-photos-pet-portraits`
- **Template**: Create new section or use rich-text with custom blocks
- **Content Outline**:
  1. What makes a photo good for custom artwork
  2. Resolution and quality requirements
  3. Expression and personality capture
  4. Background considerations
  5. Multiple pet photos (dos and don'ts)
  6. File format and upload tips
  7. CTA: See examples or start customization

**C. Best Pet Photos for Custom Products** (Target: "best pet photos for custom products")
- **URL**: `/pages/best-pet-photos-custom-products`
- **Template**: Comparison table + examples
- **Content Outline**:
  1. Photo requirements by product type (canvas, mug, blanket, etc.)
  2. Visual examples: good vs. bad photos
  3. Product-specific tips (e.g., square crops for pillows)
  4. How artists use photos for different products
  5. Customer examples/testimonials
  6. CTA: Browse products or upload photo

**D. Free Pet Background Remover Guide** (Target: "free pet background remover")
- **URL**: `/pages/free-pet-background-remover-guide`
- **Template**: Tutorial with screenshots
- **Content Outline**:
  1. What is background removal and why use it
  2. Step-by-step tool tutorial
  3. Before/after examples
  4. Tips for best results
  5. When to use vs. when not to use
  6. CTA: Try the tool or browse products

**Content SEO Best Practices**:
- **Word Count**: 1,500-2,500 words per page (comprehensive content)
- **Keyword Density**: 1-2% for primary keyword (natural usage)
- **Headers**: Use H2/H3 hierarchy with keyword variations
- **Images**: 5-10 images per page with descriptive alt text
- **Internal Links**: 5-8 contextual links to products/tools
- **External Links**: 2-3 authoritative sources (pet photography resources)
- **CTAs**: Multiple CTAs throughout content (soft + hard sells)

**Schema Markup for Content Pages**:
- **HowTo Schema**: For tutorial content
- **Article Schema**: For blog-style guides
- **FAQPage Schema**: For Q&A sections
- **VideoObject Schema**: If video tutorials added

**Notes**:
- Publish pages first, then build backlinks
- Share on social media for initial traffic
- Update content quarterly with fresh examples
- Monitor rankings in Google Search Console
- A/B test CTAs for conversion optimization

---

#### 15. Implement Review Schema (if applicable)
**File**: `sections/main-product.liquid`
**Location**: Within Product schema (created in item #1)
**Priority**: 🟡 MEDIUM
**Impact**: ⭐⭐⭐⭐ Medium-High (if reviews exist)
**Effort**: ⏱️ 2-3 hours

**Prerequisites**:
- Review app installed (Judge.me, Loox, Stamped.io, etc.)
- Reviews metafield populated

**Implementation**:
Add to Product schema in `sections/main-product.liquid`:
```liquid
{%- comment -%}Review Schema - requires review app{%- endcomment -%}
{%- if product.metafields.reviews.rating.value -%}
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": {{ product.metafields.reviews.rating.value | json }},
    "reviewCount": {{ product.metafields.reviews.count.value | default: 1 | json }},
    "bestRating": 5,
    "worstRating": 1
  },
  "review": [
    {%- for review in product.metafields.reviews.all -%}
    {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": {{ review.rating | json }},
        "bestRating": 5,
        "worstRating": 1
      },
      "author": {
        "@type": "Person",
        "name": {{ review.author | json }}
      },
      "reviewBody": {{ review.body | json }},
      "datePublished": {{ review.created_at | date: '%Y-%m-%d' | json }}
    }{%- unless forloop.last -%},{%- endunless -%}
    {%- endfor -%}
  ]
{%- endif -%}
```

**Notes**:
- Requires review app with metafield integration
- Validate schema with Google Rich Results Test
- Monitor review stars appearance in search results
- Ensure review collection complies with Google guidelines (no incentivized reviews)

---

### **Phase 5: Ongoing Optimization** — Continuous

#### 16. Content Refresh Strategy
**Frequency**: Quarterly
**Priority**: 🟡 MEDIUM
**Impact**: ⭐⭐⭐⭐ Medium-High (long-term)
**Effort**: ⏱️ 4-8 hours/quarter

**Quarterly Content Updates**:

**A. Update Educational Content**
- Refresh photo guide examples with new customer photos
- Add seasonal tips (holiday photo tips, summer lighting, etc.)
- Update statistics and industry trends
- Add new FAQs based on customer questions

**B. Optimize Underperforming Pages**
- Identify low-ranking pages in Google Search Console
- Analyze search queries and add missing keywords
- Improve content depth and quality
- Update meta descriptions and title tags

**C. Add Fresh Content**
- Publish 1-2 new blog posts per quarter
- Create seasonal landing pages (e.g., "Christmas Pet Portraits")
- Add customer testimonials and case studies
- Update product descriptions with customer feedback

**D. Monitor Keyword Rankings**
Track target keyword positions:
- "free pet background remover"
- "how to take good pet photos"
- "best pet photos for custom products"
- "pet photography tips"
- "choosing photos for pet portraits"

**E. Analyze Competitor Content**
- Review top-ranking competitor pages
- Identify content gaps
- Create superior content (longer, more detailed, better visuals)

**Notes**:
- Use Google Search Console for keyword discovery
- Prioritize pages with high impressions but low CTR
- Update dates in content to signal freshness
- Monitor rankings weekly, adjust quarterly

---

#### 17. Link Building & Off-Page SEO
**Priority**: 🟡 MEDIUM
**Impact**: ⭐⭐⭐⭐⭐ High (long-term)
**Effort**: ⏱️ Ongoing (4-8 hours/month)

**Link Building Strategies**:

**A. Free Tool Promotion**
- Promote pet background remover on:
  - Pet photography forums (Reddit, PetaPixel)
  - Facebook pet owner groups
  - Instagram pet influencer collaborations
  - Pet blogger outreach

**B. Content Marketing**
- Guest posts on pet blogs
- Pet photography tutorials on YouTube (with backlink in description)
- Infographic: "The Ultimate Pet Photography Cheat Sheet"
- Case studies: "How [Customer] Created the Perfect Pet Portrait"

**C. Resource Page Outreach**
Target "pet resources" and "pet photography resources" pages:
- Email outreach to pet bloggers
- Add to pet owner directories
- Partner with pet product review sites

**D. Social Media Signals**
While not direct ranking factors, social shares correlate with rankings:
- Share educational content on Pinterest (visual platform)
- Instagram before/after background removal examples
- Facebook pet owner community engagement
- TikTok pet photography tips videos

**E. Local SEO (if applicable)**
If physical location or serving specific regions:
- Google Business Profile optimization
- Local pet store partnerships
- Local pet event sponsorships

**Link Quality Targets**:
- Domain Authority (DA) 30+ sites
- Relevant niche (pet, photography, art, gifts)
- Do-follow links preferred
- Avoid spammy link schemes

**Notes**:
- Focus on quality over quantity
- Natural link velocity (gradual growth)
- Diverse anchor text (brand, URLs, keywords)
- Monitor backlinks with Ahrefs/SEMrush

---

#### 18. Technical SEO Monitoring & Maintenance
**Frequency**: Monthly
**Priority**: 🟠 HIGH
**Impact**: ⭐⭐⭐⭐ Medium-High
**Effort**: ⏱️ 2-4 hours/month

**Monthly SEO Health Checks**:

**A. Google Search Console Monitoring**
- Check for crawl errors
- Review Coverage report for indexation issues
- Monitor Core Web Vitals report
- Identify new keyword opportunities
- Check for manual actions or security issues

**B. Site Speed Audits**
- Run PageSpeed Insights (mobile + desktop)
- Check Core Web Vitals in Chrome User Experience Report
- Identify slow pages and optimize
- Monitor asset sizes and loading times

**C. Broken Link Checks**
- Scan for 404 errors
- Fix or redirect broken internal links
- Monitor external link health
- Update sitemap if structure changes

**D. Schema Validation**
- Test structured data with Google Rich Results Test
- Monitor structured data errors in Search Console
- Update schema as products/content changes

**E. Mobile Usability**
- Check Mobile Usability report in Search Console
- Test on real devices (iOS/Android)
- Verify tap target sizes
- Ensure no mobile-specific errors

**F. Security & HTTPS**
- Verify SSL certificate validity
- Check for mixed content warnings
- Ensure all resources load over HTTPS
- Monitor security headers (Shopify managed)

**G. Sitemap & Robots.txt**
- Verify sitemap.xml accessibility
- Check robots.txt for blocking issues
- Update sitemap if large catalog changes
- Monitor sitemap submission status

**Monitoring Tools**:
- Google Search Console (primary)
- PageSpeed Insights (performance)
- Google Rich Results Test (schema)
- Screaming Frog SEO Spider (technical audit)
- Google Analytics (traffic analysis)

**Alert Triggers**:
- Coverage errors > 10
- Mobile usability errors > 0
- Core Web Vitals "Poor" URLs > 5%
- Organic traffic drop > 20% week-over-week
- Average position drop > 5 for target keywords

**Notes**:
- Set up automated alerts in Search Console
- Document changes and their impact
- Maintain SEO health scorecard
- Review quarterly with stakeholders

---

## Implementation Timeline

### **Sprint 1: Foundation (Week 1-2)** ✅ Quick Wins
- [ ] Add Product Schema Markup (Item #1)
- [ ] Add Breadcrumb Schema (Item #2)
- [ ] Optimize Meta Descriptions (Item #3)
- [ ] Fix H1 Duplication (Item #4)
- [ ] Configure Robots.txt (Item #5)

**Expected Impact**: Rich snippets in 2-4 weeks, improved CTR

---

### **Sprint 2: Content & Structure (Week 3-4)** 📝 Content
- [ ] Add HowTo Schema to Photo Guide (Item #6)
- [ ] Optimize Title Tags (Item #7)
- [ ] Enhance Internal Linking (Item #8)
- [ ] Optimize Image Alt Text (Item #9)

**Expected Impact**: Better keyword targeting, improved crawlability

---

### **Sprint 3: Performance (Week 5-6)** ⚡ Speed
- [ ] Optimize LCP (Item #10)
- [ ] Consolidate CSS/JS (Item #11)
- [ ] Mobile-First Optimization (Item #12)

**Expected Impact**: Faster load times, better mobile rankings

---

### **Sprint 4: Advanced (Week 7-8)** 🚀 Advanced
- [ ] Add Organization Schema (Item #13)
- [ ] Create Educational Content Pages (Item #14)
- [ ] Implement Review Schema (Item #15)

**Expected Impact**: Knowledge Graph eligibility, keyword coverage

---

### **Sprint 5: Ongoing** 🔄 Continuous
- [ ] Content Refresh Strategy (Item #16)
- [ ] Link Building (Item #17)
- [ ] Technical Monitoring (Item #18)

**Expected Impact**: Sustained rankings, authority building

---

## Success Metrics & KPIs

### **Primary KPIs** (Track Monthly)

1. **Organic Traffic**
   - Target: +30% organic sessions in 6 months
   - Measure: Google Analytics > Acquisition > Organic Search

2. **Target Keyword Rankings**
   - "free pet background remover": Rank #1-3 (6 months)
   - "how to take good pet photos": Rank #1-5 (6 months)
   - "best pet photos for custom products": Rank #1-10 (6 months)
   - Measure: Google Search Console > Performance

3. **Rich Snippet Impressions**
   - Target: Product schema on 100% of product pages
   - Target: FAQ/HowTo snippets on educational pages
   - Measure: Google Search Console > Enhancements

4. **Core Web Vitals**
   - LCP: < 2.5s on 75% of mobile page loads
   - FID: < 100ms on 75% of interactions
   - CLS: < 0.1 on 75% of page loads
   - Measure: Google Search Console > Core Web Vitals

5. **Mobile Rankings**
   - Target: No mobile usability errors
   - Target: Mobile page speed score > 80
   - Measure: PageSpeed Insights, Search Console

### **Secondary KPIs** (Track Quarterly)

6. **Indexed Pages**
   - Target: 95%+ indexation rate
   - Measure: Google Search Console > Coverage

7. **Click-Through Rate (CTR)**
   - Target: 3-5% average CTR from search
   - Measure: Google Search Console > Performance

8. **Backlink Profile**
   - Target: +20 quality backlinks/quarter
   - Measure: Ahrefs, SEMrush, or Google Search Console

9. **Conversion Rate from Organic**
   - Target: Maintain or improve vs. paid traffic
   - Measure: Google Analytics > Conversions

10. **Educational Content Engagement**
    - Target: 2+ min avg. session duration
    - Target: < 60% bounce rate
    - Measure: Google Analytics > Behavior

---

## Risk Assessment & Mitigation

### **Potential Risks**

1. **Schema Markup Errors**
   - **Risk**: Invalid JSON-LD breaks rich snippets
   - **Mitigation**: Validate all schema with Google Rich Results Test before deployment
   - **Testing**: Use JSON-LD validator and manual testing

2. **Title Tag Changes Impact Rankings**
   - **Risk**: Changing titles may temporarily affect rankings
   - **Mitigation**: Monitor rankings daily for 2 weeks post-change, rollback if significant drops
   - **Testing**: A/B test on low-traffic pages first

3. **Performance Optimization Breaks Functionality**
   - **Risk**: Deferring scripts may break interactive features
   - **Mitigation**: Test all user flows (cart, checkout, product customization) on staging
   - **Testing**: Comprehensive QA on staging before production

4. **Internal Linking Changes**
   - **Risk**: Too many links dilute page authority
   - **Mitigation**: Limit to 5-8 contextual links per page, prioritize high-value pages
   - **Testing**: Monitor bounce rate and engagement metrics

5. **Content Updates Change Page Intent**
   - **Risk**: Optimizing for keywords changes page focus
   - **Mitigation**: Keep primary user intent intact, add keywords naturally
   - **Testing**: User testing and conversion rate monitoring

### **Rollback Plan**

For each major change:
1. **Backup**: Save original file versions in `.claude/backups/`
2. **Testing**: Validate on staging environment first
3. **Monitoring**: Track key metrics for 7 days post-deployment
4. **Rollback**: Revert if metrics drop >20% or critical errors occur
5. **Documentation**: Log all changes with dates and impact

---

## Tools & Resources Required

### **Free Tools**
- ✅ Google Search Console (monitoring, indexation)
- ✅ Google Analytics (traffic analysis)
- ✅ PageSpeed Insights (performance)
- ✅ Google Rich Results Test (schema validation)
- ✅ Google Mobile-Friendly Test
- ✅ JSON-LD Schema Validator
- ✅ Shopify Admin (theme editor, SEO settings)

### **Paid Tools** (Optional but Recommended)
- Ahrefs or SEMrush ($99-$199/month) - keyword research, backlinks
- Screaming Frog SEO Spider ($259/year) - technical audits
- BrowserStack ($39/month) - cross-device testing
- Rank tracker tool (various options)

### **Development Resources**
- Shopify theme editor (built-in)
- Text editor (VS Code, Sublime) for local editing
- Git/GitHub for version control
- Staging theme for testing

---

## Notes & Assumptions

1. **No Core Functionality Changes**: All SEO improvements are non-breaking and preserve existing features
2. **Mobile-First Priority**: 70% mobile traffic justifies mobile-first optimization approach
3. **Free Tool as Lead Magnet**: Pet background remover is conversion driver, not revenue source
4. **Shopify Platform Limitations**: Some technical SEO features (robots.txt, sitemap) are Shopify-managed
5. **No Review App Assumed**: Review schema (item #15) requires review app installation
6. **Single Market Focus**: No multi-language/hreflang implementation needed currently
7. **Staging Environment**: Assumes access to Shopify staging theme for testing
8. **Content Team**: Assumes someone can create educational content (item #14) or outsource
9. **No API Access**: All changes via Shopify theme editor (Liquid, HTML, CSS, JS)
10. **Budget Constraints**: Prioritized free/low-cost implementations first

---

## Questions for Clarification

Before proceeding with implementation:

1. **Review App**: Is there a review app installed (Judge.me, Loox, etc.) for review schema?
2. **Social Profiles**: Are all social media profiles in `config/settings_schema.json` populated?
3. **Logo Asset**: Is `settings.logo` configured for Organization schema?
4. **Product Metafields**: Are there any existing SEO metafields for custom titles/descriptions?
5. **Content Resources**: Who will create educational content pages (item #14)?
6. **Testing Access**: Do we have access to Shopify staging environment?
7. **Analytics Setup**: Is Google Analytics properly configured and tracking?
8. **Search Console**: Is Google Search Console verified and connected?
9. **Priority Pages**: Which pages/products should be prioritized for optimization?
10. **Timeline**: Is the 8-week implementation timeline feasible, or should we adjust?

---

## Conclusion

This comprehensive SEO implementation plan provides **18 actionable improvements** prioritized by impact and effort. The phased approach allows for:

- **Quick wins** in Sprint 1-2 (foundation)
- **Content depth** in Sprint 3-4 (keyword targeting)
- **Technical excellence** in Sprint 5-6 (performance)
- **Long-term growth** with ongoing optimization

**Expected Outcomes** (6 months):
- ✅ Rich snippets for products, FAQs, and how-to content
- ✅ 30%+ increase in organic traffic
- ✅ Top 3 rankings for "free pet background remover"
- ✅ Top 5 rankings for informational pet photography keywords
- ✅ Improved Core Web Vitals scores (mobile priority)
- ✅ Enhanced mobile experience (70% of traffic)
- ✅ Stronger internal linking and site architecture
- ✅ Foundation for ongoing content marketing

**Next Steps**:
1. Review this plan with stakeholders
2. Answer clarifying questions above
3. Prioritize items based on business goals
4. Begin Sprint 1 implementation
5. Set up tracking and monitoring systems

All recommendations follow Google's Webmaster Guidelines and focus on sustainable, white-hat SEO practices that improve user experience while enhancing search visibility.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-04
**Author**: SEO Optimization Expert Agent
**Review Status**: Pending stakeholder approval
