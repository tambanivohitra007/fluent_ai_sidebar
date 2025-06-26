// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, limited API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // --- Main to Renderer (Listeners) ---
    onShowCapture: (callback) => ipcRenderer.on('ocr:show-capture', (event, ...args) => callback(...args)),
    onClipboardToggle: (callback) => ipcRenderer.on('clipboard-watcher-toggled', (event, ...args) => callback(...args)),
    // --- New listener for capture window ---
    on: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args)),

    // --- Renderer to Main (Invokers/Senders) ---
    hideSidebar: () => ipcRenderer.send('sidebar:hide'),
    getScreenSource: () => ipcRenderer.invoke('get-screen-source'),
    captureComplete: (data) => ipcRenderer.send('capture:complete', data),
    captureCancel: () => ipcRenderer.send('capture:cancel'),
    // --- New sender for capture window ---
    send: (channel, data) => ipcRenderer.send(channel, data),
    
    performNativeOcr: (dataURL) => ipcRenderer.invoke('ocr:perform-native', dataURL),

    getGeminiApiKey: () => {
        return 'GEMINI_API_KEY'; 
    }
});
