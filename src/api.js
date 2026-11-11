import { INITIAL_PRODUCTS } from './data.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

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
      const coverage = getCoverage(product.specification, existingProduct);

      return {
        id: product.id,
        name: product.name,
        category: product.categoryName,
        spec: product.specification || product.unitOfMeasure,
        rate: Number(product.unitPrice) / coverage,
        coverage,
        description: product.description || '',
        tone: existingProduct?.tone || 'stone',
      };
    });

  return { categories, products };
}
