// Simplified Renderer Process for JARVIS AI Assistant

class SimpleJarvisRenderer {
    constructor() {
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Simple JARVIS Renderer...');
            
            // Setup basic event handlers
            this.setupWindowControls();
            this.setupBasicInteraction();
            
            // Hide loading overlay
            this.hideLoadingOverlay();
            
            // Show welcome message
            this.showWelcomeMessage();
            
            console.log('Simple JARVIS Renderer initialized successfully');
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Error initializing Simple JARVIS Renderer:', error);
        }
    }

    setupWindowControls() {
        // Title bar controls
        const { ipcRenderer } = require('electron');
        
        const minimizeBtn = document.getElementById('minimizeBtn');
        const maximizeBtn = document.getElementById('maximizeBtn');
        const closeBtn = document.getElementById('closeBtn');

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
    }

    setupBasicInteraction() {
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
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;

        const message = messageInput.value.trim();
        if (!message) return;

        // Clear input
        messageInput.value = '';

        // Add user message to chat
        this.addMessage(message, 'user');

        // Simulate AI response
        setTimeout(() => {
            this.addMessage("I received your message: \"" + message + "\". The backend is not connected yet, but the interface is working!", 'ai');
        }, 1000);
    }

    addMessage(text, sender) {
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
        textDiv.className = 'message-text';
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
                this.addMessage("The interface is now working. The backend connection will be established shortly.", 'ai');
            }, 1000);
            setTimeout(() => {
                this.addMessage("Try typing a message to test the interface!", 'ai');
            }, 2000);
        }, 1500);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.jarvisRenderer = new SimpleJarvisRenderer();
});

// Make debug available globally
window.JARVIS = {
    version: '1.0.0',
    initialized: () => window.jarvisRenderer?.isInitialized || false,
    sendMessage: (msg) => window.jarvisRenderer?.sendMessage(msg)
};