import { INITIAL_PRODUCTS } from './data.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  });

  let result = null;
  try {
    result = await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }

  if (!response.ok) {
    throw new Error(result?.detail || result?.title || `Request failed with status ${response.status}.`);
  }
  return result;
}

async function getCollection(path, signal) {
  const response = await fetch(`${API_BASE_URL}/${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;
    try {
      const problem = await response.json();
      detail = problem.detail || problem.title || detail;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    throw new Error(detail);
  }

  const result = await response.json();
  if (!Array.isArray(result)) {
    throw new Error(`The ${path} API returned an invalid response.`);
  }
  return result;
}

function getCoverage(specification, product) {
  const existingProduct = product && specification === product.spec ? product : null;
  if (existingProduct) return existingProduct.coverage;

  const dimensions = specification?.match(/(\d+(?:\.\d+)?)\s*ft\s*[×x]\s*(\d+(?:\.\d+)?)\s*ft/i);
  if (dimensions) return Number(dimensions[1]) * Number(dimensions[2]);

  const length = specification?.match(/^(\d+(?:\.\d+)?)\s*ft\b/i);
  return length ? Number(length[1]) : 1;
}

export async function loadCatalog(signal) {
  const [apiProducts, apiCategories] = await Promise.all([
    getCollection('Products', signal),
    getCollection('Categories', signal),
  ]);
  const activeCategories = apiCategories.filter((category) => category.isActive);
  const activeCategoryNames = new Set(activeCategories.map((category) => category.name));
  const categories = activeCategories.map((category) => category.name);
  const products = apiProducts
    .filter((product) => product.isActive && activeCategoryNames.has(product.categoryName))
    .map((product) => {
      const existingProduct = INITIAL_PRODUCTS.find((item) =>
        item.name === product.name && item.category === product.categoryName);
      const presentation = existingProduct || INITIAL_PRODUCTS.find((item) => item.category === product.categoryName);
      const coverage = getCoverage(product.specification, presentation);

      return {
        id: product.id,
        name: product.name,
        category: product.categoryName,
        spec: product.specification || product.unitOfMeasure,
        rate: Number(product.unitPrice) / coverage,
        coverage,
        description: product.description || '',
        tone: presentation?.tone || 'stone',
        image: presentation?.image,
        label: presentation?.label || product.categoryName,
        rating: presentation?.rating,
        reviewCount: presentation?.reviewCount,
      };
    });

  return { categories, products };
}

export async function loadPaymentOrder(orderNumber, signal) {
  return requestJson(`payments/orders/${encodeURIComponent(orderNumber)}`, { signal });
}

export async function createCheckoutOrder(checkout) {
  return requestJson('payments/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkout),
  });
}

export async function createPaymentIntent(orderNumber, paymentType, method = 'UPI') {
  return requestJson(`payments/orders/${encodeURIComponent(orderNumber)}/intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentType, method }),
  });
}

export async function markPaymentProcessing(paymentId) {
  return requestJson(`payments/transactions/${paymentId}/processing`, { method: 'POST' });
}

export async function loadPaymentStatus(paymentId) {
  return requestJson(`payments/transactions/${paymentId}`);
}
