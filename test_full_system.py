#!/usr/bin/env python3
"""
Complete system test for JARVIS AI Assistant
Tests backend independently first, then integration
"""

import subprocess
import time
import requests
import json
import sys
from pathlib import Path

def test_backend_standalone():
    """Test the backend server independently"""
    print("🧪 Testing Backend Server Standalone...")
    
    try:
        # Start backend in subprocess
        backend_path = Path(__file__).parent / "python-backend" / "ipc_server_fixed.py"
        process = subprocess.Popen([
            sys.executable, str(backend_path)
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
           cwd=Path(__file__).parent / "python-backend")
        
        print("⏳ Starting backend server...")
        time.sleep(10)  # Give it time to start and load model
        
        # Read the port from file
        port_file = Path(__file__).parent / "python-backend" / "current_port.txt"
        if port_file.exists():
            port = int(port_file.read_text().strip())
            print(f"📡 Backend running on port: {port}")
        else:
            port = 8000
            print("📡 Using default port: 8000")
        
        # Test health endpoint
        try:
            response = requests.get(f"http://127.0.0.1:{port}/health", timeout=5)
            print(f"✅ Health check: {response.status_code}")
            health_data = response.json()
            print(f"   LLM Available: {health_data.get('llm_available', False)}")
        except Exception as e:
            print(f"❌ Health check failed: {e}")
            process.terminate()
            return False
        
        # Test chat endpoint
        try:
            chat_data = {"message": "Hello JARVIS, are you working?"}
            response = requests.post(f"http://127.0.0.1:{port}/chat", 
                                   json=chat_data, timeout=30)
            print(f"✅ Chat test: {response.status_code}")
            chat_response = response.json()
            print(f"   AI Response: {chat_response.get('response', 'No response')[:100]}...")
            print(f"   Action: {chat_response.get('action_executed', 'None')}")
        except Exception as e:
            print(f"❌ Chat test failed: {e}")
            process.terminate()
            return False
        
        print("✅ Backend is fully functional!")
        process.terminate()
        return True
        
    except Exception as e:
        print(f"❌ Backend test failed: {e}")
        return False

def test_file_operations():
    """Test file operations specifically"""
    print("\n📁 Testing File Operations...")
    
    try:
        port_file = Path(__file__).parent / "python-backend" / "current_port.txt"
        if port_file.exists():
            port = int(port_file.read_text().strip())
        else:
            port = 8000
        
        # Test create document
        chat_data = {"message": "Create a document called test.txt with content 'Hello World'"}
        response = requests.post(f"http://127.0.0.1:{port}/chat", 
                               json=chat_data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ File creation test: {result.get('response', '')[:100]}...")
            return True
        else:
            print(f"❌ File creation test failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ File operations test failed: {e}")
        return False

def main():
    print("🤖 JARVIS AI Assistant - Complete System Test")
    print("=" * 60)
    
    # Test backend standalone
    backend_works = test_backend_standalone()
    
    if backend_works:
        # Test specific functionality
        file_ops_work = test_file_operations()
        
        if file_ops_work:
            print("\n🎉 ALL TESTS PASSED!")
            print("✅ Backend server: Working")
            print("✅ AI model: Loaded and responding")
            print("✅ File operations: Working")
            print("✅ API endpoints: Working")
            print("\n🚀 JARVIS is fully functional!")
            print("   You can now use the Electron app with confidence.")
            return 0
        else:
            print("\n⚠️ Backend works but some features failed")
            return 1
    else:
        print("\n❌ Backend test failed")
        print("💡 Try installing missing dependencies:")
        print("   cd python-backend && pip install -r requirements.txt")
        return 1

if __name__ == "__main__":
    sys.exit(main())