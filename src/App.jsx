import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CreditCard, Search, ShoppingCart } from 'lucide-react';
import CartPanel from './components/CartPanel.jsx';
import Estimator from './components/Estimator.jsx';
import PaymentDialog from './components/PaymentDialog.jsx';
import ProductCard from './components/ProductCard.jsx';
import ProductImageAdmin from './components/ProductImageAdmin.jsx';
import ProductForm from './components/ProductForm.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import {
  AEROCON_VARIANTS,
  AEROCON_CATEGORY_PATH,
  getAerocon50Variants,
  getAerocon75Variants,
  getAeroconRoute,
  getAeroconVariants,
  isAeroconSizeVariant,
} from './aeroconProducts.js';
import { CATEGORIES, DEFAULT_SETTINGS, INITIAL_PRODUCTS, money, readStorage, writeStorage } from './data.js';
import { loadCatalog, loadProductImages } from './api.js';

const CUSTOMER_DEFAULTS = { name: '', phone: '', project: '', address: '', pin: '' };

function formatStorePhone(phone) {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.startsWith('91') ? `+91 ${digits.slice(2)}` : `+${digits}`;
}

function App() {
  const [products, setProducts] = useState(() => readStorage('bk_products', INITIAL_PRODUCTS));
  const [productImages, setProductImages] = useState([]);
  const [productImagesError, setProductImagesError] = useState('');
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
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
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState(INITIAL_PRODUCTS[0].id);
  const [length, setLength] = useState('20');
  const [width, setWidth] = useState('8');
  const [wastage, setWastage] = useState(5);
  const [advance, setAdvance] = useState(10);
  const aeroconVariants = useMemo(
    () => getAeroconVariants(products, productImages),
    [products, productImages],
  );
  const aerocon75Variants = useMemo(
    () => getAerocon75Variants(products, productImages),
    [products, productImages],
  );
  const aerocon50Variants = useMemo(
    () => getAerocon50Variants(products, productImages),
    [products, productImages],
  );
  const aeroconRoute = getAeroconRoute(currentPath);
  const aeroconSizeListVariants = aeroconRoute?.slug === AEROCON_VARIANTS[1].slug
    ? aerocon50Variants
    : aerocon75Variants;
  const aeroconSizeListThickness = aeroconRoute?.slug === AEROCON_VARIANTS[1].slug ? '50mm' : '75mm';
  const allAeroconSizeVariants = useMemo(
    () => [...aerocon75Variants, ...aerocon50Variants],
    [aerocon75Variants, aerocon50Variants],
  );
  const selectedAeroconVariant = aeroconRoute?.type === 'product'
    ? aeroconVariants.find((variant) => variant.path === currentPath)
    : null;
  const selectedAeroconSizeVariant = aeroconRoute?.type === 'size-detail'
    ? allAeroconSizeVariants.find((variant) => variant.sku === aeroconRoute.sku)
    : null;

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(window.location.pathname);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadCatalog(controller.signal)
      .then((catalog) => {
        setProducts(catalog.products);
        setCategories(catalog.categories);
        setSelectedId(catalog.products.find((product) => !isAeroconSizeVariant(product))?.id || '');
        const catalogVariants = getAeroconVariants(catalog.products);
        const catalog75Variants = getAerocon75Variants(catalog.products);
        const catalog50Variants = getAerocon50Variants(catalog.products);
        const catalogSizeVariants = [...catalog75Variants, ...catalog50Variants];
        setCart((current) => current.reduce((merged, item) => {
          const currentVariant = item.product.category !== 'Aerocon Panels'
            ? null
            : isAeroconSizeVariant(item.product)
              ? catalogSizeVariants.find((variant) => (
                variant.sku === item.product.sku
                || variant.sku.replace('-75-', '-175-') === item.product.sku
              ))
              : catalogVariants.find((variant) => variant.thickness === item.product.thickness && variant.priceAvailable);
          const product = currentVariant || item.product;
          const existing = merged.find((entry) => entry.product.id === product.id);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            merged.push({ product, quantity: item.quantity });
          }
          return merged;
        }, []));
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
    const controller = new AbortController();
    loadProductImages(controller.signal)
      .then((images) => {
        setProductImages(images);
        setProductImagesError('');
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        console.error('Unable to load product images.', error);
        setProductImagesError(error.message);
      });

    return () => controller.abort();
  }, []);

  async function refreshProductImages(uploadedImage) {
    setProductImages((current) => [
      uploadedImage,
      ...current.filter((image) => !(
        image.image === uploadedImage.image
        && image.thickness === uploadedImage.thickness
        && image.sizeLabel === uploadedImage.sizeLabel
      )),
    ]);

    try {
      const images = await loadProductImages();
      setProductImages(images);
      setProductImagesError('');
    } catch (error) {
      setProductImagesError(error.message);
      throw error;
    }
  }

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

  const storeProducts = useMemo(() => products.filter((product) => !isAeroconSizeVariant(product)), [products]);
  const estimatorProducts = useMemo(
    () => [...storeProducts, ...allAeroconSizeVariants],
    [storeProducts, allAeroconSizeVariants],
  );
  useEffect(() => {
    if (catalogMode !== 'local') return;

    const allAeroconSizeVariants = [...aerocon75Variants, ...aerocon50Variants];
    setCart((current) => current.reduce((merged, item) => {
      const isSizeVariant = isAeroconSizeVariant(item.product);
      const canonicalSku = item.product.sku?.replace('-175-', '-75-');
      const product = isSizeVariant
        ? allAeroconSizeVariants.find((variant) => variant.sku === canonicalSku) || item.product
        : item.product;
      const existingIndex = isSizeVariant
        ? merged.findIndex((entry) => entry.product.sku === product.sku)
        : -1;

      if (existingIndex >= 0) {
        const existing = merged[existingIndex];
        merged[existingIndex] = { ...existing, quantity: existing.quantity + item.quantity };
      } else {
        merged.push({ product, quantity: item.quantity });
      }
      return merged;
    }, []));
  }, [catalogMode, aerocon75Variants, aerocon50Variants]);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = storeProducts.filter((product) => {
      const categoryMatches = category === 'All materials' || product.category === category;
      const searchMatches = `${product.name} ${product.category} ${product.spec} ${product.description}`.toLowerCase().includes(query);
      return categoryMatches && searchMatches;
    });
    if (sort === 'price-low') result.sort((first, second) => first.rate - second.rate);
    if (sort === 'price-high') result.sort((first, second) => second.rate - first.rate);
    if (sort === 'rating') result.sort((first, second) => (second.rating || 0) - (first.rating || 0));
    return result;
  }, [storeProducts, category, search, sort]);

  const isCheckoutRoute = currentPath === '/checkout';
  const hasPriceOnRequest = cart.some(({ product }) => product.priceAvailable === false);
  const subtotal = cart.reduce((sum, item) => (
    item.product.priceAvailable === false
      ? sum
      : sum + item.quantity * item.product.rate * item.product.coverage
  ), 0);
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

  function navigate(path) {
    window.history.pushState({}, '', path);
    setCurrentPath(window.location.pathname);
    window.scrollTo(0, 0);
    const hash = path.includes('#') ? path.slice(path.indexOf('#') + 1) : '';
    if (hash) window.setTimeout(() => document.getElementById(hash)?.scrollIntoView(), 0);
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
      `• ${product.name}${product.thickness ? ` (${product.thickness})` : ''} — ${quantity} pcs — ${product.priceAvailable === false ? 'Price on Request' : money(quantity * product.coverage * product.rate)}`
    ));
    return [
      `${settings.storeName.toUpperCase()} — MATERIAL QUOTATION`,
      `Customer: ${customer.name || 'Not provided'}${customer.phone ? ` (${customer.phone})` : ''}`,
      `Project: ${customer.project || 'General construction'}`,
      `Site: ${[customer.address, customer.pin].filter(Boolean).join(', ') || 'Not provided'}`,
      '',
      ...lines,
      '',
      `Materials subtotal${hasPriceOnRequest ? ' (priced items only)' : ''}: ${money(subtotal)}`,
      `Wholesale discount (${discount * 100}%): -${money(subtotal * discount)}`,
      `Approx. GST (18%): ${money(gst)}`,
      `Estimated total${hasPriceOnRequest ? ' (before requested prices)' : ''}: ${money(total)}`,
      `UPI advance (${advance}%): ${money(total * advance / 100)}`,
      `Store contact: ${displayPhone}`,
      `UPI: ${settings.upi || 'Please confirm with the store'}`,
      ...(hasPriceOnRequest ? ['Price on Request items require store confirmation before payment.'] : []),
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
        addText(`${product.name}${product.thickness ? ` (${product.thickness})` : ''} — ${quantity} pcs — ${product.priceAvailable === false ? 'Price on Request' : `${product.coverage} sq ft — ${money(quantity * product.coverage * product.rate)}`}`);
      });
      y += 3;
      addText(`Materials subtotal${hasPriceOnRequest ? ' (priced items only)' : ''}: ${money(subtotal)}`);
      addText(`Wholesale discount (${discount * 100}%): -${money(subtotal * discount)}`);
      addText(`Approx. GST (18%): ${money(gst)}`);
      addText(`Estimated total${hasPriceOnRequest ? ' (before requested prices)' : ''}: ${money(total)}`, 13, 9);
      if (hasPriceOnRequest) addText('Price on Request items require store confirmation before payment.');
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
    if (product.priceAvailable === false || hasPriceOnRequest) {
      notify('Price on Request items must be confirmed by the store before payment.');
      return;
    }
    setPaymentOpen(true);
  }

  function buyNowProduct(product) {
    addToCart(product);
    navigate('/checkout');
  }

  function openCartPayment() {
    if (hasPriceOnRequest) {
      notify('Price on Request items must be confirmed by the store before payment.');
      return;
    }
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

  const cartPanel = (
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
      onPayment={openCartPayment}
      checkoutMode={isCheckoutRoute}
    />
  );

  return (
    <>
      <header className="site-header">
        <div className="brand">
          <img className="brand-mark" src="/buildkart-logo.svg" alt="" />
          <span className="brand-copy">
            <span className="brand-title"><strong>BuildKart-Store</strong></span>
            <small>Your Dream, Our Construction</small>
          </span>
        </div>
        <label className="header-search">
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Aerocon panels, Bison boards, roofing sheets, elevation planks..." aria-label="Search materials" />
          <span className="header-search-action" aria-hidden="true"><Search size={21} /></span>
        </label>
        <div className="header-actions">
          <a className="header-action" href="#cart" aria-label="Track Order">
            <span className="header-action-icon" aria-hidden="true">🚚</span><span>Track Order</span>
          </a>
          <a className="header-action" aria-label="Help" href={`https://wa.me/${settings.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer">
            <span className="header-action-icon" aria-hidden="true">🎧</span><span>Help</span>
          </a>
          <button type="button" className="header-action" aria-label="Account" onClick={() => setSettingsOpen(true)}>
            <span className="header-action-icon" aria-hidden="true">👤</span><span>Account</span>
          </button>
          <a className="header-action header-action-cart" href="#cart" aria-label={`Cart, ${units} items`}>
            <span className="header-action-icon" aria-hidden="true">🛒</span><span>Cart <b>{units}</b></span>
          </a>
        </div>
      </header>

      <main>
        {isCheckoutRoute && (
          <section className="section checkout-heading">
            <button type="button" className="button button-outline" onClick={() => navigate('/#products')}>
              <ArrowLeft size={16} /> Back to Products
            </button>
            <p className="eyebrow">BUILDKART CHECKOUT</p>
            <h1>Review your products</h1>
            <p>Check quantities and confirm any Price on Request items with the store before payment.</p>
          </section>
        )}

        {!aeroconRoute && !isCheckoutRoute && <>
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-main">
              <div className="hero-copy">
                <p className="hero-eyebrow">PREMIUM MATERIALS <span>|</span> BEST BRANDS <span>|</span> FAST DELIVERY</p>
                <h1>
                  <span>Heavy Building &amp;</span>{' '}
                  <span className="hero-title-highlight">Architectural Panels</span>
                </h1>
                <p>Order Aerocon panels, Bison boards, roofing sheets, and elevation planks with project bill generation &amp; instant UPI token advance.</p>
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
                  onOpen={product.id === 'aerocon-sandwich-panel' || (
                    product.category === 'Aerocon Panels' && /aerocon sandwich/i.test(product.name)
                  ) ? () => navigate(AEROCON_CATEGORY_PATH) : undefined}
                  openHref={AEROCON_CATEGORY_PATH}
                />
              ))}
            </div>
          ) : products.length > 0 ? <div className="empty-results">No matching products found. Try a different search or category.</div> : null}
          <p className="catalogue-footnote">Sample catalogue rates are estimates. Confirm availability, taxes, and delivery terms with the store.</p>
        </section>
        </>}

        {aeroconRoute?.type === 'category' && (
          <section className="section catalogue-section aerocon-page">
            <button type="button" className="button button-outline aerocon-back" onClick={() => navigate('/#products')}>
              <ArrowLeft size={16} /> Back to Products
            </button>
            <div className="section-heading">
              <div>
                <span className="eyebrow">AEROCON PANELS</span>
                <h2>Aerocon Sandwich Partition Panels</h2>
                <p>Choose a panel thickness to view product details.</p>
              </div>
            </div>
            {catalogMode === 'loading' && <p className="catalogue-status" role="status">Loading current variant prices…</p>}
            <div className="product-grid aerocon-variant-grid">
              {aeroconVariants.map((variant) => (
                <ProductCard
                  key={variant.slug}
                  product={variant}
                  onAdd={addToCart}
                  onPay={buyNowProduct}
                  onOpen={() => navigate(variant.path)}
                  openHref={variant.path}
                  variantActions
                  hideCategory={variant.thickness === '75mm' || variant.thickness === '50mm'}
                  sizeCard={variant.thickness === '75mm' || variant.thickness === '50mm'}
                />
              ))}
            </div>
            {aeroconVariants.some((variant) => !variant.priceAvailable) && (
              <p className="catalogue-footnote" role="status">
                Add Price on Request items to your cart; online payment stays unavailable until the store confirms their prices.
              </p>
            )}
            <ProductImageAdmin
              defaultImage="aerocon-sandwich-partition-panel-75mm"
              defaultThickness="75mm"
              loadError={productImagesError}
              onUploaded={refreshProductImages}
            />
          </section>
        )}

        {aeroconRoute?.type === 'size-list' && (
          <section className="section catalogue-section aerocon-page">
            <div className="aerocon-detail-navigation">
              <button type="button" className="button button-outline" onClick={() => navigate(AEROCON_CATEGORY_PATH)}>
                <ArrowLeft size={16} /> Back to variants
              </button>
              <button type="button" className="button button-outline" onClick={() => navigate('/#products')}>
                Back to Products
              </button>
            </div>
            <div className="section-heading">
              <div>
                <span className="eyebrow">AEROCON PANELS · {aeroconSizeListThickness.toUpperCase()}</span>
                <h2>Aerocon Sandwich Partition Panel – {aeroconSizeListThickness}</h2>
                <p>Select a panel size to add it to your cart or continue directly to checkout.</p>
              </div>
            </div>
            <div className="product-grid aerocon-size-grid">
              {aeroconSizeListVariants.map((variant) => (
                <ProductCard
                  key={variant.sku}
                  product={variant}
                  onAdd={addToCart}
                  onPay={payForProduct}
                  onEstimate={estimateProduct}
                  onOpen={() => navigate(variant.path)}
                  openHref={variant.path}
                  variantActions
                  payActions
                  hideCategory
                  sizeCard
                />
              ))}
            </div>
          </section>
        )}

        {aeroconRoute?.type === 'size-detail' && selectedAeroconSizeVariant && (
          <section className="section aerocon-detail-section">
            <div className="aerocon-detail-navigation">
              <button
                type="button"
                className="button button-outline"
                onClick={() => navigate(`/products/${AEROCON_VARIANTS.find((variant) => variant.thickness === selectedAeroconSizeVariant.thickness).slug}`)}
              >
                <ArrowLeft size={16} /> Back to {selectedAeroconSizeVariant.thickness} sizes
              </button>
              <button type="button" className="button button-outline" onClick={() => navigate('/#products')}>
                Back to Products
              </button>
            </div>
            <article className="aerocon-detail-card aerocon-size-detail-card">
              <div className="aerocon-detail-image">
                <img src={selectedAeroconSizeVariant.image} alt={selectedAeroconSizeVariant.name} />
              </div>
              <div className="aerocon-detail-content">
                <span className="eyebrow">AEROCON PANELS</span>
                <h1>Aerocon Sandwich Partition Panel – {selectedAeroconSizeVariant.thickness}</h1>
                <p>{selectedAeroconSizeVariant.description}</p>
                <p className="aerocon-detail-thickness">Thickness: {selectedAeroconSizeVariant.thickness}</p>
                <div className="aerocon-detail-price">
                  <small>Price per piece</small>
                  <strong>{money(selectedAeroconSizeVariant.rate * selectedAeroconSizeVariant.coverage)}</strong>
                  <span>{selectedAeroconSizeVariant.dimensions} · {selectedAeroconSizeVariant.coverage} SFT</span>
                </div>
                <div className="aerocon-detail-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => addToCart(selectedAeroconSizeVariant)}
                  >
                    <ShoppingCart size={16} /> Add to Cart
                  </button>
                  <button
                    type="button"
                    className="button button-pay"
                    onClick={() => buyNowProduct(selectedAeroconSizeVariant)}
                  >
                    <CreditCard size={16} /> Buy Now
                  </button>
                </div>
              </div>
            </article>
          </section>
        )}

        {aeroconRoute?.type === 'product' && selectedAeroconVariant && (
          <section className="section aerocon-detail-section">
            <div className="aerocon-detail-navigation">
              <button type="button" className="button button-outline" onClick={() => navigate(AEROCON_CATEGORY_PATH)}>
                <ArrowLeft size={16} /> Back to variants
              </button>
              <button type="button" className="button button-outline" onClick={() => navigate('/#products')}>
                Back to Products
              </button>
            </div>
            <article className="aerocon-detail-card">
              <div className="aerocon-detail-image">
                <img src={selectedAeroconVariant.image} alt={selectedAeroconVariant.name} />
              </div>
              <div className="aerocon-detail-content">
                <span className="eyebrow">AEROCON PANELS</span>
                <h1>{selectedAeroconVariant.name}</h1>
                <p className="aerocon-detail-thickness">Thickness: {selectedAeroconVariant.thickness}</p>
                <p>{selectedAeroconVariant.description}</p>
                {selectedAeroconVariant.priceAvailable ? (
                  <div className="aerocon-detail-price">
                    <small>Price per piece</small>
                    <strong>{money(selectedAeroconVariant.rate * selectedAeroconVariant.coverage)}</strong>
                    <span>{selectedAeroconVariant.spec}</span>
                  </div>
                ) : (
                  <div className="aerocon-detail-price">
                    <small>Price</small>
                    <strong className="price-unavailable">Price on Request</strong>
                    <span>Current price is not present in the product catalogue.</span>
                  </div>
                )}
                <div className="aerocon-detail-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => addToCart(selectedAeroconVariant)}
                  >
                    <ShoppingCart size={16} /> Add to Cart
                  </button>
                  <button
                    type="button"
                    className="button button-pay"
                    onClick={() => buyNowProduct(selectedAeroconVariant)}
                  >
                    <CreditCard size={16} /> Buy Now
                  </button>
                </div>
              </div>
            </article>
          </section>
        )}

        {isCheckoutRoute ? cartPanel : <>
        <Estimator
          products={estimatorProducts}
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
        {cartPanel}
        </>}
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
