import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
import json
from pathlib import Path

class AlarmTasks:
    def __init__(self):
        self.active_alarms: List[Dict] = []
        self.alarm_file = Path("logs/alarms.json")
        self.alarm_file.parent.mkdir(exist_ok=True)
        self.load_alarms()
    
    def load_alarms(self):
        """Load saved alarms from file"""
        try:
            if self.alarm_file.exists():
                with open(self.alarm_file, 'r') as f:
                    self.active_alarms = json.load(f)
        except Exception as e:
            logging.error(f"Error loading alarms: {e}")
            self.active_alarms = []
    
    def save_alarms(self):
        """Save alarms to file"""
        try:
            with open(self.alarm_file, 'w') as f:
                json.dump(self.active_alarms, f, indent=2)
        except Exception as e:
            logging.error(f"Error saving alarms: {e}")
    
    async def set_alarm(self, minutes: int, message: str = "Reminder") -> Dict[str, Any]:
        """Set an alarm for X minutes from now"""
        try:
            if minutes <= 0:
                return {
                    "success": False,
                    "message": "Alarm time must be positive"
                }
            
            alarm_time = datetime.now() + timedelta(minutes=minutes)
            alarm_id = len(self.active_alarms) + 1
            
            alarm = {
                "id": alarm_id,
                "message": message,
                "alarm_time": alarm_time.isoformat(),
                "minutes": minutes,
                "active": True,
                "created": datetime.now().isoformat()
            }
            
            self.active_alarms.append(alarm)
            self.save_alarms()
            
            # Start the alarm task
            asyncio.create_task(self._alarm_task(alarm))
            
            logging.info(f"Alarm set for {minutes} minutes: {message}")
            return {
                "success": True,
                "message": f"Alarm set for {minutes} minutes: {message}",
                "alarm_id": alarm_id,
                "alarm_time": alarm_time.strftime("%H:%M:%S")
            }
            
        except Exception as e:
            logging.error(f"Error setting alarm: {e}")
            return {
                "success": False,
                "message": f"Failed to set alarm: {str(e)}"
            }
    
    async def _alarm_task(self, alarm: Dict):
        """Background task that triggers the alarm"""
        try:
            alarm_time = datetime.fromisoformat(alarm["alarm_time"])
            wait_seconds = (alarm_time - datetime.now()).total_seconds()
            
            if wait_seconds > 0:
                await asyncio.sleep(wait_seconds)
            
            # Trigger alarm
            if alarm["active"]:
                logging.info(f"ALARM TRIGGERED: {alarm['message']}")
                # Mark alarm as triggered
                for a in self.active_alarms:
                    if a["id"] == alarm["id"]:
                        a["active"] = False
                        a["triggered"] = datetime.now().isoformat()
                        break
                self.save_alarms()
                
                # This would trigger TTS or notification
                # For now, just log it
                return {
                    "alarm_triggered": True,
                    "message": alarm["message"],
                    "alarm_id": alarm["id"]
                }
        
        except Exception as e:
            logging.error(f"Error in alarm task: {e}")
    
    async def list_alarms(self) -> Dict[str, Any]:
        """List all active alarms"""
        try:
            active_alarms = [alarm for alarm in self.active_alarms if alarm.get("active", True)]
            
            alarm_list = []
            for alarm in active_alarms:
                alarm_time = datetime.fromisoformat(alarm["alarm_time"])
                time_remaining = alarm_time - datetime.now()
                
                if time_remaining.total_seconds() > 0:
                    alarm_list.append({
                        "id": alarm["id"],
                        "message": alarm["message"],
                        "time_remaining": str(time_remaining).split('.')[0],  # Remove microseconds
                        "alarm_time": alarm_time.strftime("%H:%M:%S")
                    })
            
            return {
                "success": True,
                "message": f"Found {len(alarm_list)} active alarms",
                "alarms": alarm_list
            }
            
        except Exception as e:
            logging.error(f"Error listing alarms: {e}")
            return {
                "success": False,
                "message": f"Failed to list alarms: {str(e)}"
            }
    
    async def cancel_alarm(self, alarm_id: int) -> Dict[str, Any]:
        """Cancel an active alarm"""
        try:
            for alarm in self.active_alarms:
                if alarm["id"] == alarm_id and alarm.get("active", True):
                    alarm["active"] = False
                    alarm["cancelled"] = datetime.now().isoformat()
                    self.save_alarms()
                    
                    logging.info(f"Alarm {alarm_id} cancelled")
                    return {
                        "success": True,
                        "message": f"Alarm {alarm_id} cancelled successfully"
                    }
            
            return {
                "success": False,
                "message": f"Active alarm with ID {alarm_id} not found"
            }
            
        except Exception as e:
            logging.error(f"Error cancelling alarm: {e}")
            return {
                "success": False,
                "message": f"Failed to cancel alarm: {str(e)}"
            }