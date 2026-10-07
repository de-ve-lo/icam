// Database Interface for Renderer Process
if (!window._ipcRenderer) {
    window._ipcRenderer = window.electronAPI;
}

class Database {
    static async query(sql, params = []) {
        try {
            return await window._ipcRenderer.invoke('db-query', sql, params);
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    static async get(sql, params = []) {
        try {
            return await window._ipcRenderer.invoke('db-get', sql, params);
        } catch (error) {
            console.error('Database get error:', error);
            throw error;
        }
    }

    static async run(sql, params = []) {
        try {
            return await window._ipcRenderer.invoke('db-run', sql, params);
        } catch (error) {
            console.error('Database run error:', error);
            throw error;
        }
    }

    static async backup(backupPath) {
        try {
            return await window._ipcRenderer.invoke('db-backup', backupPath);
        } catch (error) {
            console.error('Database backup error:', error);
            throw error;
        }
    }

    // Products
    static async getProducts() {
        return await this.query('SELECT * FROM products ORDER BY created_at DESC');
    }

    static async addProduct(product) {
        return await this.run(
            'INSERT INTO products (item_name, current_price, purchase_price, category, unit) VALUES (?, ?, ?, ?, ?)',
            [product.item_name, product.current_price, product.purchase_price, product.category || 'bike', product.unit || 'piece']
        );
    }

    static async updateProduct(id, product) {
        return await this.run(
            'UPDATE products SET item_name = ?, current_price = ?, purchase_price = ?, category = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [product.item_name, product.current_price, product.purchase_price, product.category || 'bike', product.unit || 'piece', id]
        );
    }

    static async deleteProduct(id) {
        return await this.run('DELETE FROM products WHERE id = ?', [id]);
    }

    // Suppliers
    static async getSuppliers() {
        return await this.query('SELECT * FROM suppliers ORDER BY created_at DESC');
    }

    static async addSupplier(supplier) {
        return await this.run(
            'INSERT INTO suppliers (supplier_name) VALUES (?)',
            [supplier.supplier_name]
        );
    }

    static async updateSupplier(id, supplier) {
        return await this.run(
            'UPDATE suppliers SET supplier_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [supplier.supplier_name, id]
        );
    }

    static async deleteSupplier(id) {
        return await this.run('DELETE FROM suppliers WHERE id = ?', [id]);
    }

    // Stock
    static async getStock() {
        return await this.query(`
            SELECT s.*, p.item_name, p.category, sup.supplier_name
            FROM stock s
            JOIN products p ON s.product_id = p.id
            JOIN suppliers sup ON s.supplier_id = sup.id
            ORDER BY s.created_at DESC
        `);
    }

    static async addStock(stock) {
        return await this.run(
            'INSERT INTO stock (product_id, supplier_id, engine_no, chassis_no, stock_date, stock_no, imei, reg_no, serial_no, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [stock.product_id, stock.supplier_id, stock.engine_no || null, stock.chassis_no || null, stock.stock_date, stock.stock_no, stock.imei || null, stock.reg_no || null, stock.serial_no || null, stock.quantity != null ? stock.quantity : 1]
        );
    }

    static currentUserId() {
        return (window.auth && window.auth.user && window.auth.user.id) || null;
    }

    static async logAudit({ userId = null, action, entityType = null, entityId = null, amount = null, detail = null } = {}) {
        const uid = userId != null ? userId : this.currentUserId();
        return await this.run(
            'INSERT INTO audit_log (user_id, action, entity_type, entity_id, amount, detail) VALUES (?, ?, ?, ?, ?, ?)',
            [uid, action, entityType, entityId, amount, detail]
        );
    }

    static async listUsers() {
        return await window._ipcRenderer.invoke('users-list');
    }

    static async createUser(user) {
        return await window._ipcRenderer.invoke('users-create', user);
    }

    static async setUserActive(userId, isActive) {
        return await window._ipcRenderer.invoke('users-set-active', { userId, isActive });
    }

    static async getShopSettings() {
        try {
            return await window._ipcRenderer.invoke('shop-settings-get');
        } catch (e) {
            return { shop_name: 'Installment Management', phone: '', address: '', logo_path: '', idle_minutes: 30 };
        }
    }

    // Customers
    static async getCustomers() {
        return await this.query('SELECT * FROM customers ORDER BY created_at DESC');
    }

    static async getCustomersWithoutActivePurchase() {
        return await this.query(`
            SELECT c.* FROM customers c
            LEFT JOIN customer_purchases cp ON cp.customer_id = c.id AND cp.status = 'active'
            WHERE cp.id IS NULL
            ORDER BY c.created_at DESC
        `);
    }

    static async addCustomer(customer) {
        return await this.run(
            'INSERT INTO customers (account_no, cnic_no, phone, address, registration_date, other_info, customer_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [customer.account_no, customer.cnic_no, customer.phone, customer.address, customer.registration_date, customer.other_info, customer.customer_name || '']
        );
    }

    static async searchCustomers(searchTerm) {
        return await this.query(
            'SELECT * FROM customers WHERE account_no LIKE ? OR cnic_no LIKE ? OR phone LIKE ?',
            [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
        );
    }

    static async globalSearch(searchTerm) {
        const like = `%${searchTerm}%`;
        const customers = await this.query(`
            SELECT DISTINCT c.id, c.customer_name, c.account_no, c.phone, c.cnic_no, 'customer' as result_type
            FROM customers c
            LEFT JOIN customer_purchases cp ON cp.customer_id = c.id AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
            LEFT JOIN stock s ON s.id = cp.stock_id
            WHERE c.customer_name LIKE ?
               OR c.account_no LIKE ?
               OR c.phone LIKE ?
               OR c.cnic_no LIKE ?
               OR s.engine_no LIKE ?
               OR s.chassis_no LIKE ?
               OR s.stock_no LIKE ?
               OR s.imei LIKE ?
               OR s.serial_no LIKE ?
               OR s.reg_no LIKE ?
            LIMIT 8
        `, [like, like, like, like, like, like, like, like, like, like]);
        const stock = await this.query(`
            SELECT s.id, p.item_name, s.engine_no, s.chassis_no, s.imei, s.serial_no, s.reg_no, s.stock_no, 'stock' as result_type
            FROM stock s
            JOIN products p ON p.id = s.product_id
            WHERE s.engine_no LIKE ? OR s.chassis_no LIKE ? OR s.imei LIKE ? OR s.serial_no LIKE ? OR s.reg_no LIKE ? OR s.stock_no LIKE ? OR p.item_name LIKE ?
            LIMIT 8
        `, [like, like, like, like, like, like, like]);
        return { customers: customers || [], stock: stock || [] };
    }

    static async searchCustomersExtended(searchTerm) {
        const like = `%${searchTerm}%`;
        return await this.query(`
            SELECT DISTINCT c.*
            FROM customers c
            LEFT JOIN customer_purchases cp ON cp.customer_id = c.id
            LEFT JOIN stock s ON s.id = cp.stock_id
            LEFT JOIN guarantors g ON g.customer_id = c.id
            WHERE c.account_no LIKE ?
               OR c.customer_name LIKE ?
               OR c.cnic_no LIKE ?
               OR c.phone LIKE ?
               OR s.engine_no LIKE ?
               OR s.chassis_no LIKE ?
               OR s.stock_no LIKE ?
               OR s.imei LIKE ?
               OR s.serial_no LIKE ?
               OR s.reg_no LIKE ?
               OR g.name LIKE ?
               OR g.phone LIKE ?
               OR g.cnic_no LIKE ?
        `, [like, like, like, like, like, like, like, like, like, like, like, like, like]);
    }

    // Guarantors
    static async addGuarantor(guarantor) {
        return await this.run(
            'INSERT INTO guarantors (customer_id, name, phone, cnic_no, address) VALUES (?, ?, ?, ?, ?)',
            [guarantor.customer_id, guarantor.name, guarantor.phone, guarantor.cnic_no, guarantor.address]
        );
    }

    static async getGuarantors(customerId) {
        return await this.query('SELECT * FROM guarantors WHERE customer_id = ?', [customerId]);
    }

    // Purchases and Installments
    static async createPurchase(purchase) {
        const result = await this.run(
            `INSERT INTO customer_purchases (customer_id, stock_id, supplier_id, sale_price, purchase_price, 
             profit_amount, profit_percentage, advance_received, total_amount, installment_months, 
             monthly_installment, start_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [purchase.customer_id, purchase.stock_id, purchase.supplier_id, purchase.sale_price,
            purchase.purchase_price, purchase.profit_amount, purchase.profit_percentage,
            purchase.advance_received, purchase.total_amount, purchase.installment_months,
            purchase.monthly_installment, purchase.start_date]
        );

        await this.markStockSold(purchase.stock_id, purchase.quantity || 1);

        return result;
    }

    static async markStockSold(stockId, qty = 1) {
        const row = await this.get(`
            SELECT s.*, p.category FROM stock s JOIN products p ON s.product_id = p.id WHERE s.id = ?
        `, [stockId]);
        if (!row) return;
        if (row.category === 'misc') {
            const nextQty = Math.max(0, (Number(row.quantity) || 1) - qty);
            await this.run(
                'UPDATE stock SET quantity = ?, is_sold = ? WHERE id = ?',
                [nextQty, nextQty <= 0 ? 1 : 0, stockId]
            );
        } else {
            await this.run('UPDATE stock SET is_sold = 1 WHERE id = ?', [stockId]);
        }
    }

    // CORRECTED Calculate installment amounts with proper rounding - REMAINDER TO LAST INSTALLMENT
    static calculateInstallmentAmounts(totalAmount, numberOfInstallments) {
        const baseAmount = Math.floor(totalAmount / numberOfInstallments);
        const remainder = totalAmount - (baseAmount * numberOfInstallments);

        const installmentAmounts = [];

        // Create all installments with base amount
        for (let i = 0; i < numberOfInstallments; i++) {
            installmentAmounts.push(baseAmount);
        }

        // Add remainder to the LAST installment (not first)
        if (remainder > 0) {
            installmentAmounts[numberOfInstallments - 1] += remainder;
        }

        console.log(`💡 Installment calculation: ${totalAmount} ÷ ${numberOfInstallments} = ${baseAmount} each, remainder ${remainder} added to last`);

        return installmentAmounts;
    }

    // Add schema update method for original_amount column
    static async ensureOriginalAmountColumn() {
        try {
            // Check if column exists first
            const tableInfo = await this.query("PRAGMA table_info(installments)");
            const hasOriginalAmount = tableInfo.some(col => col.name === 'original_amount');

            if (!hasOriginalAmount) {
                await this.run('ALTER TABLE installments ADD COLUMN original_amount INTEGER');
                console.log('✅ Added original_amount column to installments table');
            } else {
                console.log('✅ original_amount column already exists');
            }

            // Initialize original_amount for existing records that don't have it
            await this.run(`
                UPDATE installments 
                SET original_amount = amount 
                WHERE original_amount IS NULL OR original_amount = 0
            `);

            console.log('✅ Initialized original_amount for existing records');
        } catch (error) {
            console.error('❌ Error ensuring original_amount column:', error);
        }
    }

    static async createInstallments(purchaseId, installments) {
        // Ensure original_amount column exists
        await this.ensureOriginalAmountColumn();

        for (const installment of installments) {
            await this.run(
                `INSERT INTO installments (purchase_id, installment_no, due_date, amount, remaining_balance, original_amount) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [purchaseId, installment.installment_no, installment.due_date, installment.amount, installment.remaining_balance, installment.amount]
            );
        }

        console.log(`✅ Created ${installments.length} installments with original amounts set`);
    }

    static async getCustomerInstallments(customerId) {
        return await this.query(`
            SELECT 
                i.id AS installment_id,
                i.purchase_id,
                i.installment_no,
                i.due_date,
                i.amount,
                i.paid_amount,
                i.paid_date,
                i.status,
                i.remaining_balance,
                i.original_amount,
                (SELECT SUM(amount) FROM payments WHERE installment_id = i.id AND (notes LIKE '%discount%' OR notes LIKE '%Discount%')) as discount_amount,
                cp.id AS purchase_id,
                cp.customer_id,
                cp.sale_price,
                cp.purchase_price,
                cp.profit_amount,
                cp.profit_percentage,
                cp.advance_received,
                cp.total_amount,
                cp.installment_months,
                cp.monthly_installment,
                cp.status AS purchase_status,
                c.account_no,
                c.cnic_no,
                p.item_name,
                p.category,
                s.engine_no,
                s.chassis_no,
                s.imei,
                s.serial_no,
                s.stock_no,
                s.quantity
            FROM installments i
            JOIN customer_purchases cp ON i.purchase_id = cp.id
            JOIN customers c ON cp.customer_id = c.id
            JOIN stock s ON cp.stock_id = s.id
            JOIN products p ON s.product_id = p.id
            WHERE cp.customer_id = ? AND i.is_deleted = 0 AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL) AND cp.status != 'deleted'
            ORDER BY i.due_date ASC
        `, [customerId]);
    }

    static localToday() {
        if (typeof Utils !== 'undefined' && Utils.toLocalDateString) {
            return Utils.toLocalDateString(new Date());
        }
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    static async loadPurchaseInstallments(purchaseId) {
        return await this.query(`
            SELECT * FROM installments
            WHERE purchase_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
            ORDER BY installment_no ASC
        `, [purchaseId]);
    }

    static async persistEngineRows(rows, { updatePaid = true, paidDate = null } = {}) {
        const dateStr = paidDate || this.localToday();
        for (const row of rows) {
            if (updatePaid) {
                await this.run(
                    'UPDATE installments SET paid_amount = ?, amount = ?, remaining_balance = ?, status = ?, paid_date = CASE WHEN ? > 0 THEN COALESCE(paid_date, ?) ELSE paid_date END WHERE id = ?',
                    [row.paid_amount, row.amount, row.remaining_balance, row.status, row.paid_amount, dateStr, row.id]
                );
            } else {
                await this.run(
                    'UPDATE installments SET amount = ?, remaining_balance = ?, status = ? WHERE id = ?',
                    [row.amount, row.remaining_balance, row.status, row.id]
                );
            }
        }
    }

    static async insertLedgerEntries(ledger, receiptNo) {
        const usedReceipt = receiptNo || this.generateReceiptNo();
        for (const entry of ledger) {
            await this.run(
                'INSERT INTO payments (installment_id, customer_id, purchase_id, amount, payment_date, receipt_no, notes, type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    entry.installment_id,
                    entry.customer_id,
                    entry.purchase_id,
                    entry.amount,
                    entry.payment_date,
                    entry.receipt_no || usedReceipt,
                    entry.notes,
                    entry.type || 'payment',
                    this.currentUserId()
                ]
            );
        }
        return usedReceipt;
    }

    static async payInstallment(installmentId, amount, paymentDate) {
        const dateStr = paymentDate || this.localToday();
        const installment = await this.get(`
            SELECT i.*, cp.customer_id, cp.id as purchase_id
            FROM installments i
            JOIN customer_purchases cp ON cp.id = i.purchase_id
            WHERE i.id = ? AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
        `, [installmentId]);
        if (!installment) throw new Error('Installment not found');

        const rows = await this.loadPurchaseInstallments(installment.purchase_id);
        const receiptNo = this.generateReceiptNo();
        const result = InstallmentEngine.applyPayment(rows, {
            installmentId: installment.id,
            amount,
            paymentDate: dateStr,
            customerId: installment.customer_id,
            purchaseId: installment.purchase_id,
            receiptNo
        });

        await this.persistEngineRows(result.rows, { paidDate: dateStr });
        await this.insertLedgerEntries(result.ledger, receiptNo);
        await this.logAudit({
            action: 'pay',
            entityType: 'installment',
            entityId: installmentId,
            amount,
            detail: receiptNo
        });
        return { receiptNo, grandRemaining: result.grandRemaining, credit: result.credit };
    }

    // CORRECTED Overpayment distribution with proper value shifting
    static async distributeOverpaymentCorrected(purchaseId, currentInstallmentId, overpayment) {
        console.log(`🔄 Distributing overpayment: ${overpayment} from installment ${currentInstallmentId}`);

        // Get all subsequent installments that are not paid
        const subsequentInstallments = await this.query(`
            SELECT * FROM installments 
            WHERE purchase_id = ? AND installment_no > (
                SELECT installment_no FROM installments WHERE id = ?
            ) AND status NOT IN ('paid', 'settled') AND (is_deleted = 0 OR is_deleted IS NULL)
            ORDER BY installment_no ASC
        `, [purchaseId, currentInstallmentId]);

        let remainingOverpayment = overpayment;
        const paymentDetails = [];

        for (const installment of subsequentInstallments) {
            if (remainingOverpayment <= 0) break;

            const dueAmount = installment.amount || 0;
            const currentPaid = installment.paid_amount || 0;
            const remainingDue = Math.max(0, dueAmount - currentPaid);

            if (remainingDue > 0) {
                const paymentToApply = Math.min(remainingOverpayment, remainingDue);
                const newPaidAmount = currentPaid + paymentToApply;
                const newStatus = newPaidAmount >= dueAmount ? 'paid' : 'partial';
                const newRemaining = Math.max(0, dueAmount - newPaidAmount);

                console.log(`🔄 Applying ${paymentToApply} to installment ${installment.installment_no}`);

                await this.run(
                    'UPDATE installments SET paid_amount = ?, paid_date = CURRENT_DATE, status = ?, remaining_balance = ? WHERE id = ?',
                    [newPaidAmount, newStatus, newRemaining, installment.id]
                );

                // Record individual payment
                const receiptNo = this.generateReceiptNo();
                await this.run(
                    'INSERT INTO payments (installment_id, customer_id, amount, payment_date, receipt_no, notes) VALUES (?, ?, ?, CURRENT_DATE, ?, ?)',
                    [installment.id, installment.customer_id, paymentToApply, receiptNo, 'Overpayment distribution']
                );

                paymentDetails.push({
                    installmentId: installment.id,
                    installmentNo: installment.installment_no,
                    amount: paymentToApply,
                    receiptNo,
                    status: newStatus
                });

                remainingOverpayment -= paymentToApply;
            }
        }

        return {
            paymentDetails,
            excessAmount: remainingOverpayment
        };
    }

    // Helper method to settle an installment (used for discount functionality)
    static async settleInstallment(installmentId, settlementAmount, note = 'Settlement payment') {
        const installment = await this.get('SELECT * FROM installments WHERE id = ?', [installmentId]);
        if (!installment) {
            throw new Error('Installment not found for settlement');
        }

        const newPaidAmount = (installment.paid_amount || 0) + settlementAmount;

        await this.run(
            'UPDATE installments SET paid_amount = ?, status = ?, remaining_balance = 0, paid_date = CURRENT_DATE WHERE id = ?',
            [newPaidAmount, 'settled', installmentId]
        );

        // Record the settlement payment
        const receiptNo = this.generateReceiptNo();
        await this.run(
            'INSERT INTO payments (installment_id, customer_id, amount, payment_date, receipt_no, notes) VALUES (?, ?, ?, CURRENT_DATE, ?, ?)',
            [installmentId, installment.customer_id, settlementAmount, receiptNo, note]
        );

        return receiptNo;
    }

    static async reconcileShortagesForCustomer(customerId) {
        const purchases = await this.query(`
            SELECT DISTINCT cp.id as purchase_id
            FROM customer_purchases cp
            WHERE cp.customer_id = ? AND cp.status != 'deleted' AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
        `, [customerId]);

        for (const purchase of purchases) {
            await this.reconcileShortagesForPurchase(purchase.purchase_id);
        }
    }

    static async reconcileShortagesForPurchase(purchaseId) {
        const installments = await this.loadPurchaseInstallments(purchaseId);
        if (!installments || installments.length === 0) return;
        const rec = InstallmentEngine.reconcile(installments, this.localToday());
        await this.persistEngineRows(rec.rows, { updatePaid: false });
        return rec;
    }

    // Debug method to log installment states
    static async debugInstallmentStates(purchaseId) {
        try {
            const installments = await this.query(`
                SELECT installment_no, amount, original_amount, paid_amount, remaining_balance, status, due_date
                FROM installments 
                WHERE purchase_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
                ORDER BY installment_no ASC
            `, [purchaseId]);

            console.log(`🔍 INSTALLMENT DEBUG for purchase ${purchaseId}:`);
            installments.forEach(i => {
                console.log(`   #${i.installment_no}: Amount=${i.amount}, Original=${i.original_amount}, Paid=${i.paid_amount}, Status=${i.status}`);
            });
        } catch (error) {
            console.error('Error in debug installment states:', error);
        }
    }

    static async payRemainingAdvanced(installmentId, amount, markAsDiscount = false, paymentDate = null) {
        const dateStr = paymentDate || this.localToday();
        const installment = await this.get(`
            SELECT i.*, cp.customer_id, cp.id as purchase_id
            FROM installments i
            JOIN customer_purchases cp ON cp.id = i.purchase_id
            WHERE i.id = ?
        `, [installmentId]);
        if (!installment) throw new Error('Installment not found');

        if (!(amount > 0) && !markAsDiscount) {
            const current = await this.loadPurchaseInstallments(installment.purchase_id);
            const totals = InstallmentEngine.totals(current);
            return {
                totalRemaining: totals.grandRemaining,
                discountAmount: 0,
                totalCoverage: 0,
                fullySettled: false,
                receiptNo: null
            };
        }

        const rows = await this.loadPurchaseInstallments(installment.purchase_id);
        const receiptNo = this.generateReceiptNo();
        const result = InstallmentEngine.payRemaining(rows, {
            amount,
            markAsDiscount,
            paymentDate: dateStr,
            customerId: installment.customer_id,
            purchaseId: installment.purchase_id,
            receiptNo
        });

        await this.persistEngineRows(result.rows, { paidDate: dateStr });
        await this.insertLedgerEntries(result.ledger, receiptNo);

        if (result.discountAmount > 0) {
            await this.run(
                'INSERT INTO discounts (customer_id, purchase_id, amount, reason) VALUES (?, ?, ?, ?)',
                [installment.customer_id, installment.purchase_id, result.discountAmount, 'Account settlement discount']
            );
            await this.logAudit({
                action: 'discount',
                entityType: 'purchase',
                entityId: installment.purchase_id,
                amount: result.discountAmount,
                detail: receiptNo
            });
            let expenseType = await this.get('SELECT id FROM expense_types WHERE name = ?', ['Discount']);
            if (!expenseType) {
                const inserted = await this.run(
                    'INSERT INTO expense_types (name, description) VALUES (?, ?)',
                    ['Discount', 'Settlement discounts given to customers']
                );
                expenseType = { id: inserted.id };
            }
            await this.run(
                'INSERT INTO expenses (expense_type_id, amount, date, notes) VALUES (?, ?, ?, ?)',
                [expenseType.id, result.discountAmount, dateStr, `Settlement discount for Account #${installment.customer_id} - Receipt ${receiptNo}`]
            );
        }

        if (result.purchaseStatus === 'completed') {
            await this.run(
                'UPDATE customer_purchases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['completed', installment.purchase_id]
            );
        }

        return {
            totalRemaining: result.grandRemaining + (result.discountAmount || 0),
            discountAmount: result.discountAmount || 0,
            totalCoverage: amount + (result.discountAmount || 0),
            fullySettled: result.purchaseStatus === 'completed',
            receiptNo
        };
    }

    static generateReceiptNo() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        return `RCP-${timestamp.slice(-6)}${random.toUpperCase()}`;
    }

    static async payInstallmentWithDistribution(installmentId, amount, paymentDate = null) {
        return await this.payInstallment(installmentId, amount, paymentDate);
    }

    // Dashboard Statistics
    static async getDashboardStats() {
        const stats = {};

        try {
            // Total customers
            const customersResult = await this.get('SELECT COUNT(*) as count FROM customers');
            stats.totalCustomers = customersResult?.count || 0;

            // Total stock (available)
            const stockResult = await this.get('SELECT COUNT(*) as count FROM stock WHERE is_sold = 0');
            stats.totalStock = stockResult?.count || 0;

            // Total sold stock
            const soldStockResult = await this.get('SELECT COUNT(*) as count FROM stock WHERE is_sold = 1');
            stats.totalSoldStock = soldStockResult?.count || 0;

            const today = (typeof Utils !== 'undefined' && Utils.toLocalDateString)
                ? Utils.toLocalDateString(new Date())
                : null;

            const pendingInstallments = await this.get(`
                SELECT COALESCE(SUM(
                    CASE
                        WHEN COALESCE(original_amount, amount) - COALESCE(paid_amount, 0) > 0
                        THEN COALESCE(original_amount, amount) - COALESCE(paid_amount, 0)
                        ELSE 0
                    END
                ), 0) as pending
                FROM installments
                WHERE (is_deleted = 0 OR is_deleted IS NULL)
            `);
            const pendingCash = await this.get(`
                SELECT COALESCE(SUM(due_amount), 0) as pending
                FROM cash_sales
                WHERE due_amount > 0
            `);
            stats.pendingAmount = (pendingInstallments?.pending || 0) + (pendingCash?.pending || 0);

            const overdueSql = today
                ? `SELECT COUNT(*) as count
                   FROM installments
                   WHERE due_date < ?
                     AND COALESCE(original_amount, amount) - COALESCE(paid_amount, 0) > 0
                     AND (is_deleted = 0 OR is_deleted IS NULL)`
                : `SELECT COUNT(*) as count
                   FROM installments
                   WHERE due_date < date('now')
                     AND COALESCE(original_amount, amount) - COALESCE(paid_amount, 0) > 0
                     AND (is_deleted = 0 OR is_deleted IS NULL)`;
            const overdueResult = await this.get(overdueSql, today ? [today] : []);
            stats.overdueInstallments = overdueResult?.count || 0;

            const monthPrefix = today ? today.slice(0, 7) : null;
            const monthlyCollectionResult = await this.get(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM payments
                WHERE (type = 'payment' OR type IS NULL)
                  AND (is_deleted = 0 OR is_deleted IS NULL)
                  AND strftime('%Y-%m', payment_date) = ?
            `, [monthPrefix || '']);
            stats.monthlyCollection = monthlyCollectionResult?.total || 0;

            // Active installment customers
            const activeCustomersResult = await this.get(`
                SELECT COUNT(DISTINCT cp.customer_id) as count
                FROM customer_purchases cp
                JOIN installments i ON cp.id = i.purchase_id
                WHERE cp.status = 'active'
            `);
            stats.activeCustomers = activeCustomersResult?.count || 0;

            // Total profit earned
            const profitResult = await this.get(`
                SELECT SUM(profit_amount) as total
                FROM customer_purchases
            `);
            stats.totalProfit = profitResult?.total || 0;

            return stats;
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            return {
                totalCustomers: 0,
                totalStock: 0,
                totalSoldStock: 0,
                pendingAmount: 0,
                overdueInstallments: 0,
                monthlyCollection: 0,
                activeCustomers: 0,
                totalProfit: 0
            };
        }
    }

    // Monthly collection data for charts
    static async getMonthlyCollectionData(months = 6) {
        try {
            const data = await this.query(`
                SELECT
                    strftime('%Y-%m', payment_date) as month,
                    SUM(amount) as total
                FROM payments
                WHERE (type = 'payment' OR type IS NULL)
                AND (is_deleted = 0 OR is_deleted IS NULL)
                AND payment_date >= date('now', '-${Number(months) || 6} months')
                GROUP BY strftime('%Y-%m', payment_date)
                ORDER BY month ASC
            `);

            return data.map(row => {
                const [y, m] = String(row.month || '').split('-').map(Number);
                const local = (y && m) ? new Date(y, m - 1, 1) : new Date();
                return {
                    month: row.month,
                    total: row.total || 0,
                    label: local.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                };
            });
        } catch (error) {
            console.error('Error getting monthly collection data:', error);
            return [];
        }
    }

    // Get overdue installments details
    static async getOverdueInstallments() {
        const today = (typeof Utils !== 'undefined' && Utils.toLocalDateString)
            ? Utils.toLocalDateString(new Date())
            : new Date().toISOString().slice(0, 10);
        return await this.query(`
            SELECT 
                i.*,
                c.account_no,
                c.cnic_no,
                c.phone,
                p.item_name,
                s.engine_no,
                CASE
                    WHEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) > 0
                    THEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0)
                    ELSE 0
                END as remaining_amount,
                CAST(julianday(?) - julianday(i.due_date) as INTEGER) as days_overdue
            FROM installments i
            JOIN customer_purchases cp ON i.purchase_id = cp.id
            JOIN customers c ON cp.customer_id = c.id
            JOIN stock s ON cp.stock_id = s.id
            JOIN products p ON s.product_id = p.id
            WHERE i.due_date < ?
              AND COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) > 0
              AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
            ORDER BY i.due_date ASC
        `, [today, today]);
    }

    // Payment history for a date range
    static async getPaymentHistory(startDate, endDate) {
        return await this.query(`
            SELECT 
                p.*,
                c.account_no,
                c.cnic_no,
                pr.item_name,
                i.installment_no
            FROM payments p
            JOIN installments i ON p.installment_id = i.id
            JOIN customer_purchases cp ON i.purchase_id = cp.id
            JOIN customers c ON cp.customer_id = c.id
            JOIN stock s ON cp.stock_id = s.id
            JOIN products pr ON s.product_id = pr.id
            WHERE p.payment_date BETWEEN ? AND ?
              AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
            ORDER BY p.payment_date DESC
        `, [startDate, endDate]);
    }

    static async getLatestPaymentForInstallment(installmentId) {
        return await this.get(`
            SELECT p.*
            FROM payments p
            WHERE p.installment_id = ? AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
            ORDER BY p.payment_date DESC, p.id DESC
            LIMIT 1
        `, [installmentId]);
    }

    static async getInstallmentWithCustomer(installmentId) {
        return await this.get(`
            SELECT i.*, cp.customer_id, cp.id as purchase_id
            FROM installments i
            JOIN customer_purchases cp ON cp.id = i.purchase_id
            WHERE i.id = ? AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
        `, [installmentId]);
    }

    static async addDiscount({ customer_id, purchase_id, amount, reason }) {
        return await this.run(
            'INSERT INTO discounts (customer_id, purchase_id, amount, reason) VALUES (?, ?, ?, ?)',
            [customer_id, purchase_id, amount, reason || '']
        );
    }

    static async applyPenalty(purchaseId, totalAmount, mode = 'spread') {
        // mode: 'spread' across unpaid installments or 'balance' onto last unpaid
        const installments = await this.query(`
            SELECT * FROM installments WHERE purchase_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY installment_no ASC
        `, [purchaseId]);
        if (!installments || !installments.length) return;
        const unpaid = installments.filter(i => i.status !== 'paid');
        if (!unpaid.length) return;

        if (mode === 'spread') {
            const per = Math.round(totalAmount / unpaid.length);
            let remaining = Math.round(totalAmount);
            for (let idx = 0; idx < unpaid.length; idx++) {
                const i = unpaid[idx];
                const add = idx === unpaid.length - 1 ? remaining : per;
                remaining -= add;
                // Update due amount and remaining if not fully paid
                const newAmount = (i.amount || 0) + add;
                const newRemaining = Math.max(0, (i.remaining_balance || (i.amount || 0)) + add - (i.paid_amount || 0));
                await this.run('UPDATE installments SET amount = ?, remaining_balance = ? WHERE id = ?', [newAmount, newRemaining, i.id]);
            }
        } else {
            // Add to last unpaid installment
            const last = unpaid[unpaid.length - 1];
            const newAmount = (last.amount || 0) + totalAmount;
            const newRemaining = Math.max(0, (last.remaining_balance || (last.amount || 0)) + totalAmount - (last.paid_amount || 0));
            await this.run('UPDATE installments SET amount = ?, remaining_balance = ? WHERE id = ?', [newAmount, newRemaining, last.id]);
        }

        // Record penalty metadata
        const customerRow = await this.get('SELECT customer_id FROM customer_purchases WHERE id = ?', [purchaseId]);
        const customer_id = customerRow?.customer_id || null;
        const perInstallment = mode === 'spread' ? Math.round(totalAmount / unpaid.length) : totalAmount;
        await this.run(
            'INSERT INTO penalties (customer_id, purchase_id, amount, per_installment, installments_affected, reason) VALUES (?, ?, ?, ?, ?, ?)',
            [customer_id, purchaseId, totalAmount, perInstallment, unpaid.length, mode === 'spread' ? 'Penalty spread across remaining installments' : 'Penalty added to remaining balance']
        );
    }

    static async hasActivePurchase(customerId) {
        const row = await this.get('SELECT id FROM customer_purchases WHERE customer_id = ? AND status = "active" LIMIT 1', [customerId]);
        return !!row;
    }

    static async getPenalties(purchaseId) {
        return await this.query('SELECT * FROM penalties WHERE purchase_id = ? ORDER BY created_at DESC', [purchaseId]);
    }

    static async getDiscounts(purchaseId) {
        return await this.query('SELECT * FROM discounts WHERE purchase_id = ? ORDER BY created_at DESC', [purchaseId]);
    }

    static async getActivePurchasesForCustomer(customerId) {
        return await this.query('SELECT * FROM customer_purchases WHERE customer_id = ? AND status = "active"', [customerId]);
    }

    static async reconcileShortages(purchaseId) {
        return await this.reconcileShortagesForPurchase(purchaseId);
    }

    // Customer purchase summary
    static async getCustomerPurchaseSummary(customerId) {
        return await this.get(`
            SELECT 
                COUNT(*) as total_purchases,
                SUM(total_amount) as total_amount,
                SUM(advance_received) as total_advance,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_purchases,
                MIN(start_date) as first_purchase_date,
                MAX(start_date) as last_purchase_date
            FROM customer_purchases
            WHERE customer_id = ?
        `, [customerId]);
    }
    // Logical deletion methods
    static async voidPayment(installmentId, reason = '') {
        const installment = await this.get('SELECT * FROM installments WHERE id = ?', [installmentId]);
        if (!installment) throw new Error('Installment not found');

        const rows = await this.loadPurchaseInstallments(installment.purchase_id);
        const ledger = await this.query(`
            SELECT * FROM payments
            WHERE installment_id = ? AND (type IS NULL OR type = 'payment') AND (is_deleted = 0 OR is_deleted IS NULL)
            ORDER BY id ASC
        `, [installmentId]);

        const result = InstallmentEngine.voidLastPayment(rows, ledger, installmentId);
        await this.persistEngineRows(result.rows, { updatePaid: true });

        if (result.voidedLedgerId != null) {
            await this.run(
                "UPDATE payments SET type = 'void', notes = COALESCE(notes, '') || ?, is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, deleted_reason = ? WHERE id = ?",
                [' [voided]', reason || 'Voided', result.voidedLedgerId]
            );
        } else if (ledger.length > 0) {
            const last = ledger[ledger.length - 1];
            await this.run(
                "UPDATE payments SET type = 'void', notes = COALESCE(notes, '') || ?, is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, deleted_reason = ? WHERE id = ?",
                [' [voided]', reason || 'Voided', last.id]
            );
        }
        await this.logAudit({
            action: 'void',
            entityType: 'installment',
            entityId: installmentId,
            detail: reason || 'Voided'
        });
    }

    static async setInstallmentPaidAmount(installmentId, newPaid) {
        const installment = await this.get(`
            SELECT i.*, cp.customer_id, cp.id as purchase_id
            FROM installments i
            JOIN customer_purchases cp ON cp.id = i.purchase_id
            WHERE i.id = ?
        `, [installmentId]);
        if (!installment) throw new Error('Installment not found');

        const rows = await this.loadPurchaseInstallments(installment.purchase_id);
        const updated = InstallmentEngine.setPaidAmount(rows, installmentId, newPaid);
        const rec = InstallmentEngine.reconcile(updated, this.localToday());
        await this.persistEngineRows(rec.rows, { updatePaid: true });

        const currentPaid = Number(installment.paid_amount) || 0;
        const delta = newPaid - currentPaid;
        if (delta !== 0) {
            const receiptNo = this.generateReceiptNo();
            await this.run(
                'INSERT INTO payments (installment_id, customer_id, purchase_id, amount, payment_date, receipt_no, notes, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    installmentId,
                    installment.customer_id,
                    installment.purchase_id,
                    Math.abs(delta),
                    this.localToday(),
                    receiptNo,
                    delta < 0 ? 'Paid amount edit (decrease)' : 'Paid amount edit (increase)',
                    delta < 0 ? 'void' : 'payment'
                ]
            );
        }
        return rec;
    }

    static async logicalDeleteSchedule(purchaseId, reason = '') {
        const purchaseRow = await this.get('SELECT stock_id FROM customer_purchases WHERE id = ?', [purchaseId]);

        await this.run(
            'DELETE FROM payments WHERE installment_id IN (SELECT id FROM installments WHERE purchase_id = ?)',
            [purchaseId]
        );
        await this.run(
            'DELETE FROM installments WHERE purchase_id = ?',
            [purchaseId]
        );
        await this.run(
            'DELETE FROM penalties WHERE purchase_id = ?',
            [purchaseId]
        );
        await this.run(
            'DELETE FROM discounts WHERE purchase_id = ?',
            [purchaseId]
        );
        await this.run(
            'DELETE FROM customer_purchases WHERE id = ?',
            [purchaseId]
        );

        if (purchaseRow && purchaseRow.stock_id) {
            await this.run('UPDATE stock SET is_sold = 0 WHERE id = ?', [purchaseRow.stock_id]);
        }
        await this.logAudit({
            action: 'delete_schedule',
            entityType: 'purchase',
            entityId: purchaseId,
            detail: reason || ''
        });
    }

    // Safe query wrapper to prevent crashes
    static async safeQuery(sql, params = [], fallback = []) {
        try {
            const result = await this.query(sql, params);
            return result || fallback;
        } catch (error) {
            console.error('Database query error:', error);
            console.error('SQL:', sql);
            console.error('Params:', params);
            // Return fallback instead of crashing
            return fallback;
        }
    }

    static async safeGet(sql, params = [], fallback = null) {
        try {
            const result = await this.get(sql, params);
            return result || fallback;
        } catch (error) {
            console.error('Database get error:', error);
            console.error('SQL:', sql);
            console.error('Params:', params);
            return fallback;
        }
    }

    // Cash Sales Management
    static async getCashSales() {
        return await this.safeQuery(`
            SELECT 
                cs.*,
                c.customer_name,
                c.account_no,
                p.item_name,
                p.category,
                s.engine_no,
                s.chassis_no,
                s.imei,
                s.serial_no,
                s.quantity
            FROM cash_sales cs
            LEFT JOIN customers c ON cs.customer_id = c.id
            JOIN stock s ON cs.stock_id = s.id
            JOIN products p ON s.product_id = p.id
            ORDER BY cs.sale_date DESC, cs.created_at DESC
        `, [], []);
    }

    static async getAvailableStock() {
        return await this.safeQuery(`
            SELECT s.*, p.item_name, p.current_price, p.category
            FROM stock s
            JOIN products p ON s.product_id = p.id
            WHERE s.is_sold = 0 AND (p.category != 'misc' OR COALESCE(s.quantity, 1) > 0)
            ORDER BY s.created_at DESC
        `, [], []);
    }

    static async addCashSale(cashSale) {
        const result = await this.run(
            `INSERT INTO cash_sales (customer_id, stock_id, sale_date, agreed_price, received_price, 
             due_amount, payment_status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [cashSale.customer_id, cashSale.stock_id, cashSale.sale_date, cashSale.agreed_price,
            cashSale.received_price, cashSale.due_amount, cashSale.payment_status, cashSale.notes]
        );

        await this.markStockSold(cashSale.stock_id, cashSale.quantity || 1);

        return result;
    }

    static async collectCashSaleDues(cashSaleId, amount) {
        // Get current cash sale
        const cashSale = await this.get('SELECT * FROM cash_sales WHERE id = ?', [cashSaleId]);
        if (!cashSale) {
            throw new Error('Cash sale not found');
        }

        const newReceivedAmount = (cashSale.received_price || 0) + amount;
        const newDueAmount = Math.max(0, (cashSale.agreed_price || 0) - newReceivedAmount);
        const newStatus = newDueAmount > 0 ? 'partial' : 'completed';

        await this.run(
            'UPDATE cash_sales SET received_price = ?, due_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newReceivedAmount, newDueAmount, newStatus, cashSaleId]
        );

        return { newReceivedAmount, newDueAmount, newStatus };
    }

    // Supplier Payment Management
    static async getSuppliersWithBalance() {
        // Supplier balance should reflect cost as soon as stock is added, not when sold
        return await this.safeQuery(`
            SELECT 
                s.*,
                COALESCE(purchase_balance.balance, 0) - COALESCE(payments.total_paid, 0) AS balance
            FROM suppliers s
            LEFT JOIN (
                SELECT 
                    st.supplier_id,
                    SUM(p.purchase_price) AS balance
                FROM stock st
                JOIN products p ON st.product_id = p.id
                GROUP BY st.supplier_id
            ) purchase_balance ON s.id = purchase_balance.supplier_id
            LEFT JOIN (
                SELECT 
                    supplier_id,
                    SUM(amount) AS total_paid
                FROM supplier_payments
                GROUP BY supplier_id
            ) payments ON s.id = payments.supplier_id
            ORDER BY s.supplier_name ASC
        `, [], []);
    }

    static async getSupplierPayments() {
        return await this.safeQuery(`
            SELECT 
                sp.*,
                s.supplier_name
            FROM supplier_payments sp
            JOIN suppliers s ON sp.supplier_id = s.id
            ORDER BY sp.payment_date DESC, sp.created_at DESC
        `, [], []);
    }

    static async addSupplierPayment(payment) {
        const result = await this.run(
            `INSERT INTO supplier_payments (supplier_id, amount, payment_date, payment_method, 
             reference_no, notes) VALUES (?, ?, ?, ?, ?, ?)`,
            [payment.supplier_id, payment.amount, payment.payment_date, payment.payment_method,
            payment.reference_no, payment.notes]
        );

        return result;
    }

    // Expense Management
    static async getExpenseTypes() {
        return await this.safeQuery('SELECT * FROM expense_types ORDER BY name ASC', [], []);
    }

    static async getExpenses() {
        return await this.safeQuery(`
            SELECT 
                e.*,
                et.name as expense_type_name
            FROM expenses e
            JOIN expense_types et ON e.expense_type_id = et.id
            ORDER BY e.date DESC, e.created_at DESC
        `, [], []);
    }

    static async addExpenseType(expenseType) {
        return await this.run(
            'INSERT INTO expense_types (name, description) VALUES (?, ?)',
            [expenseType.name, expenseType.description]
        );
    }

    static async addExpense(expense) {
        return await this.run(
            'INSERT INTO expenses (expense_type_id, amount, date, notes) VALUES (?, ?, ?, ?)',
            [expense.expense_type_id, expense.amount, expense.date, expense.notes]
        );
    }

    static async deleteExpense(expenseId) {
        return await this.run('DELETE FROM expenses WHERE id = ?', [expenseId]);
    }

    static async deleteExpenseType(typeId) {
        return await this.run('DELETE FROM expense_types WHERE id = ?', [typeId]);
    }

    // Dues and Reminders Management
    static async getInstallmentDues() {
        const today = (typeof Utils !== 'undefined' && Utils.toLocalDateString)
            ? Utils.toLocalDateString(new Date())
            : new Date().toISOString().slice(0, 10);
        return await this.safeQuery(`
            SELECT 
                i.*,
                c.customer_name,
                c.account_no,
                c.phone,
                c.id as customer_id,
                p.item_name,
                CASE
                    WHEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) > 0
                    THEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0)
                    ELSE 0
                END as remaining_amount,
                CASE 
                    WHEN i.due_date < ?
                    THEN CAST(julianday(?) - julianday(i.due_date) as INTEGER)
                    ELSE 0
                END as days_overdue
            FROM installments i
            JOIN customer_purchases cp ON i.purchase_id = cp.id
            JOIN customers c ON cp.customer_id = c.id
            JOIN stock s ON cp.stock_id = s.id
            JOIN products p ON s.product_id = p.id
            WHERE COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) > 0
              AND (i.status = 'short' OR i.due_date < ?)
              AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
              AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
              AND cp.status != 'deleted'
            ORDER BY i.due_date ASC
        `, [today, today, today], []);
    }

    static async getCashSaleDues() {
        return await this.safeQuery(`
            SELECT 
                cs.*,
                c.customer_name,
                c.phone,
                c.id as customer_id,
                p.item_name
            FROM cash_sales cs
            LEFT JOIN customers c ON cs.customer_id = c.id
            JOIN stock s ON cs.stock_id = s.id
            JOIN products p ON s.product_id = p.id
            WHERE cs.due_amount > 0
            ORDER BY cs.sale_date DESC
        `, [], []);
    }

    static async getOverdueItems() {
        // Get overdue installments
        const today = (typeof Utils !== 'undefined' && Utils.toLocalDateString)
            ? Utils.toLocalDateString(new Date())
            : new Date().toISOString().slice(0, 10);
        const overdueInstallments = await this.safeQuery(`
            SELECT 
                'installment' as type,
                i.id,
                i.due_date,
                CASE
                    WHEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) > 0
                    THEN COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0)
                    ELSE 0
                END as amount,
                c.customer_name,
                c.phone,
                c.id as customer_id,
                CAST(julianday(?) - julianday(i.due_date) as INTEGER) as days_overdue
            FROM installments i
            JOIN customer_purchases cp ON i.purchase_id = cp.id
            JOIN customers c ON cp.customer_id = c.id
            WHERE i.due_date < ?
              AND COALESCE(i.original_amount, i.amount) - COALESCE(i.paid_amount, 0) > 0
              AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
              AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
              AND cp.status != 'deleted'
        `, [today, today], []);

        // Get overdue cash sales (we'll consider them overdue after 30 days)
        const overdueCashSales = await this.safeQuery(`
            SELECT 
                'cash_sale' as type,
                cs.id,
                cs.sale_date as due_date,
                cs.due_amount as amount,
                c.customer_name,
                c.phone,
                c.id as customer_id,
                CAST(julianday('now') - julianday(cs.sale_date) as INTEGER) as days_overdue
            FROM cash_sales cs
            LEFT JOIN customers c ON cs.customer_id = c.id
            WHERE cs.due_amount > 0 
              AND julianday('now') - julianday(cs.sale_date) > 30
        `, [], []);

        return [...(overdueInstallments || []), ...(overdueCashSales || [])]
            .sort((a, b) => b.days_overdue - a.days_overdue);
    }

    // Settle an individual installment (used for discount settlements)
    static async settleInstallment(installmentId, amount, reason = 'Settlement') {
        try {
            // Get current installment data
            const installment = await this.get(
                'SELECT i.*, cp.customer_id FROM installments i JOIN customer_purchases cp ON cp.id = i.purchase_id WHERE i.id = ?',
                [installmentId]
            );

            if (!installment) {
                throw new Error('Installment not found');
            }

            const newPaidAmount = (installment.paid_amount || 0) + amount;
            const newRemaining = Math.max(0, (installment.amount || 0) - newPaidAmount);
            const newStatus = newRemaining === 0 ? 'settled' : (newPaidAmount > 0 ? 'partial' : installment.status);

            await this.run(
                'UPDATE installments SET paid_amount = ?, status = ?, remaining_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newPaidAmount, newStatus, newRemaining, installmentId]
            );

            // Record settlement payment if amount > 0
            if (amount > 0) {
                const receiptNo = this.generateReceiptNo();
                await this.run(
                    'INSERT INTO payments (installment_id, customer_id, amount, payment_date, receipt_no, notes) VALUES (?, ?, ?, CURRENT_DATE, ?, ?)',
                    [installmentId, installment.customer_id, amount, receiptNo, reason]
                );
            }

            return { status: newStatus, paidAmount: newPaidAmount, remaining: newRemaining };
        } catch (error) {
            console.error('Error settling installment:', error);
            throw error;
        }
    }

    // Mark purchase as completed when all installments are settled
    static async markPurchaseAsCompleted(purchaseId) {
        try {
            await this.run(
                'UPDATE customer_purchases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['completed', purchaseId]
            );

            // Also mark all remaining unpaid installments as settled/closed
            await this.run(
                'UPDATE installments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE purchase_id = ? AND status != "paid"',
                ['settled', purchaseId]
            );
        } catch (error) {
            console.error('Error marking purchase as completed:', error);
            throw error;
        }
    }

    // Discount Management Methods
    static async addDiscount(discount) {
        try {
            return await this.run(
                'INSERT INTO discounts (customer_id, purchase_id, amount, reason) VALUES (?, ?, ?, ?)',
                [discount.customer_id, discount.purchase_id, discount.amount, discount.reason || 'Account settlement discount']
            );
        } catch (error) {
            // If table doesn't exist, create it first
            if (error.message.includes('no such table')) {
                await this.createDiscountTable();
                return await this.run(
                    'INSERT INTO discounts (customer_id, purchase_id, amount, reason) VALUES (?, ?, ?, ?)',
                    [discount.customer_id, discount.purchase_id, discount.amount, discount.reason || 'Account settlement discount']
                );
            }
            throw error;
        }
    }

    static async createDiscountTable() {
        return await this.run(`
            CREATE TABLE IF NOT EXISTS discounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                purchase_id INTEGER NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (purchase_id) REFERENCES customer_purchases(id)
            )
        `);
    }

    static async getDiscounts(customerId = null) {
        if (customerId) {
            return await this.query(
                'SELECT * FROM discounts WHERE customer_id = ? ORDER BY created_at DESC',
                [customerId]
            );
        }
        return await this.query('SELECT * FROM discounts ORDER BY created_at DESC');
    }

    // Receipt number generation
    static generateReceiptNo() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
        return `REC-${year}${month}${day}-${time}`;
    }

    // Get installment with customer details (for payRemaining functionality)
    static async getInstallmentWithCustomer(installmentId) {
        return await this.get(`
            SELECT i.*, cp.customer_id, cp.id as purchase_id, c.account_no, c.customer_name
            FROM installments i
            JOIN customer_purchases cp ON cp.id = i.purchase_id
            JOIN customers c ON c.id = cp.customer_id
            WHERE i.id = ?
        `, [installmentId]);
    }

    static async getStaff() {
        return await this.safeQuery('SELECT * FROM staff ORDER BY name ASC', [], []);
    }

    static async addStaff(staff) {
        return await this.run(
            'INSERT INTO staff (name, phone, monthly_salary, status, join_date) VALUES (?, ?, ?, ?, ?)',
            [staff.name, staff.phone || '', Number(staff.monthly_salary) || 0, staff.status || 'active', staff.join_date || null]
        );
    }

    static async updateStaff(staff) {
        return await this.run(
            'UPDATE staff SET name = ?, phone = ?, monthly_salary = ?, status = ?, join_date = ? WHERE id = ?',
            [staff.name, staff.phone || '', Number(staff.monthly_salary) || 0, staff.status || 'active', staff.join_date || null, staff.id]
        );
    }

    static async getStaffEntries(staffId, month) {
        if (staffId && month) {
            return await this.safeQuery(
                'SELECT * FROM staff_salary_entries WHERE staff_id = ? AND month = ? ORDER BY entry_date, id',
                [staffId, month],
                []
            );
        }
        if (staffId) {
            return await this.safeQuery(
                'SELECT * FROM staff_salary_entries WHERE staff_id = ? ORDER BY entry_date DESC, id DESC',
                [staffId],
                []
            );
        }
        return await this.safeQuery('SELECT * FROM staff_salary_entries ORDER BY entry_date DESC, id DESC', [], []);
    }

    static async getStaffSalaryTypeId() {
        let row = await this.get("SELECT id FROM expense_types WHERE name = 'Staff Salary'");
        if (!row) {
            await this.run("INSERT INTO expense_types (name, description) VALUES ('Staff Salary', 'Staff salary and salary advances')");
            row = await this.get("SELECT id FROM expense_types WHERE name = 'Staff Salary'");
        }
        return row ? row.id : null;
    }

    static async addStaffSalaryEntry(entry) {
        const typeId = await this.getStaffSalaryTypeId();
        const exp = await this.addExpense({
            expense_type_id: typeId,
            amount: entry.amount,
            date: entry.entry_date,
            notes: `${entry.type === 'advance' ? 'Salary advance' : 'Salary'} - ${entry.staff_name || ''} ${entry.notes || ''}`.trim()
        });
        return await this.run(
            'INSERT INTO staff_salary_entries (staff_id, entry_date, type, amount, month, notes, expense_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [entry.staff_id, entry.entry_date, entry.type, entry.amount, entry.month, entry.notes || '', exp && exp.id]
        );
    }
}

window.Database = Database;
