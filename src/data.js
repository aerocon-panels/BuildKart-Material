export const CATEGORIES = [
  'Aerocon Panels',
  'Bison Boards',
  'Roofing Sheets',
  'Elevation Planks',
];

export const BISON_BOARDS_CATEGORY_PATH = '/categories/bison-cement-bonded-particle-boards';

export const INITIAL_PRODUCTS = [
  {
    id: 'aerocon-sandwich-panel',
    name: 'Aerocon Sandwich Partition Panels',
    category: 'Aerocon Panels',
    spec: '75mm Thickness • 8ft x 2ft • Tongue & Groove',
    rate: 85,
    coverage: 16,
    description: 'Lightweight sandwich panel with core of aerated concrete. Fast installation, fire resistant, and sound insulating.',
    tone: 'sand',
    image: '/product-images/aerocon-sandwich-panel.jpeg',
    label: 'Wall Panels',
    rating: 4.8,
    reviewCount: 34,
  },
  {
    id: 'bison-cement-board',
    name: 'Cement Fiber Board',
    category: 'Bison Boards',
    spec: '12mm Heavy Grade • 8ft x 4ft Sheet',
    rate: 44,
    coverage: 32,
    description: 'High-density cement board combining the strength of cement with the workability of wood. Termite and weather proof.',
    tone: 'stone',
    image: '/product-images/cement_fiber_board.png',
    label: 'Cement Boards',
    rating: 4.9,
    reviewCount: 52,
  },
  {
    id: 'bison-cement-board-6mm',
    name: 'Cement Fiber Board - 6mm',
    category: 'Bison Boards',
    spec: '6mm Standard Grade • 8ft x 4ft Sheet',
    rate: 32,
    coverage: 32,
    description: 'Lightweight cement-bonded board for interior partitions, wall linings, and general-purpose building applications.',
    tone: 'stone',
    image: '/product-images/cement_fiber_board.png',
  },
  {
    id: 'bison-cement-board-8mm',
    name: 'Cement Fiber Board - 8mm',
    category: 'Bison Boards',
    spec: '8mm General Grade • 8ft x 4ft Sheet',
    rate: 38,
    coverage: 32,
    description: 'Versatile cement board for durable interior walls, ceilings, and partition work in residential and commercial spaces.',
    tone: 'stone',
    image: '/product-images/cement_fiber_board.png',
  },
  {
    id: 'bison-cement-board-16mm',
    name: 'Cement Fiber Board - 16mm',
    category: 'Bison Boards',
    spec: '16mm Heavy Grade • 8ft x 4ft Sheet',
    rate: 52,
    coverage: 32,
    description: 'Thicker cement-bonded board for applications that need a sturdy, durable sheet with reliable moisture resistance.',
    tone: 'stone',
    image: '/product-images/cement_fiber_board.png',
  },
  {
    id: 'bison-cement-board-18mm',
    name: 'Cement Fiber Board - 18mm',
    category: 'Bison Boards',
    spec: '18mm Extra Heavy Grade • 8ft x 4ft Sheet',
    rate: 58,
    coverage: 32,
    description: 'Extra-thick cement-bonded board for robust partitions and building applications requiring a heavier sheet.',
    tone: 'stone',
    image: '/product-images/cement_fiber_board.png',
  },
  {
    id: 'colour-coated-roofing-sheet',
    name: 'Color Coated Corrugated Roofing Sheets',
    category: 'Roofing Sheets',
    spec: '0.45mm TCT • 10ft Length x 3.25ft Profile',
    rate: 49,
    coverage: 32.5,
    description: 'Premium galvalume/pre-painted steel trapezoidal roof profiles. Corrosion resistant with high heat reflection.',
    tone: 'roof',
    image: '/product-images/material-3.jpg',
    label: 'Roofing',
    rating: 4.7,
    reviewCount: 29,
  },
  {
    id: 'exterior-elevation-plank',
    name: 'Fiber Cement Exterior Elevation Planks',
    category: 'Elevation Planks',
    spec: '8mm Wood Grain Texture • 8ft x 6in Plank',
    rate: 68,
    coverage: 4,
    description: 'Architectural exterior facade cladding with realistic natural cedar grain. Highly durable against rain, UV, and heat.',
    tone: 'wood',
    image: '/product-images/material-4.jpg',
    label: 'Elevation',
    rating: 4.9,
    reviewCount: 41,
  },
];

export function restoreAeroconDefaultRate(products) {
  return products.map((product) => (
    product.id === 'aerocon-sandwich-panel' && Number(product.rate) === 105
      ? { ...product, rate: 85 }
      : product
  ));
}

export function ensureBisonBoardProducts(products) {
  const seenIds = new Set();
  const seenNames = new Set();
  const uniqueProducts = products.filter((product) => {
    if (product.category !== 'Bison Boards') return true;

    const id = product.id === undefined ? '' : String(product.id);
    const name = product.name?.trim().toLowerCase() || '';
    if ((id && seenIds.has(id)) || (name && seenNames.has(name))) return false;
    if (id) seenIds.add(id);
    if (name) seenNames.add(name);
    return true;
  });
  const bisonProducts = uniqueProducts.filter((product) => product.category === 'Bison Boards');

  for (const product of INITIAL_PRODUCTS.filter((item) => item.category === 'Bison Boards')) {
    if (bisonProducts.length >= 5) break;
    const name = product.name.trim().toLowerCase();
    if (seenIds.has(String(product.id)) || seenNames.has(name)) continue;

    uniqueProducts.push(product);
    bisonProducts.push(product);
    seenIds.add(String(product.id));
    seenNames.add(name);
  }

  let hasParentProduct = false;
  return uniqueProducts.map((product) => {
    if (product.category !== 'Bison Boards') return product;
    const isBisonVariant = hasParentProduct;
    hasParentProduct = true;
    return { ...product, isBisonVariant };
  });
}

export const DEFAULT_SETTINGS = {
  phone: '919381789564',
  phone2: '919381789564',
  upi: '8317666756@upi',
  storeName: 'BuildKart Materials',
  location: 'Plot no 19, H.No. 1-121/19, Sonata Lane, Miyapur Allwin X Roads Signal, Chanda Nagar, Gachibowli - Miyapur Rd, Kondapur, Hafeezpet, Hyderabad, Telangana 500049',
  gstin: '',
};

export function readStorage(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.error(`Unable to read ${key} from browser storage.`, error);
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Unable to save ${key} to browser storage.`, error);
    return false;
  }
}

export function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}