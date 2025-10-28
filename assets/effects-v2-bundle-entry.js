/**
 * Effects V2 Bundle Entry Point
 * Exports both EffectProcessor and geminiClient for Shopify
 *
 * This file is the webpack entry point that bundles:
 * - effects-v2.js (EffectProcessor class)
 * - gemini-artistic-client.js (GeminiArtisticClient)
 *
 * Output: window.EffectsV2 = { EffectProcessor, geminiClient }
 */

import { EffectProcessor } from './effects-v2.js';
import { geminiClient } from './gemini-artistic-client.js';

// Export both for webpack to bundle
export default {
  EffectProcessor,
  geminiClient
};

// Also attach to window for direct access (belt and suspenders)
if (typeof window !== 'undefined') {
  window.EffectsV2 = {
    EffectProcessor,
    geminiClient
  };
}
