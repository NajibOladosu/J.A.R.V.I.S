import json
import logging
import os
import asyncio
import signal
import subprocess
from typing import Dict, Any
from settings_manager import settings

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

try:
    from gpt4all import GPT4All
    logging.info("GPT4All imported successfully with sysctl patch")
except Exception as e:
    logging.error(f"GPT4All import failed: {e}")
    raise
finally:
    # Restore original subprocess.run
    subprocess.run = original_subprocess_run

class LLMInterface:
    def __init__(self, model_name: str = None):
        # Get model from settings, fallback to parameter or default
        self.model_name = model_name or settings.get_ai_model()
        self.model = None
        self.model_initialized = False
        self.system_prompt = """You are JARVIS, a helpful AI assistant. You help users with various tasks.

IMPORTANT: You must respond with ONLY a JSON object in this exact format:
{
    "response": "Your helpful response to the user",
    "action": "action_name or null",
    "params": {"param": "value"}
}

Available actions:
- create_document: Create files. Params: {"name": "filename.txt", "content": "file content"}
- find_files: Search files. Params: {"extension": "txt", "folder": "."}
- set_alarm: Set reminders. Params: {"minutes": 5, "message": "reminder text"}
- open_app: Open applications. Params: {"app_name": "calculator"}
- get_system_info: Get system info. Params: {}
- read_document: Read files. Params: {"name": "filename.txt"}

Examples:
User: "Create a file called hello.txt"
Response: {"response": "I'll create a file called hello.txt for you.", "action": "create_document", "params": {"name": "hello.txt", "content": "Hello World!"}}

User: "What can you do?"
Response: {"response": "I can help you create files, set reminders, open apps, and get system information. What would you like me to do?", "action": null, "params": {}}

RESPOND ONLY WITH THE JSON OBJECT - NO OTHER TEXT."""

    async def reload_settings(self):
        """Reload settings and reinitialize model if needed"""
        old_model_name = self.model_name
        
        # Reload settings
        settings.load_settings()
        new_model_name = settings.get_ai_model()
        
        # Check if model changed
        if old_model_name != new_model_name:
            logging.info(f"Model changed: {old_model_name} -> {new_model_name}")
            
            self.model_name = new_model_name
            
            # Reset model for different model
            self.model = None
            self.model_initialized = False
            logging.info("Model will be reinitialized on next request")

    async def initialize(self):
        """Initialize the GPT4All model (assumes model is already downloaded)"""
        if self.model_initialized:
            return True
            
        logging.info(f"Loading GPT4All model {self.model_name}...")
        
        try:
            # Run the model initialization in a thread (should be fast now since model is pre-downloaded)
            def init_model():
                return GPT4All(self.model_name, allow_download=False)
            
            # Use asyncio to run in executor with shorter timeout since model should exist
            loop = asyncio.get_event_loop()
            self.model = await asyncio.wait_for(
                loop.run_in_executor(None, init_model),
                timeout=60.0  # 1 minute timeout for loading existing model
            )
            
            self.model_initialized = True
            logging.info(f"GPT4All model {self.model_name} loaded successfully")
            return True
            
        except asyncio.TimeoutError:
            logging.error("Model loading timed out after 1 minute")
            self.model_initialized = False
            return False
        except Exception as e:
            logging.error(f"Failed to load GPT4All model: {e}")
            logging.error("Model may not be downloaded. Try running the startup script again.")
            self.model_initialized = False
            return False

    async def generate_response(self, user_input: str, context: str = "") -> Dict[str, Any]:
        """Generate response from the LLM"""
        if not self.model_initialized:
            success = await self.initialize()
            if not success:
                return {
                    "response": "I'm sorry, I'm having trouble initializing my AI model. Please check the logs for details.",
                    "action": None,
                    "params": {}
                }
        
        try:
            # Improved prompt with better structure
            prompt = f"""You are JARVIS, a helpful AI assistant. You help users with various tasks.

IMPORTANT: You must respond with ONLY a JSON object in this exact format:
{{"response": "Your helpful response to the user", "action": "action_name or null", "params": {{"param": "value"}}}}

Available actions:
- create_document: Create files. Params: {{"name": "filename.txt", "content": "file content"}}
- find_files: Search files. Params: {{"extension": "txt", "folder": "."}}
- set_alarm: Set reminders. Params: {{"minutes": 5, "message": "reminder text"}}
- open_app: Open applications. Params: {{"app_name": "calculator"}}
- get_system_info: Get system info. Params: {{}}
- read_document: Read files. Params: {{"name": "filename.txt"}}

Examples:
User: "Create a file called hello.txt"
JARVIS: {{"response": "I'll create a file called hello.txt for you.", "action": "create_document", "params": {{"name": "hello.txt", "content": "Hello World!"}}}}

User: "What can you do?"
JARVIS: {{"response": "I can help you create files, set reminders, open apps, and get system information. What would you like me to do?", "action": null, "params": {{}}}}

User: {user_input}
JARVIS:"""
            
            # Generate with better parameters for JSON output
            response = self.model.generate(
                prompt,
                max_tokens=256,
                temp=0.3,
                top_p=0.8,
                repeat_penalty=1.1
            )
            
            # Clean the response
            response = response.strip()
            
            # Extract JSON if wrapped in other text
            if response.startswith('```'):
                response = response.split('```')[1]
            if response.startswith('json'):
                response = response[4:].strip()
            
            # Try to parse JSON response
            try:
                parsed_response = json.loads(response)
                
                # Validate structure
                if not isinstance(parsed_response, dict):
                    raise ValueError("Response is not a dictionary")
                
                if "response" not in parsed_response:
                    parsed_response["response"] = "I understand your request."
                
                if "action" not in parsed_response:
                    parsed_response["action"] = None
                    
                if "params" not in parsed_response:
                    parsed_response["params"] = {}
                
                return parsed_response
                
            except (json.JSONDecodeError, ValueError) as e:
                logging.warning(f"JSON parsing failed: {e}, raw response: {response}")
                
                # Try to extract meaningful response
                if "create" in user_input.lower() and ("file" in user_input.lower() or "document" in user_input.lower()):
                    return {
                        "response": "I'll create a document for you.",
                        "action": "create_document", 
                        "params": {"name": "document.txt", "content": "Sample content"}
                    }
                elif "reminder" in user_input.lower() or "alarm" in user_input.lower():
                    return {
                        "response": "I'll set a reminder for you.",
                        "action": "set_alarm",
                        "params": {"minutes": 5, "message": "Reminder"}
                    }
                elif "find" in user_input.lower() or "search" in user_input.lower():
                    return {
                        "response": "I'll search for files.",
                        "action": "find_files",
                        "params": {"extension": "txt", "folder": "."}
                    }
                elif "system" in user_input.lower() or "info" in user_input.lower():
                    return {
                        "response": "Here's your system information.",
                        "action": "get_system_info",
                        "params": {}
                    }
                else:
                    return {
                        "response": response if len(response) < 200 else "I understand your request and will help you with that.",
                        "action": None,
                        "params": {}
                    }
                
        except Exception as e:
            logging.error(f"Error generating response: {e}")
            return {
                "response": "I'm sorry, I encountered an error processing your request.",
                "action": None,
                "params": {}
            }

    # Model Management Methods
    def is_model_available(self, model_name: str) -> bool:
        """Check if a model is available locally"""
        try:
            from gpt4all.gpt4all import DEFAULT_MODEL_DIRECTORY
            import glob
            
            model_dir = DEFAULT_MODEL_DIRECTORY
            if not os.path.exists(model_dir):
                return False
            
            # Check for exact filename
            if os.path.exists(os.path.join(model_dir, model_name)):
                return True
            
            # Check for variations with common extensions
            for ext in ['', '.bin', '.gguf', '.q4_0.bin', '.q4_0.gguf']:
                if os.path.exists(os.path.join(model_dir, model_name + ext)):
                    return True
                
                # Also check without the extension if provided
                name_without_ext = model_name.rsplit('.', 1)[0] if '.' in model_name else model_name
                if os.path.exists(os.path.join(model_dir, name_without_ext + ext)):
                    return True
            
            return False
            
        except Exception as e:
            logging.error(f"Error checking model availability: {e}")
            return False

    async def download_model(self, model_name: str) -> bool:
        """Download a model if not available locally"""
        try:
            if self.is_model_available(model_name):
                logging.info(f"Model {model_name} is already available")
                return True
            
            logging.info(f"Starting download of model: {model_name}")
            
            # Reset download progress
            self._download_progress = 0
            
            def download_with_progress():
                try:
                    # Create a temporary GPT4All instance to trigger download
                    temp_model = GPT4All(model_name, allow_download=True)
                    self._download_progress = 100
                    return True
                except Exception as e:
                    logging.error(f"Download failed: {e}")
                    return False
            
            # Run download in executor to avoid blocking
            loop = asyncio.get_event_loop()
            success = await loop.run_in_executor(None, download_with_progress)
            
            return success
            
        except Exception as e:
            logging.error(f"Error downloading model: {e}")
            return False

    def get_download_progress(self) -> float:
        """Get current download progress (0-100)"""
        return getattr(self, '_download_progress', 0)

    async def switch_model(self, model_name: str) -> bool:
        """Switch to a different model"""
        try:
            if not self.is_model_available(model_name):
                logging.error(f"Model {model_name} is not available locally")
                return False
            
            if self.model_name == model_name and self.model_initialized:
                logging.info(f"Already using model {model_name}")
                return True
            
            logging.info(f"Switching from {self.model_name} to {model_name}")
            
            # Close current model if loaded
            if self.model:
                try:
                    # GPT4All doesn't have an explicit close method, but we can dereference
                    self.model = None
                except Exception as e:
                    logging.warning(f"Error closing previous model: {e}")
            
            # Update model name and reset initialization
            self.model_name = model_name
            self.model_initialized = False
            
            # Initialize new model
            await self.initialize()
            
            if self.model_initialized:
                logging.info(f"Successfully switched to model: {model_name}")
                return True
            else:
                logging.error(f"Failed to initialize new model: {model_name}")
                return False
                
        except Exception as e:
            logging.error(f"Error switching model: {e}")
            return False

    def get_current_model(self) -> str:
        """Get the name of the currently loaded model"""
        return self.model_name or "No model loaded"
