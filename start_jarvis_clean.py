#!/usr/bin/env python3
"""
Clean Start Script for JARVIS AI Assistant
Ensures no port conflicts and clean startup
"""

import subprocess
import sys
import os
import time
from pathlib import Path

def kill_port_8000():
    """Kill any process using port 8000"""
    try:
        result = subprocess.run(['lsof', '-ti:8000'], capture_output=True, text=True)
        if result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                if pid:
                    subprocess.run(['kill', '-9', pid], capture_output=True)
            print("🧹 Cleaned up port 8000")
        time.sleep(1)
    except:
        pass

def main():
    print("🤖 JARVIS AI Assistant - Clean Start")
    print("=" * 50)
    
    # Clean up any existing processes
    print("🧹 Cleaning up any existing processes...")
    kill_port_8000()
    
    base_dir = Path(__file__).parent
    electron_dir = base_dir / "electron-app"
    
    print("🚀 Starting JARVIS...")
    print("✨ Beautiful interface will open momentarily!")
    
    try:
        os.chdir(electron_dir)
        subprocess.run(["npm", "start"])
        
    except KeyboardInterrupt:
        print("\n👋 JARVIS shutting down...")
        kill_port_8000()
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\n💡 Troubleshooting:")
        print("1. Make sure Node.js is installed")
        print("2. Run: cd electron-app && npm install")

if __name__ == "__main__":
    main()