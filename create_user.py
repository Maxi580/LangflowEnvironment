import requests
import json

LANGFLOW_URL = "http://localhost:7860"
url = f"{LANGFLOW_URL}/api/v1/users/"
SUPERUSER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhOTY3ZDA3NC01ODk4LTRhNmEtOTU1Zi1hMzYxZjExOWI0ZDkiLCJ0eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzQ3NzMxMDcyfQ.5tRExu36JvEZsPcCYKQSGZaDvB32asrl72WdeLEkVaE"

payload = json.dumps({
  "username": "MaxisUser2",
  "password": "MaxisUser2"
})

headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': f'Bearer {SUPERUSER_TOKEN}'
}


response = requests.request("POST", url, headers=headers, data=payload)


print(response.text)


