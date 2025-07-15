import google.generativeai as genai
from dotenv import load_dotenv
import os
from ..utils.image_description_cache import ImageDescriptionCache, compute_image_hash

load_dotenv()

API_KEY = os.getenv('GEMINI_API_KEY')
VISION_MODEL = os.getenv('DEFAULT_GOOGLE_VISION')

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel(VISION_MODEL)


def get_gemini_description(image_bytes: bytes):
    cached_description = gemini_image_cache.get_description(image_bytes)
    if cached_description:
        return cached_description

    prompt = "Please describe this Image in detail. Please try to extract any text you can find."

    response = model.generate_content([
        {
            "mime_type": "image/jpeg",
            "data": image_bytes
        },
        prompt
    ])

    description = response.text
    gemini_image_cache.store_description(image_bytes, description)

    return description


gemini_image_cache = ImageDescriptionCache(max_size=1000)
