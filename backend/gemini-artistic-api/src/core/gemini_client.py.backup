"""Gemini API client with artistic style prompts for pet portraits"""
import google.generativeai as genai
from google.generativeai import types
from google.generativeai.types.generation_types import GenerateContentResponse
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
# Simplified to avoid safety filter triggers while maintaining quality
STYLE_PROMPTS = {
    ArtisticStyle.INK_WASH: (
        # CRITICAL: Model name gemini-2.5-flash-image should generate images by default
        # Explicitly request image output in prompt as SDK 0.3.1 doesn't support response_modalities
        "GENERATE IMAGE OUTPUT: Transform this pet photo into a traditional Asian ink wash painting. "
        "Create a portrait composition showing the pet's head and neck area. "
        "Use flowing black ink with varying gradients to create an artistic effect. "
        "Apply expressive brush strokes in the style of sumi-e painting. "
        "Keep the pet's features recognizable while making it look like a painting. "
        "Place the portrait on a clean white background. "
        "OUTPUT FORMAT: Generated image (not text description)."
    ),
    ArtisticStyle.VAN_GOGH_POST_IMPRESSIONISM: (
        # CRITICAL: Model name gemini-2.5-flash-image should generate images by default
        # Explicitly request image output in prompt as SDK 0.3.1 doesn't support response_modalities
        "GENERATE IMAGE OUTPUT: Transform this pet photo into a Van Gogh style painting. "
        "Create a portrait composition focusing on the pet's head and neck. "
        "Use bold, visible brushstrokes like Van Gogh's portrait paintings. "
        "Apply vibrant colors - blues, yellows, and greens with thick paint texture. "
        "Add swirling patterns and expressive brushwork to the fur. "
        "Keep the pet's features recognizable while making it look like an oil painting. "
        "Place the portrait on a clean white background. "
        "OUTPUT FORMAT: Generated image (not text description)."
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
                    ),
                    # Add safety settings to reduce blocking
                    safety_settings={
                        types.HarmCategory.HARM_CATEGORY_HATE_SPEECH: types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                        types.HarmCategory.HARM_CATEGORY_HARASSMENT: types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                        types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                        types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                    }
                )
            )

            # Check if prompt was blocked by safety filters
            if response.prompt_feedback:
                # Log the prompt feedback for debugging
                logger.warning(f"Prompt feedback: {response.prompt_feedback}")

                # Check if the prompt was blocked
                if hasattr(response.prompt_feedback, 'block_reason'):
                    block_reason = response.prompt_feedback.block_reason
                    logger.error(f"Prompt blocked by safety filter: {block_reason}")
                    raise ValueError(f"Content generation blocked by safety filter: {block_reason}")

            # Check if we have any candidates
            if not response.candidates:
                logger.error("No candidates returned - prompt may have been blocked")
                raise ValueError("No content generated - the prompt may have been blocked by safety filters")

            # Check the first candidate for safety ratings
            candidate = response.candidates[0]
            # FinishReason values: 0=FINISH_REASON_UNSPECIFIED, 1=STOP, 2=MAX_TOKENS, 3=SAFETY, 4=RECITATION, 5=OTHER
            if hasattr(candidate, 'finish_reason') and candidate.finish_reason != 1:  # 1 = STOP (normal completion)
                logger.warning(f"Generation stopped early: {candidate.finish_reason}")
                if candidate.finish_reason == 3:  # 3 = SAFETY
                    raise ValueError("Content generation blocked due to safety concerns")

            # Extract generated image from response
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
