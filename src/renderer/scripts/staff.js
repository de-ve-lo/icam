class StaffManager {
    constructor() {
        this.staff = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('add-staff-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.showAddModal());
    }

    currentMonth() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    async loadData() {
        try {
            app.showLoading();
            this.staff = await Database.getStaff();
            this.renderTable();
        } catch (error) {
            console.error('Error loading staff:', error);
            app.showNotification('Failed to load staff: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    async renderTable() {
        const tbody = document.querySelector('#staff-table tbody');
        if (!tbody) return;
        const month = this.currentMonth();
        const rows = [];
        for (const s of this.staff) {
            const entries = await Database.getStaffEntries(s.id, month);
            const advances = (entries || []).filter((e) => e.type === 'advance').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            const remaining = StaffSalary.remainingForMonth(s.monthly_salary, advances);
            const collected = StaffSalary.collectedInMonth(entries);
            rows.push(`
                <tr>
                    <td>${s.name}</td>
                    <td>${s.phone || '-'}</td>
                    <td>${Utils.formatCurrency(s.monthly_salary)}</td>
                    <td>${Utils.formatCurrency(advances)}</td>
                    <td>${Utils.formatCurrency(remaining)}</td>
                    <td>${Utils.formatCurrency(collected)}</td>
                    <td>${s.status || 'active'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-primary" type="button" onclick="app.staff.edit(${s.id})">Edit</button>
                            <button class="btn btn-sm btn-warning" type="button" onclick="app.staff.payAdvance(${s.id})">Advance</button>
                            <button class="btn btn-sm btn-success" type="button" onclick="app.staff.paySalary(${s.id})">Salary</button>
                        </div>
                    </td>
                </tr>
            `);
        }
        tbody.innerHTML = rows.join('') || '<tr><td colspan="8">No staff added yet.</td></tr>';
    }

    formHtml(staff) {
        const s = staff || {};
        return `
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3>${s.id ? 'Edit Staff' : 'Add Staff'}</h3>
                        <button class="modal-close" type="button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="staff-form" class="form-grid">
                            <input type="hidden" name="id" value="${s.id || ''}">
                            <div class="form-group">
                                <label class="form-label required">Name</label>
                                <input class="form-input" name="name" required value="${s.name || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Phone</label>
                                <input class="form-input" name="phone" value="${s.phone || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Monthly salary</label>
                                <input class="form-input" type="number" name="monthly_salary" min="0" step="1" required value="${s.monthly_salary || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Join date</label>
                                <input class="form-input" type="date" name="join_date" value="${s.join_date || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Status</label>
                                <select class="form-input" name="status">
                                    <option value="active" ${s.status !== 'inactive' ? 'selected' : ''}>Active</option>
                                    <option value="inactive" ${s.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" type="button" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" type="button" onclick="app.staff.save()">Save</button>
                    </div>
                </div>
            </div>
        `;
    }

    showAddModal() {
        app.showModal(this.formHtml(null));
    }

    edit(id) {
        const staff = this.staff.find((s) => Number(s.id) === Number(id));
        if (!staff) return;
        app.showModal(this.formHtml(staff));
    }

    async save() {
        const form = document.getElementById('staff-form');
        if (!form || !app.validateForm(form)) return;
        const data = new FormData(form);
        const payload = {
            id: data.get('id') ? Number(data.get('id')) : null,
            name: String(data.get('name') || '').trim(),
            phone: String(data.get('phone') || '').trim(),
            monthly_salary: Number(data.get('monthly_salary')) || 0,
            join_date: data.get('join_date') || null,
            status: data.get('status') || 'active'
        };
        if (!payload.name) {
            app.showNotification('Staff name is required', 'error');
            return;
        }
        try {
            if (payload.id) await Database.updateStaff(payload);
            else await Database.addStaff(payload);
            app.closeModal();
            app.showNotification('Staff saved', 'success');
            await this.loadData();
        } catch (error) {
            app.showNotification('Could not save staff: ' + error.message, 'error');
        }
    }

    async payAdvance(id) {
        await this.payEntry(id, 'advance');
    }

    async paySalary(id) {
        await this.payEntry(id, 'salary');
    }

    async payEntry(id, type) {
        const staff = this.staff.find((s) => Number(s.id) === Number(id));
        if (!staff) return;
        const month = this.currentMonth();
        const entries = await Database.getStaffEntries(staff.id, month);
        const advances = (entries || []).filter((e) => e.type === 'advance').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const remaining = StaffSalary.remainingForMonth(staff.monthly_salary, advances);
        const today = Utils.getCurrentDate ? Utils.getCurrentDate('YYYY-MM-DD') : new Date().toISOString().slice(0, 10);
        const defaultAmount = type === 'salary' ? remaining : '';
        app.showModal(`
            <div class="modal">
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3>${type === 'advance' ? 'Salary Advance' : 'Pay Salary'} — ${staff.name}</h3>
                        <button class="modal-close" type="button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Monthly: ${Utils.formatCurrency(staff.monthly_salary)} | Advances this month: ${Utils.formatCurrency(advances)} | Remaining: ${Utils.formatCurrency(remaining)}</p>
                        <form id="staff-pay-form" class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">Date</label>
                                <input class="form-input" type="date" name="entry_date" required value="${today}">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Amount</label>
                                <input class="form-input" type="number" name="amount" min="1" step="1" required value="${defaultAmount}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Notes</label>
                                <input class="form-input" name="notes">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" type="button" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" type="button" id="staff-pay-save">Save</button>
                    </div>
                </div>
            </div>
        `);
        const saveBtn = document.getElementById('staff-pay-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const form = document.getElementById('staff-pay-form');
                if (!form || !app.validateForm(form)) return;
                const fd = new FormData(form);
                const amount = Number(fd.get('amount')) || 0;
                if (amount <= 0) {
                    app.showNotification('Enter a valid amount', 'error');
                    return;
                }
                if (type === 'advance' && amount > remaining) {
                    app.showNotification('Advance is more than remaining salary for this month', 'warning');
                }
                if (type === 'salary' && amount > remaining) {
                    app.showNotification('Salary amount cannot exceed remaining for this month', 'error');
                    return;
                }
                const entryDate = fd.get('entry_date');
                const monthKey = String(entryDate).slice(0, 7);
                try {
                    await Database.addStaffSalaryEntry({
                        staff_id: staff.id,
                        staff_name: staff.name,
                        entry_date: entryDate,
                        type,
                        amount,
                        month: monthKey,
                        notes: fd.get('notes') || ''
                    });
                    app.closeModal();
                    app.showNotification(type === 'advance' ? 'Advance recorded' : 'Salary recorded', 'success');
                    await this.loadData();
                } catch (error) {
                    app.showNotification('Could not save: ' + error.message, 'error');
                }
            });
        }
    }
}

window.StaffManager = StaffManager;
