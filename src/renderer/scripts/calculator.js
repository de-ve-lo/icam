// Installment Calculator Component

class InstallmentCalculator {
    constructor() {
        this.currentCalculation = null;
        this.products = [];
        this.suppliers = [];
        this.customers = [];
        this.availableStock = [];
    }

    async initialize() {
        try {
            this.products = await Database.getProducts();
            this.suppliers = await Database.getSuppliers();
            this.customers = await Database.getCustomers();
            this.availableStock = await Database.getAvailableStock();
        } catch (error) {
            console.error('Error initializing calculator:', error);
        }
    }

    showCalculator() {
        const modalHtml = `
            <div class="modal">
                <div class="modal-content modal-xl">
                    <div class="modal-header">
                        <h3><i class="fas fa-calculator"></i> Installment Calculator</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="calculator-container">
                            <div class="calculator-form">
                                <form id="installment-calc-form" class="form-grid">
                                    <!-- Customer Selection -->
                                    <div class="form-section">
                                        <h4><i class="fas fa-user"></i> Customer Information</h4>
                                        <div class="form-group">
                                            <label class="form-label required">Select Customer</label>
                                            <select name="customer_id" class="form-input" required>
                                                <option value="">Choose Customer</option>
                                                ${this.customers.map(c => `<option value=\"${c.id}\">${c.account_no} - ${c.customer_name || ''}</option>`).join('')}
                                            </select>
                                            <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="app.customers.showAddModal()">
                                                <i class="fas fa-plus"></i> Add New Customer
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Product & Stock Selection -->
                                    <div class="form-section">
                                        <h4><i class="fas fa-motorcycle"></i> Product Information</h4>
                                        <div class="form-group">
                                            <label class="form-label required">Select Stock Item</label>
                                            <select name="stock_id" class="form-input" required onchange="calculator.updateProductInfo(this.value)">
                                                <option value="">Choose Stock Item</option>
                                                 ${this.availableStock.map(s => {
                                                     const ident = Utils.stockIdentifier(s);
                                                     return `<option value="${s.id}" data-product-id="${s.product_id}" data-supplier-id="${s.supplier_id}">${s.item_name} - ${ident.label}: ${ident.value}</option>`;
                                                 }).join('')}
                                            </select>
                                        </div>
                                        <div id="product-info" class="product-info-display" style="display: none;">
                                            <div class="info-grid">
                                                <div class="info-item">
                                                    <label id="selected-ident-label">Identifier:</label>
                                                    <span id="selected-ident-value">-</span>
                                                </div>
                                                <div class="info-item">
                                                    <label>Purchase Price:</label>
                                                    <span id="selected-purchase-price">Rs. 0</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Pricing -->
                                    <div class="form-section">
                                        <h4><i class="fas fa-dollar-sign"></i> Pricing Details</h4>
                                        <div class="form-row">
                                            <div class="form-group">
                                                <label class="form-label required">Sale Price</label>
                                                <div class="input-group">
                                                    <span class="input-prefix">Rs.</span>
                                                    <input type="number" name="sale_price" class="form-input" required min="0" step="0.01" oninput="calculator.updateCalculations()">
                                                </div>
                                            </div>
                                            <div class="form-group">
                                                <label class="form-label required">Advance Payment</label>
                                                <div class="input-group">
                                                    <span class="input-prefix">Rs.</span>
                                                    <input type="number" name="advance_payment" class="form-input" required min="0" step="0.01" value="0" oninput="calculator.updateCalculations()">
                                                </div>
                                            </div>
                                        </div>
                                        <div class="form-row">
                                            <div class="form-group">
                                                <label class="form-label">Custom Profit (%)</label>
                                                <div class="input-group">
                                                    <input type="number" name="profit_percentage" class="form-input" min="0" step="0.01" placeholder="e.g., 10" oninput="calculator.updateCalculations()">
                                                    <span class="input-suffix">%</span>
                                                </div>
                                            </div>
                                            <div class="form-group">
                                                <label class="form-label">Custom Profit (Amount)</label>
                                                <div class="input-group">
                                                    <span class="input-prefix">Rs.</span>
                                                    <input type="number" name="profit_amount" class="form-input" min="0" step="0.01" placeholder="e.g., 15000" oninput="calculator.updateCalculations()">
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Installment Terms -->
                                    <div class="form-section">
                                        <h4><i class="fas fa-calendar-alt"></i> Installment Terms</h4>
                                        <div class="form-row">
                                            <div class="form-group">
                                                <label class="form-label required">Number of Months</label>
                                                <select name="installment_months" class="form-input" required onchange="calculator.updateCalculations()">
                                                    <option value="">Select Period</option>
                                                    ${Array.from({length: 50}, (_, i) => i + 1).map(i => `<option value="${i}">${i} Month${i !== 1 ? 's' : ''}</option>`).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label class="form-label">Custom Installment Amount</label>
                                                <div class="input-group">
                                                    <span class="input-prefix">Rs.</span>
                                                    <input type="number" name="custom_installment" class="form-input" min="1" step="1" placeholder="Optional" oninput="calculator.updateCalculations()">
                                                </div>
                                            </div>
                                            <div class="form-group">
                                                <label class="form-label required">Start Date</label>
                                                <input type="date" name="start_date" class="form-input" required value="${Utils.getCurrentDate('YYYY-MM-DD')}" onchange="calculator.updateCalculations()">
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <!-- Calculation Results -->
                            <div class="calculator-results">
                                <div class="results-panel">
                                    <h4><i class="fas fa-chart-pie"></i> Calculation Summary</h4>
                                    <div id="calc-summary" class="calculation-summary">
                                        <p class="text-muted">Fill in the form to see calculations</p>
                                    </div>
                                </div>

                                <!-- Installment Schedule -->
                                <div class="schedule-panel">
                                    <h4><i class="fas fa-list"></i> Payment Schedule</h4>
                                    <div id="payment-schedule" class="payment-schedule">
                                        <p class="text-muted">Calculation results will appear here</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-info" onclick="calculator.printSchedule()" id="print-schedule-btn" disabled>
                            <i class="fas fa-print"></i> Print Schedule
                        </button>
                        <button class="btn btn-success" onclick="calculator.createInstallmentPlan()" id="create-plan-btn" disabled>
                            <i class="fas fa-check"></i> Create Installment Plan
                        </button>
                    </div>
                </div>
            </div>
        `;

        app.showModal(modalHtml);
    }

    updateProductInfo(stockId) {
        const stockItem = this.availableStock.find(s => String(s.id) === String(stockId));
        if (!stockItem) {
            document.getElementById('product-info').style.display = 'none';
            return;
        }

        const product = this.products.find(p => p.id === stockItem.product_id);
        if (!product) return;

        // Update product information display
        const ident = Utils.stockIdentifier(stockItem);
        document.getElementById('selected-ident-label').textContent = ident.label + ':';
        document.getElementById('selected-ident-value').textContent = ident.value;
        document.getElementById('selected-purchase-price').textContent = Utils.formatCurrency(product.purchase_price);
        document.getElementById('product-info').style.display = 'block';

        // Pre-fill sale price with current price
        document.querySelector('[name="sale_price"]').value = product.current_price;

        this.updateCalculations();
    }

    updateCalculations() {
        const form = document.getElementById('installment-calc-form');
        const formData = new FormData(form);

        const stockId = formData.get('stock_id');
        let salePrice = parseFloat(formData.get('sale_price')) || 0;
        const advancePayment = parseFloat(formData.get('advance_payment')) || 0;
        const months = parseInt(formData.get('installment_months')) || 0;
        const startDate = formData.get('start_date');
        let profitPct = parseFloat(formData.get('profit_percentage'));
        let profitAmt = parseFloat(formData.get('profit_amount'));
        const customInstallment = parseFloat(formData.get('custom_installment'));
        const activeField = document.activeElement ? document.activeElement.getAttribute('name') : null;

        const stockItem = this.availableStock.find(s => String(s.id) === String(stockId));
        const product = this.products.find(p => p.id === stockItem?.product_id);

        // Validation of required fields
        if (!stockId || !product || !months || !startDate) {
            this.clearResults();
            return;
        }

        // Synchronize profit fields based on the active field, using net principal (sale - advance)
        const purchasePrice = parseFloat(product.purchase_price) || 0;
        const principalBase = Math.max(0, (salePrice || 0) - (advancePayment || 0));

        if (activeField === 'profit_percentage' && !isNaN(profitPct)) {
            profitAmt = Math.round((principalBase * profitPct) / 100);
            const amtEl = form.querySelector('[name="profit_amount"]');
            if (amtEl) amtEl.value = profitAmt;
        } else if (activeField === 'profit_amount' && !isNaN(profitAmt)) {
            profitPct = principalBase > 0 ? Utils.roundTo((profitAmt / principalBase) * 100, 2) : 0;
            const pctEl = form.querySelector('[name="profit_percentage"]');
            if (pctEl) pctEl.value = profitPct;
        } else {
            if (!salePrice) {
                this.clearResults();
                return;
            }
            if (!isNaN(profitAmt)) {
                profitPct = principalBase > 0 ? Utils.roundTo((profitAmt / principalBase) * 100, 2) : 0;
            } else if (!isNaN(profitPct)) {
                profitAmt = Math.round((principalBase * (profitPct || 0)) / 100);
            } else {
                profitAmt = Math.max(0, Math.round(salePrice - purchasePrice));
                profitPct = principalBase > 0 ? Utils.roundTo((profitAmt / principalBase) * 100, 2) : 0;
            }
            const pctEl = form.querySelector('[name="profit_percentage"]');
            const amtEl = form.querySelector('[name="profit_amount"]');
            if (pctEl && !isNaN(profitPct)) pctEl.value = profitPct;
            if (amtEl && !isNaN(profitAmt)) amtEl.value = profitAmt;
        }

        try {
            const calculation = Utils.calculateInstallmentSchedule({
                salePrice: salePrice,
                purchasePrice: purchasePrice,
                profitPercentage: isNaN(profitPct) ? undefined : profitPct,
                profitAmountOverride: isNaN(profitAmt) ? undefined : profitAmt,
                advancePayment: advancePayment,
                installmentMonths: months,
                startDate: startDate,
                customMonthlyAmount: isNaN(customInstallment) ? undefined : customInstallment
            });

            this.currentCalculation = {
                ...calculation,
                stockItem,
                product,
                customerId: parseInt(formData.get('customer_id'))
            };

            this.displayResults(calculation);
            this.enableActionButtons();
        } catch (error) {
            console.error('Calculation error:', error);
            this.clearResults();
        }
    }

    displayResults(calculation) {
        const { summary, schedule } = calculation;

        // Update summary
        const summaryHtml = `
            <div class="summary-grid">
                <div class="summary-item">
                    <label>Sale Price:</label>
                    <span class="value">${Utils.formatCurrency(summary.salePrice)}</span>
                </div>
                <div class="summary-item">
                    <label>Purchase Price:</label>
                    <span class="value">${Utils.formatCurrency(summary.purchasePrice)}</span>
                </div>
                <div class="summary-item">
                    <label>Profit Amount:</label>
                    <span class="value text-success">${Utils.formatCurrency(summary.profitAmount)}</span>
                </div>
                <div class="summary-item">
                    <label>Profit Percentage:</label>
                    <span class="value text-success">${summary.profitPercentage}%</span>
                </div>
                <div class="summary-item">
                    <label>Total Amount:</label>
                    <span class="value font-bold">${Utils.formatCurrency(summary.totalAmount)}</span>
                </div>
                <div class="summary-item">
                    <label>Advance Payment:</label>
                    <span class="value">${Utils.formatCurrency(summary.advancePayment)}</span>
                </div>
                <div class="summary-item">
                    <label>Remaining Amount:</label>
                    <span class="value">${Utils.formatCurrency(summary.remainingAmount)}</span>
                </div>
                <div class="summary-item">
                    <label>Monthly Installment:</label>
                    <span class="value font-bold text-primary">${Utils.formatCurrency(summary.monthlyInstallment)}</span>
                </div>
                <div class="summary-item">
                    <label>Total Months:</label>
                    <span class="value">${summary.installmentMonths}</span>
                </div>
            </div>
        `;

        document.getElementById('calc-summary').innerHTML = summaryHtml;

        // Update schedule
        const scheduleHtml = `
            <div class="table-container">
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Due Date</th>
                            <th>Amount</th>
                            <th>Remaining Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${schedule.map((installment, index) => `
                            <tr class="${index < 5 ? 'highlight-row' : ''}">
                                <td>${installment.installment_no}</td>
                                <td>${Utils.formatDate(installment.due_date, 'readable')}</td>
                                <td>${Utils.formatCurrency(installment.amount)}</td>
                                <td>${Utils.formatCurrency(installment.remaining_balance)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <p class="schedule-note">
                <i class="fas fa-info-circle"></i>
                First 5 installments are highlighted. Total installments: ${schedule.length}
            </p>
        `;

        document.getElementById('payment-schedule').innerHTML = scheduleHtml;
    }

    clearResults() {
        document.getElementById('calc-summary').innerHTML = '<p class="text-muted">Fill in the form to see calculations</p>';
        document.getElementById('payment-schedule').innerHTML = '<p class="text-muted">Calculation results will appear here</p>';
        this.disableActionButtons();
    }

    enableActionButtons() {
        document.getElementById('print-schedule-btn').disabled = false;
        document.getElementById('create-plan-btn').disabled = false;
    }

    disableActionButtons() {
        document.getElementById('print-schedule-btn').disabled = true;
        document.getElementById('create-plan-btn').disabled = true;
    }

    printSchedule() {
        if (!this.currentCalculation) return;

        const { summary, schedule, stockItem, product } = this.currentCalculation;
        const customer = this.customers.find(c => c.id === this.currentCalculation.customerId);
        
        if (!customer) {
            app.showNotification('Please select a customer first', 'error');
            return;
        }

        this.generateSchedulePDF(customer, product, stockItem, summary, schedule);
    }

    generateSchedulePDF(customer, product, stockItem, summary, schedule) {
        // Create a new window with printable content
        const printWindow = window.open('', '_blank');
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Installment Schedule - ${customer.account_no}</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 20px; 
                        font-size: 12px;
                        line-height: 1.4;
                    }
                    .header { 
                        text-align: center; 
                        margin-bottom: 30px; 
                        border-bottom: 2px solid #333;
                        padding-bottom: 15px;
                    }
                    .company-info {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .info-section {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                    }
                    .info-block {
                        width: 48%;
                    }
                    .info-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 10px;
                    }
                    .info-table td {
                        padding: 5px;
                        border: 1px solid #ddd;
                    }
                    .info-table td:first-child {
                        font-weight: bold;
                        background-color: #f5f5f5;
                        width: 40%;
                    }
                    .schedule-table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-top: 20px;
                    }
                    .schedule-table th, .schedule-table td { 
                        border: 1px solid #ddd; 
                        padding: 8px; 
                        text-align: left; 
                    }
                    .schedule-table th { 
                        background-color: #f2f2f2; 
                        font-weight: bold;
                    }
                    .schedule-table tbody tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .summary-section {
                        background-color: #e8f4fd;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 5px;
                    }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px;
                    }
                    .summary-item {
                        display: flex;
                        justify-content: space-between;
                        padding: 5px 0;
                    }
                    .summary-item label {
                        font-weight: bold;
                    }
                    .text-success { color: #28a745; }
                    .text-primary { color: #007bff; }
                    .font-bold { font-weight: bold; }
                    .footer {
                        margin-top: 30px;
                        text-align: center;
                        font-size: 10px;
                        color: #666;
                        border-top: 1px solid #ddd;
                        padding-top: 15px;
                    }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="company-info">
                    <h1>INSTALLMENT MANAGEMENT SYSTEM</h1>
                    <p>Installment Payment Schedule</p>
                </div>

                <div class="header">
                    <h2>Payment Schedule for ${Utils.capitalizeWords(product.item_name)}</h2>
                    <p>Generated on: ${Utils.formatDate(new Date(), 'readable')}</p>
                </div>

                <div class="info-section">
                    <div class="info-block">
                        <h3>Customer Information</h3>
                        <table class="info-table">
                            <tr><td>Account No</td><td>${customer.account_no}</td></tr>
                            <tr><td>CNIC</td><td>${customer.cnic_no}</td></tr>
                            <tr><td>Phone</td><td>${customer.phone}</td></tr>
                            <tr><td>Address</td><td>${customer.address}</td></tr>
                        </table>
                    </div>

                    <div class="info-block">
                        <h3>Product Information</h3>
                        <table class="info-table">
                            <tr><td>Product</td><td>${Utils.capitalizeWords(product.item_name)}</td></tr>
                            <tr><td>${Utils.stockIdentifier(stockItem).label}</td><td>${Utils.stockIdentifier(stockItem).value}</td></tr>
                            <tr><td>Stock No</td><td>${stockItem.stock_no}</td></tr>
                        </table>
                    </div>
                </div>

                <div class="summary-section">
                    <h3>Financial Summary</h3>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <label>Sale Price:</label>
                            <span>${Utils.formatCurrency(summary.salePrice)}</span>
                        </div>
                        <div class="summary-item">
                            <label>Purchase Price:</label>
                            <span>${Utils.formatCurrency(summary.purchasePrice)}</span>
                        </div>
                        <div class="summary-item">
                            <label>Profit Amount:</label>
                            <span class="text-success">${Utils.formatCurrency(summary.profitAmount)}</span>
                        </div>
                        <div class="summary-item">
                            <label>Profit Percentage:</label>
                            <span class="text-success">${summary.profitPercentage}%</span>
                        </div>
                        <div class="summary-item">
                            <label>Total Amount:</label>
                            <span class="font-bold">${Utils.formatCurrency(summary.totalAmount)}</span>
                        </div>
                        <div class="summary-item">
                            <label>Advance Payment:</label>
                            <span>${Utils.formatCurrency(summary.advancePayment)}</span>
                        </div>
                        <div class="summary-item">
                            <label>Remaining Amount:</label>
                            <span>${Utils.formatCurrency(summary.remainingAmount)}</span>
                        </div>
                        <div class="summary-item">
                            <label>Monthly Installment:</label>
                            <span class="font-bold text-primary">${Utils.formatCurrency(summary.monthlyInstallment)}</span>
                        </div>
                    </div>
                </div>

                <h3>Payment Schedule (${summary.installmentMonths} Months)</h3>
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th style="width: 10%;">Installment #</th>
                            <th style="width: 25%;">Due Date</th>
                            <th style="width: 25%;">Amount Due</th>
                            <th style="width: 25%;">Remaining Balance</th>
                            <th style="width: 15%;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${schedule.map(installment => `
                            <tr>
                                <td>${installment.installment_no}</td>
                                <td>${Utils.formatDate(installment.due_date, 'readable')}</td>
                                <td>${Utils.formatCurrency(installment.amount)}</td>
                                <td>${Utils.formatCurrency(installment.remaining_balance)}</td>
                                <td>Pending</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <p><strong>Terms & Conditions:</strong></p>
                    <p>1. All payments must be made on or before the due date.</p>
                    <p>2. Late payment charges may apply for overdue installments.</p>
                    <p>3. This schedule is subject to the terms agreed upon at the time of purchase.</p>
                    <p>4. Contact us immediately if you face any payment difficulties.</p>
                    <br>
                    <p>Generated by Installment Management System - ${new Date().toLocaleDateString()}</p>
                    ${Utils.developerCreditHtml()}
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
    }

    async createInstallmentPlan() {
        if (!this.currentCalculation) {
            app.showNotification('Please calculate the installment first', 'error');
            return;
        }

        const form = document.getElementById('installment-calc-form');
        const formData = new FormData(form);
        const customerId = parseInt(formData.get('customer_id'));
        const stockId = parseInt(formData.get('stock_id'));
        
        if (!customerId || !stockId) {
            app.showNotification('Please select customer and stock item', 'error');
            return;
        }

        try {
            app.showLoading();

            const { summary, schedule, stockItem, product } = this.currentCalculation;

            // Create purchase record
            const purchaseData = {
                customer_id: customerId,
                stock_id: stockId,
                supplier_id: stockItem.supplier_id,
                sale_price: summary.salePrice,
                purchase_price: summary.purchasePrice,
                profit_amount: summary.profitAmount,
                profit_percentage: summary.profitPercentage,
                advance_received: summary.advancePayment,
                total_amount: summary.totalAmount,
                installment_months: summary.installmentMonths,
                monthly_installment: summary.monthlyInstallment,
                start_date: formData.get('start_date')
            };

            const purchaseResult = await Database.createPurchase(purchaseData);
            const purchaseId = purchaseResult.id;

            // Create installment schedule
            await Database.createInstallments(purchaseId, schedule);

            app.showNotification('Installment plan created successfully!', 'success');
            app.closeModal();

            // Ask user if they want to print the schedule
            setTimeout(() => {
                const confirmPrint = confirm('Installment plan created successfully! Would you like to print the payment schedule?');
                if (confirmPrint) {
                    const customer = this.customers.find(c => c.id === customerId);
                    this.generateSchedulePDF(customer, product, stockItem, summary, schedule);
                }
            }, 1000);

            // Refresh dashboard if we're on it
            if (app.currentSection === 'dashboard') {
                app.dashboard.loadData();
            }

        } catch (error) {
            console.error('Error creating installment plan:', error);
            app.showNotification('Failed to create installment plan: ' + error.message, 'error');
        } finally {
            app.hideLoading();
        }
    }

    cleanup() {
        this.currentCalculation = null;
    }
}

// Create global calculator instance
window.calculator = new InstallmentCalculator();
window.InstallmentCalculator = InstallmentCalculator;