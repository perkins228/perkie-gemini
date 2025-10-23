#!/usr/bin/env python3
"""Test EXIF transpose functionality"""

from PIL import Image, ImageOps
import sys
import os

def test_exif_transpose():
    """Test if ImageOps.exif_transpose works correctly"""
    
    test_image = "../../IMG_2733.jpeg"
    
    if not os.path.exists(test_image):
        print(f"Image not found: {test_image}")
        return
        
    print("Testing EXIF transpose...")
    
    # Open image
    img = Image.open(test_image)
    print(f"Original size: {img.size}")
    print(f"Original mode: {img.mode}")
    
    # Get EXIF
    exif = img._getexif()
    if exif:
        from PIL import ExifTags
        for tag_id, value in exif.items():
            tag = ExifTags.TAGS.get(tag_id, tag_id)
            if tag == 'Orientation':
                print(f"EXIF Orientation: {value}")
    
    # Apply EXIF transpose
    print("\nApplying ImageOps.exif_transpose...")
    transposed = ImageOps.exif_transpose(img)
    
    if transposed:
        print(f"After transpose size: {transposed.size}")
        print(f"After transpose mode: {transposed.mode}")
        
        # Check if rotation was applied
        orig_w, orig_h = img.size
        new_w, new_h = transposed.size
        
        if orig_w == new_w and orig_h == new_h:
            print("WARNING: Size unchanged - rotation may not have been applied!")
        elif new_w == orig_h and new_h == orig_w:
            print("SUCCESS: Image was rotated (dimensions swapped)")
        else:
            print(f"Size changed but not rotated: {orig_w}x{orig_h} -> {new_w}x{new_h}")
            
        # Save for inspection
        transposed.save("test_transpose_result.png")
        print("\nSaved to test_transpose_result.png")
    else:
        print("ERROR: exif_transpose returned None!")

if __name__ == "__main__":
    test_exif_transpose()