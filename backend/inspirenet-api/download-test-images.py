"""
Download Sample Test Images

If you don't have pet photos handy, this script downloads
a few sample images from public sources for testing.
"""

import requests
import os
from pathlib import Path

# Create test images directory
TEST_DIR = Path("test_images")
TEST_DIR.mkdir(exist_ok=True)

print("📥 Downloading sample pet images for testing...\n")

# Sample images from public sources (placeholder URLs - you'll need real ones)
# These are example URLs - replace with actual working image URLs
SAMPLE_IMAGES = [
    {
        "url": "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=3000",
        "filename": "dog_golden_retriever.jpg",
        "description": "Golden Retriever (full body sitting)"
    },
    {
        "url": "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=3000",
        "filename": "cat_tabby.jpg",
        "description": "Tabby Cat (sitting)"
    },
    {
        "url": "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=3000",
        "filename": "dog_labrador.jpg",
        "description": "Labrador (standing)"
    }
]

print("⚠️  NOTE: This script uses sample URLs from Unsplash.")
print("    You may need to update the URLs or add your own pet photos manually.\n")

downloaded = 0
failed = 0

for img in SAMPLE_IMAGES:
    output_path = TEST_DIR / img["filename"]

    if output_path.exists():
        print(f"⏭️  Skipped: {img['filename']} (already exists)")
        continue

    try:
        print(f"📥 Downloading: {img['description']}")
        print(f"   URL: {img['url']}")

        response = requests.get(img['url'], timeout=30, stream=True)
        response.raise_for_status()

        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        file_size = output_path.stat().st_size / (1024 * 1024)
        print(f"✅ Downloaded: {img['filename']} ({file_size:.2f} MB)\n")
        downloaded += 1

    except Exception as e:
        print(f"❌ Failed: {img['filename']}")
        print(f"   Error: {str(e)}\n")
        failed += 1

print("\n" + "="*60)
print(f"Downloaded: {downloaded} images")
print(f"Failed: {failed} images")
print(f"Location: {TEST_DIR.absolute()}")
print("="*60)

if downloaded > 0:
    print("\n✅ Ready to test! Run:")
    print("   python test_headshot_local.py")
else:
    print("\n⚠️  No images downloaded.")
    print("   Please manually add pet photos to test_images/")
    print("   Or update the URLs in this script with working image links")
