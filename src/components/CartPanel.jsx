import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { money } from '../data.js';

export default function CartPanel({ cart, onQuantity, onRemove, customer, onCustomer, subtotal, units, discount, gst, total, phone, upi, advance, onAdvance, onWhatsApp, onPdf, onPayment }) {
  const advanceAmount = total * advance / 100;

  return (
    <section className="section cart-section" id="cart">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR PROJECT</span>
          <h2>Cart & quotation</h2>
          <p>Review your materials and prepare a project quotation.</p>
        </div>
        <span className="heading-icon"><ShoppingCart size={23} /></span>
      </div>
      <div className="cart-layout">
        <div className="cart-card">
          {cart.length === 0 ? (
            <div className="empty-cart"><ShoppingCart size={29} /><strong>Your cart is empty</strong><span>Add materials from the catalogue or estimator.</span></div>
          ) : cart.map(({ product, quantity }) => (
            <div className="cart-item" key={product.id}>
              <div className={`cart-swatch ${product.tone || 'stone'}`} aria-hidden="true"><span>BK</span></div>
              <div className="cart-description">
                <strong>{product.name}</strong>
                <small>{product.spec} · {money(product.rate)} / sq ft</small>
                <b>{money(quantity * product.coverage * product.rate)}</b>
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
            <div><span>Materials subtotal ({units} pcs)</span><b>{money(subtotal)}</b></div>
            <div><span>Wholesale discount ({discount * 100}%)</span><b>-{money(subtotal * discount)}</b></div>
            <div><span>Approx. GST (18%)</span><b>{money(gst)}</b></div>
            <div className="summary-total"><span>Estimated total</span><b>{money(total)}</b></div>
          </div>
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
          <div className="quote-actions">
            <button type="button" className="button button-primary" disabled={cart.length === 0} onClick={onWhatsApp}>Send WhatsApp quote</button>
            <button type="button" className="button button-outline" disabled={cart.length === 0} onClick={onPdf}>Download PDF</button>
            <button type="button" className="button button-pay-online" onClick={onPayment}>Pay Online &amp; Payment Methods (UPI / Cards / Bank)</button>
          </div>
          <small className="quote-contact">Store contact: {phone}</small>
        </aside>
      </div>
    </section>
  );
}
