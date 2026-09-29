const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const DatabaseManager = require('./database/database');

// Disable hardware acceleration to avoid GPU process crashes on some Windows setups
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

// Keep a global reference of the window object
let mainWindow;
let db;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      backgroundThrottling: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  // Load the main HTML file
  mainWindow.loadFile('src/renderer/index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialize database
  db = new DatabaseManager();
  db.initialize();
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  // Create application menu
  createMenu();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) {
      db.close();
    }
    app.quit();
  }
});

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Backup Database',
          click: () => {
            mainWindow.webContents.send('backup-database');
          }
        },
        {
          label: 'Restore Database',
          click: () => {
            mainWindow.webContents.send('restore-database');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            mainWindow.webContents.send('show-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for database operations
ipcMain.handle('db-query', async (event, query, params = []) => {
  try {
    return await db.query(query, params);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
});

ipcMain.handle('db-run', async (event, query, params = []) => {
  try {
    return await db.run(query, params);
  } catch (error) {
    console.error('Database run error:', error);
    throw error;
  }
});

ipcMain.handle('db-get', async (event, query, params = []) => {
  try {
    return await db.get(query, params);
  } catch (error) {
    console.error('Database get error:', error);
    throw error;
  }
});

ipcMain.handle('db-backup', async (event, backupPath) => {
  try {
    return await db.backup(backupPath);
  } catch (error) {
    console.error('Database backup error:', error);
    throw error;
  }
});

ipcMain.handle('db-reset', async (event) => {
  try {
    console.log('Performing database reset...');
    
    // Close current database connection
    if (db) {
      db.close();
    }
    
    // Reset database manually
    const fs = require('fs');
    const dbPath = path.join(__dirname, '../database/installments.db');
    
    console.log('Database path:', dbPath);
    
    // Delete database file if it exists
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('Database file deleted successfully');
    }
    
    // Also clean any backup files
    const backupDir = path.join(__dirname, '../database/backups');
    if (fs.existsSync(backupDir)) {
      const backups = fs.readdirSync(backupDir);
      backups.forEach(file => {
        if (file.endsWith('.db')) {
          fs.unlinkSync(path.join(backupDir, file));
          console.log(`Deleted backup: ${file}`);
        }
      });
    }
    
    // Reinitialize database with fresh tables
    db = new DatabaseManager();
    await db.initialize();
    
    console.log('Database reset completed successfully');
    return { success: true, message: 'Database reset completed' };
  } catch (error) {
    console.error('Database reset error:', error);
    throw error;
  }
});
