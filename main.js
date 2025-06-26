// main.js
const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, screen, desktopCapturer, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const Store = require('electron-store');
const packageJson = require('./package.json');

const store = new Store();
let tray = null;
let sidebarWindow = null;
let captureWindow = null;

// --- Application Lifecycle ---
app.on('ready', () => {
    if (process.platform === 'darwin') app.dock.hide();
    createSidebarWindow();
    createCaptureWindow(); 
    createTray();
    registerGlobalShortcuts();
    app.setLoginItemSettings({ openAtLogin: store.get('launchOnStartup', true), path: app.getPath('exe') });
});

app.on('will-quit', () => globalShortcut.unregisterAll());

// --- Window Management ---
function createSidebarWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: displayWidth, height: displayHeight } = primaryDisplay.workAreaSize;
    const sidebarWidth = 400;
    sidebarWindow = new BrowserWindow({
        width: sidebarWidth, height: displayHeight, x: displayWidth - sidebarWidth, y: 0,
        frame: false, transparent: true, alwaysOnTop: store.get('alwaysOnTop', true), skipTaskbar: true, show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, nodeIntegration: false,
        }
    });
    sidebarWindow.loadFile('index.html');
    sidebarWindow.setAlwaysOnTop(store.get('alwaysOnTop', true), 'screen-saver');
    sidebarWindow.setVisibleOnAllWorkspaces(true);
    sidebarWindow.on('blur', () => {
        // Only hide if 'Always on Top' is disabled and dev tools aren't open.
        if (!store.get('alwaysOnTop', true) && !sidebarWindow.webContents.isDevToolsOpened()) {
            sidebarWindow.hide();
        }
    });
}

function createCaptureWindow() {
    const { width, height } = screen.getPrimaryDisplay().size;
    captureWindow = new BrowserWindow({
        width, height, x: 0, y: 0,
        frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, kiosk: true,
        show: false, 
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, }
    });
    captureWindow.loadFile('capture.html');
    captureWindow.on('close', (e) => {
        if (!app.isQuitting) {
            e.preventDefault();
            captureWindow.hide();
        }
    });
}

// --- Tray and Shortcuts ---
function createTray() {
    tray = new Tray(path.join(__dirname, 'assets/tray_icon.png')); 
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Capture Screen (F8)', click: () => captureWindow.show() },
        { label: 'Show Sidebar', click: () => sidebarWindow.show() },
        { type: 'separator' },
        {
            label: 'Always on Top',
            type: 'checkbox',
            checked: store.get('alwaysOnTop', true),
            click: (item) => {
                store.set('alwaysOnTop', item.checked);
                sidebarWindow.setAlwaysOnTop(item.checked, 'screen-saver');
            }
        },
        { label: 'Clipboard Watcher', type: 'checkbox', checked: store.get('clipboardWatcher', false),
            click: (item) => { store.set('clipboardWatcher', item.checked); if(sidebarWindow) sidebarWindow.webContents.send('clipboard-watcher-toggled', item.checked); }
        },
        { label: 'Launch on Startup', type: 'checkbox', checked: store.get('launchOnStartup', true),
            click: (item) => { store.set('launchOnStartup', item.checked); app.setLoginItemSettings({ openAtLogin: item.checked }); }
        },
        {
            label: 'About',
            click: () => {
                dialog.showMessageBox(null, {
                    type: 'info',
                    title: `About ${packageJson.productName}`,
                    message: `${packageJson.productName} v${packageJson.version}`,
                    detail: `Developed by ${packageJson.author}.\nWebsite: ${packageJson.homepage}\n\n${packageJson.description}`
                });
            }
        },
        { type: 'separator' },
        { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setToolTip('Fluent AI Sidebar');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => sidebarWindow.isVisible() ? sidebarWindow.hide() : sidebarWindow.show());
}

function registerGlobalShortcuts() {
    globalShortcut.register('F8', () => {
        if (captureWindow) {
            captureWindow.show();
            captureWindow.focus();
        }
    });
}

// --- IPC Communication ---
ipcMain.handle('get-api-key', () => store.get('geminiApiKey'));
ipcMain.on('set-api-key', (event, key) => { store.set('geminiApiKey', key); });

ipcMain.handle('get-screen-source', () => desktopCapturer.getSources({ types: ['screen'] }).then(sources => sources[0].id));
ipcMain.on('capture:cancel', () => { if (captureWindow) captureWindow.hide(); });
ipcMain.on('sidebar:hide', () => { if(sidebarWindow) sidebarWindow.hide(); });

ipcMain.on('capture:complete', (event, { dataURL }) => {
    if (captureWindow) captureWindow.hide();
    sidebarWindow.show();
    sidebarWindow.focus();
    sidebarWindow.webContents.send('ocr:show-capture', { dataURL });
});

// --- FIX: Add new handler to hide the window before taking the screenshot ---
ipcMain.on('capture:hide-for-snip', (event) => {
    if (captureWindow) {
        captureWindow.hide();
        // Give the OS a moment to hide the window before we send the signal back
        setTimeout(() => {
            event.sender.send('capture:take-snip');
        }, 150); // 150ms delay
    }
});


// Native OCR Handler remains the same
ipcMain.handle('ocr:perform-native', (event, dataURL) => {
    return new Promise((resolve, reject) => {
        const tempPath = path.join(os.tmpdir(), `capture-${Date.now()}.png`);
        const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");

        fs.writeFile(tempPath, base64Data, 'base64', (err) => {
            if (err) return reject(new Error('Failed to save temp image.'));
            
            const exePath = path.join(__dirname, 'ocr', 'NativeOcr.exe'); 
            if (!fs.existsSync(exePath)) return reject(new Error(`NativeOcr.exe not found.`));

            const ocrProcess = spawn(exePath, [tempPath]);
            let output = '';
            let errorOutput = '';
            ocrProcess.stdout.on('data', (data) => { output += data.toString(); });
            ocrProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });
            ocrProcess.on('close', (code) => {
                fs.unlink(tempPath, () => {});
                if (code !== 0 || errorOutput) return reject(new Error(errorOutput || 'C# OCR process failed.'));
                return resolve(output.trim());
            });
        });
    });
});
