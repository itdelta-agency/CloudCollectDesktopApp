// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, Tray, Menu, nativeImage, session, Notification, ipcMain, shell, dialog } = require('electron')
const os = require('os');
const path = require('node:path')
const fs = require('node:fs')
const log = require("electron-log")

log.transports.file.level = "info" // Logging level

//app.setName('CloudCollect');

// // ★ Автозапуск для MSIX/Appx
// let AutoLaunch, StartupTaskState;
// try {
//   ({ WindowsStoreAutoLaunch: AutoLaunch, StartupTaskState } = require('electron-winstore-auto-launch'));
// } catch (_) {
//   // dev-режим без пакета — просто молчим
// }


const configPath = path.join(app.getAppPath(), "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const userDataPath = app.getPath('userData');
const cookiesPath = path.join(userDataPath, 'cookies-backup.json');

log.info("CloudCollectDesktopApp statred!");
log.info("FRONTEND_URL:", config.FRONTEND_URL);
log.info("BACKEND_URL:", config.BACKEND_URL);

const FRONTEND_URL = config.FRONTEND_URL;
const BACKEND_URL = config.BACKEND_URL;

let tray, mainWindow
let isQuiting = false;

const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.ico')) //ico for windows, 16×16, 32×32, 48×48, 64×64 and 256×256 in one file
//console.log('Icon is empty?', icon.isEmpty())


const createWindow = ({ showNow }) => {
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

    if (showNow) mainWindow.once('ready-to-show', () => mainWindow.show());

    // Fetch notifications every 10 minutes
    setInterval(fetchNotifications, 60 * 1000 * 10);
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
        log.error("Error fetching notifications:", error);
    }
}

function showNotification(notifications, unreadCount) {
    if (unreadCount > 0) {
        const latestNotification = notifications[0]; // Get latest notification

        //Create OS desktop notifications
        const notification = new Notification({
            title: latestNotification ? latestNotification.title + `(${unreadCount} unread)`  : 'New Notification!',
            body: latestNotification ? latestNotification.message : 'New notification!',
            silent: false,
            icon
        });

        notification.show();

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
    app.whenReady().then(async () => {
        await restoreCookies(); // <--- Восстановить куки перед загрузкой окна
        //await enableAutoLaunch(); //Попытаться включить автозапуск (мягко, с логами)

              // 2) Логика показа:
        //    а) если это ПЕРВЫЙ запуск после установки — показываем окно
        //    б) иначе — прячемся (автозапуск)
        //const isFirstRun = !fs.existsSync(firstRunFlag);

        // Доп. эвристика: если аптайм системы < 120с, это очень похоже на автозапуск → не показываем
        const looksLikeAutostart = os.uptime() < 60;
        const shouldShowNow = !looksLikeAutostart;
        

        setTimeout(() => {
            //Try use set timeout to fix app blinking
            createWindow({ showNow: shouldShowNow });
          }, 1000);
       
        createAppMenu()
        createTray()
        
        app.on('activate', () => {
            // On macOS it's common to re-create a window in the app when the
            // dock icon is clicked and there are no other windows open.
            if (BrowserWindow.getAllWindows().length === 0) createWindow()
        })
    })

}

ipcMain.on('flush-storage', async () => {
    //await session.defaultSession.flushStorageData();
    log.info('flush-storage event handling...');
    await backupCookies();
});

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

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})



async function backupCookies() {
  log.info('Backup cookies to json...');
  try {
    const cookies = await session.defaultSession.cookies.get({});
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    log.info('Cookie backup done');
  } catch (err) {
    log.error('Failed to Backup cookie:', err);
  }
}


async function restoreCookies() {
  log.info('Restore cookies form json...');
  if (!fs.existsSync(cookiesPath)) {
    log.error('Path to cookies json not found:', cookiesPath);
    return;
  }

  const cookies = JSON.parse(fs.readFileSync(cookiesPath));
  for (const cookie of cookies) {
    delete cookie.session;
    delete cookie.hostOnly;

    // Добавляем обязательное поле url
    if (!cookie.url) {
      const protocol = cookie.secure ? 'https://' : 'http://';
      cookie.url = protocol + (cookie.domain?.replace(/^\./, '') || cookie.domain);
    }

    try {
      await session.defaultSession.cookies.set(cookie);
    } catch (err) {
      log.error(`Failed to restore cookie ${cookie.name}:`, err);
    }
  }

  log.info('Cookies restored from backup.');
}

app.on('before-quit', async () => {
  log.info('before-quit event handling...');
  await backupCookies();
})

// // ★ Узнать статус автозапуска
// async function getAutoLaunchState() {
//   if (!app.isPackaged || !AutoLaunch) return null;
//   try {
//     // Если модуль знает ваш единственный StartupTask:
//     if (AutoLaunch.getStatus) return await AutoLaunch.getStatus(); // 0,1,2

//     // На случай другой версии API с перечислением задач:
//     if (AutoLaunch.getStartupTasks) {
//       const tasks = await AutoLaunch.getStartupTasks();
//       const t = tasks.find(x => x.taskId === 'CloudCollectStartup');
//       return t?.state ?? null; // 0,1,2
//     }
//   } catch (e) {
//     log.error('getAutoLaunchState error:', e);
//   }
//   return null;
// }

// // ★ Включить автозапуск (если не запрещён пользователем)
// async function enableAutoLaunch() {
//   if (!app.isPackaged || !AutoLaunch) return;
//   try {
//     const state = await getAutoLaunchState();
//     if (state === StartupTaskState?.disabled || state === 0) {
//       await (AutoLaunch.enable ? AutoLaunch.enable() : AutoLaunch.enableTask('CloudCollectStartup'));
//       log.info('Autolaunch enabled.');
//     } else if (state === StartupTaskState?.disabledByUser || state === 1) {
//       log.warn('Autolaunch disabled by user — включение программно запрещено.');
//     }
//   } catch (e) {
//     log.error('enableAutoLaunch error:', e);
//   }
// }

// // ★ Выключить автозапуск
// async function disableAutoLaunch() {
//   if (!app.isPackaged || !AutoLaunch) return;
//   try {
//     const state = await getAutoLaunchState();
//     if (state === StartupTaskState?.enabled || state === 2) {
//       await (AutoLaunch.disable ? AutoLaunch.disable() : AutoLaunch.disableTask('CloudCollectStartup'));
//       log.info('Autolaunch disabled.');
//     }
//   } catch (e) {
//     log.error('disableAutoLaunch error:', e);
//   }
// }
