from langflow.custom import Component
from langflow.io import Output, MultilineInput
from langflow.schema import Data
from pptx import Presentation
import tempfile
import base64
import os
from dotenv import load_dotenv

load_dotenv()

PPTX_MAGIC_BYTES = os.getenv("PPTX_MAGIC_BYTES")
TEMPLATE_PATH = os.getenv("TEMPLATE_PATH")


class AtosTemplatePowerPointComponent(Component):
    display_name = "Atos Template PowerPoint"
    description = "Creates PowerPoint from Atos template by replacing placeholder text"
    icon = "📊"
    inputs = [
        MultilineInput(
            name="customer_name",
            display_name="Customer Name",
            info="Customer name to replace {{CUSTOMER_NAME}} and search for logo",
            required=True,
        ),
        MultilineInput(
            name="about_client",
            display_name="About Client",
            info="Project name to replace {{ABOUT_CLIENT}}",
            required=True,
        ),
        MultilineInput(
            name="project_name",
            display_name="Project Name",
            info="Project name to replace {{PROJECT_NAME}}",
            required=True,
        ),
        MultilineInput(
            name="challenge_text",
            display_name="Challenge Description",
            info="Challenge description to replace {{CHALLENGE_TEXT}}",
            required=True,
        ),
        MultilineInput(
            name="solution_text",
            display_name="Solution Description",
            info="Solution description to replace {{SOLUTION_TEXT}}",
            required=True,
        ),
        MultilineInput(
            name="impact_text",
            display_name="Impact Description",
            info="Impact description to replace {{IMPACT_TEXT}}",
            required=True,
        ),
    ]

    outputs = [
        Output(
            display_name="Response",
            name="response_output",
            method="create_powerpoint"
        )
    ]

    def find_and_replace_text_in_slide(self, slide, replacements):
        """
        Find and replace text in all text boxes on a slide
        """
        replacements_made = 0

        for shape in slide.shapes:
            if hasattr(shape, "text_frame"):
                text_frame = shape.text_frame

                for paragraph in text_frame.paragraphs:
                    for run in paragraph.runs:
                        original_text = run.text

                        for placeholder, replacement in replacements.items():
                            if placeholder in run.text:
                                run.text = run.text.replace(placeholder, replacement)
                                replacements_made += 1
                                print(f"✓ Replaced '{placeholder}' with '{replacement[:30]}...'")

            elif hasattr(shape, "table"):
                table = shape.table
                for row in table.rows:
                    for cell in row.cells:
                        for paragraph in cell.text_frame.paragraphs:
                            for run in paragraph.runs:
                                for placeholder, replacement in replacements.items():
                                    if placeholder in run.text:
                                        run.text = run.text.replace(placeholder, replacement)
                                        replacements_made += 1
                                        print(f"✓ Replaced '{placeholder}' with '{replacement[:30]}...' (in table)")

        return replacements_made

    def create_powerpoint(self) -> Data:
        """Create PowerPoint from Atos template by replacing placeholders"""

        try:
            if not os.path.exists(TEMPLATE_PATH):
                return Data(data={
                    "text": f"❌ Template file not found at {TEMPLATE_PATH}. Please save your PowerPoint template as 'template.pptx' in the same directory."})

            prs = Presentation(TEMPLATE_PATH)
            print(f"✓ Loaded template with {len(prs.slides)} slides")

            replacements = {
                '{{CUSTOMER_NAME}}': self.customer_name,
                '{{ABOUT_CLIENT}}': self.about_client,
                '{{PROJECT_NAME}}': self.project_name,
                '{{CHALLENGE_TEXT}}': self.challenge_text,
                '{{SOLUTION_TEXT}}': self.solution_text,
                '{{IMPACT_TEXT}}': self.impact_text,
            }

            total_replacements = 0
            for slide_idx, slide in enumerate(prs.slides):
                print(f"\n🔄 Processing slide {slide_idx + 1}...")

                replacements_made = self.find_and_replace_text_in_slide(slide, replacements)
                total_replacements += replacements_made

            print(f"\n✅ Made {total_replacements} text replacements")

            temp_file = tempfile.NamedTemporaryFile(suffix='.pptx', delete=False)
            temp_file_path = temp_file.name
            temp_file.close()

            prs.save(temp_file_path)

            with open(temp_file_path, 'rb') as f:
                file_content = f.read()

            os.unlink(temp_file_path)

            base64_content = base64.b64encode(file_content).decode('utf-8')
            filename = f"reference_{self.customer_name.replace(' ', '_').lower()}.pptx"

            text_response = f"""PowerPoint created successfully!

<{PPTX_MAGIC_BYTES}>
filename:{filename}
content_type:application/vnd.openxmlformats-officedocument.presentationml.presentation
size:{len(file_content)}
data:{base64_content}
</{PPTX_MAGIC_BYTES}>"""

            return Data(data={"text": text_response})

        except Exception as e:
            error_text = f"❌ Failed to create PowerPoint from template: {str(e)}"
            return Data(data={"text": error_text})


def verify_template_setup():
    """
    Verify that the template is set up correctly
    """

    if not os.path.exists(TEMPLATE_PATH):
        print("❌ Template not found!")
        print("\n📋 Setup Instructions:")
        print("1. Save your PowerPoint template as 'template.pptx'")
        print("2. Make sure it contains these placeholders:")
        print("   - {{CUSTOMER_NAME}}")
        print("   - {{ABOUT_CLIENT}}")
        print("   - {{PROJECT_NAME}}")
        print("   - {{CHALLENGE_TEXT}}")
        print("   - {{SOLUTION_TEXT}}")
        print("   - {{IMPACT_TEXT}}")
        return False

    try:
        prs = Presentation(TEMPLATE_PATH)
        print(f"✅ Template found with {len(prs.slides)} slides")

        placeholders_found = []
        expected_placeholders = [
            "{{CUSTOMER_NAME}}", "{{ABOUT_CLIENT}}", "{{PROJECT_NAME}}", "{{CHALLENGE_TEXT}}",
            "{{SOLUTION_TEXT}}", "{{IMPACT_TEXT}}"
        ]

        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text_frame"):
                    text = shape.text_frame.text
                    for placeholder in expected_placeholders:
                        if placeholder in text and placeholder not in placeholders_found:
                            placeholders_found.append(placeholder)

        print(f"\n🔍 Placeholders found: {len(placeholders_found)}/{len(expected_placeholders)}")
        for placeholder in placeholders_found:
            print(f"  ✅ {placeholder}")

        missing = [p for p in expected_placeholders if p not in placeholders_found]
        if missing:
            print(f"\n⚠️  Missing placeholders:")
            for placeholder in missing:
                print(f"  ❌ {placeholder}")

        return len(missing) == 0

    except Exception as e:
        print(f"❌ Error reading template: {e}")
        return False


if __name__ == "__main__":
    verify_template_setup()