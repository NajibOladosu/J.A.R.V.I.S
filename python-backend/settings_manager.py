import json
import os
import logging
from pathlib import Path
from typing import Dict, Any

class SettingsManager:
    def __init__(self, settings_file: str = "settings.json"):
        self.settings_file = Path(__file__).parent / settings_file
        self.default_settings = {
            "ai_model": "orca-mini-3b-gguf2-q4_0.gguf",
            "voice_enabled": True,
            "backend_port": 8000,
            "theme": "dark",
            "auto_start": False,
            "log_level": "INFO"
        }
        self.settings = self.load_settings()
    
    def load_settings(self) -> Dict[str, Any]:
        """Load settings from file, create with defaults if not exists"""
        try:
            if self.settings_file.exists():
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    settings = json.load(f)
                
                # Merge with defaults to ensure all keys exist
                merged_settings = self.default_settings.copy()
                merged_settings.update(settings)
                return merged_settings
            else:
                # Create default settings file
                self.save_settings(self.default_settings)
                return self.default_settings.copy()
                
        except Exception as e:
            logging.error(f"Error loading settings: {e}")
            return self.default_settings.copy()
    
    def save_settings(self, settings: Dict[str, Any] = None) -> bool:
        """Save settings to file"""
        try:
            settings_to_save = settings or self.settings
            
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(settings_to_save, f, indent=2, ensure_ascii=False)
            
            if settings:
                self.settings = settings.copy()
            
            logging.info(f"Settings saved to {self.settings_file}")
            return True
            
        except Exception as e:
            logging.error(f"Error saving settings: {e}")
            return False
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get a setting value"""
        return self.settings.get(key, default)
    
    def set(self, key: str, value: Any) -> bool:
        """Set a setting value and save to file"""
        try:
            self.settings[key] = value
            return self.save_settings()
        except Exception as e:
            logging.error(f"Error setting {key}: {e}")
            return False
    
    def update_from_frontend(self, frontend_settings: Dict[str, Any]) -> bool:
        """Update settings from frontend localStorage format"""
        try:
            # Map frontend keys to backend keys
            key_mapping = {
                'jarvis-ai-model': 'ai_model',
                'jarvis-voice-enabled': 'voice_enabled',
                'jarvis-backend-port': 'backend_port',
                'jarvis-theme': 'theme',
                'jarvis-auto-start': 'auto_start'
            }
            
            updated = False
            for frontend_key, backend_key in key_mapping.items():
                if frontend_key in frontend_settings:
                    value = frontend_settings[frontend_key]
                    
                    # Convert string values to appropriate types
                    if backend_key == 'voice_enabled' or backend_key == 'auto_start':
                        value = str(value).lower() == 'true'
                    elif backend_key == 'backend_port':
                        value = int(value)
                    
                    if self.settings.get(backend_key) != value:
                        self.settings[backend_key] = value
                        updated = True
            
            if updated:
                return self.save_settings()
            return True
            
        except Exception as e:
            logging.error(f"Error updating from frontend settings: {e}")
            return False
    
    def get_ai_model(self) -> str:
        """Get the currently selected AI model"""
        return self.get('ai_model', 'orca-mini-3b-gguf2-q4_0.gguf')
    
    
    def get_backend_port(self) -> int:
        """Get the backend port"""
        return self.get('backend_port', 8000)
    
    def is_voice_enabled(self) -> bool:
        """Check if voice is enabled"""
        return self.get('voice_enabled', True)
    
    def export_settings(self, file_path: str = None) -> bool:
        """Export settings to a file"""
        try:
            if not file_path:
                file_path = f"jarvis_settings_export_{int(time.time())}.json"
            
            export_data = {
                'settings': self.settings,
                'export_timestamp': time.time(),
                'version': '1.0.0'
            }
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)
            
            logging.info(f"Settings exported to {file_path}")
            return True
            
        except Exception as e:
            logging.error(f"Error exporting settings: {e}")
            return False
    
    def import_settings(self, file_path: str) -> bool:
        """Import settings from a file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                import_data = json.load(f)
            
            if 'settings' in import_data:
                imported_settings = import_data['settings']
                
                # Validate imported settings
                valid_settings = {}
                for key, value in imported_settings.items():
                    if key in self.default_settings:
                        valid_settings[key] = value
                
                # Merge with current settings
                self.settings.update(valid_settings)
                
                return self.save_settings()
            else:
                logging.error("Invalid settings file format")
                return False
                
        except Exception as e:
            logging.error(f"Error importing settings: {e}")
            return False
    
    def reset_to_defaults(self) -> bool:
        """Reset all settings to defaults"""
        try:
            self.settings = self.default_settings.copy()
            return self.save_settings()
        except Exception as e:
            logging.error(f"Error resetting settings: {e}")
            return False
    
    def __str__(self) -> str:
        """String representation of settings"""
        return json.dumps(self.settings, indent=2)

# Global settings instance
settings = SettingsManager()