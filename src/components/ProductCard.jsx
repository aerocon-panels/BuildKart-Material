import { Calculator, CreditCard, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { money } from '../data.js';

export default function ProductCard({
  product,
  onAdd,
  onPay,
  onEstimate,
  onEdit,
  onDelete,
  onOpen,
  openHref,
  cardTitle,
  variantActions = false,
  payActions = false,
  hideCategory = false,
  sizeCard = false,
}) {
  const priceAvailable = product.priceAvailable !== false;
  const title = cardTitle || product.name;
  const image = product.image || '/product-images/material-1.jpg';

  return (
    <article className={`product-card${sizeCard ? ' aerocon-size-card' : ''}`}>
      {onOpen && (
        <a
          className="product-card-link"
          href={openHref}
          onClick={(event) => {
            event.preventDefault();
            onOpen();
          }}
        >
          <span className="sr-only">View {product.name}</span>
        </a>
      )}
      <div className="product-art">
        {sizeCard && (
          <span
            className="product-art-backdrop"
            style={{ backgroundImage: `url("${image}")` }}
            aria-hidden="true"
          />
        )}
        <img className={sizeCard ? 'product-art-size-image' : undefined} src={image} alt={product.name} loading="lazy" />
      </div>
      <div className="product-content">
        <div className="product-title-row">
          <h3>{title}</h3>
          {(onEdit || onDelete) && (
            <div className="product-tools">
              {onEdit && (
                <button type="button" className="quiet-button" aria-label={`Edit ${product.name}`} onClick={() => onEdit(product)}>
                  <Pencil size={15} />
                </button>
              )}
              {onDelete && (
                <button type="button" className="quiet-button" aria-label={`Remove ${product.name}`} onClick={() => onDelete(product)}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          )}
        </div>
        <p>{product.description}</p>
        {variantActions && !payActions && <div className="product-thickness">Thickness: {product.thickness}</div>}
        {!(variantActions && !payActions && !product.dimensions && product.thickness && product.spec?.trim().toLowerCase() === `${product.thickness} thickness`.toLowerCase()) && (
          <div className="product-spec">
            {sizeCard ? (
              <>
                <strong className="aerocon-size-highlight">{product.thickness} Thickness</strong>
                {' · '}
                <strong className="aerocon-size-highlight">{product.dimensions}</strong>
                {' · '}{product.coverage} sq ft / piece
              </>
            ) : product.dimensions
              ? payActions
                ? `${product.thickness} Thickness · ${product.dimensions.replace(' × ', ' x ')} · ${product.coverage} sq ft / piece`
                : `Dimensions: ${product.dimensions} · Area: ${product.coverage} SFT`
              : `${product.spec}${priceAvailable && product.coverage ? ` · ${product.coverage} sq ft / piece` : ''}`}
          </div>
        )}
        <div className="product-footer">
          <div className="price">
            {priceAvailable
              ? variantActions
                ? <><small>Price per piece</small>{money(product.rate * product.coverage)}</>
                : <><small>Standard Rate</small>{money(product.rate)}<span>/sq ft</span></>
              : <><small>Price</small><span className="price-unavailable">Price on Request</span></>}
          </div>
          <div className="product-actions">
            {variantActions ? (
              <>
                {payActions && (
                  <button type="button" className="button button-pay button-small" onClick={() => onPay(product)}>
                    <CreditCard size={14} /> Pay
                  </button>
                )}
                <button type="button" className="button button-soft button-small" onClick={() => onAdd(product)}>
                  {payActions ? <Plus size={16} /> : <ShoppingCart size={14} />}
                  {payActions ? 'Add' : 'Add to Cart'}
                </button>
                {!payActions && (
                  <button type="button" className="button button-pay button-small" onClick={() => onPay(product)}>
                    <CreditCard size={14} /> Buy Now
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" className="button button-pay button-small" onClick={() => onPay(product)}>
                  <CreditCard size={14} /> Pay
                </button>
                <button type="button" className="button button-soft button-small" onClick={() => onAdd(product)}>
                  <Plus size={16} /> Add
                </button>
              </>
            )}
          </div>
        </div>
        {(!variantActions || payActions) && onEstimate && <button type="button" className="product-estimate" onClick={() => onEstimate(product)}>
          <Calculator size={15} /> Calculate by Room Size (Sq Ft)
        </button>}
      </div>
    </article>
  );
}
