// Expense Management Module

class ExpensesManager {
    constructor() {
        this.expenses = [];
        this.expenseTypes = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('add-expense-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openAddExpenseModal());
        }

        const addTypeBtn = document.getElementById('add-expense-type-btn');
        if (addTypeBtn) {
            addTypeBtn.addEventListener('click', () => this.openAddExpenseTypeModal());
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn') && e.target.closest('.expenses-tabs')) {
                this.switchTab(e.target.dataset.tab);
            }
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.expenses-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.expenses-tabs .tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }

    async loadData() {
        try {
            app.showLoading();
            this.expenseTypes = await Database.getExpenseTypes();
            this.expenses = await Database.getExpenses();
            this.renderExpenses();
            this.renderExpenseTypes();
        } catch (error) {
            console.error('Error loading expenses data:', error);
            app.showNotification('Failed to load expenses data', 'error');
        } finally {
            app.hideLoading();
        }
    }

    renderExpenses() {
        const container = document.getElementById('expenses-list');
        if (!container) return;

        if (this.expenses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No Expenses Found</h3>
                    <p>Start by recording your first expense.</p>
                    <button class="btn btn-primary" onclick="app.expenses.openAddExpenseModal()">
                        <i class="fas fa-plus"></i> Add Expense
                    </button>
                </div>
            `;
            return;
        }

        // Calculate summary stats
        const totalExpenses = this.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const thisMonthKey = Utils.toLocalDateString(new Date()).slice(0, 7);
        const thisMonthExpenses = this.expenses
            .filter(exp => String(exp.date || '').slice(0, 7) === thisMonthKey)
            .reduce((sum, exp) => sum + (exp.amount || 0), 0);

        const table = `
            <div class="expenses-summary">
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-icon"><i class="fas fa-calculator"></i></div>
                        <div class="card-content">
                            <h4>Total Expenses</h4>
                            <p class="amount">${Utils.formatCurrency(totalExpenses)}</p>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="card-icon"><i class="fas fa-calendar-month"></i></div>
                        <div class="card-content">
                            <h4>This Month</h4>
                            <p class="amount">${Utils.formatCurrency(thisMonthExpenses)}</p>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="card-icon"><i class="fas fa-tags"></i></div>
                        <div class="card-content">
                            <h4>Expense Types</h4>
                            <p class="count">${this.expenseTypes.length}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Notes</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.expenses.map(expense => `
                            <tr class="stagger-item">
                                <td>${Utils.formatDate(expense.date)}</td>
                                <td>
                                    <span class="expense-type-badge">${expense.expense_type_name}</span>
                                </td>
                                <td><strong>${Utils.formatCurrency(expense.amount)}</strong></td>
                                <td>${expense.notes || '-'}</td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn btn-sm btn-primary" onclick="app.expenses.editExpense(${expense.id})">
                                            <i class="fas fa-edit"></i> Edit
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="app.expenses.confirmDeleteExpense(${expense.id})">
                                            <i class="fas fa-trash"></i> Delete
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

    userExpenseTypes() {
        return (this.expenseTypes || []).filter((t) => t.name !== 'Staff Salary');
    }

    renderExpenseTypes() {
        const container = document.getElementById('expense-types-list');
        if (!container) return;

        if (this.userExpenseTypes().length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tags"></i>
                    <h3>No Expense Types</h3>
                    <p>Create expense categories to organize your expenses.</p>
                    <button class="btn btn-primary" onclick="app.expenses.openAddExpenseTypeModal()">
                        <i class="fas fa-plus"></i> Add Expense Type
                    </button>
                </div>
            `;
            return;
        }

        const typesList = `
            <div class="expense-types-grid">
                ${this.userExpenseTypes().map(type => {
                    const typeExpenses = this.expenses.filter(exp => exp.expense_type_id === type.id);
                    const typeTotal = typeExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
                    
                    return `
                        <div class="expense-type-card">
                            <div class="type-header">
                                <h4>${type.name}</h4>
                                <div class="type-actions">
                                    <button class="btn btn-sm btn-secondary" onclick="app.expenses.editExpenseType(${type.id})">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="app.expenses.confirmDeleteExpenseType(${type.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="type-stats">
                                <div class="stat">
                                    <span class="label">Total Spent:</span>
                                    <span class="value">${Utils.formatCurrency(typeTotal)}</span>
                                </div>
                                <div class="stat">
                                    <span class="label">Entries:</span>
                                    <span class="value">${typeExpenses.length}</span>
                                </div>
                            </div>
                            ${type.description ? `<p class="type-description">${type.description}</p>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.innerHTML = typesList;
    }

    openAddExpenseModal(expense) {
        if (this.userExpenseTypes().length === 0) {
            app.showNotification('Please create at least one expense type first', 'warning');
            this.openAddExpenseTypeModal();
            return;
        }

        const isEdit = expense && expense.id;
        const selectedType = isEdit ? String(expense.expense_type_id) : '';
        const dateValue = isEdit ? expense.date : Utils.toLocalDateString(new Date());
        const amountValue = isEdit ? expense.amount : '';
        const notesValue = isEdit ? Utils.escapeHtml(expense.notes || '') : '';

        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h3><i class="fas fa-receipt"></i> ${isEdit ? 'Edit Expense' : 'Add Expense'}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="expense-form" class="form-grid">
                            <input type="hidden" name="id" value="${isEdit ? expense.id : ''}">
                            <div class="form-group">
                                <label class="form-label required">Expense Type</label>
                                <div class="input-group">
                                    <select name="expense_type_id" class="form-input" required>
                                        <option value="">Select Expense Type</option>
                                        ${this.userExpenseTypes().map(type => `
                                            <option value="${type.id}" ${String(type.id) === selectedType ? 'selected' : ''}>${type.name}</option>
                                        `).join('')}
                                    </select>
                                    <button type="button" class="btn btn-secondary" onclick="app.expenses.openAddExpenseTypeModal()">
                                        <i class="fas fa-plus"></i> New Type
                                    </button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Date</label>
                                <input type="date" name="date" class="form-input" required value="${dateValue}">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Amount</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="amount" class="form-input" required min="1" step="0.01" value="${amountValue}">
                                </div>
                            </div>
                            <div class="form-group form-grid-full">
                                <label class="form-label">Notes</label>
                                <textarea name="notes" class="form-input" rows="3" placeholder="Additional details about this expense">${notesValue}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-success" onclick="app.expenses.saveExpense()">
                            <i class="fas fa-save"></i> Save Expense
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
    }

    openAddExpenseTypeModal(expenseType) {
        const isEdit = expenseType && expenseType.id;
        const nameValue = isEdit ? Utils.escapeHtml(expenseType.name || '') : '';
        const descriptionValue = isEdit ? Utils.escapeHtml(expenseType.description || '') : '';
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-tags"></i> ${isEdit ? 'Edit Expense Type' : 'Add Expense Type'}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="expense-type-form" class="form-grid">
                            <input type="hidden" name="id" value="${isEdit ? expenseType.id : ''}">
                            <div class="form-group">
                                <label class="form-label required">Type Name</label>
                                <input type="text" name="name" class="form-input" required placeholder="e.g., Office Rent, Utilities, Travel" value="${nameValue}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Description</label>
                                <textarea name="description" class="form-input" rows="3" placeholder="Optional description for this expense type">${descriptionValue}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-success" onclick="app.expenses.saveExpenseType()">
                            <i class="fas fa-save"></i> Save Type
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
    }

    async saveExpense() {
        const form = document.getElementById('expense-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const expense = {
            expense_type_id: parseInt(formData.get('expense_type_id')),
            amount: parseFloat(formData.get('amount')),
            date: formData.get('date'),
            notes: formData.get('notes')
        };

        const id = parseInt(formData.get('id'), 10);

        try {
            app.showLoading();
            if (id) {
                await Database.updateExpense(id, expense);
                app.showNotification('Expense updated successfully', 'success');
            } else {
                await Database.addExpense(expense);
                app.showNotification('Expense recorded successfully', 'success');
            }
            app.closeModal();
            await this.loadData();
        } catch (error) {
            console.error('Error saving expense:', error);
            app.showNotification('Failed to save expense', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async saveExpenseType() {
        const form = document.getElementById('expense-type-form');
        if (!app.validateForm(form)) return;

        const formData = new FormData(form);
        const expenseType = {
            name: formData.get('name'),
            description: formData.get('description')
        };

        if (String(expenseType.name || '').trim().toLowerCase() === 'staff salary') {
            app.showNotification('Staff salary is entered in Staff, not here', 'error');
            return;
        }

        const id = parseInt(formData.get('id'), 10);

        try {
            app.showLoading();
            if (id) {
                await Database.updateExpenseType(id, expenseType);
                app.showNotification('Expense type updated successfully', 'success');
            } else {
                await Database.addExpenseType(expenseType);
                app.showNotification('Expense type created successfully', 'success');
            }
            app.closeModal();
            await this.loadData();
        } catch (error) {
            console.error('Error saving expense type:', error);
            if (error.message && error.message.includes('UNIQUE constraint failed')) {
                app.showNotification('An expense type with this name already exists', 'error');
            } else {
                app.showNotification('Failed to save expense type', 'error');
            }
        } finally {
            app.hideLoading();
        }
    }

    editExpense(expenseId) {
        const expense = this.expenses.find(e => e.id === expenseId);
        if (!expense) return;
        this.openAddExpenseModal(expense);
    }

    editExpenseType(typeId) {
        const expenseType = this.expenseTypes.find(t => t.id === typeId);
        if (!expenseType) return;
        this.openAddExpenseTypeModal(expenseType);
    }

    confirmDeleteExpense(expenseId) {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle text-danger"></i> Confirm Delete</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body text-center">
                        <p>Are you sure you want to delete this expense? This action cannot be undone.</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-danger" onclick="app.expenses.deleteExpense(${expenseId}); app.closeModal();">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
        app.showModal(modalHtml);
    }

    confirmDeleteExpenseType(typeId) {
        const typeExpenses = this.expenses.filter(exp => exp.expense_type_id === typeId);
        if (typeExpenses.length > 0) {
            app.showNotification('Cannot delete expense type that has associated expenses', 'error');
            return;
        }
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle text-danger"></i> Confirm Delete</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body text-center">
                        <p>Are you sure you want to delete this expense type? This action cannot be undone.</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-danger" onclick="app.expenses.deleteExpenseType(${typeId}); app.closeModal();">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
        app.showModal(modalHtml);
    }

    async deleteExpense(expenseId) {
        try {
            app.showLoading();
            await Database.deleteExpense(expenseId);
            app.showNotification('Expense deleted successfully', 'success');
            await this.loadData();
        } catch (error) {
            console.error('Error deleting expense:', error);
            app.showNotification('Failed to delete expense', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async deleteExpenseType(typeId) {
        const typeExpenses = this.expenses.filter(exp => exp.expense_type_id === typeId);
        if (typeExpenses.length > 0) {
            app.showNotification('Cannot delete expense type that has associated expenses', 'error');
            return;
        }

        try {
            app.showLoading();
            await Database.deleteExpenseType(typeId);
            app.showNotification('Expense type deleted successfully', 'success');
            await this.loadData();
        } catch (error) {
            console.error('Error deleting expense type:', error);
            app.showNotification('Failed to delete expense type', 'error');
        } finally {
            app.hideLoading();
        }
    }

    cleanup() {
        this.expenses = [];
        this.expenseTypes = [];
    }
}

window.ExpensesManager = ExpensesManager;
