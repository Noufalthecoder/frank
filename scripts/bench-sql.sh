#!/usr/bin/env bash
# Benchmark the SQLite access paths used by electron/main.js, before vs after the performance changes.
#
# Uses the `sqlite3` CLI (better-sqlite3 is built for Electron's ABI and cannot load in plain Node).
# The schema and the secondary indexes are extracted from electron/main.js so this cannot drift from the app.
# Never touches the real app DB: everything lives in a temp dir.
#
# Usage:  scripts/bench-sql.sh [workdir]     (default: mktemp -d; set REPS=n to change repetitions, default 7)
#         SCALE=small scripts/bench-sql.sh   (2k items / 10k invoices, quick smoke test)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAIN="$ROOT/electron/main.js"
WORK="${1:-$(mktemp -d "${TMPDIR:-/tmp}/stockmate-bench.XXXXXX")}"
REPS="${REPS:-7}"
mkdir -p "$WORK"
command -v sqlite3 >/dev/null || { echo "sqlite3 CLI required"; exit 1; }
command -v perl >/dev/null || { echo "perl required (for ms timing)"; exit 1; }

if [ "${SCALE:-full}" = small ]; then N_ITEMS=2000; N_INV=10000; N_PO=500; N_EXP=2000
else N_ITEMS=20000; N_INV=100000; N_PO=5000; N_EXP=20000; fi

BASE="$WORK/base.db"      # schema + data, NO secondary indexes ("before")
IDX="$WORK/indexed.db"    # same data + indexes from main.js ("after")
rm -f "$BASE" "$IDX" "$BASE"-wal "$BASE"-shm "$IDX"-wal "$IDX"-shm

# ---- schema: CREATE TABLE statements and INDEX block are lifted from main.js -------------------
awk '/CREATE TABLE IF NOT EXISTS shop_profile/{p=1} p&&/^  `\);/{exit} p' "$MAIN" > "$WORK/schema.sql"
awk '/INDEXES-BEGIN/{p=1;next} /INDEXES-END/{p=0} p' "$MAIN" > "$WORK/indexes.sql"
[ -s "$WORK/schema.sql" ] && [ -s "$WORK/indexes.sql" ] || { echo "failed to extract schema/indexes from main.js"; exit 1; }
echo "alter table items add column image_url TEXT DEFAULT '';" >> "$WORK/schema.sql"

# ---- synthetic data (deterministic) -------------------------------------------------------------
cat > "$WORK/data.sql" <<SQL
PRAGMA journal_mode=WAL; PRAGMA synchronous=OFF;
BEGIN;
-- 20 racks x 16 bins (4 levels x 4 slots)
WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r WHERE n<20)
INSERT INTO racks(code,name,zone,levels,slots_per_level) SELECT printf('R%02d',n),'Rack '||n,'Z'||(n%4),4,4 FROM r;
WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM r WHERE n<20),
 l(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM l WHERE n<4),
 s(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM s WHERE n<4)
INSERT INTO rack_bins(bin_code,rack_code,level_no,slot_no) SELECT printf('R%02d-L%d-S%d',r.n,l.n,s.n),printf('R%02d',r.n),l.n,s.n FROM r,l,s;
-- items: mixed-case SKUs, ~14% zero stock, ~85% assigned to a bin (some stored lower-case)
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<$N_ITEMS)
INSERT INTO items(sku,name,size,unit,category,brand,selling_price,cost_price,quantity,reorder_level,bin_id,status)
SELECT CASE WHEN i%5=0 THEN lower(printf('SKU-%06d',i)) ELSE printf('SKU-%06d',i) END,
  'Item number '||i, (i%12)||'mm','PCS',
  CASE i%6 WHEN 0 THEN 'Fasteners' WHEN 1 THEN 'Tools' WHEN 2 THEN 'Electrical' WHEN 3 THEN 'Plumbing' WHEN 4 THEN 'Paints & Adhesives' ELSE 'Others' END,
  'Brand'||(i%30), 50+(i%900), 30+(i%700),
  CASE WHEN i%7=0 THEN 0 ELSE (i*37)%400 END, 10,
  CASE WHEN i%20<17 THEN CASE WHEN i%3=0 THEN lower(printf('R%02d-L%d-S%d',1+(i*7)%20,1+(i/20)%4,1+(i/80)%4)) ELSE printf('R%02d-L%d-S%d',1+(i*7)%20,1+(i/20)%4,1+(i/80)%4) END ELSE '' END,
  CASE i%25 WHEN 0 THEN 'Unavailable' ELSE 'Active' END
FROM n;
-- invoices: ~15 min apart (~3 years), 3 line items of realistic JSON, 3% returned
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<$N_INV)
INSERT INTO invoices(invoice_number,date_time,customer_name,customer_phone,subtotal,discount,total,payment_mode,items_json,items_count,status)
SELECT printf('INV-%07d',i), datetime('2024-01-01','+'||(i*15)||' minutes'),
  CASE i%8 WHEN 0 THEN 'Walk-in Customer' WHEN 1 THEN 'Rahul Traders' WHEN 2 THEN 'Murugan Hardware' WHEN 3 THEN 'Selvam & Sons' WHEN 4 THEN 'Anitha Constructions' WHEN 5 THEN 'K. Raja' WHEN 6 THEN 'Priya 50% off' ELSE 'Walk-in Customer' END,
  '9'||printf('%09d',i%1000000000), 100+(i%5000), i%50, 100+(i%5000)-(i%50),
  CASE i%3 WHEN 0 THEN 'Cash' WHEN 1 THEN 'UPI' ELSE 'Card' END,
  '[{"id":'||(1+i%$N_ITEMS)||',"sku":"'||printf('SKU-%06d',1+i%$N_ITEMS)||'","name":"Item number '||(1+i%$N_ITEMS)||'","quantity":2,"unit":"PCS","selling_price":120.5,"discount":0,"total":241},'
  ||'{"id":'||(1+(i*3)%$N_ITEMS)||',"sku":"'||printf('SKU-%06d',1+(i*3)%$N_ITEMS)||'","name":"Item number '||(1+(i*3)%$N_ITEMS)||'","quantity":1,"unit":"PCS","selling_price":80,"discount":0,"total":80},'
  ||'{"id":'||(1+(i*7)%$N_ITEMS)||',"sku":"'||printf('SKU-%06d',1+(i*7)%$N_ITEMS)||'","name":"Item number '||(1+(i*7)%$N_ITEMS)||'","quantity":5,"unit":"PCS","selling_price":12,"discount":0,"total":60}]',
  3, CASE WHEN i%33=0 THEN 'Returned' ELSE 'Completed' END
FROM n;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<$N_PO)
INSERT INTO purchase_orders(po_number,vendor_name,order_date,amount,status,items_json)
SELECT printf('PO-%06d',i),'Vendor '||(i%40),date('2022-01-01','+'||(i/5)||' days'),1000+(i%9000),
  CASE WHEN i%4=0 THEN 'Request' ELSE 'Received' END,
  '[{"product_id":'||(1+i%$N_ITEMS)||',"sku":"'||printf('SKU-%06d',1+i%$N_ITEMS)||'","name":"Item","quantity":10}]' FROM n;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<$N_EXP)
INSERT INTO expenses(category,description,amount,date,payment_mode)
SELECT CASE i%5 WHEN 0 THEN 'Rent' WHEN 1 THEN 'Electricity' WHEN 2 THEN 'Salary' WHEN 3 THEN 'Transport' ELSE 'Misc' END,
  'Expense '||i, 50+(i%3000), date('2023-01-01','+'||(i/20)||' days'),'Cash' FROM n;
COMMIT;
SQL

echo "== building synthetic DB ($N_ITEMS items, $N_INV invoices, $N_PO POs, $N_EXP expenses, 20 racks x 16 bins) =="
sqlite3 "$BASE" < "$WORK/schema.sql"
sqlite3 "$BASE" < "$WORK/data.sql" >/dev/null
sqlite3 "$BASE" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null
cp "$BASE" "$IDX"
sqlite3 "$IDX" < "$WORK/indexes.sql"
sqlite3 "$IDX" "ANALYZE;" ; sqlite3 "$BASE" "ANALYZE;"   # app runs PRAGMA optimize; give both the same stats
ls -lh "$BASE" "$IDX" | awk '{print "  "$5"  "$9}'

# ---- timing helper: median wall-clock ms of `sqlite3 db < file`, minus empty-process baseline ----
ms() { perl -MTime::HiRes=time -e '
  my ($db,$f,$n,$pre)=@ARGV; my @t;
  for (1..$n) { my $s=time; system("sqlite3 \"$db\" < \"$f\" > /dev/null"); push @t,(time-$s)*1000 }
  @t=sort {$a<=>$b} @t; printf "%.1f\n",$t[int(@t/2)]' "$1" "$2" "$REPS"; }
PRE='PRAGMA cache_size=-20000; PRAGMA temp_store=MEMORY; PRAGMA mmap_size=134217728;'   # same as applyPragmas()
echo "SELECT 1;" > "$WORK/empty.sql"
BASELINE=$(ms "$BASE" "$WORK/empty.sql")
RESULTS="$WORK/results.tsv"; : > "$RESULTS"
# bench <label> <sqlfile>   -> runs on BASE (before) and IDX (after); both get the same query text
bench() {
  local label="$1" f="$2"; { echo "$PRE"; cat "$f"; } > "$f.run"
  local b a; b=$(ms "$BASE" "$f.run"); a=$(ms "$IDX" "$f.run")
  awk -v l="$label" -v b="$b" -v a="$a" -v z="$BASELINE" 'BEGIN{b-=z;a-=z;if(b<0.1)b=0.1;if(a<0.1)a=0.1;printf "%s\t%.1f\t%.1f\t%.1fx\n",l,b,a,b/a}' >> "$RESULTS"
}
# bench2 <label> <sql-old> <sql-new> : different query text, both on IDX-or-BASE as given
bench_pair() {
  local label="$1" dbo="$2" fo="$3" dbn="$4" fn="$5"; { echo "$PRE"; cat "$fo"; } > "$fo.run"; { echo "$PRE"; cat "$fn"; } > "$fn.run"
  local b a; b=$(ms "$dbo" "$fo.run"); a=$(ms "$dbn" "$fn.run")
  awk -v l="$label" -v b="$b" -v a="$a" -v z="$BASELINE" 'BEGIN{b-=z;a-=z;if(b<0.1)b=0.1;if(a<0.1)a=0.1;printf "%s\t%.1f\t%.1f\t%.1fx\n",l,b,a,b/a}' >> "$RESULTS"
}

# ---- workloads --------------------------------------------------------------------------------
# 1. Invoices: old = load every row (getInvoices); new = one page + count + sum (getInvoicesPage)
cat > "$WORK/inv_old.sql" <<'SQL'
SELECT * FROM invoices ORDER BY id DESC;
SQL
cat > "$WORK/inv_p1.sql" <<'SQL'
SELECT * FROM invoices ORDER BY id DESC LIMIT 12 OFFSET 0;
SELECT COUNT(*), COALESCE(SUM(CASE WHEN status<>'Returned' THEN total END),0) FROM invoices;
SQL
cat > "$WORK/inv_search.sql" <<'SQL'
-- search 'rahul' + dateFrom, page 2 (substring LIKE cannot use an index: honest full scan of the filtered set)
SELECT * FROM invoices WHERE date_time >= '2026-01-01' AND (invoice_number LIKE '%rahul%' ESCAPE '\' OR customer_name LIKE '%rahul%' ESCAPE '\' OR payment_mode LIKE '%rahul%' ESCAPE '\' OR CAST(total AS TEXT) LIKE '%rahul%' ESCAPE '\') ORDER BY id DESC LIMIT 12 OFFSET 12;
SELECT COUNT(*), COALESCE(SUM(CASE WHEN status<>'Returned' THEN total END),0) FROM invoices WHERE date_time >= '2026-01-01' AND (invoice_number LIKE '%rahul%' ESCAPE '\' OR customer_name LIKE '%rahul%' ESCAPE '\' OR payment_mode LIKE '%rahul%' ESCAPE '\' OR CAST(total AS TEXT) LIKE '%rahul%' ESCAPE '\');
SQL
cat > "$WORK/inv_date.sql" <<'SQL'
-- dateFrom only (last ~2 months): date_time index turns count/sum into a range scan
SELECT * FROM invoices WHERE date_time >= '2026-09-15' ORDER BY id DESC LIMIT 12 OFFSET 0;
SELECT COUNT(*), COALESCE(SUM(CASE WHEN status<>'Returned' THEN total END),0) FROM invoices WHERE date_time >= '2026-09-15';
SQL
bench_pair "invoices: load all rows -> page 1 (+count,sum)"  "$BASE" "$WORK/inv_old.sql" "$IDX" "$WORK/inv_p1.sql"
bench      "invoices page: dateFrom=2026-09-15 (before=no idx)" "$WORK/inv_date.sql"
bench      "invoices page: search+dateFrom (no index possible)" "$WORK/inv_search.sql"

# 2. SKU lookups: UPPER(sku)=? as used by PO receive (applyPoStockDelta) -- 300 lookups
awk -v n="$N_ITEMS" 'BEGIN{for(i=1;i<=300;i++){k=1+(i*61)%n; printf "SELECT id,sku,quantity,status FROM items WHERE UPPER(sku) = '\''SKU-%06d'\'';\n",k}}' > "$WORK/sku_upper.sql"
bench "300x items WHERE UPPER(sku)=?"            "$WORK/sku_upper.sql"

# 3. createInvoice stock path: 'sku=? OR id=?' vs branch on id / sku (300 lines)
awk -v n="$N_ITEMS" 'BEGIN{for(i=1;i<=300;i++){k=1+(i*61)%n; printf "SELECT id,sku,name,quantity FROM items WHERE (sku = '\''SKU-%06d'\'' OR id = %d);\n",k,k}}' > "$WORK/or_old.sql"
awk -v n="$N_ITEMS" 'BEGIN{for(i=1;i<=300;i++){k=1+(i*61)%n; printf "SELECT id,sku,name,quantity FROM items WHERE id = %d;\n",k}}' > "$WORK/or_new.sql"
bench_pair "300x stock check (sku=? OR id=?) vs id=?  [NOT adopted]" "$BASE" "$WORK/or_old.sql" "$BASE" "$WORK/or_new.sql"

# 4. rack delete/shrink guard: UPPER(bin_id) IN (SELECT bin_code ...) for each rack (20x)
awk 'BEGIN{for(r=1;r<=20;r++) printf "SELECT COUNT(*) FROM items WHERE UPPER(bin_id) IN (SELECT bin_code FROM rack_bins WHERE rack_code = '\''R%02d'\'');\n",r}' > "$WORK/binused.sql"
bench "20x items WHERE UPPER(bin_id) IN (rack bins)" "$WORK/binused.sql"

# 5. getRacks SQL part: old = 1 racks + 20 rack_bins ORDER BY + all items; new = 1+1+items with a bin
{ echo "SELECT * FROM racks ORDER BY code;"; awk 'BEGIN{for(r=1;r<=20;r++) printf "SELECT * FROM rack_bins WHERE rack_code = '\''R%02d'\'' ORDER BY level_no, slot_no;\n",r}'; echo "SELECT id, sku, name, quantity, unit, bin_id FROM items;"; } > "$WORK/racks_old.sql"
cat > "$WORK/racks_new.sql" <<'SQL'
SELECT * FROM racks ORDER BY code;
SELECT * FROM rack_bins ORDER BY rack_code, level_no, slot_no;
SELECT id, sku, name, quantity, unit, bin_id, reorder_level FROM items WHERE bin_id IS NOT NULL AND bin_id <> '';
SQL
bench_pair "getRacks SQL: N+1 + all items -> 3 queries" "$BASE" "$WORK/racks_old.sql" "$IDX" "$WORK/racks_new.sql"

# 6. other list queries
echo "SELECT * FROM items WHERE quantity <= 0 ORDER BY name ASC;" > "$WORK/oos.sql"
bench "getOutOfStockItems (quantity<=0, ORDER BY name)" "$WORK/oos.sql"
echo "SELECT * FROM expenses ORDER BY date DESC, id DESC;" > "$WORK/exp_old.sql"
cat > "$WORK/exp_new.sql" <<'SQL'
SELECT * FROM expenses ORDER BY date DESC, id DESC LIMIT 12 OFFSET 0;
SELECT COUNT(*), COALESCE(SUM(amount),0) FROM expenses;
SQL
bench_pair "expenses: load all -> page 1 (+count,sum)" "$BASE" "$WORK/exp_old.sql" "$IDX" "$WORK/exp_new.sql"
echo "SELECT * FROM purchase_orders ORDER BY id DESC;" > "$WORK/po_old.sql"
cat > "$WORK/po_new.sql" <<'SQL'
SELECT * FROM purchase_orders WHERE status = 'Request' ORDER BY id DESC LIMIT 12 OFFSET 0;
SELECT COUNT(*) FROM purchase_orders WHERE status = 'Request';
SQL
bench_pair "purchase_orders: load all -> page 1, status=Request" "$BASE" "$WORK/po_old.sql" "$IDX" "$WORK/po_new.sql"

# 7. write overhead of the new indexes (run on throw-away copies so the read benches above stay clean)
cp "$BASE" "$WORK/w_base.db"; cp "$IDX" "$WORK/w_idx.db"
{ echo "BEGIN;"; awk -v n="$N_ITEMS" 'BEGIN{for(i=1;i<=2000;i++) printf "INSERT INTO items(sku,name,unit,category,selling_price,cost_price,quantity,reorder_level,bin_id) VALUES('\''NEW-%06d'\'','\''New %d'\'','\''PCS'\'','\''Others'\'',10,5,%d,10,'\''R01-L1-S1'\'');\n",i,i,i%50}'; echo "COMMIT;"; } > "$WORK/w_ins.sql"
{ echo "BEGIN;"; awk -v n="$N_ITEMS" 'BEGIN{for(i=1;i<=2000;i++) printf "UPDATE items SET quantity = ROUND(MAX(0, quantity - 1), 6) WHERE id = %d;\n",1+(i*61)%n}'; echo "COMMIT;"; } > "$WORK/w_upd.sql"
{ echo "BEGIN;"; awk 'BEGIN{for(i=1;i<=2000;i++) printf "INSERT INTO invoices(invoice_number,date_time,customer_name,subtotal,total,payment_mode,items_json,items_count,status) VALUES('\''NEWINV-%07d'\'','\''2026-11-01 10:00:00'\'','\''X'\'',100,100,'\''Cash'\'','\''[]'\'',1,'\''Completed'\'');\n",i}'; echo "COMMIT;"; } > "$WORK/w_invins.sql"
wbench() { local label="$1" f="$2"; local b a; b=$(ms "$WORK/w_base.db" "$f"); a=$(ms "$WORK/w_idx.db" "$f")
  awk -v l="$label" -v b="$b" -v a="$a" -v z="$BASELINE" 'BEGIN{b-=z;a-=z;printf "%s\t%.1f\t%.1f\t%.2fx\n",l,b,a,b/a}' >> "$RESULTS"; }
# updates are idempotent enough to repeat; inserts would hit UNIQUE on repeat, so run those once via REPS=1
wbench "write: 2000 UPDATE items.quantity (one txn)" "$WORK/w_upd.sql"
REPS_SAVE=$REPS; REPS=1
cp "$BASE" "$WORK/w_base.db"; cp "$IDX" "$WORK/w_idx.db"; wbench "write: 2000 INSERT items (one txn, 1 run)" "$WORK/w_ins.sql"
cp "$BASE" "$WORK/w_base.db"; cp "$IDX" "$WORK/w_idx.db"; wbench "write: 2000 INSERT invoices (one txn, 1 run)" "$WORK/w_invins.sql"
REPS=$REPS_SAVE

# ---- getRacks JS side (the O(bins x items) filter), measured in plain Node on the same data ------
if command -v node >/dev/null; then
  sqlite3 -json "$BASE" "SELECT * FROM racks ORDER BY code;" > "$WORK/racks.json"
  sqlite3 -json "$BASE" "SELECT * FROM rack_bins ORDER BY rack_code, level_no, slot_no;" > "$WORK/bins.json"
  sqlite3 -json "$BASE" "SELECT id, sku, name, quantity, unit, bin_id, reorder_level FROM items;" > "$WORK/itemsrb.json"
  cat > "$WORK/racks_js.cjs" <<'JS'
const fs = require('fs'); const [d] = process.argv.slice(2);
const racks = JSON.parse(fs.readFileSync(d + '/racks.json')), allBins = JSON.parse(fs.readFileSync(d + '/bins.json')), allItems = JSON.parse(fs.readFileSync(d + '/itemsrb.json'));
const oldWay = () => racks.map(r => { const bins = allBins.filter(b => b.rack_code === r.code);
  const e = bins.map(b => { const bi = allItems.filter(i => (i.bin_id || '').toUpperCase() === b.bin_code.toUpperCase()); return { ...b, quantity: bi.reduce((s, i) => s + (Number(i.quantity) || 0), 0), items: bi }; });
  return { ...r, binsCount: e.length, bins: e }; });
const newWay = () => { const byBin = new Map(); for (const i of allItems) { const k = (i.bin_id || '').toUpperCase(); if (!k) continue; (byBin.get(k) || byBin.set(k, []).get(k)).push(i); }
  const byRack = new Map(); for (const b of allBins) (byRack.get(b.rack_code) || byRack.set(b.rack_code, []).get(b.rack_code)).push(b);
  return racks.map(r => { const e = (byRack.get(r.code) || []).map(b => { const bi = byBin.get(b.bin_code.toUpperCase()) || []; return { ...b, quantity: bi.reduce((s, i) => s + (Number(i.quantity) || 0), 0), items: bi }; });
    return { ...r, binsCount: e.length, bins: e }; }); };
const med = f => { const t = []; for (let k = 0; k < 7; k++) { const s = process.hrtime.bigint(); f(); t.push(Number(process.hrtime.bigint() - s) / 1e6); } return t.sort((a, b) => a - b)[3]; };
if (JSON.stringify(oldWay()) !== JSON.stringify(newWay().map(r => r))) { console.log('MISMATCH'); process.exit(1); }
console.log(med(oldWay).toFixed(1) + '\t' + med(newWay).toFixed(1));
JS
  read -r jo jn < <(node "$WORK/racks_js.cjs" "$WORK")
  awk -v b="$jo" -v a="$jn" 'BEGIN{printf "getRacks JS grouping: O(bins x items) filter -> Map\t%.1f\t%.1f\t%.1fx\n",b,a,b/a}' >> "$RESULTS"
fi

# ---- query plans --------------------------------------------------------------------------------
plan() { echo; echo "-- $1"; for d in BASE IDX; do eval db=\$$d; echo "   [$([ $d = BASE ] && echo before || echo after)]"; sqlite3 "$db" "EXPLAIN QUERY PLAN $2" | sed 's/^/     /'; done; }
echo; echo "================ EXPLAIN QUERY PLAN (before = no secondary indexes) ================"
plan "items WHERE UPPER(sku) = ?"                       "SELECT id FROM items WHERE UPPER(sku) = 'SKU-000100';"
plan "items WHERE UPPER(bin_id) IN (SELECT bin_code ...)" "SELECT COUNT(*) FROM items WHERE UPPER(bin_id) IN (SELECT bin_code FROM rack_bins WHERE rack_code = 'R01');"
plan "items WHERE sku = ? OR id = ?  (old createInvoice)" "SELECT id FROM items WHERE (sku = 'SKU-000100' OR id = 100);"
plan "items WHERE id = ?  (new, id branch)"             "SELECT id FROM items WHERE id = 100;"
plan "items WHERE sku = ?  (new, sku branch)"           "SELECT id FROM items WHERE sku = 'SKU-000100';"
plan "rack_bins WHERE rack_code=? ORDER BY level,slot"  "SELECT * FROM rack_bins WHERE rack_code = 'R01' ORDER BY level_no, slot_no;"
plan "rack_bins ORDER BY rack_code, level, slot (new getRacks)" "SELECT * FROM rack_bins ORDER BY rack_code, level_no, slot_no;"
plan "items WHERE quantity <= 0 ORDER BY name"          "SELECT * FROM items WHERE quantity <= 0 ORDER BY name ASC;"
plan "invoices page, no filter"                         "SELECT * FROM invoices ORDER BY id DESC LIMIT 12 OFFSET 0;"
plan "invoices page, dateFrom"                          "SELECT * FROM invoices WHERE date_time >= '2026-09-15' ORDER BY id DESC LIMIT 12 OFFSET 0;"
plan "invoices count/sum, dateFrom"                     "SELECT COUNT(*), SUM(total) FROM invoices WHERE date_time >= '2026-09-15';"
plan "invoices page, status"                            "SELECT * FROM invoices WHERE status = 'Returned' ORDER BY id DESC LIMIT 12;"
plan "expenses ORDER BY date DESC, id DESC LIMIT"       "SELECT * FROM expenses ORDER BY date DESC, id DESC LIMIT 12 OFFSET 0;"
plan "expenses WHERE date >= ? (dateFrom)"              "SELECT * FROM expenses WHERE date >= '2026-01-01' ORDER BY date DESC, id DESC LIMIT 12;"
plan "purchase_orders WHERE status=? ORDER BY id DESC"  "SELECT * FROM purchase_orders WHERE status = 'Request' ORDER BY id DESC LIMIT 12;"
plan "invoices WHERE invoice_number = ?"                "SELECT * FROM invoices WHERE invoice_number = 'INV-0000100';"

echo; echo "================ TIMINGS (median of $REPS runs, wall ms, process-start baseline ${BASELINE} ms subtracted) ================"
echo "(rows where before/after use different SQL text compare old query form -> new query form;"
echo " otherwise the same SQL runs on the DB without / with the new indexes)"
{ printf "workload\tbefore_ms\tafter_ms\tspeedup\n"; cat "$RESULTS"; } | column -t -s $'\t'
echo; echo "workdir: $WORK"
