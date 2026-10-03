// Cash Sales Management Module

class CashSalesManager {
    constructor() {
        this.cashSales = [];
        this.customers = [];
        this.availableStock = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('add-cash-sale-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openAddCashSaleModal());
        }
    }

    async loadData() {
        try {
            app.showLoading();
            this.customers = await Database.getCustomers();
            this.availableStock = await Database.getAvailableStock();
            this.cashSales = await Database.getCashSales();
            this.renderCashSales();
        } catch (error) {
            console.error('Error loading cash sales data:', error);
            app.showNotification('Failed to load cash sales data', 'error');
        } finally {
            app.hideLoading();
        }
    }

    renderCashSales() {
        const container = document.getElementById('cash-sales-list');
        if (!container) return;

        if (this.cashSales.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <h3>No Cash Sales Found</h3>
                    <p>Start by recording your first cash sale transaction.</p>
                    <button class="btn btn-primary" onclick="app.cashSales.openAddCashSaleModal()">
                        <i class="fas fa-plus"></i> Add Cash Sale
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
                            <th>Customer</th>
                            <th>Item</th>
                            <th>Identifier</th>
                            <th>Agreed Price</th>
                            <th>Received</th>
                            <th>Due Amount</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.cashSales.map(sale => `
                            <tr class="stagger-item">
                                <td>${Utils.formatDate(sale.sale_date)}</td>
                                <td>${sale.customer_name || 'Walk-in Customer'}</td>
                                <td>${sale.item_name}</td>
                                <td>${Utils.stockIdentifier(sale).value}</td>
                                <td>${Utils.formatCurrency(sale.agreed_price)}</td>
                                <td>${Utils.formatCurrency(sale.received_price)}</td>
                                <td>${Utils.formatCurrency(sale.due_amount || 0)}</td>
                                <td>
                                    <span class="status-badge ${sale.payment_status}">
                                        ${Utils.capitalizeWords(sale.payment_status)}
                                    </span>
                                </td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn btn-sm btn-info" onclick="app.cashSales.printInvoice(${sale.id})">
                                            <i class="fas fa-print"></i> Invoice
                                        </button>
                                        ${sale.due_amount > 0 ? `
                                            <button class="btn btn-sm btn-warning" onclick="app.cashSales.collectDues(${sale.id})">
                                                <i class="fas fa-money-bill"></i> Collect Dues
                                            </button>
                                        ` : ''}
                                        <button class="btn btn-sm btn-primary" onclick="app.cashSales.editCashSale(${sale.id})">
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
    }

    openAddCashSaleModal() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h3><i class="fas fa-shopping-cart"></i> Record Cash Sale</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="cash-sale-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Sale Date</label>
                                <input type="date" name="sale_date" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Customer (Optional)</label>
                                <select name="customer_id" class="form-input">
                                    <option value="">Walk-in Customer</option>
                                    ${this.customers.map(customer => `
                                        <option value="${customer.id}">${customer.customer_name || customer.account_no} - ${customer.cnic_no}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Item from Stock</label>
                                <select name="stock_id" class="form-input" required onchange="app.cashSales.onStockSelected(this)">
                                    <option value="">Select Item</option>
                                    ${this.availableStock.map(item => `
                                         <option value="${item.id}" data-price="${item.current_price}">${item.item_name} - ${Utils.stockIdentifier(item).label}: ${Utils.stockIdentifier(item).value}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Agreed Price</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="agreed_price" id="agreed_price" class="form-input" required min="1" step="0.01">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Received Price</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="received_price" id="received_price" class="form-input" required min="0" step="0.01" onchange="app.cashSales.calculateDues()">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Due Amount</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" id="due_amount" class="form-input" readonly>
                                </div>
                                <small class="form-hint">Calculated automatically based on agreed vs received price</small>
                            </div>
                            <div class="form-group form-grid-full">
                                <label class="form-label">Notes</label>
                                <textarea name="notes" class="form-input" rows="3" placeholder="Additional notes about this sale"></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-success" onclick="app.cashSales.saveCashSale()">
                            <i class="fas fa-save"></i> Record Sale
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
    }

    onStockSelected(selectElement) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        if (selectedOption && selectedOption.dataset.price) {
            document.getElementById('agreed_price').value = selectedOption.dataset.price;
            this.calculateDues();
        }
    }

    calculateDues() {
        const agreedPrice = parseFloat(document.getElementById('agreed_price').value) || 0;
        const receivedPrice = parseFloat(document.getElementById('received_price').value) || 0;
        const dueAmount = Math.max(0, agreedPrice - receivedPrice);
        document.getElementById('due_amount').value = dueAmount.toFixed(2);
    }

    async saveCashSale() {
        const form = document.getElementById('cash-sale-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const cashSale = {
            sale_date: formData.get('sale_date'),
            customer_id: formData.get('customer_id') || null,
            stock_id: parseInt(formData.get('stock_id')),
            agreed_price: parseFloat(formData.get('agreed_price')),
            received_price: parseFloat(formData.get('received_price')),
            notes: formData.get('notes'),
            due_amount: Math.max(0, parseFloat(formData.get('agreed_price')) - parseFloat(formData.get('received_price'))),
            payment_status: Math.max(0, parseFloat(formData.get('agreed_price')) - parseFloat(formData.get('received_price'))) > 0 ? 'partial' : 'completed'
        };

        try {
            app.showLoading();
            await Database.addCashSale(cashSale);
            app.showNotification('Cash sale recorded successfully', 'success');
            app.closeModal();
            await this.loadData(); // Refresh the list
        } catch (error) {
            console.error('Error saving cash sale:', error);
            app.showNotification('Failed to record cash sale', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async printInvoice(cashSaleId) {
        try {
            const sale = this.cashSales.find(s => s.id === cashSaleId);
            if (!sale) {
                app.showNotification('Sale not found', 'error');
                return;
            }

            const win = window.open('', '_blank');
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Cash Sale Invoice - ${sale.id}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h2 { margin-bottom: 20px; text-align: center; }
                        .invoice-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                        .invoice-details { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        .invoice-details td, .invoice-details th { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        .invoice-details th { background: #f5f5f5; font-weight: bold; }
                        .total-row { background: #e8f4f8; font-weight: bold; }
                        .print-thanks { text-align: center; margin-top: 40px; font-size: 12px; }
                        ${Utils.developerCreditCss()}
                    </style>
                </head>
                <body>
                    <h2>CASH SALE INVOICE</h2>
                    <div class="invoice-header">
                        <div><strong>Invoice #:</strong> CS-${sale.id.toString().padStart(6, '0')}</div>
                        <div><strong>Date:</strong> ${Utils.formatDate(sale.sale_date, 'readable')}</div>
                    </div>
                    <table class="invoice-details">
                        <tr><th>Customer</th><td>${sale.customer_name || 'Walk-in Customer'}</td></tr>
                        <tr><th>Item</th><td>${sale.item_name}</td></tr>
                        <tr><th>${Utils.stockIdentifier(sale).label}</th><td>${Utils.stockIdentifier(sale).value}</td></tr>
                        <tr><th>Agreed Price</th><td>${Utils.formatCurrency(sale.agreed_price)}</td></tr>
                        <tr><th>Amount Received</th><td>${Utils.formatCurrency(sale.received_price)}</td></tr>
                        ${sale.due_amount > 0 ? `<tr><th style="color: red;">Due Amount</th><td style="color: red;">${Utils.formatCurrency(sale.due_amount)}</td></tr>` : ''}
                        <tr class="total-row"><th>Status</th><td>${Utils.capitalizeWords(sale.payment_status)}</td></tr>
                    </table>
                    ${sale.notes ? `<p><strong>Notes:</strong> ${sale.notes}</p>` : ''}
                    <p class="print-thanks">Thank you for your business!</p>
                    ${Utils.developerCreditHtml()}
                </body>
                </html>
            `;
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 300);
        } catch (error) {
            console.error('Error printing invoice:', error);
            app.showNotification('Failed to print invoice', 'error');
        }
    }

    collectDues(cashSaleId) {
        const sale = this.cashSales.find(s => s.id === cashSaleId);
        if (!sale) return;

        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-money-bill"></i> Collect Dues</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-grid">
                            <div class="detail-item"><label>Customer</label><span>${sale.customer_name || 'Walk-in Customer'}</span></div>
                            <div class="detail-item"><label>Item</label><span>${sale.item_name}</span></div>
                            <div class="detail-item"><label>Due Amount</label><span>${Utils.formatCurrency(sale.due_amount)}</span></div>
                        </div>
                        <form id="collect-dues-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Amount to Collect</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="amount" class="form-input" required min="1" step="0.01" max="${sale.due_amount}" value="${sale.due_amount}">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Collection Date</label>
                                <input type="date" name="collection_date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-success" onclick="app.cashSales.saveDueCollection(${cashSaleId})">
                            <i class="fas fa-check"></i> Collect
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
    }

    async saveDueCollection(cashSaleId) {
        const form = document.getElementById('collect-dues-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const amount = parseFloat(formData.get('amount'));

        try {
            app.showLoading();
            await Database.collectCashSaleDues(cashSaleId, amount);
            app.showNotification('Dues collected successfully', 'success');
            app.closeModal();
            await this.loadData(); // Refresh the list
        } catch (error) {
            console.error('Error collecting dues:', error);
            app.showNotification('Failed to collect dues', 'error');
        } finally {
            app.hideLoading();
        }
    }

    editCashSale(cashSaleId) {
        const sale = this.cashSales.find(s => s.id === cashSaleId);
        if (!sale) return;

        // Implementation for editing cash sale would go here
        app.showNotification('Edit functionality not yet implemented', 'info');
    }

    cleanup() {
        this.cashSales = [];
        this.customers = [];
        this.availableStock = [];
    }
}

window.CashSalesManager = CashSalesManager;