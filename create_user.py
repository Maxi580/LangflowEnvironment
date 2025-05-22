#!/usr/bin/env python3
"""
Test script for LangFlow token refresh endpoint
"""
import requests
import json
import sys
from typing import Dict, Optional


def test_token_refresh(base_url: str, current_token: Optional[str] = None) -> Dict:
    """
    Test the LangFlow token refresh endpoint

    Args:
        base_url: Base URL of your LangFlow instance (e.g., "http://localhost:7860")
        current_token: Optional current JWT token for authenticated refresh

    Returns:
        Dictionary with response details
    """
    refresh_url = f"{base_url}/api/v1/refresh"

    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {current_token}'
    }

    print(f"🔄 Testing token refresh at: {refresh_url}")
    print(f"📋 Headers: {json.dumps(headers, indent=2)}")

    try:
        # Test with POST method (as shown in your example)
        print("\n--- Testing POST method ---")
        response_post = requests.post(
            refresh_url,
            headers=headers,
            json={},  # Empty payload as shown in your example
            timeout=10
        )

        print(f"Status Code: {response_post.status_code}")
        print(f"Response Headers: {dict(response_post.headers)}")

        try:
            response_data = response_post.json()
            print(f"Response Body: {json.dumps(response_data, indent=2)}")
        except json.JSONDecodeError:
            print(f"Response Text: {response_post.text}")

        return {
            'post_status': response_post.status_code,
            'post_response': response_post.text,
            'success': response_post.status_code == 200
        }

    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return {
            'error': str(e),
            'success': False
        }


def main():
    """
    Main test function
    """
    # Configuration - UPDATE THESE VALUES
    LANGFLOW_BASE_URL = "http://localhost:7860"  # Change to your LangFlow URL

    # Optional: Add your current JWT token here for testing
    CURRENT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YTI2N2FjMS1lNWI3LTQ3MGUtYjllZi03NDU0ZjgzYWE3ZGMiLCJ0eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzQ3OTIxMTUyfQ.5PfbdNd6uEQ6yI-TxEeOZQEINT-f15sY4y-uHfKyDr4"

    # Optional: Add session cookies if you have them
    SESSION_COOKIES = None  # e.g., {'session_id': 'your_session_id'}

    print("🧪 LangFlow Token Refresh Test")
    print("=" * 50)

    # Test 1: Refresh without authentication
    print("\n1️⃣  Testing refresh without authentication:")
    result1 = test_token_refresh(LANGFLOW_BASE_URL)

    # Test 2: Refresh with JWT token (if provided)
    if CURRENT_TOKEN:
        print("\n2️⃣  Testing refresh with JWT token:")
        result2 = test_token_refresh(LANGFLOW_BASE_URL, CURRENT_TOKEN)
    else:
        print("\n2️⃣  Skipping JWT token test (no token provided)")
        result2 = None


    # Summary
    print("\n" + "=" * 50)
    print("📊 SUMMARY:")
    print(f"Without auth: {'✅ Success' if result1.get('success') else '❌ Failed'}")
    if result2:
        print(f"With JWT: {'✅ Success' if result2.get('success') else '❌ Failed'}")



if __name__ == "__main__":
    main()