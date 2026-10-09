(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exported = factory();
    root.InstallmentEngine = exported.InstallmentEngine;
    root.EngineError = exported.EngineError;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  class EngineError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'EngineError';
      this.code = code;
    }
  }

  function parseLocalDate(dateStr) {
    const parts = String(dateStr).split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    return new Date(y, m - 1, d);
  }

  function formatLocalDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function roundTo(num, decimals) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  const InstallmentEngine = {
    createSchedule({
      salePrice,
      purchasePrice,
      profitPercentage,
      profitAmountOverride,
      advancePayment = 0,
      installmentMonths,
      startDate,
      customMonthlyAmount
    }) {
      const principal = Math.max(0, Math.round(salePrice - advancePayment));

      let profitAmount;
      if (typeof profitAmountOverride === 'number' && !isNaN(profitAmountOverride)) {
        profitAmount = Math.round(profitAmountOverride);
      } else if (typeof profitPercentage === 'number' && !isNaN(profitPercentage)) {
        profitAmount = Math.round((principal * profitPercentage) / 100);
      } else {
        profitAmount = Math.max(0, Math.round(salePrice - purchasePrice));
      }

      const totalAmount = principal + profitAmount;
      const remainingAmount = totalAmount;
      const months = installmentMonths;
      let base;
      let last;
      if (typeof customMonthlyAmount === 'number' && !isNaN(customMonthlyAmount) && customMonthlyAmount > 0) {
        base = Math.round(customMonthlyAmount);
        last = totalAmount - base * (months - 1);
        if (last < 0) {
          throw new EngineError('InvalidAmount', 'Custom installment is larger than remaining total');
        }
      } else {
        base = Math.floor(totalAmount / months);
        last = totalAmount - base * (months - 1);
      }

      const schedule = [];
      const currentDate = parseLocalDate(startDate);
      let remainingBalance = remainingAmount;

      for (let i = 1; i <= months; i++) {
        currentDate.setMonth(currentDate.getMonth() + 1);
        const installmentAmount = i === months ? last : base;

        schedule.push({
          installment_no: i,
          due_date: formatLocalDate(currentDate),
          original_amount: installmentAmount,
          amount: installmentAmount,
          remaining_balance: remainingBalance,
          paid_amount: 0,
          status: 'upcoming'
        });

        remainingBalance = remainingBalance - installmentAmount;
      }

      return {
        schedule,
        summary: {
          salePrice,
          purchasePrice,
          profitAmount,
          profitPercentage: principal > 0 ? roundTo((profitAmount / principal) * 100, 2) : 0,
          totalAmount,
          advancePayment: Math.round(advancePayment),
          remainingAmount,
          monthlyInstallment: base,
          installmentMonths: months
        }
      };
    },

    groupByPurchase(rows) {
      const map = new Map();
      for (const row of rows || []) {
        const purchaseId = row.purchase_id;
        if (!map.has(purchaseId)) map.set(purchaseId, []);
        map.get(purchaseId).push(row);
      }
      return Array.from(map.entries()).map(([purchaseId, installments]) => ({
        purchaseId,
        installments: installments.slice().sort((a, b) => a.installment_no - b.installment_no)
      }));
    },

    totals(rows) {
      const list = rows || [];
      let originalSum = 0;
      let paidSum = 0;
      for (const row of list) {
        originalSum += Number(row.original_amount) || 0;
        paidSum += Number(row.paid_amount) || 0;
      }
      const net = originalSum - paidSum;
      return {
        net,
        grandRemaining: Math.max(0, net),
        credit: Math.max(0, -net)
      };
    },

    isMonthPassed(dueDate, asOfDate) {
      const dueYm = String(dueDate || '').slice(0, 7);
      const asOfYm = String(asOfDate || '').slice(0, 7);
      if (!dueYm || !asOfYm) return false;
      return dueYm < asOfYm;
    },

    totalShort(rows, asOfDate) {
      let short = 0;
      for (const row of rows || []) {
        if (!this.isMonthPassed(row.due_date, asOfDate)) continue;
        const original = Number(row.original_amount) || 0;
        const paid = Number(row.paid_amount) || 0;
        short += Math.max(0, original - paid);
      }
      return short;
    },

    customerDueSummary(rows, asOfDate) {
      const list = rows || [];
      const short = this.totalShort(list, asOfDate);
      if (short > 0) {
        return { kind: 'short', amount: short };
      }
      const asOfYm = String(asOfDate || '').slice(0, 7);
      const current = list.find((row) => {
        const dueYm = String(row.due_date || '').slice(0, 7);
        if (dueYm !== asOfYm) return false;
        const remaining = Math.max(0, (Number(row.original_amount) || 0) - (Number(row.paid_amount) || 0));
        return remaining > 0 && row.status !== 'paid' && row.status !== 'settled';
      });
      if (current) {
        const amount = Math.max(0, (Number(current.original_amount) || 0) - (Number(current.paid_amount) || 0));
        return { kind: 'current', amount, due_date: current.due_date };
      }
      return { kind: 'none', amount: 0 };
    },

    groupCustomerDues(rows, asOfDate) {
      const byCustomer = new Map();
      for (const row of rows || []) {
        const id = row.customer_id;
        if (!byCustomer.has(id)) byCustomer.set(id, []);
        byCustomer.get(id).push(row);
      }
      const grouped = [];
      for (const [customerId, list] of byCustomer.entries()) {
        const summary = this.customerDueSummary(list, asOfDate);
        const first = list[0] || {};
        grouped.push({
          customer_id: customerId,
          customer_name: first.customer_name,
          account_no: first.account_no,
          phone: first.phone,
          kind: summary.kind,
          amount: summary.amount,
          due_date: summary.due_date || first.due_date
        });
      }
      return grouped.filter((g) => g.amount > 0);
    },

    buildReceivableRows(rows, asOfDate) {
      const rec = this.reconcile(rows, asOfDate);
      const paperRows = rec.rows.map((row, index) => {
        const original = Number(row.original_amount) || 0;
        const paid = Number(row.paid_amount) || 0;
        const remaining = Math.max(0, original - paid);
        const short = this.isMonthPassed(row.due_date, asOfDate) ? remaining : 0;
        return {
          serial: index + 1,
          due_date: row.due_date,
          account_no: row.account_no || '',
          name: row.customer_name || '',
          phone: row.phone || '',
          model: row.item_name || '',
          installment_no: row.installment_no,
          ins_rs: original,
          short,
          received: paid,
          final_bal: remaining
        };
      });
      const footer = paperRows.reduce((acc, row) => {
        acc.short += row.short;
        acc.received += row.received;
        acc.final_bal += row.final_bal;
        return acc;
      }, { short: 0, received: 0, final_bal: 0 });
      return { rows: paperRows, footer };
    },

    reconcile(rows, todayLocalDateString) {
      const copies = (rows || []).map((row) => ({ ...row }));
      copies.sort((a, b) => a.installment_no - b.installment_no);

      let runningShortage = 0;

      for (const row of copies) {
        const original = Number(row.original_amount) || 0;
        const paid = Number(row.paid_amount) || 0;
        const isOverdue = this.isMonthPassed(row.due_date, todayLocalDateString);

        if (isOverdue) {
          const unpaid = original + runningShortage - paid;
          row.status = 'short';
          row.amount = 0;
          row.remaining_balance = 0;
          runningShortage = unpaid;
        } else {
          const displayDue = original + runningShortage;
          row.amount = displayDue;
          row.remaining_balance = Math.max(0, displayDue - paid);
          if (paid > 0 && row.remaining_balance > 0) {
            row.status = 'partial';
          } else if (row.remaining_balance <= 0) {
            row.status = 'paid';
          } else {
            row.status = 'upcoming';
          }
          runningShortage = 0;
        }
      }

      const { grandRemaining, credit, net } = this.totals(copies);
      return { rows: copies, grandRemaining, credit, net };
    },

    applyPayment(rows, { installmentId, amount, paymentDate, customerId, purchaseId, receiptNo }) {
      if (!(amount > 0)) {
        throw new EngineError('InvalidAmount', 'Amount must be greater than 0');
      }

      const copies = (rows || []).map((row) => ({ ...row }));
      copies.sort((a, b) => a.installment_no - b.installment_no);

      const target = copies.find((row) => row.id === installmentId);
      if (!target) {
        throw new EngineError('NotFound', 'Installment not found');
      }

      target.paid_amount = (Number(target.paid_amount) || 0) + amount;

      const rec = this.reconcile(copies, paymentDate);
      const ledger = [{
        type: 'payment',
        amount,
        installment_id: target.id,
        customer_id: customerId,
        purchase_id: purchaseId,
        payment_date: paymentDate,
        receipt_no: receiptNo,
        notes: 'Payment'
      }];

      return {
        rows: rec.rows,
        grandRemaining: rec.grandRemaining,
        credit: rec.credit,
        net: rec.net,
        ledger
      };
    },

    payRemaining(rows, { amount, markAsDiscount, paymentDate, customerId, purchaseId, receiptNo }) {
      if (amount < 0 || (!markAsDiscount && !(amount > 0))) {
        throw new EngineError('InvalidAmount', 'Amount must be greater than 0');
      }

      const copies = (rows || []).map((row) => ({ ...row }));
      copies.sort((a, b) => a.installment_no - b.installment_no);

      let remainingCash = amount;
      const ledger = [];

      for (const row of copies) {
        if (remainingCash <= 0) break;
        const unpaidOriginal = Math.max(0, (Number(row.original_amount) || 0) - (Number(row.paid_amount) || 0));
        if (unpaidOriginal <= 0) continue;
        const apply = Math.min(remainingCash, unpaidOriginal);
        row.paid_amount = (Number(row.paid_amount) || 0) + apply;
        remainingCash -= apply;
        ledger.push({
          type: 'payment',
          amount: apply,
          installment_id: row.id,
          customer_id: customerId,
          purchase_id: purchaseId,
          payment_date: paymentDate,
          receipt_no: receiptNo,
          notes: 'Payment'
        });
      }

      let discountAmount = 0;
      if (markAsDiscount) {
        for (const row of copies) {
          const unpaidOriginal = Math.max(0, (Number(row.original_amount) || 0) - (Number(row.paid_amount) || 0));
          if (unpaidOriginal > 0) {
            discountAmount += unpaidOriginal;
            row.paid_amount = Number(row.original_amount) || 0;
          }
          row.status = 'settled';
          row.amount = Number(row.original_amount) || 0;
          row.remaining_balance = 0;
        }
        if (discountAmount > 0) {
          ledger.push({
            type: 'discount',
            amount: discountAmount,
            installment_id: copies[copies.length - 1] ? copies[copies.length - 1].id : null,
            customer_id: customerId,
            purchase_id: purchaseId,
            payment_date: paymentDate,
            receipt_no: receiptNo,
            notes: 'Discount'
          });
        }
        return {
          rows: copies,
          grandRemaining: 0,
          credit: 0,
          net: 0,
          ledger,
          purchaseStatus: 'completed',
          discountAmount
        };
      }

      const rec = this.reconcile(copies, paymentDate);
      const purchaseStatus = rec.grandRemaining === 0 ? 'completed' : 'active';
      return {
        rows: rec.rows,
        grandRemaining: rec.grandRemaining,
        credit: rec.credit,
        net: rec.net,
        ledger,
        purchaseStatus,
        discountAmount: 0
      };
    },

    voidLastPayment(rows, ledgerForInstallment, installmentId) {
      const copies = (rows || []).map((row) => ({ ...row }));
      copies.sort((a, b) => a.installment_no - b.installment_no);

      const target = copies.find((row) => row.id === installmentId);
      if (!target) {
        throw new EngineError('NotFound', 'Installment not found');
      }

      const payments = (ledgerForInstallment || []).filter((entry) => {
        const isPayment = entry.type === 'payment' || entry.type == null;
        const matches = entry.installment_id === installmentId || entry.installmentId === installmentId;
        return isPayment && matches;
      });
      if (payments.length === 0) {
        throw new EngineError('NotFound', 'No payment to void');
      }

      const last = payments[payments.length - 1];
      const voidAmount = Number(last.amount) || 0;
      target.paid_amount = Math.max(0, (Number(target.paid_amount) || 0) - voidAmount);

      const rec = this.reconcile(copies, target.due_date);
      return {
        rows: rec.rows,
        grandRemaining: rec.grandRemaining,
        credit: rec.credit,
        net: rec.net,
        voidedLedgerId: last.id != null ? last.id : null
      };
    },

    setPaidAmount(rows, installmentId, newPaid) {
      if (newPaid < 0) {
        throw new EngineError('InvalidAmount', 'Paid amount cannot be negative');
      }

      const copies = (rows || []).map((row) => ({ ...row }));
      const target = copies.find((row) => row.id === installmentId);
      if (!target) {
        throw new EngineError('NotFound', 'Installment not found');
      }
      target.paid_amount = newPaid;
      return copies;
    }
  };

  return { InstallmentEngine, EngineError };
}));
