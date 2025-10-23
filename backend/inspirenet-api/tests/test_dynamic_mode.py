"""
Quick test to verify dynamic resize mode improves edge quality
"""

import requests
import json
import base64
from PIL import Image
from io import BytesIO
import numpy as np

def test_dynamic_mode():
    """Test the dynamic resize mode endpoint"""

    # Test with the dynamic-test tagged revision
    dynamic_url = "https://dynamic-test---inspirenet-bg-removal-api-vqqo2tr3yq-uc.a.run.app/api/v2/process-with-effects"

    # Also test current production for comparison
    static_url = "https://inspirenet-bg-removal-api-725543555429.us-central1.run.app/api/v2/process-with-effects"

    print("Testing dynamic resize mode...")
    print("-" * 50)

    # Create a simple test payload with a solid color image
    # This will help us see edge quality differences
    test_image = Image.new('RGBA', (100, 100), (255, 0, 0, 255))

    # Add a circular shape to test edge quality
    from PIL import ImageDraw
    draw = ImageDraw.Draw(test_image)
    draw.ellipse([20, 20, 80, 80], fill=(0, 255, 0, 255))

    # Convert to base64
    buffer = BytesIO()
    test_image.save(buffer, format='PNG')
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    payload = {
        'image': f'data:image/png;base64,{image_base64}',
        'effect': 'none',
        'enableProgressive': False
    }

    # Test dynamic mode
    print("\n1. Testing DYNAMIC mode...")
    try:
        response = requests.post(dynamic_url, json=payload, timeout=60)
        if response.status_code == 200:
            result = response.json()
            print("   [OK] Dynamic mode successful")

            # Decode result to check alpha channel
            if 'result' in result:
                result_data = result['result'].split(',')[1]
                result_bytes = base64.b64decode(result_data)
                result_image = Image.open(BytesIO(result_bytes))
                result_array = np.array(result_image)

                if result_array.shape[2] == 4:
                    alpha = result_array[:, :, 3]
                    # Calculate edge sharpness
                    gy, gx = np.gradient(alpha.astype(float))
                    gradient_magnitude = np.sqrt(gx**2 + gy**2)
                    sharpness = np.mean(gradient_magnitude)
                    print(f"   Edge sharpness: {sharpness:.2f}")
        else:
            print(f"   [ERROR] Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
    except Exception as e:
        print(f"   [ERROR] Exception: {e}")

    # Test static mode for comparison
    print("\n2. Testing STATIC mode (current production)...")
    try:
        response = requests.post(static_url, json=payload, timeout=60)
        if response.status_code == 200:
            result = response.json()
            print("   [OK] Static mode successful")

            # Decode result to check alpha channel
            if 'result' in result:
                result_data = result['result'].split(',')[1]
                result_bytes = base64.b64decode(result_data)
                result_image = Image.open(BytesIO(result_bytes))
                result_array = np.array(result_image)

                if result_array.shape[2] == 4:
                    alpha = result_array[:, :, 3]
                    # Calculate edge sharpness
                    gy, gx = np.gradient(alpha.astype(float))
                    gradient_magnitude = np.sqrt(gx**2 + gy**2)
                    sharpness = np.mean(gradient_magnitude)
                    print(f"   Edge sharpness: {sharpness:.2f}")
        else:
            print(f"   [ERROR] Status: {response.status_code}")
    except Exception as e:
        print(f"   [ERROR] Exception: {e}")

    print("\n" + "-" * 50)
    print("Test complete!")
    print("\nNote: Higher edge sharpness values indicate better quality")
    print("Dynamic mode should show improved edge sharpness if working correctly")

if __name__ == "__main__":
    test_dynamic_mode()