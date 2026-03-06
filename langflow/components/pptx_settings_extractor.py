import re
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema.message import Message


class ExtractOutputSettings(Component):
    display_name = "Extract PPTX Flag"
    description = "Extracts create_pptx (true/false) from the first [Output Settings] block."
    icon = "settings"

    inputs = [
        MessageTextInput(
            name="input_text",
            display_name="Input Text",
            info="The full message containing the [Output Settings] block."
        ),
    ]

    outputs = [
        Output(display_name="create_pptx", name="create_pptx", method="get_create_pptx"),
    ]

    def get_create_pptx(self) -> Message:
        text = self.input_text

        # Only match the FIRST [Output Settings] block
        block_match = re.search(
            r"\[Output Settings\](.*?)\[End of Output Settings\]",
            text,
            re.DOTALL,
        )

        if block_match:
            pptx_match = re.search(
                r"\{create_pptx\s*:\s*(true|false)\}",
                block_match.group(1),
                re.IGNORECASE,
            )
            value = pptx_match.group(1).lower() if pptx_match else "true"
        else:
            value = "true"  # default if no block found

        self.status = value
        return Message(text=value)