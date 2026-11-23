import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { money } from '../data.js';

export default function CartPage({ cart, onQuantity, onRemove, subtotal, total, onContinueShopping, onCheckout }) {
  return (
    <section className="section standalone-cart">
      <div className="standalone-cart-heading">
        <div>
          <span className="eyebrow">YOUR PROJECT</span>
          <h1>Your Shopping Cart</h1>
          <p>Review your selected building materials and quantities.</p>
        </div>
        <span className="heading-icon"><ShoppingCart size={23} /></span>
      </div>

      {cart.length === 0 ? (
        <div className="standalone-cart-empty">
          <ShoppingCart size={34} />
          <strong>Your cart is empty</strong>
          <span>Add materials from the catalogue to get started.</span>
          <button type="button" className="button button-primary" onClick={onContinueShopping}>
            <ArrowLeft size={16} /> Continue Shopping
          </button>
        </div>
      ) : (
        <div className="standalone-cart-layout">
          <div className="standalone-cart-items">
            {cart.map(({ product, quantity }) => {
              const priceOnRequest = product.priceAvailable === false;
              const itemSubtotal = quantity * product.coverage * product.rate;

              return (
                <article className="standalone-cart-item" key={product.id}>
                  {product.image
                    ? <img className="standalone-cart-image" src={product.image} alt={product.name} />
                    : <div className={`standalone-cart-image cart-swatch ${product.tone || 'stone'}`} aria-hidden="true"><span>BK</span></div>}
                  <div className="standalone-cart-product">
                    <h2>{product.name}</h2>
                    <p>{product.thickness ? `Thickness: ${product.thickness} · ` : ''}{product.spec}</p>
                    <span>{priceOnRequest ? 'Price on Request' : `${money(product.coverage * product.rate)} / item`}</span>
                  </div>
                  <div className="standalone-cart-quantity">
                    <span>Quantity</span>
                    <div className="quantity-control" aria-label={`Quantity for ${product.name}`}>
                      <button type="button" aria-label={`Decrease ${product.name} quantity`} onClick={() => onQuantity(product.id, -1)}><Minus size={14} /></button>
                      <span>{quantity}</span>
                      <button type="button" aria-label={`Increase ${product.name} quantity`} onClick={() => onQuantity(product.id, 1)}><Plus size={14} /></button>
                    </div>
                  </div>
                  <div className="standalone-cart-subtotal">
                    <span>Subtotal</span>
                    <strong>{priceOnRequest ? 'Price on Request' : money(itemSubtotal)}</strong>
                  </div>
                  <button type="button" className="standalone-cart-remove" aria-label={`Remove ${product.name}`} onClick={() => onRemove(product.id)}>
                    <Trash2 size={17} />
                    <span>Remove</span>
                  </button>
                </article>
              );
            })}
          </div>

          <aside className="standalone-cart-summary">
            <h2>Order Summary</h2>
            <div><span>Materials subtotal</span><strong>{money(subtotal)}</strong></div>
            <div className="standalone-cart-total"><span>Estimated total</span><strong>{money(total)}</strong></div>
            {cart.some(({ product }) => product.priceAvailable === false) && (
              <p role="status">Price on Request products are not included in this estimate and must be confirmed by the store.</p>
            )}
            <button type="button" className="button button-primary" onClick={onCheckout}>Checkout</button>
            <button type="button" className="button button-outline" onClick={onContinueShopping}>Continue Shopping</button>
          </aside>
        </div>
      )}
    </section>
  );
}
