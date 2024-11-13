document.getElementById('logo').addEventListener('click', () => {
    window.open('https://yourwebsite.com', '_blank');
});
// Получение уведомлений от main process
window.electronAPI.sendNotification('Это тестовое уведомление!');

