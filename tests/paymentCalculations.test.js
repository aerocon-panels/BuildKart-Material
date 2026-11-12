import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePaymentAmounts, createPaymentLink, createUpiPaymentUri } from '../src/paymentCalculations.js';

test('full payment uses the outstanding order amount', () => {
  assert.deepEqual(calculatePaymentAmounts(1000), {
    fullPayment: 1000,
    advancePayment: 200,
    remainingAfterAdvance: 800,
  });
  assert.equal(calculatePaymentAmounts(1000, 250).fullPayment, 250);
});

test('advance token is 20 percent rounded to currency precision', () => {
  assert.equal(calculatePaymentAmounts(1299.99).advancePayment, 260);
});

test('remaining balance subtracts the advance without going below zero', () => {
  assert.equal(calculatePaymentAmounts(1500).remainingAfterAdvance, 1200);
  assert.equal(calculatePaymentAmounts(100, 10).remainingAfterAdvance, 0);
});

test('UPI preview URI includes the configured ID and amount without a fake transaction reference', () => {
  const uri = createUpiPaymentUri({
    upi: '8317666756@upi',
    storeName: 'BuildKart',
    amount: 200,
    paymentType: 'Advance',
    isPreview: true,
  });
  const params = new URL(uri).searchParams;
  assert.equal(params.get('pa'), '8317666756@upi');
  assert.equal(params.get('am'), '200.00');
  assert.match(params.get('tn'), /preview/);
  assert.equal(params.has('tr'), false);
});

test('real-order UPI URI preserves the actual payment reference', () => {
  const uri = createUpiPaymentUri({
    upi: '8317666756@upi',
    storeName: 'BuildKart',
    amount: 1000,
    paymentType: 'FullPayment',
    orderNumber: 'BK-500285',
    transactionReference: 'BK-GATEWAY-REF',
    isPreview: false,
  });
  assert.equal(new URL(uri).searchParams.get('tr'), 'BK-GATEWAY-REF');
});

test('preview payment links identify preview totals without inventing an order ID', () => {
  const link = createPaymentLink({
    baseUrl: 'https://buildkart.example/?payOrder=old',
    paymentType: 'Advance',
    amount: 200,
    total: 1000,
    isPreview: true,
  });
  const url = new URL(link);
  assert.equal(url.searchParams.get('paymentPreview'), 'true');
  assert.equal(url.searchParams.get('paymentType'), 'Advance');
  assert.equal(url.searchParams.get('amount'), '200.00');
  assert.equal(url.searchParams.get('previewTotal'), '1000.00');
  assert.equal(url.searchParams.has('payOrder'), false);
});

test('real payment links retain their server order ID without preview flags', () => {
  const link = createPaymentLink({
    baseUrl: 'https://buildkart.example/',
    paymentType: 'FullPayment',
    amount: 1000,
    total: 1000,
    orderNumber: 'BK-500285',
    isPreview: false,
  });
  const url = new URL(link);
  assert.equal(url.searchParams.get('payOrder'), 'BK-500285');
  assert.equal(url.searchParams.get('amount'), '1000.00');
  assert.equal(url.searchParams.has('paymentPreview'), false);
});
