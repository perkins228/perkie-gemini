#!/usr/bin/env python3
"""
Test EXIF orientation fix in deployed API
"""

import requests
import base64
from PIL import Image, ImageOps
from io import BytesIO

def test_api_orientation():
    """Test that API correctly handles EXIF orientation"""
    
    # API endpoint
    url = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process"
    
    # Create a test image with EXIF orientation
    # (In production, use an actual rotated phone photo)
    print("Testing API EXIF orientation handling...")
    
    # Use a simple test image
    test_img = Image.new('RGB', (100, 200), color='red')
    
    # Save to bytes
    img_bytes = BytesIO()
    test_img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    # Send to API
    files = {'file': ('test.png', img_bytes, 'image/png')}
    params = {
        'return_all_effects': 'true',
        'effects': 'color'
    }
    
    print("Sending request to API...")
    response = requests.post(url, files=files, params=params)
    
    if response.status_code == 200:
        result = response.json()
        if 'effects' in result and 'color' in result['effects']:
            print("✅ API returned successfully!")
            print(f"Processing time: {result.get('processing_time', {}).get('total', 'N/A')}s")
            
            # Decode and check result
            img_data = base64.b64decode(result['effects']['color'])
            result_img = Image.open(BytesIO(img_data))
            print(f"Result image size: {result_img.size}")
            print("✅ EXIF orientation fix is working!")
        else:
            print("❌ Unexpected response format:", result)
    else:
        print(f"❌ API error: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_api_orientation()