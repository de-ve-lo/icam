class AuthManager {
    constructor() {
        this.user = null;
        this.idleTimer = null;
        this.idleMinutes = 30;
        this.ipc = window.electronAPI || window._ipcRenderer;
        if (this.ipc) window._ipcRenderer = this.ipc;
    }

    async session() {
        if (!this.ipc) return null;
        this.user = await this.ipc.invoke('auth-session');
        return this.user;
    }

    isAdmin() {
        return !!(this.user && this.user.role === 'admin');
    }

    isEmployee() {
        return !!(this.user && this.user.role === 'employee');
    }

    requireAdmin() {
        if (this.isAdmin()) return true;
        const err = (typeof EngineError !== 'undefined')
            ? new EngineError('InsufficientPermission', 'Admin permission required')
            : new Error('InsufficientPermission');
        if (window.app && app.showNotification) {
            app.showNotification(err.message, 'error');
        }
        throw err;
    }

    showLogin() {
        const screen = document.getElementById('login-screen');
        if (screen) screen.classList.remove('hidden');
        const appEl = document.getElementById('app');
        if (appEl) appEl.classList.add('hidden');
        const errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.textContent = '';
    }

    hideLogin() {
        const screen = document.getElementById('login-screen');
        if (screen) screen.classList.add('hidden');
        const appEl = document.getElementById('app');
        if (appEl) appEl.classList.remove('hidden');
    }

    async login(username, password) {
        const result = await this.ipc.invoke('auth-login', { username, password });
        if (!result || !result.ok) return result;
        this.user = result.user;
        return result;
    }

    async logout() {
        await this.ipc.invoke('auth-logout');
        this.user = null;
        this.stopIdleWatch();
        window.location.reload();
    }

    async changePassword(oldPassword, newPassword) {
        return await this.ipc.invoke('auth-change-password', {
            userId: this.user && this.user.id,
            oldPassword,
            newPassword
        });
    }

    applyRoleGates() {
        const adminOnly = document.querySelectorAll('[data-admin-only]');
        adminOnly.forEach((el) => {
            el.classList.toggle('hidden', !this.isAdmin());
        });
        const userLabel = document.getElementById('header-user-name');
        if (userLabel && this.user) {
            userLabel.textContent = this.user.username;
        }
        const shopNameEl = document.getElementById('header-shop-name');
        if (shopNameEl && this.shopName) {
            shopNameEl.textContent = this.shopName;
        }
    }

    async loadShopSettings() {
        try {
            const settings = await this.ipc.invoke('shop-settings-get');
            this.idleMinutes = (settings && settings.idle_minutes) || 30;
            this.shopName = (settings && settings.shop_name) || 'Installment Management';
            return settings;
        } catch (e) {
            this.idleMinutes = 30;
            this.shopName = 'Installment Management';
            return null;
        }
    }

    startIdleWatch() {
        this.stopIdleWatch();
        const reset = () => this.resetIdleTimer();
        this._idleReset = reset;
        document.addEventListener('mousemove', reset);
        document.addEventListener('keydown', reset);
        this.resetIdleTimer();
    }

    stopIdleWatch() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        if (this._idleReset) {
            document.removeEventListener('mousemove', this._idleReset);
            document.removeEventListener('keydown', this._idleReset);
            this._idleReset = null;
        }
    }

    resetIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        const ms = Math.max(1, Number(this.idleMinutes) || 30) * 60 * 1000;
        this.idleTimer = setTimeout(() => this.showLock(), ms);
    }

    showLock() {
        const lock = document.getElementById('lock-screen');
        if (!lock) return;
        const nameEl = document.getElementById('lock-username');
        if (nameEl && this.user) nameEl.textContent = this.user.username;
        const errorEl = document.getElementById('lock-error');
        if (errorEl) errorEl.textContent = '';
        const input = document.getElementById('lock-password');
        if (input) input.value = '';
        lock.classList.remove('hidden');
    }

    hideLock() {
        const lock = document.getElementById('lock-screen');
        if (lock) lock.classList.add('hidden');
        this.resetIdleTimer();
    }

    async unlock(password) {
        const result = await this.ipc.invoke('auth-unlock', { password });
        if (result && result.ok) {
            this.hideLock();
            return true;
        }
        return false;
    }

    showMustChangeModal() {
        if (!window.app || !app.showModal) return;
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3>Change Password</h3>
                    </div>
                    <div class="modal-body">
                        <p>You must change the default password before continuing.</p>
                        <form id="must-change-form">
                            <div class="form-group">
                                <label class="form-label">Current password</label>
                                <input type="password" name="old_password" class="form-input" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">New password</label>
                                <input type="password" name="new_password" class="form-input" required minlength="4">
                            </div>
                        </form>
                        <p id="must-change-error" class="text-danger"></p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" type="button" onclick="window.auth.submitMustChange()">Save</button>
                    </div>
                </div>
            </div>
        `;
        app.showModal(modalHtml);
    }

    async submitMustChange() {
        const form = document.getElementById('must-change-form');
        if (!form) return;
        const data = new FormData(form);
        const result = await this.changePassword(data.get('old_password'), data.get('new_password'));
        const errorEl = document.getElementById('must-change-error');
        if (!result || !result.ok) {
            if (errorEl) errorEl.textContent = 'Could not change password';
            return;
        }
        if (this.user) this.user.mustChange = false;
        if (window.app) app.closeModal();
    }

    bindForms() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('login-username').value;
                const password = document.getElementById('login-password').value;
                const result = await this.login(username, password);
                const errorEl = document.getElementById('login-error');
                if (!result || !result.ok) {
                    if (errorEl) errorEl.textContent = result && result.reason === 'locked'
                        ? 'Too many attempts. Try again in 5 minutes.'
                        : 'Invalid username or password';
                    return;
                }
                if (errorEl) errorEl.textContent = '';
                await this.afterLogin();
            });
        }
        const lockForm = document.getElementById('lock-form');
        if (lockForm) {
            lockForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const password = document.getElementById('lock-password').value;
                const ok = await this.unlock(password);
                const errorEl = document.getElementById('lock-error');
                if (!ok) {
                    if (errorEl) errorEl.textContent = 'Invalid password';
                    return;
                }
            });
        }
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    async afterLogin() {
        this.hideLogin();
        await this.loadShopSettings();
        this.applyRoleGates();
        this.startIdleWatch();
        if (window.app && typeof app.startAuthenticated === 'function') {
            await app.startAuthenticated();
        }
        if (this.user && this.user.mustChange) {
            this.showMustChangeModal();
        }
    }

    async boot() {
        this.bindForms();
        const user = await this.session();
        if (!user) {
            this.showLogin();
            return;
        }
        await this.afterLogin();
    }
}

window.auth = new AuthManager();
window.AuthManager = AuthManager;
