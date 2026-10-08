// Main Application Controller
if (!window._ipcRenderer) {
    window._ipcRenderer = window.electronAPI;
}

class App {
    constructor() {
        this.currentSection = 'dashboard';
        this.isLoading = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        if (window.auth) {
            window.auth.boot();
        } else {
            this.startAuthenticated();
        }
    }

    async startAuthenticated() {
        if (this._started) return;
        this._started = true;
        this.initializeModules();
        if (window.auth) window.auth.applyRoleGates();
        this.showLoading();
        this.loadDashboard();
    }

    setupEventListeners() {
        // Navigation (DOM is already loaded when App is constructed)
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                this.navigateToSection(section);
            });
        });

        // Calculator button
        const calcBtn = document.getElementById('calculator-btn');
        if (calcBtn) {
            calcBtn.addEventListener('click', async () => {
                if (window.calculator) {
                    await window.calculator.initialize();
                    window.calculator.showCalculator();
                }
            });
        }

        // Backup button
        const backupBtn = document.getElementById('backup-btn');
        if (backupBtn) {
            backupBtn.addEventListener('click', () => {
                this.createBackup();
            });
        }

        // System reset button
        const resetBtn = document.getElementById('system-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.showSystemResetConfirm();
            });
        }

        const createUserForm = document.getElementById('create-user-form');
        if (createUserForm) {
            createUserForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createUser(new FormData(createUserForm));
            });
        }
        const shopForm = document.getElementById('shop-settings-form');
        if (shopForm) {
            shopForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveShopSettings(new FormData(shopForm));
            });
        }
        const pickLogoBtn = document.getElementById('pick-logo-btn');
        if (pickLogoBtn) {
            pickLogoBtn.addEventListener('click', () => this.pickShopLogo());
        }
        const settingsBackupBtn = document.getElementById('settings-backup-btn');
        if (settingsBackupBtn) settingsBackupBtn.addEventListener('click', () => this.backupToFile());
        const settingsRestoreBtn = document.getElementById('settings-restore-btn');
        if (settingsRestoreBtn) settingsRestoreBtn.addEventListener('click', () => this.restoreFromFile());
        const pickDriveBtn = document.getElementById('pick-drive-folder-btn');
        if (pickDriveBtn) pickDriveBtn.addEventListener('click', () => this.pickDriveFolder());
        const driveBackupBtn = document.getElementById('drive-backup-btn');
        if (driveBackupBtn) driveBackupBtn.addEventListener('click', () => this.backupToDrive());
        const driveRestoreBtn = document.getElementById('drive-restore-btn');
        if (driveRestoreBtn) driveRestoreBtn.addEventListener('click', () => this.restoreFromDrive());
        const saveWaBtn = document.getElementById('save-whatsapp-template-btn');
        if (saveWaBtn) saveWaBtn.addEventListener('click', () => this.saveWhatsAppTemplate());

        const hamburger = document.getElementById('hamburger-btn');
        const sidebar = document.querySelector('.sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        const collapseBtn = document.getElementById('sidebar-collapse-btn');
        const applyCollapsed = (collapsed) => {
            const appEl = document.getElementById('app');
            if (appEl) appEl.classList.toggle('sidebar-collapsed', collapsed);
            if (sidebar) sidebar.classList.toggle('collapsed', collapsed);
            if (collapseBtn) {
                collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                collapseBtn.setAttribute('title', collapsed ? 'Expand sidebar' : 'Minimize sidebar');
                collapseBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Minimize sidebar');
                const icon = collapseBtn.querySelector('i');
                if (icon) icon.className = collapsed ? 'fas fa-angles-right' : 'fas fa-angles-left';
            }
            try {
                localStorage.setItem('icam-sidebar-collapsed', collapsed ? '1' : '0');
            } catch (e) { /* ignore */ }
        };
        try {
            applyCollapsed(localStorage.getItem('icam-sidebar-collapsed') === '1');
        } catch (e) {
            applyCollapsed(false);
        }
        if (collapseBtn) {
            collapseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const appEl = document.getElementById('app');
                applyCollapsed(!(appEl && appEl.classList.contains('sidebar-collapsed')));
            });
        }
        const closeSidebar = () => {
            if (sidebar) sidebar.classList.remove('open');
            if (backdrop) backdrop.classList.add('hidden');
            if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
        };
        const toggleSidebar = () => {
            if (!sidebar) return;
            const willOpen = !sidebar.classList.contains('open');
            sidebar.classList.toggle('open', willOpen);
            if (backdrop) backdrop.classList.toggle('hidden', !willOpen);
            if (hamburger) hamburger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        };
        if (hamburger && sidebar) {
            hamburger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSidebar();
            });
        }
        if (backdrop) backdrop.addEventListener('click', closeSidebar);
        document.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', closeSidebar);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSidebar();
        });

        const refreshBtn = document.getElementById('refresh-page-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshCurrentSection());
        }

        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => this.runGlobalSearch(e.target.value), 250));
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.hideGlobalSearch();
            });
        }
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.global-search')) this.hideGlobalSearch();
        });

        // Modal close handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        if (window.electronAPI && window.electronAPI.on) {
            window.electronAPI.on('backup-database', () => this.createBackup());
            window.electronAPI.on('restore-database', () => this.restoreFromFile());
            window.electronAPI.on('confirm-backup-quit', () => this.confirmBackupQuit());
            window.electronAPI.on('show-about', () => {
                this.showNotification('Installment Management. Developed By POVDEV | povdev.com | WhatsApp: @wpfahad | Email: mypovdev@gmail.com', 'info');
            });
        }

        // Window events
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    initializeModules() {
        try {
            console.log('Initializing modules...');
            
            // Initialize all modules with error handling
            this.dashboard = new DashboardManager(this);
            this.products = new ProductManager();
            this.suppliers = new SupplierManager();
            this.stock = new StockManager();
            this.customers = new CustomerManager();
            this.installments = new InstallmentManager();
            
            // Initialize new modules with safety checks
            if (typeof CashSalesManager !== 'undefined') {
                this.cashSales = new CashSalesManager();
                console.log('✅ Cash Sales module initialized');
            } else {
                console.warn('⚠️  CashSalesManager not available');
            }
            
            if (typeof SupplierPaymentsManager !== 'undefined') {
                this.supplierPayments = new SupplierPaymentsManager();
                console.log('✅ Supplier Payments module initialized');
            } else {
                console.warn('⚠️  SupplierPaymentsManager not available');
            }
            
            if (typeof ExpensesManager !== 'undefined') {
                this.expenses = new ExpensesManager();
                console.log('✅ Expenses module initialized');
            } else {
                console.warn('⚠️  ExpensesManager not available');
            }

            if (typeof StaffManager !== 'undefined') {
                this.staff = new StaffManager();
            }
            
            if (typeof DuesRemindersManager !== 'undefined') {
                this.duesReminders = new DuesRemindersManager();
                console.log('✅ Dues & Reminders module initialized');
            } else {
                console.warn('⚠️  DuesRemindersManager not available');
            }
            
            if (typeof ReportsManager !== 'undefined') {
                this.reports = new ReportsManager();
                // Expose global reports instance for onclick handlers in index.html and modal buttons
                window.reports = this.reports;
                console.log('✅ Reports module initialized');
            } else {
                console.warn('⚠️  ReportsManager not available');
            }
            
            // Initialize global calculator instance required by UI handlers
            if (!window.calculator) {
                window.calculator = new InstallmentCalculator();
            }
            
            console.log('All modules initialized successfully');
            
        } catch (error) {
            console.error('Error initializing modules:', error);
            this.showNotification('Some modules failed to initialize. Please refresh the page.', 'error');
        }
    }

    navigateToSection(section, options = {}) {
        if (this.isLoading) return;
        if (!options.force && section === this.currentSection) return;
        if ((section === 'users' || section === 'settings') && window.auth && !window.auth.isAdmin()) {
            this.showNotification('Admin permission required', 'error');
            return;
        }

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelector(`[data-section="${section}"]`).parentElement.classList.add('active');

        // Hide current section
        const currentSectionEl = document.getElementById(`${this.currentSection}-section`);
        if (currentSectionEl) {
            currentSectionEl.classList.remove('active');
        }

        // Show new section
        const newSectionEl = document.getElementById(`${section}-section`);
        if (newSectionEl) {
            newSectionEl.classList.add('active');
            this.currentSection = section;
            
            // Load section data
            this.loadSectionData(section);
        }
    }

    async loadSectionData(section) {
        this.showLoading();
        
        try {
            switch (section) {
                case 'dashboard':
                    await this.dashboard.loadData();
                    break;
                case 'products':
                    await this.products.loadData();
                    break;
                case 'suppliers':
                    await this.suppliers.loadData();
                    break;
                case 'stock':
                    await this.stock.loadData();
                    break;
                case 'customers':
                    await this.customers.loadData();
                    break;
                case 'installments':
                    await this.installments.loadData();
                    break;
                case 'cash-sales':
                    await this.loadCashSalesSection();
                    break;
                case 'supplier-payments':
                    await this.loadSupplierPaymentsSection();
                    break;
                case 'expenses':
                    await this.loadExpensesSection();
                    break;
                case 'staff':
                    if (this.staff && this.staff.loadData) await this.staff.loadData();
                    break;
                case 'dues-reminders':
                    await this.loadDuesRemindersSection();
                    break;
                case 'reports':
                    await this.loadReportsSection();
                    break;
                case 'users':
                    await this.loadUsersSection();
                    break;
                case 'settings':
                    await this.loadSettingsSection();
                    break;
            }
        } catch (error) {
            console.error(`Error loading section ${section}:`, error);
            this.showNotification(`Failed to load ${section} section: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Safe loading methods for new sections
    async loadCashSalesSection() {
        try {
            if (this.cashSales && this.cashSales.loadData) {
                await this.cashSales.loadData();
            } else {
                console.log('Cash sales module not available, showing empty state');
                this.renderEmptySection('cash-sales-list', 'Cash Sales');
            }
        } catch (error) {
            console.error('Cash sales loading error:', error);
            this.renderErrorSection('cash-sales-list', 'Cash Sales', error.message);
        }
    }

    async loadSupplierPaymentsSection() {
        try {
            if (this.supplierPayments && this.supplierPayments.loadData) {
                await this.supplierPayments.loadData();
            } else {
                console.log('Supplier payments module not available, showing empty state');
                this.renderEmptySection('supplier-payments-list', 'Supplier Payments');
            }
        } catch (error) {
            console.error('Supplier payments loading error:', error);
            this.renderErrorSection('supplier-payments-list', 'Supplier Payments', error.message);
        }
    }

    async loadExpensesSection() {
        try {
            if (this.expenses && this.expenses.loadData) {
                await this.expenses.loadData();
            } else {
                console.log('Expenses module not available, showing empty state');
                this.renderEmptySection('expenses-list', 'Expenses');
            }
        } catch (error) {
            console.error('Expenses loading error:', error);
            this.renderErrorSection('expenses-list', 'Expenses', error.message);
        }
    }

    async loadDuesRemindersSection() {
        try {
            if (this.duesReminders && this.duesReminders.loadData) {
                await this.duesReminders.loadData();
            } else {
                console.log('Dues reminders module not available, showing empty state');
                this.renderEmptySection('dues-summary-cards', 'Dues & Reminders');
            }
        } catch (error) {
            console.error('Dues reminders loading error:', error);
            this.renderErrorSection('dues-summary-cards', 'Dues & Reminders', error.message);
        }
    }

    async loadReportsSection() {
        try {
            if (this.reports && this.reports.loadData) {
                await this.reports.loadData();
            } else {
                console.log('Reports module loaded - no initial data loading required');
                // Reports module doesn't need to load data initially
            }
        } catch (error) {
            console.error('Reports loading error:', error);
            // Reports section doesn't have a specific container to show errors
            this.showNotification(`Reports section error: ${error.message}`, 'warning');
        }
    }

    renderEmptySection(containerId, sectionName) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-database"></i>
                    <h3>No ${sectionName} Data</h3>
                    <p>This section will show data once you add some records.</p>
                    <p class="text-muted">The database tables are being initialized...</p>
                </div>
            `;
        }
    }

    renderErrorSection(containerId, sectionName, errorMessage) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle text-warning"></i>
                    <h3>Error Loading ${sectionName}</h3>
                    <p class="text-danger">${errorMessage}</p>
                    <button class="btn btn-primary" onclick="app.loadSectionData(app.currentSection)">
                        <i class="fas fa-refresh"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    loadDashboard() {
        this.dashboard.loadData().then(() => {
            this.hideLoading();
        });
    }

    showLoading() {
        this.isLoading = true;
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        this.isLoading = false;
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    showModal(modalHtml) {
        const container = document.getElementById('modal-container');
        container.innerHTML = modalHtml;
        container.classList.add('fade-in');
        document.body.classList.add('modal-open');

        // Make container itself fixed and top-most
        container.style.position = 'fixed';
        container.style.inset = '0';
        container.style.zIndex = '2147483000';
        container.style.display = 'block';

        // Center modal and ensure visibility
        const modalEl = container.querySelector('.modal');
        const contentEl = container.querySelector('.modal-content');
        if (modalEl) {
            modalEl.style.position = 'fixed';
            modalEl.style.inset = '0';
            modalEl.style.width = '100vw';
            modalEl.style.height = '100vh';
            modalEl.style.display = 'flex';
            modalEl.style.alignItems = 'center';
            modalEl.style.justifyContent = 'center';
            modalEl.style.zIndex = '2147483001';
            modalEl.style.overflow = 'auto';
        }
        if (contentEl) {
            contentEl.style.position = 'relative';
            contentEl.style.maxHeight = '90vh';
            contentEl.style.maxWidth = '95vw';
            contentEl.style.overflow = 'auto';
            contentEl.style.zIndex = '2147483002';
        }

        // Scroll overlay to top to ensure the modal is visible
        try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) { window.scrollTo(0, 0); }
        try { if (container && container.firstElementChild) container.firstElementChild.scrollTop = 0; } catch (_) {}

        // Focus the first interactive element in the modal
        setTimeout(() => {
            const firstFocusable = container.querySelector('input, select, textarea, button');
            if (firstFocusable && typeof firstFocusable.focus === 'function') {
                firstFocusable.focus();
            }
        }, 0);

        // Setup modal close handlers
        const closeBtn = container.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
    }

    closeModal() {
        const container = document.getElementById('modal-container');
        container.innerHTML = '';
        container.classList.remove('fade-in');
        document.body.classList.remove('modal-open');
        // Hide container so it does not overlay the app
        container.style.display = 'none';
    }

    showNotification(message, type = 'info', duration = 3000) {
        let host = document.getElementById('notification-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'notification-host';
            host.className = 'notification-host';
            host.setAttribute('aria-live', 'polite');
            document.body.appendChild(host);
        }
        if (type === 'error') host.setAttribute('aria-live', 'assertive');

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        if (type === 'error') notification.setAttribute('role', 'alert');
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close" type="button" aria-label="Close notification">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        host.appendChild(notification);
        requestAnimationFrame(() => notification.classList.add('is-visible'));

        const remove = () => {
            notification.classList.remove('is-visible');
            notification.classList.add('is-leaving');
            setTimeout(() => {
                if (notification.parentNode) notification.remove();
            }, 220);
        };

        if (type !== 'error') {
            setTimeout(() => {
                if (notification.parentNode) remove();
            }, duration);
        }

        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) closeBtn.addEventListener('click', remove);
    }

    refreshCurrentSection() {
        const section = this.currentSection || 'dashboard';
        this.loadSectionData(section);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || icons.info;
    }

    async createBackup() {
        try {
            this.showLoading();
            const result = await window._ipcRenderer.invoke('db-backup');
            this.showNotification('Database backup created successfully!', 'success');
            console.log('Backup created:', result);
        } catch (error) {
            console.error('Backup failed:', error);
            this.showNotification('Failed to create backup: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    showSystemResetConfirm() {
        if (window.auth && !window.auth.isAdmin()) {
            this.showNotification('Admin permission required', 'error');
            return;
        }
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle text-danger"></i> System Reset</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="warning-box">
                            <p><strong>⚠️ WARNING: This action cannot be undone!</strong></p>
                            <p>This will permanently delete:</p>
                            <ul>
                                <li>✗ All customers and their data</li>
                                <li>✗ All products and suppliers</li>
                                <li>✗ All stock items</li>
                                <li>✗ All installment schedules</li>
                                <li>✗ All cash sales records</li>
                                <li>✗ All expenses and payments</li>
                                <li>✗ Complete database file</li>
                            </ul>
                            <p><strong>The system will restart as brand new.</strong></p>
                        </div>
                        <div class="form-group mt-4">
                            <label class="form-label">Type "RESET" to confirm:</label>
                            <input type="text" id="reset-confirmation" class="form-input" placeholder="Type RESET here">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-danger" onclick="app.performSystemReset()" id="reset-confirm-btn" disabled>
                            <i class="fas fa-trash-restore"></i> Reset System
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(modalHtml);
        
        // Enable/disable reset button based on confirmation text
        const confirmInput = document.getElementById('reset-confirmation');
        const resetBtn = document.getElementById('reset-confirm-btn');
        
        if (confirmInput && resetBtn) {
            confirmInput.addEventListener('input', (e) => {
                resetBtn.disabled = e.target.value.toUpperCase() !== 'RESET';
            });
        }
    }

    async performSystemReset() {
        try {
            this.showLoading();
            this.closeModal();
            
            // Show progress notification
            this.showNotification('Resetting system... Please wait.', 'info', 10000);
            
            // Call the database reset via IPC
            await window._ipcRenderer.invoke('db-reset');
            
            // Clear all module data
            if (this.dashboard) this.dashboard.cleanup();
            if (this.products) this.products.cleanup();
            if (this.suppliers) this.suppliers.cleanup();
            if (this.stock) this.stock.cleanup();
            if (this.customers) this.customers.cleanup();
            if (this.installments) this.installments.cleanup();
            
            // Reset UI to dashboard
            this.navigateToSection('dashboard');
            
            this.showNotification('🎉 System reset complete! Database has been recreated fresh.', 'success', 5000);
            
            // Reload the page after a delay
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('System reset failed:', error);
            this.showNotification('Failed to reset system: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadUsersSection() {
        if (window.auth && !window.auth.isAdmin()) return;
        const rows = await window._ipcRenderer.invoke('users-list');
        const body = document.getElementById('users-table-body');
        if (!body) return;
        body.innerHTML = (rows || []).map((u) => `
            <tr>
                <td>${u.username}</td>
                <td>${u.role}</td>
                <td>${u.is_active ? 'Active' : 'Inactive'}</td>
                <td>
                    ${u.id === (window.auth && window.auth.user && window.auth.user.id) ? '' : `
                    <button class="btn btn-sm btn-secondary" onclick="app.setUserActive(${u.id}, ${u.is_active ? 0 : 1})">
                        ${u.is_active ? 'Deactivate' : 'Activate'}
                    </button>`}
                </td>
            </tr>
        `).join('');
    }

    async createUser(formData) {
        if (window.auth) window.auth.requireAdmin();
        const result = await window._ipcRenderer.invoke('users-create', {
            username: formData.get('username'),
            password: formData.get('password'),
            role: formData.get('role')
        });
        if (!result || !result.ok) {
            this.showNotification('Could not create user', 'error');
            return;
        }
        this.showNotification('User created', 'success');
        document.getElementById('create-user-form').reset();
        await this.loadUsersSection();
    }

    async setUserActive(userId, isActive) {
        if (window.auth) window.auth.requireAdmin();
        await window._ipcRenderer.invoke('users-set-active', { userId, isActive: !!isActive });
        await this.loadUsersSection();
    }

    async loadSettingsSection() {
        if (window.auth && !window.auth.isAdmin()) return;
        const settings = await window._ipcRenderer.invoke('shop-settings-get');
        const form = document.getElementById('shop-settings-form');
        if (!form || !settings) return;
        form.shop_name.value = settings.shop_name || '';
        form.phone.value = settings.phone || '';
        form.address.value = settings.address || '';
        form.idle_minutes.value = settings.idle_minutes || 30;
        const drivePath = document.getElementById('drive-folder-path');
        if (drivePath) drivePath.textContent = settings.drive_folder || 'No Drive folder selected.';
        const waInput = document.getElementById('whatsapp-template-input');
        if (waInput) {
            waInput.value = settings.whatsapp_template || 'Assalam-o-Alaikum {name}, account {account}. Due {amount} on {due_date}. {shop}';
        }
        this._shopSettingsCache = settings;
    }

    async backupToFile() {
        try {
            this.showLoading();
            const result = await window._ipcRenderer.invoke('backup-save-dialog');
            if (result && result.ok) this.showNotification('Backup saved', 'success');
        } catch (error) {
            this.showNotification('Backup failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async restoreFromFile() {
        if (window.auth && !window.auth.isAdmin()) {
            this.showNotification('Admin permission required', 'error');
            return;
        }
        if (!window.confirm('Restore will replace the current database. Continue?')) return;
        try {
            this.showLoading();
            const result = await window._ipcRenderer.invoke('restore-open-dialog');
            if (result && result.ok) {
                this.showNotification('Database restored. Reloading…', 'success');
                setTimeout(() => window.location.reload(), 600);
            }
        } catch (error) {
            this.showNotification('Restore failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async pickDriveFolder() {
        if (window.auth) window.auth.requireAdmin();
        const result = await window._ipcRenderer.invoke('drive-folder-pick');
        if (result && result.ok) {
            const drivePath = document.getElementById('drive-folder-path');
            if (drivePath) drivePath.textContent = result.folder;
            this.showNotification('Drive folder saved', 'success');
        }
    }

    async backupToDrive() {
        try {
            this.showLoading();
            const result = await window._ipcRenderer.invoke('drive-backup');
            if (result && result.ok) {
                this.showNotification('Backup copied to Drive folder', 'success');
            } else {
                this.showNotification('Choose a Google Drive folder in Settings first', 'warning');
            }
        } catch (error) {
            this.showNotification('Drive backup failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async restoreFromDrive() {
        if (window.auth && !window.auth.isAdmin()) {
            this.showNotification('Admin permission required', 'error');
            return;
        }
        const files = await window._ipcRenderer.invoke('drive-list');
        if (!files || !files.length) {
            this.showNotification('No ICAM backups found in the Drive folder', 'error');
            return;
        }
        const options = files.map((f, i) => `<option value="${i}">${f.name}</option>`).join('');
        app.showModal(`
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3>Restore from Drive</h3>
                        <button class="modal-close" type="button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>This replaces the current database.</p>
                        <select id="drive-restore-file" class="form-input">${options}</select>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" type="button" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-warning" type="button" id="drive-restore-ok">Restore</button>
                    </div>
                </div>
            </div>
        `);
        const ok = document.getElementById('drive-restore-ok');
        if (ok) {
            ok.addEventListener('click', async () => {
                const select = document.getElementById('drive-restore-file');
                const chosen = files[Number(select && select.value)];
                const filePath = chosen ? chosen.path : '';
                app.closeModal();
                if (!filePath) return;
                try {
                    const result = await window._ipcRenderer.invoke('drive-restore', filePath);
                    if (result && result.ok) {
                        this.showNotification('Database restored. Reloading…', 'success');
                        setTimeout(() => window.location.reload(), 600);
                    }
                } catch (error) {
                    this.showNotification('Restore failed: ' + error.message, 'error');
                }
            });
        }
    }

    async saveWhatsAppTemplate() {
        if (window.auth) window.auth.requireAdmin();
        const form = document.getElementById('shop-settings-form');
        const waInput = document.getElementById('whatsapp-template-input');
        const result = await window._ipcRenderer.invoke('shop-settings-save', {
            shop_name: form ? form.shop_name.value : 'Installment Management',
            phone: form ? form.phone.value : '',
            address: form ? form.address.value : '',
            idle_minutes: form ? form.idle_minutes.value : 30,
            whatsapp_template: waInput ? waInput.value : ''
        });
        if (result && result.ok) this.showNotification('WhatsApp template saved', 'success');
        else this.showNotification('Could not save template', 'error');
    }

    confirmBackupQuit() {
        if (this._quitPromptOpen) return;
        this._quitPromptOpen = true;
        app.showModal(`
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3>Take a backup before exit?</h3>
                        <button class="modal-close" type="button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>A backup protects shop data if this PC fails.</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" type="button" id="quit-no-backup">Exit without backup</button>
                        <button class="btn btn-secondary" type="button" id="quit-backup-file">Backup to file</button>
                        <button class="btn btn-primary" type="button" id="quit-backup-drive">Backup to Drive</button>
                    </div>
                </div>
            </div>
        `);
        const finishQuit = async (action) => {
            this._quitPromptOpen = false;
            app.closeModal();
            try {
                if (action === 'file') await this.backupToFile();
                if (action === 'drive') await this.backupToDrive();
            } catch (_) { /* still quit */ }
            await window._ipcRenderer.invoke('app-quit-now');
        };
        const noBtn = document.getElementById('quit-no-backup');
        const fileBtn = document.getElementById('quit-backup-file');
        const driveBtn = document.getElementById('quit-backup-drive');
        if (noBtn) noBtn.addEventListener('click', () => finishQuit('none'));
        if (fileBtn) fileBtn.addEventListener('click', () => finishQuit('file'));
        if (driveBtn) driveBtn.addEventListener('click', () => finishQuit('drive'));
        const resetPrompt = () => { this._quitPromptOpen = false; };
        const closeBtn = document.querySelector('#modal-container .modal-close');
        if (closeBtn) closeBtn.addEventListener('click', resetPrompt);
        const overlay = document.querySelector('#modal-container .modal');
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) resetPrompt(); });
    }

    async saveShopSettings(formData) {
        if (window.auth) window.auth.requireAdmin();
        const result = await window._ipcRenderer.invoke('shop-settings-save', {
            shop_name: formData.get('shop_name'),
            phone: formData.get('phone'),
            address: formData.get('address'),
            idle_minutes: formData.get('idle_minutes')
        });
        if (!result || !result.ok) {
            this.showNotification('Could not save settings', 'error');
            return;
        }
        if (window.auth) {
            window.auth.shopName = formData.get('shop_name');
            window.auth.idleMinutes = Number(formData.get('idle_minutes')) || 30;
            window.auth.applyRoleGates();
            window.auth.resetIdleTimer();
        }
        this.showNotification('Settings saved', 'success');
    }

    async pickShopLogo() {
        if (window.auth) window.auth.requireAdmin();
        const result = await window._ipcRenderer.invoke('shop-logo-pick');
        if (result && result.ok) this.showNotification('Logo updated', 'success');
    }

    hideGlobalSearch() {
        const box = document.getElementById('global-search-results');
        if (box) {
            box.classList.add('hidden');
            box.innerHTML = '';
        }
    }

    async runGlobalSearch(term) {
        const q = String(term || '').trim();
        const box = document.getElementById('global-search-results');
        if (!box) return;
        if (q.length < 2) {
            this.hideGlobalSearch();
            return;
        }
        try {
            const { customers, stock } = await Database.globalSearch(q);
            const items = [];
            (customers || []).forEach((c) => {
                items.push(`<button type="button" class="global-search-item" data-kind="customer" data-id="${c.id}">
                    <strong>${c.customer_name || c.account_no}</strong>
                    <small>${c.account_no || ''} ${c.phone || ''}</small>
                </button>`);
            });
            (stock || []).forEach((s) => {
                const ident = s.stock_no || s.imei || s.serial_no || s.engine_no || s.chassis_no || s.reg_no || '';
                items.push(`<button type="button" class="global-search-item" data-kind="stock" data-id="${s.id}">
                    <strong>${s.item_name || 'Stock'}</strong>
                    <small>${ident}</small>
                </button>`);
            });
            if (!items.length) {
                box.innerHTML = '<div class="global-search-item">No matches</div>';
            } else {
                box.innerHTML = items.join('');
                box.querySelectorAll('.global-search-item[data-kind]').forEach((btn) => {
                    btn.addEventListener('click', () => this.openGlobalSearchResult(btn.dataset.kind, btn.dataset.id));
                });
            }
            box.classList.remove('hidden');
        } catch (e) {
            console.error('Global search failed:', e);
            this.hideGlobalSearch();
        }
    }

    async openGlobalSearchResult(kind, id) {
        this.hideGlobalSearch();
        const searchInput = document.getElementById('global-search');
        if (searchInput) searchInput.value = '';
        if (kind === 'customer') {
            this.navigateToSection('installments');
            const customer = await Database.get('SELECT * FROM customers WHERE id = ?', [Number(id)]);
            if (customer && this.installments) {
                this.installments.searchResultCustomers = [customer];
                await this.installments.showCustomerDetails(customer);
            }
            return;
        }
        if (kind === 'stock') {
            this.navigateToSection('stock');
            if (this.stock && this.stock.edit) await this.stock.edit(id);
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0
        }).format(amount).replace('PKR', 'Rs.');
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-PK', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(new Date(date));
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    validateForm(form) {
        const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            const value = input.value.trim();
            const errorElement = input.parentNode.querySelector('.form-error');
            
            if (!value) {
                this.showFieldError(input, 'This field is required');
                isValid = false;
            } else {
                this.hideFieldError(input);
            }
        });

        return isValid;
    }

    showFieldError(input, message) {
        input.classList.add('error');
        let errorElement = input.parentNode.querySelector('.form-error');
        
        if (!errorElement) {
            errorElement = document.createElement('span');
            errorElement.className = 'form-error';
            input.parentNode.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
    }

    hideFieldError(input) {
        input.classList.remove('error');
        const errorElement = input.parentNode.querySelector('.form-error');
        if (errorElement) {
            errorElement.remove();
        }
    }

    cleanup() {
        // Cleanup before window closes
        if (this.dashboard) this.dashboard.cleanup();
        if (this.products) this.products.cleanup();
        if (this.suppliers) this.suppliers.cleanup();
        if (this.stock) this.stock.cleanup();
        if (this.customers) this.customers.cleanup();
        if (this.installments) this.installments.cleanup();
    }
}

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    if (window.app && typeof app.showNotification === 'function') {
        app.showNotification('An unexpected error occurred', 'error');
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    if (window.app && typeof app.showNotification === 'function') {
        app.showNotification('An unexpected error occurred', 'error');
    }
});

// Initialize application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
    // Make app globally available
    window.app = app;
});

// Export for other modules
window.App = App;