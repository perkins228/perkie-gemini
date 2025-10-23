from PIL import Image
import os

# Create a simple test image
img = Image.new('RGB', (800, 600), color=(73, 109, 137))

# Save it
output_path = os.path.join(os.path.dirname(__file__), 'test-image.jpg')
img.save(output_path, 'JPEG')
print(f"Test image created at: {output_path}")