"""Gemini API client with artistic style prompts for pet portraits"""
import google.generativeai as genai
from google.generativeai import types
import base64
import time
import asyncio
import logging
from typing import Tuple, Callable, TypeVar
from io import BytesIO
from PIL import Image
from src.config import settings
from src.models.schemas import ArtisticStyle

logger = logging.getLogger(__name__)

T = TypeVar('T')

# Configure Gemini API
genai.configure(api_key=settings.gemini_api_key)


# Artistic style prompts optimized for Gemini 2.5 Flash Image
# These replace Pop Art (ink_wash) and Dithering (van_gogh)
STYLE_PROMPTS = {
    ArtisticStyle.INK_WASH: (
        # COMPOSITION (Lead with this for emphasis)
        "Create an artistic portrait showing ONLY the pet's head and neck. "
        "Compose like a traditional portrait painting - the face should fill most of the frame, "
        "cropping at the base of the neck where it meets the shoulders. "
        "No body, legs, paws, or tail should be visible. Focus entirely on the face, ears, and neck. "

        # SUBJECT PRESERVATION
        "Maintain identical facial features, exact fur colors and patterns, precise eye shape and color. "
        "Preserve the pet's natural expression and all unique markings without alteration. "

        # ARTISTIC STYLE (Ink Wash - NOT photographic)
        "Render in traditional East Asian ink wash (sumi-e) painting style. "
        "Use flowing black ink gradients with varying density to create depth and dimension. "
        "Apply spontaneous, expressive brush strokes for fur texture. "
        "Use minimal lines to capture personality and essence rather than photorealistic detail. "
        "The artwork should feel like a contemplative brush painting, not a photograph. "

        # BACKGROUND
        "Isolate the portrait on pure white (#FFFFFF) background with no gradients, textures, or environmental elements."
    ),
    ArtisticStyle.VAN_GOGH_POST_IMPRESSIONISM: (
        # COMPOSITION (Lead with this)
        "Create a painted portrait focusing exclusively on the pet's head and neck. "
        "Compose in the style of Van Gogh's portrait paintings - face dominates the frame, "
        "cropping precisely at the neck base. "
        "Show only head, ears, and neck - no chest, body, legs, or tail visible. "

        # SUBJECT PRESERVATION
        "Maintain accurate facial anatomy, exact fur coloration, and precise eye characteristics. "
        "Preserve the pet's authentic expression and all distinctive markings. "

        # ARTISTIC STYLE (Van Gogh - Bold and Painterly)
        "Paint in Van Gogh's Post-Impressionist style with thick, visible impasto brushstrokes. "
        "Use vibrant, expressive colors - bold blues, warm yellows, rich ochres, and deep greens. "
        "Create swirling, dynamic patterns in the fur with clearly visible brushstroke texture. "
        "Apply bold dark outlines defining facial features. "
        "Reference Van Gogh's Arles period (1888-1889) portrait technique - "
        "the artwork should feel like an oil painting with emotional intensity, not a photograph. "

        # BACKGROUND
        "Isolate on pure white (#FFFFFF) background with no environmental elements or gradients."
    ),
}


async def retry_with_backoff(
    func: Callable[[], T],
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 10.0
) -> T:
    """
    Retry with exponential backoff for transient failures

    CRITICAL: genai.GenerativeModel.generate_content() is a BLOCKING synchronous call.
    We must run it in a thread pool executor to avoid blocking the event loop.

    Args:
        func: Function to retry (should be synchronous)
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds

    Returns:
        Result from the function

    Raises:
        Exception: If all retries fail
    """
    for attempt in range(max_retries):
        try:
            # Run blocking function in thread pool to avoid blocking event loop
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, func)
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"All {max_retries} retry attempts failed: {e}")
                raise

            delay = min(base_delay * (2 ** attempt), max_delay)
            logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
            await asyncio.sleep(delay)


class GeminiClient:
    """Client for Gemini 2.5 Flash Image API"""

    def __init__(self):
        self.model_name = settings.gemini_model
        self.model = genai.GenerativeModel(model_name=self.model_name)
        logger.info(f"Initialized Gemini client: {self.model_name}")

    async def generate_artistic_style(
        self,
        image_data: str,
        style: ArtisticStyle
    ) -> Tuple[str, float]:
        """
        Generate artistic portrait with headshot framing

        Args:
            image_data: Base64 encoded image
            style: Artistic style to apply (INK_WASH or VAN_GOGH_POST_IMPRESSIONISM)

        Returns:
            Tuple of (generated_image_base64, processing_time_seconds)
        """
        start_time = time.time()

        try:
            # Decode base64 image
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(image_data)

            # Validate image size
            MAX_IMAGE_SIZE = 50 * 1024 * 1024  # 50MB
            if len(image_bytes) > MAX_IMAGE_SIZE:
                raise ValueError(f"Image too large: {len(image_bytes)/1024/1024:.1f}MB (max 50MB)")

            # Convert to PIL Image with validation
            try:
                input_image = Image.open(BytesIO(image_bytes))
            except Exception as e:
                raise ValueError(f"Invalid image format: {str(e)}")

            # Validate dimensions
            MIN_DIMENSION = 256
            MAX_DIMENSION = 4096
            if input_image.width < MIN_DIMENSION or input_image.height < MIN_DIMENSION:
                raise ValueError(f"Image too small: {input_image.size} (min {MIN_DIMENSION}x{MIN_DIMENSION})")

            # Resize if too large
            if input_image.width > MAX_DIMENSION or input_image.height > MAX_DIMENSION:
                logger.info(f"Resizing image from {input_image.size} to fit {MAX_DIMENSION}px")
                input_image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

            # Get style prompt
            prompt = STYLE_PROMPTS[style]

            # Generate with Gemini with retry logic for transient failures
            logger.info(f"Generating {style.value}...")
            response = await retry_with_backoff(
                lambda: self.model.generate_content(
                    contents=[prompt, input_image],
                    generation_config=types.GenerationConfig(
                        temperature=0.7,  # Lower for more consistent framing
                        top_p=settings.gemini_top_p,
                        top_k=settings.gemini_top_k,
                    )
                )
            )

            # Extract generated image
            if not response.parts:
                raise ValueError("No image generated by Gemini")

            generated_image_data = None
            for part in response.parts:
                if part.inline_data is not None:
                    generated_image_data = part.inline_data.data
                    break

            # Validate
            if generated_image_data is None or len(generated_image_data) == 0:
                raise ValueError(f"Empty image data for {style.value}")

            # Convert to base64
            generated_base64 = base64.b64encode(generated_image_data).decode('utf-8')

            processing_time = time.time() - start_time
            logger.info(f"Generated {style.value} in {processing_time:.2f}s")

            return generated_base64, processing_time

        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise


# Singleton instance
gemini_client = GeminiClient()
