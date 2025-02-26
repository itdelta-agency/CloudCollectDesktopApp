// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, Tray, Menu, nativeImage, session, Notification } = require('electron')
const path = require('node:path')
require('dotenv').config();
const player = require('play-sound')();


app.setLoginItemSettings({
    openAtLogin: true, //Start app when login to OS
});


let tray, mainWindow

const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL;
const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.ico')) //ico for windows, 16×16, 32×32, 48×48, 64×64 and 256×256 in one file
//console.log('Icon is empty?', icon.isEmpty())

const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        //icon: path.join(__dirname, 'assets/icon-256.png'),
        width: 1200,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        resizable: true,
        autoHideMenuBar: true, // Auto hide the menu bar unless the Alt key is pressed
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    })

    // mainWindow.on('close', (event) => {
    //     event.preventDefault();
    //     mainWindow.hide(); // Just hide window
    // });

    // and load the SPA
    mainWindow.loadURL(FRONTEND_URL)

    // Fetch notifications every 10 minutes
    setInterval(fetchNotifications, 15 * 1000);//TODO tmp!
}

async function fetchNotifications() {
    try {
        // Get cookies from default app session
        const cookies = await session.defaultSession.cookies.get({url: BACKEND_URL});
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        const headers = {'Cookie': cookieString, 'Accept': 'application/json'};

        const [notificationsResponse, unreadCountResponse] = await Promise.all([
            fetch(`${BACKEND_URL}/notifications`, {method: 'GET', headers}),
            fetch(`${BACKEND_URL}/notifications/unread-count`, {method: 'GET', headers})
        ]);

        const [notificationsData, unreadCountData] = await Promise.all([
            notificationsResponse.json(),
            unreadCountResponse.json()
        ]);

        showNotification(notificationsData.data, unreadCountData.unread_count);
    } catch (error) {
        console.error('Error fetching notifications:', error);
    }
}

function showNotification(notifications, unreadCount) {
    if (unreadCount > 0) {
        const latestNotification = notifications[0]; // Get latest notification

        //Create OS desktop notifications
        const notification = new Notification({
            title: latestNotification ? latestNotification.title + `(${unreadCount} unread)`  : 'New Notification!',
            body: latestNotification ? latestNotification.message : 'New notification!',
            silent: true,
            icon
        });

        notification.show();

        player.play(path.join(__dirname, 'assets/notification.wav'), (err) => {
            if (err) console.log('Error playing sound:', err);
        });

        notification.on('click', () => {
            if (mainWindow) {
                mainWindow.show(); // Show window
                mainWindow.focus();
            }
        });
    }
}

const createTray = () => {
    // Make the application minimize to Tray
    tray = new Tray(icon)

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open',
            type: 'normal',
            click: () => mainWindow.show(),
        },
        {
            label: 'Quit',
            type: 'normal',
            click: () => app.quit()
        },
    ])

    tray.setToolTip('This is my application.')
    tray.setTitle('This is my title')
    tray.setContextMenu(contextMenu)
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    createWindow()
    createTray()

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
