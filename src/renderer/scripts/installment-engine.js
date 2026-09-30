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
      startDate
    }) {
      const principal = Math.max(0, Math.round(salePrice - advancePayment));

      let profitAmount;
      if (typeof profitPercentage === 'number' && !isNaN(profitPercentage)) {
        profitAmount = Math.round((principal * profitPercentage) / 100);
      } else if (typeof profitAmountOverride === 'number' && !isNaN(profitAmountOverride)) {
        profitAmount = Math.round(profitAmountOverride);
      } else {
        profitAmount = Math.max(0, Math.round(salePrice - purchasePrice));
      }

      const totalAmount = principal + profitAmount;
      const remainingAmount = totalAmount;
      const months = installmentMonths;
      const base = Math.floor(totalAmount / months);
      const last = totalAmount - base * (months - 1);

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

    reconcile(rows, todayLocalDateString) {
      const copies = (rows || []).map((row) => ({ ...row }));
      copies.sort((a, b) => a.installment_no - b.installment_no);

      let runningShortage = 0;

      for (const row of copies) {
        const original = Number(row.original_amount) || 0;
        const paid = Number(row.paid_amount) || 0;
        const isOverdue = row.due_date < todayLocalDateString;

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

      const allocations = new Map();
      allocations.set(target.id, amount);
      target.paid_amount = (Number(target.paid_amount) || 0) + amount;

      let working = copies;
      const startIndex = working.findIndex((row) => row.id === installmentId);

      for (let i = startIndex; i < working.length; i++) {
        const rec = this.reconcile(working, paymentDate);
        working = rec.rows;
        const row = working[i];
        const displayDue = Number(row.amount) || 0;
        const paid = Number(row.paid_amount) || 0;
        const excess = paid - displayDue;
        if (excess > 0 && i < working.length - 1) {
          row.paid_amount = displayDue;
          working[i + 1].paid_amount = (Number(working[i + 1].paid_amount) || 0) + excess;
          allocations.set(row.id, (allocations.get(row.id) || 0) - excess);
          allocations.set(working[i + 1].id, (allocations.get(working[i + 1].id) || 0) + excess);
        } else {
          break;
        }
      }

      const rec = this.reconcile(working, paymentDate);
      const ledger = [];
      for (const row of rec.rows) {
        const got = allocations.get(row.id) || 0;
        if (got > 0) {
          ledger.push({
            type: 'payment',
            amount: got,
            installment_id: row.id,
            customer_id: customerId,
            purchase_id: purchaseId,
            payment_date: paymentDate,
            receipt_no: receiptNo,
            notes: 'Payment'
          });
        }
      }

      return {
        rows: rec.rows,
        grandRemaining: rec.grandRemaining,
        credit: rec.credit,
        net: rec.net,
        ledger
      };
    }
  };

  return { InstallmentEngine, EngineError };
}));
