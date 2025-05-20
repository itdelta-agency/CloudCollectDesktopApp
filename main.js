// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, Tray, Menu, nativeImage, session, Notification, ipcMain, shell, dialog } = require('electron')
const { autoUpdater } = require("electron-updater")
const path = require('node:path')
const fs = require('node:fs')
const sharp = require('sharp');
const toIco = require('png-to-ico');
const Store = require('electron-store');
const store = new Store();
const log = require("electron-log")

log.transports.file.level = "info" // Logging level
autoUpdater.logger = log

app.setLoginItemSettings({
    openAtLogin: true, //Start app when login to OS
    args: ['--hidden'],
});

//app.setName('CloudCollect');


const configPath = path.join(app.getAppPath(), "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

log.info("CloudCollectDesktopApp statred!");
log.info("FRONTEND_URL:", config.FRONTEND_URL);
log.info("BACKEND_URL:", config.BACKEND_URL);

const FRONTEND_URL = config.FRONTEND_URL;
const BACKEND_URL = config.BACKEND_URL;

let tray, mainWindow
let isQuiting = false;

const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.ico')) //ico for windows, 16×16, 32×32, 48×48, 64×64 and 256×256 in one file
//console.log('Icon is empty?', icon.isEmpty())


const createWindow = async () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        //icon: path.join(__dirname, 'assets/icon-256.png'),
        width: 1200,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        resizable: true,
        title: `CloudCollectApp v${app.getVersion()}`,
        autoHideMenuBar: true, // Auto hide the menu bar unless the Alt key is pressed
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    })

    mainWindow.once('ready-to-show', () => {
        if (!process.argv.includes('--hidden')) {
            mainWindow.show();
          }
    });

     mainWindow.on('close', (event) => {
        if (!isQuiting) {
         event.preventDefault();
         mainWindow.hide(); // Just hide window
        }
     });

    mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
        log.error(`Got error while loading: ${errorCode} - ${errorDescription}`);
    });

    // and load the SPA
    mainWindow.loadURL(FRONTEND_URL)

    // Fetch notifications every 10 minutes
    setInterval(fetchNotifications, 60 * 1000 * 10);
    await fetchNotifications();
}

// --- Main polling logic ---
async function fetchNotifications() {
    try {
      const cookies = await session.defaultSession.cookies.get({ url: BACKEND_URL });
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      const headers = { 'Cookie': cookieString, 'Accept': 'application/json' };

      const [notificationsResponse, unreadCountResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/notifications`, { method: 'GET', headers }),
        fetch(`${BACKEND_URL}/notifications/unread-count`, { method: 'GET', headers })
      ]);

      const notifications = (await notificationsResponse.json()).data || [];
      const unreadCount = (await unreadCountResponse.json()).unread_count || 0;
      console.log("Unread notifications count", unreadCount);

      if (unreadCount === 0) {
        store.set('shown_notification_counts', {});
        setTrayIconDefault();
      } else {
        showNotification(notifications, unreadCount);
        await setTrayIconWithCount(unreadCount);
      }

    } catch (error) {
      log.error("Error fetching notifications:", error);
    }
}

// --- Show a single notification ---
function showNotification(notifications, unreadCount) {
    if (!notifications || notifications.length === 0) return;

    const latest = notifications[0];
    const shownMap = store.get('shown_notification_counts') || {};
    const shownCount = shownMap[latest.id] || 0;

    if (shownCount < 2) {
      const notification = new Notification({
        title: `${latest.title} (${unreadCount} unread)`,
        body: latest.message,
        silent: false,
        icon
      });

      notification.show();
      shownMap[latest.id] = shownCount + 1;
      store.set('shown_notification_counts', shownMap);

      notification.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
    }
}

// --- Tray icon control ---

function setTrayIconDefault() {
  tray.setImage(nativeImage.createFromPath(path.join(__dirname, 'assets/icon.ico')));
}

async function setTrayIconWithCount(unreadCount) {
  const basePngPath = nativeImage.createFromPath(path.join(__dirname, 'assets/icon-256.png'));
  const outputPath = path.join(app.getPath('userData'), `tray-badge-${unreadCount}.ico`);
  await generateTrayIconWithCount(basePngPath, unreadCount, outputPath);
  tray.setImage(outputPath);
}

// --- Generate tray icon with badge ---

async function generateTrayIconWithCount(basePngPath, count, outputIcoPath) {
  const badgeSvg = `
    <svg width="256" height="256">
      <circle cx="220" cy="36" r="28" fill="red" />
      <text x="220" y="45" font-size="32" text-anchor="middle" fill="white" font-family="sans-serif">${count}</text>
    </svg>
  `;

  const base = await sharp(basePngPath)
    .composite([{ input: Buffer.from(badgeSvg), top: 0, left: 0 }])
    .png()
    .toBuffer();

    const tempPng = path.join(__dirname, "temp-tray-badge.png");
    fs.writeFileSync(tempPng, base);
  
    const icoBuffer = await toIco([tempPng]);
    fs.writeFileSync(outputIcoPath, icoBuffer);
  
    fs.unlinkSync(tempPng); // delete tmp PNG
  
    console.log(`Created icon: ${outputIcoPath}`);
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
            click: () => { isQuiting = true; app.quit();}
        },
    ])

    tray.setToolTip('CloudCollect')
    tray.setTitle('CloudCollect')
    tray.setContextMenu(contextMenu)

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

const createAppMenu = () => {
    const template = [
        {
          label: 'CloudCollectApp',
          submenu: [
            {
              label: 'About',
              accelerator: 'F1',
              click: () => {
                dialog.showMessageBox({
                  type: 'info',
                  title: 'About CloudCollectApp',
                  message: `CloudCollectApp\nVersion: ${app.getVersion()}`,
                  buttons: ['OK']
                });
              }
            },
            {
              label: 'Toggle Debug Tools',
              accelerator: 'F12',
              click: () => {
                const focusedWindow = BrowserWindow.getFocusedWindow();
                if (focusedWindow) {
                  focusedWindow.webContents.toggleDevTools();
                }
              }
            },
            {
              label: 'Reload App',
              accelerator: 'CmdOrCtrl+R',
              click: () => {
                const focusedWindow = BrowserWindow.getFocusedWindow();
                if (focusedWindow) {
                  focusedWindow.reload();
                }
              }
            },
          ]
        }
      ];
    
      const menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);
  }


const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit(); // If there is already a copy, exit
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // If the user tries to launch a second instance, restore/show the window
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.whenReady().then(() => {

        setTimeout(() => {
            //Try use set timeout to fix app blinking
            createWindow();
          }, 1000);
       
        createAppMenu()
        createTray()

        // Check for new releases at app start
        autoUpdater.checkForUpdatesAndNotify();

         // Check for updates every 6 hours
        setInterval(() => {
            autoUpdater.checkForUpdatesAndNotify();
        }, 1000 * 60 * 60 * 6); 

        // If release available
        autoUpdater.on("update-available", () => {
            log.info("New update available");
        });

        // If release downloaded
        autoUpdater.on("update-downloaded", () => {
            log.info("A new version has been downloaded, restarting the app...");
            autoUpdater.quitAndInstall();
        });

        // Log errors
        autoUpdater.on("error", (err) => {
            log.error("Error while updating the app:", err);
        });

        app.on('activate', () => {
            // On macOS it's common to re-create a window in the app when the
            // dock icon is clicked and there are no other windows open.
            if (BrowserWindow.getAllWindows().length === 0) createWindow()
        })
    })

}

ipcMain.on("open-url", (event, url) => {
    shell.openExternal(url);
});

ipcMain.on("open-pdf", (event, url) => {
    const child = new BrowserWindow({
      modal:false,  
      width: 1024,
      height: 768,
      resizable: true,        
      minimizable: true,
      maximizable: true,     
      fullscreenable: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      }
    });
  
    child.loadURL(url);
  });

ipcMain.on("notifications:markRead", () => {
    store.set('shown_notification_counts', {});
    setTrayIconDefault();
});
  

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
