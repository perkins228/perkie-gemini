#!/bin/bash

# Enhanced Shopify Theme Deployment Script with Cache Busting
# Usage: ./deploy-theme.sh [staging|production] [--force-cache-clear]

set -e

THEME_ENV=${1:-staging}
FORCE_CACHE_CLEAR=${2}

echo "🚀 Starting Shopify Theme Deployment to $THEME_ENV"

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."
if ! command -v shopify &> /dev/null; then
    echo "❌ Shopify CLI not found. Please install: npm install -g @shopify/cli"
    exit 1
fi

# Check git status
if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️  Warning: You have uncommitted changes"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Cache busting for critical updates
if [[ "$FORCE_CACHE_CLEAR" == "--force-cache-clear" ]]; then
    echo "🔧 Applying cache busting techniques..."
    
    # Create timestamped versions of critical JS files
    TIMESTAMP=$(date +%s)
    
    # Copy effects.js with new name if it changed recently
    if [[ assets/effects.js -nt assets/effects-cache-bust.js ]] 2>/dev/null || [[ ! -f assets/effects-cache-bust.js ]]; then
        cp assets/effects.js "assets/effects-${TIMESTAMP}.js"
        
        # Update core-engine.js to reference new file
        sed -i.bak "s/import.*effects.*\.js/import(\`\.\/effects-${TIMESTAMP}\.js?v=\${Date.now()}\`)/g" assets/core-engine.js
        
        echo "✅ Created cache-busted version: effects-${TIMESTAMP}.js"
    fi
fi

# Backup current theme (production only)
if [[ "$THEME_ENV" == "production" ]]; then
    echo "💾 Creating backup of production theme..."
    shopify theme pull --theme production --path ./backup/$(date +%Y%m%d_%H%M%S) || echo "⚠️  Backup failed, continuing..."
fi

# Deploy theme
echo "📤 Deploying to $THEME_ENV theme..."
if [[ "$THEME_ENV" == "production" ]]; then
    echo "⚠️  DEPLOYING TO PRODUCTION - Last chance to cancel!"
    sleep 5
fi

# Deploy specific files first (faster)
if [[ -f "assets/effects-${TIMESTAMP}.js" ]]; then
    shopify theme push --theme "$THEME_ENV" --only "assets/effects-${TIMESTAMP}.js" "assets/core-engine.js"
else
    shopify theme push --theme "$THEME_ENV" --only "assets/effects.js" "assets/core-engine.js"
fi

# Post-deployment verification
echo "🔍 Post-deployment verification..."
sleep 10  # Wait for CDN propagation

echo "✅ Deployment complete!"
echo "🌐 Please verify the following:"
echo "   1. Open browser in incognito mode"
echo "   2. Check console for new log messages"
echo "   3. Test core functionality"
echo "   4. Monitor for JavaScript errors"

if [[ "$THEME_ENV" == "production" ]]; then
    echo "📊 Production deployment completed. Monitor metrics for the next 30 minutes."
fi