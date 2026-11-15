export const CATEGORIES = [
  'Aerocon Panels',
  'Bison Boards',
  'Roofing Sheets',
  'Elevation Planks',
];

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
    image: '/product-images/material-1.jpg',
    label: 'Wall Panels',
    rating: 4.8,
    reviewCount: 34,
  },
  {
    id: 'bison-cement-board',
    name: 'Bison Cement Bonded Particle Board',
    category: 'Bison Boards',
    spec: '12mm Heavy Grade • 8ft x 4ft Sheet',
    rate: 44,
    coverage: 32,
    description: 'High-density cement board combining the strength of cement with the workability of wood. Termite and weather proof.',
    tone: 'stone',
    image: '/product-images/material-2.jpg',
    label: 'Cement Boards',
    rating: 4.9,
    reviewCount: 52,
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

export const DEFAULT_SETTINGS = {
  phone: '918317666756',
  upi: '8317666756@upi',
  storeName: 'BuildKart Materials',
  location: 'Industrial Area, Phase 2, Hyderabad',
  gstin: '36AAAAA0000A1Z5',
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
