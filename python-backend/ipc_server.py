import asyncio
import json
import logging
import sys
import os
from datetime import datetime
from typing import Dict, Any
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from llm_interface import LLMInterface
from intent_parser import IntentParser
from task_router import TaskRouter
from settings_manager import settings

# Create logs directory if it doesn't exist
os.makedirs('logs', exist_ok=True)

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

# API Endpoints
@app.on_event("startup")
async def startup_event():
    """Initialize the LLM on startup"""
    logging.info("Starting JARVIS AI Assistant...")
    await llm.initialize()
    logging.info("JARVIS AI Assistant started successfully")

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

@app.post("/settings/reload")
async def reload_settings():
    """Reload settings and reinitialize components"""
    try:
        # Reload settings
        settings.load_settings()
        
        # Reload LLM interface
        await llm.reload_settings()
        
        return {
            "success": True,
            "message": "Settings reloaded successfully",
            "settings": settings.settings,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error reloading settings: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Model Management Endpoints
class ModelCheckRequest(BaseModel):
    model_name: str

class ModelDownloadRequest(BaseModel):
    model_name: str

class ModelSwitchRequest(BaseModel):
    model_name: str

@app.post("/model/check")
async def check_model_availability(request: ModelCheckRequest):
    """Check if a model is available locally"""
    try:
        available = llm.is_model_available(request.model_name)
        current_model = llm.get_current_model()
        
        return {
            "success": True,
            "available": available,
            "current_model": current_model,
            "requested_model": request.model_name,
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
async def download_model(request: ModelDownloadRequest):
    """Start downloading a model (non-blocking)"""
    try:
        # Check if model is already available
        if llm.is_model_available(request.model_name):
            return {
                "success": True,
                "message": f"Model {request.model_name} is already available",
                "status": "completed",
                "timestamp": datetime.now().isoformat()
            }
        
        # Start background download
        success = await llm.download_model(request.model_name)
        
        if success:
            return {
                "success": True,
                "message": f"Download started for model {request.model_name}",
                "status": "downloading",
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "error": f"Failed to start download for model {request.model_name}",
                "status": "failed",
                "timestamp": datetime.now().isoformat()
            }
        
    except Exception as e:
        logging.error(f"Error starting model download: {e}")
        return {
            "success": False,
            "error": str(e),
            "status": "failed",
            "timestamp": datetime.now().isoformat()
        }

@app.get("/model/progress")
async def get_download_progress():
    """Get current download progress and status"""
    try:
        status = llm.get_download_status()
        
        return {
            "success": True,
            "progress": status["progress"],
            "status": status["status"],
            "model": status["model"],
            "error": status["error"],
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error getting download progress: {e}")
        return {
            "success": False,
            "error": str(e),
            "progress": 0,
            "status": "error",
            "timestamp": datetime.now().isoformat()
        }

@app.post("/model/switch")
async def switch_model(request: ModelSwitchRequest):
    """Switch to a different model"""
    try:
        # First check if model is available
        if not llm.is_model_available(request.model_name):
            return {
                "success": False,
                "error": f"Model {request.model_name} is not available locally. Please download it first.",
                "timestamp": datetime.now().isoformat()
            }
        
        success = await llm.switch_model(request.model_name)
        
        if success:
            # Update settings to reflect the new model
            settings.settings['ai_model'] = request.model_name
            settings.save_settings()
            
            logging.info(f"Model switched and settings updated: {request.model_name}")
            
            return {
                "success": True,
                "message": f"Successfully switched to model {request.model_name}",
                "current_model": llm.get_current_model(),
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "error": f"Failed to switch to model {request.model_name}. Check logs for details.",
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
    """Get the name of the currently loaded model"""
    try:
        current_model = llm.get_current_model()
        available_models = ["orca-mini-3b-gguf2-q4_0.gguf", "mistral-7b-instruct-v0.1.Q4_0.gguf", "nous-hermes-llama2-13b.q4_0.bin"]
        
        return {
            "success": True,
            "current_model": current_model,
            "available_models": available_models,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error getting current model: {e}")
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
                
                response = {
                    "type": "chat_response",
                    "data": {
                        "response": parsed_intent.get('response', 'I processed your request.'),
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

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="JARVIS AI Assistant Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    
    args = parser.parse_args()
    
    uvicorn.run(
        "ipc_server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info"
    )