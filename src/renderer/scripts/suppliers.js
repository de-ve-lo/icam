// Suppliers Management Module

class SupplierManager {
    constructor() {
        this.suppliers = [];
        this.currentSupplier = null;
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
            app.showLoading();
            this.suppliers = await Database.getSuppliers();
            this.renderTable();
        } catch (error) {
            console.error('Error loading suppliers:', error);
            app.showNotification('Failed to load suppliers: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    renderTable() {
        const tbody = document.querySelector('#suppliers-table tbody');
        if (!tbody) return;

        tbody.innerHTML = this.suppliers.map(supplier => `
            <tr class="stagger-item" data-id="${supplier.id}" data-created="${supplier.created_at}">
                <td>${supplier.id}</td>
                <td>${Utils.capitalizeWords(supplier.supplier_name)}</td>
                <td>${Utils.formatDate(supplier.created_at, 'readable')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" 
                            onclick="app.suppliers.edit(${supplier.id})" 
                            title="Edit Supplier">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${!(window.auth && window.auth.isEmployee()) ? `
                        <button class="btn btn-sm btn-danger" 
                            onclick="app.suppliers.confirmDelete(${supplier.id})" 
                            title="Delete Supplier">
                            <i class="fas fa-trash"></i>
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Add search and filter functionality
        this.addSearchFilter();
    }

    // Added: edit handler invoked from table action button
    async edit(id) {
        try {
            const supplier = this.suppliers.find(s => s.id === id) || await Database.get('SELECT * FROM suppliers WHERE id = ?', [id]);
            if (!supplier) {
                app.showNotification('Supplier not found', 'error');
                return;
            }
            this.showEditModal(supplier);
        } catch (error) {
            console.error('Error loading supplier for edit:', error);
            app.showNotification('Failed to load supplier for edit: ' + error.message, 'error');
        }
    }

    addSearchFilter() {
        let searchContainer = document.getElementById('suppliers-search-container');
        if (!searchContainer) {
            const headerContainer = document.querySelector('#suppliers-section .section-header');
            if (headerContainer) {
                const searchHTML = `
                    <div id="suppliers-search-container" class="search-filter-container" style="display: flex; gap: 16px; align-items: center; margin-top: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0;">
                        <div class="search-group" style="flex: 1;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #495057;">Search Suppliers:</label>
                            <div class="input-group">
                                <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #6c757d;"></i>
                                <input type="text" id="supplier-search" 
                                    placeholder="Search by supplier name..." 
                                    class="form-input" style="padding-left: 40px;">
                            </div>
                        </div>
                        <div class="filter-group" style="min-width: 200px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #495057;">Date Range:</label>
                            <select id="supplier-date-filter" class="form-input">
                                <option value="all">All Time</option>
                                <option value="7" selected>Last 7 Days</option>
                                <option value="30">Last 30 Days</option>
                                <option value="90">Last 3 Months</option>
                                <option value="365">Last Year</option>
                            </select>
                        </div>
                        <button id="supplier-clear-filters" class="btn btn-secondary" style="white-space: nowrap;">
                            <i class="fas fa-times"></i> Clear
                        </button>
                    </div>
                `;
                headerContainer.insertAdjacentHTML('beforeend', searchHTML);
                this.setupFilters();
            }
        }
    }
    
    setupFilters() {
        const searchInput = document.getElementById('supplier-search');
        const dateFilter = document.getElementById('supplier-date-filter');
        const clearBtn = document.getElementById('supplier-clear-filters');
        
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => this.applyFilters(), 300));
        }
        
        if (dateFilter) {
            dateFilter.addEventListener('change', () => this.applyFilters());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                dateFilter.value = 'all';
                this.applyFilters();
            });
        }
        
        // Apply initial filter with 7-day default
        this.applyFilters();
    }
    
    applyFilters() {
        const searchTerm = document.getElementById('supplier-search')?.value.toLowerCase() || '';
        const dateFilterValue = document.getElementById('supplier-date-filter')?.value || 'all';
        
        const rows = document.querySelectorAll('#suppliers-table tbody tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const supplierName = row.children[1].textContent.toLowerCase();
            const dateText = row.children[2].textContent;
            const createdDate = new Date(row.getAttribute('data-created') || dateText);
            
            // Search filter
            const searchMatches = !searchTerm || supplierName.includes(searchTerm);
            
            // Date filter
            let dateMatches = true;
            if (dateFilterValue !== 'all') {
                const today = new Date();
                const daysBack = parseInt(dateFilterValue);
                const startDate = new Date(today.getTime() - (daysBack * 24 * 60 * 60 * 1000));
                dateMatches = createdDate >= startDate && createdDate <= today;
            }
            
            const visible = searchMatches && dateMatches;
            row.style.display = visible ? '' : 'none';
            if (visible) visibleCount++;
        });
        
        // Update results count
        let countElement = document.getElementById('suppliers-results-count');
        if (!countElement) {
            const container = document.getElementById('suppliers-search-container');
            if (container) {
                const countHTML = `<div id="suppliers-results-count" style="font-size: 14px; color: #6c757d; margin-top: 8px;"></div>`;
                container.insertAdjacentHTML('afterend', countHTML);
                countElement = document.getElementById('suppliers-results-count');
            }
        }
        
        if (countElement) {
            countElement.textContent = `Showing ${visibleCount} of ${rows.length} suppliers`;
        }
    }

    showAddModal() {
        this.currentSupplier = null;
        const modalHtml = `
            <div class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>
                            <i class="fas fa-truck"></i> 
                            Add New Supplier
                        </h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="supplier-form">
                            <div class="form-group">
                                <label class="form-label required">Supplier Name</label>
                                <input type="text" name="supplier_name" class="form-input" required 
                                    placeholder="e.g., Alpha Traders">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.suppliers.save()">
                            <i class="fas fa-save"></i> Save Supplier
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
    }

    showEditModal(supplier) {
        this.currentSupplier = supplier;
        const modalHtml = `
            <div class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>
                            <i class="fas fa-edit"></i> 
                            Edit Supplier
                        </h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="supplier-form">
                            <div class="form-group">
                                <label class="form-label required">Supplier Name</label>
                                <input type="text" name="supplier_name" class="form-input" required 
                                    value="${supplier.supplier_name}">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.suppliers.save()">
                            <i class="fas fa-save"></i> Update Supplier
                        </button>
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
            supplier_name: formData.get('supplier_name').trim()
        };

        try {
            app.showLoading();
            if (this.currentSupplier) {
                await Database.updateSupplier(this.currentSupplier.id, supplier);
                app.showNotification('Supplier updated successfully!', 'success');
            } else {
                await Database.addSupplier(supplier);
                app.showNotification('Supplier added successfully!', 'success');
            }
            app.closeModal();
            await this.loadData();
        } catch (error) {
            console.error('Error saving supplier:', error);
            app.showNotification('Failed to save supplier: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    confirmDelete(id) {
        if (window.auth && window.auth.isEmployee()) {
            window.auth.requireAdmin();
            return;
        }
        const supplier = this.suppliers.find(s => s.id === id);
        if (!supplier) return;

        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle text-danger"></i> Confirm Delete</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body text-center">
                        <p>Are you sure you want to delete this supplier?</p>
                        <div class="delete-supplier-info">
                            <strong>${Utils.capitalizeWords(supplier.supplier_name)}</strong><br>
                            <small class="text-muted">This action cannot be undone</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-danger" onclick="app.suppliers.delete(${id}); app.closeModal();">
                            <i class="fas fa-trash"></i> Delete Supplier
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

            // Check if supplier is used in stock or purchases
            const stockItems = await Database.query('SELECT COUNT(*) as count FROM stock WHERE supplier_id = ?', [id]);
            if (stockItems[0]?.count > 0) {
                app.showNotification('Cannot delete supplier: It is referenced by stock items', 'error');
                return;
            }

            await Database.deleteSupplier(id);
            app.showNotification('Supplier deleted successfully!', 'success');
            await this.loadData();
        } catch (error) {
            console.error('Error deleting supplier:', error);
            app.showNotification('Failed to delete supplier: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    cleanup() {
        this.suppliers = [];
        this.currentSupplier = null;
    }
}

window.SupplierManager = SupplierManager;
