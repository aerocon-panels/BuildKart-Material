import { useEffect, useMemo, useRef, useState } from 'react';
import { LockKeyhole, RefreshCw, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createCheckoutOrder, createPaymentIntent, loadPaymentOrder, loadPaymentStatus, markPaymentProcessing } from '../api.js';
import { money } from '../data.js';
import { calculatePaymentAmounts, createUpiPaymentUri } from '../paymentCalculations.js';

const PAYMENT_STATUS_LABELS = {
  Pending: 'Pending',
  Processing: 'Processing',
  Paid: 'Paid',
  Failed: 'Failed',
};

function appPaymentLink(scheme, upiUri) {
  return `${scheme}${upiUri.slice(upiUri.indexOf('?') + 1)}`;
}

function GooglePayMark() {
  return (
    <svg className="google-pay-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.5 12.2c0-.7-.1-1.4-.2-2H12v3.7h5.3a4.5 4.5 0 0 1-2 3v2.6h3.2c1.9-1.7 3-4.3 3-7.3Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.5-2.5l-3.2-2.6c-.9.6-2.1 1-3.3 1-2.5 0-4.7-1.7-5.5-4.1H3.2v2.6A10.1 10.1 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 13.8a6 6 0 0 1 0-3.8V7.4H3.2a10 10 0 0 0 0 9.2l3.3-2.8Z" />
      <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.9 9.9 0 0 0 12 2a10.1 10.1 0 0 0-8.8 5.4l3.3 2.6A6 6 0 0 1 12 6.1Z" />
    </svg>
  );
}

function PhonePeMark() {
  return (
    <svg className="phonepe-mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#5F259F" />
      <text x="12" y="16.5" fill="#fff" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700">पे</text>
    </svg>
  );
}

function PaytmMark() {
  return (
    <svg className="paytm-mark" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="5" width="22" height="14" rx="2" fill="#fff" />
      <text x="12" y="16" fill="#002970" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="8.5" fontWeight="900">paytm</text>
      <path d="M12 5h11v4h-11z" fill="#00BAF2" />
      <text x="17.5" y="8.3" fill="#fff" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="4.5" fontWeight="900">pay</text>
    </svg>
  );
}

export default function PaymentDialog({
  onClose,
  upi,
  storeName,
  phone,
  initialOrderNumber,
  initialPaymentType,
  initialPreviewAmount,
  initialPreviewTotal,
  cart,
  cartTotal,
  customerDetails,
  canCheckout,
}) {
  const isExplicitPreview = initialPreviewAmount > 0 || initialPreviewTotal > 0;
  const initialCustomerDetailsAreValid = useRef(
    Boolean(customerDetails.name.trim())
      && /^\+?[0-9\s()-]{7,20}$/.test(customerDetails.phone.trim()),
  );
  const autoCreateAttempted = useRef(false);
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [checkoutCustomer, setCheckoutCustomer] = useState(customerDetails);
  const [order, setOrder] = useState(null);
  const [previewActive, setPreviewActive] = useState(!initialOrderNumber && isExplicitPreview);
  const [previewTotal, setPreviewTotal] = useState(
    initialPreviewTotal > 0
      ? initialPreviewTotal
      : initialPreviewAmount > 0
        ? initialPreviewAmount
        : cartTotal,
  );
  const [sharedPreview, setSharedPreview] = useState(initialPreviewAmount > 0 || initialPreviewTotal > 0);
  const [paymentType, setPaymentType] = useState('FullPayment');
  const [payment, setPayment] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isPreview = previewActive && !order;
  const previewOrderTotal = sharedPreview ? previewTotal : cartTotal;
  const activeOrder = order || (isPreview ? {
    orderNumber: '',
    total: previewOrderTotal,
    paidAmount: 0,
    amountDue: previewOrderTotal,
  } : null);
  const paymentAmounts = activeOrder ? calculatePaymentAmounts(activeOrder.total, activeOrder.amountDue) : null;
  const paymentAmount = activeOrder ? paymentAmounts.fullPayment : 0;
  const upiIdValid = /^[\w.-]+@[\w.-]+$/.test(upi || '');
  const upiUri = useMemo(() => (
    activeOrder && upiIdValid && (isPreview || payment)
      ? createUpiPaymentUri({
        upi,
        storeName,
        amount: isPreview ? paymentAmount : payment.amount,
        paymentType,
        orderNumber: isPreview ? '' : payment.orderNumber,
        transactionReference: isPreview ? '' : payment.transactionReference,
        isPreview,
      })
      : ''
  ), [activeOrder, upiIdValid, upi, storeName, isPreview, payment, paymentAmount, paymentType]);
  const canCreateOrder = cart.length > 0 &&
    cart.every(({ product }) => Number.isSafeInteger(Number(product.id)) && Number(product.id) > 0);

  function previewCartPayment() {
    setOrder(null);
    setPayment(null);
    setPreviewTotal(cartTotal);
    setSharedPreview(false);
    setPreviewActive(cartTotal > 0);
    setPaymentType('FullPayment');
    setError('');
    setNotice('Payment preview only. No order or payment has been created.');
  }

  function selectPaymentType(type) {
    setPaymentType(type);
    setPayment(null);
    setError('');
    setNotice('');
  }

  async function createOrderFromCart(event) {
    event?.preventDefault();
    if (!canCheckout || !canCreateOrder) {
      setError('Use the live product catalogue and database-backed cart to create an online order.');
      return;
    }

    setCreatingOrder(true);
    setError('');
    setNotice('');
    setOrder(null);
    setPayment(null);
    setPreviewActive(false);
    setSharedPreview(false);
    try {
      const result = await createCheckoutOrder({
        customerName: checkoutCustomer.name.trim(),
        customerPhone: checkoutCustomer.phone.trim(),
        siteAddress: checkoutCustomer.address.trim() || null,
        postalCode: checkoutCustomer.pin.trim() || null,
        items: cart.map(({ product, quantity }) => ({
          productId: Number(product.id),
          quantity,
        })),
      });
      setOrderNumber(result.orderNumber);
      setOrder(result);
      setPreviewActive(false);
      setSharedPreview(false);
      setPaymentType('FullPayment');
      setNotice('Order created from current database prices. Review the total before paying.');
    } catch (requestError) {
      setError(requestError.message || 'The order could not be created.');
    } finally {
      setCreatingOrder(false);
    }
  }

  useEffect(() => {
    if (
      !initialCustomerDetailsAreValid.current
      || !canCheckout
      || !canCreateOrder
      || initialOrderNumber
      || isExplicitPreview
      || autoCreateAttempted.current
    ) return;
    autoCreateAttempted.current = true;
    void createOrderFromCart();
  }, [canCheckout, canCreateOrder, initialOrderNumber, isExplicitPreview]);

  async function findOrder(event, requestedOrderNumber = orderNumber) {
    event?.preventDefault();
    const normalized = requestedOrderNumber.trim().toUpperCase();
    if (!normalized || !/^[A-Z0-9-]{3,20}$/.test(normalized)) {
      setError('Enter a valid order ID, such as BK-500285.');
      return;
    }

    setLoadingOrder(true);
    setError('');
    setNotice('');
    setPreviewActive(false);
    setSharedPreview(false);
    setOrder(null);
    setPayment(null);
    try {
      const result = await loadPaymentOrder(normalized);
      setOrderNumber(result.orderNumber);
      setOrder(result);
      const sharedOrderNumber = new URLSearchParams(window.location.search).get('payOrder');
      const isSharedOrder = sharedOrderNumber?.toUpperCase() === normalized;
      const type = isSharedOrder ? new URLSearchParams(window.location.search).get('paymentType') : null;
      if (type === 'FullPayment') setPaymentType(type);
      const linkedAmount = isSharedOrder ? Number(new URLSearchParams(window.location.search).get('amount')) : 0;
      const selectedAmount = result.amountDue;
      if (Number.isFinite(linkedAmount) && linkedAmount > 0 && Math.abs(linkedAmount - selectedAmount) >= 0.01) {
        setNotice('The linked amount was recalculated from the current order balance.');
      }
    } catch (requestError) {
      setOrder(null);
      setError(requestError.message || 'The order could not be loaded. Please try again.');
    } finally {
      setLoadingOrder(false);
    }
  }

  useEffect(() => {
    if (initialOrderNumber) {
      findOrder(null, initialOrderNumber);
    }
  }, [initialOrderNumber]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function createUpiPayment() {
    if (!order || !upiIdValid) {
      setError(upiIdValid ? 'Load a valid order before creating a payment.' : 'Set a valid UPI ID in store settings before generating a QR code.');
      return;
    }
    if (paymentAmount <= 0) {
      setError('There is no payment balance due for this order.');
      return;
    }

    setCreatingPayment(true);
    setError('');
    setNotice('');
    try {
      const result = await createPaymentIntent(order.orderNumber, paymentType);
      setPayment(result);
      setNotice('Payment request created. Payment remains unconfirmed until the server verifies it.');
    } catch (requestError) {
      setError(requestError.message || 'The payment request could not be created.');
    } finally {
      setCreatingPayment(false);
    }
  }

  async function openPaymentApp(scheme) {
    if (!upiUri || !upiIdValid) return;
    if (isPreview) {
      setNotice('Payment preview only. UPI will open with the preview amount; BuildKart cannot verify or record this payment.');
      window.location.assign(appPaymentLink(scheme, upiUri));
      return;
    }
    if (!payment) return;
    setError('');
    try {
      const updated = await markPaymentProcessing(payment.id);
      setPayment(updated);
      window.location.assign(appPaymentLink(scheme, upiUri));
    } catch (requestError) {
      setError(requestError.message || 'The payment could not be opened.');
    }
  }

  async function refreshStatus() {
    if (!payment) return;
    setRefreshingStatus(true);
    setError('');
    try {
      const result = await loadPaymentStatus(payment.id);
      setPayment(result);
      if (result.status === 'Paid') {
        setOrder(await loadPaymentOrder(result.orderNumber));
      }
    } catch (requestError) {
      setError(requestError.message || 'Payment status could not be refreshed.');
    } finally {
      setRefreshingStatus(false);
    }
  }

  return (
    <div className="modal-backdrop payment-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="payment-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <div className="payment-heading">
          <div>
            <span className="payment-secure-label"><LockKeyhole size={14} /> SECURE CHECKOUT</span>
            <h2 id="payment-title">Secure Payment Portal</h2>
          </div>
          <button type="button" className="quiet-button" aria-label="Close payment portal" onClick={onClose}><X size={20} /></button>
        </div>
        <p className="payment-intro">Payment preview is available without a database. Live order payments require a backend-created order and verified payment intent.</p>

        {cartTotal > 0 && !order && (
          <div className="payment-preview-launch">
            <div>
              <strong>Cart amount preview</strong>
              <span>{money(cartTotal)} · {cart.length} material{cart.length === 1 ? '' : 's'}</span>
            </div>
            <button type="button" className="button button-outline button-small" onClick={previewCartPayment}>
              Preview cart payment
            </button>
          </div>
        )}

        {cart.length > 0 && canCheckout && canCreateOrder && !order && (
          <form className="payment-checkout-form" onSubmit={createOrderFromCart}>
            <h3>Create a real order online</h3>
            <p>The API calculates the final total using current database prices and tax. This creates a real order; payment still requires a separate verified intent.</p>
            <div className="payment-checkout-fields">
              <label>Customer name
                <input required maxLength={150} value={checkoutCustomer.name} onChange={(event) => setCheckoutCustomer({ ...checkoutCustomer, name: event.target.value })} />
              </label>
              <label>Customer phone
                <input required type="tel" maxLength={20} pattern="\+?[0-9\s()-]{7,20}" value={checkoutCustomer.phone} onChange={(event) => setCheckoutCustomer({ ...checkoutCustomer, phone: event.target.value })} />
              </label>
              <label>Site address (optional)
                <input maxLength={300} value={checkoutCustomer.address} onChange={(event) => setCheckoutCustomer({ ...checkoutCustomer, address: event.target.value })} />
              </label>
              <label>PIN code (optional)
                <input maxLength={20} value={checkoutCustomer.pin} onChange={(event) => setCheckoutCustomer({ ...checkoutCustomer, pin: event.target.value })} />
              </label>
            </div>
            <button type="submit" className="button button-primary button-wide" disabled={creatingOrder}>
              {creatingOrder ? 'Creating server order…' : 'Create order and view payment options'}
            </button>
          </form>
        )}

        {(initialOrderNumber || isExplicitPreview) && (
          <form className="payment-order-lookup" onSubmit={(event) => findOrder(event)}>
            <label htmlFor="payment-order-number">Order ID</label>
            <div className="payment-order-field">
              <input
                id="payment-order-number"
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value.toUpperCase())}
                placeholder="Example: BK-500285"
                autoComplete="off"
                maxLength={20}
                required
              />
              <button type="submit" className="button button-outline" disabled={loadingOrder}>
                {loadingOrder ? 'Checking…' : 'Find order'}
              </button>
            </div>
          </form>
        )}

        {!initialOrderNumber && !isExplicitPreview && cart.length > 0 && (!canCheckout || !canCreateOrder) && (
          <p className="payment-message payment-error" role="alert">
            {canCheckout
              ? 'A saved order requires active database products in your cart. No order has been created.'
              : 'A saved order requires the live checkout service. No order has been created; you can choose the clearly marked preview instead.'}
          </p>
        )}

        {error && <p className="payment-message payment-error" role="alert">{error}</p>}
        {notice && <p className="payment-message" role="status">{notice}</p>}

        {activeOrder && (
          <>
            <div className="payment-order-summary">
              <div><span>{isPreview ? 'Preview status' : 'Order ID'}</span><strong>{isPreview ? 'UI preview only · No order created' : order.orderNumber}</strong></div>
              <div><span>{isPreview ? 'Cart amount (not verified)' : 'Total order amount'}</span><strong>{money(activeOrder.total)}</strong></div>
              {!isPreview && order.paidAmount > 0 && <div><span>Paid so far</span><strong>{money(order.paidAmount)}</strong></div>}
              <div><span>Contact / dispatch hub</span><strong>{phone || 'Contact store'}</strong></div>
            </div>

            <div className="payment-options" role="group" aria-label="Choose a payment amount">
              <button
                type="button"
                className={`payment-option ${paymentType === 'FullPayment' ? 'is-selected' : ''}`}
                onClick={() => selectPaymentType('FullPayment')}
                disabled={!isPreview && Boolean(payment && ['Pending', 'Processing'].includes(payment.status))}
              >
                <span className="payment-radio" />
                <span><strong>100% Full Payment</strong><small>{isPreview ? 'Full cart amount · preview only' : 'Pay the outstanding order balance'}</small></span>
                <b>{money(activeOrder.amountDue)}</b>
              </button>
            </div>

            <div className="payment-methods">
              <h3>UPI Payment</h3>
              <div className="upi-brand-list">
                <span className="upi-brand-google"><GooglePayMark /> Google Pay</span>
                <span className="upi-brand-phonepe"><PhonePeMark /> PhonePe</span>
                <span className="upi-brand-paytm"><PaytmMark /> Paytm</span>
              </div>
              <p className="upi-address">UPI ID <strong>{upi || 'Not configured'}</strong></p>
              {isPreview && upiIdValid && (
                <div className="payment-qr-section">
                  <div className="payment-qr"><QRCodeSVG value={upiUri} size={150} level="M" includeMargin /></div>
                  <div className="payment-qr-details">
                    <strong>{money(paymentAmount)}</strong>
                    <span>Full cart amount · preview only</span>
                    <span className="payment-status">Preview only · not submitted</span>
                  </div>
                  <div className="upi-app-actions">
                    <button type="button" className="button upi-app-google" onClick={() => openPaymentApp('tez://upi/pay?')}><GooglePayMark /> Google Pay</button>
                    <button type="button" className="button upi-app-phonepe" onClick={() => openPaymentApp('phonepe://pay?')}><PhonePeMark /> PhonePe</button>
                    <button type="button" className="button upi-app-paytm" onClick={() => openPaymentApp('paytmmp://pay?')}><PaytmMark /> Paytm</button>
                  </div>
                </div>
              )}
              {isPreview && !upiIdValid && (
                <p className="payment-message payment-error" role="alert">Set a valid UPI ID in store settings to preview the QR code.</p>
              )}
              {!isPreview && !payment && (
                <button type="button" className="button button-primary button-wide" onClick={createUpiPayment} disabled={creatingPayment || paymentAmount <= 0 || paymentAmount > order.amountDue || !upiIdValid}>
                  {creatingPayment ? 'Preparing secure request…' : 'Generate full payment QR'}
                </button>
              )}
              {!isPreview && payment && (
                <div className="payment-qr-section">
                  <div className="payment-qr"><QRCodeSVG value={upiUri} size={150} level="M" includeMargin /></div>
                  <div className="payment-qr-details">
                    <strong>{money(payment.amount)}</strong>
                    <span>Reference: {payment.transactionReference}</span>
                    <span className={`payment-status status-${payment.status.toLowerCase()}`}>Status: {PAYMENT_STATUS_LABELS[payment.status] || payment.status}</span>
                    <button type="button" className="button button-outline button-small" onClick={refreshStatus} disabled={refreshingStatus}>
                      <RefreshCw size={14} /> {refreshingStatus ? 'Refreshing…' : 'Refresh status'}
                    </button>
                  </div>
                  {payment.status === 'Failed' && (
                    <button type="button" className="button button-outline button-wide" onClick={() => setPayment(null)}>Create a new UPI payment request</button>
                  )}
                  {!['Paid', 'Failed'].includes(payment.status) && (
                    <div className="upi-app-actions">
                      <button type="button" className="button upi-app-google" onClick={() => openPaymentApp('tez://upi/pay?')}><GooglePayMark /> Google Pay</button>
                      <button type="button" className="button upi-app-phonepe" onClick={() => openPaymentApp('phonepe://pay?')}><PhonePeMark /> PhonePe</button>
                      <button type="button" className="button upi-app-paytm" onClick={() => openPaymentApp('paytmmp://pay?')}><PaytmMark /> Paytm</button>
                    </div>
                  )}
                </div>
              )}
              <p className="payment-verification-note">{isPreview
                ? 'Preview only: this QR and app link are not connected to an order or payment intent. Opening a UPI app may initiate a real transfer; BuildKart cannot verify or record it.'
                : 'UPI/app handoff does not confirm payment. The order is marked Paid only after trusted server-side verification.'}</p>
            </div>

          </>
        )}
      </section>
    </div>
  );
}
