const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const DatabaseManager = require('./database/database');

// Disable hardware acceleration to avoid GPU process crashes on some Windows setups
if (process.argv.includes('--dev')) {
  process.env.NODE_ENV = 'development';
}

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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

  mainWindow.on('close', (event) => {
    if (mainWindow._allowQuit) return;
    event.preventDefault();
    mainWindow.webContents.send('confirm-backup-quit');
  });

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
    
    const dbPath = db && db.dbPath
      ? db.dbPath
      : path.join(__dirname, '../database/installments.db');
    console.log('Database path:', dbPath);
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('Database file deleted successfully');
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
  const settings = row || { id: 1, shop_name: 'Installment Management', phone: '', address: '', logo_path: '', idle_minutes: 30 };
  if (settings.logo_path && fs.existsSync(settings.logo_path)) {
    try {
      const buf = fs.readFileSync(settings.logo_path);
      const ext = path.extname(settings.logo_path).toLowerCase();
      const mime = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
      settings.logo_data_url = `data:${mime};base64,${buf.toString('base64')}`;
    } catch (_) { /* logo optional */ }
  }
  return settings;
});

ipcMain.handle('shop-settings-save', async (event, settings = {}) => {
  if (!currentUser || currentUser.role !== 'admin') return { ok: false, reason: 'forbidden' };
  const current = await db.get('SELECT drive_folder, whatsapp_template FROM shop_settings WHERE id = 1') || {};
  await db.run(
    `UPDATE shop_settings SET shop_name = ?, phone = ?, address = ?, idle_minutes = ?, drive_folder = ?, whatsapp_template = ? WHERE id = 1`,
    [
      settings.shop_name || 'Installment Management',
      settings.phone || '',
      settings.address || '',
      Number(settings.idle_minutes) > 0 ? Number(settings.idle_minutes) : 30,
      settings.drive_folder != null ? settings.drive_folder : (current.drive_folder || ''),
      settings.whatsapp_template != null ? settings.whatsapp_template : (current.whatsapp_template || '')
    ]
  );
  return { ok: true };
});

async function pickShopLogo() {
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
}

ipcMain.handle('choose-logo', pickShopLogo);
ipcMain.handle('shop-logo-pick', pickShopLogo);

function backupFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `icam-backup-${stamp}.db`;
}

ipcMain.handle('backup-save-dialog', async () => {
  if (!mainWindow) return { ok: false };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save database backup',
    defaultPath: backupFileName(),
    filters: [{ name: 'Database', extensions: ['db'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false };
  const dest = await db.backup(result.filePath);
  return { ok: true, path: dest };
});

ipcMain.handle('restore-open-dialog', async () => {
  if (!currentUser || currentUser.role !== 'admin' || !mainWindow) return { ok: false, reason: 'forbidden' };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Restore database',
    filters: [{ name: 'Database', extensions: ['db'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false };
  await db.restore(result.filePaths[0]);
  return { ok: true };
});

ipcMain.handle('db-restore', async (event, backupPath) => {
  if (!currentUser || currentUser.role !== 'admin') return { ok: false, reason: 'forbidden' };
  await db.restore(backupPath);
  return { ok: true };
});

ipcMain.handle('drive-folder-pick', async () => {
  if (!currentUser || currentUser.role !== 'admin' || !mainWindow) return { ok: false, reason: 'forbidden' };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Google Drive backup folder',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false };
  const folder = result.filePaths[0];
  await db.run('UPDATE shop_settings SET drive_folder = ? WHERE id = 1', [folder]);
  return { ok: true, folder };
});

ipcMain.handle('drive-backup', async () => {
  const settings = await db.get('SELECT drive_folder FROM shop_settings WHERE id = 1');
  const folder = settings && settings.drive_folder;
  if (!folder || !fs.existsSync(folder)) return { ok: false, reason: 'no-folder' };
  const dest = path.join(folder, backupFileName());
  await db.backup(dest);
  return { ok: true, path: dest };
});

ipcMain.handle('drive-list', async () => {
  const settings = await db.get('SELECT drive_folder FROM shop_settings WHERE id = 1');
  const folder = settings && settings.drive_folder;
  if (!folder || !fs.existsSync(folder)) return [];
  return fs.readdirSync(folder)
    .filter((name) => /^icam-backup-.*\.db$/i.test(name))
    .map((name) => {
      const full = path.join(folder, name);
      let mtime = 0;
      try { mtime = fs.statSync(full).mtimeMs; } catch (_) { /* skip */ }
      return { name, path: full, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);
});

ipcMain.handle('drive-restore', async (event, filePath) => {
  if (!currentUser || currentUser.role !== 'admin') return { ok: false, reason: 'forbidden' };
  if (!filePath || !fs.existsSync(filePath)) return { ok: false, reason: 'missing' };
  await db.restore(filePath);
  return { ok: true };
});

ipcMain.handle('customer-photo-pick', async (event, { customerId, kind } = {}) => {
  if (!mainWindow || !customerId) return { ok: false };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: kind === 'cnic' ? 'Choose CNIC photo' : 'Choose customer photo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false };
  const photosDir = path.join(app.getPath('userData'), 'photos');
  if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
  const ext = path.extname(result.filePaths[0]).toLowerCase() || '.jpg';
  const dest = path.join(photosDir, `${kind === 'cnic' ? 'cnic' : 'photo'}-${customerId}${ext}`);
  fs.copyFileSync(result.filePaths[0], dest);
  if (kind === 'cnic') {
    await db.run('UPDATE customers SET cnic_photo_path = ? WHERE id = ?', [dest, customerId]);
  } else {
    await db.run('UPDATE customers SET photo_path = ? WHERE id = ?', [dest, customerId]);
  }
  return { ok: true, path: dest };
});

ipcMain.handle('customer-photo-url', async (event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return { ok: false };
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
    return { ok: true, data_url: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (_) {
    return { ok: false };
  }
});

ipcMain.handle('app-quit-now', async () => {
  if (mainWindow) mainWindow._allowQuit = true;
  app.quit();
  return { ok: true };
});
