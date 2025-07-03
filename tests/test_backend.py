#!/usr/bin/env python3
"""
Test suite for JARVIS AI Assistant backend
"""

import pytest
import asyncio
import json
from pathlib import Path
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '../python-backend'))

from llm_interface import LLMInterface
from intent_parser import IntentParser
from task_router import TaskRouter
from tasks.file_tasks import FileTasks
from tasks.alarm_tasks import AlarmTasks
from tasks.system_tasks import SystemTasks
from tasks.voice_tasks import VoiceTasks

class TestLLMInterface:
    """Test LLM interface functionality"""
    
    def setup_method(self):
        self.llm = LLMInterface()
    
    def test_initialization(self):
        """Test LLM interface can be created"""
        assert self.llm is not None
        assert self.llm.model_name is not None
    
    def test_system_prompt(self):
        """Test system prompt is properly configured"""
        assert "JARVIS" in self.llm.system_prompt
        assert "JSON" in self.llm.system_prompt
        assert "action" in self.llm.system_prompt

class TestIntentParser:
    """Test intent parsing functionality"""
    
    def setup_method(self):
        self.parser = IntentParser()
    
    def test_initialization(self):
        """Test intent parser can be created"""
        assert self.parser is not None
        assert hasattr(self.parser, 'keyword_patterns')
    
    def test_structured_response_parsing(self):
        """Test parsing of structured JSON responses"""
        response = {
            "response": "Creating document...",
            "action": "create_document",
            "params": {"name": "test.txt", "content": "test content"}
        }
        
        result = self.parser.parse_intent(response)
        assert result['action'] == "create_document"
        assert result['params']['name'] == "test.txt"
        assert result['response'] == "Creating document..."
    
    def test_keyword_matching(self):
        """Test fallback keyword matching"""
        response = {"response": "I will create a new document for you"}
        
        result = self.parser.parse_intent(response)
        assert result['action'] == "create_document"
    
    def test_parameter_extraction(self):
        """Test parameter extraction from text"""
        text = "create a document called report.txt with some content"
        params = self.parser._extract_params(text, "create_document")
        
        assert "name" in params
        assert "content" in params

class TestFileTasks:
    """Test file operation tasks"""
    
    def setup_method(self):
        self.file_tasks = FileTasks()
        self.test_dir = Path("test_files_temp")
        self.test_dir.mkdir(exist_ok=True)
    
    def teardown_method(self):
        """Clean up test files"""
        import shutil
        if self.test_dir.exists():
            shutil.rmtree(self.test_dir)
    
    @pytest.mark.asyncio
    async def test_create_document(self):
        """Test document creation"""
        result = await self.file_tasks.create_document("test.txt", "Hello World")
        
        assert result['success'] is True
        assert "created successfully" in result['message']
        assert Path(result['file_path']).exists()
    
    @pytest.mark.asyncio
    async def test_find_files(self):
        """Test file finding"""
        # Create a test file first
        await self.file_tasks.create_document("findme.txt", "test")
        
        result = await self.file_tasks.find_files("txt")
        
        assert result['success'] is True
        assert result['count'] >= 1
    
    @pytest.mark.asyncio
    async def test_read_document(self):
        """Test document reading"""
        # Create a test file first
        content = "This is test content"
        await self.file_tasks.create_document("readable.txt", content)
        
        result = await self.file_tasks.read_document("readable.txt")
        
        assert result['success'] is True
        assert result['content'] == content

class TestAlarmTasks:
    """Test alarm/reminder functionality"""
    
    def setup_method(self):
        self.alarm_tasks = AlarmTasks()
    
    @pytest.mark.asyncio
    async def test_set_alarm(self):
        """Test alarm setting"""
        result = await self.alarm_tasks.set_alarm(1, "Test reminder")
        
        assert result['success'] is True
        assert "alarm_id" in result
        assert "Test reminder" in result['message']
    
    @pytest.mark.asyncio
    async def test_list_alarms(self):
        """Test alarm listing"""
        # Set an alarm first
        await self.alarm_tasks.set_alarm(5, "Test alarm")
        
        result = await self.alarm_tasks.list_alarms()
        
        assert result['success'] is True
        assert 'alarms' in result
    
    @pytest.mark.asyncio
    async def test_cancel_alarm(self):
        """Test alarm cancellation"""
        # Set an alarm first
        alarm_result = await self.alarm_tasks.set_alarm(10, "Cancelable alarm")
        alarm_id = alarm_result['alarm_id']
        
        result = await self.alarm_tasks.cancel_alarm(alarm_id)
        
        assert result['success'] is True

class TestSystemTasks:
    """Test system operation tasks"""
    
    def setup_method(self):
        self.system_tasks = SystemTasks()
    
    @pytest.mark.asyncio
    async def test_get_system_info(self):
        """Test system information retrieval"""
        result = await self.system_tasks.get_system_info()
        
        assert result['success'] is True
        assert 'data' in result
        assert 'cpu' in result['data']
        assert 'memory' in result['data']
        assert 'disk' in result['data']
    
    @pytest.mark.asyncio
    async def test_safe_command_execution(self):
        """Test safe command execution"""
        result = await self.system_tasks.run_command("pwd", safe_mode=True)
        
        assert result['success'] is True
        assert 'output' in result
    
    @pytest.mark.asyncio
    async def test_unsafe_command_blocked(self):
        """Test that unsafe commands are blocked"""
        result = await self.system_tasks.run_command("rm -rf /", safe_mode=True)
        
        assert result['success'] is False
        assert "not allowed" in result['message']

class TestVoiceTasks:
    """Test voice functionality"""
    
    def setup_method(self):
        self.voice_tasks = VoiceTasks()
    
    @pytest.mark.asyncio
    async def test_speak_functionality(self):
        """Test text-to-speech functionality"""
        result = await self.voice_tasks.speak("Test message", blocking=False)
        
        # Should succeed even if TTS is not available
        assert 'success' in result
        assert 'message' in result
    
    @pytest.mark.asyncio
    async def test_voice_info(self):
        """Test voice information retrieval"""
        result = await self.voice_tasks.get_voice_info()
        
        assert result['success'] is True
        assert 'data' in result
        assert 'tts_available' in result['data']

class TestTaskRouter:
    """Test task routing functionality"""
    
    def setup_method(self):
        self.router = TaskRouter()
    
    @pytest.mark.asyncio
    async def test_action_routing(self):
        """Test action routing to correct handlers"""
        result = await self.router.execute_action(
            "get_system_info", 
            {}
        )
        
        assert result['success'] is True
    
    @pytest.mark.asyncio
    async def test_unknown_action(self):
        """Test handling of unknown actions"""
        result = await self.router.execute_action(
            "unknown_action", 
            {}
        )
        
        assert result['success'] is False
        assert "Unknown action" in result['message']
    
    def test_available_actions(self):
        """Test getting available actions"""
        result = self.router.get_available_actions()
        
        assert result['success'] is True
        assert 'actions' in result
        assert len(result['actions']) > 0

class TestIntegration:
    """Integration tests for the complete system"""
    
    def setup_method(self):
        self.llm = LLMInterface()
        self.parser = IntentParser()
        self.router = TaskRouter()
    
    @pytest.mark.asyncio
    async def test_end_to_end_file_creation(self):
        """Test complete workflow for file creation"""
        # Simulate LLM response
        llm_response = {
            "response": "I'll create a document for you.",
            "action": "create_document",
            "params": {
                "name": "integration_test.txt",
                "content": "This is an integration test file."
            }
        }
        
        # Parse intent
        parsed = self.parser.parse_intent(llm_response)
        
        # Execute action
        result = await self.router.execute_action(
            parsed['action'],
            parsed['params']
        )
        
        assert result['success'] is True
        assert "created successfully" in result['message']
    
    @pytest.mark.asyncio
    async def test_end_to_end_system_info(self):
        """Test complete workflow for system info"""
        # Simulate LLM response
        llm_response = {
            "response": "I'll get the system information for you.",
            "action": "get_system_info",
            "params": {}
        }
        
        # Parse intent
        parsed = self.parser.parse_intent(llm_response)
        
        # Execute action
        result = await self.router.execute_action(
            parsed['action'],
            parsed['params']
        )
        
        assert result['success'] is True
        assert 'data' in result

# Test runner configuration
if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])