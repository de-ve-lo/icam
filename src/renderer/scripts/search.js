class SearchManager {
    constructor() {
        this.results = [];
        this._installmentHosted = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const btn = document.getElementById('search-run-btn');
        const input = document.getElementById('search-query');
        if (btn) btn.addEventListener('click', () => this.runSearch());
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.runSearch();
            });
        }
        const closeBtn = document.getElementById('search-detail-close');
        const scrim = document.getElementById('search-detail-scrim');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeOverlay());
        if (scrim) {
            scrim.addEventListener('click', (e) => {
                if (e.target === scrim) this.closeOverlay();
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const modal = document.getElementById('modal-container');
            if (modal && modal.innerHTML.trim()) return;
            this.closeOverlay();
        });
    }

    async loadData() {}

    static classifyQuery(query, fromDate, toDate) {
        const q = String(query || '').trim();
        const from = String(fromDate || '').trim();
        const to = String(toDate || '').trim();
        if (from && to && to < from) {
            return { mode: 'invalid-range', query: q, fromDate: from, toDate: to };
        }
        if (from || to) {
            return { mode: 'dates', query: q, fromDate: from, toDate: to };
        }
        if (!q) {
            return { mode: 'empty', query: q, fromDate: from, toDate: to };
        }
        if (/^CS-\d{6}$/i.test(q)) {
            return { mode: 'invoice', query: q, fromDate: from, toDate: to };
        }
        if (/^REC-\d{8}-\d{6}$/i.test(q)) {
            return { mode: 'receipt', query: q, fromDate: from, toDate: to };
        }
        if (/^CS-\d{8}-\d{6}$/i.test(q)) {
            return { mode: 'collection', query: q, fromDate: from, toDate: to };
        }
        return { mode: 'identifier', query: q, fromDate: from, toDate: to };
    }

    async runSearch() {
        const query = (document.getElementById('search-query') || {}).value;
        const fromDate = (document.getElementById('search-from') || {}).value;
        const toDate = (document.getElementById('search-to') || {}).value;
        const classified = SearchManager.classifyQuery(query, fromDate, toDate);
        if (classified.mode === 'empty') {
            app.showNotification('Enter a search or a date range.', 'warning');
            return;
        }
        if (classified.mode === 'invalid-range') {
            app.showNotification('To date must be on or after From date', 'warning');
            return;
        }
        try {
            app.showLoading();
            let rows = [];
            let autoOpen = false;
            if (classified.mode === 'dates') {
                rows = await Database.searchByDateRange(classified.fromDate, classified.toDate, classified.query);
            } else if (classified.mode === 'invoice') {
                const sale = await Database.getCashSaleByInvoiceNo(classified.query);
                rows = sale ? [this.rowFromCashSale(sale)] : [];
                autoOpen = rows.length === 1;
            } else if (classified.mode === 'receipt') {
                const customer = await Database.getAccountByReceiptNo(classified.query);
                rows = customer ? [this.rowFromCustomer(customer)] : [];
                autoOpen = rows.length === 1;
            } else if (classified.mode === 'collection') {
                const sale = await Database.getCashSaleByCollectionReceipt(classified.query);
                rows = sale ? [this.rowFromCashSale(sale)] : [];
                autoOpen = rows.length === 1;
            } else {
                const account = await Database.getCustomerByAccountNoExact(classified.query);
                if (account) {
                    rows = [this.rowFromCustomer(account)];
                    autoOpen = true;
                } else {
                    rows = await Database.searchIdentifiers(classified.query);
                }
            }
            this.results = rows || [];
            const ids = this.results.map((r) => r.customer_id).filter(Boolean);
            if (ids.length && Database.getGuarantorsByCustomerIds) {
                const gmap = await Database.getGuarantorsByCustomerIds(ids);
                this.results.forEach((r) => {
                    r._guarantors = gmap.get(Number(r.customer_id)) || [];
                });
            }
            this.renderResults(this.results);
            if (autoOpen && this.results.length === 1) {
                await this.openResult(this.results[0]);
            }
        } catch (e) {
            console.error('Search failed:', e);
            app.showNotification('Search failed', 'error');
        } finally {
            app.hideLoading();
        }
    }

    rowFromCashSale(sale) {
        return Object.assign({ result_type: 'cash', date: sale.sale_date, cash_sale_id: sale.id, amount: sale.agreed_price, status: sale.payment_status }, sale);
    }

    rowFromCustomer(customer) {
        return Object.assign({ result_type: 'installment', customer_id: customer.id, account_no: customer.account_no, customer_name: customer.customer_name, date: customer.registration_date }, customer);
    }

    renderResults(rows) {
        const box = document.getElementById('search-results');
        if (!box) return;
        if (!rows.length) {
            box.innerHTML = '<div class="empty-state"><p>No matches</p></div>';
            return;
        }
        box.innerHTML = `
            <div class="table-container">
                <table class="data-table" id="search-results-table">
                    <thead>
                        <tr>
                            <th>Type</th><th>Date</th><th>Party</th><th>Item</th>
                            <th>Number</th><th>Amount</th><th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((r, i) => `
                            <tr class="search-result-row" data-index="${i}">
                                <td>${this.typeLabel(r)}</td>
                                <td>${r.date ? Utils.formatDate(r.date) : ''}</td>
                                <td>${this.partyLabel(r)}</td>
                                <td>${Utils.escapeHtml(r.item_name || '')}</td>
                                <td>${Utils.escapeHtml(this.numberLabel(r))}</td>
                                <td>${r.amount != null ? Utils.formatCurrency(r.amount) : ''}</td>
                                <td>${Utils.escapeHtml(this.statusLabel(r))}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        box.querySelectorAll('.search-result-row').forEach((tr) => {
            tr.addEventListener('click', () => this.openResult(this.results[Number(tr.dataset.index)]));
        });
    }

    typeLabel(r) {
        if (r.result_type === 'cash') return 'Cash';
        if (r.result_type === 'stock') return 'Stock';
        return 'Installment';
    }

    partyLabel(r) {
        if (r.result_type === 'stock') return '';
        if (!r.customer_id) return 'Walk-in Customer';
        return Utils.escapeHtml(Utils.formatCustomerIdentity(r, r._guarantors || []));
    }

    numberLabel(r) {
        if (r.result_type === 'cash') return `CS-${String(r.cash_sale_id || r.id).padStart(6, '0')}`;
        if (r.result_type === 'stock') return (Utils.stockIdentifier(r) || {}).value || r.stock_no || '';
        return r.account_no || '';
    }

    statusLabel(r) {
        if (r.result_type === 'cash') return Utils.capitalizeWords(r.status || r.payment_status || '');
        if (r.result_type === 'stock') return Number(r.is_sold) ? 'Sold' : 'Available';
        return r.status || '';
    }

    async openResult(row) {
        if (!row) return;
        if (row.result_type === 'stock') return this.openStock(row.stock_id || row.id);
        if (row.result_type === 'cash') return this.openCash(row.cash_sale_id || row.id);
        return this.openInstallment(row.customer_id);
    }

    overlayEl() {
        return document.getElementById('search-detail-overlay');
    }

    modalBusy() {
        const modal = document.getElementById('modal-container');
        return !!(modal && modal.innerHTML.trim());
    }

    showOverlay(title) {
        const el = this.overlayEl();
        const titleEl = document.getElementById('search-detail-title');
        if (titleEl) titleEl.textContent = title || 'Details';
        if (el) {
            el.classList.remove('hidden');
            el.setAttribute('aria-hidden', 'false');
        }
    }

    restoreInstallmentPanels() {
        if (!this._installmentHosted) return;
        const container = document.querySelector('#installments-section .installment-container');
        const cust = document.getElementById('customer-details');
        const inst = document.getElementById('installment-details');
        const custPanel = document.querySelector('#installments-section .customer-info-panel');
        const instPanel = document.querySelector('#installments-section .installment-panel');
        if (custPanel && cust) custPanel.appendChild(cust);
        if (instPanel && inst) instPanel.appendChild(inst);
        this._installmentHosted = false;
        if (container) { /* panels already in section */ }
    }

    closeOverlay() {
        if (this.modalBusy()) return;
        this.restoreInstallmentPanels();
        const body = document.getElementById('search-detail-body');
        if (body) body.innerHTML = '';
        const el = this.overlayEl();
        if (el) {
            el.classList.add('hidden');
            el.setAttribute('aria-hidden', 'true');
        }
    }

    async openInstallment(customerId) {
        const customer = await Database.get('SELECT * FROM customers WHERE id = ?', [Number(customerId)]);
        if (!customer) {
            this.closeOverlay();
            app.showNotification('Customer not found', 'error');
            return;
        }
        const body = document.getElementById('search-detail-body');
        const cust = document.getElementById('customer-details');
        const inst = document.getElementById('installment-details');
        if (!body || !cust || !inst || !app.installments) {
            app.showNotification('Failed to open account', 'error');
            return;
        }
        this.restoreInstallmentPanels();
        body.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'installment-container';
        wrap.appendChild(cust);
        wrap.appendChild(inst);
        body.appendChild(wrap);
        this._installmentHosted = true;
        this.showOverlay(customer.account_no || 'Installment');
        try {
            await app.installments.showCustomerDetails(customer);
        } catch (e) {
            this.closeOverlay();
            app.showNotification('Failed to load customer details', 'error');
        }
    }

    async openInstallmentByAccount(accountNo) {
        const customer = await Database.getCustomerByAccountNoExact(accountNo);
        if (!customer) {
            app.showNotification('Customer not found', 'error');
            return;
        }
        await this.openInstallment(customer.id);
    }

    async openCash(cashSaleId) {
        let sale = await Database.getCashSaleById(cashSaleId);
        if (!sale) {
            this.closeOverlay();
            app.showNotification('Sale not found', 'error');
            return;
        }
        this.restoreInstallmentPanels();
        const body = document.getElementById('search-detail-body');
        if (!body) return;
        if (app.cashSales) {
            const rest = (app.cashSales.cashSales || []).filter((s) => Number(s.id) !== Number(sale.id));
            app.cashSales.cashSales = [sale].concat(rest);
        }
        const ident = Utils.stockIdentifier(sale);
        const dueBtns = Number(sale.due_amount) > 0
            ? `${app.cashSales ? app.cashSales.whatsAppLink(sale) : ''}
               <button class="btn btn-sm btn-warning" type="button" id="search-cash-collect"><i class="fas fa-money-bill"></i> Collect Dues</button>`
            : '';
        body.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <div class="detail-grid">
                        <div class="detail-item"><label>Invoice</label><span>CS-${String(sale.id).padStart(6, '0')}</span></div>
                        <div class="detail-item"><label>Customer</label><span>${Utils.escapeHtml(sale.customer_name || 'Walk-in Customer')}</span></div>
                        <div class="detail-item"><label>Item</label><span>${Utils.escapeHtml(sale.item_name || '')}</span></div>
                        <div class="detail-item"><label>${Utils.escapeHtml(ident.label)}</label><span>${Utils.escapeHtml(ident.value)}</span></div>
                        <div class="detail-item"><label>Agreed</label><span>${Utils.formatCurrency(sale.agreed_price)}</span></div>
                        <div class="detail-item"><label>Received</label><span>${Utils.formatCurrency(sale.received_price)}</span></div>
                        <div class="detail-item"><label>Due</label><span>${Utils.formatCurrency(sale.due_amount || 0)}</span></div>
                        <div class="detail-item"><label>Status</label><span>${Utils.capitalizeWords(sale.payment_status || '')}</span></div>
                    </div>
                </div>
                <div class="card-footer">
                    ${dueBtns}
                    <button class="btn btn-sm btn-info" type="button" id="search-cash-invoice"><i class="fas fa-print"></i> Invoice</button>
                    <button class="btn btn-sm btn-primary" type="button" id="search-cash-edit"><i class="fas fa-edit"></i> Edit</button>
                </div>
            </div>`;
        const invoiceBtn = document.getElementById('search-cash-invoice');
        const collectBtn = document.getElementById('search-cash-collect');
        const editBtn = document.getElementById('search-cash-edit');
        if (invoiceBtn) invoiceBtn.addEventListener('click', () => app.cashSales.printInvoice(sale.id));
        if (collectBtn) collectBtn.addEventListener('click', () => app.cashSales.collectDues(sale.id));
        if (editBtn) editBtn.addEventListener('click', () => app.cashSales.editCashSale(sale.id));
        this.showOverlay(`CS-${String(sale.id).padStart(6, '0')}`);
    }

    async openStock(stockId) {
        if (!app.stock) return;
        const found = (app.stock.stockItems || []).find((s) => String(s.id) === String(stockId));
        if (!found) {
            await app.stock.loadData();
        }
        await app.stock.edit(stockId);
    }
}

window.SearchManager = SearchManager;
