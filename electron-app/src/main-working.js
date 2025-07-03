const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const Store = require('electron-store');
const fs = require('fs');

// Initialize store for app settings
const store = new Store();

let mainWindow = null;
let settingsWindow = null;
let pythonProcess = null;
let ws = null;
let isQuitting = false;
let currentPort = 8000;

// App settings
const settings = {
    theme: store.get('theme', 'dark'),
    voiceEnabled: store.get('voiceEnabled', true),
    autoStart: store.get('autoStart', false)
};

function createMainWindow() {
    console.log('Creating main window...');
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        frame: process.platform !== 'darwin',
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
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
        // Allow proper application quit when window is closed
        console.log('Window close event triggered');
        isQuitting = true;
        cleanup();
        // Don't prevent default - let the window close naturally
    });

    mainWindow.on('closed', () => {
        console.log('Window closed event triggered');
        mainWindow = null;
        // Ensure app quits when main window is closed
        if (!app.isQuitting) {
            console.log('Forcing app quit...');
            app.quit();
        }
    });

    setupMenu();
}

function createSettingsWindow() {
    // Don't create multiple settings windows
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    console.log('Creating settings window...');
    
    settingsWindow = new BrowserWindow({
        width: 600,
        height: 700,
        minWidth: 500,
        minHeight: 600,
        resizable: true,
        minimizable: true,
        maximizable: false,
        frame: process.platform !== 'darwin',
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false,
        parent: mainWindow,
        modal: false
    });

    const settingsHtmlPath = path.join(__dirname, 'settings.html');
    console.log('Loading settings HTML from:', settingsHtmlPath);
    settingsWindow.loadFile(settingsHtmlPath);

    // Handle window events
    settingsWindow.once('ready-to-show', () => {
        console.log('Settings window ready to show');
        settingsWindow.show();
        
        // Open DevTools in development
        if (process.argv.includes('--dev')) {
            settingsWindow.webContents.openDevTools();
        }
    });

    settingsWindow.on('close', () => {
        console.log('Settings window closed');
        settingsWindow = null;
    });

    settingsWindow.on('closed', () => {
        console.log('Settings window destroyed');
        settingsWindow = null;
    });
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
                { role: 'quit' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'toggleDevTools' },
                { role: 'togglefullscreen' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}


async function startPythonBackend() {
    try {
        console.log('Starting Python backend...');
        
        const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
        const scriptPath = path.join(__dirname, '../../python-backend/ipc_server_fixed.py');
        
        // Check if the script exists
        if (!fs.existsSync(scriptPath)) {
            console.error('Python backend script not found at:', scriptPath);
            return false;
        }
        
        pythonProcess = spawn(pythonPath, [scriptPath], {
            cwd: path.join(__dirname, '../../python-backend'),
            stdio: 'pipe'
        });

        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`Python backend: ${output}`);
            
            // Look for port information
            const portMatch = output.match(/Auto-selected port: (\d+)/);
            if (portMatch) {
                currentPort = parseInt(portMatch[1]);
                console.log(`Backend using port: ${currentPort}`);
            }
            
            // Look for server start confirmation
            if (output.includes('Application startup complete')) {
                console.log('Backend startup confirmed');
            }
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

        // Wait for server to start and read port
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try to read port from file
        try {
            const portFile = path.join(__dirname, '../../python-backend/current_port.txt');
            if (fs.existsSync(portFile)) {
                const portData = fs.readFileSync(portFile, 'utf8');
                currentPort = parseInt(portData.trim());
                console.log(`Read port from file: ${currentPort}`);
            }
        } catch (error) {
            console.log('Could not read port file, using default');
        }
        
        console.log('Python backend startup completed');
        return true;
        
    } catch (error) {
        console.error('Failed to start Python backend:', error);
        return false;
    }
}

function connectWebSocket() {
    try {
        console.log(`Connecting to WebSocket on port ${currentPort}...`);
        ws = new WebSocket(`ws://127.0.0.1:${currentPort}/ws`);

        ws.on('open', () => {
            console.log('WebSocket connected to Python backend');
            if (mainWindow) {
                mainWindow.webContents.send('backend-status', {
                    connected: true,
                    pythonRunning: true,
                    port: currentPort
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
                    pythonRunning: pythonProcess && !pythonProcess.killed,
                    port: currentPort
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
            // Try again with a slight delay
            setTimeout(() => {
                if (!isQuitting) {
                    connectWebSocket();
                }
            }, 2000);
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

        // Set up response handler with timeout
        const timeout = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, 30000);

        const responseHandler = (data) => {
            try {
                const response = JSON.parse(data);
                if (response.type === 'chat_response') {
                    clearTimeout(timeout);
                    ws.off('message', responseHandler);
                    resolve(response);
                }
            } catch (error) {
                clearTimeout(timeout);
                ws.off('message', responseHandler);
                reject(error);
            }
        };

        ws.on('message', responseHandler);
        ws.send(JSON.stringify(fullMessage));
    });
}

function setupIPC() {
    const { ipcMain } = require('electron');

    // Handle message sending to backend
    ipcMain.handle('send-message', async (event, message) => {
        try {
            return await sendToPython(message);
        } catch (error) {
            console.error('Error sending message to Python:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Handle backend status requests
    ipcMain.handle('get-backend-status', (event) => {
        return {
            connected: ws && ws.readyState === WebSocket.OPEN,
            pythonRunning: pythonProcess && !pythonProcess.killed,
            port: currentPort
        };
    });

    // Handle backend HTTP requests (for settings)
    ipcMain.handle('send-backend-request', async (event, request) => {
        try {
            // Try multiple approaches to get fetch function
            let fetch;
            
            // Method 1: Try built-in fetch (Node 18+)
            if (global.fetch) {
                fetch = global.fetch;
            } 
            // Method 2: Try requiring node-fetch
            else {
                try {
                    fetch = require('node-fetch');
                } catch (requireError) {
                    // Method 3: Try dynamic import of node-fetch
                    try {
                        const nodeFetch = await import('node-fetch');
                        fetch = nodeFetch.default || nodeFetch;
                    } catch (importError) {
                        throw new Error('No fetch implementation available. Please install node-fetch or use Node.js 18+');
                    }
                }
            }
            
            const url = `http://127.0.0.1:${currentPort}${request.url}`;
            console.log(`Making request to: ${url}`);
            
            const response = await fetch(url, {
                method: request.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: request.data ? JSON.stringify(request.data) : undefined
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`Backend response:`, data);
            return data;
        } catch (error) {
            console.error('Error sending backend request:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Window controls
    ipcMain.handle('window-minimize', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        window?.minimize();
    });

    ipcMain.handle('window-maximize', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window?.isMaximized()) {
            window.unmaximize();
        } else {
            window?.maximize();
        }
    });

    ipcMain.handle('window-close', (event) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        window?.close();
    });

    // Settings window
    ipcMain.handle('open-settings', () => {
        createSettingsWindow();
    });

    ipcMain.handle('close-settings', () => {
        if (settingsWindow) {
            settingsWindow.close();
        }
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
}

function cleanup() {
    console.log('Cleaning up...');
    
    if (ws) {
        console.log('Closing WebSocket connection...');
        ws.close();
        ws = null;
    }
    
    if (pythonProcess) {
        console.log('Terminating Python backend process...');
        pythonProcess.kill('SIGTERM'); // Use SIGTERM for graceful shutdown
        
        // Force kill after 5 seconds if still running
        setTimeout(() => {
            if (pythonProcess && !pythonProcess.killed) {
                console.log('Force killing Python process...');
                pythonProcess.kill('SIGKILL');
            }
        }, 5000);
        
        pythonProcess = null;
    }
    
    console.log('Cleanup completed');
}

// App event handlers
app.whenReady().then(async () => {
    console.log('Electron app ready');
    
    createMainWindow();
    setupIPC();
    
    // Start backend after window is ready
    const backendStarted = await startPythonBackend();
    if (backendStarted) {
        // Connect WebSocket after backend starts
        setTimeout(() => {
            connectWebSocket();
        }, 2000);
    }
});

app.on('window-all-closed', () => {
    // Only quit when the main window is closed, not when settings or other secondary windows are closed
    if (!mainWindow) {
        console.log('Main window closed, quitting app...');
        isQuitting = true;
        cleanup();
        app.quit();
    } else {
        console.log('Secondary window closed, keeping app running...');
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