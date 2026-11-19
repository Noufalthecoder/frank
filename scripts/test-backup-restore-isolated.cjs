const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');

function applyPragmas(conn) {
  conn.pragma('journal_mode = WAL');
  conn.pragma('synchronous = FULL');
  conn.pragma('temp_store = MEMORY');
  conn.pragma('cache_size = -20000');
  conn.pragma('mmap_size = 134217728');
}

function initTestSchema(conn) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS shop_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      shop_name TEXT NOT NULL DEFAULT 'T. S. P Enterprises',
      tagline TEXT DEFAULT 'Hardware, Tools & Fasteners',
      phone TEXT DEFAULT '+91 98765 43210',
      email TEXT DEFAULT 'tspenterprises@gmail.com',
      address TEXT DEFAULT 'Beach Road · Tharuvaikulam, Thoothukudi 628105',
      gstin TEXT DEFAULT '33AABCT1234F1Z5'
    );
    INSERT OR IGNORE INTO shop_profile (id, shop_name, tagline) VALUES (1, 'T. S. P Enterprises', 'Hardware, Tools & Fasteners');

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      size TEXT,
      unit TEXT NOT NULL DEFAULT 'PCS',
      category TEXT NOT NULL,
      selling_price REAL NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      quantity REAL NOT NULL DEFAULT 0,
      reorder_level REAL NOT NULL DEFAULT 10,
      bin_id TEXT,
      status TEXT NOT NULL DEFAULT 'Active'
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Paid',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function testBackupRestoreIsolation() {
  console.log('=== TEST 1: ISOLATED WAL BACKUP & RESTORE LIFECYCLE ===');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsp-iso-test-'));
  const testDbPath = path.join(tempDir, 'billing.db');
  const backupPath = path.join(tempDir, 'backup.db');

  console.log('1. Initializing clean test database in WAL mode at:', testDbPath);
  let db = new Database(testDbPath);
  applyPragmas(db);
  initTestSchema(db);

  // Insert initial state items
  const insertItem = db.prepare(`
    INSERT INTO items (sku, name, category, selling_price, cost_price, quantity)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertItem.run('SKU-001', 'Brass Screws 1/2 inch', 'Fasteners', 15, 10, 500);
  insertItem.run('SKU-002', 'Cutting Disc 4 inch', 'Cutting Tools', 45, 30, 80);

  const initialItemsCount = db.prepare('SELECT COUNT(*) as c FROM items').get().c;
  const initialProfile = db.prepare('SELECT * FROM shop_profile WHERE id = 1').get();
  console.log(' - Initial Items:', initialItemsCount);
  console.log(' - Initial Tagline:', initialProfile.tagline);

  console.log('\n2. Creating Online Backup with db.backup()...');
  await db.backup(backupPath);
  console.log(' - Backup file created, size:', fs.statSync(backupPath).size, 'bytes');

  // Verify backup integrity
  const bDb = new Database(backupPath);
  const bCheck = bDb.pragma('integrity_check');
  console.log(' - Backup integrity check:', bCheck[0].integrity_check);
  if (bCheck[0].integrity_check !== 'ok') throw new Error('Backup integrity failed');
  bDb.close();

  console.log('\n3. Simulating user changes in application (new sales, catalog items, profile update)...');
  insertItem.run('SKU-003', 'Hammer 500g', 'Hand Tools', 250, 180, 20);
  insertItem.run('SKU-004', 'Adjustable Wrench 10 inch', 'Hand Tools', 420, 310, 15);
  db.prepare(`
    INSERT INTO invoices (invoice_number, customer_name, total)
    VALUES ('INV-TEST-001', 'John Doe', 750)
  `).run();
  db.prepare(`
    UPDATE shop_profile SET tagline = 'NEW MODIFIED TAGLINE - ACCIDENTAL CHANGE' WHERE id = 1
  `).run();
  db.prepare(`DELETE FROM items WHERE sku = 'SKU-001'`).run();

  const modifiedItems = db.prepare('SELECT sku, name FROM items').all();
  const modifiedInvoices = db.prepare('SELECT COUNT(*) as c FROM invoices').get().c;
  const modifiedProfile = db.prepare('SELECT tagline FROM shop_profile WHERE id = 1').get();
  console.log(' - Modified Items count:', modifiedItems.length, '(SKU-001 deleted, SKU-003 & 004 added)');
  console.log(' - Modified Invoices count:', modifiedInvoices);
  console.log(' - Modified Tagline:', modifiedProfile.tagline);

  console.log('\n4. Performing Database Restore (closing DB, removing stale WAL/SHM, replacing with backup)...');
  db.close();

  // Clean up WAL and SHM files so the restored DB starts completely clean
  const walFile = `${testDbPath}-wal`;
  const shmFile = `${testDbPath}-shm`;
  if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
  if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);

  fs.copyFileSync(backupPath, testDbPath);

  // Reconnect as Electron main.js does
  db = new Database(testDbPath);
  applyPragmas(db);

  console.log('\n5. Verifying Restored Database State...');
  const restoredItems = db.prepare('SELECT sku, name, quantity FROM items ORDER BY sku').all();
  const restoredInvoices = db.prepare('SELECT COUNT(*) as c FROM invoices').get().c;
  const restoredProfile = db.prepare('SELECT * FROM shop_profile WHERE id = 1').get();
  const restoredCheck = db.pragma('integrity_check');

  console.log(' - Restored Items count:', restoredItems.length, '(Expected:', initialItemsCount, ')');
  console.log(' - Restored Invoices count:', restoredInvoices, '(Expected: 0)');
  console.log(' - Restored Tagline:', restoredProfile.tagline, '(Expected:', initialProfile.tagline, ')');
  console.log(' - Restored DB integrity check:', restoredCheck[0].integrity_check);

  let passed = true;
  if (restoredItems.length !== 2) {
    console.error('FAIL: Item count mismatch');
    passed = false;
  }
  if (!restoredItems.find(i => i.sku === 'SKU-001')) {
    console.error('FAIL: Deleted item SKU-001 was not restored!');
    passed = false;
  }
  if (restoredItems.find(i => i.sku === 'SKU-003')) {
    console.error('FAIL: Added item SKU-003 still exists after restore!');
    passed = false;
  }
  if (restoredInvoices !== 0) {
    console.error('FAIL: Test invoice still exists after restore!');
    passed = false;
  }
  if (restoredProfile.tagline !== initialProfile.tagline) {
    console.error('FAIL: Tagline was not restored!');
    passed = false;
  }
  if (restoredCheck[0].integrity_check !== 'ok') {
    console.error('FAIL: Integrity check not ok');
    passed = false;
  }

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });

  if (passed) {
    console.log('\n>>> ISOLATED TEST PASSED: State restoration is 100% accurate. <<<');
  } else {
    throw new Error('Isolated test failed');
  }
}

testBackupRestoreIsolation().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
