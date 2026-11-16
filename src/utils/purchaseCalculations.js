const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculatePurchase(lines, { rateIncludesTax = true, billDiscount = 0, taxableAdjustment = 0 } = {}) {
  const calculatedLines = lines.map((line, index) => {
    const qty = Number(line.qty) || 0;
    const rate = Number(line.rate) || 0;
    const gstRate = Number(line.gst_rate) || 0;
    const gross = qty * rate;
    const discount = rateIncludesTax ? 0 : Math.min(gross, line.discount_type === 'percent'
      ? gross * (Number(line.discount_value) || 0) / 100
      : Number(line.discount_value) || 0);
    const taxable = rateIncludesTax ? gross / (1 + gstRate / 100) : gross - discount + (index === 0 ? Number(taxableAdjustment) || 0 : 0);
    const tax = rateIncludesTax ? gross - taxable : taxable * gstRate / 100;
    return { ...line, discount, taxable, tax, amount: taxable + tax };
  });

  const grossTotal = calculatedLines.reduce((sum, line) => sum + line.qty * line.rate, 0);
  const lineDiscount = calculatedLines.reduce((sum, line) => sum + line.discount, 0);
  const subtotal = roundMoney(calculatedLines.reduce((sum, line) => sum + line.taxable, 0));
  const tax = roundMoney(calculatedLines.reduce((sum, line) => sum + line.tax, 0));
  const discount = rateIncludesTax ? Number(billDiscount) || 0 : lineDiscount;
  return {
    lines: calculatedLines,
    subtotal,
    cgst: roundMoney(tax / 2),
    sgst: roundMoney(tax / 2),
    total: roundMoney(rateIncludesTax ? grossTotal - discount : subtotal + tax),
    grossTotal,
    discount
  };
}
