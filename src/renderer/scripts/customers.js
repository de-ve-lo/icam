// Customers Management Module

class CustomerManager {
    constructor() {
        this.customers = [];
        this.currentCustomer = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('add-customer-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddModal());
        }
    }

    async loadData() {
        try {
            app.showLoading();
            this.customers = await Database.getCustomers();
            this.renderTable();
        } catch (error) {
            console.error('Error loading customers:', error);
            app.showNotification('Failed to load customers: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    renderTable() {
        const tbody = document.querySelector('#customers-table tbody');
        if (!tbody) return;

        tbody.innerHTML = this.customers.map(c => `
            <tr class="stagger-item">
                <td>${c.account_no}</td>
                <td>${c.cnic_no}</td>
                <td>${c.phone}</td>
                <td>${Utils.truncate(c.address, 40)}</td>
                <td>${Utils.formatDate(c.registration_date)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-info" onclick="app.customers.view(${c.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="app.customers.edit(${c.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.customers.confirmDelete(${c.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    showAddModal() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h3><i class="fas fa-user-plus"></i> Add Customer</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body" style="max-height:70vh; overflow:auto;">
                        <form id="customer-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Account No</label>
                                <input type="text" name="account_no" class="form-input" required value="${Utils.generateAccountNumber()}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Customer Name</label>
                                <input type="text" name="customer_name" class="form-input" placeholder="Full Name">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">CNIC</label>
                                <input type="text" name="cnic_no" class="form-input" placeholder="12345-1234567-1" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Phone</label>
                                <input type="tel" name="phone" class="form-input" placeholder="03XX-XXXXXXX" required>
                            </div>
                            <div class="form-group form-grid-full">
                                <label class="form-label required">Address</label>
                                <input type="text" name="address" class="form-input" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Registration Date</label>
                                <input type="date" name="registration_date" class="form-input" required value="${Utils.formatDate(new Date(), 'YYYY-MM-DD')}">
                            </div>
                            <div class="form-group form-grid-full">
                                <label class="form-label">Other Info</label>
                                <textarea name="other_info" class="form-input" rows="3" placeholder="Notes, references, etc."></textarea>
                            </div>
                            <div class="form-grid-full">
                                <h4 style="margin:1rem 0;">Guarantors</h4>
                                <div id="guarantors-list" class="guarantor-list"></div>
                                <button type="button" class="btn btn-secondary" id="add-guarantor-btn"><i class="fas fa-plus"></i> Add Guarantor</button>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.customers.save()">
                            <i class="fas fa-save"></i> Save Customer
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
        this.setupInputMasking();
        this.setupGuarantorControls();
    }

    async showEditModal(customer) {
        const guarantors = await Database.getGuarantors(customer.id).catch(() => []);
        const gRows = (guarantors && guarantors.length ? guarantors : [{}]).map(g => `
            <div class="guarantor-item">
                <div style="flex:1; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:0.75rem; width:100%;">
                    <input type="text" class="form-input" placeholder="Name" data-g-name value="${g.name || ''}">
                    <input type="text" class="form-input" placeholder="CNIC" data-g-cnic value="${g.cnic_no || ''}">
                    <input type="text" class="form-input" placeholder="Mobile" data-g-phone value="${g.phone || ''}">
                    <input type="text" class="form-input" placeholder="Address" data-g-address value="${g.address || ''}">
                </div>
                <div>
                    <button type="button" class="btn btn-danger btn-sm" title="Remove" aria-label="Remove Guarantor">&times;</button>
                </div>
            </div>`).join('');

        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h3><i class="fas fa-user-edit"></i> Edit Customer</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body" style="max-height:70vh; overflow:auto;">
                        <form id="customer-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Account No</label>
                                <input type="text" name="account_no" class="form-input" required value="${customer.account_no}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Customer Name</label>
                                <input type="text" name="customer_name" class="form-input" value="${customer.customer_name || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">CNIC</label>
                                <input type="text" name="cnic_no" class="form-input" required value="${customer.cnic_no}">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Phone</label>
                                <input type="tel" name="phone" class="form-input" required value="${customer.phone}">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Address</label>
                                <input type="text" name="address" class="form-input" required value="${customer.address}">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Registration Date</label>
                                <input type="date" name="registration_date" class="form-input" required value="${Utils.formatDate(customer.registration_date, 'YYYY-MM-DD')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Other Info</label>
                                <textarea name="other_info" class="form-input" rows="3">${customer.other_info || ''}</textarea>
                            </div>
                            <div class="form-grid-full">
                                <h4 style="margin:1rem 0;">Guarantors</h4>
                                <div id="guarantors-list" class="guarantor-list">${gRows}</div>
                                <button type="button" class="btn btn-secondary" id="add-guarantor-btn"><i class="fas fa-plus"></i> Add Guarantor</button>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.customers.save(${customer.id})">
                            <i class="fas fa-save"></i> Update Customer
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
        this.setupInputMasking();
        this.setupGuarantorControls();
    }

    setupInputMasking() {
        // User requested no specific formatting/limits for CNIC/Phone.
        // Leave inputs as-is without enforcing masks or length constraints.
        return;
    }

    async save(existingId = null) {
        const form = document.getElementById('customer-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const customer = {
            account_no: formData.get('account_no').trim(),
            cnic_no: formData.get('cnic_no').trim(),
            phone: formData.get('phone').trim(),
            address: formData.get('address').trim(),
            registration_date: formData.get('registration_date'),
            other_info: formData.get('other_info') || null,
            customer_name: (formData.get('customer_name') || '').trim()
        };

        try {
            app.showLoading();
            if (existingId) {
                await Database.run(
                    'UPDATE customers SET account_no = ?, cnic_no = ?, phone = ?, address = ?, registration_date = ?, other_info = ?, customer_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [customer.account_no, customer.cnic_no, customer.phone, customer.address, customer.registration_date, customer.other_info, customer.customer_name, existingId]
                );
                await Database.run('DELETE FROM guarantors WHERE customer_id = ?', [existingId]);
                const guarantors = this.collectGuarantors();
                for (const g of guarantors) {
                    await Database.addGuarantor({
                        customer_id: existingId,
                        name: g.name,
                        phone: g.phone,
                        cnic_no: g.cnic_no,
                        address: g.address
                    });
                }
                app.showNotification('Customer updated successfully!', 'success');
            } else {
                const res = await Database.addCustomer(customer);
                const customerId = res.id;
                const guarantors = this.collectGuarantors();
                for (const g of guarantors) {
                    await Database.addGuarantor({
                        customer_id: customerId,
                        name: g.name,
                        phone: g.phone,
                        cnic_no: g.cnic_no,
                        address: g.address
                    });
                }
                app.showNotification('Customer added successfully!', 'success');
            }
            app.closeModal();
            await this.loadData();
        } catch (error) {
            console.error('Error saving customer:', error);
            app.showNotification('Failed to save customer: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    async edit(id) {
        const customer = this.customers.find(c => c.id === id);
        if (!customer) {
            app.showNotification('Customer not found', 'error');
            return;
        }
        this.showEditModal(customer);
    }

    async view(id) {
        const customer = this.customers.find(c => c.id === id);
        if (!customer) return;
        const guarantors = await Database.getGuarantors(customer.id).catch(() => []);

        const modalHtml = `
            <div class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-user"></i> Customer Details</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-grid">
                            <div class="detail-item"><label>Account No:</label><span>${customer.account_no}</span></div>
                            <div class="detail-item"><label>Name:</label><span>${customer.customer_name || '-'}</span></div>
                            <div class="detail-item"><label>CNIC:</label><span>${customer.cnic_no}</span></div>
                            <div class="detail-item"><label>Phone:</label><span>${customer.phone}</span></div>
                            <div class="detail-item"><label>Address:</label><span>${customer.address}</span></div>
                            <div class="detail-item"><label>Registration Date:</label><span>${Utils.formatDate(customer.registration_date, 'readable')}</span></div>
                            <div class="detail-item"><label>Other Info:</label><span>${customer.other_info || '-'}</span></div>
                        </div>
                        <div style="margin-top:1rem;">
                            <h4>Guarantors</h4>
                            ${guarantors && guarantors.length ? `
                                <div class="table-container">
                                    <table class="data-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th><th>CNIC</th><th>Mobile</th><th>Address</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${guarantors.map(g => `
                                                <tr>
                                                    <td>${g.name}</td>
                                                    <td>${g.cnic_no}</td>
                                                    <td>${g.phone}</td>
                                                    <td>${g.address}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : '<p class="text-muted">No guarantors added</p>'}
                        </div>
                        <div style="margin-top:1rem;">
                            <h4>Installment Plan</h4>
                            <div id="cust-installments">Loading...</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="app.customers.edit(${customer.id}); app.closeModal();">
                            <i class="fas fa-edit"></i> Edit Customer
                        </button>
                        <button class="btn btn-secondary" onclick="Utils.printElement('modal-container', 'Customer Details')">
                            <i class="fas fa-print"></i> Print
                        </button>
                        <button class="btn btn-secondary" onclick="app.closeModal()">Close</button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
        try {
            const rows = await Database.getCustomerInstallments(customer.id);
            const html = rows && rows.length ? `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>#</th><th>Due</th><th>Amount</th><th>Paid</th><th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(r => `
                                <tr>
                                    <td>${r.installment_no}</td>
                                    <td>${Utils.formatDate(r.due_date)}</td>
                                    <td>${Utils.formatCurrency(r.amount)}</td>
                                    <td>${Utils.formatCurrency(r.paid_amount || 0)}</td>
                                    <td>${Utils.capitalizeWords(r.status)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="text-muted">No installment plan found</p>';
            const container = document.getElementById('cust-installments');
            if (container) container.innerHTML = html;
        } catch (e) {
            const container = document.getElementById('cust-installments');
            if (container) container.innerHTML = '<p class="text-muted">Unable to load installment plan</p>';
        }
    }

    setupGuarantorControls() {
        const addBtn = document.getElementById('add-guarantor-btn');
        const list = document.getElementById('guarantors-list');
        if (!addBtn || !list) return;
        const addRow = (g = {}) => {
            const row = document.createElement('div');
            row.className = 'guarantor-item';
            row.innerHTML = `
                <div style="flex:1; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:0.75rem; width:100%;">
                    <input type="text" class="form-input" placeholder="Name" data-g-name value="${g.name || ''}">
                    <input type="text" class="form-input" placeholder="CNIC" data-g-cnic value="${g.cnic_no || ''}">
                    <input type="text" class="form-input" placeholder="Mobile" data-g-phone value="${g.phone || ''}">
                    <input type="text" class="form-input" placeholder="Address" data-g-address value="${g.address || ''}">
                </div>
                <div>
                    <button type="button" class="btn btn-danger btn-sm" title="Remove" aria-label="Remove Guarantor">&times;</button>
                </div>
            `;
            row.querySelector('button').addEventListener('click', () => row.remove());
            list.appendChild(row);
        };
        addBtn.addEventListener('click', () => addRow());
    }

    collectGuarantors() {
        const list = document.getElementById('guarantors-list');
        if (!list) return [];
        const rows = Array.from(list.querySelectorAll('.guarantor-item'));
        return rows.map(r => ({
            name: (r.querySelector('[data-g-name]')?.value || '').trim(),
            cnic_no: (r.querySelector('[data-g-cnic]')?.value || '').trim(),
            phone: (r.querySelector('[data-g-phone]')?.value || '').trim(),
            address: (r.querySelector('[data-g-address]')?.value || '').trim()
        })).filter(g => g.name || g.cnic_no || g.phone || g.address);
    }

    confirmDelete(id) {
        const customer = this.customers.find(c => c.id === id);
        if (!customer) return;

        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle text-danger"></i> Confirm Delete</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body text-center">
                        <p>Are you sure you want to delete this customer?</p>
                        <div class="delete-customer-info">
                            <strong>${customer.account_no}</strong><br>
                            <small class="text-muted">This action cannot be undone</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-danger" onclick="app.customers.delete(${id}); app.closeModal();">
                            <i class="fas fa-trash"></i> Delete Customer
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
    }

    async delete(id) {
        try {
            app.showLoading();

            // Check dependencies
            const purchases = await Database.query('SELECT COUNT(*) as count FROM customer_purchases WHERE customer_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)', [id]);
            if (purchases[0]?.count > 0) {
                app.showNotification('Cannot delete customer: They have purchase records', 'error');
                return;
            }

            await Database.run('DELETE FROM customers WHERE id = ?', [id]);
            await Database.run('DELETE FROM guarantors WHERE customer_id = ?', [id]);
            app.showNotification('Customer deleted successfully!', 'success');
            await this.loadData();
        } catch (error) {
            console.error('Error deleting customer:', error);
            app.showNotification('Failed to delete customer: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    cleanup() {
        this.customers = [];
    }
}

window.CustomerManager = CustomerManager;
