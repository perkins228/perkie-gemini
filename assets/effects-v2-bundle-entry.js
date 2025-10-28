/**
 * Effects V2 Bundle Entry Point
 * Complete migration bundle with storage + sharing functionality
 *
 * This file is the webpack entry point that bundles:
 * - effects-v2.js (EffectProcessor class)
 * - gemini-artistic-client.js (GeminiArtisticClient)
 * - storage-manager.js (StorageManager - ported from V5)
 * - sharing-manager.js (SharingManager - ported from V5)
 *
 * Output: window.EffectsV2 = { EffectProcessor, geminiClient, storageManager, sharingManager, ... }
 */

import { EffectProcessor } from './effects-v2.js';
import { geminiClient } from './gemini-artistic-client.js';
import { StorageManager, storageManager } from './storage-manager.js';
import { SharingManager, sharingManager } from './sharing-manager.js';

// Export all modules for webpack to bundle
export default {
  // Core processing
  EffectProcessor,
  geminiClient,

  // Storage (ported from V5)
  StorageManager,
  storageManager,

  // Sharing (ported from V5)
  SharingManager,
  sharingManager
};

// Also attach to window for direct access (belt and suspenders)
if (typeof window !== 'undefined') {
  window.EffectsV2 = {
    EffectProcessor,
    geminiClient,
    StorageManager,
    storageManager,
    SharingManager,
    sharingManager
  };

  // Also expose individually for backward compatibility
  window.storageManager = storageManager;
  window.sharingManager = sharingManager;
}
