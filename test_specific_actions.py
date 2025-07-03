#!/usr/bin/env python3
"""
Test specific JARVIS actions to verify improvements
"""

import asyncio
import requests
import json
import time
import subprocess
import sys
from pathlib import Path

def test_specific_actions():
    print('🧪 Testing Specific JARVIS Actions...')
    
    # Start backend
    process = subprocess.Popen([
        sys.executable, 'python-backend/ipc_server_fixed.py'
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
       cwd=Path(__file__).parent)
    
    time.sleep(8)  # Wait for startup
    
    port_file = Path(__file__).parent / 'python-backend' / 'current_port.txt'
    port = int(port_file.read_text().strip()) if port_file.exists() else 8000
    
    base_url = f'http://127.0.0.1:{port}'
    
    test_cases = [
        {
            'message': 'Create a file called hello.txt with content Hello World',
            'expected_action': 'create_document'
        },
        {
            'message': 'Set a reminder for 10 minutes to take a break',
            'expected_action': 'set_alarm'
        },
        {
            'message': 'Find all txt files',
            'expected_action': 'find_files'
        },
        {
            'message': 'Show me system information',
            'expected_action': 'get_system_info'
        }
    ]
    
    for i, test in enumerate(test_cases, 1):
        try:
            response = requests.post(f'{base_url}/chat', 
                                   json={'message': test['message']}, 
                                   timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                action = result.get('action_executed')
                action_result = result.get('action_result', {})
                
                message = test['message']
                expected = test['expected_action']
                
                print(f'✅ Test {i}: {message[:40]}...')
                print(f'   Action: {action} (expected: {expected})')
                print(f'   Success: {action_result.get("success", False)}')
                
                msg = action_result.get('message', 'No message')
                print(f'   Result: {msg[:60]}...')
                print()
            else:
                print(f'❌ Test {i} failed: HTTP {response.status_code}')
                
        except Exception as e:
            print(f'❌ Test {i} error: {e}')
    
    process.terminate()
    print('🎉 Action testing completed!')

if __name__ == "__main__":
    test_specific_actions()