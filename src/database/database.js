const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    this.dbPath = path.join(__dirname, '../../database/installments.db');
    this.db = null;
  }

  initialize() {
    return new Promise((resolve, reject) => {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables()
            .then(resolve)
            .catch(reject);
        }
      });
    });
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
        engine_no TEXT NOT NULL UNIQUE,
        chassis_no TEXT NOT NULL UNIQUE,
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

      await this.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','employee')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      await this.run(`CREATE TABLE IF NOT EXISTS shop_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        shop_name TEXT NOT NULL DEFAULT 'Installment Management',
        phone TEXT DEFAULT '',
        address TEXT DEFAULT '',
        logo_path TEXT DEFAULT '',
        idle_minutes INTEGER DEFAULT 30
      )`);
      await this.run("INSERT OR IGNORE INTO shop_settings (id, shop_name) VALUES (1, 'Installment Management')");

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

  async columnExists(table, column) {
    const info = await this.query(`PRAGMA table_info(${table})`);
    return Array.isArray(info) && info.some(col => col.name === column);
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }

  backup(backupPath) {
    return new Promise((resolve, reject) => {
      if (!backupPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = path.join(__dirname, '../../database/backups', `backup_${timestamp}.db`);
      }

      // Ensure backup directory exists
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      fs.copyFile(this.dbPath, backupPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Database backed up to: ${backupPath}`);
          resolve(backupPath);
        }
      });
    });
  }

  restore(backupPath) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(backupPath)) {
        reject(new Error('Backup file not found'));
        return;
      }

      fs.copyFile(backupPath, this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database restored from backup');
          resolve();
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = DatabaseManager;