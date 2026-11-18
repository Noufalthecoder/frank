// Hardware store product name & category translator (English -> Tamil)
// Preserves metric sizes, SKU codes, and technical abbreviations (mm, cm, m, kg, g, M8, PVC, GI, MS, SWG, SDS).

const CATEGORY_TA = {
  Fasteners: 'ஃபாஸ்டனர்கள்',
  Tools: 'கருவிகள்',
  Electrical: 'மின்சாரம்',
  Plumbing: 'பிளம்பிங்',
  'Paints & Adhesives': 'பெயிண்ட் & பசை',
  Others: 'மற்றவை',
  Hardware: 'ஹார்ட்வேர்',
};

// Multi-word hardware phrases (matched case-insensitively, longest first)
const PHRASE_MAP = [
  ['Heavy Duty Pipe Wrench', 'கனரக பைப் ரெஞ்ச்'],
  ['Insulated Combination Plier', 'இன்சுலேட்டட் காம்பினேஷன் பிளையர்'],
  ['SDS Plus Drill Bit', 'SDS பிளஸ் டிரில் பிட்'],
  ['HSS Twist Drill Bit', 'HSS டிரில் பிட்'],
  ['Masonry Drill Bit', 'கான்கிரீட் டிரில் பிட்'],
  ['Ball Peen Hammer', 'பால் பீன் சுத்தியல்'],
  ['Claw Hammer', 'ஆணி பிடுங்கும் சுத்தியல்'],
  ['Wooden Handle', 'மரக் கைப்பிடி'],
  ['Combination Spanner', 'காம்பினேஷன் ஸ்பேனர்'],
  ['Ring Spanner', 'ரிங் ஸ்பேனர்'],
  ['Double Open End Spanner', 'டபுள் எண்ட் ஸ்பேனர்'],
  ['Adjustable Spanner', 'அட்ஜஸ்டபிள் ஸ்பேனர்'],
  ['Combination Plier', 'காம்பினேஷன் பிளையர்'],
  ['Long Nose Plier', 'லாங் நோஸ் பிளையர்'],
  ['Diagonal Cutting Plier', 'வயர் கட்டிங் பிளையர்'],
  ['Water Pump Plier', 'வாட்டர் பம்ப் பிளையர்'],
  ['Pipe Wrench', 'பைப் ரெஞ்ச்'],
  ['Allen Key Set', 'ஆலன் கீ செட்'],
  ['Allen Key', 'ஆலன் கீ'],
  ['Hex Key', 'ஹெக்ஸ் கீ'],
  ['Screwdriver Set', 'ஸ்க்ரூடிரைவர் செட்'],
  ['Measuring Tape', 'அளவீட்டு டேப்'],
  ['Spirit Level', 'ஸ்பிரிட் லெவல்'],
  ['Hacksaw Frame', 'ஹேக்சா பிரேம்'],
  ['Hacksaw Blade', 'ஹேக்சா பிளேடு'],
  ['Cutting Disc', 'கட்டிங் டிஸ்க்'],
  ['Grinding Wheel', 'கிரைண்டிங் வீல்'],
  ['Diamond Blade', 'டைமண்ட் பிளேடு'],
  ['Flat Paint Brush', 'பிளாட் பெயிண்ட் பிரஷ்'],
  ['Paint Brush', 'பெயிண்ட் பிரஷ்'],
  ['Paint Roller', 'பெயிண்ட் ரோலர்'],
  ['Copper House Wire', 'காப்பர் ஹவுஸ் வயர்'],
  ['Enamelled Copper Winding Wire', 'காப்பர் வைண்டிங் கம்பி'],
  ['Copper Winding Wire', 'காப்பர் வைண்டிங் கம்பி'],
  ['GI Binding Wire', 'GI பைண்டிங் கம்பி'],
  ['Steel Binding Wire', 'ஸ்டீல் பைண்டிங் கம்பி'],
  ['Binding Wire', 'பைண்டிங் கம்பி'],
  ['Nylon Braided Rope', 'நைலான் பின்னல் கயிறு'],
  ['Braided Hose Pipe', 'பின்னல் ஹோஸ் பைப்'],
  ['Hose Pipe', 'ஹோஸ் பைப்'],
  ['MS Wire Nails', 'MS இரும்பு ஆணி'],
  ['Wire Nails', 'இரும்பு ஆணி'],
  ['Hex Bolt', 'ஹெக்ஸ் போல்ட்'],
  ['Hex Nut', 'ஹெக்ஸ் நட்'],
  ['Flat Washer', 'பிளாட் வாஷர்'],
  ['Spring Washer', 'ஸ்பிரிங் வாஷர்'],
  ['Drywall Screw', 'டிரைவால் திருகு'],
  ['Self Drilling Screw', 'செல்ஃப் டிரில்லிங் திருகு'],
  ['Wood Screw', 'மரத் திருகு'],
  ['Machine Screw', 'மெஷின் திருகு'],
  ['Modular Switch', 'மாடுலர் சுவிட்ச்'],
  ['PVC Insulation Tape', 'PVC இன்சுலேஷன் டேப்'],
  ['Insulation Tape', 'இன்சுலேஷன் டேப்'],
  ['Teflon Thread Seal Tape', 'டெஃப்லான் சீல் டேப்'],
  ['PVC Solvent Cement', 'PVC சால்வென்ட் சிமெண்ட்'],
  ['PVC Pipe', 'PVC பைப்'],
  ['PVC Elbow', 'PVC எல்போ'],
  ['Fevicol SH Resin Adhesive', 'ஃபெவிகால் SH பசை'],
  ['M-Seal Epoxy Compound', 'எம்-சீல் எபோக்சி'],
  ['Red Oxide Metal Primer', 'ரெட் ஆக்சைடு பிரைமர்'],
  ['Brass Gate Valve', 'பித்தளை கேட் வால்வு'],
  ['Gate Valve', 'கேட் வால்வு'],
  ['Ball Valve', 'பால் வால்வு'],
  ['Silver Brazing Flux', 'சில்வர் பிரேசிங் ஃபிளக்ஸ்'],
  ['Brazing Flux', 'பிரேசிங் ஃபிளக்ஸ்'],
  ['Fine Powder', 'நுண்ணிய பொடி'],
  ['Cold Chisel', 'இரும்பு உளி'],
  ['Wood Chisel', 'மர உளி'],
  ['Steel Scale', 'ஸ்டீல் அளவுகோல்'],
  ['Tin Snip', 'டின் கட்டர்'],
  ['Wire Stripper', 'வயர் ஸ்ட்ரிப்பர்'],
  ['Socket Set', 'சாக்கெட் செட்'],
];

// Single-word hardware vocabulary fallback
const WORD_MAP = {
  brass: 'பித்தளை',
  steel: 'ஸ்டீல்',
  stainless: 'ஸ்டெயின்லெஸ்',
  iron: 'இரும்பு',
  copper: 'காப்பர்',
  silver: 'சில்வர்',
  aluminium: 'அலுமினியம்',
  aluminum: 'அலுமினியம்',
  plastic: 'பிளாஸ்டிக்',
  nylon: 'நைலான்',
  rubber: 'ரப்பர்',
  wood: 'மரம்',
  wooden: 'மர',
  metal: 'உலோகம்',
  concrete: 'கான்கிரீட்',
  glass: 'கண்ணாடி',
  ceramic: 'செராமிக்',
  chrome: 'குரோம்',
  pipe: 'பைப்',
  hose: 'ஹோஸ்',
  wire: 'கம்பி',
  cable: 'கேபிள்',
  rope: 'கயிறு',
  chain: 'சங்கிலி',
  bolt: 'போல்ட்',
  bolts: 'போல்ட்',
  nut: 'நட்',
  nuts: 'நட்',
  washer: 'வாஷர்',
  screw: 'திருகு',
  screws: 'திருகுகள்',
  nail: 'ஆணி',
  nails: 'ஆணிகள்',
  anchor: 'ஆங்கர்',
  rivet: 'ரிவெட்',
  clamp: 'கிளாம்ப்',
  clip: 'கிளிப்',
  hook: 'கொக்கி',
  hinge: 'கீல்',
  lock: 'பூட்டு',
  padlock: 'பூட்டு',
  handle: 'கைப்பிடி',
  knob: 'கைப்பிடி',
  valve: 'வால்வு',
  tap: 'குழாய்',
  elbow: 'எல்போ',
  tee: 'டீ',
  coupler: 'கப்ளர்',
  union: 'யூனியன்',
  flange: 'பிளான்ஜ்',
  nipple: 'நிப்பிள்',
  reducer: 'ரெடியூசர்',
  hammer: 'சுத்தியல்',
  spanner: 'ஸ்பேனர்',
  wrench: 'ரெஞ்ச்',
  plier: 'பிளையர்',
  pliers: 'பிளையர்',
  cutter: 'கட்டர்',
  screwdriver: 'ஸ்க்ரூடிரைவர்',
  drill: 'டிரில்',
  bit: 'பிட்',
  blade: 'பிளேடு',
  disc: 'டிஸ்க்',
  wheel: 'சக்கரம்',
  chisel: 'உளி',
  file: 'அரம்',
  saw: 'ரம்பம்',
  hacksaw: 'ஹேக்சா',
  tape: 'டேப்',
  level: 'லெவல்',
  scale: 'அளவுகோல்',
  brush: 'பிரஷ்',
  roller: 'ரோலர்',
  paint: 'பெயிண்ட்',
  primer: 'பிரைமர்',
  putty: 'புட்டி',
  cement: 'சிமெண்ட்',
  adhesive: 'பசை',
  glue: 'பசை',
  epoxy: 'எபோக்சி',
  sealant: 'சீலண்ட்',
  flux: 'ஃபிளக்ஸ்',
  solder: 'சால்டர்',
  powder: 'பொடி',
  switch: 'சுவிட்ச்',
  socket: 'சாக்கெட்',
  plug: 'பிளக்',
  holder: 'ஹோல்டர்',
  bulb: 'பல்ப்',
  fan: 'மின்விசிறி',
  box: 'பெட்டி',
  board: 'போர்டு',
  sheet: 'தாள்',
  rod: 'கம்பி',
  bar: 'கம்பி',
  angle: 'ஆங்கிள்',
  mesh: 'வலை',
  net: 'வலை',
  filter: 'வடிகட்டி',
  gasket: 'கேஸ்கெட்',
  bearing: 'பேரிங்',
  spring: 'ஸ்பிரிங்',
  oil: 'எண்ணெய்',
  grease: 'கிரீஸ்',
  polish: 'பாலிஷ்',
  thinner: 'தின்னர்',
  sandpaper: 'உப்புத்தாள்',
  gloves: 'கையுறை',
  helmet: 'தலைக்கவசம்',
  goggles: 'கண்ணாடி',
  braided: 'பின்னல்',
  brazing: 'பிரேசிங்',
  binding: 'பைண்டிங்',
  winding: 'வைண்டிங்',
  cutting: 'கட்டிங்',
  grinding: 'கிரைண்டிங்',
  drilling: 'டிரில்லிங்',
  heavy: 'கனரக',
  duty: 'டியூட்டி',
  flat: 'தட்டை',
  round: 'உருண்டை',
  square: 'சதுர',
  long: 'நீள',
  short: 'குட்டை',
  small: 'சிறிய',
  medium: 'நடுத்தர',
  large: 'பெரிய',
  big: 'பெரிய',
  fine: 'நுண்ணிய',
  rough: 'சொரசொரப்பான',
  loose: 'தனி',
  set: 'செட்',
  kit: 'கிட்',
  pack: 'பேக்',
  pair: 'ஜோடி',
  roll: 'ரோல்',
  gauge: 'கேஜ்',
  class: 'கிளாஸ்',
  grade: 'கிரேடு',
  inch: 'அங்குலம்',
  litre: 'லிட்டர்',
  liter: 'லிட்டர்',
  red: 'சிவப்பு',
  black: 'கருப்பு',
  white: 'வெள்ளை',
  blue: 'நீலம்',
  green: 'பச்சை',
  yellow: 'மஞ்சள்',
  grey: 'சாம்பல்',
  gray: 'சாம்பல்',
  brown: 'பழுப்பு',
  orange: 'ஆரஞ்சு',
  insulated: 'இன்சுலேட்டட்',
  modular: 'மாடுலர்',
  standard: 'ஸ்டாண்டர்ட்',
  double: 'இரட்டை',
  single: 'ஒற்றை',
  way: 'வே',
  deg: '°',
  generic: 'ஜெனரிக்',
  pcs: 'எண்ணிக்கை',
  water: 'தண்ணீர்',
  garden: 'கார்டன்',
  joint: 'ஜாயிண்ட்',
  gate: 'கேட்',
  ball: 'பால்',
  connector: 'கனெக்டர்',
  adapter: 'அடாப்டர்',
  motor: 'மோட்டார்',
  pump: 'பம்ப்',
  tank: 'டேங்க்',
  door: 'கதவு',
  window: 'ஜன்னல்',
  key: 'சாவி',
  ladder: 'ஏணி',
  bucket: 'பக்கெட்',
  roof: 'கூரை',
  tile: 'டைல்ஸ்',
  tiles: 'டைல்ஸ்',
  sand: 'மணல்',
  stone: 'கல்',
  wall: 'சுவர்',
  floor: 'தரை',
  woodwork: 'மரவேலை',
  plumbing: 'பிளம்பிங்',
  electrical: 'மின்சாரம்',
  hardware: 'ஹார்ட்வேர்',
};

// Tanglish (Romanized Tamil) & everyday Tamil shop aliases -> canonical English + Tamil tokens
const TANGLISH_ALIASES = [
  { ta: ['கம்பி', 'வயர்'], en: ['wire', 'rod', 'bar', 'cable'], tanglish: ['kambi', 'kampi', 'vayar', 'wire'] },
  { ta: ['சுத்தியல்'], en: ['hammer'], tanglish: ['suthiyal', 'suthil', 'suthi'] },
  { ta: ['ஆணி', 'ஆணிகள்'], en: ['nail', 'nails'], tanglish: ['aani', 'ani'] },
  { ta: ['திருகு', 'திருகுகள்'], en: ['screw', 'screws'], tanglish: ['thirugu', 'tirugu', 'skru'] },
  { ta: ['குழாய்', 'பைப்', 'ஹோஸ்'], en: ['pipe', 'hose', 'tap'], tanglish: ['kuzhai', 'kulai', 'kuzhaye', 'paip'] },
  { ta: ['தண்ணீர்', 'நீர்'], en: ['water'], tanglish: ['thanni', 'tanni', 'thanneer', 'neer'] },
  { ta: ['பித்தளை'], en: ['brass'], tanglish: ['pithalai', 'pitalai', 'pithala'] },
  { ta: ['செம்பு', 'காப்பர்'], en: ['copper'], tanglish: ['sembu', 'chempu', 'sempu', 'koppar'] },
  { ta: ['இரும்பு', 'ஸ்டீல்'], en: ['iron', 'steel', 'metal'], tanglish: ['irumbu', 'irumpu', 'steel'] },
  { ta: ['பசை'], en: ['glue', 'adhesive', 'fevicol', 'epoxy'], tanglish: ['pasai', 'pasa'] },
  { ta: ['பூட்டு'], en: ['lock', 'padlock'], tanglish: ['poottu', 'pootu', 'puttu'] },
  { ta: ['சாவி'], en: ['key', 'spanner'], tanglish: ['saavi', 'savi', 'chavi'] },
  { ta: ['கயிறு'], en: ['rope'], tanglish: ['kayiru', 'kairu'] },
  { ta: ['சங்கிலி'], en: ['chain'], tanglish: ['sangili', 'changili'] },
  { ta: ['உளி'], en: ['chisel'], tanglish: ['uli'] },
  { ta: ['ரம்பம்'], en: ['saw', 'hacksaw'], tanglish: ['rambam', 'rampam'] },
  { ta: ['அரம்'], en: ['file'], tanglish: ['aram'] },
  { ta: ['பெயிண்ட்', 'வர்ணம்'], en: ['paint', 'primer'], tanglish: ['paint', 'varnam'] },
  { ta: ['பிரஷ்', 'தூரிகை'], en: ['brush'], tanglish: ['brush', 'thoorigai'] },
  { ta: ['கண்ணாடி'], en: ['glass', 'goggles'], tanglish: ['kannadi', 'kanadi'] },
  { ta: ['மரம்', 'மர'], en: ['wood', 'wooden'], tanglish: ['maram', 'mara'] },
  { ta: ['கதவு'], en: ['door'], tanglish: ['kathavu', 'kadhavu'] },
  { ta: ['ஜன்னல்'], en: ['window'], tanglish: ['jannal'] },
  { ta: ['ஏணி'], en: ['ladder'], tanglish: ['eni', 'yeni'] },
  { ta: ['கருவிகள்'], en: ['tools', 'tool'], tanglish: ['karuvigal', 'karuvi'] },
  { ta: ['மின்சாரம்'], en: ['electrical', 'electric'], tanglish: ['minsaram', 'current'] },
  { ta: ['வலை'], en: ['mesh', 'net'], tanglish: ['valai', 'vala'] },
  { ta: ['கீல்'], en: ['hinge'], tanglish: ['keel', 'kil'] },
  { ta: ['கொக்கி'], en: ['hook'], tanglish: ['kokki', 'koki'] },
  { ta: ['கைப்பிடி'], en: ['handle', 'knob'], tanglish: ['kaipidi', 'kaippidi'] },
  { ta: ['எண்ணெய்'], en: ['oil'], tanglish: ['ennai', 'yennai'] },
  { ta: ['கையுறை'], en: ['gloves'], tanglish: ['kaiyurai'] },
  { ta: ['தலைக்கவசம்'], en: ['helmet'], tanglish: ['thalaikavasam'] },
  { ta: ['அளவுகோல்'], en: ['scale', 'ruler'], tanglish: ['alavukol'] },
  { ta: ['நுண்ணிய', 'பொடி'], en: ['fine', 'powder'], tanglish: ['podi'] },
  { ta: ['போல்ட்'], en: ['bolt', 'bolts'], tanglish: ['bolt'] },
  { ta: ['நட்'], en: ['nut', 'nuts'], tanglish: ['nut', 'nattu', 'marai'] },
  { ta: ['வாஷர்'], en: ['washer'], tanglish: ['washer'] },
  { ta: ['ஸ்பேனர்', 'ரெஞ்ச்'], en: ['spanner', 'wrench'], tanglish: ['spanner', 'wrench'] },
  { ta: ['பிளையர்'], en: ['plier', 'pliers'], tanglish: ['plier', 'cutting'] },
  { ta: ['டிரில்'], en: ['drill'], tanglish: ['drill'] },
  { ta: ['வால்வு'], en: ['valve'], tanglish: ['valve'] },
  { ta: ['எல்போ'], en: ['elbow'], tanglish: ['elbow'] },
];

// Build reverse map (Tamil word -> English words) from PHRASE_MAP, WORD_MAP, and CATEGORY_TA
const REVERSE_TA_TO_EN = (() => {
  const map = new Map();
  const add = (ta, en) => {
    const key = String(ta || '').trim();
    if (!key) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(String(en || '').toLowerCase());
  };
  Object.entries(WORD_MAP).forEach(([en, ta]) => add(ta, en));
  Object.entries(CATEGORY_TA).forEach(([en, ta]) => add(ta, en));
  PHRASE_MAP.forEach(([en, ta]) => add(ta, en));
  TANGLISH_ALIASES.forEach(({ ta, en, tanglish }) => {
    ta.forEach((t) => {
      en.forEach((e) => add(t, e));
      tanglish.forEach((tg) => add(t, tg));
    });
  });
  return map;
})();

/**
 * Returns rich bilingual search fields (English + Tamil + Tanglish synonyms)
 * so searching in English, Tanglish, or Tamil always finds the closest product
 * regardless of the active UI language or whether the product was saved in English or Tamil.
 */
export function getBilingualSearchFields(item) {
  if (!item) return [];
  const rawName = String(item.name || '');
  const taName = translateProductName(rawName, 'ta');
  const rawCat = String(item.category || '');
  const taCat = translateCategory(rawCat, 'ta');

  const extraTokens = new Set();
  const combinedLower = `${rawName} ${rawCat}`.toLowerCase();
  const combinedTa = `${rawName} ${taName} ${taCat}`;

  // Expand English/Tamil/Tanglish aliases bidirectionally
  for (const entry of TANGLISH_ALIASES) {
    const hitEn = entry.en.some((w) => combinedLower.includes(w));
    const hitTa = entry.ta.some((w) => combinedTa.includes(w));
    if (hitEn || hitTa) {
      entry.en.forEach((w) => extraTokens.add(w));
      entry.ta.forEach((w) => extraTokens.add(w));
      entry.tanglish.forEach((w) => extraTokens.add(w));
    }
  }

  // If product name contains Tamil script directly, also inject English equivalents from reverse map
  if (/[\u0B80-\u0BFF]/.test(rawName)) {
    for (const [taKey, enSet] of REVERSE_TA_TO_EN.entries()) {
      if (rawName.includes(taKey)) {
        enSet.forEach((e) => extraTokens.add(e));
      }
    }
  }

  return [
    rawName,
    taName,
    item.size,
    item.brand,
    rawCat,
    taCat,
    Array.from(extraTokens).join(' '),
    item.bin_id,
    item.sku,
  ];
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function translateCategory(category, lang) {
  if (!category) return '';
  if (lang !== 'ta') return category;
  return CATEGORY_TA[category] || category;
}

export function translateProductName(name, lang) {
  if (!name) return '';
  if (lang !== 'ta') return name;
  // If already contains Tamil Unicode characters, keep as-is
  if (/[\u0B80-\u0BFF]/.test(name)) return name;

  let result = String(name);

  // 1. Replace multi-word hardware phrases first
  for (const [en, ta] of PHRASE_MAP) {
    const regex = new RegExp(`\\b${escapeRegExp(en)}\\b`, 'gi');
    result = result.replace(regex, ta);
  }

  // 2. Replace remaining known English hardware words
  result = result.replace(/\b([A-Za-z]+)\b/g, (match) => {
    const lower = match.toLowerCase();
    if (WORD_MAP[lower]) return WORD_MAP[lower];
    return match;
  });

  return result;
}
