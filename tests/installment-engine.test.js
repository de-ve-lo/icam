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
