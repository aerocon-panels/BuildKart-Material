import { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, LockKeyhole, RefreshCw, Share2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createCheckoutOrder, createPaymentIntent, loadPaymentOrder, loadPaymentStatus, markPaymentProcessing } from '../api.js';
import { money } from '../data.js';
import { calculatePaymentAmounts, createPaymentLink, createUpiPaymentUri } from '../paymentCalculations.js';

const PAYMENT_TYPES = ['FullPayment', 'Advance'];
const PAYMENT_STATUS_LABELS = {
  Pending: 'Pending',
  Processing: 'Processing',
  Paid: 'Paid',
  Failed: 'Failed',
};

function appPaymentLink(scheme, upiUri) {
  return `${scheme}${upiUri.slice(upiUri.indexOf('?') + 1)}`;
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
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [checkoutCustomer, setCheckoutCustomer] = useState(customerDetails);
  const [order, setOrder] = useState(null);
  const [previewActive, setPreviewActive] = useState(
    !initialOrderNumber && (initialPreviewAmount > 0 || initialPreviewTotal > 0 || cartTotal > 0),
  );
  const [previewTotal, setPreviewTotal] = useState(
    initialPreviewTotal > 0
      ? initialPreviewTotal
      : initialPreviewAmount > 0
        ? initialPaymentType === 'Advance' ? initialPreviewAmount / 0.2 : initialPreviewAmount
        : cartTotal,
  );
  const [sharedPreview, setSharedPreview] = useState(initialPreviewAmount > 0 || initialPreviewTotal > 0);
  const [paymentType, setPaymentType] = useState(PAYMENT_TYPES.includes(initialPaymentType) ? initialPaymentType : 'FullPayment');
  const [payment, setPayment] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [checkoutOrderCreated, setCheckoutOrderCreated] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const isPreview = previewActive && !order;
  const previewOrderTotal = sharedPreview ? previewTotal : cartTotal;
  const activeOrder = order || (isPreview ? {
    orderNumber: '',
    total: previewOrderTotal,
    paidAmount: 0,
    amountDue: previewOrderTotal,
  } : null);
  const paymentAmounts = activeOrder ? calculatePaymentAmounts(activeOrder.total, activeOrder.amountDue) : null;
  const advanceAmount = paymentAmounts?.advancePayment || 0;
  const paymentAmount = activeOrder
    ? paymentType === 'Advance' ? advanceAmount : paymentAmounts.fullPayment
    : 0;
  const remainingAfterAdvance = paymentAmounts?.remainingAfterAdvance || 0;
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
  const shareUrl = activeOrder
    ? createPaymentLink({
      baseUrl: window.location.href,
      paymentType,
      amount: paymentAmount,
      total: activeOrder.total,
      orderNumber: activeOrder.orderNumber,
      isPreview,
    })
    : '';
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
    setLinkCopied(false);
  }

  async function createOrderFromCart(event) {
    event.preventDefault();
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
      setCheckoutOrderCreated(true);
      setNotice('Order created from current database prices. Review the total before paying.');
    } catch (requestError) {
      setError(requestError.message || 'The order could not be created.');
    } finally {
      setCreatingOrder(false);
    }
  }

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
      if (PAYMENT_TYPES.includes(type)) setPaymentType(type);
      const linkedAmount = isSharedOrder ? Number(new URLSearchParams(window.location.search).get('amount')) : 0;
      const selectedAmount = type === 'Advance'
        ? Math.round(result.total * 20) / 100
        : result.amountDue;
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

  async function copyPaymentLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setNotice('Payment link copied.');
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch (copyError) {
      console.error('Unable to copy the payment link.', copyError);
      setError('Clipboard access is unavailable. Select and copy the payment link below.');
    }
  }

  async function sharePaymentLink() {
    if (!shareUrl) return;
    if (!navigator.share) {
      await copyPaymentLink();
      return;
    }
    try {
      await navigator.share({ title: 'BuildKart payment link', url: shareUrl });
    } catch (shareError) {
      if (shareError.name !== 'AbortError') {
        console.error('Unable to share the payment link.', shareError);
        setError('The payment link could not be shared. Use Copy payment link instead.');
      }
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

        {cartTotal > 0 && (
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

        {cart.length > 0 && canCheckout && canCreateOrder && (
          <form className="payment-checkout-form" onSubmit={createOrderFromCart}>
            <h3>Create a real order online</h3>
            <p>The API calculates the final total using current database prices and tax. This creates a real order; payment still requires a separate verified intent.</p>
            <div className="payment-checkout-fields">
              <label>Customer name
                <input required maxLength={150} value={checkoutCustomer.name} onChange={(event) => setCheckoutCustomer({ ...checkoutCustomer, name: event.target.value })} />
              </label>
              <label>Customer phone
                <input required type="tel" maxLength={20} value={checkoutCustomer.phone} onChange={(event) => setCheckoutCustomer({ ...checkoutCustomer, phone: event.target.value })} />
              </label>
              <label>Site address (optional)
                <input maxLength={300} value={checkoutCustomer.address} onChange={(event) => setCheckoutCustomer({ ...checkoutCustomer, address: event.target.value })} />
              </label>
              <label>PIN code (optional)
                <input maxLength={20} value={checkoutCustomer.pin} onChange={(event) => setCheckoutCustomer({ ...checkoutCustomer, pin: event.target.value })} />
              </label>
            </div>
            <button type="submit" className="button button-primary button-wide" disabled={creatingOrder || checkoutOrderCreated}>
              {creatingOrder ? 'Creating server order…' : checkoutOrderCreated ? 'Order created' : 'Create order and view payment options'}
            </button>
          </form>
        )}

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
              <button
                type="button"
                className={`payment-option ${paymentType === 'Advance' ? 'is-selected' : ''}`}
                onClick={() => selectPaymentType('Advance')}
                disabled={!isPreview && Boolean(payment && ['Pending', 'Processing'].includes(payment.status))}
              >
                <span className="payment-radio" />
                <span><strong>20% Advance Token</strong><small>Remaining after advance: {money(remainingAfterAdvance)}</small></span>
                <b>{money(advanceAmount)}</b>
              </button>
            </div>

            <div className="payment-methods">
              <h3>UPI Payment</h3>
              <div className="upi-brand-list"><span>Google Pay</span><span>PhonePe</span><span>Paytm</span></div>
              <p className="upi-address">UPI ID <strong>{upi || 'Not configured'}</strong></p>
              {isPreview && upiIdValid && (
                <div className="payment-qr-section">
                  <div className="payment-qr"><QRCodeSVG value={upiUri} size={180} level="M" includeMargin /></div>
                  <div className="payment-qr-details">
                    <strong>{money(paymentAmount)}</strong>
                    <span>{paymentType === 'Advance' ? '20% advance' : 'Full cart amount'} · preview only</span>
                    <span className="payment-status">Preview only · not submitted</span>
                  </div>
                  <div className="upi-app-actions">
                    <button type="button" className="button button-soft" onClick={() => openPaymentApp('tez://upi/pay?')}>Google Pay</button>
                    <button type="button" className="button button-soft" onClick={() => openPaymentApp('phonepe://pay?')}>PhonePe</button>
                    <button type="button" className="button button-soft" onClick={() => openPaymentApp('paytmmp://pay?')}>Paytm</button>
                  </div>
                </div>
              )}
              {isPreview && !upiIdValid && (
                <p className="payment-message payment-error" role="alert">Set a valid UPI ID in store settings to preview the QR code.</p>
              )}
              {!isPreview && !payment && (
                <button type="button" className="button button-primary button-wide" onClick={createUpiPayment} disabled={creatingPayment || paymentAmount <= 0 || paymentAmount > order.amountDue || !upiIdValid}>
                  {creatingPayment ? 'Preparing secure request…' : `Generate ${paymentType === 'Advance' ? 'advance' : 'full payment'} QR`}
                </button>
              )}
              {!isPreview && payment && (
                <div className="payment-qr-section">
                  <div className="payment-qr"><QRCodeSVG value={upiUri} size={180} level="M" includeMargin /></div>
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
                      <button type="button" className="button button-soft" onClick={() => openPaymentApp('tez://upi/pay?')}>Google Pay</button>
                      <button type="button" className="button button-soft" onClick={() => openPaymentApp('phonepe://pay?')}>PhonePe</button>
                      <button type="button" className="button button-soft" onClick={() => openPaymentApp('paytmmp://pay?')}>Paytm</button>
                    </div>
                  )}
                </div>
              )}
              <p className="payment-verification-note">{isPreview
                ? 'Preview only: this QR and app link are not connected to an order or payment intent. Opening a UPI app may initiate a real transfer; BuildKart cannot verify or record it.'
                : 'UPI/app handoff does not confirm payment. The order is marked Paid only after trusted server-side verification.'}</p>
            </div>

            <div className="payment-methods card-gateway">
              <div><h3>Card / Net Banking</h3><span className="gateway-unavailable">Not configured</span></div>
              <p>Live online gateway payments are unavailable because merchant credentials are not configured.</p>
              <button type="button" className="button button-outline button-wide" disabled>
                <ExternalLink size={15} /> Proceed to Card / NetBanking Gateway
              </button>
            </div>

            <div className="payment-link-section">
              <label htmlFor="payment-share-link">Payment link · {money(paymentAmount)} · {paymentType === 'Advance' ? 'Advance' : 'Full Payment'}{isPreview ? ' · Preview only' : ''}</label>
              <input id="payment-share-link" readOnly value={shareUrl} onFocus={(event) => event.target.select()} />
              <div className="payment-link-actions">
                <button type="button" className="button button-outline button-small" onClick={copyPaymentLink}><Copy size={14} /> {linkCopied ? 'Copied' : 'Copy payment link'}</button>
                <button type="button" className="button button-outline button-small" onClick={sharePaymentLink}><Share2 size={14} /> Share</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
