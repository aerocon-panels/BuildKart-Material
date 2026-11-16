import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { money } from '../data.js';

function productPriceLabel(product) {
  if (product.priceAvailable === false) return ' · Price on Request';
  return product.thickness
    ? ` · ${money(product.rate * product.coverage)} / piece`
    : ` · ${money(product.rate)} / sq ft`;
}

export default function CartPanel({ cart, onQuantity, onRemove, customer, onCustomer, subtotal, units, discount, gst, total, phone, upi, advance, onAdvance, onWhatsApp, onPdf, onPayment, checkoutMode = false }) {
  const advanceAmount = total * advance / 100;
  const hasPriceOnRequest = cart.some(({ product }) => product.priceAvailable === false);

  return (
    <section className="section cart-section" id="cart">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR PROJECT</span>
          <h2>{checkoutMode ? 'Checkout' : 'Cart & quotation'}</h2>
          <p>{checkoutMode ? 'Review your selected products and confirm any requested prices before payment.' : 'Review your materials and prepare a project quotation.'}</p>
        </div>
        <span className="heading-icon"><ShoppingCart size={23} /></span>
      </div>
      <div className="cart-layout">
        <div className="cart-card">
          {cart.length === 0 ? (
            <div className="empty-cart"><ShoppingCart size={29} /><strong>Your cart is empty</strong><span>Add materials from the catalogue or estimator.</span></div>
          ) : cart.map(({ product, quantity }) => (
            <div className="cart-item" key={product.id}>
              {product.thickness && product.image
                ? <img className="cart-product-image" src={product.image} alt="" />
                : <div className={`cart-swatch ${product.tone || 'stone'}`} aria-hidden="true"><span>BK</span></div>}
              <div className="cart-description">
                <strong>{product.name}</strong>
                <small>
                  {product.thickness ? `Thickness: ${product.thickness} · ` : ''}
                  {product.spec}
                  {productPriceLabel(product)}
                </small>
                <b>{product.priceAvailable === false ? 'Price on Request' : money(quantity * product.coverage * product.rate)}</b>
              </div>
              <div className="quantity-control" aria-label={`Quantity for ${product.name}`}>
                <button type="button" aria-label="Decrease quantity" onClick={() => onQuantity(product.id, -1)}><Minus size={14} /></button>
                <span>{quantity}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => onQuantity(product.id, 1)}><Plus size={14} /></button>
              </div>
              <button type="button" className="quiet-button remove-item" aria-label={`Remove ${product.name}`} onClick={() => onRemove(product.id)}><Trash2 size={17} /></button>
            </div>
          ))}
          {cart.length > 0 && <div className="cart-tier">Wholesale pricing: {units >= 50 ? '10% discount unlocked' : units >= 25 ? '5% discount unlocked' : `${25 - units} more pieces for 5% off`}</div>}
          {hasPriceOnRequest && (
            <p className="cart-price-notice" role="status">
              Price on Request items must be confirmed by the store before payment. Online payment is unavailable until their prices are confirmed.
            </p>
          )}
        </div>
        <aside className="quote-card">
          <h3>Customer & project details</h3>
          <label>Customer name
            <input value={customer.name} onChange={(event) => onCustomer('name', event.target.value)} placeholder="Your name" />
          </label>
          <label>Customer phone
            <input type="tel" value={customer.phone} onChange={(event) => onCustomer('phone', event.target.value)} placeholder="10-digit number" />
          </label>
          <label>Project / site name
            <input value={customer.project} onChange={(event) => onCustomer('project', event.target.value)} placeholder="e.g. Residential villa" />
          </label>
          <label>Site address
            <input value={customer.address} onChange={(event) => onCustomer('address', event.target.value)} placeholder="Area, city" />
          </label>
          <label>PIN code
            <input value={customer.pin} onChange={(event) => onCustomer('pin', event.target.value)} inputMode="numeric" placeholder="Site PIN code" />
          </label>
          <div className="summary-lines">
            <div><span>{hasPriceOnRequest ? 'Materials subtotal (priced items only)' : `Materials subtotal (${units} pcs)`}</span><b>{money(subtotal)}</b></div>
            <div><span>Wholesale discount ({discount * 100}%)</span><b>-{money(subtotal * discount)}</b></div>
            <div><span>Approx. GST (18%)</span><b>{money(gst)}</b></div>
            <div className="summary-total">
              <span>{hasPriceOnRequest ? 'Estimated total before requested prices' : 'Estimated total'}</span>
              <b>{money(total)}</b>
            </div>
          </div>
          {hasPriceOnRequest ? (
            <div className="advance-box">
              <div className="advance-heading"><strong>Payment estimate unavailable</strong></div>
              <small>Confirm Price on Request items with the store before calculating payment.</small>
            </div>
          ) : (
            <div className="advance-box">
              <div className="advance-heading"><strong>UPI advance estimate</strong><span>{money(advanceAmount)}</span></div>
              <div className="choice-row">
                {[10, 50].map((value) => (
                  <button type="button" key={value} className={`choice ${advance === value ? 'is-selected' : ''}`} onClick={() => onAdvance(value)}>
                    {value}% · {money(total * value / 100)}
                  </button>
                ))}
              </div>
              <small>UPI: {upi || 'Set a UPI ID in store settings'} · No payment is processed on this site.</small>
            </div>
          )}
          <div className="quote-actions">
            <button type="button" className="button button-primary" disabled={cart.length === 0} onClick={onWhatsApp}>Send WhatsApp quote</button>
            <button type="button" className="button button-outline" disabled={cart.length === 0} onClick={onPdf}>Download PDF</button>
            <button type="button" className="button button-pay-online" disabled={cart.length === 0 || hasPriceOnRequest} onClick={onPayment}>Pay Online &amp; Payment Methods (UPI / Cards / Bank)</button>
          </div>
          <small className="quote-contact">Store contact: {phone}</small>
        </aside>
      </div>
    </section>
  );
}
