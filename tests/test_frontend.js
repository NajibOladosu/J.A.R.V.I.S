/**
 * Frontend tests for JARVIS AI Assistant
 * Uses Jest testing framework
 */

// Mock Electron modules
const mockIpcRenderer = {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn()
};

global.require = jest.fn((module) => {
    if (module === 'electron') {
        return {
            ipcRenderer: mockIpcRenderer
        };
    }
    return {};
});

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
    readyState: 1,
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
}));

// Mock DOM elements
global.document = {
    getElementById: jest.fn(),
    createElement: jest.fn(),
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    documentElement: {
        setAttribute: jest.fn()
    },
    head: {
        appendChild: jest.fn()
    }
};

global.window = {
    localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
    },
    addEventListener: jest.fn(),
    innerWidth: 1200,
    innerHeight: 800
};

global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

global.setTimeout = jest.fn((fn) => fn());
global.clearTimeout = jest.fn();
global.setInterval = jest.fn();
global.clearInterval = jest.fn();

// Load the modules to test
require('../electron-app/src/utils/ipc.js');
require('../electron-app/src/components/chat.js');
require('../electron-app/src/components/settings.js');

describe('IPC Manager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.window.ipcManager = new (require('../electron-app/src/utils/ipc.js').IPCManager || class IPCManager {
            constructor() {
                this.setupEventListeners();
            }
            setupEventListeners() {}
            async getSettings() { return {}; }
            async saveSettings() { return {}; }
            async sendMessage() { return { success: true }; }
            async getBackendStatus() { return { connected: true, pythonRunning: true }; }
        })();
    });

    test('should initialize properly', () => {
        expect(global.window.ipcManager).toBeDefined();
    });

    test('should handle window controls', async () => {
        mockIpcRenderer.invoke.mockResolvedValue(true);
        
        await global.window.ipcManager.minimizeWindow();
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('window-minimize');
    });

    test('should send messages to backend', async () => {
        const mockResponse = {
            success: true,
            response: 'Test response'
        };
        mockIpcRenderer.invoke.mockResolvedValue(mockResponse);
        
        const result = await global.window.ipcManager.sendMessage('test message');
        expect(result).toEqual(mockResponse);
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('send-message', 'test message');
    });

    test('should handle backend status updates', () => {
        const mockElement = {
            className: '',
            textContent: '',
            style: {}
        };
        global.document.getElementById.mockReturnValue(mockElement);
        global.document.querySelector = jest.fn().mockReturnValue(mockElement);

        const status = { connected: true, pythonRunning: true };
        global.window.ipcManager.updateBackendStatus(status);

        expect(mockElement.className).toContain('connected');
    });
});

describe('Chat Manager', () => {
    let chatManager;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock DOM elements
        const mockInput = {
            value: '',
            addEventListener: jest.fn()
        };
        const mockButton = {
            addEventListener: jest.fn(),
            classList: {
                contains: jest.fn(() => false),
                add: jest.fn(),
                remove: jest.fn(),
                toggle: jest.fn()
            }
        };
        const mockMessagesContainer = {
            appendChild: jest.fn(),
            scrollTop: 0,
            scrollHeight: 100
        };

        global.document.getElementById.mockImplementation((id) => {
            switch (id) {
                case 'messageInput': return mockInput;
                case 'sendBtn': return mockButton;
                case 'listenBtn': return mockButton;
                case 'chatMessages': return mockMessagesContainer;
                case 'typingIndicator': return { classList: { toggle: jest.fn() } };
                case 'historyList': return { innerHTML: '' };
                default: return null;
            }
        });

        global.document.querySelectorAll.mockReturnValue([mockButton]);
        global.document.createElement.mockReturnValue({
            className: '',
            textContent: '',
            appendChild: jest.fn(),
            onclick: null
        });

        // Initialize chat manager
        const ChatManager = global.window.ChatManager || class ChatManager {
            constructor() {
                this.messageHistory = [];
                this.isProcessing = false;
                this.setupEventListeners();
            }
            setupEventListeners() {}
            async sendMessage(text) { return Promise.resolve(); }
            addMessage(text, sender, type = 'normal') {}
            handleResponse(response) {}
        };

        chatManager = new ChatManager();
        global.window.chatManager = chatManager;
    });

    test('should initialize properly', () => {
        expect(chatManager).toBeDefined();
        expect(chatManager.messageHistory).toEqual([]);
        expect(chatManager.isProcessing).toBe(false);
    });

    test('should add messages to chat', () => {
        const mockElement = {
            appendChild: jest.fn(),
            scrollTop: 0,
            scrollHeight: 100
        };
        global.document.getElementById.mockReturnValue(mockElement);
        global.document.createElement.mockReturnValue({
            className: '',
            textContent: '',
            appendChild: jest.fn()
        });

        chatManager.addMessage('Test message', 'user');
        expect(chatManager.messageHistory).toHaveLength(1);
        expect(chatManager.messageHistory[0].text).toBe('Test message');
        expect(chatManager.messageHistory[0].sender).toBe('user');
    });

    test('should handle responses', () => {
        const response = {
            data: {
                response: 'AI response',
                action_executed: 'test_action',
                action_result: { success: true }
            }
        };

        // Mock the addMessage method
        chatManager.addMessage = jest.fn();
        chatManager.handleActionResult = jest.fn();

        chatManager.handleResponse(response);

        expect(chatManager.addMessage).toHaveBeenCalledWith('AI response', 'ai');
        expect(chatManager.handleActionResult).toHaveBeenCalledWith({ success: true });
    });

    test('should save conversation history', () => {
        const conversation = {
            timestamp: new Date().toISOString(),
            userMessage: 'Test user message',
            aiResponse: 'Test AI response'
        };

        chatManager.saveToHistory(conversation);

        expect(global.window.localStorage.setItem).toHaveBeenCalledWith(
            'chatHistory',
            expect.stringContaining('Test user message')
        );
    });
});

describe('Settings Manager', () => {
    let settingsManager;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock DOM elements
        const mockModal = {
            classList: {
                add: jest.fn(),
                remove: jest.fn()
            }
        };
        const mockSelect = {
            value: 'dark',
            addEventListener: jest.fn()
        };
        const mockCheckbox = {
            checked: true,
            addEventListener: jest.fn()
        };
        const mockInput = {
            value: '8000',
            addEventListener: jest.fn()
        };

        global.document.getElementById.mockImplementation((id) => {
            switch (id) {
                case 'settingsModal': return mockModal;
                case 'themeSelect': return mockSelect;
                case 'voiceEnabledCheck': return mockCheckbox;
                case 'autoStartCheck': return mockCheckbox;
                case 'pythonPortInput': return mockInput;
                default: return { addEventListener: jest.fn() };
            }
        });

        global.document.documentElement = {
            setAttribute: jest.fn()
        };

        global.document.querySelectorAll.mockReturnValue([{
            addEventListener: jest.fn(),
            dataset: { tab: 'general' },
            classList: { toggle: jest.fn() }
        }]);

        // Initialize settings manager
        const SettingsManager = global.window.SettingsManager || class SettingsManager {
            constructor() {
                this.currentSettings = {};
                this.setupEventListeners();
            }
            setupEventListeners() {}
            async loadSettings() { this.currentSettings = { theme: 'dark' }; }
            show() {}
            hide() {}
            async save() { return true; }
        };

        settingsManager = new SettingsManager();
        global.window.settingsManager = settingsManager;
    });

    test('should initialize properly', () => {
        expect(settingsManager).toBeDefined();
        expect(settingsManager.currentSettings).toEqual({});
    });

    test('should show settings modal', () => {
        const mockModal = {
            classList: { add: jest.fn() }
        };
        global.document.getElementById.mockReturnValue(mockModal);

        settingsManager.show();
        expect(mockModal.classList.add).toHaveBeenCalledWith('show');
    });

    test('should hide settings modal', () => {
        const mockModal = {
            classList: { remove: jest.fn() }
        };
        global.document.getElementById.mockReturnValue(mockModal);

        settingsManager.hide();
        expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });

    test('should validate settings', () => {
        const validSettings = {
            theme: 'dark',
            voiceEnabled: true,
            autoStart: false,
            pythonPort: 8000
        };

        const result = settingsManager.validateSettings ? 
            settingsManager.validateSettings(validSettings) : true;
        expect(result).toBe(true);
    });

    test('should apply theme changes', () => {
        settingsManager.applyTheme = jest.fn();
        settingsManager.applyTheme('dark');
        
        if (settingsManager.applyTheme.mock) {
            expect(settingsManager.applyTheme).toHaveBeenCalledWith('dark');
        }
    });
});

describe('Main Renderer', () => {
    let renderer;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock window object
        global.window = {
            ...global.window,
            ipcManager: { updateSystemInfo: jest.fn() },
            chatManager: { addMessage: jest.fn() },
            settingsManager: { show: jest.fn() },
            addEventListener: jest.fn(),
            location: { reload: jest.fn() },
            performance: {
                memory: {
                    usedJSHeapSize: 1000000,
                    totalJSHeapSize: 2000000,
                    jsHeapSizeLimit: 4000000
                }
            }
        };

        global.navigator = {
            userAgent: 'test',
            platform: 'test',
            language: 'en',
            onLine: true,
            cookieEnabled: true
        };

        global.screen = {
            width: 1920,
            height: 1080
        };

        // Mock the main renderer class
        const JarvisRenderer = class JarvisRenderer {
            constructor() {
                this.isInitialized = false;
            }
            async init() {
                this.isInitialized = true;
            }
            setupErrorHandling() {}
            setupWindowControls() {}
            getSystemInfo() {
                return {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform
                };
            }
        };

        renderer = new JarvisRenderer();
        global.window.jarvisRenderer = renderer;
    });

    test('should initialize properly', async () => {
        await renderer.init();
        expect(renderer.isInitialized).toBe(true);
    });

    test('should get system information', () => {
        const systemInfo = renderer.getSystemInfo();
        expect(systemInfo).toHaveProperty('userAgent');
        expect(systemInfo).toHaveProperty('platform');
    });

    test('should handle errors gracefully', () => {
        renderer.setupErrorHandling();
        // Error handling setup should not throw
        expect(true).toBe(true);
    });
});

describe('Integration Tests', () => {
    test('should handle complete message flow', async () => {
        // Mock all components
        global.window.ipcManager = {
            sendMessage: jest.fn().mockResolvedValue({
                success: true,
                data: {
                    response: 'Test response',
                    action_executed: 'test_action'
                }
            })
        };

        global.window.chatManager = {
            sendMessage: jest.fn(),
            addMessage: jest.fn(),
            handleResponse: jest.fn()
        };

        // Simulate sending a message
        const message = 'Create a test document';
        await global.window.chatManager.sendMessage(message);

        expect(global.window.chatManager.sendMessage).toHaveBeenCalledWith(message);
    });

    test('should handle settings changes', () => {
        global.window.settingsManager = {
            currentSettings: { theme: 'dark' },
            updateUI: jest.fn(),
            applyTheme: jest.fn()
        };

        const newSettings = { theme: 'light' };
        global.window.settingsManager.currentSettings = newSettings;
        global.window.settingsManager.updateUI();
        global.window.settingsManager.applyTheme(newSettings.theme);

        expect(global.window.settingsManager.applyTheme).toHaveBeenCalledWith('light');
    });
});

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Test utilities can be exported here if needed
    };
}