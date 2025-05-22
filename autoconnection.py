import requests
import json


def test_whoami_endpoint():
    """
    Test the LangFlow whoami endpoint with different authentication methods
    """

    # Replace with your actual LangFlow URL
    # Using localhost based on your docker-compose setup
    base_url = "http://localhost:7860"
    whoami_url = f"{base_url}/api/v1/users/whoami"

    print("Testing LangFlow /api/v1/users/whoami endpoint")
    print(f"URL: {whoami_url}")
    print("-" * 50)

    # Test 1: No authentication
    print("Test 1: No authentication")
    try:
        response = requests.get(whoami_url, headers={'Accept': 'application/json'})
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    print("-" * 30)

    # Test 2: With API key (Bearer token)
    print("Test 2: With API key (Bearer token)")

    # You'll need to replace this with your actual API key
    # To get an API key in LangFlow:
    # 1. Go to your LangFlow UI (http://localhost:7860)
    # 2. Click your user icon → Settings
    # 3. Click "Langflow API" → "Add New"
    # 4. Name your key and click "Create Secret Key"
    # 5. Copy the API key

    api_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YTI2N2FjMS1lNWI3LTQ3MGUtYjllZi03NDU0ZjgzYWE3ZGMiLCJ0eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzQ3OTA1NzYyfQ.-AOXQZTyYRcbysXttvicniAIDvWsA1Jbm7pBrOk5GMM"  # Replace with actual API key

    if api_key != "YOUR_API_KEY_HERE":
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        try:
            response = requests.get(whoami_url, headers=headers)
            print(f"Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            print(f"Response Body: {response.text}")

            if response.status_code == 200:
                try:
                    user_data = response.json()
                    print("✅ Authentication successful!")
                    print(f"User data: {json.dumps(user_data, indent=2)}")
                except json.JSONDecodeError:
                    print("✅ Authentication successful but response is not JSON")
            else:
                print("❌ Authentication failed")

        except Exception as e:
            print(f"Error: {e}")
    else:
        print("⚠️  Please replace 'YOUR_API_KEY_HERE' with your actual API key")

    print("-" * 30)

    # Test 3: With invalid token
    print("Test 3: With invalid token")
    invalid_headers = {
        'Accept': 'application/json',
        'Authorization': 'Bearer invalid_token_123',
        'Content-Type': 'application/json'
    }

    try:
        response = requests.get(whoami_url, headers=invalid_headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

    print("-" * 50)
    print("Test complete!")


if __name__ == "__main__":
    test_whoami_endpoint()