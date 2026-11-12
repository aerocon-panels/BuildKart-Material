import { useEffect, useMemo, useState } from 'react';
import { Building2, Calculator, CheckCircle2, CreditCard, Menu, MessageCircle, Phone, Plus, Search, Settings, ShoppingCart, X } from 'lucide-react';
import CartPanel from './components/CartPanel.jsx';
import Estimator from './components/Estimator.jsx';
import PaymentDialog from './components/PaymentDialog.jsx';
import ProductCard from './components/ProductCard.jsx';
import ProductForm from './components/ProductForm.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import { CATEGORIES, DEFAULT_SETTINGS, INITIAL_PRODUCTS, money, readStorage, writeStorage } from './data.js';
import { loadCatalog } from './api.js';

const CUSTOMER_DEFAULTS = { name: '', phone: '', project: '', address: '', pin: '' };

function formatStorePhone(phone) {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.startsWith('91') ? `+91 ${digits.slice(2)}` : `+${digits}`;
}

function App() {
  const [products, setProducts] = useState(() => readStorage('bk_products', INITIAL_PRODUCTS));
  const [categories, setCategories] = useState(CATEGORIES);
  const [catalogMode, setCatalogMode] = useState('loading');
  const [catalogError, setCatalogError] = useState('');
  const [cart, setCart] = useState(() => readStorage('bk_cart', []));
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...readStorage('bk_settings', {}) }));
  const [customer, setCustomer] = useState(CUSTOMER_DEFAULTS);
  const [category, setCategory] = useState('All materials');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [editingProduct, setEditingProduct] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(() => {
    const parameters = new URLSearchParams(window.location.search);
    return parameters.has('payOrder') || parameters.get('paymentPreview') === 'true';
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState(INITIAL_PRODUCTS[0].id);
  const [length, setLength] = useState('20');
  const [width, setWidth] = useState('8');
  const [wastage, setWastage] = useState(5);
  const [advance, setAdvance] = useState(10);

  useEffect(() => {
    const controller = new AbortController();
    loadCatalog(controller.signal)
      .then((catalog) => {
        setProducts(catalog.products);
        setCategories(catalog.categories);
        setSelectedId(catalog.products[0]?.id || '');
        setCatalogMode('api');
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        console.error('Unable to load the BuildKart API catalogue.', error);
        setCatalogError(error.message);
        setCatalogMode('local');
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (catalogMode === 'local' && !writeStorage('bk_products', products)) {
      notify('Product changes could not be saved in this browser.');
    }
  }, [products, catalogMode]);

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
    if (sort === 'rating') result.sort((first, second) => (second.rating || 0) - (first.rating || 0));
    return result;
  }, [products, category, search, sort]);

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.product.rate * item.product.coverage, 0);
  const units = cart.reduce((sum, item) => sum + item.quantity, 0);
  const discount = units >= 50 ? 0.1 : units >= 25 ? 0.05 : 0;
  const discountedSubtotal = subtotal * (1 - discount);
  const gst = discountedSubtotal * 0.18;
  const total = discountedSubtotal + gst;
  const displayPhone = formatStorePhone(settings.phone);

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
      `Store contact: ${displayPhone}`,
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

  function payForProduct(product) {
    addToCart(product);
    setPaymentOpen(true);
  }

  function estimateProduct(product) {
    setSelectedId(product.id);
    document.getElementById('estimator')?.scrollIntoView({ behavior: 'smooth' });
  }

  function saveSettings(nextSettings) {
    setSettings(nextSettings);
    setSettingsOpen(false);
    notify('Store contact and payment settings saved.');
  }

  return (
    <>
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark"><Building2 size={26} strokeWidth={2.2} /></span>
          <span className="brand-copy">
            <span className="brand-title"><strong>BuildKart</strong><b>V3.0 OFFICIAL</b></span>
            <small><i /> Dispatch: <a href={`https://wa.me/${settings.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer">{displayPhone}</a><span>•</span> UPI: <b>{settings.upi}</b></small>
          </span>
        </div>
        <label className="header-search">
          <Search size={20} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search panels, boards, sheets..." aria-label="Search materials" />
        </label>
        <div className="header-actions">
          <button
            type="button"
            className="header-add"
            onClick={() => openProductForm()}
            aria-label="Add material"
            title={catalogMode === 'api' ? 'Material creation is managed by the connected catalogue API.' : undefined}
            disabled={catalogMode !== 'local'}
          >
            <Plus size={22} /><span>Add Material</span>
          </button>
          <button type="button" className="header-pay" aria-label="Pay Online" onClick={() => setPaymentOpen(true)}><CreditCard size={17} /><span>Pay Online</span></button>
          <a className="header-help" aria-label="Live Help" href={`https://wa.me/${settings.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /><Phone className="whatsapp-phone" size={9} /> <span>Live Help</span></a>
          <a className="header-cart" href="#cart" aria-label={`Cart, ${units} items`}><ShoppingCart size={20} /><span>Cart</span><b>{units}</b></a>
          <button type="button" className="mobile-menu-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`}>
          <a href="#products" onClick={() => setMenuOpen(false)}>Materials</a>
          <a href="#estimator" onClick={() => setMenuOpen(false)}>Estimator</a>
          <a href="#cart" onClick={() => setMenuOpen(false)}>Quotations</a>
          <button type="button" className="nav-settings" onClick={() => { setSettingsOpen(true); setMenuOpen(false); }}><Settings size={16} /> Store settings</button>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-inner">
            <div className="live-store-banner">
              <div><i /><span><strong>v3.0 Live:</strong> Orders & WhatsApp to <b>{displayPhone}</b><span>•</span> UPI ID: <b>{settings.upi}</b></span></div>
              <button type="button" onClick={() => window.location.reload()}>Reload Fresh Store</button>
            </div>
            <div className="hero-badges">
              <span className="badge badge-gold">WHOLESALE TIER ACTIVE</span>
              <span className="badge badge-green">5% OFF on 25+ pcs · 10% OFF on 50+ pcs</span>
              <span className="badge badge-blue">Instant UPI Token Advance</span>
            </div>
            <div className="hero-main">
              <div className="hero-copy">
                <h1>Heavy Building &amp; Architectural Panels</h1>
                <p>Order Aerocon panels, Bison boards, roofing sheets, and elevation planks with project bill generation &amp; instant UPI token advance.</p>
              </div>
              <div className="hero-highlights">
                <a className="button button-primary hero-estimator" href="#estimator"><Calculator size={19} /> Quick Area Estimator</a>
                <div className="hero-proof"><span><CheckCircle2 size={23} /></span><div><strong>Genuine Brand Certified</strong><small>GST Invoice &amp; Bulk Rates</small></div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section catalogue-section" id="products">
          <div className="category-tabs" role="group" aria-label="Filter by category">
            {['All materials', ...categories].map((value) => (
              <button type="button" key={value} className={category === value ? 'tab-active' : ''} onClick={() => setCategory(value)}>{value === 'All materials' ? 'All Products' : value}</button>
            ))}
          </div>
          <div className="section-heading">
            <div>
              <span className="eyebrow">BUILDKART MATERIALS</span>
              <h2>{category === 'All materials' ? 'All Building Materials' : category}</h2>
              <p>Showing {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}</p>
            </div>
            <label className="sort-field"><span>Sort by:</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </label>
          </div>
          {catalogMode === 'loading' && <p className="catalogue-status" role="status">Loading products and categories…</p>}
          {catalogMode === 'local' && catalogError && (
            <p className="catalogue-status catalogue-status-error" role="alert">
              The live catalogue is unavailable: {catalogError} Showing products saved in this browser instead.
            </p>
          )}
          {catalogMode === 'api' && products.length === 0 && (
            <p className="catalogue-status" role="status">No products are available in the database yet.</p>
          )}
          {formOpen && <ProductForm product={editingProduct} onSave={saveProduct} onClose={() => { setFormOpen(false); setEditingProduct(null); }} />}
          {catalogMode === 'loading' ? null : filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={addToCart}
                  onPay={payForProduct}
                  onEstimate={estimateProduct}
                  onEdit={catalogMode === 'local' ? openProductForm : undefined}
                  onDelete={catalogMode === 'local' ? deleteProduct : undefined}
                />
              ))}
            </div>
          ) : products.length > 0 ? <div className="empty-results">No matching products found. Try a different search or category.</div> : null}
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
          phone={displayPhone}
          upi={settings.upi}
          advance={advance}
          onAdvance={setAdvance}
          onWhatsApp={sendWhatsApp}
          onPdf={downloadPdf}
          onPayment={() => setPaymentOpen(true)}
        />
      </main>

      <footer className="site-footer">
        <div><strong>{settings.storeName}</strong><span>{settings.location}</span></div>
        <div><span>Contact: {displayPhone}</span>{settings.gstin && <span>GSTIN: {settings.gstin}</span>}</div>
        <small>Product rates, availability, delivery, and final taxes are subject to confirmation.</small>
      </footer>
      {settingsOpen && <SettingsDialog settings={settings} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />}
      {paymentOpen && (
        <PaymentDialog
          onClose={() => setPaymentOpen(false)}
          upi={settings.upi}
          storeName={settings.storeName}
          phone={displayPhone}
          initialOrderNumber={new URLSearchParams(window.location.search).get('payOrder') || ''}
          initialPaymentType={new URLSearchParams(window.location.search).get('paymentType') || ''}
          initialPreviewAmount={Number(new URLSearchParams(window.location.search).get('amount')) || 0}
          initialPreviewTotal={Number(new URLSearchParams(window.location.search).get('previewTotal')) || 0}
          cart={cart}
          cartTotal={total}
          customerDetails={customer}
          canCheckout={catalogMode === 'api'}
        />
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </>
  );
}

export default App;
