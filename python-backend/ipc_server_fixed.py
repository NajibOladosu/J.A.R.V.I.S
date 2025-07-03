import asyncio
import json
import logging
import sys
import socket
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from llm_interface import LLMInterface
from intent_parser import IntentParser
from task_router import TaskRouter
from settings_manager import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/jarvis.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

app = FastAPI(title="JARVIS AI Assistant", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize core components
llm = LLMInterface()
parser = IntentParser()
router = TaskRouter()

# Connection manager for WebSocket
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(message))

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except:
                self.disconnect(connection)

manager = ConnectionManager()

# Request models
class ChatRequest(BaseModel):
    message: str
    context: str = ""

class ActionRequest(BaseModel):
    action: str
    params: Dict[str, Any] = {}

class ModelRequest(BaseModel):
    model_name: str

class ModelSwitchRequest(BaseModel):
    model_name: str
    force_download: bool = False

# API Endpoints
@app.on_event("startup")
async def startup_event():
    """Initialize the LLM on startup"""
    logging.info("Starting JARVIS AI Assistant...")
    success = await llm.initialize()
    if success:
        logging.info("JARVIS AI Assistant started successfully")
    else:
        logging.error("Failed to initialize JARVIS AI Assistant")

@app.get("/")
async def root():
    return {
        "message": "JARVIS AI Assistant is running",
        "version": "1.0.0",
        "status": "active",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "llm_available": llm.model is not None,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """Main chat endpoint for processing user messages"""
    try:
        logging.info(f"Received message: {request.message[:100]}...")
        
        # Get LLM response
        llm_response = await llm.generate_response(request.message, request.context)
        
        # Parse intent
        parsed_intent = parser.parse_intent(llm_response)
        
        # Execute action if one was identified
        action_result = None
        if parsed_intent.get('action'):
            action_result = await router.execute_action(
                parsed_intent['action'],
                parsed_intent['params']
            )
        
        response = {
            "success": True,
            "response": parsed_intent.get('response', 'I processed your request.'),
            "action_executed": parsed_intent.get('action'),
            "action_result": action_result,
            "timestamp": datetime.now().isoformat()
        }
        
        # Broadcast to WebSocket connections
        await manager.broadcast({
            "type": "chat_response",
            "data": response
        })
        
        return response
        
    except Exception as e:
        logging.error(f"Error in chat endpoint: {e}")
        error_response = {
            "success": False,
            "error": str(e),
            "response": "I'm sorry, I encountered an error processing your request.",
            "timestamp": datetime.now().isoformat()
        }
        return error_response

@app.post("/action")
async def action_endpoint(request: ActionRequest):
    """Direct action execution endpoint"""
    try:
        result = await router.execute_action(request.action, request.params)
        
        response = {
            "success": True,
            "action": request.action,
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        
        # Broadcast to WebSocket connections
        await manager.broadcast({
            "type": "action_result",
            "data": response
        })
        
        return response
        
    except Exception as e:
        logging.error(f"Error in action endpoint: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/actions")
async def get_actions():
    """Get list of available actions"""
    return router.get_available_actions()

# Model Management Endpoints
@app.post("/model/check")
async def check_model_availability(request: ModelRequest):
    """Check if a model is available locally"""
    try:
        logging.info(f"Checking availability of model: {request.model_name}")
        
        # Check if model is available
        available = llm.is_model_available(request.model_name)
        current_model = llm.get_current_model()
        
        return {
            "success": True,
            "available": available,
            "current_model": current_model,
            "model_name": request.model_name,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error checking model availability: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.post("/model/download")
async def download_model(request: ModelRequest):
    """Start downloading a model"""
    try:
        logging.info(f"Starting download of model: {request.model_name}")
        
        # Start download process
        success = await llm.download_model(request.model_name)
        
        if success:
            return {
                "success": True,
                "message": f"Download started for {request.model_name}",
                "model_name": request.model_name,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "error": "Failed to start model download",
                "model_name": request.model_name,
                "timestamp": datetime.now().isoformat()
            }
        
    except Exception as e:
        logging.error(f"Error downloading model: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/model/progress")
async def get_download_progress():
    """Get current download progress"""
    try:
        progress = llm.get_download_progress()
        
        return {
            "success": True,
            "progress": progress,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error getting download progress: {e}")
        return {
            "success": False,
            "error": str(e),
            "progress": 0,
            "timestamp": datetime.now().isoformat()
        }

@app.post("/model/switch")
async def switch_model(request: ModelRequest):
    """Switch to a different model"""
    try:
        logging.info(f"Switching to model: {request.model_name}")
        
        # Check if model is available
        if not llm.is_model_available(request.model_name):
            return {
                "success": False,
                "error": f"Model {request.model_name} is not available locally",
                "timestamp": datetime.now().isoformat()
            }
        
        # Switch to the new model
        success = await llm.switch_model(request.model_name)
        
        if success:
            # Broadcast model change to all WebSocket connections
            await manager.broadcast({
                "type": "model_changed",
                "data": {
                    "new_model": request.model_name,
                    "timestamp": datetime.now().isoformat()
                }
            })
            
            return {
                "success": True,
                "message": f"Successfully switched to {request.model_name}",
                "current_model": request.model_name,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "error": f"Failed to switch to {request.model_name}",
                "timestamp": datetime.now().isoformat()
            }
        
    except Exception as e:
        logging.error(f"Error switching model: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/model/current")
async def get_current_model():
    """Get the currently loaded model"""
    try:
        current_model = llm.get_current_model()
        
        return {
            "success": True,
            "current_model": current_model,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error getting current model: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Settings endpoints
@app.get("/settings")
async def get_settings():
    """Get current settings"""
    try:
        return {
            "success": True,
            "settings": settings.settings,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logging.error(f"Error getting settings: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.post("/settings")
async def update_settings(request: dict):
    """Update settings from frontend"""
    try:
        # Update settings from frontend format
        success = settings.update_from_frontend(request)
        
        if success:
            # If AI model changed, reload LLM interface
            if 'jarvis-ai-model' in request:
                await llm.reload_settings()
            
            return {
                "success": True,
                "message": "Settings updated successfully",
                "settings": settings.settings,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "error": "Failed to update settings",
                "timestamp": datetime.now().isoformat()
            }
            
    except Exception as e:
        logging.error(f"Error updating settings: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.post("/settings/sync-frontend")
async def sync_frontend_settings(request: dict):
    """Sync frontend localStorage settings with backend"""
    try:
        logging.info(f"Syncing frontend settings: {request}")
        
        # Update backend settings from frontend localStorage
        success = settings.update_from_frontend(request)
        
        if success:
            # If AI model changed, switch to it if available
            if 'jarvis-ai-model' in request:
                new_model = request['jarvis-ai-model']
                if llm.is_model_available(new_model):
                    await llm.switch_model(new_model)
                    logging.info(f"Switched to model from frontend settings: {new_model}")
            
            return {
                "success": True,
                "message": "Frontend settings synced successfully",
                "settings": settings.settings,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "error": "Failed to sync frontend settings",
                "timestamp": datetime.now().isoformat()
            }
            
    except Exception as e:
        logging.error(f"Error syncing frontend settings: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Voice input/output endpoints
class VoiceListenRequest(BaseModel):
    timeout: int = 5
    phrase_timeout: int = 1

class VoiceSpeakRequest(BaseModel):
    text: str
    blocking: bool = False

@app.post("/voice/listen")
async def voice_listen(request: VoiceListenRequest):
    """Listen for voice input and convert to text"""
    try:
        result = await router.execute_action('listen', {
            'timeout': request.timeout,
            'phrase_timeout': request.phrase_timeout
        })
        
        return {
            "success": True,
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error in voice listen endpoint: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.post("/voice/speak")
async def voice_speak(request: VoiceSpeakRequest):
    """Convert text to speech"""
    try:
        result = await router.execute_action('speak', {
            'text': request.text,
            'blocking': request.blocking
        })
        
        return {
            "success": True,
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error in voice speak endpoint: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/voice/info")
async def get_voice_info():
    """Get voice capabilities and available options"""
    try:
        result = await router.execute_action('get_voice_info', {})
        
        return {
            "success": True,
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error getting voice info: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await manager.connect(websocket)
    logging.info("WebSocket connection established")
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "chat":
                # Process chat message
                user_message = message_data.get("message", "")
                context = message_data.get("context", "")
                
                # Get LLM response
                llm_response = await llm.generate_response(user_message, context)
                
                # Parse intent
                parsed_intent = parser.parse_intent(llm_response)
                
                # Execute action if one was identified
                action_result = None
                if parsed_intent.get('action'):
                    action_result = await router.execute_action(
                        parsed_intent['action'],
                        parsed_intent['params']
                    )
                
                ai_response_text = parsed_intent.get('response', 'I processed your request.')
                
                # Auto-speak AI responses if voice is enabled in settings
                try:
                    # For now, always try to speak (can be made configurable later)
                    if ai_response_text:
                        await router.execute_action('speak', {
                            'text': ai_response_text,
                            'blocking': False
                        })
                except Exception as e:
                    logging.warning(f"Failed to speak AI response: {e}")
                
                response = {
                    "type": "chat_response",
                    "data": {
                        "response": ai_response_text,
                        "action_executed": parsed_intent.get('action'),
                        "action_result": action_result,
                        "timestamp": datetime.now().isoformat()
                    }
                }
                
                await manager.send_personal_message(response, websocket)
            
            elif message_data.get("type") == "action":
                # Direct action execution
                action = message_data.get("action")
                params = message_data.get("params", {})
                
                result = await router.execute_action(action, params)
                
                response = {
                    "type": "action_result",
                    "data": {
                        "action": action,
                        "result": result,
                        "timestamp": datetime.now().isoformat()
                    }
                }
                
                await manager.send_personal_message(response, websocket)
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logging.info("WebSocket connection closed")
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

def find_free_port(start_port=8000, max_port=8100):
    """Find a free port to bind to"""
    for port in range(start_port, max_port):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    raise RuntimeError(f"No free port found between {start_port} and {max_port}")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="JARVIS AI Assistant Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=None, help="Port to bind to (auto-find if not specified)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    
    args = parser.parse_args()
    
    # Find free port if not specified
    if args.port is None:
        try:
            port = find_free_port()
            logging.info(f"Auto-selected port: {port}")
        except RuntimeError as e:
            logging.error(f"Could not find free port: {e}")
            sys.exit(1)
    else:
        port = args.port
    
    # Write port to file for frontend to read
    try:
        with open('current_port.txt', 'w') as f:
            f.write(str(port))
        logging.info(f"Port {port} written to current_port.txt")
    except Exception as e:
        logging.warning(f"Could not write port file: {e}")
    
    logging.info(f"Starting JARVIS backend on {args.host}:{port}")
    
    uvicorn.run(
        "ipc_server_fixed:app",
        host=args.host,
        port=port,
        reload=args.reload,
        log_level="info"
    )

if __name__ == "__main__":
    main()