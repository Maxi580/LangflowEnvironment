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


# Create a simple HTTP server to serve an HTML page that sets the token
class TokenSetterHandler(BaseHTTPRequestHandler):
    def __init__(self, token_data, *args, **kwargs):
        self.token_data = token_data
        super().__init__(*args, **kwargs)

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

        # HTML with JavaScript that sets localStorage and redirects to Langflow
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Redirecting to Langflow...</title>
            <script>
                // Store the tokens in localStorage
                localStorage.setItem('access_token', '{self.token_data["access_token"]}');
                localStorage.setItem('token_type', '{self.token_data["token_type"]}');

                // Redirect to Langflow
                window.location.href = '{LANGFLOW_URL}';
            </script>
        </head>
        <body>
            <p>Redirecting to Langflow...</p>
        </body>
        </html>
        """

        self.wfile.write(html.encode())


def create_handler(*args, **kwargs):
    token_data = kwargs.pop('token_data')
    return lambda *args2, **kwargs2: TokenSetterHandler(token_data, *args2, **kwargs2)


if __name__ == "__main__":
    token_data = get_access_token()
    if token_data:
        handler = create_handler(token_data=token_data)
        server = HTTPServer(('localhost', 8000), handler)

        print("Starting server to set token and redirect...")
        server_thread = threading.Thread(target=server.serve_forever)
        server_thread.daemon = True
        server_thread.start()

        webbrowser.open('http://localhost:7860')

        time.sleep(5)
        server.shutdown()
        print("Server stopped. You should now be logged into Langflow.")