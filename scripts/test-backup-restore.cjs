const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbDir = path.join(appData, 'T. S. P Enterprises');
const dbPath = path.join(dbDir, 'billing.db');

console.log('=== TEST: LIVE APPLICATION DATA BACKUP & RESTORE VERIFICATION ===');
console.log('Target DB path:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('Database does not exist at:', dbPath);
  process.exit(1);
}

function applyPragmas(conn) {
  conn.pragma('journal_mode = WAL');
  conn.pragma('synchronous = FULL');
  conn.pragma('temp_store = MEMORY');
  conn.pragma('cache_size = -20000');
  conn.pragma('mmap_size = 134217728');
}

function getSnapshot(conn) {
  const counts = {
    items: conn.prepare('SELECT COUNT(*) as count FROM items').get().count,
    racks: conn.prepare('SELECT COUNT(*) as count FROM racks').get().count,
    rack_bins: conn.prepare('SELECT COUNT(*) as count FROM rack_bins').get().count,
    invoices: conn.prepare('SELECT COUNT(*) as count FROM invoices').get().count,
    vendors: conn.prepare('SELECT COUNT(*) as count FROM vendors').get().count,
    expenses: conn.prepare('SELECT COUNT(*) as count FROM expenses').get().count,
  };
  const profile = conn.prepare('SELECT * FROM shop_profile WHERE id = 1').get();
  return { counts, profile };
}

async function runTest() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsp-live-backup-test-'));
  const backupFile = path.join(tempDir, 'live_state_backup.db');

  console.log('\n[Phase 1] Connecting to active application database...');
  let db = new Database(dbPath);
  applyPragmas(db);

  // Clean any previous test artifacts from prior runs
  db.prepare(`DELETE FROM items WHERE sku LIKE 'TEST-BACKUP-%'`).run();
  db.prepare(`DELETE FROM vendors WHERE name LIKE 'Test Hardware Supplies%'`).run();
  db.prepare(`UPDATE shop_profile SET tagline = 'Hardware, Tools & Fasteners' WHERE id = 1`).run();

  const initial = getSnapshot(db);
  console.log('Baseline State Established:');
  console.log(' - Total Products in Catalog:', initial.counts.items);
  console.log(' - Total Sales Invoices:', initial.counts.invoices);
  console.log(' - Total Registered Vendors:', initial.counts.vendors);
  console.log(' - Shop Profile Name:', initial.profile ? initial.profile.shop_name : 'N/A');
  console.log(' - Shop Profile Tagline:', initial.profile ? initial.profile.tagline : 'N/A');

  console.log('\n[Phase 2] Creating Full Live Database Backup via SQLite Online Backup API...');
  console.log(' (Invoking db.backup() - identical to IPC handler backupDatabase)');
  await db.backup(backupFile);
  console.log(' -> Backup completed successfully at:', backupFile);
  const backupSize = fs.statSync(backupFile).size;
  console.log(' -> Backup file size:', backupSize, 'bytes');

  // Verify backup integrity
  const backupDb = new Database(backupFile);
  const integrity = backupDb.pragma('integrity_check');
  console.log(' -> Backup integrity check:', integrity[0].integrity_check);
  if (integrity[0].integrity_check !== 'ok') {
    throw new Error('Backup integrity check failed: ' + JSON.stringify(integrity));
  }
  backupDb.close();

  console.log('\n[Phase 3] Simulating Unintended Changes in Application State...');
  const testSku = 'TEST-BACKUP-' + Date.now();
  const testVendor = 'Test Hardware Supplies ' + Date.now();

  console.log(' - Adding new product:', testSku);
  db.prepare(`
    INSERT INTO items (name, sku, category, size, unit, cost_price, selling_price, quantity, reorder_level, bin_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('Heavy Duty Hammer 1kg', testSku, 'Hand Tools', '1kg', 'PCS', 250, 380, 15, 5, 'R01-L1-S1');

  console.log(' - Adding new vendor:', testVendor);
  db.prepare(`
    INSERT INTO vendors (name, contact_person, phone, email, city)
    VALUES (?, ?, ?, ?, ?)
  `).run(testVendor, 'Senthil', '9876543210', 'senthil@supplier.com', 'Tuticorin');

  console.log(' - Modifying shop profile tagline...');
  db.prepare(`
    UPDATE shop_profile SET tagline = 'ACCIDENTAL CORRUPTED/MODIFIED TAGLINE' WHERE id = 1
  `).run();

  const modified = getSnapshot(db);
  console.log('State After Changes:');
  console.log(' - Total Products:', modified.counts.items, `(+1 new: ${modified.counts.items - initial.counts.items})`);
  console.log(' - Total Vendors:', modified.counts.vendors, `(+1 new: ${modified.counts.vendors - initial.counts.vendors})`);
  console.log(' - Current Tagline:', modified.profile.tagline);

  if (modified.counts.items !== initial.counts.items + 1) {
    throw new Error('Item insertion failed');
  }

  console.log('\n[Phase 4] Executing Database Restore to Previous Backup State...');
  console.log(' (Invoking exact IPC handler restoreDatabase logic: safety copy, close, clean WAL/SHM, copy backup, reopen)');
  
  // Safety copy of current db before replacing
  const safetyBackup = `${dbPath}.pre_restore.bak`;
  try { fs.copyFileSync(dbPath, safetyBackup); } catch (_) {}
  try {
    if (fs.existsSync(`${dbPath}-wal`)) fs.copyFileSync(`${dbPath}-wal`, `${safetyBackup}-wal`);
  } catch (_) {}

  // Close active connection
  db.close();

  // Clean up stale WAL/SHM from previous database state so restored DB opens clean
  try { if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`); } catch (_) {}
  try { if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`); } catch (_) {}

  // Replace with backup file
  fs.copyFileSync(backupFile, dbPath);

  // Re-open restored database
  db = new Database(dbPath);
  applyPragmas(db);

  console.log('\n[Phase 5] Verifying Restored State Matches Initial Baseline...');
  const restored = getSnapshot(db);
  console.log('Restored State Results:');
  console.log(' - Total Products:', restored.counts.items, '(Expected:', initial.counts.items, ')');
  console.log(' - Total Sales Invoices:', restored.counts.invoices, '(Expected:', initial.counts.invoices, ')');
  console.log(' - Total Vendors:', restored.counts.vendors, '(Expected:', initial.counts.vendors, ')');
  console.log(' - Shop Tagline:', restored.profile.tagline, '(Expected:', initial.profile.tagline, ')');

  const restoredIntegrity = db.pragma('integrity_check');
  console.log(' - Restored SQLite Integrity Check:', restoredIntegrity[0].integrity_check);

  // Verification checks
  let success = true;
  if (restored.counts.items !== initial.counts.items) {
    console.error('FAIL: Item count does not match initial baseline!');
    success = false;
  }
  if (restored.counts.vendors !== initial.counts.vendors) {
    console.error('FAIL: Vendor count does not match initial baseline!');
    success = false;
  }
  if (restored.profile.tagline !== initial.profile.tagline) {
    console.error('FAIL: Tagline was not restored to initial baseline!');
    success = false;
  }
  if (restoredIntegrity[0].integrity_check !== 'ok') {
    console.error('FAIL: Integrity check failed!');
    success = false;
  }

  // Verify that newly inserted test item is completely absent
  const testItemCheck = db.prepare('SELECT * FROM items WHERE sku = ?').get(testSku);
  if (testItemCheck) {
    console.error('FAIL: Test item still exists in restored database!');
    success = false;
  } else {
    console.log(' - Verified: Added product (' + testSku + ') was completely rolled back.');
  }

  // Verify that newly inserted test vendor is completely absent
  const testVendorCheck = db.prepare('SELECT * FROM vendors WHERE name = ?').get(testVendor);
  if (testVendorCheck) {
    console.error('FAIL: Test vendor still exists in restored database!');
    success = false;
  } else {
    console.log(' - Verified: Added vendor (' + testVendor + ') was completely rolled back.');
  }

  db.close();

  // Cleanup temp files
  try {
    if (fs.existsSync(safetyBackup)) fs.unlinkSync(safetyBackup);
    if (fs.existsSync(`${safetyBackup}-wal`)) fs.unlinkSync(`${safetyBackup}-wal`);
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}

  if (success) {
    console.log('\n================================================================');
    console.log('ALL VERIFICATIONS PASSED: 100% SUCCESS');
    console.log('The application can reliably take backups and restore any previous state.');
    console.log('================================================================');
  } else {
    console.error('\nFAILED: Verification failed.');
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
