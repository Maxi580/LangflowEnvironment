import json
import re
import httpx

from langflow.custom import Component
from langflow.io import MessageTextInput, SecretStrInput, HandleInput, Output
from langflow.schema import Data
from langflow.schema.message import Message


class TranslationEngine(Component):
    display_name = "Translation Engine"
    description = (
        "Collects all section texts, reads target languages from [Output Settings], "
        "and translates via Azure OpenAI. Skips translation for English (source language). "
        "Returns one JSON with all languages and sections."
    )
    icon = "languages"

    inputs = [
        SecretStrInput(
            name="azure_api_key",
            display_name="Azure OpenAI API Key",
            required=True,
        ),
        MessageTextInput(
            name="azure_endpoint",
            display_name="Azure Endpoint",
            info="e.g. https://my-resource.openai.azure.com",
            required=True,
        ),
        MessageTextInput(
            name="deployment_name",
            display_name="Deployment Name",
            value="gpt-4.1",
            required=True,
        ),
        MessageTextInput(
            name="api_version",
            display_name="API Version",
            value="2024-06-01",
        ),
        MessageTextInput(
            name="source_language",
            display_name="Source Language",
            info="The language the sections are already written in. This language will be skipped (no translation needed).",
            value="English",
        ),
        MessageTextInput(
            name="input_message",
            display_name="Input Message",
            info="The message containing [Output Settings] with {output_languages: ...}.",
        ),
        MessageTextInput(
            name="fallback_language",
            display_name="Fallback Language",
            info="Language when output_languages is 'auto' or missing.",
            value="English",
        ),
        HandleInput(name="about_client", display_name="About_Client", input_types=["Message"], is_list=False),
        HandleInput(name="business_impact", display_name="Business_Impact", input_types=["Message"], is_list=False),
        HandleInput(name="challenge", display_name="Challenge", input_types=["Message"], is_list=False),
        HandleInput(name="client_name", display_name="Client_Name", input_types=["Message"], is_list=False),
        HandleInput(name="it_impact", display_name="IT_Impact", input_types=["Message"], is_list=False),
        HandleInput(name="project", display_name="Project", input_types=["Message"], is_list=False),
        HandleInput(name="solution", display_name="Solution", input_types=["Message"], is_list=False),
        HandleInput(name="technology", display_name="Technology", input_types=["Message"], is_list=False),
        HandleInput(name="why_atos", display_name="Why_Atos", input_types=["Message"], is_list=False),
    ]

    outputs = [
        Output(
            display_name="Translations JSON",
            name="translations_json",
            method="run_translations",
        ),
    ]

    # ------------------------------------------------------------------ #
    SECTION_FIELDS = [
        ("About_Client", "about_client"),
        ("Business_Impact", "business_impact"),
        ("Challenge", "challenge"),
        ("Client_Name", "client_name"),
        ("IT_Impact", "it_impact"),
        ("Project", "project"),
        ("Solution", "solution"),
        ("Technology", "technology"),
        ("Why_Atos", "why_atos"),
    ]

    # ------------------------------------------------------------------ #
    #  Helpers                                                             #
    # ------------------------------------------------------------------ #

    def _get_text(self, value) -> str:
        if value is None:
            return ""
        if isinstance(value, Message):
            return value.text or ""
        if isinstance(value, Data):
            return value.text or (str(value.data) if value.data else "")
        return str(value)

    def _parse_output_settings(self, text: str) -> dict:
        settings = {}
        block_pattern = r"\[Output Settings\]\s*(.*?)\s*\[End of Output Settings\]"
        block_match = re.search(block_pattern, text, re.DOTALL)
        if not block_match:
            return settings

        block_content = block_match.group(1)

        for fragment in re.findall(r"\{[^}]+\}", block_content):
            try:
                jsonified = re.sub(r'(?<=[{,])\s*(\w+)\s*:', r' "\1":', fragment)
                parsed = json.loads(jsonified)
                settings.update(parsed)
            except (json.JSONDecodeError, ValueError):
                lang_match = re.search(r'output_languages\s*:\s*\[([^\]]*)\]', fragment)
                if lang_match:
                    raw = lang_match.group(1)
                    settings["output_languages"] = [
                        l.strip().strip('"').strip("'") for l in raw.split(",") if l.strip()
                    ]
                    continue
                if re.search(r'output_languages\s*:\s*["\']?auto["\']?', fragment):
                    settings["output_languages"] = "auto"

        return settings

    def _collect_sections(self) -> dict[str, str]:
        sections = {}
        for display_name, attr_name in self.SECTION_FIELDS:
            content = self._get_text(getattr(self, attr_name, None))
            if content.strip():
                sections[display_name] = content.strip()
        return sections

    def _build_prompt(self, sections: dict[str, str], target_language: str) -> str:
        section_names = list(sections.keys())

        sections_block = ""
        for name, text in sections.items():
            sections_block += f"### {name}\n{text}\n\n"

        json_template = "{\n"
        for i, name in enumerate(section_names):
            comma = "," if i < len(section_names) - 1 else ""
            json_template += f'  "{name}": "<translated text>"{comma}\n'
        json_template += "}"

        return (
            f"Translate ALL of the following sections into {target_language}.\n"
            f"Keep the JSON keys exactly as they are (do NOT translate the keys).\n"
            f"Return ONLY valid JSON — no markdown, no explanation, no code fences:\n\n"
            f"{json_template}\n\n"
            f"Sections to translate:\n\n"
            f"{sections_block}"
        )

    async def _call_azure(self, user_prompt: str) -> str:
        endpoint = self._get_text(self.azure_endpoint).rstrip("/")
        deployment = self._get_text(self.deployment_name)
        api_version = self._get_text(self.api_version) or "2024-06-01"
        api_key = self.azure_api_key

        url = f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"

        system_prompt = (
            "You are a professional translator. Translate accurately while "
            "preserving meaning, tone, and formatting. Respond with valid JSON only — "
            "no markdown fences, no explanations, no extra text."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        payload = {
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 16000,
        }

        headers = {
            "Content-Type": "application/json",
            "api-key": api_key,
        }

        async with httpx.AsyncClient(timeout=300) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        choices = data.get("choices", [])
        if not choices:
            raise ValueError("Azure OpenAI returned no choices")

        return choices[0]["message"]["content"].strip()

    def _parse_response(self, raw: str) -> dict:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        return json.loads(cleaned)

    # ------------------------------------------------------------------ #
    #  Main output                                                         #
    # ------------------------------------------------------------------ #

    async def run_translations(self) -> Message:
        """
        Returns JSON like:
        {
          "translations": [
            {
              "language": "English",
              "sections": {
                "About_Client": "original text...",
                "Challenge": "original text...",
                ...
              }
            },
            {
              "language": "Deutsch",
              "sections": {
                "About_Client": "übersetzter Text...",
                "Challenge": "übersetzter Text...",
                ...
              }
            }
          ]
        }
        """
        # --- collect sections ---
        sections = self._collect_sections()
        if not sections:
            self.status = "No sections provided."
            return Message(text=json.dumps({"translations": [], "error": "No sections provided"}))

        # --- resolve languages ---
        raw_msg = self._get_text(self.input_message)
        settings = self._parse_output_settings(raw_msg)
        output_langs = settings.get("output_languages", "auto")

        if isinstance(output_langs, list) and len(output_langs) > 0:
            languages = output_langs
        else:
            languages = [self.fallback_language or "English"]

        # --- resolve source language ---
        source_lang = (self._get_text(self.source_language) or "English").strip().lower()

        # --- iterate over languages ---
        translations = []

        for lang in languages:
            is_source = lang.strip().lower() == source_lang

            if is_source:
                # No translation needed — pass through original sections
                translations.append({
                    "language": lang,
                    "translated": False,
                    "sections": dict(sections),
                })
                continue

            # Call Azure OpenAI for this language
            try:
                user_prompt = self._build_prompt(sections, lang)
                raw_response = await self._call_azure(user_prompt)
                parsed = self._parse_response(raw_response)

                # Handle both flat {key: val} and nested {sections: {key: val}}
                if "sections" in parsed and isinstance(parsed["sections"], dict):
                    translated_sections = parsed["sections"]
                else:
                    translated_sections = parsed

                translations.append({
                    "language": lang,
                    "translated": True,
                    "sections": translated_sections,
                })

            except Exception as e:
                translations.append({
                    "language": lang,
                    "translated": False,
                    "error": f"{type(e).__name__}: {str(e)}",
                    "sections": dict(sections),  # fall back to originals
                })

        # --- build final result ---
        result = {"translations": translations}

        translated_count = sum(1 for t in translations if t.get("translated"))
        skipped_count = len(translations) - translated_count
        self.status = (
            f"{len(sections)} sections, {len(languages)} language(s): "
            f"{translated_count} translated, {skipped_count} passed through"
        )

        return Message(text=json.dumps(result, ensure_ascii=False, indent=2))