const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    console.log('Creating main window...');
    
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false
    });

    console.log('Loading HTML file...');
    const htmlPath = path.join(__dirname, 'renderer.html');
    console.log('HTML path:', htmlPath);
    mainWindow.loadFile(htmlPath);

    mainWindow.once('ready-to-show', () => {
        console.log('Window ready to show');
        mainWindow.show();
    });

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Page finished loading');
    });

    // Open DevTools for debugging
    mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    console.log('Electron app ready');
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});