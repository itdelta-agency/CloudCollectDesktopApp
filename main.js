import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { showNotification } from './src/notification.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Функция для создания основного окна
function createMainWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
        }
    });

    mainWindow.webContents.openDevTools()

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Main window loaded');
    });
}

// Основная логика приложения
app.whenReady().then(createMainWindow);

// Слушаем токен, полученный из рендерера, и отправляем его на сервер Laravel
ipcMain.on('fcm-token', (event, token) => {
    console.log('Получен токен устройства:', token);
    // Здесь можно отправить токен на сервер Laravel
});

// Обрабатываем уведомления, полученные из рендерера
ipcMain.on('send-notification', (event, message) => {
    showNotification('Уведомление', message);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
