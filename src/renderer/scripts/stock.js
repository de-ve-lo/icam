// Stock Management Module

class StockManager {
    constructor() {
        this.stockItems = [];
        this.products = [];
        this.suppliers = [];
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
            app.showLoading();
            this.products = await Database.getProducts();
            this.suppliers = await Database.getSuppliers();
            this.stockItems = await Database.getStock();
            this.renderTable();
        } catch (error) {
            console.error('Error loading stock:', error);
            app.showNotification('Failed to load stock: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    renderTable() {
        const tbody = document.querySelector('#stock-table tbody');
        if (!tbody) return;

        tbody.innerHTML = this.stockItems.map(item => `
            <tr class="stagger-item" data-created="${item.created_at || item.stock_date}" data-status="${item.is_sold ? 'sold' : 'available'}">
                <td>${item.stock_no}</td>
                <td>${Utils.capitalizeWords(item.item_name)}</td>
                <td>${Utils.capitalizeWords(item.supplier_name)}</td>
                <td>${Utils.stockIdentifier(item).label}: ${Utils.stockIdentifier(item).value}</td>
                <td>${Utils.formatDate(item.stock_date)}</td>
                <td>
                    <span class="status-badge ${item.is_sold ? 'status-sold' : 'status-available'}">
                        ${item.is_sold ? 'Sold' : 'Available'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${item.is_sold ? '' : `
                        <button class="btn btn-sm btn-primary" onclick="app.stock.edit('${item.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.stock.confirmDelete('${item.id}')">
                            <i class="fas fa-trash"></i>
                        </button>`}
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Add search and filter functionality
        this.addSearchFilter();
    }
    
    addSearchFilter() {
        let searchContainer = document.getElementById('stock-search-container');
        if (!searchContainer) {
            const headerContainer = document.querySelector('#stock-section .section-header');
            if (headerContainer) {
                const searchHTML = `
                    <div id="stock-search-container" class="search-filter-container" style="display: flex; gap: 16px; align-items: center; margin-top: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0;">
                        <div class="search-group" style="flex: 1;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #495057;">Search Stock:</label>
                            <div class="input-group">
                                <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #6c757d;"></i>
                                <input type="text" id="stock-search" 
                                    placeholder="Search by stock no, product, supplier, identifier..." 
                                    class="form-input" style="padding-left: 40px;">
                            </div>
                        </div>
                        <div class="filter-group" style="min-width: 150px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #495057;">Status:</label>
                            <select id="stock-status-filter" class="form-input">
                                <option value="all">All Items</option>
                                <option value="available" selected>Available</option>
                                <option value="sold">Sold</option>
                            </select>
                        </div>
                        <div class="filter-group" style="min-width: 200px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #495057;">Date Range:</label>
                            <select id="stock-date-filter" class="form-input">
                                <option value="all">All Time</option>
                                <option value="7" selected>Last 7 Days</option>
                                <option value="30">Last 30 Days</option>
                                <option value="90">Last 3 Months</option>
                                <option value="365">Last Year</option>
                            </select>
                        </div>
                        <button id="stock-clear-filters" class="btn btn-secondary" style="white-space: nowrap;">
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
        const searchInput = document.getElementById('stock-search');
        const statusFilter = document.getElementById('stock-status-filter');
        const dateFilter = document.getElementById('stock-date-filter');
        const clearBtn = document.getElementById('stock-clear-filters');
        
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => this.applyFilters(), 300));
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyFilters());
        }
        
        if (dateFilter) {
            dateFilter.addEventListener('change', () => this.applyFilters());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                statusFilter.value = 'all';
                dateFilter.value = 'all';
                this.applyFilters();
            });
        }
        
        // Apply initial filter with available items and 7-day default
        this.applyFilters();
    }
    
    applyFilters() {
        const searchTerm = document.getElementById('stock-search')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('stock-status-filter')?.value || 'all';
        const dateFilterValue = document.getElementById('stock-date-filter')?.value || 'all';
        
        const rows = document.querySelectorAll('#stock-table tbody tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const stockNo = row.children[0].textContent.toLowerCase();
            const productName = row.children[1].textContent.toLowerCase();
            const supplierName = row.children[2].textContent.toLowerCase();
            const identifier = row.children[3].textContent.toLowerCase();
            const dateText = row.children[4].textContent;
            const status = row.getAttribute('data-status');
            const createdDate = new Date(row.getAttribute('data-created') || dateText);
            
            // Search filter
            const searchMatches = !searchTerm || 
                stockNo.includes(searchTerm) ||
                productName.includes(searchTerm) ||
                supplierName.includes(searchTerm) ||
                identifier.includes(searchTerm);
            
            // Status filter
            const statusMatches = statusFilter === 'all' || status === statusFilter;
            
            // Date filter
            let dateMatches = true;
            if (dateFilterValue !== 'all') {
                const today = new Date();
                const daysBack = parseInt(dateFilterValue);
                const startDate = new Date(today.getTime() - (daysBack * 24 * 60 * 60 * 1000));
                dateMatches = createdDate >= startDate && createdDate <= today;
            }
            
            const visible = searchMatches && statusMatches && dateMatches;
            row.style.display = visible ? '' : 'none';
            if (visible) visibleCount++;
        });
        
        // Update results count
        let countElement = document.getElementById('stock-results-count');
        if (!countElement) {
            const container = document.getElementById('stock-search-container');
            if (container) {
                const countHTML = `<div id="stock-results-count" style="font-size: 14px; color: #6c757d; margin-top: 8px;"></div>`;
                container.insertAdjacentHTML('afterend', countHTML);
                countElement = document.getElementById('stock-results-count');
            }
        }
        
        if (countElement) {
            countElement.textContent = `Showing ${visibleCount} of ${rows.length} stock items`;
        }
    }

    showAddModal() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h3><i class="fas fa-warehouse"></i> Add Stock Item</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="stock-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Product</label>
                                <select name="product_id" class="form-input" required>
                                    <option value="">Select Product</option>
                                    ${this.products.map(p => `<option value="${p.id}">${Utils.capitalizeWords(p.item_name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Supplier</label>
                                <select name="supplier_id" class="form-input" required>
                                    <option value="">Select Supplier</option>
                                    ${this.suppliers.map(s => `<option value="${s.id}">${Utils.capitalizeWords(s.supplier_name)}</option>`).join('')}
                                </select>
                            </div>
                            <div id="stock-category-fields"></div>
                            <div class="form-group">
                                <label class="form-label required">Stock Date</label>
                                <input type="date" name="stock_date" class="form-input" required value="${Utils.formatDate(new Date(), 'YYYY-MM-DD')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Stock No</label>
                                <input type="text" name="stock_no" class="form-input" required value="${Utils.generateId('STK-', 6)}">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.stock.save()">
                            <i class="fas fa-save"></i> Save Stock
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
        this.bindCategoryFields();
    }

    showEditModal(item) {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h3><i class="fas fa-edit"></i> Edit Stock Item</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="stock-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Product</label>
                                <select name="product_id" class="form-input" required>
                                    ${this.products.map(p => `<option value="${p.id}" ${p.id === item.product_id ? 'selected' : ''}>${Utils.capitalizeWords(p.item_name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Supplier</label>
                                <select name="supplier_id" class="form-input" required>
                                    ${this.suppliers.map(s => `<option value="${s.id}" ${s.id === item.supplier_id ? 'selected' : ''}>${Utils.capitalizeWords(s.supplier_name)}</option>`).join('')}
                                </select>
                            </div>
                            <div id="stock-category-fields"></div>
                            <div class="form-group">
                                <label class="form-label required">Stock Date</label>
                                <input type="date" name="stock_date" class="form-input" required value="${Utils.formatDate(item.stock_date, 'YYYY-MM-DD')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Stock No</label>
                                <input type="text" name="stock_no" class="form-input" required value="${item.stock_no}">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.stock.save('${item.id}')">
                            <i class="fas fa-save"></i> Update Stock
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
        this.bindCategoryFields(item);
    }

    categoryFieldsHtml(category, item = {}) {
        if (category === 'mobile') {
            return `
                <div class="form-group">
                    <label class="form-label required">IMEI</label>
                    <input type="text" name="imei" class="form-input" required value="${item.imei || ''}">
                </div>`;
        }
        if (category === 'misc') {
            return `
                <div class="form-group">
                    <label class="form-label">Serial No</label>
                    <input type="text" name="serial_no" class="form-input" value="${item.serial_no || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label required">Quantity</label>
                    <input type="number" name="quantity" class="form-input" required min="1" value="${item.quantity != null ? item.quantity : 1}">
                </div>`;
        }
        return `
            <div class="form-group">
                <label class="form-label required">Engine No</label>
                <input type="text" name="engine_no" class="form-input" required value="${item.engine_no || ''}">
            </div>
            <div class="form-group">
                <label class="form-label required">Chassis No</label>
                <input type="text" name="chassis_no" class="form-input" required value="${item.chassis_no || ''}">
            </div>
            ${category === 'car' ? `
            <div class="form-group">
                <label class="form-label">Reg No</label>
                <input type="text" name="reg_no" class="form-input" value="${item.reg_no || ''}">
            </div>` : ''}`;
    }

    bindCategoryFields(item = null) {
        const productSelect = document.querySelector('#stock-form [name="product_id"]');
        const fields = document.getElementById('stock-category-fields');
        if (!productSelect || !fields) return;
        const render = () => {
            const product = this.products.find(p => String(p.id) === String(productSelect.value));
            const category = product ? (product.category || 'bike') : 'bike';
            fields.innerHTML = this.categoryFieldsHtml(category, item || {});
        };
        productSelect.addEventListener('change', render);
        render();
    }

    async save(existingId = null) {
        const form = document.getElementById('stock-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const product = this.products.find(p => String(p.id) === String(formData.get('product_id')));
        const category = product ? (product.category || 'bike') : 'bike';
        const stock = {
            product_id: parseInt(formData.get('product_id')),
            supplier_id: parseInt(formData.get('supplier_id')),
            engine_no: (formData.get('engine_no') || '').trim() || null,
            chassis_no: (formData.get('chassis_no') || '').trim() || null,
            imei: (formData.get('imei') || '').trim() || null,
            reg_no: (formData.get('reg_no') || '').trim() || null,
            serial_no: (formData.get('serial_no') || '').trim() || null,
            quantity: parseInt(formData.get('quantity') || '1', 10) || 1,
            stock_date: formData.get('stock_date'),
            stock_no: formData.get('stock_no').trim()
        };

        try {
            app.showLoading();

            if (category === 'bike' || category === 'car') {
                if (!stock.engine_no || !stock.chassis_no) {
                    app.showNotification('Engine and chassis numbers are required', 'error');
                    return;
                }
                const duplicateEngine = await Database.get(
                    'SELECT id FROM stock WHERE engine_no = ? AND engine_no IS NOT NULL AND id != ?',
                    [stock.engine_no, existingId || 0]
                );
                const duplicateChassis = await Database.get(
                    'SELECT id FROM stock WHERE chassis_no = ? AND chassis_no IS NOT NULL AND id != ?',
                    [stock.chassis_no, existingId || 0]
                );
                if (duplicateEngine) {
                    app.showNotification(`Engine number "${stock.engine_no}" already exists in stock!`, 'error');
                    return;
                }
                if (duplicateChassis) {
                    app.showNotification(`Chassis number "${stock.chassis_no}" already exists in stock!`, 'error');
                    return;
                }
            } else if (category === 'mobile') {
                if (!stock.imei) {
                    app.showNotification('IMEI is required', 'error');
                    return;
                }
                const duplicateImei = await Database.get(
                    'SELECT id FROM stock WHERE imei = ? AND imei IS NOT NULL AND id != ?',
                    [stock.imei, existingId || 0]
                );
                if (duplicateImei) {
                    app.showNotification(`IMEI "${stock.imei}" already exists in stock!`, 'error');
                    return;
                }
            } else if (stock.quantity < 1) {
                app.showNotification('Quantity must be at least 1', 'error');
                return;
            }

            if (existingId) {
                await Database.run(`
                    UPDATE stock SET product_id = ?, supplier_id = ?, engine_no = ?, chassis_no = ?, imei = ?, reg_no = ?, serial_no = ?, quantity = ?, stock_date = ?, stock_no = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [stock.product_id, stock.supplier_id, stock.engine_no, stock.chassis_no, stock.imei, stock.reg_no, stock.serial_no, stock.quantity, stock.stock_date, stock.stock_no, existingId]);
                app.showNotification('Stock item updated successfully!', 'success');
            } else {
                await Database.addStock(stock);
                app.showNotification('Stock item added successfully!', 'success');
            }

            app.closeModal();
            await this.loadData();
        } catch (error) {
            console.error('Error saving stock:', error);
            
            // Handle specific constraint errors
            let errorMessage = 'Failed to save stock';
            if (error.message.includes('UNIQUE constraint failed: stock.engine_no')) {
                errorMessage = `Engine number "${stock.engine_no}" already exists in stock!`;
            } else if (error.message.includes('UNIQUE constraint failed: stock.chassis_no')) {
                errorMessage = `Chassis number "${stock.chassis_no}" already exists in stock!`;
            } else {
                errorMessage += ': ' + error.message;
            }
            
            app.showNotification(errorMessage, 'error');
        } finally {
            app.hideLoading();
        }
    }

    async edit(id) {
        const item = this.stockItems.find(s => String(s.id) === String(id));
        if (!item) {
            app.showNotification('Stock item not found', 'error');
            return;
        }
        this.showEditModal(item);
    }

    confirmDelete(id) {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle text-danger"></i> Confirm Delete</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body text-center">
                        <p>Are you sure you want to delete this stock item?</p>
                        <small class="text-muted">This action cannot be undone</small>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-danger" onclick="app.stock.delete('${id}'); app.closeModal();">
                            <i class="fas fa-trash"></i> Delete Stock
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

            // Check if stock is used in purchases
            const purchases = await Database.query('SELECT COUNT(*) as count FROM customer_purchases WHERE stock_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)', [id]);
            if (purchases[0]?.count > 0) {
                app.showNotification('Cannot delete stock: It is referenced by purchases', 'error');
                return;
            }

            await Database.run('DELETE FROM stock WHERE id = ?', [id]);
            app.showNotification('Stock item deleted successfully!', 'success');
            await this.loadData();
        } catch (error) {
            console.error('Error deleting stock:', error);
            app.showNotification('Failed to delete stock: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    cleanup() {
        this.stockItems = [];
    }
}

window.StockManager = StockManager;
