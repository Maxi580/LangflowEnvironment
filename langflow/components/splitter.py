from langflow.custom import Component
from langflow.io import MessageTextInput, StrInput, BoolInput, Output
from langflow.schema.message import Message


class TextBetweenExtractor(Component):
    display_name = "Text Between Keywords"
    description = "Extracts text between two keywords"
    icon = "text"

    inputs = [
        MessageTextInput(
            name="input_text",
            display_name="Input Text",
            info="The text to extract from"
        ),
        StrInput(
            name="start_keyword",
            display_name="Start Keyword",
            info="The keyword that marks the beginning",
            value=""
        ),
        StrInput(
            name="end_keyword",
            display_name="End Keyword",
            info="The keyword that marks the end (leave empty to extract until end of text)",
            value=""
        ),
        BoolInput(
            name="case_sensitive",
            display_name="Case Sensitive",
            info="Whether the search should be case sensitive",
            value=False
        )
    ]

    outputs = [
        Output(display_name="Message", name="text", method="extract_text")
    ]

    def extract_text(self) -> Message:
        text = self.input_text
        start_keyword = self.start_keyword
        end_keyword = self.end_keyword

        search_text = text if self.case_sensitive else text.lower()
        search_start = start_keyword if self.case_sensitive else start_keyword.lower()
        search_end = end_keyword.lower() if end_keyword and not self.case_sensitive else end_keyword

        start_pos = search_text.find(search_start)
        if start_pos == -1:
            extracted = ""
        else:
            extract_start = start_pos + len(start_keyword)

            if end_keyword:
                end_pos = search_text.find(search_end, extract_start)
                if end_pos != -1:
                    extract_end = end_pos
                else:
                    extract_end = len(text)
            else:
                extract_end = len(text)

            extracted = text[extract_start:extract_end].strip()

        message = Message(text=extracted)
        self.status = extracted
        return message