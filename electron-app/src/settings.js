// Settings Window JavaScript
const { ipcRenderer } = require('electron');

class SettingsManager {
    constructor() {
        this.isInitialized = false;
        this.backendConnected = false;
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Settings Manager...');
            
            this.setupWindowControls();
            this.setupSettingsHandlers();
            this.loadSettings();
            
            console.log('Settings Manager initialized successfully');
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Error initializing Settings Manager:', error);
        }
    }

    setupWindowControls() {
        // Detect platform and adjust title bar layout for macOS
        const titleBar = document.getElementById('settingsTitleBar');
        const isMacOS = navigator.platform.toLowerCase().includes('mac');
        
        if (isMacOS && titleBar) {
            titleBar.classList.add('macos');
        }

        const minimizeBtn = document.getElementById('settingsMinimizeBtn');
        const closeBtn = document.getElementById('settingsCloseBtn');

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', async () => {
                try {
                    await ipcRenderer.invoke('window-minimize');
                } catch (error) {
                    console.error('Error minimizing window:', error);
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', async () => {
                try {
                    await ipcRenderer.invoke('close-settings');
                } catch (error) {
                    console.error('Error closing settings window:', error);
                }
            });
        }
    }

    setupSettingsHandlers() {
        const cancelBtn = document.getElementById('cancelSettings');
        const applyBtn = document.getElementById('applySettings');
        const saveBtn = document.getElementById('saveSettings');
        const modelSelect = document.getElementById('modelSelect');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancelSettings();
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applySettings();
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveAndCloseSettings();
            });
        }

        // Add model selection change listener
        if (modelSelect) {
            modelSelect.addEventListener('change', () => {
                this.checkModelAvailability(modelSelect.value);
            });
        }
    }

    async loadSettings() {
        try {
            // Load current theme
            const currentTheme = localStorage.getItem('jarvis-theme') || 'light';
            const themeSelect = document.getElementById('themeSelect');
            if (themeSelect) {
                themeSelect.value = currentTheme;
                this.setTheme(currentTheme);
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
                // Check current model availability
                this.checkModelAvailability(selectedModel);
            }

        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('jarvis-theme', theme);
    }

    async checkModelAvailability(modelName) {
        const statusEl = document.getElementById('modelStatus');
        const statusTextEl = document.getElementById('modelStatusText');
        
        if (!statusEl || !statusTextEl) return;

        statusEl.style.display = 'block';
        statusTextEl.textContent = 'Checking model availability...';
        statusTextEl.className = 'status-text info';

        try {
            const response = await this.sendBackendRequest('/model/check', {
                method: 'POST',
                data: { model_name: modelName }
            });

            if (response && response.success) {
                if (response.available) {
                    statusTextEl.textContent = 'Model is available and ready to use';
                    statusTextEl.className = 'status-text success';
                } else {
                    statusTextEl.textContent = 'Model not found - will be downloaded when applied';
                    statusTextEl.className = 'status-text warning';
                }
            } else {
                const errorMsg = response ? `Backend error: ${response.error}` : 'Unable to check model status - backend not connected';
                statusTextEl.textContent = errorMsg;
                statusTextEl.className = 'status-text error';
                console.error('Model check failed:', response);
            }
        } catch (error) {
            console.error('Error checking model availability:', error);
            statusTextEl.textContent = 'Error checking model status';
            statusTextEl.className = 'status-text error';
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
        statusTextEl.textContent = 'Starting model download...';
        statusTextEl.className = 'status-text info';

        try {
            // Start model download (non-blocking)
            const downloadResponse = await this.sendBackendRequest('/model/download', {
                method: 'POST',
                data: { model_name: modelName }
            });

            if (!downloadResponse || !downloadResponse.success) {
                throw new Error(downloadResponse?.error || 'Failed to start download');
            }

            statusTextEl.textContent = 'Downloading model... This may take several minutes.';

            // Poll for download progress
            const pollInterval = setInterval(async () => {
                try {
                    const progressResponse = await this.sendBackendRequest('/model/progress', {
                        method: 'GET'
                    });

                    if (progressResponse && progressResponse.success) {
                        const progress = progressResponse.progress || 0;
                        const status = progressResponse.status || 'downloading';
                        
                        progressFillEl.style.width = `${progress}%`;
                        progressTextEl.textContent = `${Math.round(progress)}%`;

                        if (status === 'completed' || progress >= 100) {
                            clearInterval(pollInterval);
                            
                            // Switch to the new model
                            statusTextEl.textContent = 'Loading new model...';
                            const switchResponse = await this.sendBackendRequest('/model/switch', {
                                method: 'POST',
                                data: { model_name: modelName }
                            });

                            if (switchResponse && switchResponse.success) {
                                statusTextEl.textContent = 'Model loaded successfully!';
                                statusTextEl.className = 'status-text success';
                                
                                // Update localStorage and electron store to reflect the successful model change
                                localStorage.setItem('jarvis-ai-model', modelName);
                                // Also save to electron store through IPC
                                try {
                                    await ipcRenderer.invoke('save-settings', { 'jarvis-ai-model': modelName });
                                } catch (err) {
                                    console.error('Failed to save model to electron store:', err);
                                }
                                
                                // Hide progress after success
                                setTimeout(() => {
                                    progressEl.style.display = 'none';
                                }, 3000);
                                
                                return true;
                            } else {
                                throw new Error('Failed to switch model: ' + (switchResponse?.error || 'Unknown error'));
                            }
                        } else if (status === 'failed') {
                            clearInterval(pollInterval);
                            throw new Error(progressResponse.error || 'Download failed');
                        }
                    } else {
                        // If we can't get progress, just continue polling
                        console.warn('Unable to get download progress, continuing...');
                    }
                } catch (error) {
                    clearInterval(pollInterval);
                    throw error;
                }
            }, 2000); // Poll every 2 seconds instead of 1 second

            return true;

        } catch (error) {
            console.error('Error downloading/switching model:', error);
            statusTextEl.textContent = 'Error downloading model: ' + error.message;
            statusTextEl.className = 'status-text error';
            progressEl.style.display = 'none';
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

    cancelSettings() {
        // Reload original settings
        this.loadSettings();
    }

    async applySettings() {
        await this.saveSettingsInternal(false); // Don't close window
    }

    async saveAndCloseSettings() {
        const success = await this.saveSettingsInternal(false);
        if (success) {
            // Close settings window
            await ipcRenderer.invoke('close-settings');
        }
    }

    async saveSettingsInternal(closeWindow = false) {
        try {
            this.showLoadingOverlay(true);

            // Get all settings values
            const themeSelect = document.getElementById('themeSelect');
            const voiceEnabledCheck = document.getElementById('voiceEnabledCheck');
            const autoStartCheck = document.getElementById('autoStartCheck');
            const pythonPortInput = document.getElementById('pythonPortInput');
            const modelSelect = document.getElementById('modelSelect');

            // Check if model has changed by comparing with backend's current model
            const selectedModel = modelSelect?.value || 'orca-mini-3b-gguf2-q4_0.gguf';
            
            console.log('Model change detection:');
            console.log('Selected model:', selectedModel);
            
            // Get current model from backend to compare
            let backendCurrentModel = null;
            try {
                const currentModelResponse = await this.sendBackendRequest('/model/current', {
                    method: 'GET'
                });
                backendCurrentModel = currentModelResponse?.current_model;
                console.log('Backend current model:', backendCurrentModel);
            } catch (error) {
                console.error('Error getting current model from backend:', error);
            }
            
            const previousModel = localStorage.getItem('jarvis-ai-model') || 'orca-mini-3b-gguf2-q4_0.gguf';
            console.log('localStorage model:', previousModel);
            
            // Consider it changed if it's different from either localStorage or backend
            const modelChanged = (previousModel !== selectedModel) || (backendCurrentModel && backendCurrentModel !== selectedModel);
            console.log('Model changed:', modelChanged);

            // Create settings object for frontend storage
            const frontendSettings = {
                'jarvis-theme': themeSelect?.value || 'light',
                'jarvis-voice-enabled': voiceEnabledCheck?.checked !== false,
                'jarvis-auto-start': autoStartCheck?.checked === true,
                'jarvis-backend-port': pythonPortInput?.value || '8000',
                'jarvis-ai-model': selectedModel,
            };

            // Save to localStorage
            Object.entries(frontendSettings).forEach(([key, value]) => {
                localStorage.setItem(key, value);
            });

            // Apply theme immediately
            if (themeSelect) {
                this.setTheme(themeSelect.value);
            }

            // Handle model changes
            if (modelChanged) {
                console.log('Model changed detected, processing...');
                try {
                    // Check if model is available
                    console.log('Checking model availability for:', selectedModel);
                    const checkResponse = await this.sendBackendRequest('/model/check', {
                        method: 'POST',
                        data: { model_name: selectedModel }
                    });

                    console.log('Model check response:', checkResponse);

                    if (checkResponse && checkResponse.success) {
                        if (checkResponse.available) {
                            // Model is available, switch directly
                            console.log('Model is available, switching directly...');
                            const switchResponse = await this.sendBackendRequest('/model/switch', {
                                method: 'POST',
                                data: { model_name: selectedModel }
                            });

                            console.log('Model switch response:', switchResponse);

                            if (switchResponse && switchResponse.success) {
                                // Update localStorage and electron store to reflect the successful model change
                                localStorage.setItem('jarvis-ai-model', selectedModel);
                                // Also save to electron store through IPC
                                try {
                                    await ipcRenderer.invoke('save-settings', { 'jarvis-ai-model': selectedModel });
                                } catch (err) {
                                    console.error('Failed to save model to electron store:', err);
                                }
                                this.showSuccessMessage(`Successfully switched to ${selectedModel}!`);
                            } else {
                                console.error('Model switch failed:', switchResponse);
                                throw new Error('Failed to switch model: ' + (switchResponse?.error || 'Unknown error'));
                            }
                        } else {
                            // Model needs to be downloaded
                            this.showInfoMessage(`Downloading ${selectedModel}...`);
                            const downloadSuccess = await this.downloadAndSwitchModel(selectedModel);
                            
                            if (downloadSuccess) {
                                this.showSuccessMessage(`Successfully downloaded and switched to ${selectedModel}!`);
                            }
                        }
                    } else {
                        throw new Error('Unable to check model availability');
                    }

                } catch (error) {
                    console.error('Error handling model change:', error);
                    this.showErrorMessage(`Model switching failed: ${error.message}. Other settings have been applied.`);
                }
            } else {
                this.showSuccessMessage('Settings applied successfully!');
            }

            this.showLoadingOverlay(false);
            return true;

        } catch (error) {
            console.error('Error saving settings:', error);
            this.showErrorMessage('Error saving settings. Please try again.');
            this.showLoadingOverlay(false);
            return false;
        }
    }

    showLoadingOverlay(show) {
        const overlay = document.getElementById('settingsLoadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showSuccessMessage(message) {
        const statusEl = document.getElementById('modelStatus');
        const statusTextEl = document.getElementById('modelStatusText');
        
        if (statusEl && statusTextEl) {
            statusEl.style.display = 'block';
            statusTextEl.textContent = message;
            statusTextEl.className = 'status-text success';
            
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }

    showInfoMessage(message) {
        const statusEl = document.getElementById('modelStatus');
        const statusTextEl = document.getElementById('modelStatusText');
        
        if (statusEl && statusTextEl) {
            statusEl.style.display = 'block';
            statusTextEl.textContent = message;
            statusTextEl.className = 'status-text info';
        }
    }

    showErrorMessage(message) {
        const statusEl = document.getElementById('modelStatus');
        const statusTextEl = document.getElementById('modelStatusText');
        
        if (statusEl && statusTextEl) {
            statusEl.style.display = 'block';
            statusTextEl.textContent = message;
            statusTextEl.className = 'status-text error';
            
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});

// Make available globally for debugging
window.JARVIS_SETTINGS = {
    version: '1.0.0',
    initialized: () => window.settingsManager?.isInitialized || false,
    applySettings: () => window.settingsManager?.applySettings(),
    saveSettings: () => window.settingsManager?.saveAndCloseSettings()
};