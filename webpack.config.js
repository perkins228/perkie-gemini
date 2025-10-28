/**
 * Webpack Configuration for Effects V2 Migration
 * Bundles ES6 modules into Shopify-compatible IIFE format
 *
 * Purpose: Effects V2 uses ES6 import/export which Shopify themes don't support.
 * This bundles effects-v2.js + gemini-artistic-client.js into a single global.
 *
 * Output: window.EffectsV2 = { EffectProcessor, geminiClient }
 */

const path = require('path');

module.exports = {
  mode: 'production',

  // Entry point: Effects V2 main module
  entry: './assets/effects-v2-bundle-entry.js',

  // Output configuration
  output: {
    path: path.resolve(__dirname, 'assets'),
    filename: 'effects-v2-bundle.js',
    library: {
      name: 'EffectsV2',
      type: 'var',  // Creates global window.EffectsV2
      export: 'default'
    },
    clean: false  // Don't delete other assets
  },

  // Source maps for debugging (production-friendly)
  devtool: 'source-map',

  // Module resolution
  resolve: {
    extensions: ['.js'],
    alias: {
      // Ensure correct paths for Shopify asset structure
      '@effects': path.resolve(__dirname, 'assets')
    }
  },

  // Optimization settings
  optimization: {
    minimize: true,
    usedExports: true  // Tree shaking
  },

  // Performance budgets
  performance: {
    maxEntrypointSize: 50000,  // 50KB max (Effects V2 should be ~35KB)
    maxAssetSize: 50000,
    hints: 'warning'
  }
};
