import { Calculator, CreditCard, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { money } from '../data.js';

export default function ProductCard({ product, onAdd, onPay, onEstimate, onEdit, onDelete }) {
  return (
    <article className="product-card">
      <div className="product-art">
        <img src={product.image || '/product-images/material-1.jpg'} alt={product.name} loading="lazy" />
        <span className="product-category">{product.label || product.category}</span>
        <span className="bulk-badge">Bulk Wholesale</span>
        <span className="product-rating"><Star size={14} fill="currentColor" /> {product.rating || '4.8'} <small>({product.reviewCount || 34})</small></span>
      </div>
      <div className="product-content">
        <div className="product-title-row">
          <h3>{product.name}</h3>
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
        <div className="product-spec">{product.spec} · {product.coverage} sq ft / piece</div>
        <div className="product-footer">
          <div className="price"><small>Standard Rate</small>{money(product.rate)}<span>/sq ft</span></div>
          <div className="product-actions">
            <button type="button" className="button button-pay button-small" onClick={() => onPay(product)}>
              <CreditCard size={14} /> Pay
            </button>
            <button type="button" className="button button-soft button-small" onClick={() => onAdd(product)}>
            <Plus size={16} /> Add
            </button>
          </div>
        </div>
        <button type="button" className="product-estimate" onClick={() => onEstimate(product)}>
          <Calculator size={15} /> Calculate by Room Size (Sq Ft)
        </button>
      </div>
    </article>
  );
}
