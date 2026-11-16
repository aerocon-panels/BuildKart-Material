export const AEROCON_CATEGORY_PATH = '/categories/aerocon-sandwich-partition-panels';

export const AEROCON_VARIANTS = [
  {
    slug: 'aerocon-sandwich-partition-panel-75mm',
    name: 'Aerocon Sandwich Partition Panel – 75mm',
    thickness: '75mm',
    sku: 'AEROCON-SANDWICH-75-8FT',
  },
  {
    slug: 'aerocon-sandwich-partition-panel-50mm',
    name: 'Aerocon Sandwich Partition Panel – 50mm',
    thickness: '50mm',
    sku: 'AEROCON-SANDWICH-50',
  },
];

export const AEROCON_75_VARIANTS = [
  {
    sku: 'AEROCON-SANDWICH-75-8FT',
    id: 'aerocon-sandwich-partition-panel-75mm-8ft',
    name: 'Aerocon Sandwich Partition Panel – 8ft',
    thickness: '75mm',
    dimensions: '8ft × 2ft',
    coverage: 16,
    price: 1360,
    path: '/products/aerocon-sandwich-partition-panel-75mm-8ft',
    description: 'A practical choice for smaller partition sections and room layouts. Its lightweight 75mm aerated-concrete core offers fire resistance and sound insulation, while the 8ft × 2ft panel covers 16 SFT per piece for easy area planning.',
  },
  {
    sku: 'AEROCON-SANDWICH-75-9FT',
    id: 'aerocon-sandwich-partition-panel-75mm-9ft',
    name: 'Aerocon Sandwich Partition Panel – 9ft',
    thickness: '75mm',
    dimensions: '9ft × 2ft',
    coverage: 18,
    price: 1530,
    path: '/products/aerocon-sandwich-partition-panel-75mm-9ft',
    description: 'Use the 9ft panel for taller partition runs with fewer joints along the wall. The lightweight 75mm aerated-concrete construction provides fire resistance and sound insulation, and each 9ft × 2ft piece covers 18 SFT.',
  },
  {
    sku: 'AEROCON-SANDWICH-75-10FT',
    id: 'aerocon-sandwich-partition-panel-75mm-10ft',
    name: 'Aerocon Sandwich Partition Panel – 10ft',
    thickness: '75mm',
    dimensions: '10ft × 2ft',
    coverage: 20,
    price: 1700,
    path: '/products/aerocon-sandwich-partition-panel-75mm-10ft',
    description: 'The 10ft panel suits longer, uninterrupted partition sections and can reduce the number of joins across a wall. Its lightweight 75mm aerated-concrete core offers fire resistance and sound insulation, with 20 SFT covered per piece.',
  },
];

function hasThickness(product, thickness) {
  const searchText = `${product.name} ${product.spec}`;
  const escapedThickness = thickness.replace(/mm$/i, '').replace('.', '\\.');
  return new RegExp(`(^|[^\\d])${escapedThickness}\\s*mm\\b`, 'i').test(searchText);
}

function hasDimensions(product, dimensions) {
  const length = dimensions.match(/[\d.]+/)[0];
  const searchText = `${product.name} ${product.spec}`;
  return new RegExp(`(^|[^\\d])${length}\\s*ft\\s*[×x]\\s*2\\s*ft\\b`, 'i').test(searchText);
}

function findAeroconVariantSource(products, sku, thickness) {
  const aeroconProducts = products.filter((product) => /aerocon/i.test(product.category || ''));
  return aeroconProducts.find((product) => product.sku === sku)
    || aeroconProducts.find((product) => hasThickness(product, thickness));
}

export function getAerocon75Variants(products) {
  const aeroconProducts = products.filter((product) => /aerocon/i.test(product.category || ''));
  const fallbackProduct = aeroconProducts.find((product) => product.image) || aeroconProducts[0];
  const fallbackImage = fallbackProduct?.image || '/product-images/material-1.jpg';

  return AEROCON_75_VARIANTS.map((variant) => {
    const legacySku = variant.sku.replace('-75-', '-175-');
    const source = aeroconProducts.find((product) => product.sku === variant.sku || product.sku === legacySku)
      || aeroconProducts.find((product) => hasThickness(product, variant.thickness) && hasDimensions(product, variant.dimensions));
    const rate = source ? Number(source.rate) : variant.price / variant.coverage;
    const coverage = source ? Number(source.coverage) : variant.coverage;
    const priceAvailable = Number.isFinite(rate) && rate > 0 && Number.isFinite(coverage) && coverage > 0;

    return {
      ...source,
      id: source?.sku ? source.id : variant.id,
      sku: variant.sku,
      name: variant.name,
      category: 'Aerocon Panels',
      thickness: variant.thickness,
      dimensions: variant.dimensions,
      path: variant.path,
      spec: `Dimensions: ${variant.dimensions} · Area: ${coverage} SFT`,
      description: variant.description,
      image: source?.image || fallbackImage,
      tone: source?.tone || 'sand',
      label: source?.label || fallbackProduct?.label || 'Wall Panels',
      rating: source?.rating || fallbackProduct?.rating,
      reviewCount: source?.reviewCount || fallbackProduct?.reviewCount,
      rate: priceAvailable ? rate : null,
      coverage: priceAvailable ? coverage : null,
      priceAvailable,
    };
  });
}

export function getAeroconVariants(products) {
  const aeroconProducts = products.filter((product) => /aerocon/i.test(product.category || ''));
  const fallbackImage = aeroconProducts.find((product) => product.image)?.image || '/product-images/material-1.jpg';

  return AEROCON_VARIANTS.map((variant) => {
    const source = variant.thickness === '75mm'
      ? getAerocon75Variants(products)[0]
      : findAeroconVariantSource(products, variant.sku, variant.thickness);
    const rate = Number(source?.rate);
    const coverage = Number(source?.coverage);
    const priceAvailable = Number.isFinite(rate) && rate > 0 && Number.isFinite(coverage) && coverage > 0;

    return {
      ...source,
      id: source?.id || variant.slug,
      sku: source?.sku || variant.sku,
      name: variant.name,
      category: 'Aerocon Panels',
      thickness: variant.thickness,
      spec: source?.spec || `${variant.thickness} thickness`,
      description: source?.description || 'Description unavailable in the product catalogue.',
      image: source?.image || fallbackImage,
      tone: source?.tone || 'sand',
      label: 'Aerocon Panels',
      rate: priceAvailable ? rate : null,
      coverage: priceAvailable ? coverage : null,
      priceAvailable,
      path: `/products/${variant.slug}`,
    };
  });
}

export function getAeroconRoute(pathname) {
  if (pathname === AEROCON_CATEGORY_PATH) return { type: 'category' };

  const sizeVariant = AEROCON_75_VARIANTS.find((item) => (
    pathname === item.path || pathname === item.path.replace('-75mm-', '-175mm-')
  ));
  if (sizeVariant) return { type: 'size-detail', sku: sizeVariant.sku };

  if (pathname === '/products/aerocon-sandwich-partition-panel-175mm') {
    return { type: 'size-list', slug: AEROCON_VARIANTS[0].slug };
  }

  const variant = AEROCON_VARIANTS.find((item) => pathname === `/products/${item.slug}`);
  if (!variant) return null;
  return variant.thickness === '75mm'
    ? { type: 'size-list', slug: variant.slug }
    : { type: 'product', slug: variant.slug };
}

export function isAeroconSizeVariant(product) {
  return product.sku?.startsWith('AEROCON-SANDWICH-75-')
    || product.sku?.startsWith('AEROCON-SANDWICH-175-')
    || false;
}
