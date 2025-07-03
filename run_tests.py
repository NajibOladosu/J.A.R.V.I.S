#!/usr/bin/env python3
"""
Test runner for JARVIS AI Assistant
Runs both Python backend tests and JavaScript frontend tests
"""

import subprocess
import sys
import os
from pathlib import Path

def run_python_tests():
    """Run Python backend tests"""
    print("🐍 Running Python backend tests...")
    print("=" * 50)
    
    try:
        # Install test dependencies
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-r", "tests/requirements.txt"
        ], check=True)
        
        # Run tests with coverage
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            "tests/test_backend.py", 
            "-v", 
            "--tb=short"
        ], cwd=Path(__file__).parent)
        
        return result.returncode == 0
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Python tests failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Error running Python tests: {e}")
        return False

def run_javascript_tests():
    """Run JavaScript frontend tests"""
    print("\n🌐 Running JavaScript frontend tests...")
    print("=" * 50)
    
    try:
        # Check if Jest is available
        jest_path = Path("electron-app/node_modules/.bin/jest")
        if not jest_path.exists():
            print("Installing Jest...")
            subprocess.run([
                "npm", "install", "--save-dev", "jest", "@types/jest"
            ], cwd="electron-app", check=True)
        
        # Run Jest tests
        result = subprocess.run([
            "npm", "test"
        ], cwd="electron-app")
        
        return result.returncode == 0
        
    except subprocess.CalledProcessError as e:
        print(f"❌ JavaScript tests failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Error running JavaScript tests: {e}")
        return False

def check_backend_startup():
    """Test if the backend can start properly"""
    print("\n🚀 Testing backend startup...")
    print("=" * 50)
    
    try:
        # Try to import all modules
        sys.path.append(str(Path(__file__).parent / "python-backend"))
        
        from llm_interface import LLMInterface
        from intent_parser import IntentParser
        from task_router import TaskRouter
        
        print("✅ All Python modules can be imported successfully")
        
        # Test basic initialization
        parser = IntentParser()
        router = TaskRouter()
        
        print("✅ Core components initialize successfully")
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Initialization error: {e}")
        return False

def check_frontend_files():
    """Check if all frontend files are present"""
    print("\n📁 Checking frontend files...")
    print("=" * 50)
    
    required_files = [
        "electron-app/package.json",
        "electron-app/src/main.js",
        "electron-app/src/renderer.html",
        "electron-app/src/renderer.js",
        "electron-app/src/styles/main.css",
        "electron-app/src/styles/theme.css",
        "electron-app/src/utils/ipc.js",
        "electron-app/src/components/chat.js",
        "electron-app/src/components/settings.js"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print("❌ Missing frontend files:")
        for file_path in missing_files:
            print(f"   - {file_path}")
        return False
    else:
        print("✅ All frontend files are present")
        return True

def main():
    """Main test runner"""
    print("🧪 JARVIS AI Assistant - Test Suite")
    print("=" * 50)
    
    results = []
    
    # Check file integrity
    results.append(("Frontend Files", check_frontend_files()))
    
    # Check backend startup
    results.append(("Backend Startup", check_backend_startup()))
    
    # Run Python tests
    results.append(("Python Tests", run_python_tests()))
    
    # Run JavaScript tests
    results.append(("JavaScript Tests", run_javascript_tests()))
    
    # Print summary
    print("\n📊 Test Summary")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name:20} {status}")
        if success:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} test suites passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the output above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())