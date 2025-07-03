// Working Renderer Process for JARVIS AI Assistant

const { ipcRenderer } = require('electron');

class WorkingJarvisRenderer {
    constructor() {
        this.isInitialized = false;
        this.messageHistory = [];
        this.isProcessing = false;
        this.backendConnected = false;
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Working JARVIS Renderer...');
            
            this.setupWindowControls();
            this.setupChatInterface();
            this.setupSettingsModal();
            this.setupBackendListeners();
            this.hideLoadingOverlay();
            this.showWelcomeMessage();
            
            console.log('Working JARVIS Renderer initialized successfully');
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Error initializing Working JARVIS Renderer:', error);
        }
    }

    setupWindowControls() {
        // Detect platform and adjust title bar layout for macOS
        const titleBar = document.getElementById('titleBar');
        const isMacOS = navigator.platform.toLowerCase().includes('mac');
        
        if (isMacOS && titleBar) {
            titleBar.classList.add('macos');
        }

        const minimizeBtn = document.getElementById('minimizeBtn');
        const maximizeBtn = document.getElementById('maximizeBtn');
        const closeBtn = document.getElementById('closeBtn');
        const themeToggle = document.getElementById('themeToggle');

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', async () => {
                try {
                    await ipcRenderer.invoke('window-minimize');
                } catch (error) {
                    console.error('Error minimizing window:', error);
                }
            });
        }

        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', async () => {
                try {
                    await ipcRenderer.invoke('window-maximize');
                } catch (error) {
                    console.error('Error maximizing window:', error);
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', async () => {
                try {
                    await ipcRenderer.invoke('window-close');
                } catch (error) {
                    console.error('Error closing window:', error);
                }
            });
        }

        if (themeToggle) {
            // Load saved theme or default to light
            const savedTheme = localStorage.getItem('jarvis-theme') || 'light';
            this.setTheme(savedTheme);

            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('jarvis-theme', theme);
        
        const sunIcon = document.querySelector('.sun-icon');
        const moonIcon = document.querySelector('.moon-icon');
        
        if (theme === 'dark') {
            if (sunIcon) sunIcon.style.display = 'none';
            if (moonIcon) moonIcon.style.display = 'block';
        } else {
            if (sunIcon) sunIcon.style.display = 'block';
            if (moonIcon) moonIcon.style.display = 'none';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setupChatInterface() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Setup action cards
        const actionCards = document.querySelectorAll('.action-card');
        actionCards.forEach(card => {
            card.addEventListener('click', () => {
                const action = card.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }


    setupSettingsModal() {
        const settingsBtn = document.getElementById('settingsBtn');

        if (settingsBtn) {
            settingsBtn.addEventListener('click', async () => {
                try {
                    await ipcRenderer.invoke('open-settings');
                } catch (error) {
                    console.error('Error opening settings window:', error);
                }
            });
        }
    }

    setupBackendListeners() {
        // Listen for backend status updates
        ipcRenderer.on('backend-status', (event, status) => {
            this.updateBackendStatus(status);
        });

        // Check initial backend status
        this.checkBackendStatus();
    }

    async checkBackendStatus() {
        try {
            const status = await ipcRenderer.invoke('get-backend-status');
            this.updateBackendStatus(status);
        } catch (error) {
            console.error('Error checking backend status:', error);
        }
    }

    updateBackendStatus(status) {
        this.backendConnected = status.connected;
        
        const statusIndicator = document.getElementById('statusIndicator');
        const statusDot = statusIndicator?.querySelector('.status-dot');
        const statusText = statusIndicator?.querySelector('.status-text');
        const backendStatus = document.getElementById('backendStatus');

        if (statusDot && statusText) {
            if (status.connected) {
                statusDot.className = 'status-dot connected';
                statusText.textContent = 'Connected';
                if (backendStatus) backendStatus.textContent = 'Connected';
            } else if (status.pythonRunning) {
                statusDot.className = 'status-dot';
                statusText.textContent = 'Starting...';
                if (backendStatus) backendStatus.textContent = 'Starting...';
            } else {
                statusDot.className = 'status-dot error';
                statusText.textContent = 'Disconnected';
                if (backendStatus) backendStatus.textContent = 'Disconnected';
            }
        }

        console.log('Backend status:', status);
    }


    async sendMessage(text = null) {
        if (this.isProcessing) return;

        const messageInput = document.getElementById('messageInput');
        const message = text || messageInput?.value.trim();

        if (!message) return;

        this.isProcessing = true;
        this.showTypingIndicator(true);

        // Clear input
        if (messageInput && !text) messageInput.value = '';

        // Add user message to chat
        this.addMessage(message, 'user');

        try {
            if (this.backendConnected) {
                // Send to backend
                const response = await ipcRenderer.invoke('send-message', message);
                this.handleChatResponse(response.data || response);
            } else {
                // Fallback message
                this.addMessage("I'm not connected to the AI backend yet. The backend is starting up, please wait a moment and try again.", 'ai', 'warning');
            }

        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage('I apologize, but I encountered an error processing your request. Please try again.', 'ai', 'error');
        } finally {
            this.isProcessing = false;
            this.showTypingIndicator(false);
        }
    }

    handleChatResponse(response) {
        if (response.response) {
            this.addMessage(response.response, 'ai');
        }

        if (response.action_result) {
            this.handleActionResult(response.action_result);
        }

        // Save to history
        this.saveToHistory({
            timestamp: new Date().toISOString(),
            userMessage: this.messageHistory[this.messageHistory.length - 2]?.text || '',
            aiResponse: response.response,
            action: response.action_executed,
            actionResult: response.action_result
        });
    }

    handleActionResult(result) {
        if (!result) return;

        let resultMessage = '';

        if (result.success) {
            resultMessage = result.message || 'Action completed successfully.';
            
            if (result.files && result.files.length > 0) {
                resultMessage += ` Found ${result.files.length} files: ${result.files.slice(0, 3).join(', ')}${result.files.length > 3 ? '...' : ''}`;
            }
            
            if (result.alarm_id) {
                resultMessage += ` (Alarm ID: ${result.alarm_id})`;
            }
            
            if (result.content) {
                resultMessage += `\n\nContent preview: ${result.content.substring(0, 100)}${result.content.length > 100 ? '...' : ''}`;
            }
        } else {
            resultMessage = result.message || 'The action could not be completed.';
        }

        this.addMessage(resultMessage, 'ai', result.success ? 'success' : 'error');
    }

    handleQuickAction(action) {
        const actionMessages = {
            'create_document': 'Create a new document called "example.txt" with some sample content',
            'find_files': 'Find all text files in the current directory',
            'set_alarm': 'Set a reminder for 5 minutes to take a break',
            'get_system_info': 'Show me the current system information'
        };

        const message = actionMessages[action];
        if (message) {
            this.sendMessage(message);
        }
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

    hideLoadingOverlay() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.classList.add('hide');
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 500);
            }, 1000);
        }
    }

    showWelcomeMessage() {
        setTimeout(() => {
            this.addMessage("Welcome to JARVIS! I'm your personal AI assistant.", 'ai');
            setTimeout(() => {
                this.addMessage("I can help you with file management, system tasks, reminders, and more. I'm powered by a local AI model for complete privacy.", 'ai');
            }, 1000);
            setTimeout(() => {
                this.addMessage("Try asking me to create a document, set a reminder, or get system information!", 'ai');
            }, 2000);
        }, 1500);
    }

    saveToHistory(conversation) {
        try {
            const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
            history.unshift(conversation);
            
            const limitedHistory = history.slice(0, 50);
            localStorage.setItem('chatHistory', JSON.stringify(limitedHistory));
        } catch (error) {
            console.error('Error saving to history:', error);
        }
    }

    // Test connection method
    async testConnection() {
        try {
            const status = await ipcRenderer.invoke('get-backend-status');
            console.log('Connection test result:', status);
            return status.connected;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }


    // Model management functions
    async checkModelAvailability(modelName) {
        const statusEl = document.getElementById('modelStatus');
        const statusTextEl = document.getElementById('modelStatusText');
        
        if (!statusEl || !statusTextEl) return;

        statusEl.style.display = 'block';
        statusTextEl.textContent = 'Checking model availability...';

        try {
            const response = await this.sendBackendRequest('/model/check', {
                method: 'POST',
                data: { model_name: modelName }
            });

            if (response && response.success) {
                if (response.available) {
                    statusTextEl.textContent = 'Model is available and ready to use';
                    statusTextEl.style.color = 'var(--accent-success)';
                } else {
                    statusTextEl.textContent = 'Model not found - will be downloaded when applied';
                    statusTextEl.style.color = 'var(--accent-warning)';
                }
            } else {
                statusTextEl.textContent = 'Unable to check model status';
                statusTextEl.style.color = 'var(--accent-error)';
            }
        } catch (error) {
            console.error('Error checking model availability:', error);
            statusTextEl.textContent = 'Error checking model status';
            statusTextEl.style.color = 'var(--accent-error)';
        }
    }

    async downloadAndSwitchModel(modelName) {
        const statusEl = document.getElementById('modelStatus');
        const statusTextEl = document.getElementById('modelStatusText');
        const progressEl = document.getElementById('downloadProgress');
        const progressFillEl = document.getElementById('progressFill');
        const progressTextEl = document.getElementById('progressText');

        if (!statusEl || !statusTextEl || !progressEl) return false;

        statusEl.style.display = 'block';
        progressEl.style.display = 'block';
        statusTextEl.textContent = 'Downloading model...';
        statusTextEl.style.color = 'var(--accent-primary)';

        try {
            // Start model download
            const downloadResponse = await this.sendBackendRequest('/model/download', {
                method: 'POST',
                data: { model_name: modelName }
            });

            if (!downloadResponse || !downloadResponse.success) {
                throw new Error(downloadResponse?.error || 'Failed to start download');
            }

            // Poll for download progress
            const pollInterval = setInterval(async () => {
                try {
                    const progressResponse = await this.sendBackendRequest('/model/progress', {
                        method: 'GET'
                    });

                    if (progressResponse && progressResponse.success) {
                        const progress = progressResponse.progress || 0;
                        progressFillEl.style.width = `${progress}%`;
                        progressTextEl.textContent = `${Math.round(progress)}%`;

                        if (progress >= 100) {
                            clearInterval(pollInterval);
                            
                            // Switch to the new model
                            statusTextEl.textContent = 'Loading new model...';
                            const switchResponse = await this.sendBackendRequest('/model/switch', {
                                method: 'POST',
                                data: { model_name: modelName }
                            });

                            if (switchResponse && switchResponse.success) {
                                statusTextEl.textContent = 'Model loaded successfully!';
                                statusTextEl.style.color = 'var(--accent-success)';
                                this.addMessage(`Successfully switched to ${modelName}. The new AI model is ready to use!`, 'ai');
                                
                                // Hide progress after success
                                setTimeout(() => {
                                    progressEl.style.display = 'none';
                                    statusEl.style.display = 'none';
                                }, 3000);
                                
                                return true;
                            } else {
                                throw new Error('Failed to switch model');
                            }
                        }
                    }
                } catch (error) {
                    clearInterval(pollInterval);
                    throw error;
                }
            }, 1000);

            return true;

        } catch (error) {
            console.error('Error downloading/switching model:', error);
            statusTextEl.textContent = 'Error downloading model: ' + error.message;
            statusTextEl.style.color = 'var(--accent-error)';
            progressEl.style.display = 'none';
            this.addMessage(`Failed to switch to ${modelName}: ${error.message}`, 'ai');
            return false;
        }
    }

    async sendBackendRequest(url, options = {}) {
        try {
            const response = await ipcRenderer.invoke('send-backend-request', {
                url: url,
                method: options.method || 'GET',
                data: options.data
            });
            return response;
        } catch (error) {
            console.error('Backend request error:', error);
            return { success: false, error: error.message };
        }
    }


}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.jarvisRenderer = new WorkingJarvisRenderer();
});

// Make available globally for debugging
window.JARVIS = {
    version: '1.0.0',
    initialized: () => window.jarvisRenderer?.isInitialized || false,
    sendMessage: (msg) => window.jarvisRenderer?.sendMessage(msg),
    testConnection: () => window.jarvisRenderer?.testConnection(),
    checkStatus: () => window.jarvisRenderer?.checkBackendStatus()
};