from langflow.custom import Component
from langflow.io import Output, StrInput, DropdownInput
from langflow.schema import Data
from typing import Optional


class TextPrefixComponent(Component):
    display_name = "Text Prefix"
    description = "Adds a prefix phrase to any input text"
    icon = "📝"

    inputs = [
        StrInput(
            name="input_text",
            display_name="Input Text",
            info="The text to add a prefix to",
            required=True
        ),
        DropdownInput(
            name="prefix_type",
            display_name="Prefix Type",
            options=[
                "greeting",
                "formal",
                "casual",
                "excited",
                "professional",
                "custom"
            ],
            value="greeting",
            info="Choose the type of prefix to add"
        ),
        StrInput(
            name="custom_prefix",
            display_name="Custom Prefix",
            info="Only used when 'custom' is selected",
            required=False
        )
    ]

    outputs = [
        Output(
            display_name="Prefixed Text",
            name="output_text",
            method="add_prefix"
        )
    ]

    def add_prefix(self) -> Data:
        prefix_mappings = {
            "greeting": "Hello there! ",
            "formal": "Dear Sir/Madam, ",
            "casual": "Hey! ",
            "excited": "WOW! This is amazing! ",
            "professional": "According to our analysis, ",
            "custom": self.custom_prefix if self.custom_prefix else "Custom: "
        }

        prefix = prefix_mappings.get(self.prefix_type, "")

        if prefix and not prefix.endswith(" "):
            prefix += " "

        result_text = f"{prefix}{self.input_text}"

        return Data(
            data={
                "text": result_text,
                "original_text": self.input_text,
                "prefix_used": prefix.strip(),
                "prefix_type": self.prefix_type
            }
        )