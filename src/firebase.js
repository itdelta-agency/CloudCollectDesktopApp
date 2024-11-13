import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";
import fetch from "node-fetch"; // Используем import вместо require
import { ipcMain } from 'electron';



const firebaseConfig = {
    apiKey: "AIzaSyBeyeNgdnisSPUDv3KplMTsS5ZJ4Ej54xo",
    authDomain: "cloudcollect-9b27a.firebaseapp.com",
    projectId: "cloudcollect-9b27a",
    storageBucket: "cloudcollect-9b27a.firebasestorage.app",
    messagingSenderId: "826968593160",
    appId: "1:826968593160:web:3a5ca38c06bf66003f52bd",
    measurementId: "G-7D79Y9QFV7"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

console.log('FCM Initialized');

// Запрашиваем разрешение на уведомления и получаем токен
messaging.requestPermission()
    .then(() => messaging.getToken())
    .then((token) => {
        console.log('FCM Device Token:', token);
        // Передаем токен в главный процесс
        window.electronAPI.sendFCMToken(token);
    })
    .catch((error) => {
        console.error('Ошибка получения токена:', error);
    });

// Обработчик входящих сообщений
messaging.onMessage((payload) => {
    console.log('Получено уведомление:', payload);
    window.electronAPI.sendNotification(payload.notification.body);
});
