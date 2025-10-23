"""
Test Black & White Effect Implementation
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

def test_blackwhite_effect():
    """Test Black & White effect with user's pet images"""
    
    # Initialize effects processor
    processor = EffectsProcessor(gpu_enabled=False)  # Use CPU for testing
    
    # Test images provided by user
    test_images = [
        "polly.jpg", "Squid.jpg", "Rosie.jpg", "Tex.jpeg"
    ]
    
    images_dir = Path(__file__).parent.parent / "Images"
    output_dir = Path(__file__).parent / "visual_comparison"
    output_dir.mkdir(exist_ok=True)
    
    print(f"🧪 Testing Black & White effect with {len(test_images)} images")
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
            result = processor.process_single_effect(image, 'blackwhite', quality='standard')
            
            if result is not None:
                # Save result
                output_path = output_dir / f"{image_name}_blackwhite.png"
                cv2.imwrite(str(output_path), result)
                print(f"   ✅ Black & White result saved: {output_path}")
                
                # Save original for comparison
                original_path = output_dir / f"{image_name}_original.png"
                cv2.imwrite(str(original_path), image)
                print(f"   📄 Original saved: {original_path}")
            else:
                print(f"   ❌ Processing failed for {image_name}")
        
        except Exception as e:
            print(f"   ❌ Error processing {image_name}: {e}")
            import traceback
            traceback.print_exc()
    
    # Test multiple effects processing
    print(f"\n🎨 Testing multiple effects processing...")
    try:
        # Use first available image
        first_image_path = None
        for image_name in test_images:
            path = images_dir / image_name
            if path.exists():
                first_image_path = path
                break
        
        if first_image_path:
            image = cv2.imread(str(first_image_path))
            if image is not None:
                # Test available effects
                available_effects = ['color', 'blackwhite']  # Only implemented ones
                results = processor.process_multiple_effects(image, available_effects)
                
                print(f"   📊 Processed {len(results)} effects:")
                for effect_name, result in results.items():
                    if result is not None:
                        output_path = output_dir / f"multi_test_{effect_name}.png"
                        cv2.imwrite(str(output_path), result)
                        print(f"     ✅ {effect_name}: {output_path}")
                    else:
                        print(f"     ❌ {effect_name}: Failed")
    
    except Exception as e:
        print(f"❌ Multiple effects test failed: {e}")
        import traceback
        traceback.print_exc()
    
    print(f"\n🎉 Testing completed!")
    print(f"📁 Check results in: {output_dir}")

def test_effect_info():
    """Test effect information retrieval"""
    processor = EffectsProcessor(gpu_enabled=False)
    
    print(f"\n📋 Available Effects:")
    effects = processor.get_available_effects()
    for effect in effects:
        info = processor.get_effect_info(effect)
        status = "✅ Implemented" if info['implemented'] else "⏳ Pending"
        print(f"   {effect}: {info['description']} - {status}")
    
    print(f"\n📊 All Effects Info:")
    all_info = processor.get_all_effects_info()
    for name, info in all_info.items():
        print(f"   {name}: {info}")

if __name__ == "__main__":
    print("🚀 Starting Black & White Effect Tests")
    
    # Test effect info
    test_effect_info()
    
    # Test actual processing
    test_blackwhite_effect()
    
    print("\n✅ All tests completed!") 