import requests

LANGFLOW_URL = "http://localhost:7860"  # Update with your LangFlow URL
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NTA4MzI3My1lZDc1LTQ3YTItYWUxZC03NjIwODkyOGZhZmEiLCJ0eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc5MTc2OTgyfQ.0s5BaCAppVO7azjGiCIgZ8djH81B5yRPjV_txp8nFcQ"  # The token you received during login

logout_url = f"{LANGFLOW_URL}/api/v1/logout"
headers = {
    'Authorization': f'Bearer {TOKEN}',
    'Accept': 'application/json'
}

response = requests.post(logout_url, headers=headers)
print(f"Logout status: {response.status_code}")
print(response.text)