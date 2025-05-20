import requests
import json

LANGFLOW_URL = "http://localhost:7860"
SUPERUSER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhOTY3ZDA3NC01ODk4LTRhNmEtOTU1Zi1hMzYxZjExOWI0ZDkiLCJ0eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzQ3NzMxMDcyfQ.5tRExu36JvEZsPcCYKQSGZaDvB32asrl72WdeLEkVaE"

headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': f'Bearer {SUPERUSER_TOKEN}'
}

# Step 1: Create the user
create_url = f"{LANGFLOW_URL}/api/v1/users/"
create_payload = json.dumps({
    "username": "TestUser",
    "password": "TestUser"
})

create_response = requests.request("POST", create_url, headers=headers, data=create_payload)
print("User creation response:")
print(create_response.text)

if create_response.status_code == 200 or create_response.status_code == 201:
    user_data = json.loads(create_response.text)
    user_id = user_data.get("id")

    if user_id:
        patch_url = f"{LANGFLOW_URL}/api/v1/users/{user_id}"
        patch_payload = json.dumps({
            "is_active": True
        })

        patch_response = requests.request("PATCH", patch_url, headers=headers, data=patch_payload)
        print("\nUser activation response:")
        print(patch_response.text)
    else:
        print("Failed to get user ID from creation response.")
else:
    print(f"Failed to create user. Status code: {create_response.status_code}")