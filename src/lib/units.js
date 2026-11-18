// Measurement unit system for hardware inventory & POS billing
// Supports Count (PCS, BOX, SET, PKT, ROLL), Length (m, cm), and Weight (kg, g, mg).

export const UNIT_GROUPS = {
  count: ['PCS', 'BOX', 'SET', 'PKT', 'ROLL'],
  length: ['m', 'cm'],
  weight: ['kg', 'g', 'mg'],
};

export const UNIT_OPTIONS = [
  {
    group: 'Count',
    units: [
      { value: 'PCS', label: 'PCS (Pieces)' },
      { value: 'BOX', label: 'BOX' },
      { value: 'SET', label: 'SET' },
      { value: 'PKT', label: 'PKT (Packet)' },
      { value: 'ROLL', label: 'ROLL' },
    ],
  },
  {
    group: 'Length',
    units: [
      { value: 'm', label: 'm (Metre)' },
      { value: 'cm', label: 'cm (Centimetre)' },
    ],
  },
  {
    group: 'Weight',
    units: [
      { value: 'kg', label: 'kg (Kilogram)' },
      { value: 'g', label: 'g (Gram)' },
      { value: 'mg', label: 'mg (Milligram)' },
    ],
  },
];

// Conversion factors to each family's smallest unit (cm for length, mg for weight)
const LENGTH_TO_CM = {
  m: 100,
  cm: 1,
};

const WEIGHT_TO_MG = {
  kg: 1_000_000,
  g: 1_000,
  mg: 1,
};

export function normalizeUnit(unit) {
  const raw = String(unit || 'PCS').trim();
  const lower = raw.toLowerCase();
  if (lower === 'm' || lower === 'mtr' || lower === 'meter' || lower === 'metre' || lower === 'meters') return 'm';
  if (lower === 'cm' || lower === 'centimeter' || lower === 'centimetre') return 'cm';
  if (lower === 'kg' || lower === 'kgs' || lower === 'kilogram' || lower === 'kilograms') return 'kg';
  if (lower === 'g' || lower === 'gm' || lower === 'gms' || lower === 'gram' || lower === 'grams') return 'g';
  if (lower === 'mg' || lower === 'milligram' || lower === 'milligrams') return 'mg';
  return raw.toUpperCase() || 'PCS';
}

export function getUnitGroup(unit) {
  const norm = normalizeUnit(unit);
  if (norm === 'm' || norm === 'cm') return 'length';
  if (norm === 'kg' || norm === 'g' || norm === 'mg') return 'weight';
  return 'count';
}

export function isMeasurableUnit(unit) {
  const group = getUnitGroup(unit);
  return group === 'length' || group === 'weight';
}

export function getCompatibleUnits(unit) {
  const norm = normalizeUnit(unit);
  const group = getUnitGroup(norm);
  if (group === 'length') return UNIT_GROUPS.length;
  if (group === 'weight') return UNIT_GROUPS.weight;
  return [norm];
}

export function convertUnit(value, fromUnit, toUnit) {
  const num = Number(value);
  if (!isFinite(num)) return 0;

  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return num;

  if (from in LENGTH_TO_CM && to in LENGTH_TO_CM) {
    return Number(((num * LENGTH_TO_CM[from]) / LENGTH_TO_CM[to]).toFixed(6));
  }
  if (from in WEIGHT_TO_MG && to in WEIGHT_TO_MG) {
    return Number(((num * WEIGHT_TO_MG[from]) / WEIGHT_TO_MG[to]).toFixed(6));
  }
  return num;
}

export function formatQty(value) {
  const num = Number(value);
  if (!isFinite(num)) return '0';
  if (Number.isInteger(num)) return num.toLocaleString('en-IN');
  return Number(num.toFixed(4)).toLocaleString('en-IN', { maximumFractionDigits: 4 });
}
