#!/usr/bin/env python3
"""
Simple test to verify backend functionality
"""

import requests
import json
import sys

def test_backend():
    print("🧪 Testing JARVIS Backend...")
    
    try:
        # Test health endpoint
        response = requests.get("http://127.0.0.1:8001/health", timeout=5)
        print(f"Health check: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # Test chat endpoint
        chat_data = {"message": "Hello JARVIS, are you working?"}
        response = requests.post("http://127.0.0.1:8001/chat", 
                               json=chat_data, 
                               timeout=30)
        print(f"Chat test: {response.status_code}")
        print(f"Response: {response.json()}")
        
        print("✅ Backend is working!")
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend on port 8001")
        return False
    except requests.exceptions.Timeout:
        print("❌ Backend request timed out")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = test_backend()
    sys.exit(0 if success else 1)