const API_BASE = 'https://buildkart-api.saas-agency2021.workers.dev/api/';

async function request(path, options) {
  const response = await fetch(API_BASE + path, options);
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error((data && data.error) || `Request failed (${response.status})`);
  }
  return data;
}

const post = (path, payload) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });

export function createCheckoutOrder(checkout) {
  return post('payments/checkout', checkout);
}

export function loadPaymentOrder(orderNumber) {
  return request(`payments/orders/${encodeURIComponent(orderNumber)}`);
}

export function createPaymentIntent(orderNumber, paymentType) {
  return post('payments/intents', { orderNumber, paymentType });
}

export function markPaymentProcessing(paymentId) {
  return post(`payments/${paymentId}/processing`, {});
}

export function loadPaymentStatus(paymentId) {
  return request(`payments/${paymentId}/status`);
}

export async function uploadProductImage() {
  throw new Error('Image upload is not connected to the new server yet.');
}

export function loadProductImages(signal) {
  return request('product-images', { signal });
}

export function signUpCustomer(payload) {
  return post('customer-signup', payload);
}

export async function loadCatalog(signal) {
  const [categoryRows, productRows] = await Promise.all([
    request('categories', { signal }),
    request('products', { signal }),
  ]);
  const categories = categoryRows
    .filter((c) => c.isActive)
    .map((c) => c.name);
  const products = productRows.map((p) => ({
    ...p,
    category: p.categoryName,
    price: p.unitPrice,
  }));
  return { categories, products };
}