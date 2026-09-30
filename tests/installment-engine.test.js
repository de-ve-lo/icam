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

describe('applyPayment', () => {
  it('scenario 2: partial on current #1', () => {
    const paid = InstallmentEngine.applyPayment(fourBy10k(), {
      installmentId: 1, amount: 4000, paymentDate: '2026-01-01',
      customerId: 9, purchaseId: 1, receiptNo: 'R1'
    });
    assert.equal(paid.rows[0].paid_amount, 4000);
    assert.equal(paid.rows[0].status, 'partial');
    assert.equal(paid.grandRemaining, 36000);
    assert.equal(paid.ledger[0].customer_id, 9);
    assert.equal(paid.ledger[0].type, 'payment');
  });

  it('scenario 3: partial then overdue shifts leftover 6000', () => {
    const afterPay = InstallmentEngine.applyPayment(fourBy10k(), {
      installmentId: 1, amount: 4000, paymentDate: '2026-01-01',
      customerId: 9, purchaseId: 1, receiptNo: 'R1'
    });
    const { rows, grandRemaining } = InstallmentEngine.reconcile(afterPay.rows, '2026-01-15');
    assert.equal(rows[0].status, 'short');
    assert.equal(rows[0].paid_amount, 4000);
    assert.equal(rows[1].amount, 16000);
    assert.equal(grandRemaining, 36000);
  });

  it('scenario 5: overpay 25000 on doubled #2', () => {
    const shifted = InstallmentEngine.reconcile(fourBy10k(), '2026-01-15').rows;
    const paid = InstallmentEngine.applyPayment(shifted, {
      installmentId: 2, amount: 25000, paymentDate: '2026-01-20',
      customerId: 9, purchaseId: 1, receiptNo: 'R2'
    });
    assert.equal(paid.grandRemaining, 15000);
    assert.equal(paid.rows[1].status, 'paid');
    assert.ok(paid.rows[2].paid_amount >= 5000);
  });

  it('overpay past last row creates credit', () => {
    const lastOnly = [{
      id: 1, purchase_id: 1, installment_no: 1, due_date: '2026-06-01',
      original_amount: 10000, paid_amount: 0, amount: 10000,
      remaining_balance: 10000, status: 'upcoming'
    }];
    const paid = InstallmentEngine.applyPayment(lastOnly, {
      installmentId: 1, amount: 12000, paymentDate: '2026-06-01',
      customerId: 9, purchaseId: 1, receiptNo: 'R3'
    });
    assert.equal(paid.grandRemaining, 0);
    assert.equal(paid.credit, 2000);
  });
});

describe('payRemaining, void, setPaidAmount', () => {
  it('scenario 8: pay remaining 15000 no discount', () => {
    const r = InstallmentEngine.payRemaining(fourBy10k(), {
      amount: 15000, markAsDiscount: false, paymentDate: '2026-01-20',
      customerId: 9, purchaseId: 1, receiptNo: 'R4'
    });
    assert.equal(r.grandRemaining, 25000);
    assert.equal(r.purchaseStatus, 'active');
    assert.ok(r.ledger.every((l) => l.type === 'payment'));
  });

  it('scenario 9: pay 10000 plus discount closes account', () => {
    const r = InstallmentEngine.payRemaining(fourBy10k(), {
      amount: 10000, markAsDiscount: true, paymentDate: '2026-01-20',
      customerId: 9, purchaseId: 1, receiptNo: 'R5'
    });
    assert.equal(r.grandRemaining, 0);
    assert.equal(r.discountAmount, 30000);
    assert.equal(r.purchaseStatus, 'completed');
    assert.ok(r.rows.every((row) => row.status === 'settled'));
    assert.ok(r.ledger.some((l) => l.type === 'discount' && l.amount === 30000));
  });

  it('scenario 10: void last payment restores grand', () => {
    const paid = InstallmentEngine.applyPayment(fourBy10k(), {
      installmentId: 1, amount: 4000, paymentDate: '2026-01-01',
      customerId: 9, purchaseId: 1, receiptNo: 'R1'
    });
    const voided = InstallmentEngine.voidLastPayment(paid.rows, paid.ledger, 1);
    assert.equal(voided.grandRemaining, 40000);
    assert.equal(voided.rows[0].paid_amount, 0);
  });

  it('scenario 11: setPaidAmount down does not call applyPayment with negative', () => {
    const paid = InstallmentEngine.applyPayment(fourBy10k(), {
      installmentId: 1, amount: 4000, paymentDate: '2026-01-01',
      customerId: 9, purchaseId: 1, receiptNo: 'R1'
    });
    const edited = InstallmentEngine.setPaidAmount(paid.rows, 1, 1000);
    const rec = InstallmentEngine.reconcile(edited, '2026-01-01');
    assert.equal(rec.rows[0].paid_amount, 1000);
    assert.equal(rec.grandRemaining, 39000);
  });
});
