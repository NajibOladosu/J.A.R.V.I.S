// Settings Manager for JARVIS AI Assistant

class SettingsManager {
    constructor() {
        this.currentSettings = {};
        this.setupEventListeners();
        this.loadSettings();
    }

    setupEventListeners() {
        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        settingsBtn?.addEventListener('click', () => this.show());

        // Modal controls
        const closeSettings = document.getElementById('closeSettings');
        const cancelSettings = document.getElementById('cancelSettings');
        const saveSettings = document.getElementById('saveSettings');

        closeSettings?.addEventListener('click', () => this.hide());
        cancelSettings?.addEventListener('click', () => this.hide());
        saveSettings?.addEventListener('click', () => this.save());

        // Close modal when clicking outside
        const settingsModal = document.getElementById('settingsModal');
        settingsModal?.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                this.hide();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        });

        // Theme change handler
        const themeSelect = document.getElementById('themeSelect');
        themeSelect?.addEventListener('change', (e) => {
            this.previewTheme(e.target.value);
        });

        // Voice toggle in header
        const voiceToggle = document.getElementById('voiceToggle');
        voiceToggle?.addEventListener('click', () => {
            this.toggleVoice();
        });

        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });
    }

    async loadSettings() {
        try {
            this.currentSettings = await window.ipcManager.getSettings();
            this.updateUI();
        } catch (error) {
            console.error('Error loading settings:', error);
            // Use default settings
            this.currentSettings = {
                theme: 'dark',
                voiceEnabled: true,
                autoStart: false,
                pythonPort: 8000
            };
            this.updateUI();
        }
    }

    updateUI() {
        // Update form elements
        const themeSelect = document.getElementById('themeSelect');
        const voiceEnabledCheck = document.getElementById('voiceEnabledCheck');
        const autoStartCheck = document.getElementById('autoStartCheck');
        const pythonPortInput = document.getElementById('pythonPortInput');

        if (themeSelect) themeSelect.value = this.currentSettings.theme || 'dark';
        if (voiceEnabledCheck) voiceEnabledCheck.checked = this.currentSettings.voiceEnabled !== false;
        if (autoStartCheck) autoStartCheck.checked = this.currentSettings.autoStart === true;
        if (pythonPortInput) pythonPortInput.value = this.currentSettings.pythonPort || 8000;

        // Apply theme
        this.applyTheme(this.currentSettings.theme || 'dark');

        // Update voice status
        this.updateVoiceUI(this.currentSettings.voiceEnabled !== false);
    }

    show() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('show');
            // Refresh settings from main process
            this.loadSettings();
        }
    }

    hide() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('show');
            // Reset to current theme if preview was active
            this.applyTheme(this.currentSettings.theme || 'dark');
        }
    }

    async save() {
        try {
            const newSettings = this.getFormData();
            
            // Validate settings
            if (!this.validateSettings(newSettings)) {
                return;
            }

            // Save settings
            this.currentSettings = await window.ipcManager.saveSettings(newSettings);
            
            // Apply changes
            this.updateUI();
            this.hide();

            // Show success message
            window.chatManager?.addMessage('Settings saved successfully!', 'ai', 'success');

        } catch (error) {
            console.error('Error saving settings:', error);
            window.chatManager?.addMessage('Failed to save settings. Please try again.', 'ai', 'error');
        }
    }

    getFormData() {
        const themeSelect = document.getElementById('themeSelect');
        const voiceEnabledCheck = document.getElementById('voiceEnabledCheck');
        const autoStartCheck = document.getElementById('autoStartCheck');
        const pythonPortInput = document.getElementById('pythonPortInput');

        return {
            theme: themeSelect?.value || 'dark',
            voiceEnabled: voiceEnabledCheck?.checked !== false,
            autoStart: autoStartCheck?.checked === true,
            pythonPort: parseInt(pythonPortInput?.value) || 8000
        };
    }

    validateSettings(settings) {
        // Validate port number
        if (settings.pythonPort < 1024 || settings.pythonPort > 65535) {
            alert('Port number must be between 1024 and 65535');
            return false;
        }

        // Validate theme
        const validThemes = ['dark', 'light', 'blue'];
        if (!validThemes.includes(settings.theme)) {
            alert('Invalid theme selected');
            return false;
        }

        return true;
    }

    previewTheme(theme) {
        this.applyTheme(theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update meta theme color for mobile browsers
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }

        const themeColors = {
            dark: '#0a0a0a',
            light: '#ffffff',
            blue: '#0f1419'
        };

        metaThemeColor.content = themeColors[theme] || themeColors.dark;
    }

    async toggleVoice() {
        try {
            const newVoiceState = !this.currentSettings.voiceEnabled;
            const newSettings = { ...this.currentSettings, voiceEnabled: newVoiceState };
            
            this.currentSettings = await window.ipcManager.saveSettings(newSettings);
            this.updateVoiceUI(newVoiceState);

            const message = newVoiceState ? 'Voice features enabled' : 'Voice features disabled';
            window.chatManager?.addMessage(message, 'ai');

        } catch (error) {
            console.error('Error toggling voice:', error);
        }
    }

    updateVoiceUI(enabled) {
        const voiceToggle = document.getElementById('voiceToggle');
        const voiceStatus = document.getElementById('voiceStatus');
        const voiceEnabledCheck = document.getElementById('voiceEnabledCheck');

        if (voiceToggle) {
            voiceToggle.classList.toggle('active', enabled);
            voiceToggle.title = enabled ? 'Disable Voice' : 'Enable Voice';
        }

        if (voiceStatus) {
            voiceStatus.textContent = enabled ? 'Enabled' : 'Disabled';
            voiceStatus.style.color = enabled ? 'var(--success-color)' : 'var(--text-muted)';
        }

        if (voiceEnabledCheck) {
            voiceEnabledCheck.checked = enabled;
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab panels
        const tabPanels = document.querySelectorAll('.tab-panel');
        tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tabName}Panel`);
        });
    }

    // Export settings
    exportSettings() {
        try {
            const dataStr = JSON.stringify(this.currentSettings, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `jarvis-settings-${new Date().toISOString().split('T')[0]}.json`;
            link.click();

            window.chatManager?.addMessage('Settings exported successfully!', 'ai', 'success');
        } catch (error) {
            console.error('Error exporting settings:', error);
            window.chatManager?.addMessage('Failed to export settings.', 'ai', 'error');
        }
    }

    // Import settings
    importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            try {
                const file = e.target.files[0];
                if (!file) return;

                const text = await file.text();
                const importedSettings = JSON.parse(text);

                // Validate imported settings
                if (this.validateSettings(importedSettings)) {
                    this.currentSettings = await window.ipcManager.saveSettings(importedSettings);
                    this.updateUI();
                    window.chatManager?.addMessage('Settings imported successfully!', 'ai', 'success');
                }
            } catch (error) {
                console.error('Error importing settings:', error);
                window.chatManager?.addMessage('Failed to import settings. Please check the file format.', 'ai', 'error');
            }
        };

        input.click();
    }

    // Reset to defaults
    async resetToDefaults() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            try {
                const defaultSettings = {
                    theme: 'dark',
                    voiceEnabled: true,
                    autoStart: false,
                    pythonPort: 8000
                };

                this.currentSettings = await window.ipcManager.saveSettings(defaultSettings);
                this.updateUI();
                window.chatManager?.addMessage('Settings reset to defaults.', 'ai', 'success');
            } catch (error) {
                console.error('Error resetting settings:', error);
                window.chatManager?.addMessage('Failed to reset settings.', 'ai', 'error');
            }
        }
    }
}

// Export for global use
window.settingsManager = new SettingsManager();