// IPC Utilities for JARVIS AI Assistant

const { ipcRenderer } = require('electron');

class IPCManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Backend status updates
        ipcRenderer.on('backend-status', (event, status) => {
            this.updateBackendStatus(status);
        });

        // Backend messages
        ipcRenderer.on('backend-message', (event, message) => {
            this.handleBackendMessage(message);
        });

        // Voice toggle updates
        ipcRenderer.on('voice-toggled', (event, enabled) => {
            this.updateVoiceStatus(enabled);
        });

        // Settings panel
        ipcRenderer.on('show-settings', () => {
            window.settingsManager?.show();
        });
    }

    // Window controls
    async minimizeWindow() {
        return await ipcRenderer.invoke('window-minimize');
    }

    async maximizeWindow() {
        return await ipcRenderer.invoke('window-maximize');
    }

    async closeWindow() {
        return await ipcRenderer.invoke('window-close');
    }

    // Settings management
    async getSettings() {
        return await ipcRenderer.invoke('get-settings');
    }

    async saveSettings(settings) {
        return await ipcRenderer.invoke('save-settings', settings);
    }

    // Communication with Python backend
    async sendMessage(message) {
        try {
            const response = await ipcRenderer.invoke('send-message', message);
            return response;
        } catch (error) {
            console.error('Error sending message:', error);
            return {
                success: false,
                error: error.message,
                response: "I'm sorry, I couldn't process your request right now."
            };
        }
    }

    async getBackendStatus() {
        return await ipcRenderer.invoke('get-backend-status');
    }

    // Event handlers
    updateBackendStatus(status) {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusDot = statusIndicator?.querySelector('.status-dot');
        const statusText = statusIndicator?.querySelector('.status-text');
        const backendStatus = document.getElementById('backendStatus');

        if (statusDot && statusText) {
            if (status.connected && status.pythonRunning) {
                statusDot.className = 'status-dot connected';
                statusText.textContent = 'Connected';
                if (backendStatus) backendStatus.textContent = 'Connected';
            } else if (status.pythonRunning && !status.connected) {
                statusDot.className = 'status-dot';
                statusText.textContent = 'Connecting...';
                if (backendStatus) backendStatus.textContent = 'Connecting...';
            } else {
                statusDot.className = 'status-dot error';
                statusText.textContent = 'Disconnected';
                if (backendStatus) backendStatus.textContent = 'Disconnected';
            }
        }

        // Update system panel
        this.updateSystemInfo();
    }

    handleBackendMessage(message) {
        if (message.type === 'chat_response') {
            window.chatManager?.handleResponse(message.data);
        } else if (message.type === 'action_result') {
            window.chatManager?.handleActionResult(message.data);
        }
    }

    updateVoiceStatus(enabled) {
        const voiceStatus = document.getElementById('voiceStatus');
        const voiceToggle = document.getElementById('voiceToggle');
        
        if (voiceStatus) {
            voiceStatus.textContent = enabled ? 'Enabled' : 'Disabled';
        }
        
        if (voiceToggle) {
            voiceToggle.classList.toggle('active', enabled);
        }
    }

    async updateSystemInfo() {
        try {
            const status = await this.getBackendStatus();
            const backendStatus = document.getElementById('backendStatus');
            
            if (backendStatus) {
                if (status.connected && status.pythonRunning) {
                    backendStatus.textContent = 'Connected';
                    backendStatus.style.color = 'var(--success-color)';
                } else if (status.pythonRunning && !status.connected) {
                    backendStatus.textContent = 'Connecting...';
                    backendStatus.style.color = 'var(--warning-color)';
                } else {
                    backendStatus.textContent = 'Disconnected';
                    backendStatus.style.color = 'var(--error-color)';
                }
            }
        } catch (error) {
            console.error('Error updating system info:', error);
        }
    }

    // Utility methods
    showNotification(title, body, type = 'info') {
        const notification = new Notification(title, {
            body: body,
            icon: type === 'error' ? 'assets/error-icon.png' : 'assets/icon.png'
        });

        notification.onclick = () => {
            // Focus the main window when notification is clicked
            ipcRenderer.send('focus-window');
        };

        return notification;
    }

    // Initialize error handling
    setupErrorHandling() {
        window.addEventListener('error', (error) => {
            console.error('Unhandled error:', error);
            this.showNotification('Error', 'An unexpected error occurred', 'error');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showNotification('Error', 'An unexpected error occurred', 'error');
        });
    }
}

// Export for global use
window.ipcManager = new IPCManager();