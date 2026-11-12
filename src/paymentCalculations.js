function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePaymentAmounts(total, amountDue = total) {
  const totalAmount = Math.max(0, roundCurrency(Number(total) || 0));
  const dueAmount = Math.min(totalAmount, Math.max(0, roundCurrency(Number(amountDue) || 0)));
  const advanceAmount = roundCurrency(totalAmount * 0.2);

  return {
    fullPayment: dueAmount,
    advancePayment: advanceAmount,
    remainingAfterAdvance: Math.max(0, roundCurrency(dueAmount - advanceAmount)),
  };
}

export function createUpiPaymentUri({
  upi,
  storeName,
  amount,
  paymentType,
  orderNumber,
  transactionReference,
  isPreview,
}) {
  const params = new URLSearchParams({
    pa: upi,
    pn: storeName,
    am: roundCurrency(amount).toFixed(2),
    cu: 'INR',
    tn: isPreview
      ? `BuildKart ${paymentType === 'Advance' ? 'advance' : 'full payment'} preview`
      : `BuildKart order ${orderNumber}`,
  });
  if (!isPreview && transactionReference) params.set('tr', transactionReference);
  return `upi://pay?${params.toString()}`;
}

export function createPaymentLink({ baseUrl, paymentType, amount, total, orderNumber, isPreview }) {
  const url = new URL(baseUrl);
  for (const parameter of ['payOrder', 'paymentType', 'amount', 'paymentPreview', 'previewTotal']) {
    url.searchParams.delete(parameter);
  }
  url.searchParams.set('paymentType', paymentType);
  url.searchParams.set('amount', roundCurrency(amount).toFixed(2));
  if (isPreview) {
    url.searchParams.set('paymentPreview', 'true');
    url.searchParams.set('previewTotal', roundCurrency(total).toFixed(2));
  } else {
    url.searchParams.set('payOrder', orderNumber);
  }
  return url.toString();
}
