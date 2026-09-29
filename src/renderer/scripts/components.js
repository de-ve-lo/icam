// Utility Components and Base Classes

class ProductManager {
    constructor() {
        this.products = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('add-product-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddModal());
        }
    }

    async loadData() {
        try {
            this.products = await Database.getProducts();
            this.renderTable();
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    renderTable() {
        const tbody = document.querySelector('#products-table tbody');
        if (!tbody) return;

        tbody.innerHTML = this.products.map(product => `
            <tr class="stagger-item">
                <td>${product.id}</td>
                <td>${product.item_name}</td>
                <td>Rs. ${product.current_price}</td>
                <td>Rs. ${product.purchase_price}</td>
                <td>${app.formatDate(product.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="app.products.edit(${product.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.products.delete(${product.id})">
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
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-motorcycle"></i> Add New Product</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="product-form">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">Item Name</label>
                                    <input type="text" name="item_name" class="form-input" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Current Price</label>
                                    <input type="number" name="current_price" class="form-input" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Purchase Price</label>
                                    <input type="number" name="purchase_price" class="form-input" required>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.products.save()">Save Product</button>
                    </div>
                </div>
            </div>
        `;
        app.showModal(modalHtml);
    }

    async save() {
        const form = document.getElementById('product-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const product = {
            item_name: formData.get('item_name'),
            current_price: parseFloat(formData.get('current_price')),
            purchase_price: parseFloat(formData.get('purchase_price'))
        };

        try {
            await Database.addProduct(product);
            app.showNotification('Product added successfully!', 'success');
            app.closeModal();
            this.loadData();
        } catch (error) {
            app.showNotification('Failed to add product: ' + error.message, 'error');
        }
    }

    cleanup() {}
}

class SupplierManager {
    constructor() {
        this.suppliers = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('add-supplier-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddModal());
        }
    }

    async loadData() {
        try {
            this.suppliers = await Database.getSuppliers();
            this.renderTable();
        } catch (error) {
            console.error('Error loading suppliers:', error);
        }
    }

    renderTable() {
        const tbody = document.querySelector('#suppliers-table tbody');
        if (!tbody) return;

        tbody.innerHTML = this.suppliers.map(supplier => `
            <tr class="stagger-item">
                <td>${supplier.id}</td>
                <td>${supplier.supplier_name}</td>
                <td>${app.formatDate(supplier.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="app.suppliers.edit(${supplier.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.suppliers.delete(${supplier.id})">
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
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-truck"></i> Add New Supplier</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="supplier-form">
                            <div class="form-group">
                                <label class="form-label">Supplier Name</label>
                                <input type="text" name="supplier_name" class="form-input" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.suppliers.save()">Save Supplier</button>
                    </div>
                </div>
            </div>
        `;
        app.showModal(modalHtml);
    }

    async save() {
        const form = document.getElementById('supplier-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const supplier = {
            supplier_name: formData.get('supplier_name')
        };

        try {
            await Database.addSupplier(supplier);
            app.showNotification('Supplier added successfully!', 'success');
            app.closeModal();
            this.loadData();
        } catch (error) {
            app.showNotification('Failed to add supplier: ' + error.message, 'error');
        }
    }

    cleanup() {}
}

class StockManager {
    constructor() {
        this.stock = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('add-stock-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddModal());
        }
    }

    async loadData() {
        try {
            this.stock = await Database.getStock();
            this.renderTable();
        } catch (error) {
            console.error('Error loading stock:', error);
        }
    }

    renderTable() {
        const tbody = document.querySelector('#stock-table tbody');
        if (!tbody) return;

        tbody.innerHTML = this.stock.map(item => `
            <tr class="stagger-item">
                <td>${item.stock_no}</td>
                <td>${item.item_name}</td>
                <td>${item.supplier_name}</td>
                <td>${item.engine_no}</td>
                <td>${item.chassis_no}</td>
                <td>${app.formatDate(item.stock_date)}</td>
                <td>
                    <span class="badge ${item.is_sold ? 'badge-danger' : 'badge-success'}">
                        ${item.is_sold ? 'Sold' : 'Available'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    showAddModal() {
        // Stock modal implementation
        app.showNotification('Stock management modal - implement with product/supplier dropdowns', 'info');
    }

    cleanup() {}
}

class CustomerManager {
    constructor() {
        this.customers = [];
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
            this.customers = await Database.getCustomers();
            this.renderTable();
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    }

    renderTable() {
        const tbody = document.querySelector('#customers-table tbody');
        if (!tbody) return;

        tbody.innerHTML = this.customers.map(customer => `
            <tr class="stagger-item">
                <td>${customer.account_no}</td>
                <td>${customer.cnic_no}</td>
                <td>${customer.phone}</td>
                <td>${customer.address}</td>
                <td>${app.formatDate(customer.registration_date)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-success" onclick="app.customers.createInstallment(${customer.id})">
                            <i class="fas fa-calculator"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    showAddModal() {
        // Customer modal with guarantors
        app.showNotification('Customer management modal - implement with guarantor support', 'info');
    }

    createInstallment(customerId) {
        // Installment calculator
        app.showNotification('Installment calculator - implement with all required fields', 'info');
    }

    cleanup() {}
}

class InstallmentManager {
    constructor() {
        this.installments = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        const searchBtn = document.getElementById('search-customer-btn');
        const searchInput = document.getElementById('customer-search');
        
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => this.searchCustomer());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchCustomer();
            });
        }
    }

    async loadData() {
        // Load installments data
    }

    async searchCustomer() {
        const searchTerm = document.getElementById('customer-search').value.trim();
        if (!searchTerm) return;

        try {
            const customers = await Database.searchCustomers(searchTerm);
            if (customers.length > 0) {
                this.displayCustomerInfo(customers[0]);
                this.loadCustomerInstallments(customers[0].id);
            } else {
                app.showNotification('No customer found with that search term', 'warning');
            }
        } catch (error) {
            app.showNotification('Error searching customer: ' + error.message, 'error');
        }
    }

    displayCustomerInfo(customer) {
        const container = document.getElementById('customer-details');
        container.innerHTML = `
            <div class="customer-card">
                <h4>${customer.account_no}</h4>
                <p><strong>CNIC:</strong> ${customer.cnic_no}</p>
                <p><strong>Phone:</strong> ${customer.phone}</p>
                <p><strong>Address:</strong> ${customer.address}</p>
            </div>
        `;
    }

    async loadCustomerInstallments(customerId) {
        try {
            const installments = await Database.getCustomerInstallments(customerId);
            this.displayInstallments(installments);
        } catch (error) {
            app.showNotification('Error loading installments: ' + error.message, 'error');
        }
    }

    displayInstallments(installments) {
        const container = document.getElementById('installment-details');
        if (installments.length === 0) {
            container.innerHTML = '<p>No installments found for this customer.</p>';
            return;
        }

        container.innerHTML = `
            <div class="installment-table">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>Due Date</th>
                            <th>Amount</th>
                            <th>Paid</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${installments.map(inst => `
                            <tr>
                                <td>${inst.installment_no}</td>
                                <td>${app.formatDate(inst.due_date)}</td>
                                <td>${app.formatCurrency(inst.amount)}</td>
                                <td>${app.formatCurrency(inst.paid_amount || 0)}</td>
                                <td>
                                    <span class="badge ${this.getStatusClass(inst.status)}">
                                        ${inst.status}
                                    </span>
                                </td>
                                <td>
                                    ${inst.status !== 'paid' ? 
                                        `<button class="btn btn-sm btn-success" onclick="app.installments.payInstallment(${inst.id})">Pay</button>` :
                                        '<span class="text-success">Paid</span>'
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    getStatusClass(status) {
        const classes = {
            'paid': 'badge-success',
            'pending': 'badge-warning',
            'overdue': 'badge-danger',
            'partial': 'badge-secondary'
        };
        return classes[status] || 'badge-secondary';
    }

    payInstallment(installmentId) {
        // Payment modal
        app.showNotification('Payment processing - implement payment modal', 'info');
    }

    cleanup() {}
}

// Utility functions
window.ProductManager = ProductManager;
window.SupplierManager = SupplierManager;
window.StockManager = StockManager;
window.CustomerManager = CustomerManager;
window.InstallmentManager = InstallmentManager;