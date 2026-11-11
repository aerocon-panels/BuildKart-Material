export const CATEGORIES = [
  'Aerocon Panels',
  'Bison Boards',
  'Roofing Sheets',
  'Elevation Planks',
];

export const INITIAL_PRODUCTS = [
  {
    id: 'aerocon-sandwich-panel',
    name: 'Aerocon Sandwich Panel',
    category: 'Aerocon Panels',
    spec: '50mm · 8ft × 2ft',
    rate: 85,
    coverage: 16,
    description: 'Lightweight insulated panel for partitions and exterior walls.',
    tone: 'sand',
  },
  {
    id: 'bison-cement-board',
    name: 'Bison Cement Board',
    category: 'Bison Boards',
    spec: '12mm · 8ft × 4ft',
    rate: 58,
    coverage: 32,
    description: 'Durable fibre cement board for interior and exterior use.',
    tone: 'stone',
  },
  {
    id: 'colour-coated-roofing-sheet',
    name: 'Colour Coated Roofing Sheet',
    category: 'Roofing Sheets',
    spec: '0.45mm · custom length',
    rate: 72,
    coverage: 1,
    description: 'Weather-resistant roofing sheet for a practical roof finish.',
    tone: 'roof',
  },
  {
    id: 'exterior-elevation-plank',
    name: 'Exterior Elevation Plank',
    category: 'Elevation Planks',
    spec: '8ft · wood finish',
    rate: 95,
    coverage: 8,
    description: 'Decorative plank for contemporary building elevations.',
    tone: 'wood',
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
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}
