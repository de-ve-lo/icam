# Installment Management System

Desktop app for shop installment and cash sales, built with Electron and SQLite.

Developed By **POVDEV** — [povdev.com](https://povdev.com) | WhatsApp: @wpfahad | Email: mypovdev@gmail.com

Version **1.0.0**. Currency is **Rs.**

## Features

### Operations
- **Search**: Dedicated page for installment, cash, and stock. Query plus From/To dates. Looks up account, invoice (`CS-000001`, `CS-YYYYMMDD-...`), receipt (`REC-...`), engine, chassis, IMEI, serial, stock no, reg no, CNIC, phone, name, and guarantor. Unique documents open overlay detail; identifier hits stay a list. Overlay reuses existing pay, print, collect, and edit. Header search stays. Dashboard overdue View opens Search overlay.
- **Products**: Add, edit, and manage models with current and purchase price, plus categories.
- **Suppliers**: Supplier records for purchases and balances.
- **Stock**: Engine, chassis, IMEI, serial, stock no, and registration. Snapshot price on sale. Ledger amount uses product price unless an override snapshot is set.
- **Customers**: Profiles with CNIC photos, phone, address, and multiple guarantors. Identity prints as `{name} C/O {g1} C/O {g2}` (spaces on both sides of each `C/O`). Calculator and cash-sale add list customers who have never been sold.
- **Installments**: Schedule, Pay Now, void, Print Ledger, receipts. Partial pay stays on the same row. Leftover rolls to the next installment only after the due month passes (`isMonthPassed`). Short = unpaid where `due_date <= as-of`. Current = unpaid same month where `due_date > as-of`. Grand remaining is unchanged by roll.
- **Cash Sales**: Record cash sales, later collections by collection date, WhatsApp Remind when due amount is greater than zero. Invoices `CS-000001`.
- **Supplier Payments**: Record payments and see balances.
- **Expenses**: Types plus expenses, edit and in-app delete, local calendar month.
- **Staff Salary**: Cycle from join-date anniversary. Remaining subtracts advances and salary already paid this cycle. After a full salary payment, Advance applies to the next cycle.
- **Dues & Reminders**: Installment dues, cash-sale dues, overdue. WhatsApp reminders with a shop template.
- **Reports**: Date range plus as-of (End date) vs period (Start–End). Print preview with Print and Save PDF.

### Reports
- Monthly Collection
- Customer-wise Collection
- Customer Outstanding (Short, Current, total)
- Installment Receivable and Received
- Cash Sales
- Supplier Payments
- Expense
- Stock
- Daily Cash Book
- Overdue Aging (0-30 / 31-60 / 90+; nets Pay Now leftover)
- Customer Statement (installments plus cash sales and collections)
- Profit Snapshot
- Upcoming Dues
- Defaulter List
- Supplier Ledger
- Purchase-wise Remaining
- Universal Report (sales, expenses, staff)

### Admin and chrome
- Admin / employee login. Default `admin` / `admin`; password must change on first sign-in.
- Idle lock (minutes in Shop Settings).
- Users (admin): create admin or employee accounts.
- Shop Settings: name, phone, address, logo, idle lock, WhatsApp template (`{name} {account} {amount} {due_date} {shop}`).
- Backup to file, restore (admin), Google Drive for Desktop folder backup/restore.
- Header: global search, refresh, calculator, backup, system reset (admin), user chip.
- TailAdmin light UI, Font Awesome, Segoe UI.

## Shop PC install

Install from the GitHub release NSIS installer:

https://github.com/de-ve-lo/icam/releases/tag/v1.0.0

Default login is `admin` / `admin`; you must change the password on first sign-in.

The live database lives in the Electron `userData` folder (not next to the installer). Use Backup in the header to copy it. Uninstall does not wipe the database.

The installer is unsigned; Windows SmartScreen may warn.

## Developer setup

Node.js 16+ is required.

```bash
npm install
npm run dev
```

Shop PCs should run the installed app, not `start.bat`. Developers use `npm install` once and `npm run dev`.

```bash
npm test
```

### Windows installer

```bash
npm run build-win
```

The installer is written to `dist/` (gitignored). Release assets are uploaded to GitHub, not committed.

## Project Structure

```
installment-management-app/
├── src/
│   ├── main.js
│   ├── preload.js
│   ├── database/
│   │   └── database.js
│   └── renderer/
│       ├── index.html
│       ├── styles/
│       │   ├── main.css
│       │   ├── components.css
│       │   └── animations.css
│       └── scripts/
│           ├── main.js
│           ├── database.js
│           ├── search.js
│           ├── dashboard.js
│           ├── installments.js
│           ├── installment-engine.js
│           ├── cash-sales.js
│           ├── calculator.js
│           ├── customers.js
│           ├── stock.js
│           ├── products.js
│           ├── suppliers.js
│           ├── supplier-payments.js
│           ├── expenses.js
│           ├── staff.js
│           ├── staff-salary-lib.js
│           ├── dues-reminders.js
│           ├── reports.js
│           ├── auth.js
│           ├── utils.js
│           └── stock-ledger.js
├── assets/
│   └── icon.ico
├── package.json
└── README.md
```

## Database

SQLite. Packaged app uses Electron `userData`. Dev mode uses `database/`.

Main tables include products, suppliers, stock, customers, guarantors, customer_purchases, installments, payments, cash_sales, cash_sale_collections, expenses, staff, and users.

## Usage

1. Sign in. Change the default admin password when prompted.
2. Set shop name, phone, address, and logo under Settings.
3. Add suppliers and products, then stock (engine/chassis/IMEI as needed).
4. Add customers and guarantors (CNIC photos optional).
5. Open Calculator to create an installment, or Cash Sales to record a cash sale. Both list never-sold customers.
6. Use Search for account, invoice, receipt, engine, chassis, CNIC, name, or a date range. Pay, print, and collect from the overlay.
7. Process payments on Installments (Pay Now, void, Print Ledger). Short uses `due_date <= as-of`; leftover roll waits until the next month.
8. Dues & Reminders and Reports for collections, aging, statements, and WhatsApp Remind.
9. Backup from the header or Settings. Optional Google Drive for Desktop folder.

## Backup

- Header Backup and Settings Backup to file write next to the `userData` database (`backups/`). Dev mode uses `database/backups/`.
- Restore is admin only and replaces current data.
- Google Drive: install Drive for Desktop, choose the Drive folder, then Backup to Drive.

## Troubleshooting

**Application won't start:**
- Ensure Node.js is installed
- Run `npm install`
- Check the console for errors

**Database errors:**
- Check write permissions for Electron `userData` (or `database/` in `npm run dev`)
- Verify better-sqlite3: `npm list better-sqlite3`

**Build failures:**
- Reinstall dependencies, then `npm run build-win`

**UI not loading:**
- Check the renderer console (F12 in dev)
- Confirm CSS and script files under `src/renderer/`

## Version History

- **v1.0.0**: Shop installment and cash-sale desktop app. Dedicated Search page, TailAdmin light chrome, due-date Short vs year-month leftover roll, C/O identity, cash collections on collection date, expenses edit, cash-sale Remind, aging buckets, customer statement cash sales, staff join-date salary cycle, Drive backup, WhatsApp reminders, Print Ledger, NSIS installer.

## License

MIT
