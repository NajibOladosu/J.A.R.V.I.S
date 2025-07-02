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
        const settingsModal = document.getElementById('settingsModal');
        const closeSettings = document.getElementById('closeSettings');
        const cancelSettings = document.getElementById('cancelSettings');
        const applySettings = document.getElementById('applySettings');
        const saveSettings = document.getElementById('saveSettings');

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showSettingsModal();
            });
        }

        if (closeSettings) {
            closeSettings.addEventListener('click', () => {
                this.hideSettingsModal();
            });
        }

        if (cancelSettings) {
            cancelSettings.addEventListener('click', () => {
                this.hideSettingsModal();
            });
        }

        if (applySettings) {
            applySettings.addEventListener('click', () => {
                this.applySettings();
            });
        }

        if (saveSettings) {
            saveSettings.addEventListener('click', () => {
                this.saveAndCloseSettings();
            });
        }

        // Close modal when clicking outside
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    this.hideSettingsModal();
                }
            });
        }

        // Load initial settings
        this.loadSettings();
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


    // Settings modal functions
    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('show');
            this.loadSettings();
        }
    }

    hideSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    loadSettings() {
        // Load current theme
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = currentTheme;
        }

        // Load voice settings
        const voiceEnabled = localStorage.getItem('jarvis-voice-enabled') !== 'false';
        const voiceEnabledCheck = document.getElementById('voiceEnabledCheck');
        if (voiceEnabledCheck) {
            voiceEnabledCheck.checked = voiceEnabled;
        }

        // Load auto-start setting
        const autoStart = localStorage.getItem('jarvis-auto-start') === 'true';
        const autoStartCheck = document.getElementById('autoStartCheck');
        if (autoStartCheck) {
            autoStartCheck.checked = autoStart;
        }

        // Load backend port
        const backendPort = localStorage.getItem('jarvis-backend-port') || '8000';
        const pythonPortInput = document.getElementById('pythonPortInput');
        if (pythonPortInput) {
            pythonPortInput.value = backendPort;
        }

        // Load AI model settings
        const selectedModel = localStorage.getItem('jarvis-ai-model') || 'orca-mini-3b-gguf2-q4_0.gguf';
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) {
            modelSelect.value = selectedModel;
        }

        // Load mock mode setting
        const mockMode = localStorage.getItem('jarvis-mock-mode') === 'true';
        const enableMockCheck = document.getElementById('enableMockCheck');
        if (enableMockCheck) {
            enableMockCheck.checked = mockMode;
        }
    }

    async saveSettings() {
        try {
            // Get all settings values
            const themeSelect = document.getElementById('themeSelect');
            const voiceEnabledCheck = document.getElementById('voiceEnabledCheck');
            const autoStartCheck = document.getElementById('autoStartCheck');
            const pythonPortInput = document.getElementById('pythonPortInput');
            const modelSelect = document.getElementById('modelSelect');
            const enableMockCheck = document.getElementById('enableMockCheck');

            // Create settings object for frontend storage
            const frontendSettings = {
                'jarvis-theme': themeSelect?.value || 'light',
                'jarvis-voice-enabled': voiceEnabledCheck?.checked !== false,
                'jarvis-auto-start': autoStartCheck?.checked === true,
                'jarvis-backend-port': pythonPortInput?.value || '8000',
                'jarvis-ai-model': modelSelect?.value || 'orca-mini-3b-gguf2-q4_0.gguf',
                'jarvis-mock-mode': enableMockCheck?.checked === true
            };

            // Save to localStorage
            Object.entries(frontendSettings).forEach(([key, value]) => {
                localStorage.setItem(key, value);
            });

            // Apply theme immediately
            if (themeSelect) {
                this.setTheme(themeSelect.value);
            }

            // Send settings to backend if connected
            if (this.backendConnected) {
                try {
                    const response = await this.sendSettingsToBackend(frontendSettings);
                    if (response && response.success) {
                        this.hideSettingsModal();
                        this.addMessage('Settings saved successfully! AI model changes will take effect immediately.', 'ai');
                    } else {
                        this.hideSettingsModal();
                        this.addMessage('Settings saved to frontend, but could not sync with backend. Changes will apply on restart.', 'ai');
                    }
                } catch (error) {
                    console.error('Error sending settings to backend:', error);
                    this.hideSettingsModal();
                    this.addMessage('Settings saved locally. Restart application for full effect.', 'ai');
                }
            } else {
                this.hideSettingsModal();
                this.addMessage('Settings saved! Backend not connected - changes will apply when backend starts.', 'ai');
            }

        } catch (error) {
            console.error('Error saving settings:', error);
            this.addMessage('Error saving settings. Please try again.', 'ai');
        }
    }

    async applySettings() {
        await this.saveSettingsInternal(false); // Don't close modal
    }

    async saveAndCloseSettings() {
        await this.saveSettingsInternal(true); // Close modal
    }

    async saveSettingsInternal(closeModal = true) {
        try {
            // Get all settings values
            const themeSelect = document.getElementById('themeSelect');
            const voiceEnabledCheck = document.getElementById('voiceEnabledCheck');
            const autoStartCheck = document.getElementById('autoStartCheck');
            const pythonPortInput = document.getElementById('pythonPortInput');
            const modelSelect = document.getElementById('modelSelect');
            const enableMockCheck = document.getElementById('enableMockCheck');

            // Create settings object for frontend storage
            const frontendSettings = {
                'jarvis-theme': themeSelect?.value || 'light',
                'jarvis-voice-enabled': voiceEnabledCheck?.checked !== false,
                'jarvis-auto-start': autoStartCheck?.checked === true,
                'jarvis-backend-port': pythonPortInput?.value || '8000',
                'jarvis-ai-model': modelSelect?.value || 'orca-mini-3b-gguf2-q4_0.gguf',
                'jarvis-mock-mode': enableMockCheck?.checked === true
            };

            // Save to localStorage
            Object.entries(frontendSettings).forEach(([key, value]) => {
                localStorage.setItem(key, value);
            });

            // Apply theme immediately
            if (themeSelect) {
                this.setTheme(themeSelect.value);
            }

            // Send settings to backend if connected
            if (this.backendConnected) {
                try {
                    const response = await this.sendSettingsToBackend(frontendSettings);
                    if (response && response.success) {
                        if (closeModal) this.hideSettingsModal();
                        this.addMessage('Settings applied successfully! AI model changes will take effect immediately.', 'ai');
                    } else {
                        if (closeModal) this.hideSettingsModal();
                        this.addMessage('Settings saved to frontend, but could not sync with backend. Changes will apply on restart.', 'ai');
                    }
                } catch (error) {
                    console.error('Error sending settings to backend:', error);
                    if (closeModal) this.hideSettingsModal();
                    this.addMessage('Settings saved locally. Restart application for full effect.', 'ai');
                }
            } else {
                if (closeModal) this.hideSettingsModal();
                this.addMessage('Settings saved! Backend not connected - changes will apply when backend starts.', 'ai');
            }

        } catch (error) {
            console.error('Error saving settings:', error);
            this.addMessage('Error saving settings. Please try again.', 'ai');
        }
    }

    async sendSettingsToBackend(frontendSettings) {
        try {
            const response = await ipcRenderer.invoke('send-backend-request', {
                url: '/settings',
                method: 'POST',
                data: frontendSettings
            });
            return response;
        } catch (error) {
            console.error('Error sending settings to backend:', error);
            return null;
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