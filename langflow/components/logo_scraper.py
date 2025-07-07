import base64
import requests
import os
from langflow.custom import Component
from langflow.io import MultilineInput, SecretStrInput, IntInput, Output
from langflow.schema import Data, Message


class LogoDevComponent(Component):
    display_name = "Logo Fetcher"
    description = "Uses Logo.dev to fetch logos, and return them b64 encoded"
    icon = "🏢"
    name = "LogoDevComponent"
    inputs = [
        MultilineInput(
            name="domain",
            display_name="Domain",
            info="Company domain name (e.g., 'crowdstrike.com')",
        ),
        SecretStrInput(
            name="token",
            display_name="Logo.dev API Token",
            info="Your Logo.dev API token",
            value="LOGODEV_TOKEN",
        ),
        IntInput(
            name="size",
            display_name="Logo Size",
            info="Logo size in pixels (default: 128)",
            value=128,
        ),
    ]
    outputs = [
        Output(display_name="Logo Base64", name="logo_base64", method="fetch_logo"),
    ]

    def fetch_logo(self) -> Message:
        try:
            domain = self.domain.strip()
            token_input = self.token.strip()
            size = self.size or 128
            if not domain:
                raise ValueError("Domain is required")
            if not token_input:
                raise ValueError("API token is required")
            token = os.getenv(token_input)
            if not token:
                token = token_input
            if domain.startswith(('http://', 'https://')):
                domain = domain.split('://', 1)[1]
            if domain.startswith('www.'):
                domain = domain[4:]
            url = f"https://img.logo.dev/{domain}?size={size}&token={token}"
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                image_data = response.content
                base64_string = base64.b64encode(image_data).decode('utf-8')
                self.status = f"✅ Logo fetched successfully for {domain}"
                return Message(text=base64_string)
            elif response.status_code == 404:
                return Message(text="")
            elif response.status_code == 401:
                raise ValueError("Invalid API token. Please check your Logo.dev API token.")
            elif response.status_code == 429:
                raise ValueError("API rate limit exceeded. Please try again later.")
            else:
                raise ValueError(f"API request failed with status {response.status_code}: {response.text}")
        except Exception:
            return Message(text="")
