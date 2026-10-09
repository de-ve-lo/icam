const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class DatabaseManager {
  constructor() {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      this.dbPath = path.join(__dirname, '../../database/installments.db');
    } else {
      const userData = (app && app.getPath) ? app.getPath('userData') : path.join(__dirname, '../../database');
      this.dbPath = path.join(userData, 'installments.db');
    }
    this.db = null;
  }

  async initialize() {
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.db = new Database(this.dbPath);
    this.db.pragma('foreign_keys = ON');
    console.log('Connected to SQLite database');
    await this.createTables();
  }

  async createTables() {
    const tables = [
      // Products table
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT NOT NULL,
        current_price REAL NOT NULL,
        purchase_price REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Suppliers table
      `CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Stock table
      `CREATE TABLE IF NOT EXISTS stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        supplier_id INTEGER NOT NULL,
        engine_no TEXT UNIQUE,
        chassis_no TEXT UNIQUE,
        stock_date DATE NOT NULL,
        stock_no TEXT NOT NULL,
        is_sold BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
      )`,

      // Customers table
      `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_no TEXT NOT NULL UNIQUE,
        cnic_no TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        registration_date DATE NOT NULL,
        other_info TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Guarantors table
      `CREATE TABLE IF NOT EXISTS guarantors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        cnic_no TEXT NOT NULL,
        address TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
      )`,

      // Customer purchases table
      `CREATE TABLE IF NOT EXISTS customer_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        stock_id INTEGER NOT NULL,
        supplier_id INTEGER NOT NULL,
        sale_price REAL NOT NULL,
        purchase_price REAL NOT NULL,
        profit_amount REAL NOT NULL,
        profit_percentage REAL NOT NULL,
        advance_received REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        installment_months INTEGER NOT NULL,
        monthly_installment REAL NOT NULL,
        start_date DATE NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id),
        FOREIGN KEY (stock_id) REFERENCES stock (id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
      )`,

      // Installments table
      `CREATE TABLE IF NOT EXISTS installments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL,
        installment_no INTEGER NOT NULL,
        due_date DATE NOT NULL,
        amount REAL NOT NULL,
        paid_amount REAL DEFAULT 0,
        paid_date DATE,
        status TEXT DEFAULT 'pending',
        remaining_balance REAL NOT NULL,
        is_shortage BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_id) REFERENCES customer_purchases (id) ON DELETE CASCADE
      )`,

      // Payments table
      `CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        installment_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date DATE NOT NULL,
        receipt_no TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (installment_id) REFERENCES installments (id),
        FOREIGN KEY (customer_id) REFERENCES customers (id)
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    console.log('All database tables created successfully');

    // Run lightweight migrations
    await this.runMigrations();
  }

  async runMigrations() {
    try {
      const hasName = await this.columnExists('customers', 'customer_name');
      if (!hasName) {
        await this.run("ALTER TABLE customers ADD COLUMN customer_name TEXT DEFAULT ''");
        console.log('Migration applied: customers.customer_name');
      }

      // Soft-delete columns for installments
      const instHasDeleted = await this.columnExists('installments', 'is_deleted');
      if (!instHasDeleted) {
        await this.run("ALTER TABLE installments ADD COLUMN is_deleted INTEGER DEFAULT 0");
        await this.run("ALTER TABLE installments ADD COLUMN deleted_at DATETIME");
        await this.run("ALTER TABLE installments ADD COLUMN deleted_reason TEXT");
        console.log('Migration applied: installments soft-delete columns');
      }

      // Soft-delete columns for payments
      const payHasDeleted = await this.columnExists('payments', 'is_deleted');
      if (!payHasDeleted) {
        await this.run("ALTER TABLE payments ADD COLUMN is_deleted INTEGER DEFAULT 0");
        await this.run("ALTER TABLE payments ADD COLUMN deleted_at DATETIME");
        await this.run("ALTER TABLE payments ADD COLUMN deleted_reason TEXT");
        console.log('Migration applied: payments soft-delete columns');
      }

      // Soft-delete columns for customer_purchases
      const cpHasDeleted = await this.columnExists('customer_purchases', 'is_deleted');
      if (!cpHasDeleted) {
        await this.run("ALTER TABLE customer_purchases ADD COLUMN is_deleted INTEGER DEFAULT 0");
        await this.run("ALTER TABLE customer_purchases ADD COLUMN deleted_at DATETIME");
        await this.run("ALTER TABLE customer_purchases ADD COLUMN deleted_reason TEXT");
        console.log('Migration applied: customer_purchases soft-delete columns');
      }

      // Create discounts table if missing
      await this.run(`CREATE TABLE IF NOT EXISTS discounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        purchase_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (purchase_id) REFERENCES customer_purchases(id)
      )`);
      // Create penalties table if missing
      await this.run(`CREATE TABLE IF NOT EXISTS penalties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        purchase_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        per_installment REAL NOT NULL,
        installments_affected INTEGER NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (purchase_id) REFERENCES customer_purchases(id)
      )`);

      // Ensure updated_at exists where code expects it
      const cpHasUpdated = await this.columnExists('customer_purchases', 'updated_at');
      if (!cpHasUpdated) {
        await this.run("ALTER TABLE customer_purchases ADD COLUMN updated_at DATETIME");
        console.log('Migration applied: customer_purchases.updated_at');
      }

      const instHasUpdated = await this.columnExists('installments', 'updated_at');
      if (!instHasUpdated) {
        await this.run("ALTER TABLE installments ADD COLUMN updated_at DATETIME");
        console.log('Migration applied: installments.updated_at');
      }

      // Create expense_types table if missing
      await this.run(`CREATE TABLE IF NOT EXISTS expense_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Create expenses table if missing
      await this.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_type_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (expense_type_id) REFERENCES expense_types(id)
      )`);

      // Create cash_sales table if missing
      await this.run(`CREATE TABLE IF NOT EXISTS cash_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        stock_id INTEGER NOT NULL,
        sale_date DATE NOT NULL,
        agreed_price REAL NOT NULL,
        received_price REAL NOT NULL,
        due_amount REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'completed',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (stock_id) REFERENCES stock(id)
      )`);

      // Create supplier_payments table if missing
      await this.run(`CREATE TABLE IF NOT EXISTS supplier_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date DATE NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        reference_no TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )`);

      // Add balance field to suppliers table if missing
      const supplierHasBalance = await this.columnExists('suppliers', 'balance');
      if (!supplierHasBalance) {
        await this.run("ALTER TABLE suppliers ADD COLUMN balance REAL DEFAULT 0");
        console.log('Migration applied: suppliers.balance column');
      }

      // Soft-delete columns for penalties
      const penaltiesHasDeleted = await this.columnExists('penalties', 'is_deleted');
      if (!penaltiesHasDeleted) {
        await this.run("ALTER TABLE penalties ADD COLUMN is_deleted INTEGER DEFAULT 0");
        await this.run("ALTER TABLE penalties ADD COLUMN deleted_at DATETIME");
        await this.run("ALTER TABLE penalties ADD COLUMN deleted_reason TEXT");
        console.log('Migration applied: penalties soft-delete columns');
      }

      // Soft-delete columns for discounts
      const discountsHasDeleted = await this.columnExists('discounts', 'is_deleted');
      if (!discountsHasDeleted) {
        await this.run("ALTER TABLE discounts ADD COLUMN is_deleted INTEGER DEFAULT 0");
        await this.run("ALTER TABLE discounts ADD COLUMN deleted_at DATETIME");
        await this.run("ALTER TABLE discounts ADD COLUMN deleted_reason TEXT");
        console.log('Migration applied: discounts soft-delete columns');
      }

      if (!(await this.columnExists('payments', 'type'))) {
        await this.run("ALTER TABLE payments ADD COLUMN type TEXT DEFAULT 'payment'");
        console.log('Migration applied: payments.type');
      }
      if (!(await this.columnExists('payments', 'purchase_id'))) {
        await this.run('ALTER TABLE payments ADD COLUMN purchase_id INTEGER');
        console.log('Migration applied: payments.purchase_id');
      }
      if (!(await this.columnExists('payments', 'created_by'))) {
        await this.run('ALTER TABLE payments ADD COLUMN created_by INTEGER');
        console.log('Migration applied: payments.created_by');
      }

      if (!(await this.columnExists('products', 'category'))) {
        await this.run("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'bike'");
        console.log('Migration applied: products.category');
      }
      if (!(await this.columnExists('products', 'unit'))) {
        await this.run("ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'piece'");
        console.log('Migration applied: products.unit');
      }

      if (!(await this.columnExists('stock', 'imei'))) {
        await this.run('ALTER TABLE stock ADD COLUMN imei TEXT');
        console.log('Migration applied: stock.imei');
      }
      if (!(await this.columnExists('stock', 'reg_no'))) {
        await this.run('ALTER TABLE stock ADD COLUMN reg_no TEXT');
        console.log('Migration applied: stock.reg_no');
      }
      if (!(await this.columnExists('stock', 'serial_no'))) {
        await this.run('ALTER TABLE stock ADD COLUMN serial_no TEXT');
        console.log('Migration applied: stock.serial_no');
      }
      if (!(await this.columnExists('stock', 'quantity'))) {
        await this.run('ALTER TABLE stock ADD COLUMN quantity INTEGER DEFAULT 1');
        console.log('Migration applied: stock.quantity');
      }
      await this.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_imei ON stock(imei) WHERE imei IS NOT NULL');
      await this.makeStockIdentifiersNullable();

      await this.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','employee')),
        is_active INTEGER NOT NULL DEFAULT 1,
        must_change INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      if (!(await this.columnExists('users', 'must_change'))) {
        await this.run('ALTER TABLE users ADD COLUMN must_change INTEGER DEFAULT 0');
        console.log('Migration applied: users.must_change');
      }

      await this.run(`CREATE TABLE IF NOT EXISTS shop_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        shop_name TEXT NOT NULL DEFAULT 'Installment Management',
        phone TEXT DEFAULT '',
        address TEXT DEFAULT '',
        logo_path TEXT DEFAULT '',
        idle_minutes INTEGER DEFAULT 30
      )`);
      await this.run("INSERT OR IGNORE INTO shop_settings (id, shop_name) VALUES (1, 'Installment Management')");
      if (!(await this.columnExists('shop_settings', 'drive_folder'))) {
        await this.run("ALTER TABLE shop_settings ADD COLUMN drive_folder TEXT DEFAULT ''");
      }
      if (!(await this.columnExists('shop_settings', 'whatsapp_template'))) {
        await this.run("ALTER TABLE shop_settings ADD COLUMN whatsapp_template TEXT DEFAULT ''");
      }
      if (!(await this.columnExists('customers', 'photo_path'))) {
        await this.run("ALTER TABLE customers ADD COLUMN photo_path TEXT DEFAULT ''");
      }
      if (!(await this.columnExists('customers', 'cnic_photo_path'))) {
        await this.run("ALTER TABLE customers ADD COLUMN cnic_photo_path TEXT DEFAULT ''");
      }
      if (!(await this.columnExists('customers', 'cnic_front_photo_path'))) {
        await this.run("ALTER TABLE customers ADD COLUMN cnic_front_photo_path TEXT DEFAULT ''");
      }
      if (!(await this.columnExists('customers', 'cnic_back_photo_path'))) {
        await this.run("ALTER TABLE customers ADD COLUMN cnic_back_photo_path TEXT DEFAULT ''");
      }
      await this.run(`UPDATE customers
        SET cnic_front_photo_path = cnic_photo_path
        WHERE (cnic_front_photo_path IS NULL OR cnic_front_photo_path = '')
          AND cnic_photo_path IS NOT NULL
          AND cnic_photo_path != ''`);

      await this.run(`CREATE TABLE IF NOT EXISTS staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT DEFAULT '',
        monthly_salary REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'active',
        join_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      await this.run(`CREATE TABLE IF NOT EXISTS staff_salary_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        staff_id INTEGER NOT NULL,
        entry_date DATE NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('advance','salary')),
        amount REAL NOT NULL,
        month TEXT NOT NULL,
        notes TEXT,
        expense_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id)
      )`);
      await this.run("INSERT OR IGNORE INTO expense_types (name, description) VALUES ('Staff Salary', 'Staff salary and salary advances')");

      await this.run(`CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        at DATETIME DEFAULT CURRENT_TIMESTAMP,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        amount REAL,
        detail TEXT
      )`);

    } catch (e) {
      console.error('Migration error:', e);
    }
  }

  async makeStockIdentifiersNullable() {
    const info = await this.query('PRAGMA table_info(stock)');
    if (!Array.isArray(info) || info.length === 0) return;
    const engine = info.find((col) => col.name === 'engine_no');
    const chassis = info.find((col) => col.name === 'chassis_no');
    if (!engine || !chassis) return;
    if (engine.notnull === 0 && chassis.notnull === 0) return;

    const columns = info.map((col) => col.name);
    const columnList = columns.join(', ');
    this.db.exec('PRAGMA foreign_keys = OFF');
    this.db.exec('BEGIN');
    try {
      this.db.exec(`
        CREATE TABLE stock_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          supplier_id INTEGER NOT NULL,
          engine_no TEXT UNIQUE,
          chassis_no TEXT UNIQUE,
          stock_date DATE NOT NULL,
          stock_no TEXT NOT NULL,
          is_sold BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          imei TEXT,
          reg_no TEXT,
          serial_no TEXT,
          quantity INTEGER DEFAULT 1,
          FOREIGN KEY (product_id) REFERENCES products (id),
          FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        )
      `);
      this.db.exec(`INSERT INTO stock_new (${columnList}) SELECT ${columnList} FROM stock`);
      this.db.exec('DROP TABLE stock');
      this.db.exec('ALTER TABLE stock_new RENAME TO stock');
      this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_imei ON stock(imei) WHERE imei IS NOT NULL');
      this.db.exec('COMMIT');
      console.log('Migration applied: stock.engine_no and stock.chassis_no nullable');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    } finally {
      this.db.exec('PRAGMA foreign_keys = ON');
    }
  }

  async columnExists(table, column) {
    const info = await this.query(`PRAGMA table_info(${table})`);
    return Array.isArray(info) && info.some(col => col.name === column);
  }

  query(sql, params = []) {
    try {
      const rows = this.db.prepare(sql).all(...(params || []));
      return Promise.resolve(rows);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  get(sql, params = []) {
    try {
      const row = this.db.prepare(sql).get(...(params || []));
      return Promise.resolve(row);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  run(sql, params = []) {
    try {
      const info = this.db.prepare(sql).run(...(params || []));
      return Promise.resolve({
        id: info.lastInsertRowid,
        changes: info.changes
      });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  backup(backupPath) {
    try {
      if (!backupPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(path.dirname(this.dbPath), 'backups');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        backupPath = path.join(backupDir, `backup_${timestamp}.db`);
      }
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      fs.copyFileSync(this.dbPath, backupPath);
      console.log(`Database backed up to: ${backupPath}`);
      return Promise.resolve(backupPath);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  restore(backupPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        return Promise.reject(new Error('Backup file not found'));
      }
      if (this.db) this.db.close();
      fs.copyFileSync(backupPath, this.dbPath);
      this.db = new Database(this.dbPath);
      this.db.pragma('foreign_keys = ON');
      console.log('Database restored from backup');
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
        console.log('Database connection closed');
      } catch (err) {
        console.error('Error closing database:', err);
      }
      this.db = null;
    }
  }
}

module.exports = DatabaseManager;