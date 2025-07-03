const { app, BrowserWindow, Menu, Tray, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const Store = require('electron-store');

// Initialize store for app settings
const store = new Store();

let mainWindow = null;
let tray = null;
let pythonProcess = null;
let ws = null;
let isQuitting = false;

// App settings
const settings = {
    theme: store.get('theme', 'dark'),
    voiceEnabled: store.get('voiceEnabled', true),
    autoStart: store.get('autoStart', false),
    pythonPort: store.get('pythonPort', 8001)
};

function createMainWindow() {
    console.log('Creating main window...');
    
    mainWindow = new BrowserWindow({
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

    const htmlPath = path.join(__dirname, 'renderer.html');
    console.log('Loading HTML from:', htmlPath);
    mainWindow.loadFile(htmlPath);

    // Handle window events
    mainWindow.once('ready-to-show', () => {
        console.log('Window ready to show');
        mainWindow.show();
        
        // Open DevTools in development
        if (process.argv.includes('--dev')) {
            mainWindow.webContents.openDevTools();
        }
    });

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Set up menu
    setupMenu();
}

function setupMenu() {
    const template = [
        {
            label: 'JARVIS',
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { 
                    label: 'Preferences',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('show-settings');
                        }
                    }
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

function setupTray() {
    try {
        const iconPath = path.join(__dirname, '../assets/tray-icon.png');
        const fs = require('fs');
        
        if (!fs.existsSync(iconPath)) {
            console.log('Tray icon not found, skipping tray setup');
            return;
        }
        
        tray = new Tray(iconPath);
        
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show JARVIS',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Voice Toggle',
                type: 'checkbox',
                checked: settings.voiceEnabled,
                click: () => toggleVoice()
            },
            { type: 'separator' },
            {
                label: 'Quit JARVIS',
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('JARVIS AI Assistant');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        });
        
        console.log('Tray setup completed');
    } catch (error) {
        console.log('Could not create tray icon:', error.message);
    }
}

function setupIPC() {
    // Window controls
    ipcMain.handle('window-minimize', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.handle('window-maximize', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.handle('window-close', () => {
        if (mainWindow) mainWindow.hide();
    });

    // Settings
    ipcMain.handle('get-settings', () => {
        return settings;
    });

    ipcMain.handle('save-settings', (event, newSettings) => {
        Object.assign(settings, newSettings);
        Object.keys(newSettings).forEach(key => {
            store.set(key, newSettings[key]);
        });
        return settings;
    });

    // Communication with Python backend
    ipcMain.handle('send-message', async (event, message) => {
        return await sendToPython(message);
    });

    ipcMain.handle('get-backend-status', () => {
        return {
            connected: ws && ws.readyState === WebSocket.OPEN,
            pythonRunning: pythonProcess && !pythonProcess.killed
        };
    });
}

async function startPythonBackend() {
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
        
        pythonProcess = spawn(pythonPath, [
            scriptPath,
            '--host', '127.0.0.1',
            '--port', settings.pythonPort.toString()
        ], {
            cwd: path.join(__dirname, '../../python-backend'),
            stdio: 'pipe'
        });

        pythonProcess.stdout.on('data', (data) => {
            console.log(`Python backend: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python backend error: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`Python backend exited with code ${code}`);
            if (mainWindow) {
                mainWindow.webContents.send('backend-status', {
                    connected: false,
                    pythonRunning: false
                });
            }
        });

        pythonProcess.on('error', (error) => {
            console.error('Python process error:', error);
        });

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('Python backend startup completed');
        
    } catch (error) {
        console.error('Failed to start Python backend:', error);
        console.log('Continuing with frontend only...');
    }
}

function connectWebSocket() {
    try {
        console.log('Connecting to WebSocket...');
        ws = new WebSocket(`ws://127.0.0.1:${settings.pythonPort}/ws`);

        ws.on('open', () => {
            console.log('WebSocket connected to Python backend');
            if (mainWindow) {
                mainWindow.webContents.send('backend-status', {
                    connected: true,
                    pythonRunning: true
                });
            }
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                if (mainWindow) {
                    mainWindow.webContents.send('backend-message', message);
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });

        ws.on('close', () => {
            console.log('WebSocket disconnected');
            if (mainWindow) {
                mainWindow.webContents.send('backend-status', {
                    connected: false,
                    pythonRunning: pythonProcess && !pythonProcess.killed
                });
            }
            
            // Attempt reconnection after 5 seconds
            setTimeout(() => {
                if (!isQuitting) {
                    connectWebSocket();
                }
            }, 5000);
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
    }
}

async function sendToPython(message) {
    return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
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
                    ws.off('message', responseHandler);
                    resolve(response);
                }
            } catch (error) {
                ws.off('message', responseHandler);
                reject(error);
            }
        };

        ws.on('message', responseHandler);
        ws.send(JSON.stringify(fullMessage));

        // Timeout after 30 seconds
        setTimeout(() => {
            ws.off('message', responseHandler);
            reject(new Error('Request timeout'));
        }, 30000);
    });
}

function toggleVoice() {
    settings.voiceEnabled = !settings.voiceEnabled;
    store.set('voiceEnabled', settings.voiceEnabled);
    
    if (mainWindow) {
        mainWindow.webContents.send('voice-toggled', settings.voiceEnabled);
    }
}

function cleanup() {
    console.log('Cleaning up...');
    
    if (ws) {
        ws.close();
    }
    
    if (pythonProcess) {
        pythonProcess.kill();
    }
}

// App event handlers
app.whenReady().then(async () => {
    console.log('Electron app ready');
    
    // Set app user model ID for Windows
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.jarvis.ai-assistant');
    }
    
    createMainWindow();
    setupTray();
    setupIPC();
    
    // Start backend after a short delay to ensure window is visible
    setTimeout(async () => {
        await startPythonBackend();
        connectWebSocket();
    }, 1000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
    cleanup();
});