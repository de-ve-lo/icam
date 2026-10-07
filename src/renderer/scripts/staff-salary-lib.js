(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exported = factory();
    root.StaffSalary = exported.StaffSalary;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  const StaffSalary = {
    remainingForMonth(monthlySalary, advancesPaid) {
      const salary = Number(monthlySalary) || 0;
      const advances = Number(advancesPaid) || 0;
      return Math.max(0, Math.round(salary - advances));
    },

    collectedInMonth(entries) {
      if (!Array.isArray(entries)) return 0;
      return entries.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    }
  };

  return { StaffSalary };
}));
