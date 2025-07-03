#!/usr/bin/env python3
"""
JARVIS AI Assistant Startup Script
Starts the Python backend and then launches the Electron frontend
"""

import subprocess
import sys
import os
import time
import signal
import platform
from pathlib import Path

class JarvisLauncher:
    def __init__(self):
        self.python_process = None
        self.electron_process = None
        self.base_dir = Path(__file__).parent
        self.python_backend_dir = self.base_dir / "python-backend"
        self.electron_app_dir = self.base_dir / "electron-app"
        # Windows compatibility for npm command
        self.npm_cmd = "npm.cmd" if platform.system() == "Windows" else "npm"
    
    def check_dependencies(self):
        """Check if all dependencies are installed"""
        print("🔍 Checking dependencies...")
        
        try:
            # Check Python dependencies
            try:
                import gpt4all
                import fastapi
                import uvicorn
                # Test psutil import separately to catch sysctl issues
                try:
                    import psutil
                    print("✅ Python dependencies are installed")
                except Exception as psutil_error:
                    if 'sysctl' in str(psutil_error) or 'proc_translated' in str(psutil_error):
                        print("⚠️  psutil has macOS compatibility issues but will likely work during runtime")
                        print("✅ Core Python dependencies are installed")
                    else:
                        raise psutil_error
            except ImportError as e:
                print(f"❌ Missing Python dependency: {e}")
                print("Installing Python dependencies...")
                subprocess.run([
                    sys.executable, "-m", "pip", "install", "-r", 
                    str(self.python_backend_dir / "requirements.txt")
                ], check=True)
            
            # Check Node.js dependencies
            if not (self.electron_app_dir / "node_modules").exists():
                print("📦 Installing Node.js dependencies...")
                subprocess.run([
                    self.npm_cmd, "install"
                ], cwd=self.electron_app_dir, check=True)
            else:
                print("✅ Node.js dependencies are installed")
                
        except subprocess.CalledProcessError as e:
            if 'sysctl' in str(e) or 'proc_translated' in str(e):
                print(f"⚠️  macOS system call failed during dependency check: {e}")
                print("   This is likely a macOS/psutil compatibility issue")
                print("   Continuing with startup - backend services may still work...")
            else:
                raise
    
    def initialize_ai_model(self):
        """Pre-download and initialize the AI model"""
        print("🧠 Initializing AI model...")
        print("   This may take several minutes on first run to download the model...")
        
        try:
            # Patch subprocess.run to handle the sysctl.proc_translated issue
            original_subprocess_run = subprocess.run
            
            def patched_subprocess_run(*args, **kwargs):
                # Check if this is the problematic sysctl call
                if (args and len(args) > 0 and 
                    isinstance(args[0], list) and 
                    len(args[0]) >= 3 and 
                    args[0][:3] == ['sysctl', '-n', 'sysctl.proc_translated']):
                    # Return a fake result indicating not running under Rosetta
                    class FakeResult:
                        def __init__(self):
                            self.stdout = "0"
                            self.stderr = ""
                            self.returncode = 0
                        def strip(self):
                            return "0"
                    result = FakeResult()
                    result.stdout = result  # Make stdout.strip() work
                    return result
                else:
                    return original_subprocess_run(*args, **kwargs)
            
            # Apply the patch
            subprocess.run = patched_subprocess_run
            
            # Import here to avoid issues if gpt4all isn't installed yet
            from gpt4all import GPT4All
            
            # Restore original subprocess.run
            subprocess.run = original_subprocess_run
            
            model_name = "orca-mini-3b-gguf2-q4_0.gguf"
            print(f"   Downloading/loading model: {model_name}")
            
            # Create the model instance (this will download if needed)
            # Set device to 'cpu' to avoid potential GPU/Metal detection issues on macOS
            model = GPT4All(model_name, allow_download=True, device='cpu')
            
            # Test the model with a simple prompt to ensure it's working
            print("   Testing model...")
            test_response = model.generate("Hello", max_tokens=10, temp=0.1)
            
            print("✅ AI model initialized successfully")
            print(f"   Model test response: {test_response[:50]}...")
            return True
            
        except subprocess.CalledProcessError as e:
            if 'sysctl' in str(e):
                print(f"❌ Failed to initialize AI model due to system detection issue: {e}")
                print("   This is likely a macOS compatibility issue with GPT4All")
                print("   The issue occurs at the library import level and cannot be resolved")
                return False
            else:
                print(f"❌ Failed to initialize AI model: {e}")
                return False
        except Exception as e:
            print(f"❌ Failed to initialize AI model: {e}")
            return False
    
    def start_python_backend(self):
        """Start the Python backend server"""
        print("🐍 Starting Python backend...")
        
        try:
            self.python_process = subprocess.Popen([
                sys.executable, "ipc_server.py",
                "--host", "127.0.0.1",
                "--port", "8000"
            ], cwd=self.python_backend_dir, 
               stdout=subprocess.PIPE, 
               stderr=subprocess.PIPE)
            
            # Wait a moment for the server to start
            time.sleep(3)
            
            if self.python_process.poll() is None:
                print("✅ Python backend started successfully on port 8000")
                return True
            else:
                stdout, stderr = self.python_process.communicate()
                print(f"❌ Python backend failed to start:")
                print(f"STDOUT: {stdout.decode()}")
                print(f"STDERR: {stderr.decode()}")
                return False
                
        except Exception as e:
            print(f"❌ Error starting Python backend: {e}")
            return False
    
    def start_electron_frontend(self):
        """Start the Electron frontend"""
        print("⚡ Starting Electron frontend...")
        
        try:
            self.electron_process = subprocess.Popen([
                self.npm_cmd, "start"
            ], cwd=self.electron_app_dir)
            
            print("✅ Electron frontend started successfully")
            return True
            
        except Exception as e:
            print(f"❌ Error starting Electron frontend: {e}")
            return False
    
    def cleanup(self, signum=None, frame=None):
        """Clean up processes on exit"""
        print("\n🧹 Cleaning up...")
        
        if self.electron_process:
            print("Stopping Electron frontend...")
            if self.electron_process.poll() is None:  # Still running
                self.electron_process.terminate()
                try:
                    self.electron_process.wait(timeout=3)
                    print("Electron process terminated gracefully")
                except subprocess.TimeoutExpired:
                    print("Force killing Electron process...")
                    self.electron_process.kill()
                    self.electron_process.wait()
            else:
                print("Electron process already terminated")
        
        if self.python_process:
            print("Stopping Python backend...")
            if self.python_process.poll() is None:  # Still running
                self.python_process.terminate()
                try:
                    self.python_process.wait(timeout=3)
                    print("Python backend terminated gracefully")
                except subprocess.TimeoutExpired:
                    print("Force killing Python backend...")
                    self.python_process.kill()
                    self.python_process.wait()
            else:
                print("Python backend already terminated")
        
        # Additional cleanup - kill any remaining npm/electron processes
        try:
            if platform.system() == "Windows":
                subprocess.run(["taskkill", "/F", "/IM", "electron.exe"], 
                             capture_output=True, check=False)
                subprocess.run(["taskkill", "/F", "/IM", "node.exe"], 
                             capture_output=True, check=False)
            else:
                subprocess.run(["pkill", "-f", "electron"], capture_output=True, check=False)
                subprocess.run(["pkill", "-f", "jarvis"], capture_output=True, check=False)
        except Exception as e:
            print(f"Additional cleanup failed: {e}")
        
        print("✅ Cleanup complete")
    
    def run(self):
        """Main run method"""
        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self.cleanup)
        signal.signal(signal.SIGTERM, self.cleanup)
        
        try:
            print("🤖 JARVIS AI Assistant")
            print("=" * 50)
            
            # Check dependencies
            self.check_dependencies()
            
            # Initialize AI model before starting services
            if not self.initialize_ai_model():
                print("❌ Failed to initialize AI model")
                return 1
            
            # Start backend
            if not self.start_python_backend():
                print("❌ Failed to start Python backend")
                return 1
            
            # Start frontend
            if not self.start_electron_frontend():
                print("❌ Failed to start Electron frontend")
                self.cleanup()
                return 1
            
            print("\n🎉 JARVIS is now running!")
            print("📝 Backend API: http://127.0.0.1:8000")
            print("🖥️  Frontend: Electron window should open")
            print("🛑 Press Ctrl+C to stop JARVIS")
            
            # Wait for Electron process to finish
            try:
                print("Waiting for Electron to close (or press Ctrl+C to force quit)...")
                
                while True:
                    # Check if Electron process is still running
                    if self.electron_process.poll() is not None:
                        print("Electron process has terminated")
                        break
                    
                    # Check every second - no timeout, let it run indefinitely
                    time.sleep(1)
                    
            except KeyboardInterrupt:
                print("Received interrupt signal")
                pass
            
            self.cleanup()
            return 0
            
        except subprocess.CalledProcessError as e:
            if 'sysctl' in str(e) or 'proc_translated' in str(e):
                print(f"❌ macOS system compatibility issue: {e}")
                print("🔄 This may be related to Rosetta/M1 Mac compatibility")
                print("💡 This should be handled by the sysctl patch in the code")
            else:
                print(f"❌ Unexpected subprocess error: {e}")
            self.cleanup()
            return 1
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            self.cleanup()
            return 1

def main():
    """Entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="JARVIS AI Assistant - Local AI with futuristic interface")
    parser.add_argument("--help-full", action="store_true", 
                       help="Show detailed usage information")
    
    args, unknown = parser.parse_known_args()
    
    if args.help_full:
        print("""
🤖 JARVIS AI Assistant - Help

QUICK START:
    python3 start_jarvis.py

FEATURES:
    🧠 Local AI with GPT4All (privacy-focused)
    📁 File management (create, search, read files)
    ⏰ Alarms and reminders
    🖥️  System monitoring and app launching
    🎤 Voice input and text-to-speech
    🎨 Futuristic UI with multiple themes

COMMANDS YOU CAN TRY:
    "Create a document called meeting-notes.txt"
    "Find all PDF files in my documents"
    "Set a reminder for 30 minutes to check the oven"
    "Show me the current system information"
    "Open calculator"

REQUIREMENTS:
    - Python 3.9+ with pip
    - Node.js 16+ with npm
    - 4GB RAM (8GB recommended)
    - 2GB free disk space

TROUBLESHOOTING:
    - Backend issues: Check Python dependencies
    - Frontend issues: Check Node.js dependencies  
    - Voice issues: Check microphone permissions
    - Performance: Ensure 8GB+ RAM for optimal AI

For full documentation, see README.md
        """)
        return 0
    
    launcher = JarvisLauncher()
    return launcher.run()

if __name__ == "__main__":
    sys.exit(main())