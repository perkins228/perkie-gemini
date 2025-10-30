"""
Test script to compare static vs dynamic resize modes for InSPyReNet
Tests edge quality, processing stability, and performance
"""

import os
import sys
import time
import json
import numpy as np
from PIL import Image
import requests
from typing import Dict, List, Tuple
import base64
from io import BytesIO

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class ResizeModeComparator:
    def __init__(self):
        # Test with local API endpoints
        self.static_url = "http://localhost:8001/api/v2/process-with-effects"
        self.dynamic_url = "http://localhost:8002/api/v2/process-with-effects"

        # Use test images from the tests folder
        self.test_images = [
            "backend/inspirenet-api/tests/Images/Tex.jpeg",
            "testing/IMG_2733.jpeg"
        ]

        self.results = {
            'static': {},
            'dynamic': {}
        }

    def encode_image(self, image_path: str) -> str:
        """Encode image to base64 for API request"""
        with open(image_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')

    def process_image(self, image_path: str, api_url: str) -> Tuple[Dict, float]:
        """Process image through API and measure time"""
        image_base64 = self.encode_image(image_path)

        payload = {
            'image': f'data:image/jpeg;base64,{image_base64}',
            'effect': 'none',
            'enableProgressive': False
        }

        start_time = time.time()
        response = requests.post(api_url, json=payload)
        processing_time = time.time() - start_time

        if response.status_code == 200:
            return response.json(), processing_time
        else:
            raise Exception(f"API error: {response.status_code}")

    def measure_edge_sharpness(self, image_data: str) -> float:
        """
        Measure edge sharpness using gradient magnitude
        Higher values indicate sharper edges
        """
        # Extract base64 data
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        # Decode and open image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))

        # Convert to numpy array
        img_array = np.array(image)

        # If RGBA, use alpha channel for edge detection
        if img_array.shape[2] == 4:
            alpha = img_array[:, :, 3]

            # Calculate gradient magnitude
            gy, gx = np.gradient(alpha.astype(float))
            gradient_magnitude = np.sqrt(gx**2 + gy**2)

            # Return mean gradient (higher = sharper edges)
            return np.mean(gradient_magnitude)

        return 0.0

    def measure_alpha_quality(self, image_data: str) -> Dict[str, float]:
        """Analyze alpha channel quality metrics"""
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(image_bytes))
        img_array = np.array(image)

        if img_array.shape[2] == 4:
            alpha = img_array[:, :, 3]

            # Count semi-transparent pixels (indicates smooth edges)
            semi_transparent = np.sum((alpha > 10) & (alpha < 245))
            total_edge_pixels = np.sum((alpha > 0) & (alpha < 255))

            smoothness = semi_transparent / (total_edge_pixels + 1)

            # Measure alpha channel variance (indicates detail)
            alpha_variance = np.var(alpha[alpha > 0])

            return {
                'smoothness': smoothness,
                'variance': alpha_variance,
                'edge_pixels': total_edge_pixels
            }

        return {'smoothness': 0, 'variance': 0, 'edge_pixels': 0}

    def run_comparison(self):
        """Execute comparison test between modes"""
        print("\n=== InSPyReNet Resize Mode Comparison ===\n")

        for image_path in self.test_images:
            if not os.path.exists(image_path):
                print(f"Skipping {image_path} (not found)")
                continue

            print(f"\nTesting: {os.path.basename(image_path)}")
            print("-" * 40)

            # Test static mode
            try:
                print("Processing with STATIC mode...")
                static_result, static_time = self.process_image(image_path, self.static_url)

                # Measure quality metrics
                sharpness = self.measure_edge_sharpness(static_result['result'])
                alpha_metrics = self.measure_alpha_quality(static_result['result'])

                self.results['static'][image_path] = {
                    'processing_time': static_time,
                    'edge_sharpness': sharpness,
                    'alpha_smoothness': alpha_metrics['smoothness'],
                    'alpha_variance': alpha_metrics['variance']
                }

                print(f"  Time: {static_time:.2f}s")
                print(f"  Edge Sharpness: {sharpness:.2f}")
                print(f"  Alpha Smoothness: {alpha_metrics['smoothness']:.3f}")

            except Exception as e:
                print(f"  Error: {e}")
                self.results['static'][image_path] = {'error': str(e)}

            # Test dynamic mode
            try:
                print("Processing with DYNAMIC mode...")
                dynamic_result, dynamic_time = self.process_image(image_path, self.dynamic_url)

                # Measure quality metrics
                sharpness = self.measure_edge_sharpness(dynamic_result['result'])
                alpha_metrics = self.measure_alpha_quality(dynamic_result['result'])

                self.results['dynamic'][image_path] = {
                    'processing_time': dynamic_time,
                    'edge_sharpness': sharpness,
                    'alpha_smoothness': alpha_metrics['smoothness'],
                    'alpha_variance': alpha_metrics['variance']
                }

                print(f"  Time: {dynamic_time:.2f}s")
                print(f"  Edge Sharpness: {sharpness:.2f}")
                print(f"  Alpha Smoothness: {alpha_metrics['smoothness']:.3f}")

                # Calculate improvement
                if image_path in self.results['static'] and 'edge_sharpness' in self.results['static'][image_path]:
                    static_sharp = self.results['static'][image_path]['edge_sharpness']
                    improvement = ((sharpness - static_sharp) / static_sharp) * 100
                    print(f"\n  Edge Quality Improvement: {improvement:+.1f}%")

            except Exception as e:
                print(f"  Error: {e}")
                self.results['dynamic'][image_path] = {'error': str(e)}

        self.print_summary()

    def print_summary(self):
        """Print comparison summary"""
        print("\n" + "=" * 50)
        print("SUMMARY")
        print("=" * 50)

        static_sharpness = []
        dynamic_sharpness = []

        for img_path in self.test_images:
            if img_path in self.results['static'] and 'edge_sharpness' in self.results['static'][img_path]:
                static_sharpness.append(self.results['static'][img_path]['edge_sharpness'])
            if img_path in self.results['dynamic'] and 'edge_sharpness' in self.results['dynamic'][img_path]:
                dynamic_sharpness.append(self.results['dynamic'][img_path]['edge_sharpness'])

        if static_sharpness and dynamic_sharpness:
            avg_static = np.mean(static_sharpness)
            avg_dynamic = np.mean(dynamic_sharpness)
            improvement = ((avg_dynamic - avg_static) / avg_static) * 100

            print(f"\nAverage Edge Sharpness:")
            print(f"  Static Mode:  {avg_static:.2f}")
            print(f"  Dynamic Mode: {avg_dynamic:.2f}")
            print(f"  Improvement:  {improvement:+.1f}%")

            print(f"\nRecommendation:")
            if improvement > 15:
                print("  ✓ Dynamic mode shows significant improvement")
                print("  Consider switching to dynamic resize mode")
            elif improvement > 5:
                print("  → Dynamic mode shows moderate improvement")
                print("  Test with more images before deciding")
            else:
                print("  ✗ Minimal improvement detected")
                print("  Keep using static mode for stability")


if __name__ == "__main__":
    print("Starting InSPyReNet Resize Mode Comparison")
    print("Make sure both API servers are running:")
    print("  - Static mode on port 8001")
    print("  - Dynamic mode on port 8002")
    print()

    comparator = ResizeModeComparator()
    comparator.run_comparison()