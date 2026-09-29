(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exported = factory();
    root.InstallmentEngine = exported.InstallmentEngine;
  }
}(typeof self !== 'undefined' ? self : this, function () {
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
    }
  };

  return { InstallmentEngine };
}));
