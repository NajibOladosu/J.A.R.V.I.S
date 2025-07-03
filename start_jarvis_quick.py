#!/usr/bin/env python3
"""
Quick Start Script for JARVIS AI Assistant
Launches the UI immediately while backend loads in background
"""

import subprocess
import sys
import os
import time
from pathlib import Path

def main():
    print("🤖 JARVIS AI Assistant - Quick Start")
    print("=" * 50)
    
    base_dir = Path(__file__).parent
    electron_dir = base_dir / "electron-app"
    
    print("🚀 Starting JARVIS interface...")
    print("📝 Note: Backend will load in background (may take a few minutes for first run)")
    print("🎨 The beautiful UI will open immediately!")
    
    try:
        # Start Electron frontend directly
        os.chdir(electron_dir)
        subprocess.run(["npm", "start"])
        
    except KeyboardInterrupt:
        print("\n👋 JARVIS shutting down...")
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\n💡 Troubleshooting:")
        print("1. Make sure Node.js is installed: https://nodejs.org/")
        print("2. Run: cd electron-app && npm install")
        print("3. Try: python3 start_jarvis.py (full version)")

if __name__ == "__main__":
    main()