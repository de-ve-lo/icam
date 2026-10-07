// Dues and Reminders Management Module

class DuesRemindersManager {
    constructor() {
        this.installmentDues = [];
        this.cashSaleDues = [];
        this.overdueItems = [];
        this.currentTab = 'installment-dues';
        this.setupEventListeners();
    }

    setupEventListeners() {
        const sendRemindersBtn = document.getElementById('send-reminders-btn');
        if (sendRemindersBtn) {
            sendRemindersBtn.addEventListener('click', () => this.sendReminders());
        }

        const refreshBtn = document.getElementById('refresh-dues-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }

        // Tab navigation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn') && e.target.closest('.dues-tabs')) {
                this.switchTab(e.target.dataset.tab);
            }
        });
    }

    async loadData() {
        try {
            app.showLoading();
            
            // Load all dues data with better error handling
            console.log('Loading dues data...');
            this.installmentDues = await Database.getInstallmentDues() || [];
            console.log('Installment dues loaded:', this.installmentDues.length);
            
            this.cashSaleDues = await Database.getCashSaleDues() || [];
            console.log('Cash sale dues loaded:', this.cashSaleDues.length);
            
            this.overdueItems = await Database.getOverdueItems() || [];
            console.log('Overdue items loaded:', this.overdueItems.length);
            
            this.renderSummaryCards();
            this.renderCurrentTab();
            
        } catch (error) {
            console.error('Error loading dues data:', error);
            app.showNotification(`Failed to load dues data: ${error.message}`, 'error');
            
            // Set empty arrays as fallback
            this.installmentDues = [];
            this.cashSaleDues = [];
            this.overdueItems = [];
            this.renderSummaryCards();
            this.renderCurrentTab();
        } finally {
            app.hideLoading();
        }
    }

    renderSummaryCards() {
        const container = document.getElementById('dues-summary-cards');
        if (!container) return;

        const totalInstallmentDues = this.installmentDues.reduce((sum, item) => sum + (item.remaining_amount || 0), 0);
        const totalCashSaleDues = this.cashSaleDues.reduce((sum, item) => sum + (item.due_amount || 0), 0);
        const totalOverdue = this.overdueItems.reduce((sum, item) => sum + (item.amount || 0), 0);

        const cards = `
            <div class="summary-cards-grid">
                <div class="summary-card installment-dues">
                    <div class="card-icon">
                        <i class="fas fa-credit-card"></i>
                    </div>
                    <div class="card-content">
                        <h4>Installment Dues</h4>
                        <p class="amount">${Utils.formatCurrency(totalInstallmentDues)}</p>
                        <p class="count">${this.installmentDues.length} customers</p>
                    </div>
                </div>
                
                <div class="summary-card cash-dues">
                    <div class="card-icon">
                        <i class="fas fa-shopping-cart"></i>
                    </div>
                    <div class="card-content">
                        <h4>Cash Sale Dues</h4>
                        <p class="amount">${Utils.formatCurrency(totalCashSaleDues)}</p>
                        <p class="count">${this.cashSaleDues.length} transactions</p>
                    </div>
                </div>
                
                <div class="summary-card overdue">
                    <div class="card-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="card-content">
                        <h4>Overdue Amount</h4>
                        <p class="amount text-danger">${Utils.formatCurrency(totalOverdue)}</p>
                        <p class="count">${this.overdueItems.length} items</p>
                    </div>
                </div>
                
                <div class="summary-card total">
                    <div class="card-icon">
                        <i class="fas fa-calculator"></i>
                    </div>
                    <div class="card-content">
                        <h4>Total Dues</h4>
                        <p class="amount">${Utils.formatCurrency(totalInstallmentDues + totalCashSaleDues)}</p>
                        <p class="count">All outstanding</p>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = cards;
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.dues-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.dues-tabs .tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        
        this.renderCurrentTab();
    }

    renderCurrentTab() {
        switch (this.currentTab) {
            case 'installment-dues':
                this.renderInstallmentDues();
                break;
            case 'cash-sale-dues':
                this.renderCashSaleDues();
                break;
            case 'overdue':
                this.renderOverdueItems();
                break;
        }
    }

    renderInstallmentDues() {
        const container = document.getElementById('installment-dues-list');
        if (!container) return;

        if (this.installmentDues.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <h3>No Installment Dues</h3>
                    <p>All installments are up to date!</p>
                </div>
            `;
            return;
        }

        const table = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Account No</th>
                            <th>Phone</th>
                            <th>Item</th>
                            <th>Due Date</th>
                            <th>Amount Due</th>
                            <th>Days Overdue</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.installmentDues.map(due => `
                            <tr class="stagger-item ${due.days_overdue > 0 ? 'row-overdue' : ''}">
                                <td><strong>${due.customer_name || 'N/A'}</strong></td>
                                <td>${due.account_no}</td>
                                <td>${due.phone}</td>
                                <td>${due.item_name}</td>
                                <td>${Utils.formatDate(due.due_date)}</td>
                                <td><strong>${Utils.formatCurrency(due.remaining_amount)}</strong></td>
                                <td>${due.days_overdue > 0 ? `<span class="text-danger">${due.days_overdue} days</span>` : '<span class="text-success">On time</span>'}</td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn btn-sm btn-warning" onclick="app.duesReminders.sendSingleReminder('installment', ${due.customer_id})">
                                            <i class="fas fa-bell"></i> Remind
                                        </button>
                                        <button class="btn btn-sm btn-primary" onclick="app.duesReminders.viewInstallmentDetails(${due.customer_id})">
                                            <i class="fas fa-eye"></i> View
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = table;
    }

    renderCashSaleDues() {
        const container = document.getElementById('cash-sale-dues-list');
        if (!container) return;

        if (this.cashSaleDues.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <h3>No Cash Sale Dues</h3>
                    <p>All cash sales are fully paid!</p>
                </div>
            `;
            return;
        }

        const table = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Sale Date</th>
                            <th>Customer</th>
                            <th>Phone</th>
                            <th>Item</th>
                            <th>Agreed Price</th>
                            <th>Received</th>
                            <th>Due Amount</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.cashSaleDues.map(due => `
                            <tr class="stagger-item">
                                <td>${Utils.formatDate(due.sale_date)}</td>
                                <td>${due.customer_name || 'Walk-in Customer'}</td>
                                <td>${due.phone || 'N/A'}</td>
                                <td>${due.item_name}</td>
                                <td>${Utils.formatCurrency(due.agreed_price)}</td>
                                <td>${Utils.formatCurrency(due.received_price)}</td>
                                <td><strong>${Utils.formatCurrency(due.due_amount)}</strong></td>
                                <td>
                                    <div class="action-buttons">
                                        ${due.customer_id ? `
                                            <button class="btn btn-sm btn-warning" onclick="app.duesReminders.sendSingleReminder('cash_sale', ${due.customer_id})">
                                                <i class="fas fa-bell"></i> Remind
                                            </button>
                                        ` : ''}
                                        <button class="btn btn-sm btn-success" onclick="app.duesReminders.collectCashDues(${due.id})">
                                            <i class="fas fa-money-bill"></i> Collect
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = table;
    }

    renderOverdueItems() {
        const container = document.getElementById('overdue-dues-list');
        if (!container) return;

        if (this.overdueItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-thumbs-up"></i>
                    <h3>No Overdue Items</h3>
                    <p>Excellent! All payments are current.</p>
                </div>
            `;
            return;
        }

        const table = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Customer</th>
                            <th>Phone</th>
                            <th>Due Date</th>
                            <th>Amount</th>
                            <th>Days Overdue</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.overdueItems.map(item => `
                            <tr class="stagger-item row-overdue">
                                <td>
                                    <span class="type-badge ${item.type}">
                                        <i class="fas fa-${item.type === 'installment' ? 'credit-card' : 'shopping-cart'}"></i>
                                        ${Utils.capitalizeWords(item.type)}
                                    </span>
                                </td>
                                <td><strong>${item.customer_name || 'Walk-in Customer'}</strong></td>
                                <td>${item.phone || 'N/A'}</td>
                                <td>${Utils.formatDate(item.due_date)}</td>
                                <td><strong class="text-danger">${Utils.formatCurrency(item.amount)}</strong></td>
                                <td><span class="text-danger"><strong>${item.days_overdue} days</strong></span></td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn btn-sm btn-danger" onclick="app.duesReminders.sendUrgentReminder('${item.type}', ${item.customer_id || item.id})">
                                            <i class="fas fa-exclamation-triangle"></i> Urgent
                                        </button>
                                        <button class="btn btn-sm btn-primary" onclick="app.duesReminders.viewDetails('${item.type}', ${item.id})">
                                            <i class="fas fa-eye"></i> Details
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = table;
    }

    async sendReminders() {
        const totalDues = this.installmentDues.length + this.cashSaleDues.length;
        
        if (totalDues === 0) {
            app.showNotification('No dues to send reminders for', 'info');
            return;
        }

        const confirmed = confirm(`Send reminders to ${totalDues} customers with outstanding dues?`);
        if (!confirmed) return;

        try {
            app.showLoading();
            
            // In a real implementation, this would send SMS/email reminders
            // For now, we'll just simulate the process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            app.showNotification(`Reminders sent to ${totalDues} customers successfully`, 'success');
        } catch (error) {
            console.error('Error sending reminders:', error);
            app.showNotification('Failed to send reminders', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async sendSingleReminder(type, customerId) {
        try {
            app.showLoading();
            
            // Simulate sending reminder
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            app.showNotification('Reminder sent successfully', 'success');
        } catch (error) {
            console.error('Error sending reminder:', error);
            app.showNotification('Failed to send reminder', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async sendUrgentReminder(type, id) {
        try {
            app.showLoading();
            
            // Simulate sending urgent reminder
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            app.showNotification('Urgent reminder sent successfully', 'success');
        } catch (error) {
            console.error('Error sending urgent reminder:', error);
            app.showNotification('Failed to send urgent reminder', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async viewInstallmentDetails(customerId) {
        try {
            if (typeof app.navigateToSection === 'function') {
                app.navigateToSection('installments', { force: true });
            }
            const customer = await Database.get('SELECT * FROM customers WHERE id = ?', [Number(customerId)]);
            if (!customer) {
                app.showNotification('Customer not found', 'error');
                return;
            }
            if (app.installments && typeof app.installments.showCustomerDetails === 'function') {
                await app.installments.showCustomerDetails(customer);
            }
        } catch (error) {
            console.error('Error opening installment details:', error);
            app.showNotification(`Failed to open customer schedule: ${error.message}`, 'error');
        }
    }

    collectCashDues(cashSaleId) {
        if (app.cashSales) {
            app.cashSales.collectDues(cashSaleId);
        }
    }

    async viewDetails(type, id) {
        if (type === 'installment') {
            const row = this.overdueItems.find((item) => item.type === 'installment' && Number(item.id) === Number(id));
            const customerId = row && row.customer_id ? row.customer_id : id;
            await this.viewInstallmentDetails(customerId);
            return;
        }
        if (type === 'cash_sale') {
            if (typeof app.navigateToSection === 'function') {
                app.navigateToSection('cash-sales', { force: true });
            }
            if (app.cashSales && typeof app.cashSales.collectDues === 'function') {
                app.cashSales.collectDues(id);
            }
        }
    }

    cleanup() {
        this.installmentDues = [];
        this.cashSaleDues = [];
        this.overdueItems = [];
        this.currentTab = 'installment-dues';
    }
}

window.DuesRemindersManager = DuesRemindersManager;