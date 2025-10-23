/**
 * Cache Buster Script for Shopify Theme Assets
 * Automatically adds version parameters to critical JavaScript imports
 */

const fs = require('fs');
const path = require('path');

const CACHE_BUST_VERSION = Date.now();

// Files that commonly need cache busting
const CRITICAL_FILES = [
  'assets/core-engine.js',
  'assets/effects.js',
  'assets/ks-pet-bg-remover.js'
];

// Add version parameters to import statements
function addCacheBusting(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Pattern to match import statements for local files
  const importPattern = /import\s*\(\s*['"`](\.\/.+?)['"`]\s*\)/g;
  
  content = content.replace(importPattern, (match, importPath) => {
    // Add version parameter if not already present
    if (!importPath.includes('?v=')) {
      return match.replace(importPath, `${importPath}?v=${CACHE_BUST_VERSION}`);
    }
    return match;
  });
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated cache busting for: ${filePath}`);
}

// Run cache busting on critical files
console.log('🔧 Starting cache busting process...');
CRITICAL_FILES.forEach(addCacheBusting);
console.log(`✅ Cache busting complete. Version: ${CACHE_BUST_VERSION}`);