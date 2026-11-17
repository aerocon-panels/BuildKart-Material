import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AEROCON_75_VARIANTS,
  AEROCON_CATEGORY_PATH,
  getAerocon75Variants,
  getAeroconRoute,
  getAeroconVariants,
  isAeroconSizeVariant,
} from './aeroconProducts.js';

test('exposes exactly the two requested Aerocon variants', () => {
  const variants = getAeroconVariants([{
    id: 'existing-75mm-panel',
    name: 'Aerocon Sandwich Partition Panels',
    category: 'Aerocon Panels',
    spec: '75mm Thickness • 8ft x 2ft',
    rate: 85,
    coverage: 16,
  }]);

  assert.equal(variants.length, 2);
  assert.deepEqual(variants.map(({ name }) => name), [
    'Aerocon Sandwich Partition Panel – 75mm',
    'Aerocon Sandwich Partition Panel – 50mm',
  ]);
  assert.equal(variants[0].priceAvailable, true);
  assert.notEqual(variants[0].id, 'existing-75mm-panel');
  assert.equal(variants[1].priceAvailable, false);
});

test('exposes three independently priced 75mm panel sizes', () => {
  const variants = getAerocon75Variants([]);

  assert.equal(variants.length, 3);
  assert.deepEqual(variants.map(({ name }) => name), [
    'Aerocon Sandwich Partition Panel – 8ft',
    'Aerocon Sandwich Partition Panel – 9ft',
    'Aerocon Sandwich Partition Panel – 10ft',
  ]);
  assert.deepEqual(variants.map(({ dimensions, coverage, rate }) => [dimensions, coverage, rate * coverage]), [
    ['8ft × 2ft', 16, 1360],
    ['9ft × 2ft', 18, 1530],
    ['10ft × 2ft', 20, 1700],
  ]);
  assert.equal(new Set(variants.map(({ id }) => id)).size, 3);
  assert.equal(new Set(variants.map(({ sku }) => sku)).size, 3);
  assert.deepEqual(variants.map(({ image }) => image), [
    '/product-images/75mm/Aerocon_Panel_8x2ft.png',
    '/product-images/75mm/Aerocon_Panel_9x2ft.png',
    '/product-images/75mm/Aerocon_Panel_10x2ft.png',
  ]);
  const descriptions = variants.map(({ description }) => description);
  assert.equal(new Set(descriptions).size, 3);
  assert.ok(descriptions.every((description) => description.length >= 180));
  assert.ok(variants.every(isAeroconSizeVariant));
});

test('uses active database image URLs for matching Aerocon image keys', () => {
  const imageUrl = '/product-images/75mm/uploaded-8ft.png';
  const variants = getAerocon75Variants([], [{
    image: 'aerocon-sandwich-partition-panel-75mm-8ft',
    thickness: '75mm',
    sizeLabel: '8ft',
    imageUrl,
    isActive: true,
  }]);

  assert.equal(variants[0].image, imageUrl);
  assert.equal(variants[1].image, '/product-images/75mm/Aerocon_Panel_9x2ft.png');
});

test('uses database image URLs on the Aerocon thickness cards', () => {
  const variants = getAeroconVariants([], [
    {
      image: 'aerocon-sandwich-partition-panel-75mm',
      thickness: '75mm',
      imageUrl: '/product-images/75mm/uploaded-75mm.png',
      isActive: true,
    },
    {
      image: 'aerocon-sandwich-partition-panel-50mm',
      thickness: '50mm',
      imageUrl: '/product-images/50mm/uploaded-50mm.png',
      isActive: true,
    },
  ]);

  assert.deepEqual(variants.map(({ image }) => image), [
    '/product-images/75mm/uploaded-75mm.png',
    '/product-images/50mm/uploaded-50mm.png',
  ]);
});

test('uses supplied 75mm size data and the catalog price for the 50mm variant', () => {
  const variants = getAeroconVariants([
    {
      id: 42,
      name: 'Aerocon Sandwich Panel',
      category: 'Aerocon Panels',
      spec: '50mm - 8ft x 2ft',
      rate: 85,
      coverage: 16,
      image: '/product-images/material-1.jpg',
      description: 'Lightweight insulated panel for partitions and exterior walls.',
    },
  ]);

  assert.equal(variants[0].priceAvailable, true);
  assert.equal(variants[1].priceAvailable, true);
  assert.equal(variants[1].id, 42);
  assert.equal(variants[1].rate * variants[1].coverage, 1360);
});

test('uses catalog price and IDs for each exact Aerocon size SKU', () => {
  const products = AEROCON_75_VARIANTS.map((variant, index) => ({
    id: index + 10,
    sku: variant.sku,
    name: variant.name,
    category: 'Aerocon Panels',
    spec: `75mm - ${variant.dimensions.replace('×', 'x')}`,
    rate: 85,
    coverage: variant.coverage,
    image: '/product-images/material-1.jpg',
  }));
  const variants = getAerocon75Variants(products);

  assert.deepEqual(variants.map(({ id, rate, coverage }) => [id, rate * coverage]), [
    [10, 1360],
    [11, 1530],
    [12, 1700],
  ]);
  assert.deepEqual(variants.map(({ image }) => image), [
    '/product-images/75mm/Aerocon_Panel_8x2ft.png',
    '/product-images/75mm/Aerocon_Panel_9x2ft.png',
    '/product-images/75mm/Aerocon_Panel_10x2ft.png',
  ]);
});

test('maps previously saved 1.75mm SKUs to their 75mm variants', () => {
  const products = AEROCON_75_VARIANTS.map((variant, index) => ({
    id: index + 20,
    sku: variant.sku.replace('-75-', '-175-'),
    name: variant.name,
    category: 'Aerocon Panels',
    spec: `75mm - ${variant.dimensions.replace('×', 'x')}`,
    rate: 85,
    coverage: variant.coverage,
  }));
  const variants = getAerocon75Variants(products);

  assert.deepEqual(variants.map(({ sku }) => sku), AEROCON_75_VARIANTS.map(({ sku }) => sku));
  assert.deepEqual(variants.map(({ id }) => id), [20, 21, 22]);
  assert.ok(isAeroconSizeVariant({ sku: 'AEROCON-SANDWICH-175-8FT' }));
});

test('maps category and individual product paths', () => {
  assert.deepEqual(getAeroconRoute(AEROCON_CATEGORY_PATH), { type: 'category' });
  assert.deepEqual(getAeroconRoute('/products/aerocon-sandwich-partition-panel-75mm'), {
    type: 'size-list',
    slug: 'aerocon-sandwich-partition-panel-75mm',
  });
  assert.deepEqual(getAeroconRoute('/products/aerocon-sandwich-partition-panel-175mm'), {
    type: 'size-list',
    slug: 'aerocon-sandwich-partition-panel-75mm',
  });
  AEROCON_75_VARIANTS.forEach(({ path, sku }) => {
    assert.deepEqual(getAeroconRoute(path), { type: 'size-detail', sku });
    assert.deepEqual(getAeroconRoute(path.replace('-75mm-', '-175mm-')), { type: 'size-detail', sku });
  });
  assert.deepEqual(getAeroconRoute('/products/aerocon-sandwich-partition-panel-50mm'), {
    type: 'product',
    slug: 'aerocon-sandwich-partition-panel-50mm',
  });
  assert.equal(getAeroconRoute('/products/unknown'), null);
});
