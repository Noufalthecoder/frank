import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

const readSize = (key, sizes, fallback) => {
  try {
    const v = Number(localStorage.getItem(`tsp_pagesize_${key}`));
    if (sizes.includes(v)) return v;
  } catch (_) {}
  return fallback;
};

/**
 * Client-side pagination state.
 *  - the chosen page size is remembered per table (`storageKey`)
 *  - the page is clamped whenever `total` shrinks (filtering, deleting the last row on a page…)
 *  - call `reset()` when a filter/search changes to jump back to page 1
 */
export function usePagination(total, { storageKey = 'default', sizes = DEFAULT_PAGE_SIZES, defaultSize } = {}) {
  const initial = sizes.includes(defaultSize) ? defaultSize : sizes[0];
  const [pageSize, setPageSizeState] = useState(() => readSize(storageKey, sizes, initial));
  const [page, setPageState] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);

  // The table identity changed (e.g. Catalog switched grid <-> list): load that table's own size
  const sizesKey = sizes.join(',');
  const lastKey = React.useRef(`${storageKey}|${sizesKey}`);
  useEffect(() => {
    const k = `${storageKey}|${sizesKey}`;
    if (lastKey.current === k) return;
    lastKey.current = k;
    setPageSizeState(readSize(storageKey, sizes, initial));
    setPageState(1);
  }, [storageKey, sizesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (page !== current) setPageState(current);
  }, [page, current]);

  const setPage = useCallback((p) => setPageState(Math.max(1, Math.floor(Number(p)) || 1)), []);
  const reset = useCallback(() => setPageState(1), []);
  const setPageSize = useCallback(
    (n) => {
      if (!sizes.includes(n)) return;
      setPageSizeState(n);
      setPageState(1);
      try {
        localStorage.setItem(`tsp_pagesize_${storageKey}`, String(n));
      } catch (_) {}
    },
    [sizes, storageKey]
  );

  return {
    page: current,
    pageSize,
    totalPages,
    total,
    from: total === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(current * pageSize, total),
    setPage,
    setPageSize,
    reset,
    sizes,
    slice: (list) => list.slice((current - 1) * pageSize, current * pageSize),
  };
}

// 1 … 4 [5] 6 … 20  (always first, last, and the neighbours of the current page)
function pageWindow(page, totalPages) {
  const set = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (page >= totalPages - 2) [totalPages - 1, totalPages - 2, totalPages - 3].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push('gap-' + n);
    out.push(n);
  });
  return out;
}

export default function Pagination({ page, pageSize, total, onPage, onPageSize, sizes = DEFAULT_PAGE_SIZES, className = '' }) {
  const { t } = useLanguage();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const items = useMemo(() => pageWindow(page, totalPages), [page, totalPages]);

  const btn =
    'h-7 min-w-7 px-1.5 inline-flex items-center justify-center rounded-md border text-xs font-medium tabular-nums transition-colors ' +
    'disabled:opacity-40 disabled:cursor-not-allowed';
  const idle = 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900';

  return (
    <div className={`px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-slate-500 ${className}`}>
      <span className="tabular-nums" aria-live="polite">
        {total === 0 ? t('pg_none') : t('pg_showing', { from, to, total })}
      </span>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {onPageSize && sizes.length > 1 && (
          <label className="flex items-center gap-2">
            <span>{t('pg_rows')}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              className="h-7 bg-white border border-slate-200 rounded-md px-1.5 text-xs text-slate-700"
            >
              {sizes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center gap-1" aria-label={t('pg_nav')}>
            <button className={`${btn} ${idle}`} disabled={page <= 1} onClick={() => onPage(1)} title={t('pg_first')} aria-label={t('pg_first')}>
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button className={`${btn} ${idle}`} disabled={page <= 1} onClick={() => onPage(page - 1)} title={t('pg_prev')} aria-label={t('pg_prev')}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {items.map((it) =>
              typeof it === 'string' ? (
                <span key={it} className="px-1 text-slate-400" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={it}
                  onClick={() => onPage(it)}
                  aria-label={t('pg_page', { n: it })}
                  aria-current={it === page ? 'page' : undefined}
                  className={`${btn} ${it === page ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-600' : idle}`}
                >
                  {it}
                </button>
              )
            )}
            <button className={`${btn} ${idle}`} disabled={page >= totalPages} onClick={() => onPage(page + 1)} title={t('pg_next')} aria-label={t('pg_next')}>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button className={`${btn} ${idle}`} disabled={page >= totalPages} onClick={() => onPage(totalPages)} title={t('pg_last')} aria-label={t('pg_last')}>
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
