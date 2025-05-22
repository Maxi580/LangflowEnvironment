import os
import requests
import json
import webbrowser
import time
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

LANGFLOW_URL = "http://localhost:7860"
USERNAME = "admin"
PASSWORD = "admin"


def get_access_token():
    login_url = f"{LANGFLOW_URL}/api/v1/login"

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

if __name__ == "__main__":
    token_data = get_access_token()
    print(token_data)