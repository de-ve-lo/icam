(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exported = factory();
    root.stockLedgerAmount = exported.stockLedgerAmount;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  function stockLedgerAmount(stockPurchasePrice, productPurchasePrice, quantity) {
    const unit = (stockPurchasePrice != null && stockPurchasePrice !== '' && !isNaN(Number(stockPurchasePrice)))
      ? Number(stockPurchasePrice) : Number(productPurchasePrice) || 0;
    return unit * (Number(quantity) || 1);
  }
  return { stockLedgerAmount };
}));
