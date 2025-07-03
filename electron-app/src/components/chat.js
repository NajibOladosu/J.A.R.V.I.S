// Chat Manager for JARVIS AI Assistant

class ChatManager {
    constructor() {
        this.messageHistory = [];
        this.isProcessing = false;
        this.setupEventListeners();
        this.loadHistory();
    }

    setupEventListeners() {
        // Input handling
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const listenBtn = document.getElementById('listenBtn');

        messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        sendBtn?.addEventListener('click', () => {
            this.sendMessage();
        });

        listenBtn?.addEventListener('click', () => {
            this.toggleListening();
        });

        // Quick actions
        const actionCards = document.querySelectorAll('.action-card');
        actionCards.forEach(card => {
            card.addEventListener('click', () => {
                const action = card.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }

    async sendMessage(text = null) {
        if (this.isProcessing) return;

        const messageInput = document.getElementById('messageInput');
        const message = text || messageInput?.value.trim();

        if (!message) return;

        this.isProcessing = true;
        this.showTypingIndicator(true);

        // Clear input
        if (messageInput) messageInput.value = '';

        // Add user message to chat
        this.addMessage(message, 'user');

        try {
            // Send to backend
            const response = await window.ipcManager.sendMessage(message);
            
            // Handle response
            this.handleResponse(response);

        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage('I apologize, but I encountered an error processing your request. Please try again.', 'ai');
        } finally {
            this.isProcessing = false;
            this.showTypingIndicator(false);
        }
    }

    handleResponse(response) {
        if (response && response.data) {
            const data = response.data;
            
            // Add AI response
            if (data.response) {
                this.addMessage(data.response, 'ai');
            }

            // Handle action results
            if (data.action_result) {
                this.handleActionResult(data.action_result);
            }

            // Save to history
            this.saveToHistory({
                timestamp: new Date().toISOString(),
                userMessage: this.messageHistory[this.messageHistory.length - 2]?.text || '',
                aiResponse: data.response,
                action: data.action_executed,
                actionResult: data.action_result
            });
        } else if (response && response.response) {
            this.addMessage(response.response, 'ai');
        } else {
            this.addMessage('I received your message but had trouble understanding it. Could you please try rephrasing?', 'ai');
        }
    }

    handleActionResult(result) {
        if (!result) return;

        let resultMessage = '';

        if (result.success) {
            resultMessage = result.message || 'Action completed successfully.';
            
            // Handle specific action types
            if (result.files && result.files.length > 0) {
                resultMessage += ` Found ${result.files.length} files: ${result.files.slice(0, 3).join(', ')}${result.files.length > 3 ? '...' : ''}`;
            }
            
            if (result.alarm_id) {
                resultMessage += ` (Alarm ID: ${result.alarm_id})`;
            }
            
            if (result.content) {
                resultMessage += `\\n\\nContent preview: ${result.content.substring(0, 100)}${result.content.length > 100 ? '...' : ''}`;
            }
        } else {
            resultMessage = result.message || 'The action could not be completed.';
        }

        this.addMessage(resultMessage, 'ai', result.success ? 'success' : 'error');
    }

    addMessage(text, sender, type = 'normal') {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        
        const avatarMini = document.createElement('div');
        avatarMini.className = 'avatar-mini';
        avatarMini.textContent = sender === 'user' ? 'U' : 'J';
        avatarDiv.appendChild(avatarMini);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const textDiv = document.createElement('div');
        textDiv.className = `message-text ${type}`;
        textDiv.textContent = text;

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        contentDiv.appendChild(textDiv);
        contentDiv.appendChild(timeDiv);

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);

        chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Save to message history
        this.messageHistory.push({
            text,
            sender,
            type,
            timestamp: new Date().toISOString()
        });

        // Limit history size
        if (this.messageHistory.length > 100) {
            this.messageHistory = this.messageHistory.slice(-100);
        }
    }

    showTypingIndicator(show) {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.classList.toggle('show', show);
        }
    }

    async handleQuickAction(action) {
        const actionMessages = {
            'create_document': 'Create a new document called "example.txt" with some sample content',
            'find_files': 'Find all text files in the current directory',
            'set_alarm': 'Set a reminder for 5 minutes to take a break',
            'get_system_info': 'Show me the current system information'
        };

        const message = actionMessages[action];
        if (message) {
            await this.sendMessage(message);
        }
    }

    async toggleListening() {
        const listenBtn = document.getElementById('listenBtn');
        if (!listenBtn) return;

        if (listenBtn.classList.contains('listening')) {
            // Stop listening
            listenBtn.classList.remove('listening');
            listenBtn.title = 'Voice Input';
            this.addMessage('Voice input stopped.', 'ai');
        } else {
            // Start listening
            listenBtn.classList.add('listening');
            listenBtn.title = 'Stop Listening';
            this.addMessage('Listening for voice input...', 'ai');

            try {
                // Request voice input from backend
                const response = await window.ipcManager.sendMessage('__VOICE_LISTEN__');
                
                if (response && response.data && response.data.action_result) {
                    const result = response.data.action_result;
                    
                    if (result.success && result.text) {
                        // Process the recognized text
                        await this.sendMessage(result.text);
                    } else {
                        this.addMessage(result.message || 'Could not understand voice input.', 'ai');
                    }
                }
            } catch (error) {
                console.error('Voice input error:', error);
                this.addMessage('Voice input is not available right now.', 'ai');
            } finally {
                listenBtn.classList.remove('listening');
                listenBtn.title = 'Voice Input';
            }
        }
    }

    saveToHistory(conversation) {
        try {
            const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
            history.unshift(conversation);
            
            // Keep only last 50 conversations
            const limitedHistory = history.slice(0, 50);
            localStorage.setItem('chatHistory', JSON.stringify(limitedHistory));
            
            this.updateHistoryPanel();
        } catch (error) {
            console.error('Error saving to history:', error);
        }
    }

    loadHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
            this.updateHistoryPanel(history);
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    updateHistoryPanel(history = null) {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        if (!history) {
            history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        }

        historyList.innerHTML = '';

        if (history.length === 0) {
            historyList.innerHTML = '<div class="history-empty">No conversation history yet.</div>';
            return;
        }

        history.forEach((conversation, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.onclick = () => this.loadConversation(conversation);

            const title = conversation.userMessage.substring(0, 50) + (conversation.userMessage.length > 50 ? '...' : '');
            const preview = conversation.aiResponse.substring(0, 100) + (conversation.aiResponse.length > 100 ? '...' : '');
            const time = new Date(conversation.timestamp).toLocaleString();

            historyItem.innerHTML = `
                <div class="history-title">${title}</div>
                <div class="history-preview">${preview}</div>
                <div class="history-time">${time}</div>
            `;

            historyList.appendChild(historyItem);
        });
    }

    loadConversation(conversation) {
        // Add the conversation to current chat
        this.addMessage(conversation.userMessage, 'user');
        this.addMessage(conversation.aiResponse, 'ai');
        
        if (conversation.actionResult) {
            this.handleActionResult(conversation.actionResult);
        }
    }

    clearHistory() {
        localStorage.removeItem('chatHistory');
        this.updateHistoryPanel();
        this.addMessage('Chat history cleared.', 'ai');
    }

    exportHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
            const dataStr = JSON.stringify(history, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `jarvis-chat-history-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            this.addMessage('Chat history exported successfully.', 'ai');
        } catch (error) {
            console.error('Error exporting history:', error);
            this.addMessage('Failed to export chat history.', 'ai', 'error');
        }
    }
}

// Export for global use
window.chatManager = new ChatManager();