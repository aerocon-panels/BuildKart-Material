import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ensureBisonBoardProducts,
  INITIAL_PRODUCTS,
  restoreAeroconDefaultRate,
} from './data.js';

test('fills a short Bison catalog to five unique product cards', () => {
  const products = ensureBisonBoardProducts([
    { ...INITIAL_PRODUCTS.find((product) => product.category === 'Bison Boards'), id: 101 },
    INITIAL_PRODUCTS.find((product) => product.category === 'Aerocon Panels'),
  ]);
  const bisonProducts = products.filter((product) => product.category === 'Bison Boards');

  assert.equal(bisonProducts.length, 5);
  assert.equal(new Set(bisonProducts.map((product) => product.name.toLowerCase())).size, 5);
  assert.equal(bisonProducts.filter((product) => product.isBisonVariant).length, 4);
  assert.equal(bisonProducts.filter((product) => !product.isBisonVariant).length, 1);
  assert.equal(products.filter((product) => product.category === 'Aerocon Panels').length, 1);
});

test('does not duplicate matching Bison products already supplied by the catalog', () => {
  const products = ensureBisonBoardProducts([
    ...INITIAL_PRODUCTS.filter((product) => product.category !== 'Bison Boards'),
    ...INITIAL_PRODUCTS.filter((product) => product.category === 'Bison Boards'),
  ]);
  const bisonProducts = products.filter((product) => product.category === 'Bison Boards');

  assert.equal(bisonProducts.length, 5);
  assert.equal(new Set(bisonProducts.map((product) => product.id)).size, 5);
});

test('restores the saved Aerocon parent rate without changing other products', () => {
  const products = restoreAeroconDefaultRate([
    { ...INITIAL_PRODUCTS[0], rate: 105 },
    { id: 'custom-aerocon', category: 'Aerocon Panels', rate: 105 },
  ]);

  assert.deepEqual(products.map(({ rate }) => rate), [85, 105]);
});

