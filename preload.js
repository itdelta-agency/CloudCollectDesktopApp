import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script loaded');

contextBridge.exposeInMainWorld('electronAPI', {
    openLink: (url) => ipcRenderer.send('open-link', url),
    sendFCMToken: (token) => ipcRenderer.send('fcm-token', token),
    sendNotification: (message) => ipcRenderer.send('send-notification', message)
});
