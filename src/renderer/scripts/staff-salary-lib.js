(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exported = factory();
    root.StaffSalary = exported.StaffSalary;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatYmd(y, m, d) {
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  function lastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function parseYmd(dateStr) {
    const parts = String(dateStr || '').split('-');
    return {
      y: Number(parts[0]) || 0,
      m: Number(parts[1]) || 0,
      d: Number(parts[2]) || 0
    };
  }

  function clampDay(year, month, day) {
    return Math.min(day, lastDayOfMonth(year, month));
  }

  function addMonths(year, month, delta) {
    const d = new Date(year, month - 1 + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }

  const StaffSalary = {
    remainingForMonth(monthlySalary, advancesPaid) {
      return this.remainingForCycle(monthlySalary, advancesPaid, 0);
    },

    remainingForCycle(monthlySalary, advancesPaid, salaryPaid) {
      const salary = Number(monthlySalary) || 0;
      const advances = Number(advancesPaid) || 0;
      const paid = Number(salaryPaid) || 0;
      return Math.max(0, Math.round(salary - advances - paid));
    },

    collectedInMonth(entries) {
      if (!Array.isArray(entries)) return 0;
      return entries.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    },

    cycleBounds(joinDate, todayStr) {
      const today = parseYmd(todayStr);
      if (!today.y || !today.m || !today.d) {
        return { start: todayStr, end: todayStr };
      }
      const join = parseYmd(joinDate);
      if (!join.y || !join.m || !join.d) {
        return {
          start: formatYmd(today.y, today.m, 1),
          end: formatYmd(today.y, today.m, lastDayOfMonth(today.y, today.m))
        };
      }

      const thisMonthDay = clampDay(today.y, today.m, join.d);
      let startY = today.y;
      let startM = today.m;
      let startD = thisMonthDay;
      if (today.d < thisMonthDay) {
        const prev = addMonths(today.y, today.m, -1);
        startY = prev.y;
        startM = prev.m;
        startD = clampDay(prev.y, prev.m, join.d);
      }
      const next = addMonths(startY, startM, 1);
      const nextStartD = clampDay(next.y, next.m, join.d);
      const endDate = new Date(next.y, next.m - 1, nextStartD);
      endDate.setDate(endDate.getDate() - 1);
      return {
        start: formatYmd(startY, startM, startD),
        end: formatYmd(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate())
      };
    },

    cycleKey(start) {
      return String(start || '').slice(0, 7);
    },

    nextCycleKey(start) {
      const parsed = parseYmd(start);
      if (!parsed.y || !parsed.m) return String(start || '').slice(0, 7);
      const next = addMonths(parsed.y, parsed.m, 1);
      return `${next.y}-${pad2(next.m)}`;
    },

    summarizeEntries(entries) {
      const list = Array.isArray(entries) ? entries : [];
      let advances = 0;
      let salaryPaid = 0;
      for (const row of list) {
        const amount = Number(row.amount) || 0;
        if (row.type === 'advance') advances += amount;
        else if (row.type === 'salary') salaryPaid += amount;
      }
      return { advances, salaryPaid, collected: advances + salaryPaid };
    },

    advanceMonthKey({ monthlySalary, advances, salaryPaid, currentKey, nextKey }) {
      const remaining = this.remainingForCycle(monthlySalary, advances, salaryPaid);
      if (remaining <= 0) return nextKey;
      return currentKey;
    }
  };

  return { StaffSalary };
}));
