const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ReportsManager } = require('../src/renderer/scripts/reports.js');

describe('sumPaymentsInRange', () => {
  it('February collection is 5000 not 10000 when two payments on same installment', () => {
    const payments = [
      { amount: 5000, payment_date: '2026-01-10', type: 'payment' },
      { amount: 5000, payment_date: '2026-02-10', type: 'payment' }
    ];
    assert.equal(ReportsManager.sumPaymentsInRange(payments, '2026-02-01', '2026-02-28'), 5000);
  });
});
