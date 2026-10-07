const { contextBridge, ipcRenderer } = require('electron');

const invokeAllow = [
  'db-query', 'db-get', 'db-run', 'db-backup', 'db-reset', 'db-restore',
  'auth-login', 'auth-logout', 'auth-session', 'auth-change-password',
  'auth-ensure-admin', 'auth-unlock',
  'users-list', 'users-create', 'users-set-active',
  'shop-settings-get', 'shop-settings-save', 'shop-logo-pick', 'choose-logo',
  'backup-save-dialog', 'restore-open-dialog',
  'drive-folder-pick', 'drive-backup', 'drive-list', 'drive-restore',
  'customer-photo-pick', 'customer-photo-url',
  'app-quit-now'
];

const eventAllow = ['backup-database', 'restore-database', 'show-about', 'confirm-backup-quit'];

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    if (!invokeAllow.includes(channel)) return Promise.reject(new Error('Denied'));
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel, fn) => {
    if (!eventAllow.includes(channel)) return;
    ipcRenderer.on(channel, (_e, ...a) => fn(...a));
  }
});
