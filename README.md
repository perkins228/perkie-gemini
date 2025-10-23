# PerkiePrints Production Repository

This repository contains the source of the Perkie Prints Shopify theme with AI-powered pet background removal functionality. The theme is based on Shopify's Dawn theme and includes additional components from KondaSoft plus custom pet photo processing capabilities.

## 🎯 Project Structure

```
├── shopify-theme/           # Shopify theme files
│   ├── assets/             # Theme assets (CSS, JS, icons)
│   ├── config/             # Theme configuration
│   ├── layout/             # Theme layout files
│   ├── locales/            # Internationalization
│   ├── sections/           # Shopify sections
│   ├── snippets/           # Reusable code snippets
│   └── templates/          # Page templates
├── backend/                 # Backend services
│   ├── inspirenet-api/     # 🚀 Production AI API (InSPyReNet)
│   └── image-processor/    # 📚 Reference implementation (Node.js)
├── docs/                    # Documentation
│   ├── implementation/     # Implementation guides
│   ├── architecture/       # System architecture
│   ├── deployment/         # Deployment guides
│   └── api/               # API documentation
├── scripts/                # Utility scripts
├── tests/                  # Integration tests
└── _archive/               # 🗄️ Legacy code backups
```

## 🚀 AI Background Removal

### Production API (InSPyReNet)
Location: `backend/inspirenet-api/`
- **Status**: ✅ Production Ready
- **Performance**: 11s first request, 3s subsequent  
- **Technology**: InSPyReNet + rembg + FastAPI
- **URL**: `https://inspirenet-bg-removal-api-vqqo2tr3yq-uc.a.run.app`

### Reference Implementation
Location: `backend/image-processor/` 
- **Status**: 📚 Reference Only
- **Purpose**: Alternative Node.js implementation for future development

## Installation

1. Install the [Shopify CLI](https://shopify.dev/docs/themes/tools/cli).
   ```bash
   npm install -g @shopify/cli
   ```
2. Clone this repository and navigate into it.
   ```bash
   git clone <repo-url>
   cd perkieprints
   ```
3. Log in to your Shopify store and push the theme:
   ```bash
   shopify login --store your-store.myshopify.com
   shopify theme push
   ```
   You can also run `shopify theme serve` for local development.

The theme does not require a build step as all CSS and JavaScript files are committed in `assets/`.

## Environment Variables

The reference `image-processor` service uploads processed images to Google Cloud Storage. If you want to experiment with it, create a `.env` file inside the `image-processor` directory:

```bash
GC_BUCKET=your-gcs-bucket
GOOGLE_APPLICATION_CREDENTIALS=/path/to/perkieprints-sa-key.json
PORT=8080
```

Ensure the service account referenced by `GOOGLE_APPLICATION_CREDENTIALS` has permission to write to the bucket.

## Customizing Settings

Theme settings are defined in `config/settings_schema.json`. The `KS - Wishlist` group, for example, exposes options to enable wishlists and recently viewed products:

```json
"name": "KS - Wishlist",
"settings": [
  { "type": "checkbox", "id": "ks_wishlist", "label": "Enable wishlist", "default": true },
  { "type": "checkbox", "id": "ks_recently_viewed", "label": "Enable recently-viewed", "default": true },
  { "type": "color_scheme", "id": "ks_wishlist_color_scheme", "label": "Wishlist buttons - color scheme", "default": "scheme-1" }
]
```

Cart goal settings allow you to show progress tiers in the drawer:

```json
"id": "cart_goal_color",
"label": "Color",
"default": "#334FB4"
```

Edit these settings in Shopify's theme editor or directly in the JSON files.

## Snippet Usage

Important snippets are included throughout `layout/theme.liquid` and template files:

- **`ks-styles-scripts`** – loads KondaSoft assets and defines the `kondasoft` object.
  ```liquid
  {% render 'ks-styles-scripts' %}
  ```
  Lines from the snippet:
  ```liquid
  {% comment %} Vendor styles/scripts {% endcomment %}
  <link href="{{ 'ks-vendor-swiper.bundle.min.css' | asset_url }}" rel="stylesheet">
  <script src="{{ 'ks-vendor-swiper.bundle.min.js' | asset_url }}" defer="defer"></script>
  ```
- **`ks-product-inventory`** – shows inventory with a progress bar.
  ```liquid
  <ks-product-inventory id="Inventory-{{ section.id }}" class="ks__product__inventory" role="status"></ks-product-inventory>
  ```
- **`ks-wishlist-button`** – renders a wishlist toggle on product pages when wishlists are enabled.
  ```liquid
  {% if settings.ks_wishlist %}
    <ks-wishlist-btn class="ks-wishlist-btn color-{{ settings.ks_wishlist_color_scheme }}" data-product-url="{{ product.url | split: '?' | first }}">
      <button aria-label="{{ 'kondasoft.wishlist.add' | t }}" aria-pressed="false">{% render 'ks-svg-icons', icon: 'heart', size: 18, stroke_width: 1.5 %}</button>
    </ks-wishlist-btn>
  {% endif %}
  ```
- **`ks-cart-goal`** – displays progress tiers in the cart drawer.
  ```liquid
  {% if settings.cart_goal_one_value contains cart.currency.iso_code %}
    <ks-cart-goal class="ks-cart-goal" data-no-of-tiers="{{ no_of_tiers }}" data-goal-completed="{{ goal_completed | default: 0 }}">
      ...
    </ks-cart-goal>
  {% endif %}
  ```

## Theme-specific Features

Several custom sections in the `sections/` directory provide functionality such as testimonials, image sliders and countdown timers. For example, the `ks-testimonials` section contains settings for star ratings and card styling.

The product template `templates/product.personalized-products.json` demonstrates how these sections can be combined with Shopify apps and KondaSoft blocks to create a rich product page.

Refer to the schema in each section file for available options and adjust them through the theme editor.

## 🗄️ Legacy & Reference Code

**Legacy Backups**: Previous implementations and experimental code are preserved in `_legacy_backup/` with timestamps for reference.

**Reference Code**: The `image-processor/` directory contains a Node.js-based implementation for educational purposes and future development consideration. The production system uses the Python-based `inspirenet-bg-removal-api/`.

## 📈 Performance Notes

- **Current API Performance**: 11 seconds (first request), 3 seconds (subsequent requests)
- **Model Caching**: InSPyReNet models are cached in memory for optimal performance  
- **Fallback System**: Client-side processing automatically engages if API is unavailable
- **Smart Optimization**: Images are automatically resized for optimal processing speed

