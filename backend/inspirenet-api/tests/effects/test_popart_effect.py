"""
Test Pop Art Effect Implementation
Verifies the ported Canvas algorithm works correctly
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../src'))

import cv2
import numpy as np
from pathlib import Path
import logging

from effects.effects_processor import EffectsProcessor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_popart_effect():
    """Test Pop Art effect with user's pet images"""
    
    # Initialize effects processor
    processor = EffectsProcessor(gpu_enabled=False)  # Use CPU for testing
    
    # Test images provided by user
    test_images = [
        "polly.jpg", "Squid.jpg", "Rosie.jpg", "Tex.jpeg"
    ]
    
    images_dir = Path(__file__).parent.parent / "Images"
    output_dir = Path(__file__).parent / "visual_comparison"
    output_dir.mkdir(exist_ok=True)
    
    print(f"🎨 Testing Pop Art effect with {len(test_images)} images")
    print(f"📁 Images directory: {images_dir}")
    print(f"📁 Output directory: {output_dir}")
    
    # Get processor info
    stats = processor.get_processor_stats()
    print(f"📊 Processor stats: {stats}")
    
    # Test each image
    for image_name in test_images:
        image_path = images_dir / image_name
        
        if not image_path.exists():
            print(f"⚠️  Image not found: {image_path}")
            continue
        
        print(f"\n🖼️  Processing: {image_name}")
        
        try:
            # Load image
            image = cv2.imread(str(image_path))
            if image is None:
                print(f"❌ Failed to load image: {image_path}")
                continue
            
            print(f"   📏 Image size: {image.shape}")
            
            # Test individual effect
            result = processor.process_single_effect(image, 'popart', quality='standard')
            
            if result is not None:
                # Save result
                output_path = output_dir / f"{image_name}_popart.png"
                cv2.imwrite(str(output_path), result)
                print(f"   ✅ Pop Art result saved: {output_path}")
                
                # Also test both effects together
                effects_results = processor.process_multiple_effects(image, ['color', 'blackwhite', 'popart'])
                
                for effect_name, effect_result in effects_results.items():
                    if effect_result is not None:
                        multi_output_path = output_dir / f"{image_name}_{effect_name}_multi.png"
                        cv2.imwrite(str(multi_output_path), effect_result)
                        print(f"   ✅ {effect_name} (multi): {multi_output_path}")
                    else:
                        print(f"   ❌ {effect_name} (multi): Failed")
            else:
                print(f"   ❌ Processing failed for {image_name}")
        
        except Exception as e:
            print(f"   ❌ Error processing {image_name}: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n🎉 Pop Art testing completed!")
    print(f"📁 Check results in: {output_dir}")

def test_popart_info():
    """Test Pop Art effect information"""
    processor = EffectsProcessor(gpu_enabled=False)
    
    print(f"\n🎨 Pop Art Effect Info:")
    info = processor.get_effect_info('popart')
    
    print(f"   Name: {info['name']}")
    print(f"   Description: {info['description']}")
    print(f"   Implemented: {info['implemented']}")
    
    if 'features' in info:
        print(f"   Features:")
        for feature in info['features']:
            print(f"     • {feature}")
    
    if 'palette_colors' in info:
        print(f"   Palette Colors:")
        for i, color in enumerate(info['palette_colors']):
            print(f"     {i+1}. {color}")

if __name__ == "__main__":
    print("🚀 Starting Pop Art Effect Tests")
    
    # Test effect info
    test_popart_info()
    
    # Test actual processing
    test_popart_effect()
    
    print("\n✅ All Pop Art tests completed!") 