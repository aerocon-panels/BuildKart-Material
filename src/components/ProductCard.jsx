import { Pencil, Plus, Trash2 } from 'lucide-react';
import { money } from '../data.js';

export default function ProductCard({ product, onAdd, onEdit, onDelete }) {
  return (
    <article className="product-card">
      <div className={`product-art ${product.tone || 'stone'}`} aria-hidden="true">
        <span className="product-category">{product.category}</span>
        <div className="material-shape" />
        <small>BUILDKART MATERIALS</small>
      </div>
      <div className="product-content">
        <div className="product-title-row">
          <h3>{product.name}</h3>
          <div className="product-tools">
            <button type="button" className="quiet-button" aria-label={`Edit ${product.name}`} onClick={() => onEdit(product)}>
              <Pencil size={15} />
            </button>
            <button type="button" className="quiet-button" aria-label={`Remove ${product.name}`} onClick={() => onDelete(product)}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
        <p>{product.description}</p>
        <div className="product-spec">{product.spec} · {product.coverage} sq ft / piece</div>
        <div className="product-footer">
          <div className="price">{money(product.rate)}<small>per sq ft</small></div>
          <button type="button" className="button button-soft button-small" onClick={() => onAdd(product)}>
            <Plus size={16} /> Add
          </button>
        </div>
      </div>
    </article>
  );
}
