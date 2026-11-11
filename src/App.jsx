import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Menu, Package, Settings, ShoppingCart, Truck, X } from 'lucide-react';
import CartPanel from './components/CartPanel.jsx';
import Estimator from './components/Estimator.jsx';
import ProductCard from './components/ProductCard.jsx';
import ProductForm from './components/ProductForm.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import { CATEGORIES, DEFAULT_SETTINGS, INITIAL_PRODUCTS, money, readStorage, writeStorage } from './data.js';

const CUSTOMER_DEFAULTS = { name: '', phone: '', project: '', address: '', pin: '' };

function App() {
  const [products, setProducts] = useState(() => readStorage('bk_products', INITIAL_PRODUCTS));
  const [cart, setCart] = useState(() => readStorage('bk_cart', []));
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...readStorage('bk_settings', {}) }));
  const [customer, setCustomer] = useState(CUSTOMER_DEFAULTS);
  const [category, setCategory] = useState('All materials');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [editingProduct, setEditingProduct] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState(INITIAL_PRODUCTS[0].id);
  const [length, setLength] = useState('20');
  const [width, setWidth] = useState('8');
  const [wastage, setWastage] = useState(5);
  const [advance, setAdvance] = useState(10);

  useEffect(() => {
    if (!writeStorage('bk_products', products)) notify('Product changes could not be saved in this browser.');
  }, [products]);

  useEffect(() => {
    if (!writeStorage('bk_cart', cart)) notify('Your cart could not be saved in this browser.');
  }, [cart]);

  useEffect(() => {
    if (!writeStorage('bk_settings', settings)) notify('Store settings could not be saved in this browser.');
  }, [settings]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = products.filter((product) => {
      const categoryMatches = category === 'All materials' || product.category === category;
      const searchMatches = `${product.name} ${product.category} ${product.spec} ${product.description}`.toLowerCase().includes(query);
      return categoryMatches && searchMatches;
    });
    if (sort === 'price-low') result.sort((first, second) => first.rate - second.rate);
    if (sort === 'price-high') result.sort((first, second) => second.rate - first.rate);
    return result;
  }, [products, category, search, sort]);

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.product.rate * item.product.coverage, 0);
  const units = cart.reduce((sum, item) => sum + item.quantity, 0);
  const discount = units >= 50 ? 0.1 : units >= 25 ? 0.05 : 0;
  const discountedSubtotal = subtotal * (1 - discount);
  const gst = discountedSubtotal * 0.18;
  const total = discountedSubtotal + gst;

  function notify(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  function addToCart(product, quantity = 1) {
    if (!product || quantity < 1) return;
    setCart((current) => {
      const found = current.find((item) => item.product.id === product.id);
      return found
        ? current.map((item) => item.product.id === product.id ? { ...item, product, quantity: item.quantity + quantity } : item)
        : [...current, { product, quantity }];
    });
    notify('Material added to your project cart.');
  }

  function updateCartQuantity(productId, delta) {
    setCart((current) => current.map((item) => item.product.id === productId
      ? { ...item, quantity: Math.max(1, item.quantity + delta) }
      : item));
  }

  function saveProduct(product) {
    setProducts((current) => current.some((item) => item.id === product.id)
      ? current.map((item) => item.id === product.id ? product : item)
      : [...current, product]);
    setCart((current) => current.map((item) => item.product.id === product.id ? { ...item, product } : item));
    setFormOpen(false);
    setEditingProduct(null);
    notify(editingProduct ? 'Product changes saved.' : 'Product added to the catalogue.');
  }

  function deleteProduct(product) {
    if (!window.confirm(`Remove "${product.name}" from the catalogue?`)) return;
    const remaining = products.filter((item) => item.id !== product.id);
    setProducts(remaining);
    setCart((current) => current.filter((item) => item.product.id !== product.id));
    setSelectedId((current) => current === product.id ? remaining[0]?.id || '' : current);
    if (category === product.category) setCategory('All materials');
    notify('Product removed from the catalogue.');
  }

  function updateCustomer(field, value) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  function quoteMessage() {
    const lines = cart.map(({ product, quantity }) => (
      `• ${product.name} — ${quantity} pcs — ${money(quantity * product.coverage * product.rate)}`
    ));
    return [
      `${settings.storeName.toUpperCase()} — MATERIAL QUOTATION`,
      `Customer: ${customer.name || 'Not provided'}${customer.phone ? ` (${customer.phone})` : ''}`,
      `Project: ${customer.project || 'General construction'}`,
      `Site: ${[customer.address, customer.pin].filter(Boolean).join(', ') || 'Not provided'}`,
      '',
      ...lines,
      '',
      `Materials subtotal: ${money(subtotal)}`,
      `Wholesale discount (${discount * 100}%): -${money(subtotal * discount)}`,
      `Approx. GST (18%): ${money(gst)}`,
      `Estimated total: ${money(total)}`,
      `UPI advance (${advance}%): ${money(total * advance / 100)}`,
      `Store contact: +${settings.phone}`,
      `UPI: ${settings.upi || 'Please confirm with the store'}`,
      'Estimate only; delivery and final site measurements are subject to confirmation.',
    ].join('\n');
  }

  function sendWhatsApp() {
    const phone = settings.phone.replace(/[^\d]/g, '');
    if (!phone) {
      notify('Add a valid store WhatsApp number in settings first.');
      return;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(quoteMessage())}`, '_blank', 'noopener,noreferrer');
  }

  function downloadPdf() {
    import('jspdf').then(({ jsPDF }) => {
      const pdf = new jsPDF();
      const left = 16;
      let y = 20;
      const addText = (text, size = 10, gap = 7) => {
        pdf.setFontSize(size);
        const lines = pdf.splitTextToSize(text, 178);
        if (y + lines.length * gap > 280) {
          pdf.addPage();
          y = 18;
        }
        pdf.text(lines, left, y);
        y += lines.length * gap;
      };

      addText(settings.storeName, 19, 9);
      addText('Material quotation', 13, 8);
      addText(`Customer: ${customer.name || 'Not provided'}${customer.phone ? ` · ${customer.phone}` : ''}`);
      addText(`Project: ${customer.project || 'General construction'}`);
      addText(`Site: ${[customer.address, customer.pin].filter(Boolean).join(', ') || 'Not provided'}`);
      addText(`Store location: ${settings.location}`);
      if (settings.gstin) addText(`GSTIN: ${settings.gstin}`);
      y += 3;
      cart.forEach(({ product, quantity }) => {
        addText(`${product.name} — ${quantity} pcs × ${product.coverage} sq ft — ${money(quantity * product.coverage * product.rate)}`);
      });
      y += 3;
      addText(`Materials subtotal: ${money(subtotal)}`);
      addText(`Wholesale discount (${discount * 100}%): -${money(subtotal * discount)}`);
      addText(`Approx. GST (18%): ${money(gst)}`);
      addText(`Estimated total: ${money(total)}`, 13, 9);
      addText(`UPI advance (${advance}%): ${money(total * advance / 100)}`);
      addText(`WhatsApp: +${settings.phone} · UPI: ${settings.upi || 'Not configured'}`);
      addText('Estimate only. Delivery and final site measurements are subject to confirmation.', 8, 6);
      pdf.save('BuildKart-Material-Quotation.pdf');
    }).catch((error) => {
      console.error('Unable to generate the quotation PDF.', error);
      notify('The quotation PDF could not be created. Please try again.');
    });
  }

  function openProductForm(product = null) {
    setEditingProduct(product);
    setFormOpen(true);
  }

  function saveSettings(nextSettings) {
    setSettings(nextSettings);
    setSettingsOpen(false);
    notify('Store contact and payment settings saved.');
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#" aria-label="BuildKart home">
          <span className="brand-mark">BK</span>
          <span><strong>BuildKart</strong><small>BUILDING MATERIALS STORE</small></span>
        </a>
        <button type="button" className="mobile-menu-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`}>
          <a href="#products" onClick={() => setMenuOpen(false)}>Materials</a>
          <a href="#estimator" onClick={() => setMenuOpen(false)}>Estimator</a>
          <a href="#cart" onClick={() => setMenuOpen(false)}>Quotations</a>
          <button type="button" className="nav-settings" onClick={() => { setSettingsOpen(true); setMenuOpen(false); }}><Settings size={16} /> Store settings</button>
        </nav>
        <a className="header-cart" href="#cart"><ShoppingCart size={17} /> Cart <b>{units}</b></a>
      </header>

      <main>
        <div className="wholesale-banner">WHOLESALE PRICING ACTIVE <span>·</span> 5% OFF ON 25+ PCS <span>·</span> 10% OFF ON 50+ PCS <span>·</span> UPI ADVANCE ESTIMATE</div>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">BUILD SMART. BUY DIRECT.</span>
            <h1>Heavy building.<br /><em>Thoughtful design.</em></h1>
            <p>Order Aerocon panels, Bison boards, roofing sheets and elevation planks with practical project estimates and quick WhatsApp quotations.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#products">Explore materials <span aria-hidden="true">↗</span></a>
              <a className="button button-outline" href="#estimator">Estimate your area</a>
            </div>
            <div className="trust-row">
              <span><CheckCircle2 size={16} /> Curated material range</span>
              <span><Package size={16} /> Wholesale rates</span>
              <span><Truck size={16} /> Site dispatch</span>
            </div>
          </div>
          <div className="hero-art" aria-label="Illustration of layered construction panels" role="img">
            <span className="hero-art-label">MATERIALS FOR<br />BETTER BUILDINGS</span>
            <div className="hero-slab slab-one" />
            <div className="hero-slab slab-two" />
            <div className="hero-slab slab-three" />
            <span className="hero-art-footer">PANELS · BOARDS · ROOFING</span>
          </div>
        </section>

        <section className="section catalogue-section" id="products">
          <div className="section-heading">
            <div>
              <span className="eyebrow">OUR CATALOGUE</span>
              <h2>Building materials</h2>
              <p>Find a product, compare rates, and add quantities to your project cart.</p>
            </div>
            <button type="button" className="button button-outline" onClick={() => openProductForm()}><span aria-hidden="true">＋</span> Add material</button>
          </div>
          <div className="catalogue-controls">
            <label className="search-field">
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search panels, boards, sheets..." aria-label="Search materials" />
            </label>
            <label className="sort-field"><span className="sr-only">Sort materials</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="featured">Sort: Featured</option>
                <option value="price-low">Price: Low to high</option>
                <option value="price-high">Price: High to low</option>
              </select>
            </label>
          </div>
          <div className="category-tabs" role="group" aria-label="Filter by category">
            {['All materials', ...CATEGORIES].map((value) => (
              <button type="button" key={value} className={category === value ? 'tab-active' : ''} onClick={() => setCategory(value)}>{value}</button>
            ))}
          </div>
          {formOpen && <ProductForm product={editingProduct} onSave={saveProduct} onClose={() => { setFormOpen(false); setEditingProduct(null); }} />}
          {filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={addToCart} onEdit={openProductForm} onDelete={deleteProduct} />
              ))}
            </div>
          ) : <div className="empty-results">No matching products found. Try a different search or category.</div>}
          <p className="catalogue-footnote">Sample catalogue rates are estimates. Confirm availability, taxes, and delivery terms with the store.</p>
        </section>

        <Estimator
          products={products}
          selectedId={selectedId}
          onSelect={setSelectedId}
          length={length}
          onLength={setLength}
          width={width}
          onWidth={setWidth}
          wastage={wastage}
          onWastage={setWastage}
          onAdd={addToCart}
        />
        <CartPanel
          cart={cart}
          onQuantity={updateCartQuantity}
          onRemove={(id) => setCart((current) => current.filter((item) => item.product.id !== id))}
          customer={customer}
          onCustomer={updateCustomer}
          subtotal={subtotal}
          units={units}
          discount={discount}
          gst={gst}
          total={total}
          phone={settings.phone}
          upi={settings.upi}
          advance={advance}
          onAdvance={setAdvance}
          onWhatsApp={sendWhatsApp}
          onPdf={downloadPdf}
        />
      </main>

      <footer className="site-footer">
        <div><strong>{settings.storeName}</strong><span>{settings.location}</span></div>
        <div><span>Contact: +{settings.phone}</span>{settings.gstin && <span>GSTIN: {settings.gstin}</span>}</div>
        <small>Product rates, availability, delivery, and final taxes are subject to confirmation.</small>
      </footer>
      {settingsOpen && <SettingsDialog settings={settings} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </>
  );
}

export default App;
