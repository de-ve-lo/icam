const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { InstallmentEngine } = require('../src/renderer/scripts/installment-engine.js');

describe('createSchedule', () => {
  it('puts remainder on last installment for 100000 / 7', () => {
    const { schedule, summary } = InstallmentEngine.createSchedule({
      salePrice: 100000, purchasePrice: 80000, profitPercentage: 0,
      advancePayment: 0, installmentMonths: 7, startDate: '2026-01-01'
    });
    assert.equal(schedule.length, 7);
    for (let i = 0; i < 6; i++) assert.equal(schedule[i].original_amount, 14285);
    assert.equal(schedule[6].original_amount, 14290);
    const sum = schedule.reduce((s, r) => s + r.original_amount, 0);
    assert.equal(sum, 100000);
    assert.equal(summary.totalAmount, 100000);
  });

  it('computes profit as percent of principal after advance', () => {
    const { summary, schedule } = InstallmentEngine.createSchedule({
      salePrice: 100000, purchasePrice: 50000, profitPercentage: 10,
      advancePayment: 20000, installmentMonths: 12, startDate: '2026-01-01'
    });
    assert.equal(summary.profitAmount, 8000);
    assert.equal(summary.totalAmount, 88000);
    const sum = schedule.reduce((s, r) => s + r.original_amount, 0);
    assert.equal(sum, 88000);
  });
});

function fourBy10k() {
  return [1, 2, 3, 4].map((n) => ({
    id: n, purchase_id: 1, installment_no: n,
    due_date: `2026-0${n}-01`, original_amount: 10000, paid_amount: 0,
    amount: 10000, remaining_balance: 10000, status: 'upcoming'
  }));
}

describe('reconcile', () => {
  it('scenario 1: first overdue unpaid shifts 10k to #2', () => {
    const { rows, grandRemaining } = InstallmentEngine.reconcile(fourBy10k(), '2026-01-15');
    assert.equal(rows[0].status, 'short');
    assert.equal(rows[0].amount, 0);
    assert.equal(rows[0].remaining_balance, 0);
    assert.equal(rows[1].amount, 20000);
    assert.equal(rows[1].remaining_balance, 20000);
    assert.equal(grandRemaining, 40000);
    assert.equal(rows[0].original_amount, 10000);
  });

  it('scenario 6: two overdue unpaid triples #3', () => {
    const { rows, grandRemaining } = InstallmentEngine.reconcile(fourBy10k(), '2026-02-15');
    assert.equal(rows[0].status, 'short');
    assert.equal(rows[1].status, 'short');
    assert.equal(rows[2].amount, 30000);
    assert.equal(grandRemaining, 40000);
  });

  it('scenario 7: all overdue, grand remains 40000', () => {
    const { rows, grandRemaining } = InstallmentEngine.reconcile(fourBy10k(), '2026-05-01');
    assert.ok(rows.every((r) => r.status === 'short'));
    assert.ok(rows.every((r) => r.remaining_balance === 0));
    assert.equal(grandRemaining, 40000);
  });

  it('never changes original_amount', () => {
    const { rows } = InstallmentEngine.reconcile(fourBy10k(), '2026-02-15');
    assert.ok(rows.every((r) => r.original_amount === 10000));
  });
});
