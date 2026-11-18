// Category-aware rack suggestions.
// A bin is "usable" for a category when it is empty, or already holds only that category.
// A rack "matches" when it already stores that category. Racks with no usable bin are hidden.

const norm = (c) => String(c || '').trim().toLowerCase();

export function binIsUsable(bin, category, keepBin = '') {
  const items = bin.items || [];
  if (keepBin && String(bin.bin_code).toUpperCase() === String(keepBin).toUpperCase()) return true;
  if (items.length === 0) return true;
  return items.every((i) => norm(i.category) === norm(category));
}

export function rackMatchesCategory(rack, category) {
  return (rack.bins || []).some((b) => (b.items || []).some((i) => norm(i.category) === norm(category)));
}

/** Racks to offer for `category`: same-category racks first, then racks with free space. */
export function racksForCategory(racks, category, keepBin = '') {
  if (!category) return racks || [];
  const out = [];
  for (const r of racks || []) {
    const bins = (r.bins || []).filter((b) => binIsUsable(b, category, keepBin));
    if (bins.length === 0) continue;
    out.push({
      ...r,
      bins,
      _match: rackMatchesCategory(r, category),
      _free: bins.filter((b) => (b.items || []).length === 0).length,
    });
  }
  return out.sort((a, b) => Number(b._match) - Number(a._match));
}

/** Best default bin code for a category ('' when nothing fits). */
export function suggestBin(racks, category) {
  const list = racksForCategory(racks, category);
  for (const r of list) {
    if (!r._match) continue;
    const free = r.bins.find((b) => (b.items || []).length === 0);
    if (free) return free.bin_code;
  }
  for (const r of list) {
    if (!r._match) continue;
    if (r.bins[0]) return r.bins[0].bin_code;
  }
  for (const r of list) {
    const free = r.bins.find((b) => (b.items || []).length === 0);
    if (free) return free.bin_code;
  }
  return '';
}
