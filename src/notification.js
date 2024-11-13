import { Notification } from 'electron';

export function showNotification(title, body) {
    new Notification({ title, body }).show();
}
