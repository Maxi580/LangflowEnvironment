import os

import requests
import json
import webbrowser
import time

# Your LangFlow URL - replace with your actual server address
LANGFLOW_URL = "http://localhost:7860"  # Update this to your LangFlow server

# Authentication credentials
USERNAME = "admin"
PASSWORD = "complex-password123"


def get_access_token():
    """Get an access token from LangFlow API"""
    login_url = f"{LANGFLOW_URL}/api/v1/login"

    # Form data for login
    payload = {
        "username": USERNAME,
        "password": PASSWORD,
        "grant_type": "password"
    }

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    }

    response = requests.post(login_url, headers=headers, data=payload)

    if response.status_code == 200:
        print("Login successful!")
        return response.json()
    else:
        print(f"Login failed with status code: {response.status_code}")
        print(response.text)
        return None


def store_token_in_browser(token_data):
    """
    This function opens a browser with JavaScript that will store the token
    in localStorage and redirect to the dashboard
    """
    token = token_data['access_token']

    """"""# Create a simple HTML page that will:
    # 1. Store the token in localStorage
    # 2. Redirect to the LangFlow dashboard
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Auto Login</title>
        <script>
            // Store the token in localStorage
            localStorage.setItem('access_token', '{token}');

            // Redirect to dashboard
            window.location.href = '{LANGFLOW_URL}';
        </script>
    </head>
    <body>
        <p>Logging in automatically...</p>
    </body>
    </html>
    # Write the HTML to a temporary file
    with open('auto_login.html', 'w') as f:
        f.write(html)

    # Open the HTML file in a browser
    webbrowser.open('file://' + os.path.realpath('auto_login.html'))"""


# Main process
if __name__ == "__main__":
    # Get access token
    token_data = get_access_token()

    if token_data:
        print(f"Access token obtained: {token_data['access_token'][:10]}...")

        # Store token in browser and redirect to dashboard
        store_token_in_browser(token_data)
    else:
        print("Failed to get access token.")