"""
Local Testing Script for Perkie Print Headshot Endpoint

Tests the new /api/v2/headshot endpoint locally before production deployment.
Validates:
- Endpoint functionality
- Output quality (cropping, B&W conversion, transparency)
- Processing time
- File size
- Image dimensions (4:5 aspect ratio)
"""

import requests
import time
import os
import sys
from pathlib import Path
from PIL import Image
from io import BytesIO
import json

# Configuration
API_URL = "http://localhost:8000/api/v2/headshot"
TEST_IMAGES_DIR = Path("test_images")
OUTPUT_DIR = Path("test_output/headshots")

# Create output directory
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ANSI color codes for pretty output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'

def print_header(text):
    """Print formatted header"""
    print(f"\n{BOLD}{BLUE}{'='*80}{RESET}")
    print(f"{BOLD}{BLUE}{text.center(80)}{RESET}")
    print(f"{BOLD}{BLUE}{'='*80}{RESET}\n")

def print_success(text):
    """Print success message"""
    print(f"{GREEN}✅ {text}{RESET}")

def print_error(text):
    """Print error message"""
    print(f"{RED}❌ {text}{RESET}")

def print_warning(text):
    """Print warning message"""
    print(f"{YELLOW}⚠️  {text}{RESET}")

def print_info(text):
    """Print info message"""
    print(f"{BLUE}ℹ️  {text}{RESET}")

def validate_image_output(image_path: Path) -> dict:
    """
    Validate the headshot output meets requirements

    Returns:
        dict: Validation results
    """
    results = {
        'valid': True,
        'checks': []
    }

    try:
        img = Image.open(image_path)

        # Check 1: Has alpha channel (RGBA)
        has_alpha = img.mode in ('RGBA', 'LA')
        results['checks'].append({
            'name': 'Has transparency (alpha channel)',
            'passed': has_alpha,
            'details': f"Mode: {img.mode}"
        })
        if not has_alpha:
            results['valid'] = False

        # Check 2: Is grayscale/B&W (R=G=B in RGB channels)
        if img.mode == 'RGBA':
            r, g, b, a = img.split()
            # Sample center pixel
            center_x, center_y = img.width // 2, img.height // 2
            r_val = r.getpixel((center_x, center_y))
            g_val = g.getpixel((center_x, center_y))
            b_val = b.getpixel((center_x, center_y))
            is_grayscale = abs(r_val - g_val) < 5 and abs(g_val - b_val) < 5
            results['checks'].append({
                'name': 'Is B&W (grayscale)',
                'passed': is_grayscale,
                'details': f"Center pixel RGB: ({r_val}, {g_val}, {b_val})"
            })
            if not is_grayscale:
                results['valid'] = False

        # Check 3: Aspect ratio close to 4:5
        aspect_ratio = img.width / img.height
        target_ratio = 4 / 5
        ratio_diff = abs(aspect_ratio - target_ratio)
        is_correct_ratio = ratio_diff < 0.05  # Allow 5% tolerance
        results['checks'].append({
            'name': '4:5 portrait aspect ratio',
            'passed': is_correct_ratio,
            'details': f"Actual: {aspect_ratio:.3f}, Target: {target_ratio:.3f}, Diff: {ratio_diff:.3f}"
        })
        if not is_correct_ratio:
            results['valid'] = False

        # Check 4: Reasonable dimensions (not too small)
        min_dimension = 800
        is_large_enough = img.width >= min_dimension and img.height >= min_dimension
        results['checks'].append({
            'name': f'Minimum dimensions ({min_dimension}px)',
            'passed': is_large_enough,
            'details': f"Size: {img.width}x{img.height}"
        })
        if not is_large_enough:
            results['valid'] = False

        # Check 5: Has neck fade (bottom portion has varying alpha)
        if img.mode == 'RGBA':
            a = img.split()[3]
            # Sample bottom 25% of image
            fade_height = img.height // 4
            bottom_start = img.height - fade_height

            # Get alpha values in bottom region
            alpha_values = []
            for y in range(bottom_start, img.height, 10):
                for x in range(img.width // 4, 3 * img.width // 4, 10):
                    if x < img.width and y < img.height:
                        alpha_values.append(a.getpixel((x, y)))

            # Check if there's variation (fade effect)
            if alpha_values:
                alpha_range = max(alpha_values) - min(alpha_values)
                has_fade = alpha_range > 50  # Significant variation
                results['checks'].append({
                    'name': 'Has neck fade effect',
                    'passed': has_fade,
                    'details': f"Alpha range in bottom 25%: {alpha_range}"
                })
                if not has_fade:
                    print_warning("Fade effect may be subtle or missing")

        # Check 6: File size reasonable (not too large)
        file_size_mb = image_path.stat().st_size / (1024 * 1024)
        is_reasonable_size = file_size_mb < 20  # Under 20MB
        results['checks'].append({
            'name': 'Reasonable file size (<20MB)',
            'passed': is_reasonable_size,
            'details': f"{file_size_mb:.2f} MB"
        })

        img.close()

    except Exception as e:
        results['valid'] = False
        results['error'] = str(e)

    return results

def test_headshot_endpoint(image_path: Path, session_name: str = None):
    """
    Test the headshot endpoint with a single image

    Args:
        image_path: Path to test image
        session_name: Optional session identifier
    """
    if not image_path.exists():
        print_error(f"Image not found: {image_path}")
        return False

    print_info(f"Testing with: {image_path.name}")

    # Prepare request
    with open(image_path, 'rb') as f:
        files = {'file': (image_path.name, f, 'image/jpeg')}
        params = {}
        if session_name:
            params['session_id'] = session_name

        # Send request and measure time
        start_time = time.time()
        try:
            response = requests.post(API_URL, files=files, params=params, timeout=120)
            processing_time = time.time() - start_time

            # Check response
            if response.status_code == 200:
                print_success(f"Request succeeded (HTTP {response.status_code})")
                print_info(f"Processing time: {processing_time:.2f}s")

                # Check headers
                if 'X-Processing-Time' in response.headers:
                    server_time = response.headers['X-Processing-Time']
                    print_info(f"Server processing time: {server_time}s")

                # Save output
                output_path = OUTPUT_DIR / f"{image_path.stem}_headshot.png"
                with open(output_path, 'wb') as out:
                    out.write(response.content)
                print_success(f"Saved output: {output_path}")

                # Validate output
                print_info("Validating output quality...")
                validation = validate_image_output(output_path)

                print(f"\n{BOLD}Validation Results:{RESET}")
                for check in validation['checks']:
                    status = print_success if check['passed'] else print_error
                    status(f"{check['name']}: {check['details']}")

                if validation['valid']:
                    print_success(f"\n{BOLD}✨ All validation checks passed!{RESET}")
                    return True
                else:
                    print_error(f"\n{BOLD}Some validation checks failed{RESET}")
                    return False

            else:
                print_error(f"Request failed (HTTP {response.status_code})")
                print_error(f"Response: {response.text[:500]}")
                return False

        except requests.exceptions.Timeout:
            print_error(f"Request timed out after {processing_time:.2f}s")
            return False
        except Exception as e:
            print_error(f"Request failed: {str(e)}")
            return False

def check_server_running():
    """Check if local server is running"""
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        return response.status_code == 200
    except:
        return False

def main():
    """Main test execution"""
    print_header("Perkie Print Headshot Endpoint - Local Testing")

    # Check if server is running
    print_info("Checking if API server is running...")
    if not check_server_running():
        print_error("API server is not running on http://localhost:8000")
        print_info("Please start the server first:")
        print_info("  cd backend/inspirenet-api")
        print_info("  python src/main.py")
        sys.exit(1)
    print_success("API server is running")

    # Check for test images
    if not TEST_IMAGES_DIR.exists():
        TEST_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        print_warning(f"Created test images directory: {TEST_IMAGES_DIR}")
        print_info("Please add test pet images to this directory")
        print_info("Supported formats: JPG, PNG")
        sys.exit(1)

    # Find test images
    test_images = list(TEST_IMAGES_DIR.glob("*.jpg")) + list(TEST_IMAGES_DIR.glob("*.jpeg")) + list(TEST_IMAGES_DIR.glob("*.png"))

    if not test_images:
        print_warning(f"No test images found in {TEST_IMAGES_DIR}")
        print_info("Please add some pet photos to test with")
        sys.exit(1)

    print_success(f"Found {len(test_images)} test image(s)")

    # Run tests
    results = []
    for i, image_path in enumerate(test_images, 1):
        print_header(f"Test {i}/{len(test_images)}: {image_path.name}")
        success = test_headshot_endpoint(image_path, session_name=f"test_{i}")
        results.append({
            'image': image_path.name,
            'success': success
        })
        time.sleep(1)  # Brief pause between tests

    # Summary
    print_header("Test Summary")
    passed = sum(1 for r in results if r['success'])
    total = len(results)

    print(f"\n{BOLD}Results: {passed}/{total} tests passed{RESET}\n")

    for r in results:
        status = print_success if r['success'] else print_error
        status(f"{r['image']}: {'PASSED' if r['success'] else 'FAILED'}")

    if passed == total:
        print_success(f"\n{BOLD}🎉 All tests passed! Ready for deployment.{RESET}")
        print_info("\nNext steps:")
        print_info("  1. Review output images in test_output/headshots/")
        print_info("  2. Deploy to Cloud Run: ./scripts/deploy-model-fix.sh")
        print_info("  3. Test production endpoint")
        return 0
    else:
        print_warning(f"\n{BOLD}⚠️  Some tests failed. Review output and adjust parameters.{RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
