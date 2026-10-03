const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const DatabaseManager = require('./database/database');

// Disable hardware acceleration to avoid GPU process crashes on some Windows setups
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

// Keep a global reference of the window object
let mainWindow;
let db;
let currentUser = null;
const loginAttempts = new Map();
const SCRYPT_KEYLEN = 64;
const LOGIN_LOCK_MS = 5 * 60 * 1000;

function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, usedSalt, SCRYPT_KEYLEN);
  return `${usedSalt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    mustChange: !!row.must_change
  };
}

async function ensureAdminUser() {
  const countRow = await db.get('SELECT COUNT(*) as count FROM users');
  if (countRow && countRow.count > 0) return;
  const passwordHash = hashPassword('admin');
  await db.run(
    'INSERT INTO users (username, password_hash, role, is_active, must_change) VALUES (?, ?, ?, 1, 1)',
    ['admin', passwordHash, 'admin']
  );
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 768,
    minHeight: 600,
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
    
    if (process.env.NODE_ENV === 'development' && currentUser && currentUser.role === 'admin') {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  db = new DatabaseManager();
  await db.initialize();
  await ensureAdminUser();
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
    
    db = new DatabaseManager();
    await db.initialize();
    currentUser = null;
    await ensureAdminUser();
    
    console.log('Database reset completed successfully');
    return { success: true, message: 'Database reset completed' };
  } catch (error) {
    console.error('Database reset error:', error);
    throw error;
  }
});

ipcMain.handle('auth-ensure-admin', async () => {
  await ensureAdminUser();
  return { ok: true };
});

ipcMain.handle('auth-login', async (event, { username, password } = {}) => {
  const name = String(username || '').trim();
  const now = Date.now();
  const attempt = loginAttempts.get(name) || { count: 0, lockedUntil: 0 };
  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    return { ok: false, reason: 'locked' };
  }
  const row = await db.get('SELECT * FROM users WHERE username = ?', [name]);
  if (!row || !row.is_active || !verifyPassword(password || '', row.password_hash)) {
    attempt.count += 1;
    if (attempt.count >= 5) {
      attempt.lockedUntil = now + LOGIN_LOCK_MS;
      attempt.count = 0;
    }
    loginAttempts.set(name, attempt);
    return { ok: false, reason: attempt.lockedUntil && now < attempt.lockedUntil ? 'locked' : 'invalid' };
  }
  loginAttempts.delete(name);
  currentUser = publicUser(row);
  if (process.env.NODE_ENV === 'development' && currentUser.role === 'admin' && mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.webContents.openDevTools();
  }
  return { ok: true, user: currentUser };
});

ipcMain.handle('auth-logout', async () => {
  currentUser = null;
  return { ok: true };
});

ipcMain.handle('auth-session', async () => currentUser);

ipcMain.handle('auth-change-password', async (event, { userId, oldPassword, newPassword } = {}) => {
  const targetId = userId || (currentUser && currentUser.id);
  if (!targetId) return { ok: false, reason: 'invalid' };
  const row = await db.get('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!row) return { ok: false, reason: 'invalid' };
  if (!verifyPassword(oldPassword || '', row.password_hash)) {
    return { ok: false, reason: 'invalid' };
  }
  if (!newPassword || String(newPassword).length < 4) {
    return { ok: false, reason: 'invalid' };
  }
  const passwordHash = hashPassword(newPassword);
  await db.run('UPDATE users SET password_hash = ?, must_change = 0 WHERE id = ?', [passwordHash, targetId]);
  if (currentUser && currentUser.id === targetId) {
    currentUser.mustChange = false;
  }
  return { ok: true };
});

ipcMain.handle('auth-unlock', async (event, { password } = {}) => {
  if (!currentUser) return { ok: false, reason: 'invalid' };
  const row = await db.get('SELECT * FROM users WHERE id = ?', [currentUser.id]);
  if (!row || !verifyPassword(password || '', row.password_hash)) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, user: currentUser };
});

ipcMain.handle('users-list', async () => {
  if (!currentUser || currentUser.role !== 'admin') return [];
  return await db.query('SELECT id, username, role, is_active, must_change, created_at FROM users ORDER BY username');
});

ipcMain.handle('users-create', async (event, { username, password, role } = {}) => {
  if (!currentUser || currentUser.role !== 'admin') return { ok: false, reason: 'forbidden' };
  const name = String(username || '').trim();
  if (!name || !password) return { ok: false, reason: 'invalid' };
  const usedRole = role === 'employee' ? 'employee' : 'admin';
  try {
    await db.run(
      'INSERT INTO users (username, password_hash, role, is_active, must_change) VALUES (?, ?, ?, 1, 1)',
      [name, hashPassword(password), usedRole]
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'invalid' };
  }
});

ipcMain.handle('users-set-active', async (event, { userId, isActive } = {}) => {
  if (!currentUser || currentUser.role !== 'admin') return { ok: false, reason: 'forbidden' };
  if (currentUser.id === userId) return { ok: false, reason: 'invalid' };
  await db.run('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, userId]);
  return { ok: true };
});

ipcMain.handle('shop-settings-get', async () => {
  const row = await db.get('SELECT * FROM shop_settings WHERE id = 1');
  return row || { id: 1, shop_name: 'Installment Management', phone: '', address: '', logo_path: '', idle_minutes: 30 };
});

ipcMain.handle('shop-settings-save', async (event, settings = {}) => {
  if (!currentUser || currentUser.role !== 'admin') return { ok: false, reason: 'forbidden' };
  await db.run(
    `UPDATE shop_settings SET shop_name = ?, phone = ?, address = ?, idle_minutes = ? WHERE id = 1`,
    [
      settings.shop_name || 'Installment Management',
      settings.phone || '',
      settings.address || '',
      Number(settings.idle_minutes) > 0 ? Number(settings.idle_minutes) : 30
    ]
  );
  return { ok: true };
});

ipcMain.handle('shop-logo-pick', async () => {
  if (!currentUser || currentUser.role !== 'admin' || !mainWindow) return { ok: false };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose shop logo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false };
  const dest = path.join(app.getPath('userData'), 'logo.png');
  fs.copyFileSync(result.filePaths[0], dest);
  await db.run('UPDATE shop_settings SET logo_path = ? WHERE id = 1', [dest]);
  return { ok: true, logo_path: dest };
});
