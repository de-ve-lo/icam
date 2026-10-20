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
            SELECT p.payment_date, p.amount, p.type, p.customer_id, p.installment_id, p.receipt_no,
                   c.customer_name
            FROM payments p
            LEFT JOIN customers c ON c.id = p.customer_id
            WHERE DATE(p.payment_date) BETWEEN DATE(?) AND DATE(?)
              AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
        `, [start, end], []);
    }

    async getShopName() {
        const settings = await this.getShopSettings();
        this._shopName = (settings && settings.shop_name) || 'Installment Management';
        return this._shopName;
    }

    async getShopSettings() {
        try {
            if (typeof Utils !== 'undefined' && Utils.getShopSettingsSafe) {
                this._shopSettings = await Utils.getShopSettingsSafe();
            } else {
                this._shopSettings = await Database.getShopSettings();
            }
        } catch (e) {
            this._shopSettings = { shop_name: 'Installment Management', phone: '', address: '', logo_path: '' };
        }
        this._shopName = this._shopSettings.shop_name || 'Installment Management';
        return this._shopSettings;
    }

    renderReport(html) {
        const panel = document.getElementById('reports-output');
        if (!panel) return;
        panel.innerHTML = html;
    }

    emptyReport(title) {
        return `<div class="card"><div class="card-body"><h3>${title}</h3><p class="text-muted">No data for this period</p></div></div>`;
    }

    printCurrent() {
        const panel = document.getElementById('report-print-area');
        if (!panel) {
            this.safeShowNotification('No report to print', 'warning');
            return;
        }
        const clone = panel.cloneNode(true);
        clone.querySelectorAll('.print-btn').forEach((btn) => btn.remove());
        const titleEl = clone.querySelector('h3');
        const title = titleEl ? titleEl.textContent.trim() : 'Report';
        const extraCss = `
            .report-shop-logo { max-height: 64px; max-width: 160px; display: block; margin: 0 auto 8px; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 12px 0; }
            .summary-card { border: 1px solid #ddd; padding: 10px; text-align: center; }
            .table-container { overflow: visible; }
            h2, h3 { text-align: center; }
        `;
        const html = (typeof Utils !== 'undefined' && Utils.wrapPrintDocument)
            ? Utils.wrapPrintDocument(clone.innerHTML, title, extraCss)
            : clone.innerHTML;
        if (typeof Utils !== 'undefined' && Utils.showPrintPreview) {
            Utils.showPrintPreview(html, title);
        }
    }

    wrapPanel(title, period, inner, shopName) {
        const settings = this._shopSettings || {};
        const esc = (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml.bind(Utils) : (v) => String(v || '');
        const name = esc(shopName || settings.shop_name || this._shopName || 'Installment Management');
        const phone = esc(settings.phone || '');
        const address = esc(settings.address || '');
        const logoUrl = (typeof Utils !== 'undefined' && Utils.logoSrc) ? Utils.logoSrc(settings) : (settings.logo_data_url || '');
        const logo = logoUrl
            ? `<img class="report-shop-logo" src="${esc(logoUrl)}" alt="${name}">`
            : '';
        const contact = [phone, address].filter(Boolean).join(' | ');
        return `<div class="report-panel" id="report-print-area">
            <button type="button" class="btn btn-secondary print-btn" onclick="app.reports.printCurrent()">Print / Save PDF</button>
            <div class="shop-print-header">
                ${logo}
                <h2>${name}</h2>
                ${contact ? `<p>${contact}</p>` : ''}
            </div>
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

    async generateCustomerCollection() {
        try {
            this.safeShowLoading();
            const range = this.getLocalRange();
            const shopName = await this.getShopName();
            const payments = await this.safeQuery(`
                SELECT p.customer_id,
                       COALESCE(c.account_no, 'N/A') as account_no,
                       COALESCE(c.customer_name, 'Walk-in Customer') as customer_name,
                       COALESCE(SUM(p.amount), 0) as total
                FROM payments p
                LEFT JOIN customers c ON c.id = p.customer_id
                WHERE DATE(p.payment_date) BETWEEN DATE(?) AND DATE(?)
                  AND (p.type = 'payment' OR p.type IS NULL)
                  AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
                GROUP BY p.customer_id
            `, [range.start, range.end], []);
            const advances = await this.safeQuery(`
                SELECT cp.customer_id,
                       COALESCE(c.account_no, 'N/A') as account_no,
                       COALESCE(c.customer_name, 'Walk-in Customer') as customer_name,
                       COALESCE(SUM(cp.advance_received), 0) as total
                FROM customer_purchases cp
                LEFT JOIN customers c ON c.id = cp.customer_id
                WHERE DATE(cp.start_date) BETWEEN DATE(?) AND DATE(?)
                  AND COALESCE(cp.advance_received, 0) > 0
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                GROUP BY cp.customer_id
            `, [range.start, range.end], []);
            const cashSales = await this.safeQuery(`
                SELECT csc.customer_id,
                       COALESCE(c.account_no, 'N/A') as account_no,
                       COALESCE(c.customer_name, 'Walk-in Customer') as customer_name,
                       COALESCE(SUM(csc.amount), 0) as total
                FROM cash_sale_collections csc
                LEFT JOIN customers c ON csc.customer_id = c.id
                WHERE DATE(csc.collection_date) BETWEEN DATE(?) AND DATE(?)
                  AND csc.amount > 0
                  AND (csc.is_deleted = 0 OR csc.is_deleted IS NULL)
                GROUP BY csc.customer_id
            `, [range.start, range.end], []);
            const byCustomer = new Map();
            const keyFor = (id) => (id == null ? 'walkin' : String(id));
            const merge = (rows, field) => {
                for (const r of rows || []) {
                    const key = keyFor(r.customer_id);
                    if (!byCustomer.has(key)) {
                        byCustomer.set(key, {
                            account_no: r.account_no,
                            customer_name: r.customer_name,
                            payments: 0,
                            advances: 0,
                            cashSales: 0
                        });
                    }
                    const entry = byCustomer.get(key);
                    entry[field] += Number(r.total) || 0;
                }
            };
            merge(payments, 'payments');
            merge(advances, 'advances');
            merge(cashSales, 'cashSales');
            const rows = Array.from(byCustomer.values())
                .map((r) => ({ ...r, totalIn: r.payments + r.advances + r.cashSales }))
                .sort((a, b) => String(a.account_no).localeCompare(String(b.account_no))
                    || String(a.customer_name).localeCompare(String(b.customer_name)));
            if (!rows.length) {
                this.renderReport(this.emptyReport('Customer-wise Collection'));
                return;
            }
            const sum = (key) => rows.reduce((s, r) => s + r[key], 0);
            const inner = `
                <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Account</th>
                            <th>Name</th>
                            <th>Payments</th>
                            <th>Advances</th>
                            <th>Cash sales</th>
                            <th>Total in</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((r) => `
                            <tr>
                                <td>${r.account_no}</td>
                                <td>${r.customer_name}</td>
                                <td class="amount">${this.safeFormatCurrency(r.payments)}</td>
                                <td class="amount">${this.safeFormatCurrency(r.advances)}</td>
                                <td class="amount">${this.safeFormatCurrency(r.cashSales)}</td>
                                <td class="amount">${this.safeFormatCurrency(r.totalIn)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>Totals</strong></td>
                            <td class="amount"><strong>${this.safeFormatCurrency(sum('payments'))}</strong></td>
                            <td class="amount"><strong>${this.safeFormatCurrency(sum('advances'))}</strong></td>
                            <td class="amount"><strong>${this.safeFormatCurrency(sum('cashSales'))}</strong></td>
                            <td class="amount"><strong>${this.safeFormatCurrency(sum('totalIn'))}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                </div>
            `;
            this.renderReport(this.wrapPanel('Customer-wise Collection', `${range.start} to ${range.end}`, inner, shopName));
        } catch (error) {
            console.error('Error generating customer collection:', error);
            this.safeShowNotification('Failed to generate customer-wise collection', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async generateOutstandingAmountsReport() {
        try {
            this.safeShowLoading();
            const asOf = this.getLocalRange().end;
            const outstandingData = await this.getOutstandingData(asOf);
            outstandingData.shopName = await this.getShopName();
            outstandingData.asOf = asOf;
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
        await this.getShopSettings();
        switch (type) {
            case 'monthly':
                return await this.generateMonthlyReport();
            case 'customer-collection':
                return await this.generateCustomerCollection();
            case 'outstanding':
                return await this.generateOutstandingReport();
            case 'receivable':
                return await this.generateReceivableReceived();
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
            case 'upcoming':
                return await this.generateUpcomingDues();
            case 'defaulters':
                return await this.generateDefaulterList();
            case 'ledger':
                return await this.generateSupplierLedger();
            case 'purchase-remaining':
                return await this.generatePurchaseRemaining();
            case 'universal':
                return await this.generateUniversalReport();
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
                    COALESCE(SUM(amount), 0) as total_amount,
                    COUNT(*) as transaction_count
                FROM cash_sale_collections
                WHERE DATE(collection_date) BETWEEN DATE(?) AND DATE(?)
                  AND amount > 0
                  AND (is_deleted = 0 OR is_deleted IS NULL)
            `, [range.start, range.end], [{ total_amount: 0, transaction_count: 0 }]);
            const advances = await this.safeQuery(`
                SELECT
                    COALESCE(SUM(advance_received), 0) as total_amount,
                    COUNT(*) as transaction_count
                FROM customer_purchases
                WHERE DATE(start_date) BETWEEN DATE(?) AND DATE(?)
                  AND COALESCE(advance_received, 0) > 0
                  AND (is_deleted = 0 OR is_deleted IS NULL)
            `, [range.start, range.end], [{ total_amount: 0, transaction_count: 0 }]);

            return {
                installments: { total_amount: cashCollected, transaction_count: paymentRows.length },
                cashSales: cashSaleCollections[0] || { total_amount: 0, transaction_count: 0 },
                advances: advances[0] || { total_amount: 0, transaction_count: 0 },
                payments: paymentRows,
                dateRange: `${range.start} to ${range.end}`
            };
        } catch (error) {
            console.error('Error in getMonthlyCollectionData:', error);
            const range = this.getLocalRange();
            return {
                installments: { total_amount: 0, transaction_count: 0 },
                cashSales: { total_amount: 0, transaction_count: 0 },
                advances: { total_amount: 0, transaction_count: 0 },
                payments: [],
                dateRange: `${range.start} to ${range.end}`,
                error: error.message
            };
        }
    }

    async generateOutstandingReport() {
        return await this.generateOutstandingAmountsReport();
    }

    async generateReceivableReceived() {
        const choice = await this.promptReceivableCustomers();
        if (!choice) return;
        try {
            this.safeShowLoading();
            const asOf = this.getLocalRange().end;
            const shopName = await this.getShopName();
            const raw = await this.safeQuery(`
                SELECT
                    i.id, i.installment_no, i.due_date,
                    COALESCE(i.original_amount, i.amount) as original_amount,
                    COALESCE(i.paid_amount, 0) as paid_amount,
                    c.customer_name, c.account_no, c.phone,
                    c.id as customer_id,
                    COALESCE(p.item_name, '') as item_name
                FROM installments i
                JOIN customer_purchases cp ON i.purchase_id = cp.id
                JOIN customers c ON cp.customer_id = c.id
                LEFT JOIN stock s ON cp.stock_id = s.id
                LEFT JOIN products p ON s.product_id = p.id
                WHERE (i.is_deleted = 0 OR i.is_deleted IS NULL)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                  AND cp.status != 'deleted'
                ORDER BY i.due_date, c.account_no, i.installment_no
            `, [], []);
            const payments = await this.safeQuery(`
                SELECT customer_id, amount, payment_date, type, is_deleted FROM payments
            `, [], []);
            const selectedIds = choice.mode === 'ids' ? choice.ids : null;
            const paper = (typeof InstallmentEngine !== 'undefined' && InstallmentEngine.buildReceivableCustomerRows)
                ? InstallmentEngine.buildReceivableCustomerRows(raw, payments, asOf, selectedIds)
                : { rows: [], footer: { short: 0, current: 0, received: 0, remaining_to_end: 0 } };
            if (!paper.rows.length) {
                this.renderReport(this.emptyReport('Installment Receivable and Received'));
                return;
            }
            const inner = `
                <p>Who to contact. Short through ${asOf}. Remaining due through ${asOf}.</p>
                <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Acc#</th>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Short</th>
                            <th>Current</th>
                            <th>Recvd</th>
                            <th>Remaining to end</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paper.rows.map((r) => `
                            <tr>
                                <td>${r.account_no}</td>
                                <td>${r.name}</td>
                                <td>${r.phone}</td>
                                <td class="amount">${this.safeFormatCurrency(r.short)}</td>
                                <td class="amount">${this.safeFormatCurrency(r.current)}</td>
                                <td class="amount">${this.safeFormatCurrency(r.received)}</td>
                                <td class="amount">${this.safeFormatCurrency(r.remaining_to_end)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3"><strong>Totals</strong></td>
                            <td class="amount"><strong>${this.safeFormatCurrency(paper.footer.short)}</strong></td>
                            <td class="amount"><strong>${this.safeFormatCurrency(paper.footer.current)}</strong></td>
                            <td class="amount"><strong>${this.safeFormatCurrency(paper.footer.received)}</strong></td>
                            <td class="amount"><strong>${this.safeFormatCurrency(paper.footer.remaining_to_end)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                </div>
            `;
            this.renderReport(this.wrapPanel('Installment Receivable and Received', `As of ${asOf}`, inner, shopName));
        } catch (error) {
            console.error('Error generating receivable report:', error);
            this.safeShowNotification('Failed to generate receivable report', 'error');
        } finally {
            this.safeHideLoading();
        }
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

    async getOutstandingData(asOf) {
        try {
            const asOfDate = asOf || this.getLocalRange().end;
            const rawRows = await this.safeQuery(`
                SELECT
                    i.id, i.installment_no, i.due_date, i.status,
                    COALESCE(i.original_amount, i.amount) as original_amount,
                    COALESCE(i.paid_amount, 0) as paid_amount,
                    COALESCE(c.customer_name, 'N/A') as customer_name,
                    COALESCE(c.account_no, 'N/A') as account_no,
                    COALESCE(c.phone, 'N/A') as phone,
                    c.id as customer_id,
                    COALESCE(p.item_name, '') as item_name
                FROM installments i
                JOIN customer_purchases cp ON i.purchase_id = cp.id
                JOIN customers c ON cp.customer_id = c.id
                LEFT JOIN stock s ON cp.stock_id = s.id
                LEFT JOIN products p ON s.product_id = p.id
                WHERE (COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0)) > 0
                  AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                  AND cp.status != 'deleted'
                ORDER BY i.due_date ASC
            `, [], []);
            const lastPayRows = await this.safeQuery(`
                SELECT customer_id, MAX(payment_date) as last_payment_date
                FROM payments
                WHERE (type IS NULL OR type = 'payment') AND (is_deleted = 0 OR is_deleted IS NULL)
                GROUP BY customer_id
            `, [], []);
            const lastPayByCustomer = new Map();
            for (const row of lastPayRows) {
                lastPayByCustomer.set(row.customer_id, row.last_payment_date);
            }
            const grouped = (typeof InstallmentEngine !== 'undefined' && InstallmentEngine.groupCustomerDues)
                ? InstallmentEngine.groupCustomerDues(rawRows, asOfDate)
                : [];
            const installmentDues = grouped.map((g) => ({
                customer_name: g.customer_name,
                account_no: g.account_no,
                phone: g.phone,
                short: g.short,
                current: g.current,
                total: g.total,
                last_payment_date: lastPayByCustomer.get(g.customer_id) || null
            }));

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
            const range = this.getLocalRange();
            
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
            `, [range.start, range.end], []);
            
            return data || [];
        } catch (error) {
            console.error('Error in getCashSalesReportData:', error);
            return [];
        }
    }

    async getSupplierPaymentsReportData() {
        try {
            const range = this.getLocalRange();
            
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
            `, [range.start, range.end], []);
            
            return data || [];
        } catch (error) {
            console.error('Error in getSupplierPaymentsReportData:', error);
            return [];
        }
    }

    async getExpenseReportData() {
        try {
            const range = this.getLocalRange();
            
            const expenses = await this.safeQuery(`
                SELECT 
                    e.date,
                    et.name as expense_type,
                    e.amount,
                    e.notes
                FROM expenses e
                JOIN expense_types et ON e.expense_type_id = et.id
                WHERE DATE(e.date) BETWEEN DATE(?) AND DATE(?)
                  AND et.name != 'Staff Salary'
                ORDER BY e.date DESC
            `, [range.start, range.end], []);

            const expensesByType = await this.safeQuery(`
                SELECT 
                    et.name as expense_type,
                    SUM(e.amount) as total_amount,
                    COUNT(e.id) as transaction_count
                FROM expenses e
                JOIN expense_types et ON e.expense_type_id = et.id
                WHERE DATE(e.date) BETWEEN DATE(?) AND DATE(?)
                  AND et.name != 'Staff Salary'
                GROUP BY et.id, et.name
                ORDER BY total_amount DESC
            `, [range.start, range.end], []);

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
            const range = this.getLocalRange();
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
            `, [range.start, range.end, range.start, range.end], []);

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
        const advances = data.advances || { total_amount: 0, transaction_count: 0 };
        const payments = data.payments || [];
        const totalCollections = (data.installments.total_amount || 0) + (data.cashSales.total_amount || 0) + (advances.total_amount || 0);
        const totalTransactions = (data.installments.transaction_count || 0) + (data.cashSales.transaction_count || 0) + (advances.transaction_count || 0);
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
                    <h4>Advances</h4>
                    <div class="amount">${this.safeFormatCurrency(advances.total_amount || 0)}</div>
                    <p>${advances.transaction_count || 0} advances</p>
                </div>
                <div class="summary-card">
                    <h4>Cash Sales</h4>
                    <div class="amount">${this.safeFormatCurrency(data.cashSales.total_amount || 0)}</div>
                    <p>${data.cashSales.transaction_count || 0} sales</p>
                </div>
            </div>
            <div class="section">
                <h4>Installment Receipts</h4>
                ${payments.length > 0 ? `
                    <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Customer</th>
                                <th>Receipt no</th>
                                <th>Amount</th>
                                <th>Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.map((p) => `
                                <tr>
                                    <td>${this.safeFormatDate(p.payment_date)}</td>
                                    <td>${p.customer_name || 'N/A'}</td>
                                    <td>${p.receipt_no || 'N/A'}</td>
                                    <td class="amount">${this.safeFormatCurrency(p.amount)}</td>
                                    <td>Installment</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3"><strong>Total</strong></td>
                                <td class="amount"><strong>${this.safeFormatCurrency(data.installments.total_amount || 0)}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                    </div>
                ` : '<p class="text-muted">No installment receipts for this period.</p>'}
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
        const sumShort = installmentDues.reduce((s, d) => s + (Number(d.short) || 0), 0);
        const sumCurrent = installmentDues.reduce((s, d) => s + (Number(d.current) || 0), 0);
        const sumTotal = installmentDues.reduce((s, d) => s + (Number(d.total) || 0), 0);
        const inner = `
            ${errorMessage}
            <div class="section">
                <h4>Installment Dues</h4>
                ${installmentDues.length > 0 ? `
                    <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Account</th>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Short</th>
                                <th>Current</th>
                                <th>Total</th>
                                <th>Last payment</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${installmentDues.map(due => `
                                <tr>
                                    <td>${due.account_no || 'N/A'}</td>
                                    <td>${due.customer_name || 'N/A'}</td>
                                    <td>${due.phone || 'N/A'}</td>
                                    <td class="amount">${this.safeFormatCurrency(due.short)}</td>
                                    <td class="amount">${this.safeFormatCurrency(due.current)}</td>
                                    <td class="amount">${this.safeFormatCurrency(due.total)} ${this.whatsAppButton(due.phone, {
                                        name: due.customer_name,
                                        account: due.account_no,
                                        amount: this.safeFormatCurrency(due.total),
                                        due_date: data.asOf || ''
                                    })}</td>
                                    <td>${due.last_payment_date ? this.safeFormatDate(due.last_payment_date) : 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3"><strong>Totals</strong></td>
                                <td class="amount"><strong>${this.safeFormatCurrency(sumShort)}</strong></td>
                                <td class="amount"><strong>${this.safeFormatCurrency(sumCurrent)}</strong></td>
                                <td class="amount"><strong>${this.safeFormatCurrency(sumTotal)}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
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
        const asOfLabel = data.asOf ? `As of ${data.asOf}` : 'All dates';
        this.renderReport(this.wrapPanel('Outstanding Amounts Report', asOfLabel, inner, data.shopName));
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
            <p class="text-muted">Staff salary is in Staff / Universal, not here.</p>
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
                SELECT csc.collection_date as entry_date, csc.amount, 'Cash Sale' as source,
                       COALESCE(c.customer_name, 'Walk-in Customer') as party
                FROM cash_sale_collections csc
                LEFT JOIN customers c ON csc.customer_id = c.id
                WHERE DATE(csc.collection_date) BETWEEN DATE(?) AND DATE(?)
                  AND csc.amount > 0
                  AND (csc.is_deleted = 0 OR csc.is_deleted IS NULL)
                ORDER BY csc.collection_date
            `, [range.start, range.end], []);
            const advances = await this.safeQuery(`
                SELECT cp.start_date as entry_date, cp.advance_received as amount, 'Advance' as source,
                       COALESCE(c.customer_name, c.account_no, 'Customer') as party
                FROM customer_purchases cp
                LEFT JOIN customers c ON cp.customer_id = c.id
                WHERE DATE(cp.start_date) BETWEEN DATE(?) AND DATE(?)
                  AND COALESCE(cp.advance_received, 0) > 0
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                ORDER BY cp.start_date
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
            const advanceTotal = advances.reduce((s, r) => s + (Number(r.amount) || 0), 0);
            const inflows = cashCollected + cashSales.reduce((s, r) => s + (r.amount || 0), 0) + advanceTotal;
            const outflows = expenses.reduce((s, r) => s + (r.amount || 0), 0)
                + supplierPays.reduce((s, r) => s + (r.amount || 0), 0);
            if (inflows === 0 && outflows === 0) {
                this.renderReport(this.emptyReport('Daily Cash Book'));
                return;
            }
            const rows = [
                ...paymentRows.map((p) => ({ date: p.payment_date, source: 'Installment', party: p.customer_name || p.receipt_no || '', amount: p.amount, kind: 'in' })),
                ...advances.map((r) => ({ date: r.entry_date, source: r.source, party: r.party, amount: r.amount, kind: 'in' })),
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
            const asOf = this.getLocalRange().end;
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
                  AND strftime('%Y-%m', i.due_date) < strftime('%Y-%m', ?)
                  AND (COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0)) > 0
                GROUP BY c.id, c.customer_name, c.account_no, c.phone
                ORDER BY (bucket_1_30 + bucket_31_60 + bucket_61_90 + bucket_90_plus) DESC
            `, [asOf, asOf, asOf, asOf, asOf], []);
            if (!rows.length) {
                this.renderReport(this.emptyReport('Overdue Aging'));
                return;
            }
            const foot = rows.reduce((acc, r) => {
                acc.b1 += Number(r.bucket_1_30) || 0;
                acc.b2 += Number(r.bucket_31_60) || 0;
                acc.b3 += Number(r.bucket_61_90) || 0;
                acc.b4 += Number(r.bucket_90_plus) || 0;
                return acc;
            }, { b1: 0, b2: 0, b3: 0, b4: 0 });
            const totalShort = foot.b1 + foot.b2 + foot.b3 + foot.b4;
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
                            <th>Total Short</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((r) => {
                            const rowTotal = (Number(r.bucket_1_30) || 0) + (Number(r.bucket_31_60) || 0)
                                + (Number(r.bucket_61_90) || 0) + (Number(r.bucket_90_plus) || 0);
                            return `
                            <tr>
                                <td>${r.customer_name}</td>
                                <td>${r.account_no}</td>
                                <td>${r.phone}</td>
                                <td>${this.safeFormatCurrency(r.bucket_1_30)}</td>
                                <td>${this.safeFormatCurrency(r.bucket_31_60)}</td>
                                <td>${this.safeFormatCurrency(r.bucket_61_90)}</td>
                                <td>${this.safeFormatCurrency(r.bucket_90_plus)}</td>
                                <td>${this.safeFormatCurrency(rowTotal)}</td>
                            </tr>
                        `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3"><strong>Totals</strong></td>
                            <td><strong>${this.safeFormatCurrency(foot.b1)}</strong></td>
                            <td><strong>${this.safeFormatCurrency(foot.b2)}</strong></td>
                            <td><strong>${this.safeFormatCurrency(foot.b3)}</strong></td>
                            <td><strong>${this.safeFormatCurrency(foot.b4)}</strong></td>
                            <td><strong>${this.safeFormatCurrency(totalShort)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                </div>
            `;
            this.renderReport(this.wrapPanel('Overdue Aging', `As of ${asOf}`, inner, shopName));
        } catch (error) {
            console.error('Error generating overdue aging:', error);
            this.safeShowNotification('Failed to generate overdue aging', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async generateCustomerStatement() {
        try {
            const customerId = await this.promptCustomerId();
            if (!customerId) {
                return;
            }
            this.safeShowLoading();
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
            const asOf = this.getLocalRange().end;
            const installmentRows = await this.safeQuery(`
                SELECT i.due_date, COALESCE(i.original_amount, i.amount) as original_amount, COALESCE(i.paid_amount, 0) as paid_amount
                FROM installments i
                JOIN customer_purchases cp ON i.purchase_id = cp.id
                WHERE cp.customer_id = ?
                  AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
            `, [customerId], []);
            const dues = (typeof InstallmentEngine !== 'undefined' && InstallmentEngine.customerDueSummary)
                ? InstallmentEngine.customerDueSummary(installmentRows, asOf)
                : { short: 0, current: 0, total: 0 };
            const bookRemaining = Math.max(0, remaining);
            const paymentRows = (payments || []).filter((p) => (p.type || 'payment') === 'payment');
            let photoHtml = '';
            if (customer.photo_path && window._ipcRenderer) {
                try {
                    const photo = await window._ipcRenderer.invoke('customer-photo-url', customer.photo_path);
                    if (photo && photo.ok && photo.data_url) {
                        photoHtml = `<img class="report-shop-logo" src="${photo.data_url}" alt="Customer">`;
                    }
                } catch (_) { /* optional */ }
            }
            const inner = `
                ${photoHtml}
                <p><strong>Customer:</strong> ${customer.customer_name || ''} &nbsp;
                   <strong>Account:</strong> ${customer.account_no || 'N/A'} &nbsp;
                   <strong>Phone:</strong> ${customer.phone || 'N/A'}</p>
                <p><strong>Book remaining:</strong> ${this.safeFormatCurrency(bookRemaining)} &nbsp;
                   <strong>Short:</strong> ${this.safeFormatCurrency(dues.short)} &nbsp;
                   <strong>Current:</strong> ${this.safeFormatCurrency(dues.current)} &nbsp;
                   <strong>Total (as of ${asOf}):</strong> ${this.safeFormatCurrency(dues.total)}</p>
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
                    ${paymentRows.length ? `
                    <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>Date</th><th>Amount</th><th>Receipt</th><th>Type</th><th>Notes</th></tr></thead>
                        <tbody>
                            ${paymentRows.map((p) => `
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
        if (typeof app === 'undefined' || typeof app.showModal !== 'function') {
            this.safeShowNotification('Customer picker is unavailable', 'error');
            return null;
        }
        return await new Promise((resolve) => {
            const options = customers.map((c) => {
                const label = `${c.customer_name || 'Customer'} (${c.account_no || c.phone || c.id})`;
                return `<option value="${c.id}">${Utils.escapeHtml ? Utils.escapeHtml(label) : label}</option>`;
            }).join('');
            const html = `
                <div class="modal">
                    <div class="modal-content modal-sm">
                        <div class="modal-header">
                            <h3>Select Customer</h3>
                            <button class="modal-close" type="button">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label class="form-label">Customer</label>
                                <select id="statement-customer-id" class="form-input">${options}</select>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" id="statement-cancel-btn">Cancel</button>
                            <button type="button" class="btn btn-primary" id="statement-ok-btn">Generate</button>
                        </div>
                    </div>
                </div>
            `;
            app.showModal(html);
            let settled = false;
            const originalClose = typeof app.closeModal === 'function' ? app.closeModal.bind(app) : () => {};
            const finish = (value) => {
                if (settled) return;
                settled = true;
                app.closeModal = originalClose;
                originalClose();
                resolve(Number.isFinite(value) ? value : null);
            };
            app.closeModal = () => finish(null);
            const select = document.getElementById('statement-customer-id');
            const okBtn = document.getElementById('statement-ok-btn');
            const cancelBtn = document.getElementById('statement-cancel-btn');
            if (okBtn) okBtn.addEventListener('click', () => finish(select ? parseInt(select.value, 10) : null));
            if (cancelBtn) cancelBtn.addEventListener('click', () => finish(null));
        });
    }

    async promptReceivableCustomers() {
        const customers = await this.safeQuery(
            'SELECT id, customer_name, account_no, phone FROM customers ORDER BY customer_name',
            [],
            []
        );
        if (!customers.length) {
            this.safeShowNotification('No customers found', 'error');
            return null;
        }
        if (typeof app === 'undefined' || typeof app.showModal !== 'function') {
            this.safeShowNotification('Customer picker is unavailable', 'error');
            return null;
        }
        const esc = (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml.bind(Utils) : (v) => String(v || '');
        return await new Promise((resolve) => {
            const html = `
                <div class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Select Customers</h3>
                            <button class="modal-close" type="button">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label class="form-label">Search</label>
                                <input type="search" id="receivable-customer-search" class="form-input" placeholder="Account or name">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Customers</label>
                                <select id="receivable-customer-list" class="form-input" size="8"></select>
                            </div>
                            <div class="form-group">
                                <button type="button" class="btn btn-sm btn-primary" id="receivable-add-btn">Add</button>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Selected</label>
                                <div id="receivable-selected-chips"></div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" id="receivable-cancel-btn">Cancel</button>
                            <button type="button" class="btn btn-secondary" id="receivable-all-btn">All customers</button>
                            <button type="button" class="btn btn-primary" id="receivable-selected-btn">Generate selected</button>
                        </div>
                    </div>
                </div>
            `;
            app.showModal(html);
            let settled = false;
            const originalClose = typeof app.closeModal === 'function' ? app.closeModal.bind(app) : () => {};
            const finish = (value) => {
                if (settled) return;
                settled = true;
                app.closeModal = originalClose;
                originalClose();
                resolve(value);
            };
            app.closeModal = () => finish(null);
            const searchEl = document.getElementById('receivable-customer-search');
            const listEl = document.getElementById('receivable-customer-list');
            const chipsEl = document.getElementById('receivable-selected-chips');
            const addBtn = document.getElementById('receivable-add-btn');
            const allBtn = document.getElementById('receivable-all-btn');
            const selectedBtn = document.getElementById('receivable-selected-btn');
            const cancelBtn = document.getElementById('receivable-cancel-btn');
            const selectedIds = [];
            const customerById = new Map(customers.map((c) => [Number(c.id), c]));
            const matches = (c, q) => {
                if (!q) return true;
                const name = String(c.customer_name || '').toLowerCase();
                const acc = String(c.account_no || '').toLowerCase();
                return name.includes(q) || acc.includes(q);
            };
            const renderList = () => {
                if (!listEl) return;
                const q = String((searchEl && searchEl.value) || '').trim().toLowerCase();
                listEl.innerHTML = customers.filter((c) => matches(c, q)).map((c) => {
                    const label = `${c.customer_name || 'Customer'} (${c.account_no || c.phone || c.id})`;
                    return `<option value="${c.id}">${esc(label)}</option>`;
                }).join('');
            };
            const renderChips = () => {
                if (!chipsEl) return;
                chipsEl.innerHTML = selectedIds.map((id) => {
                    const c = customerById.get(id);
                    const label = c ? `${c.customer_name || 'Customer'} (${c.account_no || c.id})` : String(id);
                    return `<span class="status-badge">${esc(label)} <button type="button" class="btn btn-sm btn-danger" data-remove-id="${id}">Remove</button></span>`;
                }).join('');
            };
            renderList();
            renderChips();
            if (searchEl) searchEl.addEventListener('input', renderList);
            if (addBtn) addBtn.addEventListener('click', () => {
                const id = listEl ? parseInt(listEl.value, 10) : NaN;
                if (!Number.isFinite(id) || selectedIds.includes(id)) return;
                selectedIds.push(id);
                renderChips();
            });
            if (chipsEl) chipsEl.addEventListener('click', (e) => {
                const btn = e.target && e.target.closest ? e.target.closest('[data-remove-id]') : null;
                if (!btn) return;
                const id = parseInt(btn.getAttribute('data-remove-id'), 10);
                const idx = selectedIds.indexOf(id);
                if (idx >= 0) selectedIds.splice(idx, 1);
                renderChips();
            });
            if (allBtn) allBtn.addEventListener('click', () => finish({ mode: 'all' }));
            if (selectedBtn) selectedBtn.addEventListener('click', () => {
                if (!selectedIds.length) {
                    this.safeShowNotification('Add customers or use All customers', 'error');
                    return;
                }
                finish({ mode: 'ids', ids: selectedIds.slice() });
            });
            if (cancelBtn) cancelBtn.addEventListener('click', () => finish(null));
        });
    }

    async generateProfitSnapshot() {
        try {
            this.safeShowLoading();
            const range = this.getLocalRange();
            const shopName = await this.getShopName();
            const installmentProfit = await this.safeQuery(`
                SELECT COALESCE(SUM(cp.profit_amount), 0) as profit
                FROM customer_purchases cp
                WHERE DATE(cp.start_date) BETWEEN DATE(?) AND DATE(?)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
            `, [range.start, range.end], [{ profit: 0 }]);
            const cashProfit = await this.safeQuery(`
                SELECT COALESCE(SUM(
                    cs.agreed_price
                    - COALESCE(s.purchase_price, p.purchase_price) * COALESCE(s.quantity, 1)
                ), 0) as profit
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
    
    whatsAppButton(phone, values) {
        if (typeof Utils === 'undefined' || !Utils.whatsAppUrl) return '';
        const settings = this._shopSettings || {};
        const template = settings.whatsapp_template || 'Assalam-o-Alaikum {name}, account {account}. Due {amount} on {due_date}. {shop}';
        const text = Utils.fillWhatsAppTemplate(template, {
            name: values.name || '',
            account: values.account || '',
            amount: values.amount || '',
            due_date: values.due_date || '',
            shop: settings.shop_name || this._shopName || ''
        });
        const url = Utils.whatsAppUrl(phone, text);
        if (!url) return '';
        return `<a class="btn btn-sm btn-success" href="${url}" target="_blank" rel="noopener">WhatsApp</a>`;
    }

    async generateUpcomingDues() {
        try {
            this.safeShowLoading();
            const today = this.formatDateForInput(new Date());
            const end30 = this.formatDateForInput(new Date(Date.now() + 30 * 86400000));
            const todayYm = String(today).slice(0, 7);
            const rows = await this.safeQuery(`
                SELECT
                    i.id, i.installment_no, i.due_date,
                    COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) as remaining,
                    CAST(julianday(i.due_date) - julianday(?) AS INTEGER) as days_until,
                    c.customer_name, c.account_no, c.phone,
                    c.id as customer_id,
                    COALESCE(p.item_name, '') as item_name
                FROM installments i
                JOIN customer_purchases cp ON i.purchase_id = cp.id
                JOIN customers c ON cp.customer_id = c.id
                LEFT JOIN stock s ON cp.stock_id = s.id
                LEFT JOIN products p ON s.product_id = p.id
                WHERE (i.is_deleted = 0 OR i.is_deleted IS NULL)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                  AND DATE(i.due_date) >= DATE(?)
                  AND DATE(i.due_date) <= DATE(?)
                  AND (COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0)) > 0
                ORDER BY i.due_date, c.customer_name
            `, [today, today, end30], []);
            const byCustomer = new Map();
            for (const row of rows) {
                const dueYm = String(row.due_date || '').slice(0, 7);
                if (dueYm < todayYm) continue;
                const id = row.customer_id;
                if (!byCustomer.has(id)) {
                    byCustomer.set(id, {
                        customer_name: row.customer_name,
                        phone: row.phone,
                        account_no: row.account_no,
                        amount: 0,
                        due_date: row.due_date,
                        days_until: Number(row.days_until)
                    });
                }
                const g = byCustomer.get(id);
                g.amount += Number(row.remaining) || 0;
                if (String(row.due_date) < String(g.due_date)) {
                    g.due_date = row.due_date;
                    g.days_until = Number(row.days_until);
                }
            }
            const grouped = Array.from(byCustomer.values());
            if (!grouped.length) {
                this.renderReport(this.emptyReport('Upcoming Dues'));
                return;
            }
            const asOf = this.getLocalRange().end;
            const shortRows = await this.safeQuery(`
                SELECT due_date, COALESCE(original_amount, amount) as original_amount, COALESCE(paid_amount, 0) as paid_amount
                FROM installments
                WHERE (is_deleted = 0 OR is_deleted IS NULL)
                  AND (COALESCE(original_amount, amount) - COALESCE(paid_amount, 0)) > 0
            `, [], []);
            const totalShort = (typeof InstallmentEngine !== 'undefined' && InstallmentEngine.totalShort)
                ? InstallmentEngine.totalShort(shortRows, asOf)
                : 0;
            const inner = `
                <p><strong>Total Short (as of ${asOf}):</strong> ${this.safeFormatCurrency(totalShort)}</p>
                <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Phone</th>
                            <th>Account</th>
                            <th>Amount</th>
                            <th>Next due date</th>
                            <th>Days until</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${grouped.map((r) => `
                            <tr>
                                <td>${r.customer_name || ''}</td>
                                <td>${r.phone || ''}</td>
                                <td>${r.account_no || ''}</td>
                                <td class="amount">${this.safeFormatCurrency(r.amount)}</td>
                                <td>${this.safeFormatDate(r.due_date)}</td>
                                <td>${r.days_until}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
            `;
            this.renderReport(this.wrapPanel('Upcoming Dues', `${today} to ${end30}`, inner));
        } catch (error) {
            console.error(error);
            this.safeShowNotification('Failed to generate upcoming dues', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async generateDefaulterList() {
        try {
            this.safeShowLoading();
            const asOf = this.getLocalRange().end;
            const rows = await this.safeQuery(`
                SELECT
                    i.id, i.installment_no, i.due_date, i.status,
                    COALESCE(i.original_amount, i.amount) as original_amount,
                    COALESCE(i.paid_amount, 0) as paid_amount,
                    c.customer_name, c.account_no, c.phone, c.id as customer_id,
                    COALESCE(p.item_name, '') as item_name
                FROM installments i
                JOIN customer_purchases cp ON i.purchase_id = cp.id
                JOIN customers c ON cp.customer_id = c.id
                LEFT JOIN stock s ON cp.stock_id = s.id
                LEFT JOIN products p ON s.product_id = p.id
                WHERE (i.is_deleted = 0 OR i.is_deleted IS NULL)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                  AND strftime('%Y-%m', i.due_date) < strftime('%Y-%m', ?)
                  AND (COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0)) > 0
                ORDER BY i.due_date, c.customer_name
            `, [asOf], []);
            const lastPayRows = await this.safeQuery(`
                SELECT customer_id, MAX(payment_date) as last_payment_date
                FROM payments
                WHERE (type IS NULL OR type = 'payment') AND (is_deleted = 0 OR is_deleted IS NULL)
                GROUP BY customer_id
            `, [], []);
            const lastPayByCustomer = new Map();
            for (const row of lastPayRows) {
                lastPayByCustomer.set(row.customer_id, row.last_payment_date);
            }
            const grouped = (typeof InstallmentEngine !== 'undefined' && InstallmentEngine.groupCustomerDues)
                ? InstallmentEngine.groupCustomerDues(rows, asOf)
                : [];
            const oldestShortDue = new Map();
            for (const row of rows) {
                const leftover = Math.max(0, (Number(row.original_amount) || 0) - (Number(row.paid_amount) || 0));
                if (leftover <= 0) continue;
                const dueYm = String(row.due_date || '').slice(0, 7);
                const asOfYm = String(asOf || '').slice(0, 7);
                if (!dueYm || !asOfYm || dueYm >= asOfYm) continue;
                const prev = oldestShortDue.get(row.customer_id);
                if (!prev || String(row.due_date) < String(prev)) {
                    oldestShortDue.set(row.customer_id, row.due_date);
                }
            }
            const defaulters = grouped.filter((g) => g.short > 0).map((g) => {
                const oldest = oldestShortDue.get(g.customer_id) || g.due_date;
                const days = this.daysBetween(oldest, asOf);
                return {
                    customer_name: g.customer_name,
                    phone: g.phone,
                    account_no: g.account_no,
                    short: g.short,
                    last_payment_date: lastPayByCustomer.get(g.customer_id) || null,
                    days_since: days,
                    due_date: oldest
                };
            });
            if (!defaulters.length) {
                this.renderReport(this.emptyReport('Defaulter List'));
                return;
            }
            const totalShort = defaulters.reduce((sum, r) => sum + (Number(r.short) || 0), 0);
            const inner = `
                <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Account</th>
                            <th>Short</th>
                            <th>Last payment</th>
                            <th>Days since oldest short due</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${defaulters.map((r) => `
                            <tr>
                                <td>${r.customer_name || ''}</td>
                                <td>${r.phone || ''}</td>
                                <td>${r.account_no || ''}</td>
                                <td class="amount">${this.safeFormatCurrency(r.short)} ${this.whatsAppButton(r.phone, {
                                    name: r.customer_name,
                                    account: r.account_no,
                                    amount: this.safeFormatCurrency(r.short),
                                    due_date: r.due_date
                                })}</td>
                                <td>${r.last_payment_date ? this.safeFormatDate(r.last_payment_date) : '-'}</td>
                                <td>${r.days_since}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3"><strong>Total Short</strong></td>
                            <td class="amount"><strong>${this.safeFormatCurrency(totalShort)}</strong></td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
                </div>
            `;
            this.renderReport(this.wrapPanel('Defaulter List', `As of ${asOf}`, inner));
        } catch (error) {
            console.error(error);
            this.safeShowNotification('Failed to generate defaulter list', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    daysBetween(fromDate, toDate) {
        const parse = (value) => {
            const parts = String(value || '').split('-');
            if (parts.length < 3) return null;
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        };
        const from = parse(fromDate);
        const to = parse(toDate);
        if (!from || !to) return 0;
        return Math.round((to.getTime() - from.getTime()) / 86400000);
    }

    async generateSupplierLedger() {
        try {
            this.safeShowLoading();
            const range = this.getLocalRange();
            const suppliers = await this.safeQuery('SELECT id, supplier_name FROM suppliers ORDER BY supplier_name', [], []);
            if (!suppliers.length) {
                this.renderReport(this.emptyReport('Supplier Ledger'));
                return;
            }
            const sections = [];
            for (const supplier of suppliers) {
                const purchases = await this.safeQuery(`
                    SELECT s.stock_date as entry_date, COALESCE(s.purchase_price, pr.purchase_price) * COALESCE(s.quantity, 1) as amount,
                           'Purchase' as particular, COALESCE(pr.item_name, s.stock_no) as detail
                    FROM stock s
                    JOIN products pr ON s.product_id = pr.id
                    WHERE s.supplier_id = ?
                      AND DATE(s.stock_date) BETWEEN DATE(?) AND DATE(?)
                    ORDER BY s.stock_date
                `, [supplier.id, range.start, range.end], []);
                const payments = await this.safeQuery(`
                    SELECT payment_date as entry_date, amount, 'Payment' as particular, COALESCE(notes, '') as detail
                    FROM supplier_payments
                    WHERE supplier_id = ?
                      AND DATE(payment_date) BETWEEN DATE(?) AND DATE(?)
                    ORDER BY payment_date
                `, [supplier.id, range.start, range.end], []);
                const openingPurchases = await this.safeQuery(`
                    SELECT COALESCE(SUM(COALESCE(s.purchase_price, pr.purchase_price) * COALESCE(s.quantity, 1)), 0) as total
                    FROM stock s JOIN products pr ON s.product_id = pr.id
                    WHERE s.supplier_id = ? AND DATE(s.stock_date) < DATE(?)
                `, [supplier.id, range.start], [{ total: 0 }]);
                const openingPays = await this.safeQuery(`
                    SELECT COALESCE(SUM(amount), 0) as total
                    FROM supplier_payments
                    WHERE supplier_id = ? AND DATE(payment_date) < DATE(?)
                `, [supplier.id, range.start], [{ total: 0 }]);
                let balance = (Number(openingPurchases[0] && openingPurchases[0].total) || 0)
                    - (Number(openingPays[0] && openingPays[0].total) || 0);
                const rows = [
                    ...purchases.map((r) => ({ ...r, inAmt: Number(r.amount) || 0, outAmt: 0 })),
                    ...payments.map((r) => ({ ...r, inAmt: 0, outAmt: Number(r.amount) || 0 }))
                ].sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)));
                if (!rows.length && balance === 0) continue;
                const opening = balance;
                const body = rows.map((r) => {
                    balance += r.inAmt - r.outAmt;
                    return `<tr>
                        <td>${this.safeFormatDate(r.entry_date)}</td>
                        <td>${r.particular}${r.detail ? ' — ' + r.detail : ''}</td>
                        <td>${r.inAmt ? this.safeFormatCurrency(r.inAmt) : ''}</td>
                        <td>${r.outAmt ? this.safeFormatCurrency(r.outAmt) : ''}</td>
                        <td>${this.safeFormatCurrency(balance)}</td>
                    </tr>`;
                }).join('');
                sections.push(`
                    <h4>${supplier.supplier_name}</h4>
                    <p>Opening: ${this.safeFormatCurrency(opening)} | Closing: ${this.safeFormatCurrency(balance)}</p>
                    <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>Date</th><th>Particular</th><th>In</th><th>Out</th><th>Balance</th></tr></thead>
                        <tbody>${body || '<tr><td colspan="5">No movement this period</td></tr>'}</tbody>
                    </table>
                    </div>
                `);
            }
            this.renderReport(this.wrapPanel('Supplier Ledger', `${range.start} to ${range.end}`, sections.join('') || '<p class="text-muted">No supplier activity.</p>'));
        } catch (error) {
            console.error(error);
            this.safeShowNotification('Failed to generate supplier ledger', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async generatePurchaseRemaining() {
        try {
            this.safeShowLoading();
            const rows = await this.safeQuery(`
                SELECT
                    cp.id, cp.start_date, cp.sale_price, cp.advance_received, cp.total_amount, cp.status,
                    c.customer_name, c.account_no,
                    COALESCE(p.item_name, '') as item_name,
                    COALESCE(s.stock_no, '') as stock_no,
                    COALESCE(SUM(COALESCE(i.original_amount, i.amount)), 0) as original_sum,
                    COALESCE(SUM(COALESCE(i.paid_amount, 0)), 0) as paid_sum
                FROM customer_purchases cp
                JOIN customers c ON cp.customer_id = c.id
                LEFT JOIN stock s ON cp.stock_id = s.id
                LEFT JOIN products p ON s.product_id = p.id
                LEFT JOIN installments i ON i.purchase_id = cp.id AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
                WHERE (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                GROUP BY cp.id
                ORDER BY cp.start_date DESC
            `, [], []);
            if (!rows.length) {
                this.renderReport(this.emptyReport('Purchase-wise Remaining'));
                return;
            }
            const inner = `
                <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Account</th>
                            <th>Item</th>
                            <th>Start</th>
                            <th>Original</th>
                            <th>Advance</th>
                            <th>Paid</th>
                            <th>Remaining</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((r) => {
                            const original = Number(r.original_sum) || Number(r.total_amount) || 0;
                            const paid = Number(r.paid_sum) || 0;
                            const remaining = Math.max(0, original - paid);
                            return `<tr>
                                <td>${r.customer_name || ''}</td>
                                <td>${r.account_no || ''}</td>
                                <td>${r.item_name || r.stock_no || ''}</td>
                                <td>${this.safeFormatDate(r.start_date)}</td>
                                <td>${this.safeFormatCurrency(original)}</td>
                                <td>${this.safeFormatCurrency(r.advance_received)}</td>
                                <td>${this.safeFormatCurrency(paid)}</td>
                                <td>${this.safeFormatCurrency(remaining)}</td>
                                <td>${r.status || ''}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="7"><strong>Total remaining</strong></td>
                            <td><strong>${this.safeFormatCurrency(rows.reduce((s, r) => {
                                const original = Number(r.original_sum) || Number(r.total_amount) || 0;
                                const paid = Number(r.paid_sum) || 0;
                                return s + Math.max(0, original - paid);
                            }, 0))}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
                </div>
            `;
            this.renderReport(this.wrapPanel('Purchase-wise Remaining', 'All schedules', inner));
        } catch (error) {
            console.error(error);
            this.safeShowNotification('Failed to generate purchase remaining', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async generateUniversalReport() {
        try {
            this.safeShowLoading();
            const range = this.getLocalRange();
            const installmentSales = await this.safeQuery(`
                SELECT cp.start_date as sale_date, COALESCE(p.item_name, '') as item_name,
                       'Installment' as sale_type, COALESCE(cp.advance_received, 0) as advance,
                       (SELECT MAX(0, COALESCE(SUM(COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0)), 0))
                        FROM installments i
                        WHERE i.purchase_id = cp.id AND (i.is_deleted = 0 OR i.is_deleted IS NULL)) as book_remaining,
                       COALESCE(cp.profit_amount, 0) as profit
                FROM customer_purchases cp
                LEFT JOIN stock s ON cp.stock_id = s.id
                LEFT JOIN products p ON s.product_id = p.id
                WHERE DATE(cp.start_date) BETWEEN DATE(?) AND DATE(?)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                ORDER BY cp.start_date
            `, [range.start, range.end], []);
            const cashSales = await this.safeQuery(`
                SELECT cs.sale_date, COALESCE(p.item_name, '') as item_name,
                       'Cash' as sale_type, COALESCE(cs.received_price, 0) as advance,
                       COALESCE(cs.due_amount, 0) as book_remaining,
                       COALESCE(cs.agreed_price, 0) - COALESCE(s.purchase_price, p.purchase_price, 0) * COALESCE(s.quantity, 1) as profit
                FROM cash_sales cs
                JOIN stock s ON cs.stock_id = s.id
                JOIN products p ON s.product_id = p.id
                WHERE DATE(cs.sale_date) BETWEEN DATE(?) AND DATE(?)
                ORDER BY cs.sale_date
            `, [range.start, range.end], []);
            const sales = [...installmentSales, ...cashSales].sort((a, b) => String(a.sale_date).localeCompare(String(b.sale_date)));
            const expenses = await this.safeQuery(`
                SELECT e.date, et.name as expense_name, e.amount
                FROM expenses e
                JOIN expense_types et ON e.expense_type_id = et.id
                WHERE DATE(e.date) BETWEEN DATE(?) AND DATE(?)
                  AND et.name != 'Staff Salary'
                ORDER BY e.date
            `, [range.start, range.end], []);
            const salaries = await this.safeQuery(`
                SELECT se.entry_date, st.name as staff_name, se.amount, se.type, se.month
                FROM staff_salary_entries se
                JOIN staff st ON se.staff_id = st.id
                WHERE DATE(se.entry_date) BETWEEN DATE(?) AND DATE(?)
                ORDER BY se.entry_date, st.name
            `, [range.start, range.end], []);

            const sumCol = (list, key) => list.reduce((s, r) => s + (Number(r[key]) || 0), 0);
            const salesHtml = `
                <h4>Items sold</h4>
                <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th><th>Item</th><th>Type</th>
                            <th>Advance</th><th>Book remaining</th><th>Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sales.map((r) => `
                            <tr>
                                <td>${this.safeFormatDate(r.sale_date)}</td>
                                <td>${r.item_name || ''}</td>
                                <td>${r.sale_type}</td>
                                <td>${this.safeFormatCurrency(r.advance)}</td>
                                <td>${this.safeFormatCurrency(r.book_remaining)}</td>
                                <td>${this.safeFormatCurrency(r.profit)}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="6">No sales</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3"><strong>Total</strong></td>
                            <td><strong>${this.safeFormatCurrency(sumCol(sales, 'advance'))}</strong></td>
                            <td><strong>${this.safeFormatCurrency(sumCol(sales, 'book_remaining'))}</strong></td>
                            <td><strong>${this.safeFormatCurrency(sumCol(sales, 'profit'))}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                </div>
            `;
            const expHtml = `
                <h4>Expenses</h4>
                <div class="table-container">
                <table class="data-table">
                    <thead><tr><th>Date</th><th>Expense name</th><th>Amount</th></tr></thead>
                    <tbody>
                        ${expenses.map((r) => `
                            <tr>
                                <td>${this.safeFormatDate(r.date)}</td>
                                <td>${r.expense_name}</td>
                                <td>${this.safeFormatCurrency(r.amount)}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="3">No expenses</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr><td colspan="2"><strong>Total</strong></td><td><strong>${this.safeFormatCurrency(sumCol(expenses, 'amount'))}</strong></td></tr>
                    </tfoot>
                </table>
                </div>
            `;
            const byStaff = {};
            salaries.forEach((r) => {
                const key = r.staff_name;
                if (!byStaff[key]) byStaff[key] = 0;
                byStaff[key] += Number(r.amount) || 0;
            });
            const salHtml = `
                <h4>Staff salaries</h4>
                <div class="table-container">
                <table class="data-table">
                    <thead><tr><th>Date</th><th>Staff name</th><th>Amount</th><th>Type</th></tr></thead>
                    <tbody>
                        ${salaries.map((r) => `
                            <tr>
                                <td>${this.safeFormatDate(r.entry_date)}</td>
                                <td>${r.staff_name}</td>
                                <td>${this.safeFormatCurrency(r.amount)}</td>
                                <td>${r.type === 'advance' ? 'Advance' : 'Salary'}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="4">No salary entries</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr><td colspan="2"><strong>Total collected</strong></td><td colspan="2"><strong>${this.safeFormatCurrency(sumCol(salaries, 'amount'))}</strong></td></tr>
                    </tfoot>
                </table>
                </div>
                ${Object.keys(byStaff).length ? `<p>${Object.entries(byStaff).map(([n, a]) => `${n}: ${this.safeFormatCurrency(a)}`).join(' | ')}</p>` : ''}
            `;
            this.renderReport(this.wrapPanel('Universal Report', `${range.start} to ${range.end}`, salesHtml + expHtml + salHtml));
        } catch (error) {
            console.error(error);
            this.safeShowNotification('Failed to generate universal report', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    // Cleanup method to ensure no temporary data persists
    cleanupTempData() {
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