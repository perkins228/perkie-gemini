"""Gemini API client with artistic style prompts for pet portraits"""
from google import genai
from google.genai import types
import base64
import re
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


# Artistic style prompts optimized for Gemini 2.5 Flash Image
# Clean prompts - response_modalities handles image output request
STYLE_PROMPTS = {
    ArtisticStyle.INK_WASH: (
        "Transform this pet photo into a traditional Asian ink wash painting. "
        "Create a portrait composition showing the pet's head and neck area. "
        "Use flowing black ink with varying gradients to create an artistic effect. "
        "Apply expressive brush strokes in the style of sumi-e painting. "
        "Keep the pet's features recognizable while making it look like a painting. "
        "Place the portrait on a clean white background."
    ),
    ArtisticStyle.PEN_AND_MARKER: (
        "Transform this pet photo into a marker art illustration. "
        "Create a portrait composition showing the pet's head and neck area. "
        "Keep the pet's features clearly recognizable with expressive detail in the eyes and nose. "
        "Place the portrait on a clean white background."
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
    """Client for Gemini 2.5 Flash Image API - New SDK"""

    def __init__(self):
        self.model_name = settings.gemini_model
        self.client = genai.Client(api_key=settings.gemini_api_key)
        logger.info(f"Initialized Gemini client (new SDK): {self.model_name}")

    @staticmethod
    def _prepare_image(image_data: str) -> Image.Image:
        """Decode, validate, and resize a base64 image for Gemini processing.

        Returns a PIL Image ready for the Gemini API.
        """
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)

        MAX_IMAGE_SIZE = 50 * 1024 * 1024  # 50MB
        if len(image_bytes) > MAX_IMAGE_SIZE:
            raise ValueError(f"Image too large: {len(image_bytes)/1024/1024:.1f}MB (max 50MB)")

        try:
            input_image = Image.open(BytesIO(image_bytes))
        except Exception as e:
            raise ValueError(f"Invalid image format: {str(e)}")

        MIN_DIMENSION = 256
        MAX_DIMENSION = 4096
        if input_image.width < MIN_DIMENSION or input_image.height < MIN_DIMENSION:
            raise ValueError(f"Image too small: {input_image.size} (min {MIN_DIMENSION}x{MIN_DIMENSION})")

        if input_image.width > MAX_DIMENSION or input_image.height > MAX_DIMENSION:
            logger.info(f"Resizing image from {input_image.size} to fit {MAX_DIMENSION}px")
            input_image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

        return input_image

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
            input_image = self._prepare_image(image_data)

            # Get style prompt
            prompt = STYLE_PROMPTS[style]

            # Generate with Gemini with retry logic for transient failures
            logger.info(f"Generating {style.value}...")

            # New SDK uses different API structure
            response = await retry_with_backoff(
                lambda: self.client.models.generate_content(
                    model=self.model_name,
                    contents=[prompt, input_image],
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],  # CRITICAL: Now supported in new SDK!
                        temperature=0.7,
                        top_p=settings.gemini_top_p,
                        top_k=settings.gemini_top_k,
                        safety_settings=[
                            types.SafetySetting(
                                category="HARM_CATEGORY_HATE_SPEECH",
                                threshold="BLOCK_ONLY_HIGH"
                            ),
                            types.SafetySetting(
                                category="HARM_CATEGORY_HARASSMENT",
                                threshold="BLOCK_ONLY_HIGH"
                            ),
                            types.SafetySetting(
                                category="HARM_CATEGORY_DANGEROUS_CONTENT",
                                threshold="BLOCK_ONLY_HIGH"
                            ),
                            types.SafetySetting(
                                category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                                threshold="BLOCK_ONLY_HIGH"
                            ),
                        ]
                    )
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


    @staticmethod
    def sanitize_prompt(prompt: str) -> str:
        """Sanitize custom prompt text for safety"""
        # Strip HTML/script tags
        prompt = re.sub(r'<[^>]+>', '', prompt)
        # Remove null bytes and control characters (keep newlines/tabs)
        prompt = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', prompt)
        return prompt.strip()

    async def generate_from_custom_prompt(
        self,
        image_data: str,
        prompt: str
    ) -> Tuple[str, float]:
        """
        Generate artistic portrait using a custom prompt.

        Args:
            image_data: Base64 encoded image
            prompt: Custom prompt text from theme editor

        Returns:
            Tuple of (generated_image_base64, processing_time_seconds)
        """
        start_time = time.time()

        try:
            input_image = self._prepare_image(image_data)

            # Sanitize and frame the custom prompt
            sanitized = self.sanitize_prompt(prompt)
            if not sanitized:
                raise ValueError("Prompt is empty after sanitization")

            framed_prompt = (
                "You are generating an artistic portrait of a pet. "
                "Apply the following style instruction while keeping the pet recognizable: "
                f"{sanitized}"
            )

            # Generate with Gemini
            logger.info(f"Generating with custom prompt ({len(sanitized)} chars)...")

            response = await retry_with_backoff(
                lambda: self.client.models.generate_content(
                    model=self.model_name,
                    contents=[framed_prompt, input_image],
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],
                        temperature=0.7,
                        top_p=settings.gemini_top_p,
                        top_k=settings.gemini_top_k,
                        safety_settings=[
                            types.SafetySetting(
                                category="HARM_CATEGORY_HATE_SPEECH",
                                threshold="BLOCK_ONLY_HIGH"
                            ),
                            types.SafetySetting(
                                category="HARM_CATEGORY_HARASSMENT",
                                threshold="BLOCK_ONLY_HIGH"
                            ),
                            types.SafetySetting(
                                category="HARM_CATEGORY_DANGEROUS_CONTENT",
                                threshold="BLOCK_ONLY_HIGH"
                            ),
                            types.SafetySetting(
                                category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                                threshold="BLOCK_ONLY_HIGH"
                            ),
                        ]
                    )
                )
            )

            # Check safety filters
            if response.prompt_feedback:
                logger.warning(f"Prompt feedback: {response.prompt_feedback}")
                if hasattr(response.prompt_feedback, 'block_reason'):
                    block_reason = response.prompt_feedback.block_reason
                    logger.error(f"Custom prompt blocked by safety filter: {block_reason}")
                    raise ValueError(f"safety_blocked: {block_reason}")

            if not response.candidates:
                logger.error("No candidates returned for custom prompt")
                raise ValueError("safety_blocked: No content generated")

            candidate = response.candidates[0]
            if hasattr(candidate, 'finish_reason') and candidate.finish_reason != 1:
                logger.warning(f"Generation stopped early: {candidate.finish_reason}")
                if candidate.finish_reason == 3:
                    raise ValueError("safety_blocked: Content blocked due to safety concerns")

            # Extract generated image
            if not response.parts:
                raise ValueError("No image generated by Gemini")

            generated_image_data = None
            for part in response.parts:
                if part.inline_data is not None:
                    generated_image_data = part.inline_data.data
                    break

            if generated_image_data is None or len(generated_image_data) == 0:
                raise ValueError("Empty image data from custom prompt generation")

            generated_base64 = base64.b64encode(generated_image_data).decode('utf-8')

            processing_time = time.time() - start_time
            logger.info(f"Generated custom prompt result in {processing_time:.2f}s")

            return generated_base64, processing_time

        except Exception as e:
            logger.error(f"Gemini custom prompt error: {e}")
            raise


# Singleton instance
gemini_client = GeminiClient()
