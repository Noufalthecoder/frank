/**
 * Lightweight, zero-dependency fuzzy / closest-match search engine.
 * Ranks exact, prefix, multi-word, subsequence, and typo-tolerant (Levenshtein) matches
 * so shop staff always find the closest product even with spelling mistakes or shorthand.
 */

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0B80-\u0BFF\s./-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const alen = a.length;
  const blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;

  let prev = new Array(blen + 1);
  let curr = new Array(blen + 1);
  for (let j = 0; j <= blen; j++) prev[j] = j;

  for (let i = 1; i <= alen; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= blen; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[blen];
}

function isSubsequence(needle, haystack) {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (needle[i] === haystack[j]) i++;
  }
  return i === needle.length;
}

function scoreTokenAgainstWords(token, fullText, words) {
  if (!token) return 0;
  if (fullText === token) return 100;
  if (fullText.startsWith(token)) return 92;

  let best = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === token) return 96;
    if (w.startsWith(token)) {
      best = Math.max(best, 88);
      continue;
    }
    if (w.includes(token)) {
      best = Math.max(best, 78);
      continue;
    }

    // Typo tolerance via Levenshtein distance
    const maxDist = token.length <= 3 ? 1 : token.length <= 6 ? 2 : 3;
    // Compare against whole word AND prefix of word matching token length
    const distFull = levenshtein(token, w);
    const prefixSlice = w.slice(0, Math.min(w.length, token.length + 1));
    const distPrefix = levenshtein(token, prefixSlice);
    const dist = Math.min(distFull, distPrefix);

    if (dist <= maxDist) {
      const ratio = 1 - dist / Math.max(token.length, prefixSlice.length, 1);
      if (ratio >= 0.45) {
        best = Math.max(best, Math.round(45 + ratio * 35));
      }
    }
  }

  if (best === 0 && token.length >= 3) {
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.length <= token.length * 2 + 2 && isSubsequence(token, w)) {
        best = 46;
        break;
      }
    }
  }

  return best;
}

/**
 * Compute relevance score (0 = no match, higher = closer match) for a query against fields.
 */
export function fuzzyScore(query, fields = []) {
  const q = normalize(query);
  if (!q) return 1;

  const fieldTexts = fields
    .map((f) => normalize(f))
    .filter(Boolean);
  if (fieldTexts.length === 0) return 0;

  const combined = fieldTexts.join(' ');
  const words = combined.split(/[\s/-]+/).filter(Boolean);
  const queryTokens = q.split(/\s+/).filter(Boolean);

  // Direct full-query boost on primary field (usually product name)
  const primary = fieldTexts[0];
  if (primary === q) return 120;
  if (primary.startsWith(q)) return 110;
  if (primary.includes(q)) return 95;

  // Score every typed word and require reasonable overall closeness
  let total = 0;
  let matchedTokens = 0;
  for (const token of queryTokens) {
    const s = scoreTokenAgainstWords(token, combined, words);
    if (s > 0) {
      matchedTokens++;
      total += s;
    }
  }

  if (matchedTokens === 0) {
    // Last-resort whole-phrase typo check against primary field
    if (q.length >= 3) {
      const dist = levenshtein(q, primary.slice(0, Math.min(primary.length, q.length + 3)));
      const maxDist = Math.max(2, Math.floor(q.length * 0.4));
      if (dist <= maxDist) {
        return Math.round(35 + (1 - dist / Math.max(q.length, 1)) * 30);
      }
    }
    return 0;
  }

  const avg = total / queryTokens.length;
  const coverage = matchedTokens / queryTokens.length;

  // Require at least half of multi-word tokens to match
  if (queryTokens.length > 1 && coverage < 0.5) return 0;

  return Math.round(avg * (0.65 + 0.35 * coverage));
}

/**
 * Filter and sort an array of items by closest match to `query`.
 * @param {Array} items
 * @param {string} query
 * @param {(item: any) => string[]} getFields
 * @param {number} [limit]
 */
export function fuzzyFilter(items, query, getFields, limit) {
  const q = normalize(query);
  if (!q) return typeof limit === 'number' ? items.slice(0, limit) : items;

  const scored = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const score = fuzzyScore(q, getFields(item));
    if (score >= 35) {
      scored.push({ item, score, idx: i });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  const result = scored.map((s) => s.item);
  return typeof limit === 'number' ? result.slice(0, limit) : result;
}
