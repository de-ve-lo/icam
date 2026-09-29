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
        const thisMonthExpenses = this.expenses
            .filter(exp => {
                const expDate = new Date(exp.date);
                const now = new Date();
                return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
            })
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
                                        <button class="btn btn-sm btn-danger" onclick="app.expenses.deleteExpense(${expense.id})">
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

    renderExpenseTypes() {
        const container = document.getElementById('expense-types-list');
        if (!container) return;

        if (this.expenseTypes.length === 0) {
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
                ${this.expenseTypes.map(type => {
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
                                    <button class="btn btn-sm btn-danger" onclick="app.expenses.deleteExpenseType(${type.id})">
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

    openAddExpenseModal() {
        if (this.expenseTypes.length === 0) {
            app.showNotification('Please create at least one expense type first', 'warning');
            this.openAddExpenseTypeModal();
            return;
        }

        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h3><i class="fas fa-receipt"></i> Add Expense</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="expense-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Expense Type</label>
                                <div class="input-group">
                                    <select name="expense_type_id" class="form-input" required>
                                        <option value="">Select Expense Type</option>
                                        ${this.expenseTypes.map(type => `
                                            <option value="${type.id}">${type.name}</option>
                                        `).join('')}
                                    </select>
                                    <button type="button" class="btn btn-secondary" onclick="app.expenses.openAddExpenseTypeModal()">
                                        <i class="fas fa-plus"></i> New Type
                                    </button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Date</label>
                                <input type="date" name="date" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Amount</label>
                                <div class="input-group">
                                    <span class="input-prefix">Rs.</span>
                                    <input type="number" name="amount" class="form-input" required min="1" step="0.01">
                                </div>
                            </div>
                            <div class="form-group form-grid-full">
                                <label class="form-label">Notes</label>
                                <textarea name="notes" class="form-input" rows="3" placeholder="Additional details about this expense"></textarea>
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

    openAddExpenseTypeModal() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3><i class="fas fa-tags"></i> Add Expense Type</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="expense-type-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Type Name</label>
                                <input type="text" name="name" class="form-input" required placeholder="e.g., Office Rent, Utilities, Travel">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Description</label>
                                <textarea name="description" class="form-input" rows="3" placeholder="Optional description for this expense type"></textarea>
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

        try {
            app.showLoading();
            await Database.addExpense(expense);
            app.showNotification('Expense recorded successfully', 'success');
            app.closeModal();
            await this.loadData(); // Refresh the list
        } catch (error) {
            console.error('Error saving expense:', error);
            app.showNotification('Failed to record expense', 'error');
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

        try {
            app.showLoading();
            await Database.addExpenseType(expenseType);
            app.showNotification('Expense type created successfully', 'success');
            app.closeModal();
            await this.loadData(); // Refresh the lists
        } catch (error) {
            console.error('Error saving expense type:', error);
            if (error.message && error.message.includes('UNIQUE constraint failed')) {
                app.showNotification('An expense type with this name already exists', 'error');
            } else {
                app.showNotification('Failed to create expense type', 'error');
            }
        } finally {
            app.hideLoading();
        }
    }

    editExpense(expenseId) {
        const expense = this.expenses.find(e => e.id === expenseId);
        if (!expense) return;

        // Implementation for editing expense would go here
        app.showNotification('Edit functionality not yet implemented', 'info');
    }

    editExpenseType(typeId) {
        const expenseType = this.expenseTypes.find(t => t.id === typeId);
        if (!expenseType) return;

        // Implementation for editing expense type would go here
        app.showNotification('Edit functionality not yet implemented', 'info');
    }

    async deleteExpense(expenseId) {
        if (!confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
            return;
        }

        try {
            app.showLoading();
            await Database.deleteExpense(expenseId);
            app.showNotification('Expense deleted successfully', 'success');
            await this.loadData(); // Refresh the list
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

        if (!confirm('Are you sure you want to delete this expense type? This action cannot be undone.')) {
            return;
        }

        try {
            app.showLoading();
            await Database.deleteExpenseType(typeId);
            app.showNotification('Expense type deleted successfully', 'success');
            await this.loadData(); // Refresh the lists
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
