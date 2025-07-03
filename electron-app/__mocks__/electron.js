// Mock Electron for Jest testing

module.exports = {
    app: {
        on: jest.fn(),
        quit: jest.fn(),
        whenReady: jest.fn(() => Promise.resolve()),
        setAppUserModelId: jest.fn()
    },
    BrowserWindow: jest.fn(() => ({
        loadFile: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        close: jest.fn(),
        focus: jest.fn(),
        minimize: jest.fn(),
        maximize: jest.fn(),
        unmaximize: jest.fn(),
        isMaximized: jest.fn(() => false),
        isVisible: jest.fn(() => true),
        on: jest.fn(),
        once: jest.fn(),
        webContents: {
            send: jest.fn(),
            openDevTools: jest.fn()
        }
    })),
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn()
    },
    ipcRenderer: {
        invoke: jest.fn(),
        on: jest.fn(),
        send: jest.fn()
    },
    Menu: {
        buildFromTemplate: jest.fn(),
        setApplicationMenu: jest.fn()
    },
    Tray: jest.fn(() => ({
        setToolTip: jest.fn(),
        setContextMenu: jest.fn(),
        on: jest.fn()
    })),
    shell: {
        openExternal: jest.fn()
    },
    dialog: {
        showErrorBox: jest.fn(),
        showMessageBox: jest.fn()
    }
};