// Installments Management Module

class InstallmentManager {
    constructor() {
        this.installments = [];
        this.currentCustomer = null;
        this.currentSchedule = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const searchBtn = document.getElementById('search-customer-btn');
        const searchInput = document.getElementById('customer-search');
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => this.searchCustomer(searchInput.value));
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.searchCustomer(searchInput.value);
            });
        }
    }

    async loadData() {
        // No-op by default. Data is loaded when searching a customer
    }

    async showCustomerDetails(customer) {
        this.currentCustomer = customer;

        try {
            console.log(`👤 Loading customer details for: ${customer.account_no} - ${customer.customer_name}`);

            // Ensure database schema is up to date
            await Database.ensureOriginalAmountColumn();

            // Reconcile shortages using corrected value shifting approach
            console.log(`🔄 Reconciling shortages for customer ${customer.id}`);
            await Database.reconcileShortagesForCustomer(customer.id);

            // Load installments after reconciliation
            console.log(`📊 Loading installments for customer ${customer.id}`);
            const installments = await Database.getCustomerInstallments(customer.id);
            this.installments = installments;

            console.log(`📊 Found ${installments.length} installments`);

            // Render customer info and installments
            document.getElementById('customer-details').innerHTML = this.renderCustomerInfo(customer);
            this.renderInstallments(installments);

            // Clear any search results
            const resultsContainer = document.getElementById('installment-details');
            if (resultsContainer.querySelector('.search-results')) {
                resultsContainer.querySelector('.search-results').remove();
            }

            console.log(`✅ Customer details loaded successfully for ${customer.account_no}`);
        } catch (error) {
            console.error('Error showing customer details:', error);
            app.showNotification(`Failed to load customer details: ${error.message}`, 'error');
        }
    }

    renderSearchResults(customers) {
        this.currentCustomer = null;
        this.installments = [];
        document.getElementById('customer-details').innerHTML = '';
        document.getElementById('installment-details').innerHTML = '';

        // Store customers for later reference
        this.searchResultCustomers = customers;

        const modalHtml = `
            <div class="modal" style="z-index: 10000;">
                <div class="modal-content" style="width: 95vw; max-width: 1200px; height: 90vh; max-height: none;">
                    <div class="modal-header">
                        <h3><i class="fas fa-search"></i> Search Results (${customers.length} found)</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body" style="height: calc(90vh - 120px); overflow-y: auto; padding: 16px;">
                        <div class="search-results-info" style="margin-bottom: 20px; padding: 12px; background: #e7f3ff; border-radius: 6px; border-left: 4px solid #007bff;">
                            <p style="margin: 0; color: #0056b3;">
                                <i class="fas fa-info-circle"></i> 
                                <strong>Found ${customers.length} customer(s) matching your search.</strong> 
                                Click on any customer below to expand their installment details, or use "Select Customer" to load them in the main view.
                            </p>
                        </div>
                        <div class="results-list-container" style="display: flex; flex-direction: column; gap: 16px;">
                            ${customers.map((customer, index) => `
                                <div class="result-item" style="border: 2px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                                    <div class="result-summary" onclick="app.installments.toggleCustomerResult(${index})" style="cursor: pointer; padding: 16px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); transition: background 0.3s ease;" onmouseover="this.style.background='linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)'" onmouseout="this.style.background='linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <div class="customer-basic-info" style="flex: 1;">
                                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                                    <div style="display: flex; align-items: center; gap: 8px;">
                                                        <i class="fas fa-user-circle" style="font-size: 20px; color: #007bff;"></i>
                                                        <strong style="color: #333; font-size: 18px;">${customer.account_no} - ${customer.customer_name || 'N/A'}</strong>
                                                    </div>
                                                    <div style="display: flex; gap: 20px; color: #666; font-size: 14px;">
                                                        <span><i class="fas fa-id-card"></i> CNIC: ${customer.cnic_no}</span>
                                                        <span><i class="fas fa-phone"></i> ${customer.phone}</span>
                                                    </div>
                                                    <div style="color: #666; font-size: 14px;">
                                                        <i class="fas fa-map-marker-alt"></i> ${customer.address}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                                <button class="btn btn-sm btn-primary expand-btn" id="expand-btn-${index}" style="min-width: 100px;">
                                                    <i class="fas fa-chevron-down"></i> Expand
                                                </button>
                                                <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); app.installments.selectCustomerAndClose(${customer.id});" style="min-width: 100px;">
                                                    <i class="fas fa-user-check"></i> Select
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="result-details" id="result-details-${index}" style="display: none; padding: 20px; background: white; border-top: 1px solid #ddd; max-height: 60vh; overflow-y: auto;">
                                        <div class="loading-placeholder" style="text-align: center; padding: 40px; color: #666;">
                                            <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
                                                <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
                                                <span style="font-size: 16px;">Loading installment schedule...</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
    }

    async toggleCustomerResult(index) {
        const customer = this.searchResultCustomers[index];
        const detailsDiv = document.getElementById(`result-details-${index}`);
        const expandBtn = document.getElementById(`expand-btn-${index}`);

        if (detailsDiv.style.display === 'none') {
            // Show details
            detailsDiv.style.display = 'block';
            expandBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Collapse';

            // Load installments if not already loaded
            if (detailsDiv.querySelector('.loading-placeholder')) {
                try {
                    app.showLoading();
                    await Database.reconcileShortagesForCustomer(customer.id);
                    const installments = await Database.getCustomerInstallments(customer.id);
                    detailsDiv.innerHTML = this.renderCustomerResultDetails(customer, installments);
                } catch (error) {
                    console.error('Error loading customer details:', error);
                    detailsDiv.innerHTML = '<p class="text-danger">Failed to load installment details</p>';
                } finally {
                    app.hideLoading();
                }
            }
        } else {
            // Hide details
            detailsDiv.style.display = 'none';
            expandBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Expand';
        }
    }

    renderCustomerResultDetails(customer, installments) {
        if (installments.length === 0) {
            return `
                <div class="customer-result-details">
                    <p class="text-muted">No installment schedule found for this customer.</p>
                    <button class="btn btn-primary" onclick="app.installments.selectCustomer(${customer.id})">
                        Select This Customer
                    </button>
                </div>
            `;
        }

        // Use corrected shortage logic consistent with main display
        const sortedList = installments.slice().sort((a, b) => a.installment_no - b.installment_no);
        const displayRows = sortedList.map((i) => {
            const currentAmount = Number(i.amount) || 0;
            const originalAmount = Number(i.original_amount) || currentAmount;
            return {
                ...i,
                computedStatus: i.status || 'upcoming',
                displayDueAmount: currentAmount,
                displayRemainingAmount: Number(i.remaining_balance) || 0,
                originalAmount,
                currentAmount
            };
        });

        return `
            <div class="customer-result-details" style="max-height: 100%; overflow-y: auto;">
                <div class="customer-info-compact" style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                    <div class="info-row" style="display: flex; gap: 20px; margin-bottom: 8px;">
                        <div><strong><i class="fas fa-user"></i> Customer:</strong> ${customer.account_no} - ${customer.customer_name || 'N/A'}</div>
                        <div><strong><i class="fas fa-map-marker-alt"></i> Address:</strong> ${customer.address}</div>
                        <div><strong><i class="fas fa-phone"></i> Phone:</strong> ${customer.phone}</div>
                    </div>
                </div>
                <div class="installments-full" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 6px;">
                    <div style="position: sticky; top: 0; background: white; z-index: 10; border-bottom: 1px solid #ddd;">
                        <h4 style="margin: 0; padding: 12px; background: #f1f3f4; font-size: 14px; font-weight: 600;">
                            <i class="fas fa-credit-card"></i> Installment Schedule (${displayRows.length} installments)
                        </h4>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead style="position: sticky; top: 45px; background: white; z-index: 5;">
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #ddd;">
                                <th style="padding: 8px; text-align: left; border-right: 1px solid #ddd;">#</th>
                                <th style="padding: 8px; text-align: left; border-right: 1px solid #ddd;">Due Date</th>
                                <th style="padding: 8px; text-align: right; border-right: 1px solid #ddd;">Amount</th>
                                <th style="padding: 8px; text-align: right; border-right: 1px solid #ddd;">Paid</th>
                                <th style="padding: 8px; text-align: center; border-right: 1px solid #ddd;">Status</th>
                                <th style="padding: 8px; text-align: right;">Remaining</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayRows.map(i => `
                                <tr style="border-bottom: 1px solid #eee; ${i.computedStatus === 'paid' ? 'background: #f0f8f0;' : ''} ${i.computedStatus === 'short' ? 'background: #fff3f3;' : ''}">
                                    <td style="padding: 8px; border-right: 1px solid #eee; font-weight: bold;">${i.installment_no}</td>
                                    <td style="padding: 8px; border-right: 1px solid #eee;">${Utils.formatDate(i.due_date)}</td>
                                    <td style="padding: 8px; border-right: 1px solid #eee; text-align: right; font-weight: bold;">
                                        ${Utils.formatCurrency(i.displayDueAmount)}
                                        ${i.computedStatus !== 'short' && i.currentAmount > i.originalAmount ? `<br><small style="color: #007bff;">(+${Utils.formatCurrency(i.currentAmount - i.originalAmount)} from overdue)</small>` : ''}
                                    </td>
                                    <td style="padding: 8px; border-right: 1px solid #eee; text-align: right; color: #28a745;">${Utils.formatCurrency(i.paid_amount || 0)}</td>
                                    <td style="padding: 8px; border-right: 1px solid #eee; text-align: center;">
                                        <span style="padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; background: ${i.computedStatus === 'paid' ? '#d4edda; color: #155724' : i.computedStatus === 'short' ? '#f8d7da; color: #721c24' : '#d1ecf1; color: #0c5460'};">
                                            ${Utils.capitalizeWords(i.computedStatus)}
                                        </span>
                                    </td>
                                    <td style="padding: 8px; text-align: right; font-weight: bold; color: ${i.displayRemainingAmount > 0 ? '#dc3545' : '#28a745'};">${Utils.formatCurrency(i.displayRemainingAmount)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="result-actions" style="margin-top: 16px; text-align: center; padding: 12px; background: #f8f9fa; border-radius: 6px; display: flex; gap: 12px; justify-content: center;">
                    <button class="btn btn-success" onclick="app.installments.selectCustomerAndClose(${customer.id})" style="padding: 8px 16px;">
                        <i class="fas fa-user-check"></i> Select This Customer
                    </button>
                    <button class="btn btn-secondary" onclick="app.closeModal()" style="padding: 8px 16px;">
                        <i class="fas fa-times"></i> Close Search
                    </button>
                </div>
            </div>
        `;
    }

    async selectCustomer(customerId) {
        const customer = this.searchResultCustomers.find(c => c.id === customerId);
        if (customer) {
            await this.showCustomerDetails(customer);
        }
    }

    async selectCustomerAndClose(customerId) {
        const customer = this.searchResultCustomers.find(c => c.id === customerId);
        if (customer) {
            app.closeModal();
            await this.showCustomerDetails(customer);
        }
    }

    async searchCustomer(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            app.showNotification('Enter account no or CNIC to search', 'warning');
            return;
        }

        try {
            app.showLoading();
            const results = await Database.searchCustomersExtended(searchTerm.trim());
            if (results.length === 0) {
                app.showNotification('No customers found', 'info');
                return;
            }

            if (results.length === 1) {
                // Single result - show directly
                await this.showCustomerDetails(results[0]);
            } else {
                // Multiple results - show expandable list
                this.renderSearchResults(results);
            }
        } catch (error) {
            console.error('Error searching customer:', error);
            app.showNotification('Failed to search customer', 'error');
        } finally {
            app.hideLoading();
        }
    }

    renderCustomerInfo(c) {
        const hasPurchaseId = this.installments && this.installments.length > 0 && this.installments[0] && this.installments[0].purchase_id;

        // Calculate account status
        let accountStatus = 'Unknown';
        let statusBadgeClass = 'secondary';
        let statusIcon = 'fas fa-question-circle';

        const headerTotals = this.installments && this.installments.length > 0
            ? InstallmentEngine.totals(this.installments)
            : { grandRemaining: 0, credit: 0 };

        if (this.installments && this.installments.length > 0) {
            const allPaidOrSettled = this.installments.every(i => i.status === 'paid' || i.status === 'settled');

            if (allPaidOrSettled || headerTotals.grandRemaining === 0) {
                accountStatus = 'Closed';
                statusBadgeClass = 'success';
                statusIcon = 'fas fa-check-circle';
            } else {
                accountStatus = 'Active';
                statusBadgeClass = 'primary';
                statusIcon = 'fas fa-user-clock';
            }
        } else {
            // No installments - could be a new customer
            accountStatus = 'No Active Purchase';
            statusBadgeClass = 'secondary';
            statusIcon = 'fas fa-user-plus';
        }

        console.log('Render customer info - installments:', this.installments.length, 'hasPurchaseId:', hasPurchaseId, 'Status:', accountStatus);

        return `
            <div class="card">
                <div class="card-header">
                    <h3>Customer Information</h3>
                    <p class="text-muted">Overview of customer details</p>
                </div>
                <div class="card-body">
                    <div class="detail-grid">
                        <div class="detail-item"><label>Account No:</label><span>${c.account_no}</span></div>
                        <div class="detail-item"><label>Name:</label><span>${c.customer_name || '-'}</span></div>
                        <div class="detail-item"><label>CNIC:</label><span>${c.cnic_no}</span></div>
                        <div class="detail-item"><label>Phone:</label><span>${c.phone}</span></div>
                        <div class="detail-item"><label>Address:</label><span>${c.address}</span></div>
                        <div class="detail-item"><label>Registered:</label><span>${Utils.formatDate(c.registration_date, 'readable')}</span></div>
                        <div class="detail-item">
                            <label>Account Status:</label>
                            <span>
                                <span class="status-badge ${statusBadgeClass}">
                                    <i class="${statusIcon}"></i> ${accountStatus}
                                </span>
                            </span>
                        </div>
                        <div class="detail-item"><label>Grand Remaining:</label><span>${Utils.formatCurrency(headerTotals.grandRemaining)}</span></div>
                        ${headerTotals.credit > 0 ? `<div class="detail-item"><label>Credit:</label><span class="text-success">${Utils.formatCurrency(headerTotals.credit)}</span></div>` : ''}
                    </div>
                </div>
                <div class="card-footer" style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn btn-secondary" onclick="app.installments.printCurrentSchedule()">
                        <i class="fas fa-print"></i> Print Schedule
                    </button>
                    ${hasPurchaseId ? `
                    <button class="btn btn-danger" onclick="app.installments.openDeleteScheduleModal(${this.installments[0].purchase_id})">
                        <i class="fas fa-trash"></i> Delete Schedule
                    </button>` : `<!-- Debug: No purchase ID found -->`}
                </div>
            </div>
        `;
    }

    async renderInstallments(list) {
        this.installments = list;
        const container = document.getElementById('installment-details');
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = '<p class="text-muted">No installment schedule found for this customer.</p>';
            return;
        }

        // Get purchase status to determine if account is completed
        let purchaseStatus = 'active';
        if (list.length > 0 && list[0].purchase_id) {
            try {
                const purchase = await Database.get('SELECT status FROM customer_purchases WHERE id = ?', [list[0].purchase_id]);
                purchaseStatus = purchase?.status || 'active';
            } catch (e) {
                console.error('Error fetching purchase status:', e);
            }
        }
        const isCompleted = purchaseStatus === 'completed';

        const sortedList = list.slice().sort((a, b) => a.installment_no - b.installment_no);
        const totals = InstallmentEngine.totals(sortedList);
        const grandRemaining = totals.grandRemaining;
        const credit = totals.credit;

        const displayRows = sortedList.map((i) => {
            const currentAmount = Number(i.amount) || 0;
            const originalAmount = Number(i.original_amount) || currentAmount;
            const computedStatus = i.status || 'upcoming';
            return {
                ...i,
                computedStatus,
                displayDueAmount: currentAmount,
                displayRemainingAmount: Number(i.remaining_balance) || 0,
                originalAmount,
                currentAmount
            };
        });

        const allShort = displayRows.every(r => r.computedStatus === 'short');

        const table = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Due Date</th>
                            <th>Amount</th>
                            <th>Paid</th>
                            <th>Status</th>
                            <th>Remaining</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${displayRows.map(i => `
                            <tr class="stagger-item ${i.computedStatus === 'paid' ? 'row-paid' : ''} ${i.computedStatus === 'short' ? 'row-overdue' : ''}">
                                <td>${i.installment_no}</td>
                                <td>${Utils.formatDate(i.due_date)}</td>
                                <td>
                                    ${Utils.formatCurrency(i.displayDueAmount)}
                                    ${i.computedStatus !== 'short' && i.currentAmount > i.originalAmount ? `<br><small class="text-info">(Includes ${Utils.formatCurrency(i.currentAmount - i.originalAmount)} from overdue)</small>` : ''}
                                </td>
                                <td>
                                    ${Utils.formatCurrency((i.paid_amount || 0) - (i.discount_amount || 0))}
                                    ${i.discount_amount > 0 ? `<br><small class="text-warning" title="Discount Applied">+ ${Utils.formatCurrency(i.discount_amount)} (Disc)</small>` : ''}
                                </td>
                                <td>
                                    <span class="status-badge ${i.computedStatus}">${Utils.capitalizeWords(i.computedStatus)}</span>
                                </td>
                                <td class="${i.displayRemainingAmount > 0 ? 'text-danger' : 'text-success'}">
                                    ${Utils.formatCurrency(i.displayRemainingAmount)}
                                </td>
                                <td>
                                    ${!isCompleted && (i.computedStatus === 'paid' || i.computedStatus === 'settled' || i.computedStatus === 'partial') ? `
                                        <button class="btn btn-sm btn-info" onclick="app.installments.printReceipt(${i.installment_id})">
                                            <i class="fas fa-print"></i> Receipt
                                        </button>
                                        ${i.computedStatus === 'partial' ? `
                                            <button class="btn btn-sm btn-success" onclick="app.installments.openPayRemainingModal(${i.installment_id})">
                                                <i class="fas fa-money-bill"></i> Pay Rem.
                                            </button>
                                        ` : ''}
                                        <button class="btn btn-sm btn-secondary" onclick="app.installments.openEditPaymentModal(${i.installment_id})">
                                            <i class="fas fa-edit"></i> Edit
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="app.installments.confirmVoidPayment(${i.installment_id})">
                                            <i class="fas fa-times"></i> Void
                                        </button>
                                    ` : (i.computedStatus === 'short' ? `
                                        <span class="badge badge-warning"><i class="fas fa-exclamation-triangle"></i> Short</span>
                                    ` : `
                                        ${!isCompleted ? `
                                            <button class="btn btn-sm btn-success" onclick="app.installments.openPaymentModal(${i.installment_id})">
                                                <i class="fas fa-check"></i> Pay Now
                                            </button>
                                        ` : ''}
                                    `)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${allShort && grandRemaining > 0 ? `
                <div class="alert alert-info">
                    <strong><i class="fas fa-info-circle"></i> All installments are overdue (short).</strong>
                    The accumulated shortage of <strong>${Utils.formatCurrency(grandRemaining)}</strong> will be collected at the next payment using the "Pay Remaining/Short Balance" option below.
                </div>
            ` : ''}
            ${grandRemaining > 0 && !isCompleted ? `
                <div class="installment-actions-row">
                    <button class="btn btn-warning" onclick="app.installments.openRemainingModal(${displayRows[displayRows.length - 1].installment_id}, ${grandRemaining})">
                        <i class="fas fa-exclamation-circle"></i> Pay Remaining/Short Balance: ${Utils.formatCurrency(grandRemaining)}
                    </button>
                    <button class="btn btn-secondary" onclick="app.installments.openPenaltyModal(${displayRows[displayRows.length - 1].purchase_id})">
                        <i class="fas fa-plus"></i> Add Penalty/Profit
                    </button>
                </div>
            ` : ''}
        `;

        container.innerHTML = table;
    }

    openPaymentModal(installmentId) {
        const inst = this.installments.find(i => Number(i.installment_id) === Number(installmentId));
        if (!inst) return;

        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-money-bill"></i> Record Payment</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-grid">
                            <div class="detail-item"><label>Installment #</label><span>${inst.installment_no}</span></div>
                            <div class="detail-item"><label>Due Date</label><span>${Utils.formatDate(inst.due_date)}</span></div>
                            <div class="detail-item"><label>Amount</label><span>${Utils.formatCurrency(inst.amount)}</span></div>
                            <div class="detail-item"><label>Paid</label><span>${Utils.formatCurrency(inst.paid_amount || 0)}</span></div>
                        </div>
                        <form id="payment-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Payment Amount</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="amount" class="form-input" required min="1" step="0.01">
                                </div>
                                <small class="form-hint">If you pay more than the due amount, excess will be applied to future installments</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Payment Date</label>
                                <input type="date" name="payment_date" class="form-input" value="${Utils.toLocalDateString(new Date())}">
                                <small class="form-hint">Date when payment was actually made</small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-success" onclick="app.installments.pay(${installmentId})">
                            <i class="fas fa-check"></i> Confirm Payment
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
    }

    async pay(installmentId) {
        const form = document.getElementById('payment-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const amount = parseFloat(formData.get('amount'));
        const paymentDate = formData.get('payment_date') || null;

        if (amount <= 0) {
            app.showNotification('Payment amount must be greater than 0', 'error');
            return;
        }

        try {
            app.showLoading();

            // Check if overpayment distribution is needed
            const inst = this.installments.find(i => Number(i.installment_id) === Number(installmentId));
            const installmentRemaining = Math.max(0, (inst?.amount || 0) - (inst?.paid_amount || 0));

            let result;
            // Use standard payInstallment which now handles reconciliation and distribution (via value shifting) automatically
            result = await Database.payInstallment(installmentId, amount, paymentDate);

            // Check for overpayment/excess info from the result if implemented
            const excessMsg = result.overpayment > 0 ? ` (Includes overpayment of ${Utils.formatCurrency(result.overpayment)})` : '';
            app.showNotification(`Payment recorded successfully! Receipt: ${result.receiptNo}${excessMsg}`, 'success');

            app.closeModal();

            // Refresh current customer installments
            if (this.currentCustomer) {
                await Database.reconcileShortagesForCustomer(this.currentCustomer.id);
                const installments = await Database.getCustomerInstallments(this.currentCustomer.id);
                this.installments = installments;
                document.getElementById('customer-details').innerHTML = this.renderCustomerInfo(this.currentCustomer);
                this.renderInstallments(installments);
            }
        } catch (error) {
            console.error('Error recording payment:', error);
            app.showNotification('Failed to record payment', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async printCurrentSchedule() {
        if (!this.currentCustomer || !this.installments || this.installments.length === 0) {
            app.showNotification('No schedule to print', 'warning');
            return;
        }
        const c = this.currentCustomer;
        const schedule = this.installments;
        const purchaseId = schedule[0]?.purchase_id;
        let penalties = [];
        let discounts = [];
        let purchase = null;

        try {
            penalties = purchaseId ? await Database.getPenalties(purchaseId) : [];
            // Calculate discount from payments table instead of discounts table
            const discountPayments = purchaseId ? await Database.query(
                `SELECT SUM(amount) as total_discount 
                 FROM payments 
                 WHERE (notes LIKE '%discount%' OR notes LIKE '%Discount%') 
                 AND installment_id IN (SELECT id FROM installments WHERE purchase_id = ?)`,
                [purchaseId]
            ) : [];
            const totalDiscount = discountPayments[0]?.total_discount || 0;
            if (totalDiscount > 0) {
                discounts = [{ amount: totalDiscount, reason: 'Account settlement discount' }];
            }
            // Get purchase details
            purchase = purchaseId ? await Database.get(
                `SELECT cp.*, s.engine_no, s.chassis_no, p.item_name
                 FROM customer_purchases cp
                 JOIN stock s ON cp.stock_id = s.id
                 JOIN products p ON s.product_id = p.id
                 WHERE cp.id = ?`,
                [purchaseId]
            ) : null;
        } catch (e) {
            console.error('Error fetching schedule data:', e);
        }

        const win = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Installment Schedule - ${c.account_no}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h2 { margin-bottom: 10px; }
                    .info { margin-bottom: 15px; }
                    .purchase-details { margin: 15px 0; padding: 10px; background: #f9f9f9; border-left: 4px solid #007bff; }
                    table { width: 100%; border-collapse: collapse; }
                    td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background: #f5f5f5; }
                    .status-paid { color: #065f46; }
                    .status-pending { color: #92400e; }
                    .status-partial { color: #334155; }
                </style>
            </head>
            <body>
                <h2>Installment Schedule</h2>
                <div class="info">
                    <strong>Account No:</strong> ${c.account_no} &nbsp; 
                    <strong>Name:</strong> ${c.customer_name || '-'} &nbsp; 
                    <strong>CNIC:</strong> ${c.cnic_no} &nbsp; 
                    <strong>Phone:</strong> ${c.phone}
                </div>
                ${purchase ? `
                    <div class="purchase-details">
                        <h3 style="margin-top: 0;">Purchase Details</h3>
                        <p><strong>Item:</strong> ${purchase.item_name || '-'} &nbsp;&nbsp; 
                           <strong>Engine No:</strong> ${purchase.engine_no || '-'} &nbsp;&nbsp; 
                           <strong>Chassis No:</strong> ${purchase.chassis_no || '-'}</p>
                        <p><strong>Sale Price:</strong> ${Utils.formatCurrency(purchase.sale_price || 0)} &nbsp;&nbsp;
                           <strong>Advance Received:</strong> ${Utils.formatCurrency(purchase.advance_received || 0)} &nbsp;&nbsp;
                           <strong>Total Amount:</strong> ${Utils.formatCurrency(purchase.total_amount || 0)}</p>
                        <p><strong>Profit:</strong> ${Utils.formatCurrency(purchase.profit_amount || 0)} 
                           (${(purchase.profit_percentage || 0).toFixed(2)}%) &nbsp;&nbsp;
                           <strong>Installment Months:</strong> ${purchase.installment_months || 0} &nbsp;&nbsp;
                           <strong>Monthly Installment:</strong> ${Utils.formatCurrency(purchase.monthly_installment || 0)}</p>
                    </div>
                ` : ''}
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Due Date</th>
                            <th>Amount</th>
                            <th>Paid</th>
                            <th>Status</th>
                            <th>Remaining</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${schedule.map(i => `
                            <tr>
                                <td>${i.installment_no}</td>
                                <td>${Utils.formatDate(i.due_date, 'readable')}</td>
                                <td>${Utils.formatCurrency(i.amount)}</td>
                                <td>${Utils.formatCurrency(i.paid_amount || 0)}</td>
                                <td class="status-${i.status}">${Utils.capitalizeWords(i.status)}</td>
                                <td>${Utils.formatCurrency(i.remaining_balance)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${purchaseId ? `
                    <h3>Adjustments</h3>
                    <div class="adjustments">
                        <h4>Penalties</h4>
                        ${penalties.length ? `<ul>${penalties.map(p => `<li>Amount: ${Utils.formatCurrency(p.amount)} (${p.reason || 'Penalty'})</li>`).join('')}</ul>` : '<p class="text-muted">None</p>'}
                        <h4>Discounts</h4>
                        ${discounts.length ? `<ul>${discounts.map(d => `<li>Amount: ${Utils.formatCurrency(d.amount)} (${d.reason || 'Discount'})</li>`).join('')}</ul>` : '<p class="text-muted">None</p>'}
                    </div>
                ` : ''}
            </body>
            </html>
        `;
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
    }

    async printReceipt(installmentId) {
        try {
            const payment = await Database.getLatestPaymentForInstallment(installmentId);
            const inst = this.installments.find(i => Number(i.installment_id) === Number(installmentId));
            if (!payment || !inst) {
                app.showNotification('No payment found to print receipt', 'warning');
                return;
            }

            // Check for distributed payments with the same receipt number
            const distributedPayments = await Database.query(
                `SELECT p.*, i.installment_no, i.amount as installment_amount, i.paid_amount as installment_paid
                 FROM payments p 
                 JOIN installments i ON p.installment_id = i.id
                 WHERE p.receipt_no = ? AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
                 ORDER BY i.installment_no ASC`,
                [payment.receipt_no]
            );

            const isDistributedPayment = distributedPayments.length > 1;

            // Calculate totals separating Cash and Discount
            let totalCashPaid = 0;
            let totalDiscount = 0;

            distributedPayments.forEach(p => {
                const isDiscount = p.notes && (p.notes.includes('discount') || p.notes.includes('Discount'));
                if (isDiscount) {
                    totalDiscount += (p.amount || 0);
                } else {
                    totalCashPaid += (p.amount || 0);
                }
            });

            const totalTransaction = totalCashPaid + totalDiscount;

            const win = window.open('', '_blank');
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Payment Receipt ${payment.receipt_no || ''}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h2 { margin-bottom: 10px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background: #f5f5f5; }
                        .distribution-table { margin-top: 20px; }
                        .distribution-table th { background: #e7f3ff; }
                        .discount-row { color: #856404; background-color: #fff3cd; }
                        .summary-section { margin-top: 20px; text-align: right; }
                    </style>
                </head>
                <body>
                    <h2>Payment Receipt</h2>
                    <table>
                        <tr><th>Receipt No</th><td>${payment.receipt_no || ''}</td></tr>
                        <tr><th>Date</th><td>${Utils.formatDate(payment.payment_date || new Date(), 'readable')}</td></tr>
                        <tr><th>Amount Paid (Cash)</th><td>${Utils.formatCurrency(totalCashPaid)}</td></tr>
                        ${totalDiscount > 0 ? `<tr><th>Discount Applied</th><td>${Utils.formatCurrency(totalDiscount)}</td></tr>` : ''}
                        ${totalDiscount > 0 ? `<tr><th><strong>Total Credited</strong></th><td><strong>${Utils.formatCurrency(totalTransaction)}</strong></td></tr>` : ''}
                        <tr><th>Product</th><td>${inst.item_name || '-'}</td></tr>
                        <tr><th>Engine No</th><td>${inst.engine_no || '-'}</td></tr>
                        <tr><th>Chassis No</th><td>${inst.chassis_no || '-'}</td></tr>
                    </table>
                    
                    ${isDistributedPayment ? `
                        <h3>Payment Distribution</h3>
                        <table class="distribution-table">
                            <thead>
                                <tr>
                                    <th>Installment #</th>
                                    <th>Amount Due</th>
                                    <th>Credited</th>
                                    <th>Type</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${distributedPayments.map(p => {
                const isDiscount = p.notes && (p.notes.includes('discount') || p.notes.includes('Discount'));
                return `
                                    <tr class="${isDiscount ? 'discount-row' : ''}">
                                        <td>${p.installment_no}</td>
                                        <td>${Utils.formatCurrency(p.installment_amount)}</td>
                                        <td>${Utils.formatCurrency(p.amount)}</td>
                                        <td>${isDiscount ? '<strong>DISCOUNT</strong>' : 'Payment'}</td>
                                        <td>${p.notes || ''}</td>
                                    </tr>
                                    `;
            }).join('')}
                            </tbody>
                        </table>
                    ` : `
                        <h3>Single Installment Payment</h3>
                        <table>
                            <tr><th>Installment #</th><td>${inst.installment_no}</td></tr>
                            <tr><th>Due Date</th><td>${Utils.formatDate(inst.due_date, 'readable')}</td></tr>
                            <tr><th>Amount Paid</th><td>${Utils.formatCurrency(payment.amount)}</td></tr>
                            <tr><th>Status</th><td>${Utils.capitalizeWords(inst.status)}</td></tr>
                        </table>
                    `}
                </body>
                </html>
            `;
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 300);
        } catch (e) {
            console.error('Print receipt error:', e);
            app.showNotification('Failed to print receipt', 'error');
        }
    }

    editPayment(installmentId) {
        const inst = this.installments.find(i => Number(i.installment_id) === Number(installmentId));
        if (!inst) return;
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-edit"></i> Edit Payment</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-grid">
                            <div class="detail-item"><label>Installment #</label><span>${inst.installment_no}</span></div>
                            <div class="detail-item"><label>Amount</label><span>${Utils.formatCurrency(inst.amount)}</span></div>
                            <div class="detail-item"><label>Paid</label><span>${Utils.formatCurrency(inst.paid_amount || 0)}</span></div>
                        </div>
                        <form id="payment-edit-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Adjust Paid Amount</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="amount" class="form-input" required min="0" step="0.01" value="${inst.paid_amount || 0}">
                                </div>
                                <small class="form-hint">Set the total paid amount for this installment</small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.installments.applyPaymentEdit(${installmentId})">
                            <i class="fas fa-save"></i> Save
                        </button>
                    </div>
                </div>
            </div>
        `;
        app.showModal(modalHtml);
    }

    async applyPaymentEdit(installmentId) {
        const form = document.getElementById('payment-edit-form');
        const amount = parseFloat(new FormData(form).get('amount'));
        if (isNaN(amount) || amount < 0) {
            app.showNotification('Amount must be 0 or greater', 'error');
            return;
        }
        try {
            app.showLoading();
            // Fetch installment to compute delta
            const inst = this.installments.find(i => Number(i.installment_id) === Number(installmentId));
            const currentPaid = inst.paid_amount || 0;
            if (amount < currentPaid) {
                await Database.setInstallmentPaidAmount(installmentId, amount);
            } else if (amount > currentPaid) {
                await Database.payInstallment(installmentId, amount - currentPaid);
            }
            app.showNotification('Payment updated successfully', 'success');
            app.closeModal();
            if (this.currentCustomer) {
                await Database.reconcileShortagesForCustomer(this.currentCustomer.id);
                const installments = await Database.getCustomerInstallments(this.currentCustomer.id);
                this.installments = installments;
                document.getElementById('customer-details').innerHTML = this.renderCustomerInfo(this.currentCustomer);
                this.renderInstallments(installments);
            }
        } catch (e) {
            console.error('Payment edit error:', e);
            app.showNotification('Failed to update payment', 'error');
        } finally {
            app.hideLoading();
        }
    }

    openRemainingModal(lastInstallmentId, total) {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-wallet"></i> Pay Remaining/Short Balance</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Total remaining/short balance:</p>
                        <h2>${Utils.formatCurrency(total)}</h2>
                        <form id="remaining-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Amount to Pay</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" id="payment-amount" name="amount" class="form-input" required min="0" step="0.01" value="${total}" onchange="app.installments.updateDiscountAmount()">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">
                                    <input type="checkbox" id="mark-as-discount" name="mark_as_discount" style="margin-right: 8px;" onchange="app.installments.updateDiscountAmount()">
                                    Convert remaining unpaid amount to discount and close account
                                </label>
                                <div id="discount-info" style="margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; display: none;">
                                    <small class="text-muted">Discount amount: <span id="discount-amount">Rs. 0</span></small>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-success" onclick="app.installments.payRemaining(${lastInstallmentId})">
                            <i class="fas fa-check"></i> Pay
                        </button>
                    </div>
                </div>
            </div>
        `;
        app.showModal(modalHtml);
    }

    updateDiscountAmount() {
        const paymentAmountInput = document.getElementById('payment-amount');
        const markAsDiscountCheckbox = document.getElementById('mark-as-discount');
        const discountInfo = document.getElementById('discount-info');
        const discountAmountSpan = document.getElementById('discount-amount');

        if (!paymentAmountInput || !markAsDiscountCheckbox || !discountInfo || !discountAmountSpan) return;

        const totalBalance = parseFloat(paymentAmountInput.getAttribute('data-total-balance') || paymentAmountInput.value);
        const paymentAmount = parseFloat(paymentAmountInput.value) || 0;
        const discountAmount = Math.max(0, totalBalance - paymentAmount);

        if (markAsDiscountCheckbox.checked && discountAmount > 0) {
            discountInfo.style.display = 'block';
            discountAmountSpan.textContent = Utils.formatCurrency(discountAmount);
        } else {
            discountInfo.style.display = 'none';
        }

        // Store total balance as data attribute for reference
        if (!paymentAmountInput.hasAttribute('data-total-balance')) {
            paymentAmountInput.setAttribute('data-total-balance', totalBalance);
        }
    }

    async payRemaining(lastInstallmentId) {
        console.log('💰 PayRemaining called with installmentId:', lastInstallmentId);
        const form = document.getElementById('remaining-form');
        const formData = new FormData(form);
        const amount = parseFloat(formData.get('amount')) || 0;
        const markAsDiscount = formData.get('mark_as_discount') === 'on';

        console.log('💰 PayRemaining params:', { amount, markAsDiscount });

        if (amount < 0) {
            app.showNotification('Payment amount cannot be negative', 'error');
            return;
        }

        try {
            app.showLoading();

            // Use the new advanced payment logic
            const result = await Database.payRemainingAdvanced(lastInstallmentId, amount, markAsDiscount);

            // Show appropriate success message based on result
            let message = '';
            const formatCurrency = (amt) => Utils.formatCurrency ? Utils.formatCurrency(amt) : `Rs. ${amt}`;

            if (amount > 0 && result.discountAmount > 0) {
                message = `Payment of ${formatCurrency(amount)} recorded and discount of ${formatCurrency(result.discountAmount)} applied.`;
                if (result.fullySettled) {
                    message += ' All installments settled. Account closed.';
                }
            } else if (amount > 0) {
                message = `Payment of ${formatCurrency(amount)} recorded successfully.`;
            } else if (result.discountAmount > 0) {
                message = `Discount of ${formatCurrency(result.discountAmount)} applied.`;
                if (result.fullySettled) {
                    message += ' All installments settled. Account closed.';
                }
            } else {
                message = 'No payment or discount applied.';
            }

            app.showNotification(message, 'success');
            app.closeModal();

            // Reload installments to show updated status
            if (this.currentCustomer) {
                await this.showCustomerDetails(this.currentCustomer);
            }
        } catch (error) {
            console.error('Error in payRemaining:', error);
            app.showNotification(`Failed to process payment: ${error.message}`, 'error');
        } finally {
            app.hideLoading();
        }
    }

    openPenaltyModal(purchaseId) {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-percent"></i> Add Penalty/Profit</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="penalty-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Penalty Amount</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="penalty_amount" class="form-input" required min="1" step="1">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Apply To</label>
                                <select name="apply_mode" class="form-input" required>
                                    <option value="spread">Spread equally across remaining installments</option>
                                    <option value="balance">Add to remaining balance</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-success" onclick="app.installments.applyPenalty(${purchaseId})">
                            <i class="fas fa-check"></i> Apply
                        </button>
                    </div>
                </div>
            </div>
        `;
        app.showModal(modalHtml);
    }

    async applyPenalty(purchaseId) {
        const form = document.getElementById('penalty-form');
        const amount = Math.round(parseFloat(new FormData(form).get('penalty_amount')) || 0);
        const mode = (new FormData(form).get('apply_mode')) || 'spread';
        if (amount <= 0) {
            app.showNotification('Penalty amount must be greater than 0', 'error');
            return;
        }
        try {
            app.showLoading();
            await Database.applyPenalty(purchaseId, amount, mode);
            app.showNotification('Penalty applied successfully', 'success');
            app.closeModal();
            if (this.currentCustomer) {
                const installments = await Database.getCustomerInstallments(this.currentCustomer.id);
                this.renderInstallments(installments);
            }
        } catch (e) {
            console.error('Apply penalty error:', e);
            app.showNotification('Failed to apply penalty', 'error');
        } finally {
            app.hideLoading();
        }
    }

    cleanup() {
        this.installments = [];
        this.currentCustomer = null;
    }

    openVoidPaymentModal(installmentId) {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-undo"></i> Void Payment</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to void this payment? The amount will be added back to the balance and distributed according to the schedule logic.</p>
                        <div class="form-group">
                            <label class="form-label">Reason (optional)</label>
                            <textarea id="void-payment-reason" class="form-input" rows="3" placeholder="Reason for voiding"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-danger" onclick="app.installments.voidPayment(${installmentId})">
                            <i class="fas fa-undo"></i> Void Payment
                        </button>
                    </div>
                </div>
            </div>
        `;
        app.showModal(modalHtml);
    }

    async voidPayment(installmentId) {
        const reason = (document.getElementById('void-payment-reason')?.value || '').trim();
        try {
            app.showLoading();
            await Database.voidPayment(installmentId, reason);
            app.showNotification('Payment voided successfully', 'success');
            app.closeModal();
            if (this.currentCustomer) {
                await Database.reconcileShortagesForCustomer(this.currentCustomer.id);
                const installments = await Database.getCustomerInstallments(this.currentCustomer.id);
                this.installments = installments;
                document.getElementById('customer-details').innerHTML = this.renderCustomerInfo(this.currentCustomer);
                this.renderInstallments(installments);
            }
        } catch (e) {
            console.error('Void payment error:', e);
            app.showNotification('Failed to void payment', 'error');
        } finally {
            app.hideLoading();
        }
    }

    openDeleteScheduleModal(purchaseId) {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-trash"></i> Delete Schedule</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to logically delete the entire schedule, all its installments and payments? The stock item will be marked as unsold so you can recreate a corrected plan.</p>
                        <div class="form-group">
                            <label class="form-label">Reason (optional)</label>
                            <textarea id="delete-schedule-reason" class="form-input" rows="3" placeholder="Reason for deletion"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-danger" onclick="app.installments.deleteSchedule(${purchaseId})">
                            <i class="fas fa-trash"></i> Delete Schedule
                        </button>
                    </div>
                </div>
            </div>
        `;
        app.showModal(modalHtml);
    }

    async deleteSchedule(purchaseId) {
        const reason = (document.getElementById('delete-schedule-reason')?.value || '').trim();
        try {
            app.showLoading();
            await Database.logicalDeleteSchedule(purchaseId, reason);
            app.showNotification('Schedule deleted (logical)', 'success');
            app.closeModal();
            if (this.currentCustomer) {
                const installments = await Database.getCustomerInstallments(this.currentCustomer.id);
                this.renderInstallments(installments);
            }
        } catch (e) {
            console.error('Delete schedule error:', e);
            app.showNotification('Failed to delete schedule', 'error');
        } finally {
            app.hideLoading();
        }
    }
}

window.InstallmentManager = InstallmentManager;
