// Supplier Payment Management Module

class SupplierPaymentsManager {
    constructor() {
        this.supplierPayments = [];
        this.suppliers = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('add-supplier-payment-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openAddPaymentModal());
        }
    }

    async loadData() {
        try {
            app.showLoading();
            this.suppliers = await Database.getSuppliersWithBalance();
            this.supplierPayments = await Database.getSupplierPayments();
            this.renderSupplierPayments();
        } catch (error) {
            console.error('Error loading supplier payments data:', error);
            app.showNotification('Failed to load supplier payments data', 'error');
        } finally {
            app.hideLoading();
        }
    }

    renderSupplierPayments() {
        const container = document.getElementById('supplier-payments-list');
        if (!container) return;

        if (this.supplierPayments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-credit-card"></i>
                    <h3>No Supplier Payments Found</h3>
                    <p>Start by recording your first payment to a supplier.</p>
                    <button class="btn btn-primary" onclick="app.supplierPayments.openAddPaymentModal()">
                        <i class="fas fa-plus"></i> Add Payment
                    </button>
                </div>
            `;
            return;
        }

        const table = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Supplier</th>
                            <th>Amount</th>
                            <th>Payment Method</th>
                            <th>Reference No</th>
                            <th>Notes</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.supplierPayments.map(payment => `
                            <tr class="stagger-item">
                                <td>${Utils.formatDate(payment.payment_date)}</td>
                                <td>${payment.supplier_name}</td>
                                <td>${Utils.formatCurrency(payment.amount)}</td>
                                <td>${Utils.capitalizeWords(payment.payment_method || 'cash')}</td>
                                <td>${payment.reference_no || '-'}</td>
                                <td>${payment.notes || '-'}</td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn btn-sm btn-info" onclick="app.supplierPayments.printReceipt(${payment.id})">
                                            <i class="fas fa-print"></i> Receipt
                                        </button>
                                        <button class="btn btn-sm btn-primary" onclick="app.supplierPayments.editPayment(${payment.id})">
                                            <i class="fas fa-edit"></i> Edit
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

        // Also render supplier balances summary
        this.renderSupplierBalances();
    }

    renderSupplierBalances() {
        const container = document.getElementById('supplier-balances-summary');
        if (!container || !this.suppliers) return;

        const balanceCards = this.suppliers.map(supplier => `
            <div class="supplier-balance-card">
                <div class="supplier-info">
                    <h4>${supplier.supplier_name}</h4>
                    <div class="balance ${supplier.balance >= 0 ? 'positive' : 'negative'}">
                        <span class="label">Balance:</span>
                        <span class="amount">${Utils.formatCurrency(Math.abs(supplier.balance || 0))}</span>
                        <span class="type">${supplier.balance >= 0 ? 'Credit' : 'Debit'}</span>
                    </div>
                </div>
                <div class="supplier-actions">
                    ${supplier.balance > 0 ? `
                        <button class="btn btn-sm btn-warning" onclick="app.supplierPayments.paySupplier(${supplier.id})">
                            <i class="fas fa-money-bill"></i> Pay
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-info" onclick="app.supplierPayments.viewSupplierHistory(${supplier.id})">
                        <i class="fas fa-history"></i> History
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="supplier-balances">
                <h3>Supplier Balances</h3>
                <div class="balance-cards">
                    ${balanceCards}
                </div>
            </div>
        `;
    }

    async openAddPaymentModal() {
        // Ensure suppliers are loaded before opening modal
        if (!this.suppliers || this.suppliers.length === 0) {
            try {
                app.showLoading();
                this.suppliers = await Database.getSuppliersWithBalance();
            } catch (error) {
                console.error('Error loading suppliers:', error);
                app.showNotification('Failed to load suppliers. Please try again.', 'error');
                return;
            } finally {
                app.hideLoading();
            }
        }
        
        if (this.suppliers.length === 0) {
            app.showNotification('No suppliers found. Please add suppliers first.', 'warning');
            return;
        }
        
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h3><i class="fas fa-credit-card"></i> Pay Supplier</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="supplier-payment-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Supplier</label>
                                <select name="supplier_id" class="form-input" required onchange="app.supplierPayments.onSupplierSelected(this)">
                                    <option value="">Select Supplier</option>
                                    ${this.suppliers.map(supplier => `
                                        <option value="${supplier.id}" data-balance="${supplier.balance || 0}">
                                            ${supplier.supplier_name} 
                                            ${supplier.balance ? `(Balance: ${Utils.formatCurrency(Math.abs(supplier.balance))})` : ''}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Current Balance</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="text" id="current_balance" class="form-input" readonly>
                                </div>
                                <small class="form-hint" id="balance_hint">Select a supplier to see their current balance</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Payment Date</label>
                                <input type="date" name="payment_date" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Payment Amount</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="amount" class="form-input" required min="1" step="0.01">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Payment Method</label>
                                <select name="payment_method" class="form-input">
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="check">Check</option>
                                    <option value="card">Card</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Reference No</label>
                                <input type="text" name="reference_no" class="form-input" placeholder="Transaction/Check/Reference number">
                            </div>
                            <div class="form-group form-grid-full">
                                <label class="form-label">Notes</label>
                                <textarea name="notes" class="form-input" rows="3" placeholder="Additional notes about this payment"></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-success" onclick="app.supplierPayments.savePayment()">
                            <i class="fas fa-save"></i> Record Payment
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
    }

    paySupplier(supplierId) {
        const supplier = this.suppliers.find(s => s.id === supplierId);
        if (!supplier) return;

        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-money-bill"></i> Pay ${supplier.supplier_name}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-grid">
                            <div class="detail-item"><label>Supplier</label><span>${supplier.supplier_name}</span></div>
                            <div class="detail-item"><label>Current Balance</label><span>${Utils.formatCurrency(Math.abs(supplier.balance || 0))}</span></div>
                        </div>
                        <form id="quick-payment-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Payment Amount</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="amount" class="form-input" required min="1" step="0.01" value="${Math.abs(supplier.balance || 0)}">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Payment Date</label>
                                <input type="date" name="payment_date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Payment Method</label>
                                <select name="payment_method" class="form-input">
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="check">Check</option>
                                    <option value="card">Card</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-success" onclick="app.supplierPayments.saveQuickPayment(${supplierId})">
                            <i class="fas fa-check"></i> Pay
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
    }

    onSupplierSelected(selectElement) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        const balanceField = document.getElementById('current_balance');
        const balanceHint = document.getElementById('balance_hint');
        
        if (selectedOption && selectedOption.dataset.balance !== undefined) {
            const balance = parseFloat(selectedOption.dataset.balance) || 0;
            balanceField.value = Utils.formatCurrency(Math.abs(balance));
            balanceHint.textContent = balance > 0 ? 'This supplier has an outstanding balance' : 'This supplier has a credit balance';
            balanceHint.className = `form-hint ${balance > 0 ? 'text-warning' : 'text-success'}`;
        } else {
            balanceField.value = '';
            balanceHint.textContent = 'Select a supplier to see their current balance';
            balanceHint.className = 'form-hint';
        }
    }

    async savePayment() {
        const form = document.getElementById('supplier-payment-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const payment = {
            supplier_id: parseInt(formData.get('supplier_id')),
            amount: parseFloat(formData.get('amount')),
            payment_date: formData.get('payment_date'),
            payment_method: formData.get('payment_method'),
            reference_no: formData.get('reference_no'),
            notes: formData.get('notes')
        };

        try {
            app.showLoading();
            await Database.addSupplierPayment(payment);
            app.showNotification('Payment recorded successfully', 'success');
            app.closeModal();
            await this.loadData(); // Refresh the list
        } catch (error) {
            console.error('Error saving supplier payment:', error);
            app.showNotification('Failed to record payment', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async saveQuickPayment(supplierId) {
        const form = document.getElementById('quick-payment-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const payment = {
            supplier_id: supplierId,
            amount: parseFloat(formData.get('amount')),
            payment_date: formData.get('payment_date'),
            payment_method: formData.get('payment_method'),
            reference_no: '',
            notes: 'Quick payment'
        };

        try {
            app.showLoading();
            await Database.addSupplierPayment(payment);
            app.showNotification('Payment recorded successfully', 'success');
            app.closeModal();
            await this.loadData(); // Refresh the list
        } catch (error) {
            console.error('Error saving supplier payment:', error);
            app.showNotification('Failed to record payment', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async printReceipt(paymentId) {
        try {
            const payment = this.supplierPayments.find(p => p.id === paymentId);
            if (!payment) {
                app.showNotification('Payment not found', 'error');
                return;
            }

            const win = window.open('', '_blank');
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Supplier Payment Receipt - ${payment.id}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h2 { margin-bottom: 20px; text-align: center; }
                        .receipt-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                        .receipt-details { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        .receipt-details td, .receipt-details th { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        .receipt-details th { background: #f5f5f5; font-weight: bold; }
                        .total-row { background: #e8f4f8; font-weight: bold; }
                        .print-thanks { text-align: center; margin-top: 40px; font-size: 12px; }
                        ${Utils.developerCreditCss()}
                    </style>
                </head>
                <body>
                    <h2>SUPPLIER PAYMENT RECEIPT</h2>
                    <div class="receipt-header">
                        <div><strong>Receipt #:</strong> SP-${payment.id.toString().padStart(6, '0')}</div>
                        <div><strong>Date:</strong> ${Utils.formatDate(payment.payment_date, 'readable')}</div>
                    </div>
                    <table class="receipt-details">
                        <tr><th>Supplier</th><td>${payment.supplier_name}</td></tr>
                        <tr><th>Payment Amount</th><td>${Utils.formatCurrency(payment.amount)}</td></tr>
                        <tr><th>Payment Method</th><td>${Utils.capitalizeWords(payment.payment_method || 'cash')}</td></tr>
                        ${payment.reference_no ? `<tr><th>Reference No</th><td>${payment.reference_no}</td></tr>` : ''}
                        <tr class="total-row"><th>Payment Date</th><td>${Utils.formatDate(payment.payment_date, 'readable')}</td></tr>
                    </table>
                    ${payment.notes ? `<p><strong>Notes:</strong> ${payment.notes}</p>` : ''}
                    <p class="print-thanks">Payment processed successfully</p>
                    ${Utils.developerCreditHtml()}
                </body>
                </html>
            `;
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 300);
        } catch (error) {
            console.error('Error printing receipt:', error);
            app.showNotification('Failed to print receipt', 'error');
        }
    }

    editPayment(paymentId) {
        const payment = this.supplierPayments.find(p => p.id === paymentId);
        if (!payment) return;

        // Implementation for editing supplier payment would go here
        app.showNotification('Edit functionality not yet implemented', 'info');
    }

    viewSupplierHistory(supplierId) {
        const supplier = this.suppliers.find(s => s.id === supplierId);
        if (!supplier) return;

        // Implementation for viewing supplier payment history would go here
        app.showNotification('Supplier history view not yet implemented', 'info');
    }

    cleanup() {
        this.supplierPayments = [];
        this.suppliers = [];
    }
}

window.SupplierPaymentsManager = SupplierPaymentsManager;
