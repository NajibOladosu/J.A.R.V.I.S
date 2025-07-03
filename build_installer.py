#!/usr/bin/env python3
"""
Build installer for JARVIS AI Assistant
Creates distributable packages for macOS, Windows, and Linux
"""

import subprocess
import sys
import os
import shutil
from pathlib import Path

class InstallerBuilder:
    def __init__(self):
        self.base_dir = Path(__file__).parent
        self.electron_dir = self.base_dir / "electron-app"
        self.dist_dir = self.electron_dir / "dist"
    
    def check_dependencies(self):
        """Check if electron-builder is available"""
        print("🔍 Checking build dependencies...")
        
        try:
            # Check if electron-builder is installed
            result = subprocess.run([
                "npm", "list", "electron-builder"
            ], cwd=self.electron_dir, capture_output=True, text=True)
            
            if result.returncode != 0:
                print("📦 Installing electron-builder...")
                subprocess.run([
                    "npm", "install", "--save-dev", "electron-builder"
                ], cwd=self.electron_dir, check=True)
            
            print("✅ Build dependencies are ready")
            return True
            
        except Exception as e:
            print(f"❌ Error checking dependencies: {e}")
            return False
    
    def create_icons(self):
        """Create placeholder icons for the app"""
        print("🎨 Creating application icons...")
        
        assets_dir = self.electron_dir / "assets"
        assets_dir.mkdir(exist_ok=True)
        
        # Create a simple text-based icon placeholder
        icon_content = """# JARVIS Application Icons

This directory should contain:
- icon.png (512x512) - Linux AppImage icon
- icon.icns - macOS application icon  
- icon.ico - Windows application icon
- tray-icon.png (16x16) - System tray icon
- tray-icon@2x.png (32x32) - Retina system tray icon

For a production build, replace these with actual icon files.
You can use tools like:
- png2icns (macOS) for .icns files
- ImageMagick for icon conversion
- Online icon converters
"""
        
        with open(assets_dir / "icons-readme.txt", "w") as f:
            f.write(icon_content)
        
        print("✅ Icon placeholders created")
    
    def prepare_build(self):
        """Prepare the build environment"""
        print("🔧 Preparing build environment...")
        
        # Clean previous builds
        if self.dist_dir.exists():
            shutil.rmtree(self.dist_dir)
            print("🧹 Cleaned previous build artifacts")
        
        # Ensure all dependencies are installed
        subprocess.run([
            "npm", "install"
        ], cwd=self.electron_dir, check=True)
        
        print("✅ Build environment prepared")
    
    def build_for_platform(self, platform):
        """Build installer for specific platform"""
        print(f"🏗️  Building for {platform}...")
        
        platform_commands = {
            "mac": "build-mac",
            "windows": "build-win", 
            "linux": "build-linux",
            "all": "build"
        }
        
        command = platform_commands.get(platform, "build")
        
        try:
            result = subprocess.run([
                "npm", "run", command
            ], cwd=self.electron_dir, check=True)
            
            print(f"✅ {platform.capitalize()} build completed successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ {platform.capitalize()} build failed: {e}")
            return False
    
    def show_build_info(self):
        """Show information about build artifacts"""
        print("\n📦 Build Information")
        print("=" * 50)
        
        if self.dist_dir.exists():
            artifacts = list(self.dist_dir.iterdir())
            if artifacts:
                print("Built artifacts:")
                for artifact in artifacts:
                    size = self.get_file_size(artifact)
                    print(f"  📄 {artifact.name} ({size})")
                
                print(f"\n📍 Location: {self.dist_dir}")
            else:
                print("No build artifacts found")
        else:
            print("No build directory found")
    
    def get_file_size(self, path):
        """Get human readable file size"""
        if path.is_file():
            size = path.stat().st_size
            for unit in ['B', 'KB', 'MB', 'GB']:
                if size < 1024:
                    return f"{size:.1f}{unit}"
                size /= 1024
            return f"{size:.1f}TB"
        elif path.is_dir():
            return "Directory"
        return "Unknown"
    
    def create_portable_package(self):
        """Create a portable zip package"""
        print("📦 Creating portable package...")
        
        try:
            # Use electron-builder's --dir flag for portable build
            subprocess.run([
                "npm", "run", "pack"
            ], cwd=self.electron_dir, check=True)
            
            print("✅ Portable package created")
            return True
            
        except Exception as e:
            print(f"❌ Portable package creation failed: {e}")
            return False
    
    def run(self, platform="current"):
        """Main build process"""
        print("🏗️  JARVIS AI Assistant - Installer Builder")
        print("=" * 50)
        
        # Check dependencies
        if not self.check_dependencies():
            return 1
        
        # Create icons
        self.create_icons()
        
        # Prepare build
        self.prepare_build()
        
        # Determine platform
        if platform == "current":
            import platform as plt
            system = plt.system().lower()
            platform_map = {
                "darwin": "mac",
                "windows": "windows", 
                "linux": "linux"
            }
            platform = platform_map.get(system, "linux")
        
        success = True
        
        # Build for platform
        if platform == "all":
            platforms = ["mac", "windows", "linux"]
            for p in platforms:
                if not self.build_for_platform(p):
                    success = False
        else:
            success = self.build_for_platform(platform)
        
        # Create portable package
        if success:
            self.create_portable_package()
        
        # Show build information
        self.show_build_info()
        
        if success:
            print("\n🎉 Build completed successfully!")
            print("\n🚀 To distribute JARVIS:")
            print("1. Test the built application thoroughly")
            print("2. Create proper application icons") 
            print("3. Code sign the application (for macOS/Windows)")
            print("4. Upload to app stores or distribute directly")
            return 0
        else:
            print("\n❌ Build failed. Check the errors above.")
            return 1

def main():
    """Entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Build JARVIS AI Assistant installer")
    parser.add_argument("--platform", 
                       choices=["mac", "windows", "linux", "all", "current"],
                       default="current",
                       help="Platform to build for (default: current)")
    
    args = parser.parse_args()
    
    builder = InstallerBuilder()
    return builder.run(args.platform)

if __name__ == "__main__":
    sys.exit(main())