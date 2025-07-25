import os
import sys
from extraction import extract_text_and_image_from_slide
from pptx_generator import PowerPointGenerator


def process_powerpoint_batch(input_dir="old_format_presentations",
                             output_dir="new_format_presentations",
                             template_path="template.pptx"):
    """
    Main function to process all PowerPoint files in a directory.
    Extracts content from old format and creates new format presentations.

    Args:
        input_dir (str): Directory containing old format PowerPoint files
        output_dir (str): Directory to save new format PowerPoint files
        template_path (str): Path to the template file for new presentations
    """

    # Check if input directory exists
    if not os.path.exists(input_dir):
        print(f"❌ Error: Input directory '{input_dir}' not found")
        print("Please create the directory and place your PowerPoint files there")
        return

    # Check if template exists
    if not os.path.exists(template_path):
        print(f"❌ Error: Template file '{template_path}' not found")
        print("Please ensure the template file exists")
        return

    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    # Find all PowerPoint files
    ppt_extensions = ['.pptx', '.ppt']
    ppt_files = []

    for file in os.listdir(input_dir):
        # Skip temporary files (starting with ~$)
        if file.startswith('~$'):
            continue

        if any(file.lower().endswith(ext) for ext in ppt_extensions):
            ppt_files.append(os.path.join(input_dir, file))

    if not ppt_files:
        print(f"❌ No PowerPoint files found in '{input_dir}' directory")
        return

    print(f"🔍 Found {len(ppt_files)} PowerPoint file(s) to process:")
    for ppt_file in ppt_files:
        print(f"  - {os.path.basename(ppt_file)}")

    print("\n" + "=" * 60)
    print("STARTING BATCH PROCESSING")
    print("=" * 60)

    # Initialize the PowerPoint generator
    generator = PowerPointGenerator(template_path)

    # Counters for summary
    successful_conversions = 0
    failed_conversions = 0
    processing_results = []

    # Process each PowerPoint file
    for i, ppt_file in enumerate(ppt_files, 1):
        file_name = os.path.basename(ppt_file)
        print(f"\n📄 Processing {i}/{len(ppt_files)}: {file_name}")
        print("-" * 50)

        try:
            # Step 1: Extract content from old format
            print("🔍 Extracting content from old presentation...")
            extracted_data = extract_text_and_image_from_slide(ppt_file)

            if not extracted_data or not extracted_data.get('text_content'):
                print(f"❌ Failed to extract content from {file_name}")
                failed_conversions += 1
                processing_results.append({
                    'file': file_name,
                    'status': 'failed',
                    'reason': 'Content extraction failed'
                })
                continue

            text_content = extracted_data['text_content']

            # Step 2: Prepare data for new presentation
            print("📝 Preparing data for new presentation...")

            # Extract required fields with fallbacks
            customer_name = text_content.get('company_name', 'Unknown Client')
            about_client = text_content.get('the_client', 'No client information available')
            project_name = text_content.get('project_name', 'Unnamed Project')
            challenge_text = text_content.get('the_challenge', 'No challenge information available')
            solution_text = text_content.get('solution', 'No solution information available')
            impact_text = text_content.get('impact', 'No impact information available')

            # Print extracted content summary
            print(f"  ✓ Company Name: {customer_name[:50]}{'...' if len(customer_name) > 50 else ''}")
            print(f"  ✓ Project Name: {project_name[:50]}{'...' if len(project_name) > 50 else ''}")
            print(f"  ✓ Client Info: {len(about_client)} characters")
            print(f"  ✓ Challenge: {len(challenge_text)} characters")
            print(f"  ✓ Solution: {len(solution_text)} characters")
            print(f"  ✓ Impact: {len(impact_text)} characters")

            base_name = os.path.splitext(file_name)[0]
            safe_customer_name = "".join(c for c in customer_name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_customer_name = safe_customer_name.replace(' ', '_')
            output_filename = f"new_format_{safe_customer_name}_{base_name}.pptx"
            output_path = os.path.join(output_dir, output_filename)

            # Step 4: Handle logo if available
            logo_path = None
            if extracted_data.get('image_path') and os.path.exists(extracted_data['image_path']):
                logo_path = extracted_data['image_path']
                print(f"  ✓ Logo found: {logo_path}")
            else:
                print("  ⚠️ No logo found, will use placeholder")

            print("🎯 Creating new PowerPoint presentation...")

            created_file = generator.create_powerpoint(
                customer_name=customer_name,
                about_client=about_client,
                project_name=project_name,
                challenge_text=challenge_text,
                solution_text=solution_text,
                impact_text=impact_text,
                logo_path=logo_path,
                output_path=output_path
            )

            print(f"✅ Successfully created: {created_file}")
            successful_conversions += 1
            processing_results.append({
                'file': file_name,
                'status': 'success',
                'output': created_file,
                'customer': customer_name,
                'project': project_name
            })

        except Exception as e:
            print(f"❌ Error processing {file_name}: {str(e)}")
            failed_conversions += 1
            processing_results.append({
                'file': file_name,
                'status': 'failed',
                'reason': str(e)
            })

    # Print final summary
    print("\n" + "=" * 60)
    print("BATCH PROCESSING COMPLETE")
    print("=" * 60)
    print(f"📊 Total files processed: {len(ppt_files)}")
    print(f"✅ Successful conversions: {successful_conversions}")
    print(f"❌ Failed conversions: {failed_conversions}")

    if successful_conversions > 0:
        print(f"\n🎉 Successfully created presentations:")
        for result in processing_results:
            if result['status'] == 'success':
                print(f"  ✓ {result['file']} → {os.path.basename(result['output'])}")
                print(f"    Customer: {result['customer']}")
                print(f"    Project: {result['project']}")

    if failed_conversions > 0:
        print(f"\n⚠️ Failed conversions:")
        for result in processing_results:
            if result['status'] == 'failed':
                print(f"  ❌ {result['file']}: {result['reason']}")

    print(f"\n📁 New presentations saved to: {output_dir}")
    print("=" * 60)

    return processing_results


def process_single_file(input_file, output_file=None, template_path="template.pptx"):
    """
    Process a single PowerPoint file.

    Args:
        input_file (str): Path to input PowerPoint file
        output_file (str, optional): Path for output file
        template_path (str): Path to template file

    Returns:
        str: Path to created file, or None if failed
    """

    if not os.path.exists(input_file):
        print(f"❌ Input file not found: {input_file}")
        return None

    if not os.path.exists(template_path):
        print(f"❌ Template file not found: {template_path}")
        return None

    print(f"📄 Processing single file: {os.path.basename(input_file)}")
    print("-" * 50)

    try:
        # Extract content
        print("🔍 Extracting content...")
        extracted_data = extract_text_and_image_from_slide(input_file)

        if not extracted_data or not extracted_data.get('text_content'):
            print("❌ Failed to extract content")
            return None

        text_content = extracted_data['text_content']

        # Prepare data
        customer_name = text_content.get('company_name', 'Unknown Client')
        about_client = text_content.get('the_client', 'No client information available')
        project_name = text_content.get('project_name', 'Unnamed Project')
        challenge_text = text_content.get('the_challenge', 'No challenge information available')
        solution_text = text_content.get('solution', 'No solution information available')
        impact_text = text_content.get('impact', 'No impact information available')

        # Generate output filename if not provided
        if not output_file:
            base_name = os.path.splitext(os.path.basename(input_file))[0]
            safe_customer_name = "".join(c for c in customer_name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_customer_name = safe_customer_name.replace(' ', '_')
            output_file = f"new_format_{safe_customer_name}_{base_name}.pptx"

        # Handle logo
        logo_path = None
        if extracted_data.get('image_path') and os.path.exists(extracted_data['image_path']):
            logo_path = extracted_data['image_path']

        # Create presentation
        print("🎯 Creating new presentation...")
        generator = PowerPointGenerator(template_path)

        created_file = generator.create_powerpoint(
            customer_name=customer_name,
            about_client=about_client,
            project_name=project_name,
            challenge_text=challenge_text,
            solution_text=solution_text,
            impact_text=impact_text,
            logo_path=logo_path,
            output_path=output_file
        )

        print(f"✅ Successfully created: {created_file}")
        return created_file

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None


def main():
    print("🚀 Starting PowerPoint Processing")
    print("=" * 60)

    input_directory = "old_format_presentations"
    output_directory = "new_format_presentations"
    template_file = "template.pptx"

    results = process_powerpoint_batch(
        input_dir=input_directory,
        output_dir=output_directory,
        template_path=template_file
    )

    failed_count = sum(1 for r in results if r['status'] == 'failed')
    if failed_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
