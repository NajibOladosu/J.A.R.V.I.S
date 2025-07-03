const { app, BrowserWindow, Menu, Tray, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const Store = require('electron-store');

// Initialize store for app settings
const store = new Store();

class JarvisApp {
    constructor() {
        this.mainWindow = null;
        this.tray = null;
        this.pythonProcess = null;
        this.ws = null;
        this.isQuitting = false;
        
        // App settings
        this.settings = {
            theme: store.get('theme', 'dark'),
            voiceEnabled: store.get('voiceEnabled', true),
            autoStart: store.get('autoStart', false),
            pythonPort: store.get('pythonPort', 8000)
        };
    }

    async init() {
        await this.setupApp();
        this.createMainWindow();
        this.setupTray();
        this.setupIPC();
        await this.startPythonBackend();
        this.connectWebSocket();
    }

    setupApp() {
        // Set app user model ID for Windows
        if (process.platform === 'win32') {
            app.setAppUserModelId('com.jarvis.ai-assistant');
        }

        // Handle before quit
        app.on('before-quit', () => {
            this.isQuitting = true;
            this.cleanup();
        });
    }

    createMainWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            frame: false,
            titleBarStyle: 'hiddenInset',
            backgroundColor: '#0a0a0a',
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true
            },
            show: false
        });

        this.mainWindow.loadFile('src/renderer.html');

        // Handle window events
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            
            // Open DevTools in development
            if (process.argv.includes('--dev')) {
                this.mainWindow.webContents.openDevTools();
            }
        });

        this.mainWindow.on('close', (event) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.mainWindow.hide();
            }
        });

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // Set up menu
        this.setupMenu();
    }

    setupMenu() {
        const template = [
            {
                label: 'JARVIS',
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { 
                        label: 'Preferences',
                        accelerator: 'CmdOrCtrl+,',
                        click: () => this.showSettings()
                    },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideothers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                    { role: 'selectall' }
                ]
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { role: 'resetZoom' },
                    { role: 'zoomIn' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' }
                ]
            },
            {
                label: 'Window',
                submenu: [
                    { role: 'minimize' },
                    { role: 'close' }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    setupTray() {
        try {
            const iconPath = path.join(__dirname, '../assets/tray-icon.png');
            // Check if icon exists, otherwise skip tray setup
            const fs = require('fs');
            if (!fs.existsSync(iconPath)) {
                console.log('Tray icon not found, skipping tray setup');
                return;
            }
            this.tray = new Tray(iconPath);
        } catch (error) {
            console.log('Could not create tray icon:', error.message);
            return;
        }

        if (!this.tray) return;

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show JARVIS',
                click: () => {
                    this.mainWindow.show();
                    this.mainWindow.focus();
                }
            },
            { type: 'separator' },
            {
                label: 'Voice Toggle',
                type: 'checkbox',
                checked: this.settings.voiceEnabled,
                click: () => this.toggleVoice()
            },
            { type: 'separator' },
            {
                label: 'Quit JARVIS',
                click: () => {
                    this.isQuitting = true;
                    app.quit();
                }
            }
        ]);

        this.tray.setToolTip('JARVIS AI Assistant');
        this.tray.setContextMenu(contextMenu);

        this.tray.on('click', () => {
            if (this.mainWindow.isVisible()) {
                this.mainWindow.hide();
            } else {
                this.mainWindow.show();
                this.mainWindow.focus();
            }
        });
    }

    setupIPC() {
        // Window controls
        ipcMain.handle('window-minimize', () => {
            this.mainWindow.minimize();
        });

        ipcMain.handle('window-maximize', () => {
            if (this.mainWindow.isMaximized()) {
                this.mainWindow.unmaximize();
            } else {
                this.mainWindow.maximize();
            }
        });

        ipcMain.handle('window-close', () => {
            this.mainWindow.hide();
        });

        // Settings
        ipcMain.handle('get-settings', () => {
            return this.settings;
        });

        ipcMain.handle('save-settings', (event, newSettings) => {
            this.settings = { ...this.settings, ...newSettings };
            Object.keys(newSettings).forEach(key => {
                store.set(key, newSettings[key]);
            });
            return this.settings;
        });

        // Communication with Python backend
        ipcMain.handle('send-message', async (event, message) => {
            return await this.sendToPython(message);
        });

        ipcMain.handle('get-backend-status', () => {
            return {
                connected: this.ws && this.ws.readyState === WebSocket.OPEN,
                pythonRunning: this.pythonProcess && !this.pythonProcess.killed
            };
        });
    }

    async startPythonBackend() {
        try {
            console.log('Starting Python backend...');
            
            const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
            const scriptPath = path.join(__dirname, '../../python-backend/ipc_server.py');
            
            // Check if the script exists
            const fs = require('fs');
            if (!fs.existsSync(scriptPath)) {
                console.error('Python backend script not found at:', scriptPath);
                return;
            }
            
            this.pythonProcess = spawn(pythonPath, [
                scriptPath,
                '--host', '127.0.0.1',
                '--port', this.settings.pythonPort.toString()
            ], {
                cwd: path.join(__dirname, '../../python-backend'),
                stdio: 'pipe'
            });

            this.pythonProcess.stdout.on('data', (data) => {
                console.log(`Python backend: ${data}`);
            });

            this.pythonProcess.stderr.on('data', (data) => {
                console.error(`Python backend error: ${data}`);
            });

            this.pythonProcess.on('close', (code) => {
                console.log(`Python backend exited with code ${code}`);
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('backend-status', {
                        connected: false,
                        pythonRunning: false
                    });
                }
            });

            this.pythonProcess.on('error', (error) => {
                console.error('Python process error:', error);
            });

            // Wait for server to start
            await new Promise(resolve => setTimeout(resolve, 3000));
            
        } catch (error) {
            console.error('Failed to start Python backend:', error);
            // Don't show error dialog immediately as it might block the window
            console.log('Python backend failed to start, but continuing with frontend...');
        }
    }

    connectWebSocket() {
        try {
            this.ws = new WebSocket(`ws://127.0.0.1:${this.settings.pythonPort}/ws`);

            this.ws.on('open', () => {
                console.log('WebSocket connected to Python backend');
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('backend-status', {
                        connected: true,
                        pythonRunning: true
                    });
                }
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (this.mainWindow) {
                        this.mainWindow.webContents.send('backend-message', message);
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });

            this.ws.on('close', () => {
                console.log('WebSocket disconnected');
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('backend-status', {
                        connected: false,
                        pythonRunning: this.pythonProcess && !this.pythonProcess.killed
                    });
                }
                
                // Attempt reconnection after 5 seconds
                setTimeout(() => {
                    if (!this.isQuitting) {
                        this.connectWebSocket();
                    }
                }, 5000);
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
        }
    }

    async sendToPython(message) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            const messageId = Date.now().toString();
            const fullMessage = {
                id: messageId,
                type: 'chat',
                message: message,
                timestamp: new Date().toISOString()
            };

            // Set up response handler
            const responseHandler = (data) => {
                try {
                    const response = JSON.parse(data);
                    if (response.id === messageId || response.type === 'chat_response') {
                        this.ws.off('message', responseHandler);
                        resolve(response);
                    }
                } catch (error) {
                    this.ws.off('message', responseHandler);
                    reject(error);
                }
            };

            this.ws.on('message', responseHandler);
            this.ws.send(JSON.stringify(fullMessage));

            // Timeout after 30 seconds
            setTimeout(() => {
                this.ws.off('message', responseHandler);
                reject(new Error('Request timeout'));
            }, 30000);
        });
    }

    toggleVoice() {
        this.settings.voiceEnabled = !this.settings.voiceEnabled;
        store.set('voiceEnabled', this.settings.voiceEnabled);
        
        if (this.mainWindow) {
            this.mainWindow.webContents.send('voice-toggled', this.settings.voiceEnabled);
        }
    }

    showSettings() {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('show-settings');
        }
    }

    cleanup() {
        if (this.ws) {
            this.ws.close();
        }
        
        if (this.pythonProcess) {
            this.pythonProcess.kill();
        }
    }
}

// Initialize and start the app
app.whenReady().then(() => {
    const jarvisApp = new JarvisApp();
    jarvisApp.init();
});

// Handle app events
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        const jarvisApp = new JarvisApp();
        jarvisApp.createMainWindow();
    }
});