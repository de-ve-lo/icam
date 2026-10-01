// Products Management Module

class ProductManager {
    constructor() {
        this.products = [];
        this.currentProduct = null;
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
            if (typeof app !== 'undefined' && app.showLoading) {
                app.showLoading();
            }
            this.products = await Database.getProducts();
            this.renderTable();
            await this.loadStatistics();
        } catch (error) {
            console.error('Error loading products:', error);
            if (typeof app !== 'undefined' && app.showNotification) {
                app.showNotification('Failed to load products: ' + error.message, 'error');
            }
        } finally {
            if (typeof app !== 'undefined' && app.hideLoading) {
                app.hideLoading();
            }
        }
    }

    async loadStatistics() {
        try {
            const totalProducts = this.products.length;
            const avgPrice = totalProducts > 0 ? 
                this.products.reduce((sum, p) => sum + p.current_price, 0) / totalProducts : 0;
            
            // Update stats if elements exist
            const totalEl = document.getElementById('total-products');
            const avgEl = document.getElementById('avg-price');
            
            if (totalEl) totalEl.textContent = totalProducts;
            if (avgEl) avgEl.textContent = Utils.formatCurrency(avgPrice);
        } catch (error) {
            console.error('Error loading product statistics:', error);
        }
    }

    renderTable() {
        const tbody = document.querySelector('#products-table tbody');
        if (!tbody) return;

        tbody.innerHTML = this.products.map(product => `
            <tr class="stagger-item" data-id="${product.id}" data-created="${product.created_at}">
                <td>${product.id}</td>
                <td>
                    <div class="product-name">
                        <strong>${Utils.capitalizeWords(product.item_name)}</strong>
                    </div>
                </td>
                <td>${Utils.capitalizeWords(product.category || 'bike')}</td>
                <td>
                    <span class="currency">${Utils.formatCurrency(product.current_price)}</span>
                </td>
                <td>
                    <span class="currency">${Utils.formatCurrency(product.purchase_price)}</span>
                </td>
                <td>
                    <span class="profit-margin">
                        ${Utils.calculateProfitPercentage(product.current_price, product.purchase_price)}%
                    </span>
                </td>
                <td>
                    <span class="date">${Utils.formatDate(product.created_at, 'readable')}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" 
                            onclick="app.products.edit(${product.id})" 
                            title="Edit Product">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-info" 
                            onclick="app.products.view(${product.id})" 
                            title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" 
                            onclick="app.products.confirmDelete(${product.id})" 
                            title="Delete Product">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Add search functionality
        this.addSearchFilter();
    }

    addSearchFilter() {
        let searchContainer = document.getElementById('products-search-container');
        if (!searchContainer) {
            const headerContainer = document.querySelector('#products-section .section-header');
            if (headerContainer) {
                const searchHTML = `
                    <div id="products-search-container" class="search-filter-container" style="display: flex; gap: 16px; align-items: center; margin-top: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0;">
                        <div class="search-group" style="flex: 1;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #495057;">Search Products:</label>
                            <div class="input-group">
                                <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #6c757d;"></i>
                                <input type="text" id="product-search" 
                                    placeholder="Search by product name, price range..." 
                                    class="form-input" style="padding-left: 40px;">
                            </div>
                        </div>
                        <div class="filter-group" style="min-width: 200px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #495057;">Date Range:</label>
                            <select id="product-date-filter" class="form-input">
                                <option value="all">All Time</option>
                                <option value="7" selected>Last 7 Days</option>
                                <option value="30">Last 30 Days</option>
                                <option value="90">Last 3 Months</option>
                                <option value="365">Last Year</option>
                                <option value="custom">Custom Range</option>
                            </select>
                        </div>
                        <div class="custom-date-range" id="product-custom-date-range" style="display: none; gap: 8px;">
                            <input type="date" id="product-date-from" class="form-input" style="width: 140px;">
                            <input type="date" id="product-date-to" class="form-input" style="width: 140px;">
                        </div>
                        <button id="product-clear-filters" class="btn btn-secondary" style="white-space: nowrap;">
                            <i class="fas fa-times"></i> Clear
                        </button>
                    </div>
                `;
                headerContainer.insertAdjacentHTML('beforeend', searchHTML);
                this.setupAdvancedFilters();
            }
        }
    }
    
    setupAdvancedFilters() {
        const searchInput = document.getElementById('product-search');
        const dateFilter = document.getElementById('product-date-filter');
        const customDateRange = document.getElementById('product-custom-date-range');
        const dateFrom = document.getElementById('product-date-from');
        const dateTo = document.getElementById('product-date-to');
        const clearBtn = document.getElementById('product-clear-filters');
        
        // Default date range to last 7 days
        const today = new Date();
        const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
        dateTo.value = today.toISOString().slice(0, 10);
        dateFrom.value = sevenDaysAgo.toISOString().slice(0, 10);
        
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => this.applyFilters(), 300));
        }
        
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    customDateRange.style.display = 'flex';
                } else {
                    customDateRange.style.display = 'none';
                }
                this.applyFilters();
            });
        }
        
        if (dateFrom && dateTo) {
            dateFrom.addEventListener('change', () => this.applyFilters());
            dateTo.addEventListener('change', () => this.applyFilters());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                dateFilter.value = 'all';
                customDateRange.style.display = 'none';
                dateFrom.value = '';
                dateTo.value = '';
                this.applyFilters();
            });
        }
        
        // Apply initial filter with 7-day default
        this.applyFilters();
    }

    applyFilters() {
        const searchTerm = document.getElementById('product-search')?.value.toLowerCase() || '';
        const dateFilterValue = document.getElementById('product-date-filter')?.value || 'all';
        const dateFrom = document.getElementById('product-date-from')?.value;
        const dateTo = document.getElementById('product-date-to')?.value;
        
        const rows = document.querySelectorAll('#products-table tbody tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const productName = row.children[1].textContent.toLowerCase();
            const currentPrice = parseFloat(row.children[2].textContent.replace(/[^0-9.-]+/g, '')) || 0;
            const purchasePrice = parseFloat(row.children[3].textContent.replace(/[^0-9.-]+/g, '')) || 0;
            const dateText = row.children[5].textContent;
            const createdDate = new Date(row.getAttribute('data-created') || dateText);
            
            // Search filter
            const searchMatches = !searchTerm || 
                productName.includes(searchTerm) ||
                currentPrice.toString().includes(searchTerm) ||
                purchasePrice.toString().includes(searchTerm);
            
            // Date filter
            let dateMatches = true;
            if (dateFilterValue !== 'all') {
                const today = new Date();
                let startDate, endDate;
                
                if (dateFilterValue === 'custom') {
                    if (dateFrom && dateTo) {
                        startDate = new Date(dateFrom);
                        endDate = new Date(dateTo);
                        endDate.setHours(23, 59, 59, 999); // Include the full end date
                    } else {
                        dateMatches = true; // If custom dates not set, show all
                    }
                } else {
                    const daysBack = parseInt(dateFilterValue);
                    startDate = new Date(today.getTime() - (daysBack * 24 * 60 * 60 * 1000));
                    endDate = today;
                }
                
                if (startDate && endDate) {
                    dateMatches = createdDate >= startDate && createdDate <= endDate;
                }
            }
            
            const visible = searchMatches && dateMatches;
            row.style.display = visible ? '' : 'none';
            if (visible) visibleCount++;
        });
        
        // Update results count
        this.updateResultsCount(visibleCount, rows.length);
    }
    
    updateResultsCount(visible, total) {
        let countElement = document.getElementById('products-results-count');
        if (!countElement) {
            const container = document.getElementById('products-search-container');
            if (container) {
                const countHTML = `<div id="products-results-count" style="font-size: 14px; color: #6c757d; margin-top: 8px;"></div>`;
                container.insertAdjacentHTML('afterend', countHTML);
                countElement = document.getElementById('products-results-count');
            }
        }
        
        if (countElement) {
            countElement.textContent = `Showing ${visible} of ${total} products`;
        }
    }

    showAddModal() {
        this.currentProduct = null;
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h3>
                            <i class="fas fa-motorcycle"></i> 
                            Add New Product
                        </h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="product-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Category</label>
                                <select name="category" class="form-input" required>
                                    <option value="bike">Bike</option>
                                    <option value="mobile">Mobile</option>
                                    <option value="car">Car</option>
                                    <option value="misc">Misc</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Product Name</label>
                                <input type="text" name="item_name" class="form-input" required 
                                    placeholder="e.g., Honda CB 150F">
                                <small class="form-hint">Enter the full name/model of the product</small>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label required">Current Sale Price</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="current_price" class="form-input" 
                                        required min="0" step="0.01" placeholder="0.00">
                                </div>
                                <small class="form-hint">Price at which you sell to customers</small>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label required">Purchase Price</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="purchase_price" class="form-input" 
                                        required min="0" step="0.01" placeholder="0.00">
                                </div>
                                <small class="form-hint">Price at which you bought from supplier</small>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Profit Margin</label>
                                <div class="profit-display">
                                    <span id="profit-amount">Rs. 0</span>
                                    (<span id="profit-percentage">0%</span>)
                                </div>
                                <small class="form-hint">Automatically calculated based on prices</small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.products.save()">
                            <i class="fas fa-save"></i> Save Product
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        app.showModal(modalHtml);
        this.setupFormCalculations();
    }

    showEditModal(product) {
        this.currentProduct = product;
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h3>
                            <i class="fas fa-edit"></i> 
                            Edit Product
                        </h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="product-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Category</label>
                                <select name="category" class="form-input" required>
                                    <option value="bike" ${(product.category || 'bike') === 'bike' ? 'selected' : ''}>Bike</option>
                                    <option value="mobile" ${product.category === 'mobile' ? 'selected' : ''}>Mobile</option>
                                    <option value="car" ${product.category === 'car' ? 'selected' : ''}>Car</option>
                                    <option value="misc" ${product.category === 'misc' ? 'selected' : ''}>Misc</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Product Name</label>
                                <input type="text" name="item_name" class="form-input" required 
                                    value="${product.item_name}" placeholder="e.g., Honda CB 150F">
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label required">Current Sale Price</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="current_price" class="form-input" 
                                        required min="0" step="0.01" value="${product.current_price}">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label required">Purchase Price</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="purchase_price" class="form-input" 
                                        required min="0" step="0.01" value="${product.purchase_price}">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Profit Margin</label>
                                <div class="profit-display">
                                    <span id="profit-amount">Rs. 0</span>
                                    (<span id="profit-percentage">0%</span>)
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.products.save()">
                            <i class="fas fa-save"></i> Update Product
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        app.showModal(modalHtml);
        this.setupFormCalculations();
        this.calculateProfit(); // Calculate initial values
    }

    setupFormCalculations() {
        const saleInput = document.querySelector('[name="current_price"]');
        const purchaseInput = document.querySelector('[name="purchase_price"]');
        
        if (saleInput && purchaseInput) {
            saleInput.addEventListener('input', () => this.calculateProfit());
            purchaseInput.addEventListener('input', () => this.calculateProfit());
        }
    }

    calculateProfit() {
        const salePrice = parseFloat(document.querySelector('[name="current_price"]')?.value) || 0;
        const purchasePrice = parseFloat(document.querySelector('[name="purchase_price"]')?.value) || 0;
        
        const profitAmount = salePrice - purchasePrice;
        const profitPercentage = purchasePrice > 0 ? (profitAmount / purchasePrice) * 100 : 0;
        
        const profitAmountEl = document.getElementById('profit-amount');
        const profitPercentageEl = document.getElementById('profit-percentage');
        
        if (profitAmountEl) {
            profitAmountEl.textContent = Utils.formatCurrency(profitAmount);
            profitAmountEl.className = profitAmount >= 0 ? 'text-success' : 'text-danger';
        }
        
        if (profitPercentageEl) {
            profitPercentageEl.textContent = `${Utils.roundTo(profitPercentage, 1)}%`;
            profitPercentageEl.className = profitPercentage >= 0 ? 'text-success' : 'text-danger';
        }
    }

    async save() {
        const form = document.getElementById('product-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const product = {
            item_name: formData.get('item_name').trim(),
            current_price: parseFloat(formData.get('current_price')),
            purchase_price: parseFloat(formData.get('purchase_price')),
            category: formData.get('category') || 'bike',
            unit: 'piece'
        };

        // Validation
        if (product.current_price <= 0 || product.purchase_price <= 0) {
            app.showNotification('Prices must be greater than 0', 'error');
            return;
        }

        try {
            app.showLoading();
            
            if (this.currentProduct) {
                await Database.updateProduct(this.currentProduct.id, product);
                app.showNotification('Product updated successfully!', 'success');
            } else {
                await Database.addProduct(product);
                app.showNotification('Product added successfully!', 'success');
            }
            
            app.closeModal();
            await this.loadData();
        } catch (error) {
            console.error('Error saving product:', error);
            app.showNotification('Failed to save product: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    async edit(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) {
            app.showNotification('Product not found', 'error');
            return;
        }
        this.showEditModal(product);
    }

    async view(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) {
            app.showNotification('Product not found', 'error');
            return;
        }

        const profitAmount = product.current_price - product.purchase_price;
        const profitPercentage = Utils.calculateProfitPercentage(product.current_price, product.purchase_price);
        
        const modalHtml = `
            <div class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-motorcycle"></i> Product Details</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Product ID:</label>
                                <span>#${product.id}</span>
                            </div>
                            <div class="detail-item">
                                <label>Product Name:</label>
                                <span class="font-semibold">${Utils.capitalizeWords(product.item_name)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Current Sale Price:</label>
                                <span class="text-success font-semibold">${Utils.formatCurrency(product.current_price)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Purchase Price:</label>
                                <span>${Utils.formatCurrency(product.purchase_price)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Profit Amount:</label>
                                <span class="${profitAmount >= 0 ? 'text-success' : 'text-danger'} font-semibold">
                                    ${Utils.formatCurrency(profitAmount)}
                                </span>
                            </div>
                            <div class="detail-item">
                                <label>Profit Percentage:</label>
                                <span class="${profitPercentage >= 0 ? 'text-success' : 'text-danger'} font-semibold">
                                    ${profitPercentage}%
                                </span>
                            </div>
                            <div class="detail-item">
                                <label>Created Date:</label>
                                <span>${Utils.formatDate(product.created_at, 'readable')}</span>
                            </div>
                            <div class="detail-item">
                                <label>Last Updated:</label>
                                <span>${Utils.formatDate(product.updated_at, 'readable')}</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="app.products.edit(${product.id}); app.closeModal();">
                            <i class="fas fa-edit"></i> Edit Product
                        </button>
                        <button class="btn btn-secondary" onclick="app.closeModal()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        app.showModal(modalHtml);
    }

    confirmDelete(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) return;
        
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle text-danger"></i> Confirm Delete</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body text-center">
                        <p>Are you sure you want to delete this product?</p>
                        <div class="delete-product-info">
                            <strong>${Utils.capitalizeWords(product.item_name)}</strong><br>
                            <small class="text-muted">This action cannot be undone</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-danger" onclick="app.products.delete(${id}); app.closeModal();">
                            <i class="fas fa-trash"></i> Delete Product
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
            
            // Check if product is used in stock
            const stockItems = await Database.query('SELECT COUNT(*) as count FROM stock WHERE product_id = ?', [id]);
            if (stockItems[0]?.count > 0) {
                app.showNotification('Cannot delete product: It is used in stock items', 'error');
                return;
            }
            
            await Database.deleteProduct(id);
            app.showNotification('Product deleted successfully!', 'success');
            await this.loadData();
        } catch (error) {
            console.error('Error deleting product:', error);
            app.showNotification('Failed to delete product: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    // Export functionality
    async exportProducts(format = 'csv') {
        try {
            const products = this.products.map(product => ({
                ID: product.id,
                'Product Name': product.item_name,
                'Current Price': product.current_price,
                'Purchase Price': product.purchase_price,
                'Profit Amount': product.current_price - product.purchase_price,
                'Profit Percentage': Utils.calculateProfitPercentage(product.current_price, product.purchase_price),
                'Created Date': Utils.formatDate(product.created_at),
                'Updated Date': Utils.formatDate(product.updated_at)
            }));
            
            const filename = `products_export_${Utils.getCurrentDate('YYYY-MM-DD')}`;
            
            if (format === 'csv') {
                Utils.downloadCSV(products, `${filename}.csv`);
            } else if (format === 'json') {
                Utils.downloadJSON(products, `${filename}.json`);
            }
            
            app.showNotification(`Products exported successfully as ${format.toUpperCase()}`, 'success');
        } catch (error) {
            console.error('Error exporting products:', error);
            app.showNotification('Failed to export products', 'error');
        }
    }

    cleanup() {
        // Cleanup event listeners and resources
        this.products = [];
        this.currentProduct = null;
    }
}

// Export to window
window.ProductManager = ProductManager;
