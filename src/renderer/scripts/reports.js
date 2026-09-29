// Enhanced Reports Management Module

class ReportsManager {
    constructor() {
        this.setupEventListeners();
    }
    
    // Safe fallback methods in case app object doesn't exist
    safeShowLoading() {
        if (typeof app !== 'undefined' && app.showLoading) {
            app.showLoading();
        } else {
            console.log('Loading...');
        }
    }
    
    safeHideLoading() {
        if (typeof app !== 'undefined' && app.hideLoading) {
            app.hideLoading();
        } else {
            console.log('Loading complete');
        }
    }
    
    safeShowNotification(message, type = 'info') {
        if (typeof app !== 'undefined' && app.showNotification) {
            app.showNotification(message, type);
        } else {
            if (type === 'error') {
                alert(`Error: ${message}`);
            } else {
                console.log(`${type.toUpperCase()}: ${message}`);
            }
        }
    }
    
    // Safe Utils fallbacks
    safeFormatCurrency(amount) {
        if (typeof Utils !== 'undefined' && Utils.formatCurrency) {
            return Utils.formatCurrency(amount);
        }
        return `$${(amount || 0).toFixed(2)}`;
    }
    
    safeFormatDate(date) {
        if (typeof Utils !== 'undefined' && Utils.formatDate) {
            return Utils.formatDate(date);
        }
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString();
    }

    setupEventListeners() {
        // Set up date range controls
        this.setupDateRangeControls();
        // Bind helpers for date range modal interactions
        window.reports = window.reports || this;
        window.reports.resolveDateRange = this.resolveDateRange.bind(this);
        window.reports.setQuickDateRange = this.setQuickDateRange.bind(this);
    }

    setupDateRangeControls() {
        // Set default dates
        const startDateInput = document.getElementById('reports-start-date');
        const endDateInput = document.getElementById('reports-end-date');
        const quickSelectInput = document.getElementById('reports-quick-select');
        const resetBtn = document.getElementById('reset-date-range-btn');

        if (startDateInput && endDateInput) {
            // Set default to current month
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            startDateInput.value = this.formatDateForInput(firstDayOfMonth);
            endDateInput.value = this.formatDateForInput(lastDayOfMonth);
        }

        // Quick select handler
        if (quickSelectInput) {
            quickSelectInput.addEventListener('change', (e) => {
                this.handleQuickDateSelect(e.target.value);
            });
        }

        // Reset button handler
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetDateRange();
            });
        }
    }

    formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }

    handleQuickDateSelect(range) {
        const startDateInput = document.getElementById('reports-start-date');
        const endDateInput = document.getElementById('reports-end-date');
        const now = new Date();
        let startDate, endDate;

        switch (range) {
            case 'today':
                startDate = endDate = new Date(now);
                break;
            case 'yesterday':
                startDate = endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                break;
            case 'this-week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
                endDate = new Date(now);
                break;
            case 'last-week':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 1);
                break;
            case 'this-month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'last-month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'this-year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now);
                break;
            case 'last-3-months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'last-6-months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            default:
                return;
        }

        if (startDateInput && endDateInput) {
            startDateInput.value = this.formatDateForInput(startDate);
            endDateInput.value = this.formatDateForInput(endDate);
        }
    }

    resetDateRange() {
        const startDateInput = document.getElementById('reports-start-date');
        const endDateInput = document.getElementById('reports-end-date');
        const quickSelectInput = document.getElementById('reports-quick-select');
        
        // Reset to current month
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        if (startDateInput && endDateInput) {
            startDateInput.value = this.formatDateForInput(firstDayOfMonth);
            endDateInput.value = this.formatDateForInput(lastDayOfMonth);
        }
        
        if (quickSelectInput) {
            quickSelectInput.value = '';
        }
    }

    getSelectedDateRange() {
        // Use temporary date range if available (from popup)
        if (this.tempDateRange) {
            return {
                startDate: new Date(this.tempDateRange.startDate),
                endDate: new Date(this.tempDateRange.endDate),
                startDateStr: this.tempDateRange.startDate,
                endDateStr: this.tempDateRange.endDate
            };
        }
        
        const startDateInput = document.getElementById('reports-start-date');
        const endDateInput = document.getElementById('reports-end-date');
        
        if (!startDateInput || !endDateInput) {
            // Return current month if inputs not available
            const now = new Date();
            return {
                startDate: new Date(now.getFullYear(), now.getMonth(), 1),
                endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
                startDateStr: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
                endDateStr: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
            };
        }
        
        const startDateStr = startDateInput.value;
        const endDateStr = endDateInput.value;
        
        if (!startDateStr || !endDateStr) {
            // Return current month if no dates selected
            const now = new Date();
            return {
                startDate: new Date(now.getFullYear(), now.getMonth(), 1),
                endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
                startDateStr: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
                endDateStr: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
            };
        }
        
        return {
            startDate: new Date(startDateStr),
            endDate: new Date(endDateStr),
            startDateStr,
            endDateStr
        };
    }

    async generateMonthlyReport() {
        try {
            console.log('Generating monthly report...');
            this.safeShowLoading();
            
            const monthlyData = await this.getMonthlyCollectionData();
            console.log('Monthly data loaded:', monthlyData);
            this.showMonthlyReport(monthlyData);
            
        } catch (error) {
            console.error('Error generating monthly report:', error);
            this.safeShowNotification(`Failed to generate monthly report: ${error.message}`, 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async generateOutstandingAmountsReport() {
        try {
            this.safeShowLoading();
            
            const outstandingData = await this.getOutstandingData();
            this.showOutstandingReport(outstandingData);
            
        } catch (error) {
            console.error('Error generating outstanding report:', error);
            this.safeShowNotification('Failed to generate outstanding report', 'error');
        } finally {
            this.safeHideLoading();
        }
    }

    async generateCashSalesReportData() {
        try {
            app.showLoading();
            
            const cashSalesData = await this.getCashSalesReportData();
            this.showCashSalesReport(cashSalesData);
            
        } catch (error) {
            console.error('Error generating cash sales report:', error);
            app.showNotification('Failed to generate cash sales report', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async generateSupplierPaymentsReportData() {
        try {
            app.showLoading();
            
            const supplierData = await this.getSupplierPaymentsReportData();
            this.showSupplierPaymentsReport(supplierData);
            
        } catch (error) {
            console.error('Error generating supplier payments report:', error);
            app.showNotification('Failed to generate supplier payments report', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async generateExpenseReportData() {
        try {
            app.showLoading();
            
            const expenseData = await this.getExpenseReportData();
            this.showExpenseReport(expenseData);
            
        } catch (error) {
            console.error('Error generating expense report:', error);
            app.showNotification('Failed to generate expense report', 'error');
        } finally {
            app.hideLoading();
        }
    }

    async generateStockReportData() {
        try {
            app.showLoading();
            
            const stockData = await this.getStockReportData();
            this.showStockReport(stockData);
            
        } catch (error) {
            console.error('Error generating stock report:', error);
            app.showNotification('Failed to generate stock report', 'error');
        } finally {
            app.hideLoading();
        }
    }

    // Data collection methods
    async getMonthlyCollectionData() {
        try {
            const dateRange = this.getSelectedDateRange();
            
            // Get installment collections with better error handling
            const installmentCollections = await this.safeQuery(`
                SELECT 
                    COALESCE(SUM(paid_amount), 0) as total_amount,
                    COUNT(CASE WHEN paid_amount > 0 THEN 1 END) as transaction_count
                FROM installments 
                WHERE DATE(COALESCE(paid_date, created_at)) BETWEEN DATE(?) AND DATE(?)
                  AND paid_amount > 0
                  AND (is_deleted = 0 OR is_deleted IS NULL)
            `, [dateRange.startDateStr, dateRange.endDateStr], [{ total_amount: 0, transaction_count: 0 }]);

            // Get cash sale collections with better error handling
            const cashSaleCollections = await this.safeQuery(`
                SELECT 
                    COALESCE(SUM(received_price), 0) as total_amount,
                    COUNT(*) as transaction_count
                FROM cash_sales 
                WHERE DATE(sale_date) BETWEEN DATE(?) AND DATE(?)
                  AND received_price > 0
            `, [dateRange.startDateStr, dateRange.endDateStr], [{ total_amount: 0, transaction_count: 0 }]);

            return {
                installments: installmentCollections[0] || { total_amount: 0, transaction_count: 0 },
                cashSales: cashSaleCollections[0] || { total_amount: 0, transaction_count: 0 },
                dateRange: `${dateRange.startDateStr} to ${dateRange.endDateStr}`
            };
        } catch (error) {
            console.error('Error in getMonthlyCollectionData:', error);
            const dateRange = this.getSelectedDateRange();
            return {
                installments: { total_amount: 0, transaction_count: 0 },
                cashSales: { total_amount: 0, transaction_count: 0 },
                dateRange: `${dateRange.startDateStr} to ${dateRange.endDateStr}`,
                error: error.message
            };
        }
    }

    // Add missing primary methods that aliases call
    async generateMonthlyCollectionReport() {
        try {
            console.log('Generating monthly collection report...');
            app.showLoading();
            
            const monthlyData = await this.getMonthlyCollectionData();
            console.log('Monthly data loaded:', monthlyData);
            this.showMonthlyReport(monthlyData);
            
        } catch (error) {
            console.error('Error generating monthly collection report:', error);
            app.showNotification(`Failed to generate monthly report: ${error.message}`, 'error');
        } finally {
            app.hideLoading();
        }
    }

    // Add alias methods for HTML onclick compatibility
    async generateMonthlyReport() {
        return await this.generateMonthlyCollectionReport();
    }

    async generateOutstandingReport() {
        return await this.generateOutstandingAmountsReport();
    }

    async generateCashSalesReport() {
        return await this.generateCashSalesReportData();
    }

    async generateSupplierPaymentsReport() {
        return await this.generateSupplierPaymentsReportData();
    }

    async generateExpenseReport() {
        return await this.generateExpenseReportData();
    }

    async generateStockReport() {
        return await this.generateStockReportData();
    }

    async getOutstandingData() {
        try {
            // Get installment dues with customer details and delivery date
            const installmentDues = await this.safeQuery(`
                SELECT 
                    COALESCE(c.customer_name, 'N/A') as customer_name,
                    COALESCE(c.account_no, 'N/A') as account_no,
                    COALESCE(c.phone, 'N/A') as phone,
                    cp.delivery_date,
                    SUM(
                        CASE WHEN COALESCE(i.original_amount, i.amount) > COALESCE(i.paid_amount, 0) 
                             THEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) 
                             ELSE 0 END
                    ) as total_short_amount,
                    COUNT(CASE WHEN i.status != 'paid' AND i.status != 'settled' THEN 1 END) as pending_installments,
                    COUNT(CASE WHEN i.due_date < date('now') AND i.status != 'paid' AND i.status != 'settled' THEN 1 END) as overdue_installments
                FROM installments i
                JOIN customer_purchases cp ON i.purchase_id = cp.id
                JOIN customers c ON cp.customer_id = c.id
                WHERE i.status != 'paid' AND i.status != 'settled'
                  AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                  AND cp.status != 'deleted'
                GROUP BY c.id, c.customer_name, c.account_no, c.phone, cp.delivery_date
                HAVING total_short_amount > 0
                ORDER BY total_short_amount DESC
            `, [], []);

            // Get cash sale dues with customer details
            const cashSaleDues = await this.safeQuery(`
                SELECT 
                    COALESCE(c.customer_name, 'Walk-in Customer') as customer_name,
                    COALESCE(c.account_no, 'N/A') as account_no,
                    COALESCE(c.phone, 'N/A') as phone,
                    cs.sale_date as delivery_date,
                    SUM(COALESCE(cs.due_amount, 0)) as total_short_amount,
                    COUNT(cs.id) as pending_sales
                FROM cash_sales cs
                LEFT JOIN customers c ON cs.customer_id = c.id
                WHERE cs.due_amount > 0
                GROUP BY cs.customer_id, c.customer_name, c.account_no, c.phone, cs.sale_date
                HAVING total_short_amount > 0
                ORDER BY total_short_amount DESC
            `, [], []);

            return {
                installmentDues: installmentDues || [],
                cashSaleDues: cashSaleDues || []
            };
        } catch (error) {
            console.error('Error in getOutstandingData:', error);
            return {
                installmentDues: [],
                cashSaleDues: [],
                error: error.message
            };
        }
    }

    async getCashSalesReportData() {
        try {
            const dateRange = this.getSelectedDateRange();
            
            const data = await this.safeQuery(`
                SELECT 
                    cs.sale_date,
                    COALESCE(c.customer_name, 'Walk-in Customer') as customer_name,
                    p.item_name,
                    s.engine_no,
                    cs.agreed_price,
                    cs.received_price,
                    cs.due_amount,
                    cs.payment_status,
                    cs.notes
                FROM cash_sales cs
                LEFT JOIN customers c ON cs.customer_id = c.id
                JOIN stock s ON cs.stock_id = s.id
                JOIN products p ON s.product_id = p.id
                WHERE DATE(cs.sale_date) BETWEEN DATE(?) AND DATE(?)
                ORDER BY cs.sale_date DESC
            `, [dateRange.startDateStr, dateRange.endDateStr], []);
            
            return data || [];
        } catch (error) {
            console.error('Error in getCashSalesReportData:', error);
            return [];
        }
    }

    async getSupplierPaymentsReportData() {
        try {
            const dateRange = this.getSelectedDateRange();
            
            const data = await this.safeQuery(`
                SELECT 
                    sp.payment_date,
                    s.supplier_name,
                    sp.amount,
                    sp.payment_method,
                    sp.reference_no,
                    sp.notes
                FROM supplier_payments sp
                JOIN suppliers s ON sp.supplier_id = s.id
                WHERE DATE(sp.payment_date) BETWEEN DATE(?) AND DATE(?)
                ORDER BY sp.payment_date DESC
            `, [dateRange.startDateStr, dateRange.endDateStr], []);
            
            return data || [];
        } catch (error) {
            console.error('Error in getSupplierPaymentsReportData:', error);
            return [];
        }
    }

    async getExpenseReportData() {
        try {
            const dateRange = this.getSelectedDateRange();
            
            const expenses = await this.safeQuery(`
                SELECT 
                    e.date,
                    et.name as expense_type,
                    e.amount,
                    e.notes
                FROM expenses e
                JOIN expense_types et ON e.expense_type_id = et.id
                WHERE DATE(e.date) BETWEEN DATE(?) AND DATE(?)
                ORDER BY e.date DESC
            `, [dateRange.startDateStr, dateRange.endDateStr], []);

            const expensesByType = await this.safeQuery(`
                SELECT 
                    et.name as expense_type,
                    SUM(e.amount) as total_amount,
                    COUNT(e.id) as transaction_count
                FROM expenses e
                JOIN expense_types et ON e.expense_type_id = et.id
                WHERE DATE(e.date) BETWEEN DATE(?) AND DATE(?)
                GROUP BY et.id, et.name
                ORDER BY total_amount DESC
            `, [dateRange.startDateStr, dateRange.endDateStr], []);

            return {
                expenses: expenses || [],
                expensesByType: expensesByType || []
            };
        } catch (error) {
            console.error('Error in getExpenseReportData:', error);
            return {
                expenses: [],
                expensesByType: []
            };
        }
    }

    async getStockReportData() {
        try {
            const stockSummary = await this.safeQuery(`
                SELECT 
                    p.item_name,
                    COUNT(s.id) as total_stock,
                    SUM(CASE WHEN s.is_sold = 1 THEN 1 ELSE 0 END) as sold_stock,
                    SUM(CASE WHEN s.is_sold = 0 THEN 1 ELSE 0 END) as available_stock,
                    AVG(p.current_price) as avg_price
                FROM stock s
                JOIN products p ON s.product_id = p.id
                GROUP BY p.id, p.item_name
                ORDER BY total_stock DESC
            `, [], []);

            const recentSales = await this.safeQuery(`
                SELECT 
                    'installment' as sale_type,
                    cp.start_date as sale_date,
                    c.customer_name,
                    p.item_name,
                    s.engine_no,
                    cp.sale_price
                FROM customer_purchases cp
                JOIN customers c ON cp.customer_id = c.id
                JOIN stock s ON cp.stock_id = s.id
                JOIN products p ON s.product_id = p.id
                WHERE cp.created_at >= date('now', '-30 days')
                  AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
                
                UNION ALL
                
                SELECT 
                    'cash_sale' as sale_type,
                    cs.sale_date,
                    COALESCE(c.customer_name, 'Walk-in Customer') as customer_name,
                    p.item_name,
                    s.engine_no,
                    cs.agreed_price as sale_price
                FROM cash_sales cs
                LEFT JOIN customers c ON cs.customer_id = c.id
                JOIN stock s ON cs.stock_id = s.id
                JOIN products p ON s.product_id = p.id
                WHERE cs.created_at >= date('now', '-30 days')
                
                ORDER BY sale_date DESC
                LIMIT 50
            `, [], []);

            return {
                stockSummary: stockSummary || [],
                recentSales: recentSales || []
            };
        } catch (error) {
            console.error('Error in getStockReportData:', error);
            return {
                stockSummary: [],
                recentSales: []
            };
        }
    }

    async loadData() {
        // Initialize date range controls when reports section is loaded
        setTimeout(() => {
            this.setupDateRangeControls();
        }, 100);
    }

    async generateReportWithDateRange(reportType) {
        try {
            // Show date range selection popup
            const reportNames = {
                'monthly': 'Monthly Collection Report',
                'outstanding': 'Customer Outstanding Report', 
                'cashsales': 'Cash Sales Report',
                'supplier': 'Supplier Payments Report',
                'expense': 'Expense Report',
                'stock': 'Stock Report'
            };
            
            const reportName = reportNames[reportType] || 'Report';
            const dateRange = await this.showDateRangeModal(
                reportName, 
                `Select date range for ${reportName.toLowerCase()}`
            );
            
            if (!dateRange) {
                return; // User cancelled
            }
            
            // Temporarily set the date range for the report generation
            this.tempDateRange = dateRange;
            
            // Generate the appropriate report
            switch (reportType) {
                case 'monthly':
                    await this.generateMonthlyReport();
                    break;
                case 'outstanding':
                    await this.generateOutstandingReport();
                    break;
                case 'cashsales':
                    await this.generateCashSalesReport();
                    break;
                case 'supplier':
                    await this.generateSupplierPaymentsReport();
                    break;
                case 'expense':
                    await this.generateExpenseReport();
                    break;
                case 'stock':
                    await this.generateStockReport();
                    break;
                default:
                    app.showNotification('Unknown report type', 'error');
            }
            
        } catch (error) {
            console.error('Error generating report with date range:', error);
            this.safeShowNotification(`Failed to generate report: ${error.message}`, 'error');
        } finally {
            // Clean up all temporary data
            this.cleanupTempData();
        }
    }

    // Modal helpers for date range popup (DEPRECATED - using resolveDateRange below at line 2066)
    // This method is kept for backward compatibility with older modal code
    // resolveDateRange(selection) {
    //     const modal = document.getElementById('reports-date-modal');
    //     if (!modal) {
    //         if (this.dateRangeResolver) this.dateRangeResolver(null);
    //         this.dateRangeResolver = null;
    //         return;
    //     }
    //     if (!selection) {
    //         modal.remove();
    //         if (this.dateRangeResolver) this.dateRangeResolver(null);
    //         this.dateRangeResolver = null;
    //         return;
    //     }
    //     const form = modal.querySelector('#date-range-form');
    //     if (!form) {
    //         modal.remove();
    //         if (this.dateRangeResolver) this.dateRangeResolver(null);
    //         this.dateRangeResolver = null;
    //         return;
    //     }
    //     const startEl = form.querySelector('input[name="start_date"]');
    //     const endEl = form.querySelector('input[name="end_date"]');
    //     if (!startEl || !endEl) {
    //         modal.remove();
    //         if (this.dateRangeResolver) this.dateRangeResolver(null);
    //         this.dateRangeResolver = null;
    //         return;
    //     }
    //     const startDate = startEl.value;
    //     const endDate = endEl.value;
    //     modal.remove();
    //     if (this.dateRangeResolver) this.dateRangeResolver({ startDate, endDate });
    //     this.dateRangeResolver = null;
    // }

    setQuickDateRange(preset) {
        const modal = document.getElementById('reports-date-modal');
        if (!modal) return;
        const startEl = modal.querySelector('input[name="start_date"]');
        const endEl = modal.querySelector('input[name="end_date"]');
        const now = new Date();
        let start, end;
        switch (preset) {
            case 'today':
                start = end = now; break;
            case 'thisWeek': {
                const day = now.getDay();
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
                end = now; break;
            }
            case 'thisMonth':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'lastMonth':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'last3Months':
                start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                end = now; break;
            default:
                return;
        }
        const fmt = (d) => d.toISOString().split('T')[0];
        startEl.value = fmt(start);
        endEl.value = fmt(end);
    }

    // Report display methods
    showMonthlyReport(data) {
        // Check for data collection errors
        const hasErrors = data.error;
        const errorMessage = hasErrors ? `<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-bottom: 20px;"><strong>Warning:</strong> Some data could not be loaded: ${data.error}</div>` : '';
        
        const totalCollections = (data.installments.total_amount || 0) + (data.cashSales.total_amount || 0);
        const totalTransactions = (data.installments.transaction_count || 0) + (data.cashSales.transaction_count || 0);

        const win = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Monthly Collection Report - ${data.month}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1, h2 { color: #333; }
                    .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
                    .summary-card { background: white; padding: 15px; border-radius: 6px; text-align: center; }
                    .amount { font-size: 24px; font-weight: bold; color: #28a745; }
                    .print-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
                    @media print { .print-btn { display: none; } }
                </style>
            </head>
            <body>
                <button class="print-btn" onclick="window.print()">Print Report</button>
                <h1>Monthly Collection Report</h1>
                <h2>Period: ${data.dateRange || 'Current Period'}</h2>
                
                ${errorMessage}
                
                <div class="summary">
                    <div class="summary-grid">
                        <div class="summary-card">
                            <h3>Total Collections</h3>
                            <div class="amount">${this.safeFormatCurrency(totalCollections)}</div>
                            <p>${totalTransactions} transactions</p>
                        </div>
                        <div class="summary-card">
                            <h3>Installment Collections</h3>
                            <div class="amount">${Utils.formatCurrency(data.installments.total_amount || 0)}</div>
                            <p>${data.installments.transaction_count || 0} payments</p>
                        </div>
                        <div class="summary-card">
                            <h3>Cash Sales</h3>
                            <div class="amount">${Utils.formatCurrency(data.cashSales.total_amount || 0)}</div>
                            <p>${data.cashSales.transaction_count || 0} sales</p>
                        </div>
                    </div>
                </div>
                
                ${totalCollections === 0 ? `<div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;"><h3 style="color: #6c757d;">No Data Found</h3><p style="color: #6c757d;">No collection data found for the selected period: ${data.dateRange || 'Current Period'}</p></div>` : ''}
                
                <p><strong>Generated on:</strong> ${new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', month: 'long', day: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                })}</p>
            </body>
            </html>
        `;
        
        win.document.write(html);
        win.document.close();
        win.focus();
    }

    showOutstandingReport(data) {
        const hasErrors = data.error;
        const errorMessage = hasErrors ? `<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-bottom: 20px;"><strong>Warning:</strong> ${data.error}</div>` : '';
        
        const win = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Outstanding Amounts Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1, h2 { color: #333; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background: #f8f9fa; font-weight: 600; }
                    .amount { font-weight: bold; color: #dc3545; }
                    .section { margin-bottom: 40px; }
                    .print-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
                    @media print { .print-btn { display: none; } }
                </style>
            </head>
            <body>
                <button class="print-btn" onclick="window.print()">Print Report</button>
                <h1>Outstanding Amounts Report</h1>
                <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
                
                ${errorMessage}
                
                <div class="section">
                    <h2>Installment Dues</h2>
                    ${data.installmentDues.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Customer Name</th>
                                    <th>Phone Number</th>
                                    <th>Delivery Date</th>
                                    <th>Total Short Amount</th>
                                    <th>Overdue Installments</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.installmentDues.map(due => `
                                    <tr>
                                        <td>${due.customer_name || 'N/A'}</td>
                                        <td>${due.phone}</td>
                                        <td>${this.safeFormatDate(due.delivery_date)}</td>
                                        <td class="amount">${this.safeFormatCurrency(due.total_short_amount)}</td>
                                        <td>${due.overdue_installments || 0}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>No outstanding installment dues</p>'}
                </div>
                
                <div class="section">
                    <h2>Cash Sale Dues & Overdue Payments</h2>
                    ${data.cashSaleDues.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Customer Name</th>
                                    <th>Phone Number</th>
                                    <th>Sale Date</th>
                                    <th>Total Due Amount</th>
                                    <th>Pending Sales</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.cashSaleDues.map(due => `
                                    <tr>
                                        <td>${due.customer_name}</td>
                                        <td>${due.phone}</td>
                                        <td>${this.safeFormatDate(due.delivery_date)}</td>
                                        <td class="amount">${this.safeFormatCurrency(due.total_short_amount)}</td>
                                        <td>${due.pending_sales}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>No outstanding cash sale dues</p>'}
                </div>
            </body>
            </html>
        `;
        
        win.document.write(html);
        win.document.close();
        win.focus();
    }

    showCashSalesReport(data) {
        const totalSales = data.reduce((sum, sale) => sum + (sale.agreed_price || 0), 0);
        const totalReceived = data.reduce((sum, sale) => sum + (sale.received_price || 0), 0);
        const totalDues = data.reduce((sum, sale) => sum + (sale.due_amount || 0), 0);

        const win = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cash Sales Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1, h2 { color: #333; }
                    .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
                    .summary-item { text-align: center; }
                    .amount { font-size: 20px; font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background: #f8f9fa; font-weight: 600; }
                    .print-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
                    @media print { .print-btn { display: none; } }
                </style>
            </head>
            <body>
                <button class="print-btn" onclick="window.print()">Print Report</button>
                <h1>Cash Sales Report</h1>
                <p><strong>Period:</strong> Current Month | <strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
                
                <div class="summary">
                    <div class="summary-item">
                        <h3>Total Sales Value</h3>
                        <div class="amount" style="color: #007bff;">${Utils.formatCurrency(totalSales)}</div>
                    </div>
                    <div class="summary-item">
                        <h3>Amount Received</h3>
                        <div class="amount" style="color: #28a745;">${Utils.formatCurrency(totalReceived)}</div>
                    </div>
                    <div class="summary-item">
                        <h3>Outstanding Dues</h3>
                        <div class="amount" style="color: #dc3545;">${Utils.formatCurrency(totalDues)}</div>
                    </div>
                </div>
                
                ${data.length > 0 ? `
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Customer</th>
                                <th>Item</th>
                                <th>Engine No</th>
                                <th>Agreed Price</th>
                                <th>Received</th>
                                <th>Due Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(sale => `
                                <tr>
                                    <td>${Utils.formatDate(sale.sale_date)}</td>
                                    <td>${sale.customer_name}</td>
                                    <td>${sale.item_name}</td>
                                    <td>${sale.engine_no}</td>
                                    <td>${Utils.formatCurrency(sale.agreed_price)}</td>
                                    <td>${Utils.formatCurrency(sale.received_price)}</td>
                                    <td>${Utils.formatCurrency(sale.due_amount)}</td>
                                    <td>${Utils.capitalizeWords(sale.payment_status)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px;"><h3 style="color: #6c757d;">No Data Found</h3><p style="color: #6c757d;">No cash sales found for the selected period.</p></div>'}
            </body>
            </html>
        `;
        
        win.document.write(html);
        win.document.close();
        win.focus();
    }

    showSupplierPaymentsReport(data) {
        const totalPayments = data.reduce((sum, payment) => sum + (payment.amount || 0), 0);

        const win = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Supplier Payments Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; }
                    .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
                    .total-amount { font-size: 24px; font-weight: bold; color: #dc3545; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background: #f8f9fa; font-weight: 600; }
                    .print-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
                    @media print { .print-btn { display: none; } }
                </style>
            </head>
            <body>
                <button class="print-btn" onclick="window.print()">Print Report</button>
                <h1>Supplier Payments Report</h1>
                <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
                
                <div class="summary">
                    <h3>Total Payments Made</h3>
                    <div class="total-amount">${Utils.formatCurrency(totalPayments)}</div>
                    <p>${data.length} transactions</p>
                </div>
                
                ${data.length > 0 ? `
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Supplier</th>
                                <th>Amount</th>
                                <th>Payment Method</th>
                                <th>Reference No</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(payment => `
                                <tr>
                                    <td>${Utils.formatDate(payment.payment_date)}</td>
                                    <td>${payment.supplier_name}</td>
                                    <td>${Utils.formatCurrency(payment.amount)}</td>
                                    <td>${Utils.capitalizeWords(payment.payment_method)}</td>
                                    <td>${payment.reference_no || 'N/A'}</td>
                                    <td>${payment.notes || 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p>No supplier payments found for the current month.</p>'}
            </body>
            </html>
        `;
        
        win.document.write(html);
        win.document.close();
        win.focus();
    }

    showExpenseReport(data) {
        const totalExpenses = data.expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

        const win = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Expense Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1, h2 { color: #333; }
                    .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
                    .total-amount { font-size: 24px; font-weight: bold; color: #dc3545; }
                    .section { margin-bottom: 40px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background: #f8f9fa; font-weight: 600; }
                    .print-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
                    @media print { .print-btn { display: none; } }
                </style>
            </head>
            <body>
                <button class="print-btn" onclick="window.print()">Print Report</button>
                <h1>Expense Report</h1>
                <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
                
                <div class="summary">
                    <h3>Total Expenses</h3>
                    <div class="total-amount">${Utils.formatCurrency(totalExpenses)}</div>
                    <p>${data.expenses.length} transactions</p>
                </div>
                
                <div class="section">
                    <h2>Expenses by Type</h2>
                    ${data.expensesByType.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Expense Type</th>
                                    <th>Total Amount</th>
                                    <th>Transaction Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.expensesByType.map(type => `
                                    <tr>
                                        <td>${type.expense_type}</td>
                                        <td>${Utils.formatCurrency(type.total_amount)}</td>
                                        <td>${type.transaction_count}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>No expenses found.</p>'}
                </div>
                
                <div class="section">
                    <h2>Detailed Expenses</h2>
                    ${data.expenses.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.expenses.map(expense => `
                                    <tr>
                                        <td>${Utils.formatDate(expense.date)}</td>
                                        <td>${expense.expense_type}</td>
                                        <td>${Utils.formatCurrency(expense.amount)}</td>
                                        <td>${expense.notes || 'N/A'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>No expenses found for the current month.</p>'}
                </div>
            </body>
            </html>
        `;
        
        win.document.write(html);
        win.document.close();
        win.focus();
    }

    showStockReport(data) {
        const win = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Stock Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1, h2 { color: #333; }
                    .section { margin-bottom: 40px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background: #f8f9fa; font-weight: 600; }
                    .print-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
                    @media print { .print-btn { display: none; } }
                </style>
            </head>
            <body>
                <button class="print-btn" onclick="window.print()">Print Report</button>
                <h1>Stock Report</h1>
                <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
                
                <div class="section">
                    <h2>Stock Summary</h2>
                    ${data.stockSummary.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Item Name</th>
                                    <th>Total Stock</th>
                                    <th>Sold</th>
                                    <th>Available</th>
                                    <th>Average Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.stockSummary.map(item => `
                                    <tr>
                                        <td>${item.item_name}</td>
                                        <td>${item.total_stock}</td>
                                        <td>${item.sold_stock}</td>
                                        <td>${item.available_stock}</td>
                                        <td>${Utils.formatCurrency(item.avg_price)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>No stock data available.</p>'}
                </div>
                
                <div class="section">
                    <h2>Recent Sales (Last 30 Days)</h2>
                    ${data.recentSales.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Sale Type</th>
                                    <th>Date</th>
                                    <th>Customer</th>
                                    <th>Item</th>
                                    <th>Engine No</th>
                                    <th>Sale Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.recentSales.map(sale => `
                                    <tr>
                                        <td>${Utils.capitalizeWords(sale.sale_type.replace('_', ' '))}</td>
                                        <td>${Utils.formatDate(sale.sale_date)}</td>
                                        <td>${sale.customer_name}</td>
                                        <td>${sale.item_name}</td>
                                        <td>${sale.engine_no}</td>
                                        <td>${Utils.formatCurrency(sale.sale_price)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>No recent sales found.</p>'}
                </div>
            </body>
            </html>
        `;
        
        win.document.write(html);
        win.document.close();
        win.focus();
    }
    
    async showDateRangeModal(title, description) {
        return new Promise((resolve) => {
            this.cleanupDateRangeModal();
            this.dateRangeResolver = resolve;
            
            const now = new Date();
            const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const defaultEnd = now.toISOString().split('T')[0];
            
            const modalHtml = `
                <div id="reports-date-modal" class="modal" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);z-index:10000;">
                    <div class="modal-content" style="background:#fff;border-radius:8px;padding:20px;width:90%;max-width:520px;max-height:85vh;overflow-y:auto;">
                        <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                            <h3 style="margin:0;"><i class="fas fa-calendar-alt"></i> ${title}</h3>
                            <button class="modal-close" style="background:none;border:none;font-size:24px;cursor:pointer;" onclick="window.reports.resolveDateRange('cancel')">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-bottom:16px;">${description}</p>
                            <form id="date-range-form">
                                <div class="form-group" style="margin-bottom:12px;">
                                    <label class="form-label" style="display:block;margin-bottom:4px;font-weight:500;">Start Date</label>
                                    <input type="date" name="start_date" class="form-input" value="${defaultStart}" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                                </div>
                                <div class="form-group" style="margin-bottom:12px;">
                                    <label class="form-label" style="display:block;margin-bottom:4px;font-weight:500;">End Date</label>
                                    <input type="date" name="end_date" class="form-input" value="${defaultEnd}" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">
                                </div>
                                <div class="form-group" style="margin-bottom:12px;">
                                    <label class="form-label" style="display:block;margin-bottom:6px;font-weight:500;">Quick Select</label>
                                    <div style="display:flex;flex-wrap:wrap;gap:8px;">
                                        <button type="button" class="btn btn-sm" style="padding:4px 10px;border:none;border-radius:4px;background:#6c757d;color:#fff;cursor:pointer;" onclick="window.reports.setQuickDateRange('today')">Today</button>
                                        <button type="button" class="btn btn-sm" style="padding:4px 10px;border:none;border-radius:4px;background:#6c757d;color:#fff;cursor:pointer;" onclick="window.reports.setQuickDateRange('thisWeek')">This Week</button>
                                        <button type="button" class="btn btn-sm" style="padding:4px 10px;border:none;border-radius:4px;background:#6c757d;color:#fff;cursor:pointer;" onclick="window.reports.setQuickDateRange('thisMonth')">This Month</button>
                                        <button type="button" class="btn btn-sm" style="padding:4px 10px;border:none;border-radius:4px;background:#6c757d;color:#fff;cursor:pointer;" onclick="window.reports.setQuickDateRange('lastMonth')">Last Month</button>
                                        <button type="button" class="btn btn-sm" style="padding:4px 10px;border:none;border-radius:4px;background:#6c757d;color:#fff;cursor:pointer;" onclick="window.reports.setQuickDateRange('last3Months')">Last 3 Months</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
                            <button class="btn btn-secondary" style="padding:8px 16px;border:none;border-radius:4px;background:#6c757d;color:#fff;cursor:pointer;" onclick="window.reports.resolveDateRange('cancel')">Cancel</button>
                            <button class="btn btn-primary" style="padding:8px 16px;border:none;border-radius:4px;background:#007bff;color:#fff;cursor:pointer;" onclick="window.reports.resolveDateRange('submit')">Generate</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        });
    }
    
    resolveDateRange(action) {
        if (action !== 'submit') {
            if (this.dateRangeResolver) {
                this.dateRangeResolver(null);
            }
            this.dateRangeResolver = null;
            this.cleanupDateRangeModal();
            return;
        }
        
        const form = document.getElementById('date-range-form');
        if (!form) {
            if (this.dateRangeResolver) this.dateRangeResolver(null);
            this.dateRangeResolver = null;
            this.cleanupDateRangeModal();
            return;
        }
        
        const formData = new FormData(form);
        const startDate = formData.get('start_date');
        const endDate = formData.get('end_date');
        
        if (!startDate || !endDate) {
            alert('Please select both start and end dates');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            alert('Start date must be before end date');
            return;
        }
        
        if (this.dateRangeResolver) {
            this.dateRangeResolver({ startDate, endDate });
        }
        this.dateRangeResolver = null;
        this.cleanupDateRangeModal();
    }
    
    cleanupDateRangeModal() {
        const modal = document.getElementById('reports-date-modal');
        if (modal) {
            modal.remove();
        }
    }
    
    // Enhanced error handling for database queries
    async safeQuery(sql, params = [], fallback = []) {
        try {
            if (typeof Database === 'undefined') {
                console.warn('Database module not available');
                return fallback;
            }
            const result = await Database.query(sql, params);
            return result || fallback;
        } catch (error) {
            console.error('Reports database error:', error);
            console.error('SQL:', sql);
            console.error('Params:', params);
            // Return fallback instead of throwing to prevent crashes
            this.safeShowNotification('Some report data could not be loaded', 'warning');
            return fallback;
        }
    }
    
    // Cleanup method to ensure no temporary data persists
    cleanupTempData() {
        this.tempDateRange = null;
        this.currentReportData = null;
        this.currentTemplateType = null;
        this.dateRangeResolver = null;
    }
}

window.ReportsManager = ReportsManager;

// Ensure a global reports instance exists even if App initialization hasn't assigned it yet
if (!window.reports) {
    try {
        window.reports = new ReportsManager();
        console.log('⚠️ ReportsManager initialized as standalone (fallback).');
    } catch (e) {
        console.error('Failed to initialize ReportsManager fallback:', e);
    }
}

// Safer global wrapper so HTML buttons don't break even if reports instance changes
window.generateReport = async function(type) {
    try {
        if (!window.reports) {
            window.reports = new ReportsManager();
        }
        await window.reports.generateReportWithDateRange(type);
    } catch (err) {
        console.error('Report generation error:', err);
        if (typeof app !== 'undefined' && app.showNotification) {
            app.showNotification(`Failed to generate report: ${err.message}`, 'error');
        } else {
            alert(`Failed to generate report: ${err.message}`);
        }
    }
};