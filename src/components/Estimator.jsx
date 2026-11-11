import { Calculator, Package } from 'lucide-react';
import { money } from '../data.js';

export default function Estimator({ products, selectedId, onSelect, length, onLength, width, onWidth, wastage, onWastage, onAdd }) {
  const selected = products.find((product) => product.id === selectedId) || products[0];
  const area = Math.max(0, (Number(length) || 0) * (Number(width) || 0));
  const adjustedArea = area * (1 + wastage / 100);
  const quantity = selected ? Math.ceil(adjustedArea / Math.max(selected.coverage, 0.1)) : 0;
  const estimate = selected ? quantity * selected.coverage * selected.rate : 0;

  return (
    <section className="section estimator-section" id="estimator">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PLAN YOUR REQUIREMENT</span>
          <h2>Area & material estimator</h2>
          <p>Get a quick material quantity and cost estimate for your site.</p>
        </div>
        <span className="heading-icon"><Calculator size={23} /></span>
      </div>
      <div className="estimate-grid">
        <div className="estimate-form">
          <label>Material
            <select value={selected?.id || ''} onChange={(event) => onSelect(event.target.value)}>
              {products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
            </select>
          </label>
          <div className="input-pair">
            <label>Length / span (feet)
              <input type="number" min="0" step="0.1" value={length} onChange={(event) => onLength(event.target.value)} />
            </label>
            <label>Height / width (feet)
              <input type="number" min="0" step="0.1" value={width} onChange={(event) => onWidth(event.target.value)} />
            </label>
          </div>
          <fieldset className="wastage-field">
            <legend>Cutting & corner wastage margin</legend>
            <div className="choice-row">
              {[0, 5, 10].map((value) => (
                <button type="button" key={value} className={`choice ${wastage === value ? 'is-selected' : ''}`} onClick={() => onWastage(value)}>
                  {value}%
                </button>
              ))}
            </div>
          </fieldset>
          <p className="muted-note">Coverage: {selected?.coverage || 0} sq ft / piece · Rate: {money(selected?.rate || 0)} / sq ft</p>
        </div>
        <div className="estimate-result">
          <span className="result-label">ESTIMATED REQUIREMENT</span>
          <div className="estimate-line"><span>Net surface area</span><strong>{area.toLocaleString('en-IN')} sq ft</strong></div>
          <div className="estimate-line"><span>Area with {wastage}% margin</span><strong>{adjustedArea.toLocaleString('en-IN', { maximumFractionDigits: 1 })} sq ft</strong></div>
          <div className="estimate-quantity">
            <div><span className="result-label">REQUIRED QUANTITY</span><strong>{quantity} <small>pieces</small></strong></div>
            <Package size={31} />
          </div>
          <div className="estimate-total"><span>Estimated material cost</span><strong>{money(estimate)}</strong></div>
          <button type="button" className="button button-primary button-wide" disabled={!selected || quantity < 1} onClick={() => onAdd(selected, quantity)}>
            Add estimated quantity to cart
          </button>
          <small className="estimate-disclaimer">Indicative estimate only. Confirm dimensions and site wastage before ordering.</small>
        </div>
      </div>
    </section>
  );
}
