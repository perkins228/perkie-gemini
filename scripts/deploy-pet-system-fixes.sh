#!/bin/bash

# Deploy Pet System Fixes to Shopify
# This script deploys all the recent fixes for the pet processing system

echo "======================================"
echo "🚀 Deploying Pet System Fixes"
echo "======================================"
echo ""

# Check if Shopify CLI is installed
if ! command -v shopify &> /dev/null; then
    echo "❌ Shopify CLI is not installed. Please install it first:"
    echo "   npm install -g @shopify/cli"
    exit 1
fi

echo "📋 Summary of fixes being deployed:"
echo "  ✅ Effect button click reliability (event delegation)"
echo "  ✅ Cross-page persistence via localStorage"
echo "  ✅ Cold start estimation improvements (7s/25s base)"
echo "  ✅ Original image preservation alongside processed"
echo "  ✅ Pet name capture after processing"
echo "  ✅ Artist notes flowing to cart properties"
echo "  ✅ Removed progressive loading UI elements"
echo ""

# Files that will be deployed
echo "📁 Files to be deployed:"
echo "  • assets/pet-processor-v5-es5.js"
echo "  • snippets/ks-product-pet-selector.liquid"
echo "  • snippets/buy-buttons.liquid"
echo "  • snippets/order-custom-images.liquid"
echo "  • assets/pet-name-capture.css"
echo ""

read -p "Do you want to continue with deployment? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🔄 Pushing theme updates to Shopify..."
echo ""

# Push specific files to avoid uploading test files
shopify theme push \
  --only assets/pet-processor-v5-es5.js \
  --only snippets/ks-product-pet-selector.liquid \
  --only snippets/buy-buttons.liquid \
  --only snippets/order-custom-images.liquid \
  --only assets/pet-name-capture.css \
  --theme $(shopify theme list | grep "development" | awk '{print $1}')

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📝 Post-deployment checklist:"
    echo "  1. Test effect button clicking on mobile devices"
    echo "  2. Upload a pet image and verify all effects work"
    echo "  3. Navigate away and back to verify persistence"
    echo "  4. Add to cart and check properties in order"
    echo "  5. Verify artist notes appear in fulfillment view"
    echo ""
    echo "🔗 Test URLs:"
    echo "  • Background Remover: https://your-store.myshopify.com/pages/pet-background-remover"
    echo "  • Product Page: https://your-store.myshopify.com/products/[product-handle]"
    echo ""
else
    echo ""
    echo "❌ Deployment failed. Please check the error messages above."
    exit 1
fi