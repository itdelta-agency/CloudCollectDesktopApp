const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld("electron", {
    send: (channel, data) => ipcRenderer.send(channel, data),
});
