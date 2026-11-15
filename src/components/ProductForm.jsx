import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CATEGORIES } from '../data.js';

const EMPTY_PRODUCT = {
  name: '',
  category: CATEGORIES[0],
  spec: '',
  rate: '',
  coverage: '',
  description: '',
};

export default function ProductForm({ product, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_PRODUCT);

  useEffect(() => {
    setForm(product ? { ...product } : EMPTY_PRODUCT);
  }, [product]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSave({
      ...form,
      id: product?.id || `product-${Date.now()}`,
      rate: Number(form.rate),
      coverage: Number(form.coverage),
      tone: product?.tone || 'stone',
    });
  }

  return (
    <form className="form-panel" onSubmit={submit}>
      <div className="form-heading">
        <div>
          <span className="eyebrow">PRODUCT MANAGEMENT</span>
          <h3>{product ? 'Edit material' : 'Add a material'}</h3>
        </div>
        <button type="button" className="quiet-button" aria-label="Close product form" onClick={onClose}><X size={19} /></button>
      </div>
      <div className="form-grid">
        <label>Product name
          <input required maxLength="80" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Fibre cement board" />
        </label>
        <label>Category
          <select value={form.category} onChange={(event) => update('category', event.target.value)}>
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label>Specification / size
          <input value={form.spec} onChange={(event) => update('spec', event.target.value)} placeholder="12mm · 8ft × 4ft" />
        </label>
        <label>Rate (₹ per sq ft)
          <input required type="number" min="0.01" step="0.01" value={form.rate} onChange={(event) => update('rate', event.target.value)} />
        </label>
        <label>Coverage per piece (sq ft)
          <input required type="number" min="0.1" step="0.1" value={form.coverage} onChange={(event) => update('coverage', event.target.value)} />
        </label>
        <label>Description
          <input value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Short product description" />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="button button-outline" onClick={onClose}>Cancel</button>
        <button type="submit" className="button button-primary">{product ? 'Save changes' : 'Add to catalogue'}</button>
      </div>
    </form>
  );
}
