const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    openLink: (url) => ipcRenderer.send('open-link', url) // отправляем событие на открытие ссылки
});
