// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, Tray, Menu, nativeImage, session, Notification } = require('electron')
const path = require('node:path')

app.setLoginItemSettings({
    openAtLogin: true, //Start app when login to OS
});


let tray, mainWindow

const appUrl = 'https://staging.cloudcollect.dk/';
const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // mainWindow.on('close', (event) => {
    //     event.preventDefault();
    //     mainWindow.hide(); // Just hide window
    // });

    // and load the SPA
    mainWindow.loadURL(appUrl)

    // Fetch notifications every 10 minutes
    setInterval(fetchNotifications, 10 * 60 * 1000);
}

async function fetchNotifications() {
    try {
        // Get cookies from default app session
        const cookies = await session.defaultSession.cookies.get({url: appUrl});
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        // Fetch notifications
        const response = await fetch('https://staging.cloudcollect.dk/todo/company-todos', {
            method: 'GET',
            headers: {
                'Cookie': cookieString // needed for auth
            },
        });

        const notifications = await response.json();
        if (notifications.length > 0) {
            showNotification(notifications[0].text, notifications[0].created_at);
        }

    } catch (error) {
        console.error('fetchNotifications got error:', error);
    }
}

function showNotification(title, body) {
    //Create OS desktop notifications
    const notification = new Notification({ title, body });
    notification.show();

    notification.on('click', () => {
        if (mainWindow) {
            mainWindow.show(); // Show window
            mainWindow.focus();
        }
    });
}


const createTray = () => {
    // Make the application minimize to Tray

    const icon = nativeImage.createFromPath('assets/icon.ico') //TODO change to ico for windows, 16×16, 32×32, 48×48, 64×64 и 256×256 in one file
    console.log('Icon is empty?', icon.isEmpty())

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
