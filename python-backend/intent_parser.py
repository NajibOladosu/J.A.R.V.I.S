import json
import re
import logging
from datetime import datetime
from typing import Dict, Any, Optional

class IntentParser:
    def __init__(self):
        self.keyword_patterns = {
            'create_document': [
                r'create.*(?:document|file|txt)|make.*(?:file|document)',
                r'write.*(?:file|document)|save.*(?:text|document)',
                r'new.*(?:document|file)|generate.*(?:file|document)',
                r'build.*file|compose.*document'
            ],
            'find_files': [
                r'find.*(?:file|document)|search.*(?:file|document)',
                r'locate.*(?:file|document)|show.*files',
                r'list.*files|display.*files|get.*files',
                r'look.*for.*files'
            ],
            'set_alarm': [
                r'remind.*me|set.*(?:alarm|reminder|timer)',
                r'alert.*me|wake.*me|notify.*me',
                r'create.*(?:reminder|alarm)|schedule.*reminder',
                r'in.*(?:\d+.*minutes?|hour)'
            ],
            'open_app': [
                r'open.*(?:app|application|program)',
                r'launch.*(?:app|application|program)',
                r'start.*(?:app|application|program)',
                r'run.*(?:app|application|program)'
            ],
            'get_system_info': [
                r'system.*(?:info|information|status)',
                r'computer.*(?:info|specs|status)',
                r'show.*(?:system|computer|specs)',
                r'memory.*usage|cpu.*usage|disk.*space',
                r'hardware.*info|performance.*info'
            ],
            'read_document': [
                r'read.*(?:file|document)|show.*(?:file|document)',
                r'open.*(?:file|document)|display.*(?:file|document)',
                r'view.*(?:file|document)|get.*content'
            ],
            'speak': [
                r'say.*this|speak.*this|tell.*me',
                r'voice.*output|read.*aloud|pronounce'
            ]
        }

    def parse_intent(self, llm_response: Dict[str, Any]) -> Dict[str, Any]:
        """Parse intent from LLM response or fallback to keyword matching"""
        
        # First try to use the structured response from LLM
        if isinstance(llm_response, dict) and 'action' in llm_response:
            if llm_response['action'] and llm_response['action'] in self.keyword_patterns:
                return {
                    'action': llm_response['action'],
                    'params': llm_response.get('params', {}),
                    'response': llm_response.get('response', '')
                }
        
        # Fallback to keyword matching
        response_text = llm_response.get('response', '') if isinstance(llm_response, dict) else str(llm_response)
        return self._keyword_match(response_text)

    def _keyword_match(self, text: str) -> Dict[str, Any]:
        """Fallback keyword matching for intent detection"""
        text_lower = text.lower()
        
        for action, patterns in self.keyword_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    return {
                        'action': action,
                        'params': self._extract_params(text_lower, action),
                        'response': text
                    }
        
        return {
            'action': None,
            'params': {},
            'response': text
        }

    def _extract_params(self, text: str, action: str) -> Dict[str, Any]:
        """Extract parameters from text based on action type"""
        params = {}
        
        if action == 'create_document':
            # Extract filename with multiple patterns
            filename_patterns = [
                r'(?:called|named|file|document)\s+["\']?([^"\'.\s]+(?:\.[a-zA-Z0-9]+)?)["\']?',
                r'["\']([^"\']+\.[a-zA-Z0-9]+)["\']',  # Quoted filename with extension
                r'(\w+\.[a-zA-Z0-9]+)',  # Simple filename.ext pattern
                r'(?:create|make|write)\s+(?:a\s+)?(?:file\s+)?["\']?([^"\'.\s]+)["\']?'  # Action + filename
            ]
            
            filename = None
            for pattern in filename_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    filename = match.group(1).strip()
                    # Add .txt extension if none provided
                    if '.' not in filename:
                        filename += '.txt'
                    break
            
            params['name'] = filename or 'document.txt'
            
            # Extract content with multiple patterns
            content_patterns = [
                r'(?:with|containing|content|text)\s+["\']([^"\']+)["\']',
                r'(?:saying|reads?)\s+["\']([^"\']+)["\']',
                r'content:\s*["\']([^"\']+)["\']'
            ]
            
            content = None
            for pattern in content_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    content = match.group(1).strip()
                    break
            
            params['content'] = content or f'Document created by JARVIS on {datetime.now().strftime("%Y-%m-%d %H:%M")}'
        
        elif action == 'find_files':
            # Extract file extension
            ext_match = re.search(r'\.(\w+)|(\w+)\s+files?', text)
            if ext_match:
                params['extension'] = ext_match.group(1) or ext_match.group(2)
            else:
                params['extension'] = 'txt'
            
            # Extract folder (default to current directory)
            folder_match = re.search(r'in\s+([^\s]+)', text)
            params['folder'] = folder_match.group(1) if folder_match else '.'
        
        elif action == 'set_alarm':
            # Extract time in minutes
            time_match = re.search(r'(\d+)\s*(?:minute|min)', text)
            if time_match:
                params['minutes'] = int(time_match.group(1))
            else:
                params['minutes'] = 5  # Default 5 minutes
            
            # Extract message
            message_match = re.search(r'(?:to|about|for)\s+(.+)', text)
            if message_match:
                params['message'] = message_match.group(1).strip()
            else:
                params['message'] = 'Reminder'
        
        elif action == 'open_app':
            # Extract app name
            app_match = re.search(r'(?:open|launch|start)\s+([^\s]+)', text)
            if app_match:
                params['app_name'] = app_match.group(1).strip()
            else:
                params['app_name'] = 'calculator'
        
        elif action == 'speak':
            # Extract text to speak
            speak_match = re.search(r'(?:say|speak)\s+["\']?([^"\']+)["\']?', text)
            if speak_match:
                params['text'] = speak_match.group(1).strip()
            else:
                params['text'] = text
        
        return params