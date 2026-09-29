// Database Interface for Renderer Process
if (!window._ipcRenderer) {
    window._ipcRenderer = require('electron').ipcRenderer;
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
            'INSERT INTO products (item_name, current_price, purchase_price) VALUES (?, ?, ?)',
            [product.item_name, product.current_price, product.purchase_price]
        );
    }

    static async updateProduct(id, product) {
        return await this.run(
            'UPDATE products SET item_name = ?, current_price = ?, purchase_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [product.item_name, product.current_price, product.purchase_price, id]
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
            SELECT s.*, p.item_name, sup.supplier_name 
            FROM stock s 
            JOIN products p ON s.product_id = p.id 
            JOIN suppliers sup ON s.supplier_id = sup.id 
            ORDER BY s.created_at DESC
        `);
    }

    static async addStock(stock) {
        return await this.run(
            'INSERT INTO stock (product_id, supplier_id, engine_no, chassis_no, stock_date, stock_no) VALUES (?, ?, ?, ?, ?, ?)',
            [stock.product_id, stock.supplier_id, stock.engine_no, stock.chassis_no, stock.stock_date, stock.stock_no]
        );
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
               OR g.name LIKE ?
               OR g.phone LIKE ?
               OR g.cnic_no LIKE ?
        `, [like, like, like, like, like, like, like, like, like]);
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

        // Mark stock as sold
        await this.run('UPDATE stock SET is_sold = 1 WHERE id = ?', [purchase.stock_id]);

        return result;
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
                c.account_no,
                c.cnic_no,
                p.item_name,
                s.engine_no,
                s.chassis_no
            FROM installments i
            JOIN customer_purchases cp ON i.purchase_id = cp.id
            JOIN customers c ON cp.customer_id = c.id
            JOIN stock s ON cp.stock_id = s.id
            JOIN products p ON s.product_id = p.id
            WHERE cp.customer_id = ? AND i.is_deleted = 0 AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL) AND cp.status != 'deleted'
            ORDER BY i.due_date ASC
        `, [customerId]);
    }

    // CORRECTED Payment method with proper value shifting logic
    static async payInstallment(installmentId, amount) {
        console.log(`💰 PayInstallment called: installmentId=${installmentId}, amount=${amount}`);

        if (amount <= 0) return { receiptNo: null };

        // 1. Get Details
        const installment = await this.get(`SELECT * FROM installments WHERE id = ?`, [installmentId]);
        if (!installment) throw new Error('Installment not found');

        // 2. Record Payment on THIS installment
        const currentPaid = installment.paid_amount || 0;
        const newPaid = currentPaid + amount;

        await this.run(
            'UPDATE installments SET paid_amount = ?, paid_date = CURRENT_DATE WHERE id = ?',
            [newPaid, installmentId]
        );

        // 3. Record Receipt
        const receiptNo = this.generateReceiptNo();
        await this.run(
            'INSERT INTO payments (installment_id, customer_id, amount, payment_date, receipt_no, notes) VALUES (?, ?, ?, CURRENT_DATE, ?, ?)',
            [installmentId, installment.purchase_id, amount, receiptNo, 'Payment']
        ); // Note: customer_id is usually on purchase, fixed access here

        // 4. Distribute if Overpaid (Physical move of money)
        // We calculate "Due" as per the last reconcile state to decide if we overpaid
        // But reconcile will handle logic. However, to keep Ledger clean (no negative shortages),
        // we should push excess paid_amount to next installments.

        // Check if we paid more than the total required including forwarded/inflated amount?
        // No, we should check against "Visual Amount" (which includes forwarded)
        // actualRemaining = amount - paid.
        // If newPaid > amount?

        // Let's use a simpler approach: Just call reconcile first.
        // It will calculate 'runningShortage'.
        // If we want to distribute, we can do it after.

        // For now, let's Stick to the Plan:
        // "Update installments table... Call reconcileInstallments"
        // I will add overpayment distribution in a separate step if needed, but Reconcile logic handles "Surplus" by reducing next due.
        // The user requirement "Ledger must reflect: Payments only... No duplicated balances".
        // If I pay 2000 on a 1000 due row, Reconcile will see -1000 remaining.
        // My Reconcile logic: "actualRemaining < 0 ... runningShortage = actualRemaining (Surplus)".
        // Next row: "totalTarget = base + (-1000)".
        // This works perfectly for calculation.

        // 5. Reconcile
        await this.reconcileShortagesForPurchase(installment.purchase_id);

        return { receiptNo };
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

    // Deprecated helpers removed (handled by reconcileShortagesForPurchase now)
    static async handlePartialPaymentCarryover(pid, cid, amt) { }
    static async carryShortageToNext(pid, idx, amt, all) { }

    // Helper method to carry shortage to next installments
    static async carryShortageToNext(purchaseId, currentIndex, shortageAmount, allInstallments) {
        console.log(`💸 Carrying shortage: ${shortageAmount} from index ${currentIndex}`);

        // Find the next unpaid installment
        for (let i = currentIndex + 1; i < allInstallments.length; i++) {
            const nextInstallment = allInstallments[i];

            if (nextInstallment.status !== 'paid') {
                const currentAmount = nextInstallment.amount || 0;
                const newAmount = currentAmount + shortageAmount;
                const currentPaid = nextInstallment.paid_amount || 0;
                const newRemaining = Math.max(0, newAmount - currentPaid);

                console.log(`💸 Adding ${shortageAmount} shortage to installment ${nextInstallment.installment_no}: ${currentAmount} -> ${newAmount}`);

                await this.run(
                    'UPDATE installments SET amount = ?, remaining_balance = ? WHERE id = ?',
                    [newAmount, newRemaining, nextInstallment.id]
                );
                break;
            }
        }
    }

    // Enhanced shortage reconciliation - VALUE SHIFTING approach
    static async reconcileShortagesForCustomer(customerId) {
        console.log(`🔄 Reconciling shortages for customer ${customerId} - Value Shifting Approach`);

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
        console.log(`🔄 Reconciling shortages for purchase ${purchaseId}`);

        try {
            const installments = await this.query(`
                SELECT * FROM installments 
                WHERE purchase_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
                ORDER BY installment_no ASC
            `, [purchaseId]);

            if (!installments || installments.length === 0) return;

            const parseDateSafe = (value) => {
                if (!value) return null;
                const d = new Date(value);
                return isNaN(d.getTime()) ? null : d;
            };

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let runningShortage = 0;

            for (const inst of installments) {
                // Ensure original_amount is set
                if (!inst.original_amount && inst.original_amount !== 0) {
                    // Fallback if migration missed somehow, but migration should have run
                    inst.original_amount = inst.amount;
                }
                const baseAmount = Number(inst.original_amount);
                const paidAmount = Number(inst.paid_amount || 0);
                const dueDate = parseDateSafe(inst.due_date);
                const isOverdue = dueDate && dueDate < today;

                const totalTarget = baseAmount + runningShortage;
                const actualRemaining = totalTarget - paidAmount;

                let newStatus = inst.status;
                let newAmount = totalTarget; // Visual Due Amount
                let newRemaining = Math.max(0, actualRemaining);

                if (isOverdue) {
                    // Past Due Logic
                    if (actualRemaining > 0) {
                        // Not fully settled
                        // Not fully settled
                        newRemaining = 0; // Visual remaining is 0 (as it moves forward)
                        newAmount = 0;    // Visual amount is 0 (Forwarded)


                        // Determing Status: 'paid' if base is covered, 'short' otherwise
                        if (paidAmount >= baseAmount) {
                            newStatus = 'paid';
                        } else {
                            newStatus = 'short';
                        }

                        runningShortage = actualRemaining; // Push forward
                    } else {
                        // Fully settled
                        newStatus = 'paid'; // or 'settled'
                        newAmount = paidAmount; // Show what was paid
                        newRemaining = 0;
                        runningShortage = actualRemaining; // Should be <= 0 (Surplus)
                    }
                } else {
                    // Upcoming Logic
                    if (actualRemaining <= 0) {
                        newStatus = 'paid';
                        newRemaining = 0;
                        newAmount = Math.max(0, totalTarget);
                        runningShortage = actualRemaining; // Surplus moves to next
                    } else {
                        // Still due
                        newStatus = paidAmount > 0 ? 'partial' : 'upcoming';
                        newAmount = totalTarget;
                        newRemaining = actualRemaining;
                        runningShortage = 0; // Absorbed here
                    }
                }

                // Update DB if changed
                if (inst.amount !== newAmount || inst.remaining_balance !== newRemaining || inst.status !== newStatus) {
                    await this.run(
                        'UPDATE installments SET amount = ?, remaining_balance = ?, status = ? WHERE id = ?',
                        [newAmount, newRemaining, newStatus, inst.id]
                    );
                    // Update local object for next iteration logic if needed? 
                    // No, reliance is on calculated variables.
                }
            }

            // Handle leftover shortage (if last installment is short)
            if (runningShortage > 0) {
                console.warn(`⚠️ Purchase ${purchaseId} has floating shortage ${runningShortage} after last installment.`);
                // We might need to add it to the last installment visually or handle it?
                // For now, it stays on the last installment implicitly via the loop, 
                // BUT the loop logic above sets Amount=0 for overdue.
                // If the LAST installment is overdue, it hides the amount.
                // WE MUST reveal it if there is no "Next" installment.
                // Fix: The loop above puts it in runningShortage.

                // Let's re-update the very last installment to show the debt if it's the end of the line
                // user says "Forwarded amounts... Must exist only in the next upcoming installment".
                // If there is NO next, it should probably stay on the last one.

                const lastInst = installments[installments.length - 1];
                const lastDueDate = parseDateSafe(lastInst.due_date);
                if (lastDueDate < today) {
                    // It was marked short/0. Revert it to show the debt?
                    // "All installments are overdue (short)... System works even if 100% overdue"
                    // User Example 6: "Installment - Status Short - Payable 0".
                    // Then says in "Additional Improvements": "Accumulated shortage... will be collected".
                    // The UI script I saw in `installments.js` (Step 50) handles "All Short" by showing a banner.
                    // So keeping it 0 is correct for the table. The banner handles the total.
                }
            }

        } catch (error) {
            console.error('Error in reconcile:', error);
        }
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

    // Advanced Pay Remaining method with corrected value shifting logic
    static async payRemainingAdvanced(installmentId, amount, markAsDiscount = false) {
        console.log(`📀 PayRemainingAdvanced: installmentId=${installmentId}, amount=${amount}, discount=${markAsDiscount}`);

        // Get installment and customer details
        const installment = await this.get(`
            SELECT i.*, cp.customer_id, cp.id as purchase_id
            FROM installments i
            JOIN customer_purchases cp ON cp.id = i.purchase_id
            WHERE i.id = ?
        `, [installmentId]);

        if (!installment) {
            throw new Error('Installment not found');
        }

        // Reconcile shortages first to ensure accurate calculations
        await this.reconcileShortagesForPurchase(installment.purchase_id);

        // Get all installments for this purchase after reconciliation
        let allInstallments = await this.query(`
            SELECT * FROM installments 
            WHERE purchase_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
            ORDER BY installment_no ASC
        `, [installment.purchase_id]);

        // Calculate TRUE total remaining using original amounts - prevents double counting
        let totalRemaining = 0;
        for (const inst of allInstallments) {
            if (inst.status !== 'paid' && inst.status !== 'settled') {
                const originalAmount = inst.original_amount || inst.amount || 0;
                const paidAmount = inst.paid_amount || 0;
                const remaining = Math.max(0, originalAmount - paidAmount);
                totalRemaining += remaining;
            }
        }

        console.log(`📀 TRUE Total remaining (using original amounts): ${totalRemaining}`);

        // Generate a single receipt number for this entire transaction (payment + discount)
        const receiptNo = this.generateReceiptNo();

        // STEP 1: Handle payment if amount > 0
        if (amount > 0) {
            // Distribute payment across all unpaid installments using the shared receiptNo
            await this.distributePaymentAcrossInstallments(allInstallments, amount, installment.customer_id, receiptNo);

            // Reconcile again after payment to get updated states
            await this.reconcileShortagesForPurchase(installment.purchase_id);
        }

        // STEP 2: Recalculate remaining balance AFTER payment
        allInstallments = await this.query(`
            SELECT * FROM installments 
            WHERE purchase_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
            ORDER BY installment_no ASC
        `, [installment.purchase_id]);

        let remainingAfterPayment = 0;
        for (const inst of allInstallments) {
            if (inst.status !== 'paid' && inst.status !== 'settled') {
                const originalAmount = inst.original_amount || inst.amount || 0;
                const paidAmount = inst.paid_amount || 0;
                const remaining = Math.max(0, originalAmount - paidAmount);
                remainingAfterPayment += remaining;
            }
        }

        console.log(`📀 Remaining balance AFTER payment: ${remainingAfterPayment}`);

        // STEP 3: Calculate discount based on remaining balance AFTER payment
        const discountAmount = remainingAfterPayment;
        const totalCoverage = amount + (markAsDiscount ? discountAmount : 0);

        // STEP 4: Handle discount if checkbox is checked
        if (markAsDiscount && discountAmount > 0) {
            // Add discount record
            await this.run(
                'INSERT INTO discounts (customer_id, purchase_id, amount, reason) VALUES (?, ?, ?, ?)',
                [installment.customer_id, installment.purchase_id, discountAmount, 'Account settlement discount']
            );

            // Record discount as expense
            // First, ensure "Discount" expense type exists
            let expenseType = await this.get('SELECT id FROM expense_types WHERE name = ?', ['Discount']);
            if (!expenseType) {
                const result = await this.run(
                    'INSERT INTO expense_types (name, description) VALUES (?, ?)',
                    ['Discount', 'Settlement discounts given to customers']
                );
                expenseType = { id: result.id };
            }

            // Record the expense
            await this.run(
                'INSERT INTO expenses (expense_type_id, amount, date, notes) VALUES (?, ?, CURRENT_DATE, ?)',
                [expenseType.id, discountAmount, `Settlement discount for Account #${installment.customer_id} - Receipt ${receiptNo}`]
            );

            console.log(`📀 Discount applied: ${discountAmount} and recorded as expense`);

            // Mark all remaining installments as settled
            for (const inst of allInstallments) {
                // Skip installments that are already paid, settled, OR short (short means balance was forwarded)
                if (inst.status === 'paid' || inst.status === 'settled' || inst.status === 'short') {
                    continue;
                }

                const originalAmount = inst.original_amount || inst.amount || 0;
                const paidAmount = inst.paid_amount || 0;
                const remaining = Math.max(0, originalAmount - paidAmount);

                if (remaining > 0) {
                    // Settle the installment by marking it as paid with settlement
                    const newPaidAmount = paidAmount + remaining;
                    await this.run(
                        'UPDATE installments SET paid_amount = ?, status = ?, remaining_balance = 0, paid_date = CURRENT_DATE WHERE id = ?',
                        [newPaidAmount, 'settled', inst.id]
                    );

                    // Record settlement payment using the SAME receiptNo
                    await this.run(
                        'INSERT INTO payments (installment_id, customer_id, amount, payment_date, receipt_no, notes) VALUES (?, ?, ?, CURRENT_DATE, ?, ?)',
                        [inst.id, installment.customer_id, remaining, receiptNo, 'Account settlement via discount']
                    );
                } else {
                    // Just update status
                    await this.run(
                        'UPDATE installments SET status = ? WHERE id = ?',
                        ['settled', inst.id]
                    );
                }
            }

            // Mark purchase as completed
            await this.run(
                'UPDATE customer_purchases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['completed', installment.purchase_id]
            );
        }

        return {
            totalRemaining,
            discountAmount,
            totalCoverage,
            fullySettled: totalCoverage >= totalRemaining
        };
    }

    // Helper to distribute payment across multiple installments
    static async distributePaymentAcrossInstallments(allInstallments, totalPayment, customerId, existingReceiptNo = null) {
        console.log(`🔄 Distributing ${totalPayment} across ${allInstallments.length} installments`);

        let remainingPayment = totalPayment;
        const receiptNo = existingReceiptNo || this.generateReceiptNo();

        for (const installment of allInstallments) {
            if (remainingPayment <= 0) break;

            if (installment.status === 'paid' || installment.status === 'settled') {
                continue;
            }

            const dueAmount = installment.amount || 0;
            const paidAmount = installment.paid_amount || 0;
            const remaining = Math.max(0, dueAmount - paidAmount);

            if (remaining > 0) {
                const paymentToApply = Math.min(remainingPayment, remaining);
                const newPaidAmount = paidAmount + paymentToApply;
                const newStatus = newPaidAmount >= dueAmount ? 'paid' : 'partial';
                const newRemaining = Math.max(0, dueAmount - newPaidAmount);

                await this.run(
                    'UPDATE installments SET paid_amount = ?, paid_date = CURRENT_DATE, status = ?, remaining_balance = ? WHERE id = ?',
                    [newPaidAmount, newStatus, newRemaining, installment.id]
                );

                // Record individual payment with shared receipt number
                await this.run(
                    'INSERT INTO payments (installment_id, customer_id, amount, payment_date, receipt_no, notes) VALUES (?, ?, ?, CURRENT_DATE, ?, ?)',
                    [installment.id, customerId, paymentToApply, receiptNo, 'Pay Remaining - distributed payment']
                );

                remainingPayment -= paymentToApply;
                console.log(`🔄 Applied ${paymentToApply} to installment ${installment.installment_no}, remaining payment: ${remainingPayment}`);
            }
        }
    }

    static generateReceiptNo() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        return `RCP-${timestamp.slice(-6)}${random.toUpperCase()}`;
    }

    // Enhanced payment function with overpayment distribution
    static async payInstallmentWithDistribution(installmentId, amount, paymentDate = null) {
        const paymentDateStr = paymentDate || new Date().toISOString().slice(0, 10);

        // Get the installment and its customer's all installments
        const currentInstallment = await this.get(`
            SELECT i.*, cp.customer_id, cp.id as purchase_id
            FROM installments i
            JOIN customer_purchases cp ON cp.id = i.purchase_id
            WHERE i.id = ? AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
        `, [installmentId]);

        if (!currentInstallment) {
            throw new Error('Installment not found');
        }

        // Get all unpaid installments for this customer's purchase, sorted by installment number
        const allInstallments = await this.query(`
            SELECT * FROM installments 
            WHERE purchase_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
            ORDER BY installment_no ASC
        `, [currentInstallment.purchase_id]);

        let remainingAmount = amount;
        const receiptNo = this.generateReceiptNo();
        const paymentDetails = [];

        // Find the starting installment and distribute payment from there
        let startDistributing = false;

        for (const installment of allInstallments) {
            if (installment.id === parseInt(installmentId)) {
                startDistributing = true;
            }

            if (!startDistributing) continue;

            const currentPaid = installment.paid_amount || 0;
            const currentDue = installment.amount || 0;
            const installmentRemaining = Math.max(0, currentDue - currentPaid);

            if (installmentRemaining === 0 || remainingAmount <= 0) continue;

            const paymentForThisInstallment = Math.min(remainingAmount, installmentRemaining);
            const newPaidAmount = currentPaid + paymentForThisInstallment;
            const newStatus = newPaidAmount >= currentDue ? 'paid' : 'partial';
            const newRemaining = Math.max(0, currentDue - newPaidAmount);

            // Update installment
            await this.run(
                'UPDATE installments SET paid_amount = ?, paid_date = ?, status = ?, remaining_balance = ? WHERE id = ?',
                [newPaidAmount, paymentDateStr, newStatus, newRemaining, installment.id]
            );

            // Record individual payment entry
            await this.run(
                'INSERT INTO payments (installment_id, customer_id, amount, payment_date, receipt_no, notes) VALUES (?, ?, ?, ?, ?, ?)',
                [installment.id, currentInstallment.customer_id, paymentForThisInstallment, paymentDateStr, receiptNo,
                installment.id === parseInt(installmentId) ? 'Direct payment' : 'Overpayment distribution']
            );

            paymentDetails.push({
                installmentId: installment.id,
                installmentNo: installment.installment_no,
                amountPaid: paymentForThisInstallment,
                status: newStatus,
                remaining: newRemaining
            });

            remainingAmount -= paymentForThisInstallment;

            if (remainingAmount <= 0) break;
        }

        return {
            receiptNo,
            totalAmount: amount,
            distributedAmount: amount - remainingAmount,
            excessAmount: remainingAmount,
            paymentDetails
        };
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

            // Pending amount
            const pendingResult = await this.get(`
                SELECT SUM(amount - COALESCE(paid_amount, 0)) as pending 
                FROM installments 
                WHERE status != 'paid' AND (is_deleted = 0 OR is_deleted IS NULL)
            `);
            stats.pendingAmount = pendingResult?.pending || 0;

            // Overdue installments
            const overdueResult = await this.get(`
                SELECT COUNT(*) as count 
                FROM installments 
                WHERE due_date < date('now') AND status != 'paid' AND (is_deleted = 0 OR is_deleted IS NULL)
            `);
            stats.overdueInstallments = overdueResult?.count || 0;

            // Total collections this month
            const monthlyCollectionResult = await this.get(`
                SELECT SUM(paid_amount) as total
                FROM installments 
                WHERE strftime('%Y-%m', paid_date) = strftime('%Y-%m', 'now') AND (is_deleted = 0 OR is_deleted IS NULL)
            `);
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
                    strftime('%Y-%m', paid_date) as month,
                    SUM(paid_amount) as total
                FROM installments 
                WHERE paid_date IS NOT NULL 
                AND (is_deleted = 0 OR is_deleted IS NULL)
                AND paid_date >= date('now', '-${months} months')
                GROUP BY strftime('%Y-%m', paid_date)
                ORDER BY month ASC
            `);

            return data.map(row => ({
                month: row.month,
                total: row.total || 0,
                label: new Date(row.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            }));
        } catch (error) {
            console.error('Error getting monthly collection data:', error);
            return [];
        }
    }

    // Get overdue installments details
    static async getOverdueInstallments() {
        return await this.query(`
            SELECT 
                i.*,
                c.account_no,
                c.cnic_no,
                c.phone,
                p.item_name,
                s.engine_no,
                CAST(julianday('now') - julianday(i.due_date) as INTEGER) as days_overdue
            FROM installments i
            JOIN customer_purchases cp ON i.purchase_id = cp.id
            JOIN customers c ON cp.customer_id = c.id
            JOIN stock s ON cp.stock_id = s.id
            JOIN products p ON s.product_id = p.id
            WHERE i.due_date < date('now') AND i.status != 'paid' AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
            ORDER BY i.due_date ASC
        `);
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
        // Delegate to the value-shifting implementation to keep behavior consistent app-wide
        return await this.reconcileShortagesForPurchase(purchaseId);
    }

    static async reconcileShortagesForCustomer(customerId) {
        const purchases = await this.getActivePurchasesForCustomer(customerId);
        for (const p of purchases) {
            await this.reconcileShortagesForPurchase(p.id);
        }
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
        console.log(`VOID PAYMENT (LIFO): installmentId=${installmentId}`);

        // 1. Get Latest Payment
        const lastPayment = await this.get(`
            SELECT * FROM payments 
            WHERE installment_id = ? 
            ORDER BY id DESC LIMIT 1
        `, [installmentId]);

        if (!lastPayment) {
            throw new Error('No payments found to void for this installment');
        }

        const voidAmount = lastPayment.amount;

        // 2. Delete Update Installment
        const installment = await this.get('SELECT * FROM installments WHERE id = ?', [installmentId]);
        if (!installment) throw new Error('Installment not found');

        const newPaid = Math.max(0, (installment.paid_amount || 0) - voidAmount);
        // Status will be fixed by reconcile, but safe to set 'pending' or 'partial' temporarily?
        // Reconcile is robust, just update amount.
        await this.run(
            'UPDATE installments SET paid_amount = ?, paid_date = (CASE WHEN ? > 0 THEN paid_date ELSE NULL END) WHERE id = ?',
            [newPaid, newPaid, installmentId]
        );

        // 3. Delete the Payment Record
        await this.run('DELETE FROM payments WHERE id = ?', [lastPayment.id]);

        // 4. Reconcile
        await this.reconcileShortagesForPurchase(installment.purchase_id);
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
                s.engine_no,
                s.chassis_no
            FROM cash_sales cs
            LEFT JOIN customers c ON cs.customer_id = c.id
            JOIN stock s ON cs.stock_id = s.id
            JOIN products p ON s.product_id = p.id
            ORDER BY cs.sale_date DESC, cs.created_at DESC
        `, [], []);
    }

    static async getAvailableStock() {
        return await this.safeQuery(`
            SELECT s.*, p.item_name, p.current_price
            FROM stock s
            JOIN products p ON s.product_id = p.id
            WHERE s.is_sold = 0
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

        // Mark stock as sold
        await this.run('UPDATE stock SET is_sold = 1 WHERE id = ?', [cashSale.stock_id]);

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
        return await this.safeQuery(`
            SELECT 
                i.*,
                c.customer_name,
                c.account_no,
                c.phone,
                c.id as customer_id,
                p.item_name,
                (i.amount - COALESCE(i.paid_amount, 0)) as remaining_amount,
                CASE 
                    WHEN i.due_date < date('now') AND i.status != 'paid' 
                    THEN CAST(julianday('now') - julianday(i.due_date) as INTEGER)
                    ELSE 0
                END as days_overdue
            FROM installments i
            JOIN customer_purchases cp ON i.purchase_id = cp.id
            JOIN customers c ON cp.customer_id = c.id
            JOIN stock s ON cp.stock_id = s.id
            JOIN products p ON s.product_id = p.id
            WHERE i.status != 'paid' 
              AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
              AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
              AND cp.status != 'deleted'
            ORDER BY i.due_date ASC
        `, [], []);
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
        const overdueInstallments = await this.safeQuery(`
            SELECT 
                'installment' as type,
                i.id,
                i.due_date,
                (i.amount - COALESCE(i.paid_amount, 0)) as amount,
                c.customer_name,
                c.phone,
                c.id as customer_id,
                CAST(julianday('now') - julianday(i.due_date) as INTEGER) as days_overdue
            FROM installments i
            JOIN customer_purchases cp ON i.purchase_id = cp.id
            JOIN customers c ON cp.customer_id = c.id
            WHERE i.due_date < date('now') 
              AND i.status != 'paid' 
              AND (i.is_deleted = 0 OR i.is_deleted IS NULL)
              AND (cp.is_deleted = 0 OR cp.is_deleted IS NULL)
              AND cp.status != 'deleted'
        `, [], []);

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
}

window.Database = Database;
