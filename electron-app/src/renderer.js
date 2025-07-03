// Main Renderer Process for JARVIS AI Assistant

class JarvisRenderer {
    constructor() {
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            console.log('Initializing JARVIS Renderer...');
            
            // Setup error handling
            this.setupErrorHandling();
            
            // Setup window controls
            this.setupWindowControls();
            
            // Initialize components (already loaded via script tags)
            await this.waitForComponents();
            
            // Setup system monitoring
            this.setupSystemMonitoring();
            
            // Hide loading overlay
            this.hideLoadingOverlay();
            
            // Show welcome message
            this.showWelcomeMessage();
            
            console.log('JARVIS Renderer initialized successfully');
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Error initializing JARVIS Renderer:', error);
            this.showInitializationError(error);
        }
    }

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Uncaught error:', event.error);
            this.handleError(event.error, 'Uncaught Error');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason, 'Promise Rejection');
        });
    }

    setupWindowControls() {
        // Title bar controls
        const minimizeBtn = document.getElementById('minimizeBtn');
        const maximizeBtn = document.getElementById('maximizeBtn');
        const closeBtn = document.getElementById('closeBtn');

        minimizeBtn?.addEventListener('click', async () => {
            try {
                await window.ipcManager?.minimizeWindow();
            } catch (error) {
                console.error('Error minimizing window:', error);
            }
        });

        maximizeBtn?.addEventListener('click', async () => {
            try {
                await window.ipcManager?.maximizeWindow();
            } catch (error) {
                console.error('Error maximizing window:', error);
            }
        });

        closeBtn?.addEventListener('click', async () => {
            try {
                await window.ipcManager?.closeWindow();
            } catch (error) {
                console.error('Error closing window:', error);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'm':
                        e.preventDefault();
                        minimizeBtn?.click();
                        break;
                    case 'w':
                        e.preventDefault();
                        closeBtn?.click();
                        break;
                    case ',':
                        e.preventDefault();
                        window.settingsManager?.show();
                        break;
                    case 'r':
                        e.preventDefault();
                        location.reload();
                        break;
                }
            }
            
            if (e.key === 'F5') {
                e.preventDefault();
                location.reload();
            }
        });
    }

    async waitForComponents() {
        // Wait for global components to be available
        const maxWait = 5000; // 5 seconds
        const interval = 100; // 100ms
        let waited = 0;

        while (waited < maxWait) {
            if (window.ipcManager && window.chatManager && window.settingsManager) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
            waited += interval;
        }

        throw new Error('Components failed to initialize within timeout');
    }

    setupSystemMonitoring() {
        // Monitor backend status
        setInterval(async () => {
            try {
                await window.ipcManager?.updateSystemInfo();
            } catch (error) {
                console.error('Error updating system info:', error);
            }
        }, 10000); // Every 10 seconds

        // Monitor performance
        if ('performance' in window && 'memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                console.log('Memory usage:', {
                    used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + ' MB',
                    total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + ' MB',
                    limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
                });
            }, 30000); // Every 30 seconds
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
            }, 1000); // Show loading for at least 1 second
        }
    }

    showWelcomeMessage() {
        setTimeout(() => {
            if (window.chatManager) {
                const welcomeMessages = [
                    "Welcome to JARVIS! I'm your personal AI assistant.",
                    "I can help you with file management, system tasks, setting reminders, and much more.",
                    "Try asking me to 'create a document', 'find files', or 'set a reminder'.",
                    "You can also use voice commands by clicking the microphone button."
                ];

                welcomeMessages.forEach((message, index) => {
                    setTimeout(() => {
                        window.chatManager.addMessage(message, 'ai');
                    }, index * 1000);
                });
            }
        }, 1500);
    }

    showInitializationError(error) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            const loadingText = loadingOverlay.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = `Initialization failed: ${error.message}`;
                loadingText.style.color = 'var(--error-color)';
            }

            // Add retry button
            const retryBtn = document.createElement('button');
            retryBtn.textContent = 'Retry';
            retryBtn.className = 'btn primary';
            retryBtn.style.marginTop = '20px';
            retryBtn.onclick = () => location.reload();
            loadingOverlay.appendChild(retryBtn);
        }
    }

    handleError(error, type) {
        console.error(`${type}:`, error);
        
        // Show user-friendly error message
        if (window.chatManager) {
            window.chatManager.addMessage(
                `An unexpected error occurred. If this continues, please restart JARVIS.`,
                'ai',
                'error'
            );
        }

        // Show notification if available
        if (window.ipcManager) {
            window.ipcManager.showNotification(
                'JARVIS Error',
                `${type}: ${error.message}`,
                'error'
            );
        }
    }

    // Utility methods
    async restartApplication() {
        if (confirm('Are you sure you want to restart JARVIS?')) {
            location.reload();
        }
    }

    async checkForUpdates() {
        // Placeholder for future update functionality
        if (window.chatManager) {
            window.chatManager.addMessage(
                'Update checking is not implemented yet.',
                'ai'
            );
        }
    }

    getSystemInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            onLine: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled,
            screenResolution: `${screen.width}x${screen.height}`,
            windowSize: `${window.innerWidth}x${window.innerHeight}`,
            memoryInfo: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB'
            } : 'Not available'
        };
    }

    // Debug methods (accessible from console)
    debug = {
        getSystemInfo: () => this.getSystemInfo(),
        restart: () => this.restartApplication(),
        clearHistory: () => window.chatManager?.clearHistory(),
        exportHistory: () => window.chatManager?.exportHistory(),
        exportSettings: () => window.settingsManager?.exportSettings(),
        importSettings: () => window.settingsManager?.importSettings(),
        resetSettings: () => window.settingsManager?.resetToDefaults(),
        showSettings: () => window.settingsManager?.show(),
        sendMessage: (msg) => window.chatManager?.sendMessage(msg),
        getBackendStatus: () => window.ipcManager?.getBackendStatus()
    };
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.jarvisRenderer = new JarvisRenderer();
});

// Make debug methods available globally
window.JARVIS = {
    debug: () => window.jarvisRenderer?.debug || {},
    version: '1.0.0',
    initialized: () => window.jarvisRenderer?.isInitialized || false
};