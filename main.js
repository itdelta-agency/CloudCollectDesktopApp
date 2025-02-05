// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron')
const path = require('node:path')

let tray, mainWindow

const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // and load the index.html of the app.
    mainWindow.loadFile('index.html')
}

const createTray = () => {
    // Make the application minimize to Tray

    const icon = nativeImage.createFromPath('assets/icon.png') //TODO change to ico for windows, 16×16, 32×32, 48×48, 64×64 и 256×256 in one file
    console.log('Иконка пуста?', icon.isEmpty())

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
