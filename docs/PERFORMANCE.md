# SQLite performance notes

Scope: `electron/main.js` (better-sqlite3), `electron/preload.js`, `src/lib/browserFallback.js`.
All numbers below come from `scripts/bench-sql.sh` on one machine (macOS, SQLite 3.51 CLI), synthetic data:
20,000 items, 100,000 invoices (3 line items of JSON each, ~55 MB DB), 5,000 purchase orders, 20,000 expenses, 20 racks x 16 bins.

## Re-running

```
scripts/bench-sql.sh [workdir]        # full size, ~15 s; REPS=n for more repetitions
SCALE=small scripts/bench-sql.sh      # 10x smaller smoke run
```

It uses the `sqlite3` CLI (better-sqlite3 is built for Electron's ABI and cannot load in plain Node), pulls the
`CREATE TABLE` statements and the index block straight out of `electron/main.js`, builds a temp DB (never the real
one), and prints `EXPLAIN QUERY PLAN` before/after plus a timing table (median wall ms of N process runs, empty-process
baseline subtracted, ~1 ms resolution). "Before" = same data with no secondary indexes.

## What was slow

1. Only the UNIQUE-constraint indexes existed. `UPPER(sku) = ?` (PO receive/stock delta) and `UPPER(bin_id) IN (...)`
   (rack delete/shrink guards) cannot use a plain index, so each lookup scanned all items; `rack_bins WHERE rack_code=?
   ORDER BY level_no, slot_no` scanned + sorted; `expenses ORDER BY date DESC, id DESC` sorted the whole table.
2. `getRacks` ran one `rack_bins` query per rack and filtered all items per bin in JS (bins x items `toUpperCase()` calls).
3. `getInvoices` / `getPurchaseOrders` / `getExpenses` return every row (invoices include `items_json`) over IPC; cost grows
   linearly forever.

## What changed

| Area | Change |
|---|---|
| Indexes (`initSchema`, idempotent `IF NOT EXISTS`) | `items(UPPER(sku))`, `items(UPPER(bin_id))`, `rack_bins(rack_code, level_no, slot_no)`, `invoices(date_time)`, `expenses(date, id)` |
| Pragmas (`applyPragmas`, also re-applied after DB restore) | `synchronous=NORMAL`, `temp_store=MEMORY`, `cache_size=-20000` (~20 MB), `mmap_size=128 MB` (WAL was already on) |
| `PRAGMA optimize` | at the end of `initSchema` (gathers stats for the new indexes on first run) and on `before-quit` |
| `getRacks` | 3 queries (racks, all bins ordered, assigned items) + `Map` grouping. Same return shape; item objects gain `reorder_level`. Browser fallback uses the same Map approach |
| New paged handlers | `getInvoicesPage`, `getPurchaseOrdersPage`, `getExpensesPage` (main.js, preload.js, browserFallback.js). `getInvoices` etc. unchanged |

### Plan changes (EXPLAIN QUERY PLAN)

| Query | Before | After |
|---|---|---|
| `items WHERE UPPER(sku)=?` | SCAN items | SEARCH USING idx_items_upper_sku |
| `items WHERE UPPER(bin_id) IN (SELECT bin_code ...)` | SCAN items (+ automatic index on rack_bins) | SCAN covering idx_items_upper_bin, SEARCH rack_bins USING idx_rack_bins_rack |
| `rack_bins WHERE rack_code=? ORDER BY level_no, slot_no` | SCAN + TEMP B-TREE ORDER BY | SEARCH USING idx_rack_bins_rack (no sort) |
| `rack_bins ORDER BY rack_code, level_no, slot_no` | SCAN + TEMP B-TREE | SCAN USING idx_rack_bins_rack (no sort) |
| `expenses ORDER BY date DESC, id DESC LIMIT n` | SCAN + TEMP B-TREE | SCAN USING idx_expenses_date (no sort, stops at LIMIT) |
| `expenses WHERE date >= ?` | SCAN + TEMP B-TREE | SEARCH USING idx_expenses_date (date>?) |
| invoices `COUNT/SUM WHERE date_time >= ?` | SCAN invoices | SEARCH USING idx_invoices_date (date_time>?) |

### Timings (before -> after)

Measured by `scripts/bench-sql.sh` (full size, median of 7).

| Workload | Before ms | After ms | Speedup |
|---|---:|---:|---:|
| Invoices: load all rows -> page 1 + count + sum | 261.6 | 24.8 | 10.5x |
| Invoices page with `dateFrom` (last ~2 months), count/sum via index | 25.6 | 2.1 | 12.2x |
| Invoices page with search + `dateFrom` (`LIKE '%x%'`, no index possible) | 38.8 | 25.0 | 1.6x (index only narrows the date range) |
| 300 x `WHERE UPPER(sku)=?` | 796.8 | 4.3 | 185x |
| 20 x `UPPER(bin_id) IN (rack bins)` | 90.7 | 39.0 | 2.3x |
| `getRacks` grouping in JS (320 bins x 17k assigned items), Node | 147.7 | 2.5 | 59x |
| Expenses: load all -> page 1 + count + sum | 26.1 | 1.5 | 17x |
| Purchase orders: load all -> page 1 (status filter) | 6.8 | 0.8 | 8.5x |
| Write: 2,000 `UPDATE items.quantity` (one txn) | 19.4 | 19.2 | 1.0x (no overhead; quantity is not indexed) |
| Write: 2,000 `INSERT items` (one txn) | 16.9 | 21.6 | 0.78x (3 extra indexes to maintain) |
| Write: 2,000 `INSERT invoices` (one txn) | 17.2 | 17.9 | 0.96x |

Caveats, honestly:

- "Load all -> page" rows compare *query forms*, not an index effect (the PO and expense wins are mostly `LIMIT`). The
  sqlite3 CLI timing excludes what really hurts in the app: building JS objects and structured-cloning ~55 MB of
  `items_json` over IPC, plus the renderer filtering it. The real saving for invoices is larger than 10x.
- Invoices page still reads every candidate row for the total/sum when a text search is used (substring `LIKE` can't use an
  index). 100k invoices scan in ~25 ms; fine for a single-shop POS. An FTS table would be the next step if it ever matters.
- `getRacks` SQL-side alone is neutral-to-slightly slower (20.2 -> 25.5 ms; the ordered bins are read through a non-covering
  index). The win is the JS side (row above), and one IPC call stays one call. Fewer round trips matter more than this 5 ms.
- Process-start noise is ~7.6 ms and timings have ~1 ms resolution; differences under ~2 ms (e.g. the 300x stock-check
  rows, `getOutOfStockItems`) are not meaningful.

## Paging contract

All three: `page` (default 1, clamped to `[1, totalPages]`), `pageSize` (default 12, clamped to `[1, 200]`; `0`/missing -> 12).
Response always has `rows, total, page, pageSize, totalPages` (`totalPages >= 1` even when empty). Bound parameters only; `%`, `_`, `\`
in `search` are escaped (`ESCAPE '\'`) so they match literally. Search is a case-insensitive substring (SQLite `LIKE` is
ASCII-case-insensitive; the browser fallback uses `toLowerCase`, so non-ASCII letters may differ in preview mode only).

- `getInvoicesPage({ page, pageSize, search, dateFrom, status })` -> `+ sumTotal`. Sorted `id DESC`. `search` over
  `invoice_number, customer_name, payment_mode, total` (as text, so `241.0` for whole REAL values). `dateFrom` is `date_time >= ?`
  (string compare). `status` exact. `sumTotal` = SUM(total) of the filtered set excluding `Returned`. Rows include `items_json`.
- `getPurchaseOrdersPage({ page, pageSize, search, status })`. Sorted `id DESC`. `search` over `po_number, vendor_name,
  order_date, amount`. `status` `'Received'`/`'Closed'` -> received, anything else non-empty -> request (legacy `Open`/`Closed`
  folded exactly as `getPurchaseOrders` does in preview mode and the startup migration does in SQLite).
- `getExpensesPage({ page, pageSize, search, category, dateFrom })` -> `+ sumAmount` (SUM(amount) of the filtered set).
  Sorted `date DESC, id DESC`. `search` over `category, description, payment_mode, amount`. `category` exact. `dateFrom` = `date >= ?`.

Do other lists need paging?

- `getVendors`: small by nature (a shop has tens); no.
- `getDayClosings`: one row per business day (~365/yr, small rows); not yet, revisit after several years.
- `getPurchaseOrders`, `getExpenses`: grow with every transaction; paged handlers added. `getItems` (catalogue) is needed whole
  by POS search and the racks screen, so it stays unpaged.

## Deliberately NOT changed

- **`createInvoice` / `returnInvoice` `WHERE sku = ? OR id = ?`**: EXPLAIN shows SQLite already plans `MULTI-INDEX OR`
  (unique-sku index + rowid), so it is not a scan. Splitting into id/sku branches changes semantics in edge cases (the OR
  can touch two rows; two statements could double-apply to one row) for no measurable gain (4.1 -> 3.0 ms per 300, noise). Left as is.
  Note `createInvoice` also runs its insert + stock updates as separate statements, not one transaction; wrapping it would be a
  behaviour change (atomicity) so it was left for a separate decision.
- **`UPPER(sku)` in PO receive**: the query text is unchanged; the new expression index is what fixes it.
- **Indexes not added** because EXPLAIN/timing showed no benefit or no query uses them: `items(quantity)` (planner picks it for
  `quantity <= 0` but the timing is identical, and it would tax every sale's stock update), `items(category)` and `items(status)`
  (no SQL filters on them; the UI filters in JS), `invoices(status)` and `purchase_orders(status)` (planner keeps the `id` scan with
  LIMIT; tables too small / filter too unselective), `invoices(invoice_number)` and `day_closings(closing_date)` (already UNIQUE),
  `expenses(category)`.
- **`foreign_keys`**: not enabled. The schema declares no FOREIGN KEY constraints (bins and items reference racks/bins by code
  text), so it would do nothing and could only break restored legacy data.
- **`synchronous=NORMAL` tradeoff**: in WAL mode an app crash loses nothing; an OS crash/power cut may lose the last few commits
  (the DB stays consistent). Acceptable for a POS with backups; switch back to `FULL` if that is not acceptable.
- UI call sites were not changed (owned elsewhere); the new handlers are additive.
