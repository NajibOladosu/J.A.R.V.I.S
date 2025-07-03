import logging
from typing import Dict, Any
from tasks.file_tasks import FileTasks
from tasks.alarm_tasks import AlarmTasks
from tasks.system_tasks import SystemTasks
from tasks.voice_tasks import VoiceTasks

class TaskRouter:
    def __init__(self):
        self.file_tasks = FileTasks()
        self.alarm_tasks = AlarmTasks()
        self.system_tasks = SystemTasks()
        self.voice_tasks = VoiceTasks()
        
        # Map actions to handler methods
        self.action_handlers = {
            'create_document': self.file_tasks.create_document,
            'find_files': self.file_tasks.find_files,
            'read_document': self.file_tasks.read_document,
            'delete_document': self.file_tasks.delete_document,
            
            'set_alarm': self.alarm_tasks.set_alarm,
            'list_alarms': self.alarm_tasks.list_alarms,
            'cancel_alarm': self.alarm_tasks.cancel_alarm,
            
            'open_app': self.system_tasks.open_app,
            'get_system_info': self.system_tasks.get_system_info,
            'run_command': self.system_tasks.run_command,
            
            'speak': self.voice_tasks.speak,
            'listen': self.voice_tasks.listen,
            'get_voice_info': self.voice_tasks.get_voice_info
        }
    
    async def execute_action(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Route and execute an action with given parameters"""
        try:
            if not action:
                return {
                    "success": False,
                    "message": "No action specified"
                }
            
            handler = self.action_handlers.get(action)
            if not handler:
                return {
                    "success": False,
                    "message": f"Unknown action: {action}",
                    "available_actions": list(self.action_handlers.keys())
                }
            
            # Execute the handler with parameters
            result = await handler(**params)
            
            logging.info(f"Action '{action}' executed with result: {result.get('success', False)}")
            return result
            
        except TypeError as e:
            # Handle parameter mismatch
            logging.error(f"Parameter error for action '{action}': {e}")
            return {
                "success": False,
                "message": f"Invalid parameters for action '{action}': {str(e)}"
            }
        except Exception as e:
            logging.error(f"Error executing action '{action}': {e}")
            return {
                "success": False,
                "message": f"Failed to execute action '{action}': {str(e)}"
            }
    
    def get_available_actions(self) -> Dict[str, Any]:
        """Get list of all available actions"""
        action_descriptions = {
            'create_document': 'Create a new document with specified name and content',
            'find_files': 'Find files with specific extension in a folder',
            'read_document': 'Read the content of a document',
            'delete_document': 'Delete a document (requires confirmation)',
            
            'set_alarm': 'Set an alarm for X minutes with a message',
            'list_alarms': 'List all active alarms',
            'cancel_alarm': 'Cancel an active alarm by ID',
            
            'open_app': 'Open an application by name',
            'get_system_info': 'Get comprehensive system information',
            'run_command': 'Run a system command (safe mode by default)',
            
            'speak': 'Convert text to speech',
            'listen': 'Listen for speech input and convert to text',
            'get_voice_info': 'Get information about available voices and audio devices'
        }
        
        return {
            "success": True,
            "actions": action_descriptions,
            "count": len(action_descriptions)
        }