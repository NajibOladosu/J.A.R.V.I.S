import os
import subprocess
import platform
import psutil
import logging
from typing import Dict, Any

class SystemTasks:
    def __init__(self):
        self.platform = platform.system().lower()
        
    async def open_app(self, app_name: str) -> Dict[str, Any]:
        """Open an application by name"""
        try:
            app_commands = {
                'darwin': {  # macOS
                    'calculator': 'open -a Calculator',
                    'notepad': 'open -a TextEdit',
                    'browser': 'open -a Safari',
                    'chrome': 'open -a "Google Chrome"',
                    'firefox': 'open -a Firefox',
                    'finder': 'open .',
                    'terminal': 'open -a Terminal'
                },
                'windows': {
                    'calculator': 'calc',
                    'notepad': 'notepad',
                    'browser': 'start msedge',
                    'chrome': 'start chrome',
                    'firefox': 'start firefox',
                    'explorer': 'explorer',
                    'cmd': 'start cmd'
                },
                'linux': {
                    'calculator': 'gnome-calculator',
                    'notepad': 'gedit',
                    'browser': 'firefox',
                    'chrome': 'google-chrome',
                    'firefox': 'firefox',
                    'files': 'nautilus',
                    'terminal': 'gnome-terminal'
                }
            }
            
            # Get app command for current platform
            platform_apps = app_commands.get(self.platform, {})
            app_command = platform_apps.get(app_name.lower())
            
            if not app_command:
                # Try direct app name
                app_command = app_name
            
            # Execute command
            if self.platform == 'windows':
                subprocess.Popen(app_command, shell=True)
            else:
                subprocess.Popen(app_command.split())
            
            logging.info(f"Opened app: {app_name}")
            return {
                "success": True,
                "message": f"Successfully opened {app_name}",
                "app_name": app_name
            }
            
        except Exception as e:
            logging.error(f"Error opening app {app_name}: {e}")
            return {
                "success": False,
                "message": f"Failed to open {app_name}: {str(e)}"
            }
    
    async def get_system_info(self) -> Dict[str, Any]:
        """Get comprehensive system information"""
        try:
            # CPU information
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()
            
            # Memory information
            memory = psutil.virtual_memory()
            memory_gb = round(memory.total / (1024**3), 2)
            memory_used_gb = round(memory.used / (1024**3), 2)
            memory_percent = memory.percent
            
            # Disk information
            disk = psutil.disk_usage('/')
            disk_total_gb = round(disk.total / (1024**3), 2)
            disk_used_gb = round(disk.used / (1024**3), 2)
            disk_percent = round((disk.used / disk.total) * 100, 1)
            
            # Platform information
            system_info = {
                "platform": platform.system(),
                "platform_version": platform.version(),
                "architecture": platform.architecture()[0],
                "processor": platform.processor(),
                "hostname": platform.node(),
                "python_version": platform.python_version()
            }
            
            # Network interfaces
            network_interfaces = {}
            for interface, addresses in psutil.net_if_addrs().items():
                network_interfaces[interface] = [addr.address for addr in addresses]
            
            system_data = {
                "cpu": {
                    "usage_percent": cpu_percent,
                    "core_count": cpu_count,
                    "frequency_mhz": cpu_freq.current if cpu_freq else "Unknown"
                },
                "memory": {
                    "total_gb": memory_gb,
                    "used_gb": memory_used_gb,
                    "usage_percent": memory_percent,
                    "available_gb": round(memory.available / (1024**3), 2)
                },
                "disk": {
                    "total_gb": disk_total_gb,
                    "used_gb": disk_used_gb,
                    "usage_percent": disk_percent,
                    "free_gb": round(disk.free / (1024**3), 2)
                },
                "system": system_info,
                "network_interfaces": network_interfaces
            }
            
            logging.info("System information retrieved")
            return {
                "success": True,
                "message": "System information retrieved successfully",
                "data": system_data
            }
            
        except Exception as e:
            logging.error(f"Error getting system info: {e}")
            return {
                "success": False,
                "message": f"Failed to get system info: {str(e)}"
            }
    
    async def run_command(self, command: str, safe_mode: bool = True) -> Dict[str, Any]:
        """Run a system command (with safety restrictions)"""
        try:
            # Safety whitelist of allowed commands
            safe_commands = [
                'ls', 'dir', 'pwd', 'whoami', 'date', 'time',
                'ps', 'top', 'df', 'free', 'uptime', 'uname'
            ]
            
            if safe_mode:
                command_base = command.split()[0] if command.split() else ""
                if command_base not in safe_commands:
                    return {
                        "success": False,
                        "message": f"Command '{command_base}' not allowed in safe mode",
                        "safe_commands": safe_commands
                    }
            
            # Execute command with timeout
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            logging.info(f"Command executed: {command}")
            return {
                "success": True,
                "message": f"Command '{command}' executed successfully",
                "output": result.stdout,
                "error": result.stderr,
                "return_code": result.returncode
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "message": "Command timed out after 30 seconds"
            }
        except Exception as e:
            logging.error(f"Error running command: {e}")
            return {
                "success": False,
                "message": f"Failed to run command: {str(e)}"
            }