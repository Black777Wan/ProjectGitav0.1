const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV;
const { DatabaseManager } = require('./database');

let mainWindow;
let dbManager;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Initialize database
    dbManager = new DatabaseManager();
    dbManager.initialize().then(() => {
      console.log('Database initialized successfully');
    }).catch(err => {
      console.error('Failed to initialize database:', err);
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event listeners
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for database operations
ipcMain.handle('db:getPages', async () => {
  return await dbManager.getPages();
});

ipcMain.handle('db:getPage', async (event, pageId) => {
  return await dbManager.getPage(pageId);
});

ipcMain.handle('db:getPageByTitle', async (event, title) => {
  return await dbManager.getPageByTitle(title);
});

ipcMain.handle('db:createPage', async (event, pageData) => {
  return await dbManager.createPage(pageData);
});

ipcMain.handle('db:updatePage', async (event, pageId, pageData) => {
  return await dbManager.updatePage(pageId, pageData);
});

ipcMain.handle('db:getBlocks', async (event, pageId) => {
  return await dbManager.getBlocks(pageId);
});

ipcMain.handle('db:createBlock', async (event, blockData) => {
  return await dbManager.createBlock(blockData);
});

ipcMain.handle('db:updateBlock', async (event, blockId, blockData) => {
  return await dbManager.updateBlock(blockId, blockData);
});

ipcMain.handle('db:deleteBlock', async (event, blockId) => {
  return await dbManager.deleteBlock(blockId);
});

ipcMain.handle('db:getDailyNote', async (event, date) => {
  return await dbManager.getDailyNote(date);
});
