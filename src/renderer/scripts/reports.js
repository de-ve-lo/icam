// Enhanced Reports Management Module

class ReportsManager {
    constructor() {
        if (typeof document !== 'undefined') {
            this.setupEventListeners();
        }
    }
    
    // Safe fallback methods in case app object doesn't exist
    safeShowLoading() {
        if (typeof app !== 'undefined' && app.showLoading) {
            app.showLoading();
        } else {
            console.log('Loading...');
        }
    }
    
    safeHideLoading() {
        if (typeof app !== 'undefined' && app.hideLoading) {
            app.hideLoading();
        } else {
            console.log('Loading complete');
        }
    }
    
    safeShowNotification(message, type = 'info') {
        if (typeof app !== 'undefined' && app.showNotification) {
            app.showNotification(message, type);
        } else {
            if (type === 'error') {
                alert(`Error: ${message}`);
            } else {
                console.log(`${type.toUpperCase()}: ${message}`);
            }
        }
    }
    
    // Safe Utils fallbacks
    safeFormatCurrency(amount) {
        if (typeof Utils !== 'undefined' && Utils.formatCurrency) {
            return Utils.formatCurrency(amount);
        }
        return `Rs. ${(amount || 0).toFixed(2)}`;
    }
    
    safeFormatDate(date) {
        if (typeof Utils !== 'undefined' && Utils.formatDate) {
            return Utils.formatDate(date);
        }
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString();
    }

    setupEventListeners() {
        // Set up date range controls
        this.setupDateRangeControls();
        // Bind helpers for date range modal interactions
        window.reports = this;
    }

    setupDateRangeControls() {
        // Set default dates
        const startDateInput = document.getElementById('reports-start-date');
        const endDateInput = document.getElementById('reports-end-date');
        const quickSelectInput = document.getElementById('reports-quick-select');
        const resetBtn = document.getElementById('reset-date-range-btn');

        if (startDateInput && endDateInput) {
            // Set default to current month
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            startDateInput.value = this.formatDateForInput(firstDayOfMonth);
            endDateInput.value = this.formatDateForInput(lastDayOfMonth);
        }

        // Quick select handler
        if (quickSelectInput) {
            quickSelectInput.addEventListener('change', (e) => {
                this.handleQuickDateSelect(e.target.value);
            });
        }

        // Reset button handler
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetDateRange();
            });
        }
    }

    formatDateForInput(date) {
        if (typeof Utils !== 'undefined' && Utils.toLocalDateString) {
            return Utils.toLocalDateString(date);
        }
        const d = date instanceof Date ? date : new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    static sumPaymentsInRange(payments, start, end) {
        return (payments || [])
            .filter((p) => (p.type || 'payment') === 'payment'
                && p.payment_date >= start && p.payment_date <= end)
            .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    }

    getLocalRange() {
        const startEl = document.getElementById('reports-start-date');
        const endEl = document.getElementById('reports-end-date');
        const now = new Date();
        const start = (startEl && startEl.value) || this.formatDateForInput(new Date(now.getFullYear(), now.getMonth(), 1));
        const end = (endEl && endEl.value) || this.formatDateForInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        return { start, end };
    }

    async loadCollectionFromPayments(start, end) {
        return await this.safeQuery(`
            SELECT payment_date, amount, type, customer_id, installment_id, receipt_no
            FROM payments
            WHERE DATE(payment_date) BETWEEN DATE(?) AND DATE(?)
              AND (is_deleted = 0 OR is_deleted IS NULL)
        `, [start, end], []);
    }

    async getShopName() {
        try {
            const row = await Database.get('SELECT shop_name FROM shop_settings WHERE id = 1');
            this._shopName = (row && row.shop_name) || 'Installment Management';
            return this._shopName;
        } catch (e) {
            this._shopName = 'Installment Management';
            return this._shopName;
        }
    }

    renderReport(html) {
        const panel = document.getElementById('reports-output');
        if (!panel) return;
        panel.innerHTML = html;
    }

    emptyReport(title) {
        return `<div class="card"><div class="card-body"><h3>${title}</h3><p class="text-muted">No data for this period</p></div></div>`;
    }

    wrapPanel(title, period, inner, shopName) {
        const name = shopName || this._shopName || 'Installment Management';
        return `<div class="report-panel" id="report-print-area">
            <button type="button" class="btn btn-secondary print-btn" onclick="window.print()">Print Report</button>
            <h2>${name}</h2>
            <h3>${title}</h3>
            <p>Period: ${period || 'All dates'}</p>
            ${inner}
            <p><strong>Generated on:</strong> ${this.safeFormatDate(new Date())}</p>
            ${typeof Utils !== 'undefined' && Utils.developerCreditHtml ? Utils.developerCreditHtml() : '<p class="developer-credit">Developed By POVDEV | povdev.com | WhatsApp: @wpfahad | Email: mypovdev@gmail.com</p>'}
        </div>`;
    }

    safeCapitalize(str) {
        if (typeof Utils !== 'undefined' && Utils.capitalizeWords) {
            return Utils.capitalizeWords(str);
        }
        if (!str) return '';
        return String(str).replace(/\b\w/g, (l) => l.toUpperCase());
    }

    handleQuickDateSelect(range) {
        const startDateInput = document.getElementById('reports-start-date');
        const endDateInput = document.getElementById('reports-end-date');
        const now = new Date();
        let startDate, endDate;

        switch (range) {
            case 'today':
                startDate = endDate = new Date(now);
                break;
            case 'yesterday':
                startDate = endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                break;
            case 'this-week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
                endDate = new Date(now);
                break;
            case 'last-week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 1);
                break;
            case 'this-month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'last-month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'this-year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now);
                break;
            case 'last-3-months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'last-6-months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            default:
                return;
        }

        if (startDateInput && endDateInput) {
            startDateInput.value = this.formatDateForInput(startDate);
            endDateInput.value = this.formatDateForInput(endDate);
        }
    }

    resetDateRange() {
        const startDateInput = document.getElementById('reports-start-date');
        const endDateInput = document.getElementById('reports-end-date');
        const quickSelectInput = document.getElementById('reports-quick-select');
        
        // Reset to current month
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        if (startDateInput && endDateInput) {
            startDateInput.value = this.formatDateForInput(firstDayOfMonth);
            endDateInput.value = this.formatDateForInput(lastDayOfMonth);
        }
        
        if (quickSelectInput) {
            quickSelectInput.value = '';
        }
    }

    getSelectedDateRange() {
        // Use temporary date range if available (from popup)
        if (this.tempDateRange) {
            return {
                startDate: new Date(this.tempDateRange.startDate),
                endDate: new Date(this.tempDateRange.endDate),
                startDateStr: this.tempDateRange.startDate,
                endDateStr: this.tempDateRange.endDate
            };
        }
        
        const startDateInput = document.getElementById('reports-start-date');
        const endDateInput = document.getElementById('reports-end-date');
        
        if (!startDateInput || !endDateInput) {
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return {
                startDate,
                endDate,
                startDateStr: this.formatDateForInput(startDate),
                endDateStr: this.formatDateForInput(endDate)
            };
        }
        
        const startDateStr = startDateInput.value;
        const endDateStr = endDateInput.value;
        
        if (!startDateStr || !endDateStr) {
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return {
                startDate,
                endDate,
                startDateStr: this.formatDateForInput(startDate),
                endDateStr: this.formatDateForInput(endDate)
            };
        }
        
        return {
            startDate: new Date(startDateStr),
            endDate: new Date(endDateStr),
            startDateStr,
            endDateStr
        };
    }

    async generateMonthlyReport() {
        try {
            console.log('Generating monthly report...');
            this.safeShowLoading();
            
            const monthlyData = await this.getMonthlyCollectionData();
            monthlyData.shopName = await this.getShopName();
            this.showMonthlyReport(monthlyData);
            
        } catch (error) {
            console.error('Error generating monthly report:', error);
            this.safeShowNotification(`Failed to generate monthly report: ${error.message}`, 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async generateOutstandingAmountsReport() {
        try {
            this.safeShowLoading();
            
            const outstandingData = await this.getOutstandingData();
            outstandingData.shopName = await this.getShopName();
            this.showOutstandingReport(outstandingData);
            
        } catch (error) {
            console.error('Error generating outstanding report:', error);
            this.safeShowNotification('Failed to generate outstanding report', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async generateCashSalesReportData() {
        try {
            app.showLoading();
            
            const cashSalesData = await this.getCashSalesReportData();
            this.showCashSalesReport(cashSalesData);
            
        } catch (error) {
            console.error('Error generating cash sales report:', error);
            app.showNotification('Failed to generate cash sales report', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async generateSupplierPaymentsReportData() {
        try {
            app.showLoading();
            
            const supplierData = await this.getSupplierPaymentsReportData();
            this.showSupplierPaymentsReport(supplierData);
            
        } catch (error) {
            console.error('Error generating supplier payments report:', error);
            app.showNotification('Failed to generate supplier payments report', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async generateExpenseReportData() {
        try {
            app.showLoading();
            
            const expenseData = await this.getExpenseReportData();
            this.showExpenseReport(expenseData);
            
        } catch (error) {
            console.error('Error generating expense report:', error);
            app.showNotification('Failed to generate expense report', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async generateStockReportData() {
        try {
            app.showLoading();
            
            const stockData = await this.getStockReportData();
            this.showStockReport(stockData);
            
        } catch (error) {
            console.error('Error generating stock report:', error);
            app.showNotification('Failed to generate stock report', 'error');
        } finally {
            app.hideLoading();
        }
    }

    // Data collection methods
    async generate(type) {
        switch (type) {
            case 'monthly':
                return await this.generateMonthlyReport();
            case 'outstanding':
                return await this.generateOutstandingReport();
            case 'cashsales':
                return await this.generateCashSalesReport();
            case 'supplier':
                return await this.generateSupplierPaymentsReport();
            case 'expense':
                return await this.generateExpenseReport();
            case 'stock':
                return await this.generateStockReport();
            case 'cashbook':
                return await this.generateDailyCashBook();
            case 'aging':
                return await this.generateOverdueAging();
            case 'statement':
                return await this.generateCustomerStatement();
            case 'profit':
                return await this.generateProfitSnapshot();
            default:
                this.safeShowNotification('Unknown report type', 'error');
        }
    }

    async getMonthlyCollectionData() {
        try {
            const range = this.getLocalRange();
            const payments = await this.loadCollectionFromPayments(range.start, range.end);
            const cashCollected = ReportsManager.sumPaymentsInRange(payments, range.start, range.end);
            const paymentRows = (payments || []).filter((p) => (p.type || 'payment') === 'payment');
            const cashSaleCollections = await this.safeQuery(`
                SELECT
                    COALESCE(SUM(received_price), 0) as total_amount,
                    COUNT(*) as transaction_count
                FROM cash_sales
                WHERE DATE(sale_date) BETWEEN DATE(?) AND DATE(?)
                  AND received_price > 0
            `, [range.start, range.end], [{ total_amount: 0, transaction_count: 0 }]);

            return {
                installments: { total_amount: cashCollected, transaction_count: paymentRows.length },
                cashSales: cashSaleCollections[0] || { total_amount: 0, transaction_count: 0 },
                payments: paymentRows,
                dateRange: `${range.start} to ${range.end}`
            };
        } catch (error) {
            console.error('Error in getMonthlyCollectionData:', error);
            const range = this.getLocalRange();
            return {
                installments: { total_amount: 0, transaction_count: 0 },
                cashSales: { total_amount: 0, transaction_count: 0 },
                payments: [],
                dateRange: `${range.start} to ${range.end}`,
                error: error.message
            };
        }
    }

    async generateOutstandingReport() {
        return await this.generateOutstandingAmountsReport();
    }

    async generateCashSalesReport() {
        return await this.generateCashSalesReportData();
    }

    async generateSupplierPaymentsReport() {
        return await this.generateSupplierPaymentsReportData();
    }

    async generateExpenseReport() {
        return await this.generateExpenseReportData();
    }

    async generateStockReport() {
        return await this.generateStockReportData();
    }

    async getOutstandingData() {
        try {
            // Get installment dues with customer details and delivery date
            const installmentDues = await this.safeQuery(`
                SELECT 
                    COALESCE(c.customer_name, 'N/A') as customer_name,
                    COALESCE(c.account_no, 'N/A') as account_no,
                    COALESCE(c.phone, 'N/A') as phone,
                    cp.start_date,
                    SUM(COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0)) as total_short_amount,
                    COUNT(CASE WHEN i.status != 'paid' AND i.status != 'settled' THEN 1 END) as pending_installments,
                    COUNT(CASE WHEN i.due_date < date('now') AND i.status != 'paid' AND i.status != 'settled' THEN 1 END) as overdue_installments,
                    (SELECT MAX(p.payment_date) FROM payments p WHERE p.customer_id = c.id AND (p.type IS NULL OR p.type = 'payment') AND (p.is_deleted = 0 OR p.is_deleted IS NULL)) as last_payment_date
                FROM installments i
                JOIN customer_purchases cp ON i.purchase_id = cp.id
                JOIN customers c ON cp.customer_id = c.id
                WHERE (i.is_deleted = 0 OR i.is_deleted IS NULL)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                  AND cp.status != 'deleted'
                GROUP BY c.id, c.customer_name, c.account_no, c.phone, cp.id, cp.start_date
                HAVING total_short_amount > 0
                ORDER BY total_short_amount DESC
            `, [], []);

            // Get cash sale dues with customer details
            const cashSaleDues = await this.safeQuery(`
                SELECT 
                    COALESCE(c.customer_name, 'Walk-in Customer') as customer_name,
                    COALESCE(c.account_no, 'N/A') as account_no,
                    COALESCE(c.phone, 'N/A') as phone,
                    cs.sale_date as delivery_date,
                    SUM(COALESCE(cs.due_amount, 0)) as total_short_amount,
                    COUNT(cs.id) as pending_sales
                FROM cash_sales cs
                LEFT JOIN customers c ON cs.customer_id = c.id
                WHERE cs.due_amount > 0
                GROUP BY cs.customer_id, c.customer_name, c.account_no, c.phone, cs.sale_date
                HAVING total_short_amount > 0
                ORDER BY total_short_amount DESC
            `, [], []);

            return {
                installmentDues: installmentDues || [],
                cashSaleDues: cashSaleDues || []
            };
        } catch (error) {
            console.error('Error in getOutstandingData:', error);
            return {
                installmentDues: [],
                cashSaleDues: [],
                error: error.message
            };
        }
    }

    async getCashSalesReportData() {
        try {
            const dateRange = this.getSelectedDateRange();
            
            const data = await this.safeQuery(`
                SELECT 
                    cs.sale_date,
                    COALESCE(c.customer_name, 'Walk-in Customer') as customer_name,
                    p.item_name,
                    s.engine_no,
                    cs.agreed_price,
                    cs.received_price,
                    cs.due_amount,
                    cs.payment_status,
                    cs.notes
                FROM cash_sales cs
                LEFT JOIN customers c ON cs.customer_id = c.id
                JOIN stock s ON cs.stock_id = s.id
                JOIN products p ON s.product_id = p.id
                WHERE DATE(cs.sale_date) BETWEEN DATE(?) AND DATE(?)
                ORDER BY cs.sale_date DESC
            `, [dateRange.startDateStr, dateRange.endDateStr], []);
            
            return data || [];
        } catch (error) {
            console.error('Error in getCashSalesReportData:', error);
            return [];
        }
    }

    async getSupplierPaymentsReportData() {
        try {
            const dateRange = this.getSelectedDateRange();
            
            const data = await this.safeQuery(`
                SELECT 
                    sp.payment_date,
                    s.supplier_name,
                    sp.amount,
                    sp.payment_method,
                    sp.reference_no,
                    sp.notes
                FROM supplier_payments sp
                JOIN suppliers s ON sp.supplier_id = s.id
                WHERE DATE(sp.payment_date) BETWEEN DATE(?) AND DATE(?)
                ORDER BY sp.payment_date DESC
            `, [dateRange.startDateStr, dateRange.endDateStr], []);
            
            return data || [];
        } catch (error) {
            console.error('Error in getSupplierPaymentsReportData:', error);
            return [];
        }
    }

    async getExpenseReportData() {
        try {
            const dateRange = this.getSelectedDateRange();
            
            const expenses = await this.safeQuery(`
                SELECT 
                    e.date,
                    et.name as expense_type,
                    e.amount,
                    e.notes
                FROM expenses e
                JOIN expense_types et ON e.expense_type_id = et.id
                WHERE DATE(e.date) BETWEEN DATE(?) AND DATE(?)
                ORDER BY e.date DESC
            `, [dateRange.startDateStr, dateRange.endDateStr], []);

            const expensesByType = await this.safeQuery(`
                SELECT 
                    et.name as expense_type,
                    SUM(e.amount) as total_amount,
                    COUNT(e.id) as transaction_count
                FROM expenses e
                JOIN expense_types et ON e.expense_type_id = et.id
                WHERE DATE(e.date) BETWEEN DATE(?) AND DATE(?)
                GROUP BY et.id, et.name
                ORDER BY total_amount DESC
            `, [dateRange.startDateStr, dateRange.endDateStr], []);

            return {
                expenses: expenses || [],
                expensesByType: expensesByType || []
            };
        } catch (error) {
            console.error('Error in getExpenseReportData:', error);
            return {
                expenses: [],
                expensesByType: []
            };
        }
    }

    async getStockReportData() {
        try {
            const dateRange = this.getSelectedDateRange();
            const stockSummary = await this.safeQuery(`
                SELECT 
                    p.item_name,
                    COUNT(s.id) as total_stock,
                    SUM(CASE WHEN s.is_sold = 1 THEN 1 ELSE 0 END) as sold_stock,
                    SUM(CASE WHEN s.is_sold = 0 THEN 1 ELSE 0 END) as available_stock,
                    AVG(p.current_price) as avg_price
                FROM stock s
                JOIN products p ON s.product_id = p.id
                GROUP BY p.id, p.item_name
                ORDER BY total_stock DESC
            `, [], []);

            const recentSales = await this.safeQuery(`
                SELECT 
                    'installment' as sale_type,
                    cp.start_date as sale_date,
                    c.customer_name,
                    p.item_name,
                    s.engine_no,
                    cp.sale_price
                FROM customer_purchases cp
                JOIN customers c ON cp.customer_id = c.id
                JOIN stock s ON cp.stock_id = s.id
                JOIN products p ON s.product_id = p.id
                WHERE DATE(cp.start_date) BETWEEN DATE(?) AND DATE(?)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                
                UNION ALL
                
                SELECT 
                    'cash_sale' as sale_type,
                    cs.sale_date,
                    COALESCE(c.customer_name, 'Walk-in Customer') as customer_name,
                    p.item_name,
                    s.engine_no,
                    cs.agreed_price as sale_price
                FROM cash_sales cs
                LEFT JOIN customers c ON cs.customer_id = c.id
                JOIN stock s ON cs.stock_id = s.id
                JOIN products p ON s.product_id = p.id
                WHERE DATE(cs.sale_date) BETWEEN DATE(?) AND DATE(?)
                
                ORDER BY sale_date DESC
                LIMIT 50
            `, [dateRange.startDateStr, dateRange.endDateStr, dateRange.startDateStr, dateRange.endDateStr], []);

            return {
                stockSummary: stockSummary || [],
                recentSales: recentSales || []
            };
        } catch (error) {
            console.error('Error in getStockReportData:', error);
            return {
                stockSummary: [],
                recentSales: []
            };
        }
    }

    async loadData() {
        // Initialize date range controls when reports section is loaded
        setTimeout(() => {
            this.setupDateRangeControls();
        }, 100);
    }

    async generateReportWithDateRange(reportType) {
        return await this.generate(reportType);
    }

    showMonthlyReport(data) {
        const hasErrors = data.error;
        const errorMessage = hasErrors ? `<div class="alert alert-danger"><strong>Warning:</strong> Some data could not be loaded: ${data.error}</div>` : '';
        const totalCollections = (data.installments.total_amount || 0) + (data.cashSales.total_amount || 0);
        const totalTransactions = (data.installments.transaction_count || 0) + (data.cashSales.transaction_count || 0);
        if (totalCollections === 0 && !hasErrors) {
            this.renderReport(this.emptyReport('Monthly Collection Report'));
            return;
        }
        const inner = `
            ${errorMessage}
            <div class="summary-grid">
                <div class="summary-card">
                    <h4>Total Collections</h4>
                    <div class="amount">${this.safeFormatCurrency(totalCollections)}</div>
                    <p>${totalTransactions} transactions</p>
                </div>
                <div class="summary-card">
                    <h4>Installment Collections</h4>
                    <div class="amount">${this.safeFormatCurrency(data.installments.total_amount || 0)}</div>
                    <p>${data.installments.transaction_count || 0} payments</p>
                </div>
                <div class="summary-card">
                    <h4>Cash Sales</h4>
                    <div class="amount">${this.safeFormatCurrency(data.cashSales.total_amount || 0)}</div>
                    <p>${data.cashSales.transaction_count || 0} sales</p>
                </div>
            </div>
        `;
        this.renderReport(this.wrapPanel('Monthly Collection Report', data.dateRange || 'Current Period', inner, data.shopName));
    }

    showOutstandingReport(data) {
        const hasErrors = data.error;
        const errorMessage = hasErrors ? `<div class="alert alert-danger"><strong>Warning:</strong> ${data.error}</div>` : '';
        const installmentDues = data.installmentDues || [];
        const cashSaleDues = data.cashSaleDues || [];
        if (installmentDues.length === 0 && cashSaleDues.length === 0 && !hasErrors) {
            this.renderReport(this.emptyReport('Outstanding Amounts Report'));
            return;
        }
        const inner = `
            ${errorMessage}
            <div class="section">
                <h4>Installment Dues</h4>
                ${installmentDues.length > 0 ? `
                    <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Customer Name</th>
                                <th>Account</th>
                                <th>Phone</th>
                                <th>Start Date</th>
                                <th>Remaining</th>
                                <th>Overdue</th>
                                <th>Last Payment</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${installmentDues.map(due => `
                                <tr>
                                    <td>${due.customer_name || 'N/A'}</td>
                                    <td>${due.account_no || 'N/A'}</td>
                                    <td>${due.phone || 'N/A'}</td>
                                    <td>${this.safeFormatDate(due.start_date)}</td>
                                    <td class="amount">${this.safeFormatCurrency(due.total_short_amount)}</td>
                                    <td>${due.overdue_installments || 0}</td>
                                    <td>${due.last_payment_date ? this.safeFormatDate(due.last_payment_date) : 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    </div>
                ` : '<p class="text-muted">No outstanding installment dues</p>'}
            </div>
            <div class="section">
                <h4>Cash Sale Dues</h4>
                ${cashSaleDues.length > 0 ? `
                    <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Customer Name</th>
                                <th>Account</th>
                                <th>Phone</th>
                                <th>Sale Date</th>
                                <th>Total Due Amount</th>
                                <th>Pending Sales</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cashSaleDues.map(due => `
                                <tr>
                                    <td>${due.customer_name}</td>
                                    <td>${due.account_no || 'N/A'}</td>
                                    <td>${due.phone}</td>
                                    <td>${this.safeFormatDate(due.delivery_date)}</td>
                                    <td class="amount">${this.safeFormatCurrency(due.total_short_amount)}</td>
                                    <td>${due.pending_sales}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    </div>
                ` : '<p class="text-muted">No outstanding cash sale dues</p>'}
            </div>
        `;
        this.renderReport(this.wrapPanel('Outstanding Amounts Report', 'All dates', inner, data.shopName));
    }

    showCashSalesReport(data) {
        const rows = data || [];
        const range = this.getLocalRange();
        if (rows.length === 0) {
            this.renderReport(this.emptyReport('Cash Sales Report'));
            return;
        }
        const totalSales = rows.reduce((sum, sale) => sum + (sale.agreed_price || 0), 0);
        const totalReceived = rows.reduce((sum, sale) => sum + (sale.received_price || 0), 0);
        const totalDues = rows.reduce((sum, sale) => sum + (sale.due_amount || 0), 0);
        const inner = `
            <div class="summary-grid">
                <div class="summary-card"><h4>Total Sales Value</h4><div class="amount">${this.safeFormatCurrency(totalSales)}</div></div>
                <div class="summary-card"><h4>Amount Received</h4><div class="amount">${this.safeFormatCurrency(totalReceived)}</div></div>
                <div class="summary-card"><h4>Outstanding Dues</h4><div class="amount">${this.safeFormatCurrency(totalDues)}</div></div>
            </div>
            <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Item</th>
                        <th>Engine No</th>
                        <th>Agreed Price</th>
                        <th>Received</th>
                        <th>Due Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(sale => `
                        <tr>
                            <td>${this.safeFormatDate(sale.sale_date)}</td>
                            <td>${sale.customer_name}</td>
                            <td>${sale.item_name}</td>
                            <td>${sale.engine_no || 'N/A'}</td>
                            <td>${this.safeFormatCurrency(sale.agreed_price)}</td>
                            <td>${this.safeFormatCurrency(sale.received_price)}</td>
                            <td>${this.safeFormatCurrency(sale.due_amount)}</td>
                            <td>${this.safeCapitalize(sale.payment_status)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        `;
        this.renderReport(this.wrapPanel('Cash Sales Report', `${range.start} to ${range.end}`, inner));
    }

    showSupplierPaymentsReport(data) {
        const rows = data || [];
        const range = this.getLocalRange();
        if (rows.length === 0) {
            this.renderReport(this.emptyReport('Supplier Payments Report'));
            return;
        }
        const totalPayments = rows.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        const inner = `
            <div class="summary-grid">
                <div class="summary-card"><h4>Total Payments Made</h4><div class="amount">${this.safeFormatCurrency(totalPayments)}</div><p>${rows.length} transactions</p></div>
            </div>
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
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(payment => `
                        <tr>
                            <td>${this.safeFormatDate(payment.payment_date)}</td>
                            <td>${payment.supplier_name}</td>
                            <td>${this.safeFormatCurrency(payment.amount)}</td>
                            <td>${this.safeCapitalize(payment.payment_method)}</td>
                            <td>${payment.reference_no || 'N/A'}</td>
                            <td>${payment.notes || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        `;
        this.renderReport(this.wrapPanel('Supplier Payments Report', `${range.start} to ${range.end}`, inner));
    }

    showExpenseReport(data) {
        const expenses = (data && data.expenses) || [];
        const expensesByType = (data && data.expensesByType) || [];
        const range = this.getLocalRange();
        if (expenses.length === 0) {
            this.renderReport(this.emptyReport('Expense Report'));
            return;
        }
        const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const inner = `
            <div class="summary-grid">
                <div class="summary-card"><h4>Total Expenses</h4><div class="amount">${this.safeFormatCurrency(totalExpenses)}</div><p>${expenses.length} transactions</p></div>
            </div>
            <div class="section">
                <h4>Expenses by Type</h4>
                <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Expense Type</th>
                            <th>Total Amount</th>
                            <th>Transaction Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expensesByType.map(type => `
                            <tr>
                                <td>${type.expense_type}</td>
                                <td>${this.safeFormatCurrency(type.total_amount)}</td>
                                <td>${type.transaction_count}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
            </div>
            <div class="section">
                <h4>Detailed Expenses</h4>
                <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expenses.map(expense => `
                            <tr>
                                <td>${this.safeFormatDate(expense.date)}</td>
                                <td>${expense.expense_type}</td>
                                <td>${this.safeFormatCurrency(expense.amount)}</td>
                                <td>${expense.notes || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
            </div>
        `;
        this.renderReport(this.wrapPanel('Expense Report', `${range.start} to ${range.end}`, inner));
    }

    showStockReport(data) {
        const stockSummary = (data && data.stockSummary) || [];
        const recentSales = (data && data.recentSales) || [];
        const range = this.getLocalRange();
        if (stockSummary.length === 0 && recentSales.length === 0) {
            this.renderReport(this.emptyReport('Stock Report'));
            return;
        }
        const inner = `
            <div class="section">
                <h4>Stock Summary</h4>
                ${stockSummary.length > 0 ? `
                    <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Total Stock</th>
                                <th>Sold</th>
                                <th>Available</th>
                                <th>Average Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stockSummary.map(item => `
                                <tr>
                                    <td>${item.item_name}</td>
                                    <td>${item.total_stock}</td>
                                    <td>${item.sold_stock}</td>
                                    <td>${item.available_stock}</td>
                                    <td>${this.safeFormatCurrency(item.avg_price)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    </div>
                ` : '<p class="text-muted">No stock data available.</p>'}
            </div>
            <div class="section">
                <h4>Sales in Selected Range</h4>
                ${recentSales.length > 0 ? `
                    <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Sale Type</th>
                                <th>Date</th>
                                <th>Customer</th>
                                <th>Item</th>
                                <th>Engine No</th>
                                <th>Sale Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentSales.map(sale => `
                                <tr>
                                    <td>${this.safeCapitalize((sale.sale_type || '').replace('_', ' '))}</td>
                                    <td>${this.safeFormatDate(sale.sale_date)}</td>
                                    <td>${sale.customer_name}</td>
                                    <td>${sale.item_name}</td>
                                    <td>${sale.engine_no || 'N/A'}</td>
                                    <td>${this.safeFormatCurrency(sale.sale_price)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    </div>
                ` : '<p class="text-muted">No sales found for this period.</p>'}
            </div>
        `;
        this.renderReport(this.wrapPanel('Stock Report', `${range.start} to ${range.end}`, inner));
    }

    async generateDailyCashBook() {
        try {
            this.safeShowLoading();
            const range = this.getLocalRange();
            const shopName = await this.getShopName();
            const payments = await this.loadCollectionFromPayments(range.start, range.end);
            const cashCollected = ReportsManager.sumPaymentsInRange(payments, range.start, range.end);
            const cashSales = await this.safeQuery(`
                SELECT sale_date as entry_date, received_price as amount, 'Cash Sale' as source,
                       COALESCE(c.customer_name, 'Walk-in Customer') as party
                FROM cash_sales cs
                LEFT JOIN customers c ON cs.customer_id = c.id
                WHERE DATE(cs.sale_date) BETWEEN DATE(?) AND DATE(?)
                  AND received_price > 0
                ORDER BY cs.sale_date
            `, [range.start, range.end], []);
            const expenses = await this.safeQuery(`
                SELECT e.date as entry_date, e.amount, et.name as source, e.notes as party
                FROM expenses e
                JOIN expense_types et ON e.expense_type_id = et.id
                WHERE DATE(e.date) BETWEEN DATE(?) AND DATE(?)
                ORDER BY e.date
            `, [range.start, range.end], []);
            const supplierPays = await this.safeQuery(`
                SELECT sp.payment_date as entry_date, sp.amount, 'Supplier Payment' as source, s.supplier_name as party
                FROM supplier_payments sp
                JOIN suppliers s ON sp.supplier_id = s.id
                WHERE DATE(sp.payment_date) BETWEEN DATE(?) AND DATE(?)
                ORDER BY sp.payment_date
            `, [range.start, range.end], []);
            const paymentRows = (payments || []).filter((p) => (p.type || 'payment') === 'payment');
            const inflows = cashCollected + cashSales.reduce((s, r) => s + (r.amount || 0), 0);
            const outflows = expenses.reduce((s, r) => s + (r.amount || 0), 0)
                + supplierPays.reduce((s, r) => s + (r.amount || 0), 0);
            if (inflows === 0 && outflows === 0) {
                this.renderReport(this.emptyReport('Daily Cash Book'));
                return;
            }
            const rows = [
                ...paymentRows.map((p) => ({ date: p.payment_date, source: 'Installment', party: p.receipt_no || '', amount: p.amount, kind: 'in' })),
                ...cashSales.map((r) => ({ date: r.entry_date, source: r.source, party: r.party, amount: r.amount, kind: 'in' })),
                ...expenses.map((r) => ({ date: r.entry_date, source: r.source, party: r.party || '', amount: r.amount, kind: 'out' })),
                ...supplierPays.map((r) => ({ date: r.entry_date, source: r.source, party: r.party, amount: r.amount, kind: 'out' }))
            ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
            const inner = `
                <div class="summary-grid">
                    <div class="summary-card"><h4>Inflows</h4><div class="amount">${this.safeFormatCurrency(inflows)}</div></div>
                    <div class="summary-card"><h4>Outflows</h4><div class="amount">${this.safeFormatCurrency(outflows)}</div></div>
                    <div class="summary-card"><h4>Net</h4><div class="amount">${this.safeFormatCurrency(inflows - outflows)}</div></div>
                </div>
                <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Source</th>
                            <th>Party</th>
                            <th>In</th>
                            <th>Out</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((r) => `
                            <tr>
                                <td>${this.safeFormatDate(r.date)}</td>
                                <td>${r.source}</td>
                                <td>${r.party || 'N/A'}</td>
                                <td>${r.kind === 'in' ? this.safeFormatCurrency(r.amount) : ''}</td>
                                <td>${r.kind === 'out' ? this.safeFormatCurrency(r.amount) : ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
            `;
            this.renderReport(this.wrapPanel('Daily Cash Book', `${range.start} to ${range.end}`, inner, shopName));
        } catch (error) {
            console.error('Error generating cash book:', error);
            this.safeShowNotification('Failed to generate daily cash book', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async generateOverdueAging() {
        try {
            this.safeShowLoading();
            const shopName = await this.getShopName();
            const today = this.formatDateForInput(new Date());
            const rows = await this.safeQuery(`
                SELECT
                    COALESCE(c.customer_name, 'N/A') as customer_name,
                    COALESCE(c.account_no, 'N/A') as account_no,
                    COALESCE(c.phone, 'N/A') as phone,
                    SUM(CASE WHEN CAST(julianday(?) - julianday(i.due_date) AS INTEGER) BETWEEN 1 AND 30
                        THEN CASE WHEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) > 0
                             THEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) ELSE 0 END ELSE 0 END) as bucket_1_30,
                    SUM(CASE WHEN CAST(julianday(?) - julianday(i.due_date) AS INTEGER) BETWEEN 31 AND 60
                        THEN CASE WHEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) > 0
                             THEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) ELSE 0 END ELSE 0 END) as bucket_31_60,
                    SUM(CASE WHEN CAST(julianday(?) - julianday(i.due_date) AS INTEGER) BETWEEN 61 AND 90
                        THEN CASE WHEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) > 0
                             THEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) ELSE 0 END ELSE 0 END) as bucket_61_90,
                    SUM(CASE WHEN CAST(julianday(?) - julianday(i.due_date) AS INTEGER) > 90
                        THEN CASE WHEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) > 0
                             THEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) ELSE 0 END ELSE 0 END) as bucket_90_plus
                FROM installments i
                JOIN customer_purchases cp ON i.purchase_id = cp.id
                JOIN customers c ON cp.customer_id = c.id
                WHERE (i.is_deleted = 0 OR i.is_deleted IS NULL)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                  AND cp.status != 'deleted'
                  AND DATE(i.due_date) < DATE(?)
                  AND (COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0)) > 0
                GROUP BY c.id, c.customer_name, c.account_no, c.phone
                ORDER BY (bucket_1_30 + bucket_31_60 + bucket_61_90 + bucket_90_plus) DESC
            `, [today, today, today, today, today], []);
            if (!rows.length) {
                this.renderReport(this.emptyReport('Overdue Aging'));
                return;
            }
            const inner = `
                <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Account</th>
                            <th>Phone</th>
                            <th>1-30 Days</th>
                            <th>31-60 Days</th>
                            <th>61-90 Days</th>
                            <th>90+ Days</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((r) => `
                            <tr>
                                <td>${r.customer_name}</td>
                                <td>${r.account_no}</td>
                                <td>${r.phone}</td>
                                <td>${this.safeFormatCurrency(r.bucket_1_30)}</td>
                                <td>${this.safeFormatCurrency(r.bucket_31_60)}</td>
                                <td>${this.safeFormatCurrency(r.bucket_61_90)}</td>
                                <td>${this.safeFormatCurrency(r.bucket_90_plus)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
            `;
            this.renderReport(this.wrapPanel('Overdue Aging', today, inner, shopName));
        } catch (error) {
            console.error('Error generating overdue aging:', error);
            this.safeShowNotification('Failed to generate overdue aging', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async generateCustomerStatement() {
        try {
            this.safeShowLoading();
            const customerId = await this.promptCustomerId();
            if (!customerId) {
                return;
            }
            const shopName = await this.getShopName();
            const customer = await Database.get('SELECT * FROM customers WHERE id = ?', [customerId]);
            if (!customer) {
                this.safeShowNotification('Customer not found', 'error');
                return;
            }
            const purchases = await this.safeQuery(`
                SELECT cp.id, cp.start_date, cp.sale_price, cp.total_amount, p.item_name
                FROM customer_purchases cp
                LEFT JOIN stock s ON cp.stock_id = s.id
                LEFT JOIN products p ON s.product_id = p.id
                WHERE cp.customer_id = ?
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                ORDER BY cp.start_date
            `, [customerId], []);
            const payments = await this.safeQuery(`
                SELECT payment_date, amount, receipt_no, notes, type
                FROM payments
                WHERE customer_id = ?
                  AND (is_deleted = 0 OR is_deleted IS NULL)
                ORDER BY payment_date
            `, [customerId], []);
            const remainingRows = await this.safeQuery(`
                SELECT SUM(COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0)) as remaining
                FROM installments i
                JOIN customer_purchases cp ON i.purchase_id = cp.id
                WHERE cp.customer_id = ?
                  AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
            `, [customerId], [{ remaining: 0 }]);
            const remaining = (remainingRows[0] && remainingRows[0].remaining) || 0;
            const inner = `
                <p><strong>Customer:</strong> ${customer.customer_name || ''} &nbsp;
                   <strong>Account:</strong> ${customer.account_no || 'N/A'} &nbsp;
                   <strong>Phone:</strong> ${customer.phone || 'N/A'}</p>
                <p><strong>Remaining:</strong> ${this.safeFormatCurrency(remaining)}</p>
                <div class="section">
                    <h4>Purchases</h4>
                    ${purchases.length ? `
                    <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>Date</th><th>Item</th><th>Sale Price</th><th>Total</th></tr></thead>
                        <tbody>
                            ${purchases.map((p) => `
                                <tr>
                                    <td>${this.safeFormatDate(p.start_date)}</td>
                                    <td>${p.item_name || 'N/A'}</td>
                                    <td>${this.safeFormatCurrency(p.sale_price)}</td>
                                    <td>${this.safeFormatCurrency(p.total_amount)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    </div>` : '<p class="text-muted">No purchases</p>'}
                </div>
                <div class="section">
                    <h4>Payments</h4>
                    ${payments.length ? `
                    <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>Date</th><th>Amount</th><th>Receipt</th><th>Type</th><th>Notes</th></tr></thead>
                        <tbody>
                            ${payments.map((p) => `
                                <tr>
                                    <td>${this.safeFormatDate(p.payment_date)}</td>
                                    <td>${this.safeFormatCurrency(p.amount)}</td>
                                    <td>${p.receipt_no || 'N/A'}</td>
                                    <td>${p.type || 'payment'}</td>
                                    <td>${p.notes || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    </div>` : '<p class="text-muted">No payments</p>'}
                </div>
            `;
            this.renderReport(this.wrapPanel('Customer Statement', customer.customer_name, inner, shopName));
        } catch (error) {
            console.error('Error generating customer statement:', error);
            this.safeShowNotification('Failed to generate customer statement', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async promptCustomerId() {
        const customers = await this.safeQuery(
            'SELECT id, customer_name, account_no, phone FROM customers ORDER BY customer_name',
            [],
            []
        );
        if (!customers.length) {
            this.safeShowNotification('No customers found', 'error');
            return null;
        }
        const listed = customers.slice(0, 20).map((c) => `${c.id}: ${c.customer_name} (${c.account_no || c.phone || '-'})`).join('\n');
        const entered = typeof window !== 'undefined' && window.prompt
            ? window.prompt(`Enter customer id:\n${listed}${customers.length > 20 ? '\n...' : ''}`)
            : null;
        if (!entered) return null;
        const id = parseInt(entered, 10);
        return Number.isFinite(id) ? id : null;
    }

    async generateProfitSnapshot() {
        try {
            this.safeShowLoading();
            const range = this.getLocalRange();
            const shopName = await this.getShopName();
            const installmentProfit = await this.safeQuery(`
                SELECT COALESCE(SUM(cp.sale_price - cp.purchase_price), 0) as profit
                FROM customer_purchases cp
                WHERE DATE(cp.start_date) BETWEEN DATE(?) AND DATE(?)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
            `, [range.start, range.end], [{ profit: 0 }]);
            const cashProfit = await this.safeQuery(`
                SELECT COALESCE(SUM(cs.agreed_price - COALESCE(p.purchase_price, 0)), 0) as profit
                FROM cash_sales cs
                JOIN stock s ON cs.stock_id = s.id
                JOIN products p ON s.product_id = p.id
                WHERE DATE(cs.sale_date) BETWEEN DATE(?) AND DATE(?)
            `, [range.start, range.end], [{ profit: 0 }]);
            const discounts = await this.safeQuery(`
                SELECT COALESCE(SUM(d.amount), 0) as total
                FROM discounts d
                JOIN customer_purchases cp ON d.purchase_id = cp.id
                WHERE DATE(cp.start_date) BETWEEN DATE(?) AND DATE(?)
            `, [range.start, range.end], [{ total: 0 }]);
            const expenses = await this.safeQuery(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM expenses
                WHERE DATE(date) BETWEEN DATE(?) AND DATE(?)
            `, [range.start, range.end], [{ total: 0 }]);
            const inst = (installmentProfit[0] && installmentProfit[0].profit) || 0;
            const cash = (cashProfit[0] && cashProfit[0].profit) || 0;
            const disc = (discounts[0] && discounts[0].total) || 0;
            const exp = (expenses[0] && expenses[0].total) || 0;
            const net = inst + cash - disc - exp;
            if (inst === 0 && cash === 0 && disc === 0 && exp === 0) {
                this.renderReport(this.emptyReport('Profit Snapshot'));
                return;
            }
            const inner = `
                <div class="summary-grid">
                    <div class="summary-card"><h4>Installment Profit</h4><div class="amount">${this.safeFormatCurrency(inst)}</div></div>
                    <div class="summary-card"><h4>Cash Sale Profit</h4><div class="amount">${this.safeFormatCurrency(cash)}</div></div>
                    <div class="summary-card"><h4>Discounts</h4><div class="amount">${this.safeFormatCurrency(disc)}</div></div>
                    <div class="summary-card"><h4>Expenses</h4><div class="amount">${this.safeFormatCurrency(exp)}</div></div>
                    <div class="summary-card"><h4>Net Profit</h4><div class="amount">${this.safeFormatCurrency(net)}</div></div>
                </div>
            `;
            this.renderReport(this.wrapPanel('Profit Snapshot', `${range.start} to ${range.end}`, inner, shopName));
        } catch (error) {
            console.error('Error generating profit snapshot:', error);
            this.safeShowNotification('Failed to generate profit snapshot', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    // Enhanced error handling for database queries
    async safeQuery(sql, params = [], fallback = []) {
        try {
            if (typeof Database === 'undefined') {
                console.warn('Database module not available');
                return fallback;
            }
            const result = await Database.query(sql, params);
            return result || fallback;
        } catch (error) {
            console.error('Reports database error:', error);
            console.error('SQL:', sql);
            console.error('Params:', params);
            // Return fallback instead of throwing to prevent crashes
            this.safeShowNotification('Some report data could not be loaded', 'warning');
            return fallback;
        }
    }
    
    // Cleanup method to ensure no temporary data persists
    cleanupTempData() {
        this.tempDateRange = null;
        this.currentReportData = null;
        this.currentTemplateType = null;
        this.dateRangeResolver = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReportsManager };
} else {
    window.ReportsManager = ReportsManager;
    if (!window.reports) {
        window.reports = new ReportsManager();
    }
    window.generateReport = async function(type) {
        try {
            if (!window.reports) {
                window.reports = new ReportsManager();
            }
            await window.reports.generate(type);
        } catch (err) {
            console.error('Report generation error:', err);
            if (typeof app !== 'undefined' && app.showNotification) {
                app.showNotification(`Failed to generate report: ${err.message}`, 'error');
            }
        }
    };
}